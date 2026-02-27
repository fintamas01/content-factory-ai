// app/api/ai-agent/compare/route.ts
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toUrl(input: string) {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("Empty URL");
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(toUrl(inputUrl));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return String(inputUrl ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function isSameDomain(url: string, domain: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === domain || h.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 5000) {
  const t = String(s ?? "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function extractEmails(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((m ?? []).map((x) => x.toLowerCase()))).slice(0, 10);
}

function extractPhones(text: string) {
  const m = text.match(/(\+\d{1,3}\s?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g);
  const cleaned = (m ?? [])
    .map((x) => normalizeWhitespace(x))
    .filter((x) => x.replace(/\D/g, "").length >= 8)
    .slice(0, 12);
  return Array.from(new Set(cleaned));
}

function pickInternalLinks($: cheerio.CheerioAPI, baseUrl: string, targetDomain: string) {
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    if (href.startsWith("#")) return;
    if (href.startsWith("mailto:")) return;
    if (href.startsWith("tel:")) return;
    if (href.startsWith("javascript:")) return;

    let abs = "";
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    if (!isSameDomain(abs, targetDomain)) return;
    if (/\.(jpg|jpeg|png|webp|svg|pdf|zip|rar|mp4|mp3)$/i.test(abs)) return;

    abs = abs.replace(/\/$/, "");
    links.push(abs);
  });

  return Array.from(new Set(links));
}

async function fetchHtml(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentFactoryBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false as const, url, status: res.status, html: "", error: `Fetch failed: ${res.status}` };
    }

    const html = await res.text();
    return { ok: true as const, url, status: 200, html, error: null as string | null };
  } catch (e: any) {
    return { ok: false as const, url, status: 0, html: "", error: String(e?.message ?? e) };
  } finally {
    clearTimeout(t);
  }
}

type OnDomainPage = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  hasJsonLd: boolean;
  hasSchemaOrgMicrodata: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  rawTextLength: number;
  foundEmails: string[];
  foundPhones: string[];
  foundAddressesLike: string[];
  foundCityOrRegionLike: string[];
};

type CrawlContext = {
  targetDomain: string;
  seedUrl: string;
  pages: OnDomainPage[];
  pageCount: number;
  errors: Array<{ url: string; error: string }>;
};

function parseOnDomainPage(url: string, html: string): OnDomainPage {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("title").first().text() || "") || null;

  const metaDescription =
    normalizeWhitespace($('meta[name="description"]').attr("content") || "") || null;

  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;

  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasSchemaOrgMicrodata = $('[itemscope]').length > 0 || /https?:\/\/schema\.org/i.test(html);

  const h1 = $("h1")
    .slice(0, 6)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h2 = $("h2")
    .slice(0, 10)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h3 = $("h3")
    .slice(0, 10)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  $("script,noscript,style,svg").remove();

  const mainCandidates = ["main", "#content", ".site-content", ".entry-content", ".elementor", "body"];
  let bestText = "";
  for (const sel of mainCandidates) {
    const t = normalizeWhitespace($(sel).text());
    if (t && t.length > bestText.length) bestText = t;
  }

  const foundEmails = extractEmails(bestText);
  const foundPhones = extractPhones(bestText);

  const addressLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) => /utca|strada|street|nr\.|no\.|bl\.|ap\.|jud|county|romania|magyarország|ország/i.test(s))
    .slice(0, 6);

  const cityRegionLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) => /sepsi|târgu|maros|kolozsvár|cluj|bucharest|budapest|satumar|szatmár|românia|romania/i.test(s))
    .slice(0, 6);

  return {
    url,
    title,
    metaDescription,
    hasJsonLd,
    hasSchemaOrgMicrodata,
    hasOpenGraph,
    hasTwitterCard,
    headings: { h1, h2, h3 },
    rawTextLength: bestText.length,
    foundEmails,
    foundPhones,
    foundAddressesLike: addressLike,
    foundCityOrRegionLike: cityRegionLike,
  };
}

async function crawlOnDomain(seedUrl: string, targetDomain: string, maxPages: number, timeoutMs: number) {
  const seed = toUrl(seedUrl).replace(/\/$/, "");
  const seen = new Set<string>();
  const queue: string[] = [seed];
  const pages: OnDomainPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const fetched = await fetchHtml(url, timeoutMs);
    if (!fetched.ok) {
      errors.push({ url, error: fetched.error || `Fetch failed (${fetched.status})` });
      continue;
    }

    const page = parseOnDomainPage(url, fetched.html);
    pages.push(page);

    try {
      const $ = cheerio.load(fetched.html);
      const links = pickInternalLinks($, url, targetDomain);
      for (const l of links.slice(0, 25)) {
        if (!seen.has(l)) queue.push(l);
      }
    } catch {
      // ignore
    }
  }

  const ctx: CrawlContext = {
    targetDomain,
    seedUrl: seed,
    pages,
    pageCount: pages.length,
    errors,
  };

  return ctx;
}

type ScorePartKey = "meta" | "structuredData" | "headings" | "contact" | "geo" | "textVolume";
type ScorePart = { score: number; max: number; notes: string[] };
type ScoreParts = Record<ScorePartKey, ScorePart>;

const SCORE_KEYS: ScorePartKey[] = ["meta", "structuredData", "headings", "contact", "geo", "textVolume"];

function emptyPart(max = 0): ScorePart {
  return { score: 0, max, notes: [] };
}

function sumScore(parts: ScoreParts) {
  const total = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.score ?? 0), 0);
  const max = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.max ?? 0), 0);
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return { total, max, pct };
}

function buildScorePartsFromCrawl(crawl: CrawlContext): ScoreParts {
  const parts: ScoreParts = {
    meta: emptyPart(25),
    structuredData: emptyPart(25),
    headings: emptyPart(15),
    contact: emptyPart(15),
    geo: emptyPart(10),
    textVolume: emptyPart(10),
  };

  const pages = crawl.pages;

  // META
  const anyTitle = pages.some((p) => (p.title ?? "").length > 0);
  const anyMetaDesc = pages.some((p) => (p.metaDescription ?? "").length > 0);
  const anyOg = pages.some((p) => p.hasOpenGraph);
  const anyTw = pages.some((p) => p.hasTwitterCard);

  let metaScore = 0;
  if (anyTitle) metaScore += 10;
  else parts.meta.notes.push("Missing <title> on sampled pages.");

  if (anyMetaDesc) metaScore += 10;
  else parts.meta.notes.push("Missing meta description on sampled pages.");

  if (anyOg) metaScore += 3;
  else parts.meta.notes.push("No Open Graph meta tags detected.");

  if (anyTw) metaScore += 2;
  else parts.meta.notes.push("No Twitter Card meta tags detected.");

  parts.meta.score = Math.min(parts.meta.max, metaScore);

  // STRUCTURED DATA
  const anyJsonLd = pages.some((p) => p.hasJsonLd);
  const anyMicrodata = pages.some((p) => p.hasSchemaOrgMicrodata);

  let sdScore = 0;
  if (anyJsonLd) sdScore += 15;
  else parts.structuredData.notes.push("No JSON-LD (application/ld+json) detected.");

  if (anyMicrodata) sdScore += 10;
  else parts.structuredData.notes.push("No schema.org microdata/itemscope detected.");

  parts.structuredData.score = Math.min(parts.structuredData.max, sdScore);

  // HEADINGS
  const anyH1 = pages.some((p) => p.headings.h1.length > 0);
  const anyH2 = pages.some((p) => p.headings.h2.length > 0);

  let headingScore = 0;
  if (anyH1) headingScore += 8;
  else parts.headings.notes.push("No H1 detected on sampled pages.");

  if (anyH2) headingScore += 7;
  else parts.headings.notes.push("No H2 headings detected (weak content structure).");

  parts.headings.score = Math.min(parts.headings.max, headingScore);

  // CONTACT
  const emails = Array.from(new Set(pages.flatMap((p) => p.foundEmails)));
  const phones = Array.from(new Set(pages.flatMap((p) => p.foundPhones)));
  const hasContactPage = pages.some((p) => /kapcsolat|contact|impressum|about/i.test(p.url));

  let contactScore = 0;
  if (emails.length > 0) contactScore += 7;
  else parts.contact.notes.push("No email detected on sampled pages.");

  if (phones.length > 0) contactScore += 6;
  else parts.contact.notes.push("No phone number detected on sampled pages.");

  if (hasContactPage) contactScore += 2;
  else parts.contact.notes.push("No obvious contact/about page found in sampled URLs.");

  parts.contact.score = Math.min(parts.contact.max, contactScore);

  // GEO
  const addressLike = Array.from(new Set(pages.flatMap((p) => p.foundAddressesLike))).filter(Boolean);
  const cityLike = Array.from(new Set(pages.flatMap((p) => p.foundCityOrRegionLike))).filter(Boolean);

  let geoScore = 0;
  if (addressLike.length > 0) geoScore += 6;
  else parts.geo.notes.push("No address-like text detected (street/number/county).");

  if (cityLike.length > 0) geoScore += 4;
  else parts.geo.notes.push("No city/region hints detected in text.");

  parts.geo.score = Math.min(parts.geo.max, geoScore);

  // TEXT VOLUME
  const totalText = pages.reduce((acc, p) => acc + (p.rawTextLength || 0), 0);
  const avgText = pages.length ? Math.round(totalText / pages.length) : 0;

  let tvScore = 0;
  if (avgText >= 2500) tvScore = 10;
  else if (avgText >= 1500) tvScore = 7;
  else if (avgText >= 800) tvScore = 4;
  else {
    tvScore = 1;
    parts.textVolume.notes.push("Very low on-page text volume; add clearer service descriptions & sections.");
  }
  parts.textVolume.score = Math.min(parts.textVolume.max, tvScore);

  return parts;
}

function parseCompetitors(input: unknown): string[] {
  // allow:
  // - competitors: string[]
  // - competitors: "a.com\nb.com"
  // - competitorUrls / competitorSites / competitorList
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  }
  const s = String(input ?? "").trim();
  if (!s) return [];
  return s
    .split(/\r?\n|,|;/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    // Accept multiple names so your UI won't break if it's different
    const mainUrl =
      body.mainUrl ?? body.mainSite ?? body.site ?? body.url ?? body.domain ?? "";

    const competitorsRaw =
      body.competitors ??
      body.competitorUrls ??
      body.competitorSites ??
      body.competitorList ??
      body.competitorsText ??
      "";

    const competitors = parseCompetitors(competitorsRaw);

    if (!String(mainUrl).trim()) return badRequest("Missing 'mainUrl' (or mainSite/site/url).");
    if (competitors.length === 0) return badRequest("Missing 'competitors' (array or newline string).");

    const pagesPerSite = Math.max(1, Math.min(10, Number(body.pagesPerSite ?? body.maxPages ?? 5)));
    const timeoutMs = Math.max(1000, Math.min(15000, Number(body.timeoutMs ?? body.timeout ?? 5000)));

    const sites = [String(mainUrl).trim(), ...competitors].slice(0, 4);

    const results = [];
    for (const site of sites) {
      const seedUrl = toUrl(site);
      const domain = toHostname(seedUrl);

      const crawl = await crawlOnDomain(seedUrl, domain, pagesPerSite, timeoutMs);
      const scoreParts = buildScorePartsFromCrawl(crawl);
      const scoreSummary = sumScore(scoreParts);

      // Compact “evidence” preview for UI/debug
      const pageSnippets = crawl.pages.slice(0, 3).map((p) => ({
        url: p.url,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.headings.h1.slice(0, 2),
        textLen: p.rawTextLength,
      }));

      results.push({
        url: seedUrl,
        domain,
        ok: crawl.pageCount > 0,
        pageCount: crawl.pageCount,
        errors: crawl.errors.slice(0, 5),
        score: scoreSummary.pct,
        scoreSummary,
        scoreParts,
        pageSnippets,
      });
    }

    const main = results[0];
    const competitorsOut = results.slice(1);

    const ranking = [...results]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((r) => ({ url: r.url, score: r.score }));

    // Delta vs main
    const deltas = competitorsOut.map((c) => ({
      competitor: c.url,
      deltaScore: (c.score ?? 0) - (main?.score ?? 0),
      breakdown: SCORE_KEYS.map((k) => ({
        key: k,
        delta: (c.scoreParts?.[k]?.score ?? 0) - (main?.scoreParts?.[k]?.score ?? 0),
      })),
    }));

    return NextResponse.json(
      {
        mainUrl: toUrl(String(mainUrl).trim()),
        competitors,
        settings: { pagesPerSite, timeoutMs },
        results,
        ranking,
        deltas,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Compare error:", e);
    return NextResponse.json(
      { error: "Compare failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}