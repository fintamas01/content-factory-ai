// app/api/ai-agent/compare/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toUrl(input: string) {
  const s = (input ?? "").trim();
  if (!s) throw new Error("Empty url");
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(toUrl(inputUrl));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return (inputUrl ?? "")
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

function truncate(s: string, max = 4000) {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function extractEmails(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((m ?? []).map((x) => x.toLowerCase()))).slice(0, 10);
}

function extractPhones(text: string) {
  const m = text.match(
    /(\+\d{1,3}\s?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g
  );
  const cleaned = (m ?? [])
    .map((x) => normalizeWhitespace(x))
    .filter((x) => x.replace(/\D/g, "").length >= 8)
    .slice(0, 12);
  return Array.from(new Set(cleaned));
}

function extractSocialLinks($: cheerio.CheerioAPI, baseUrl: string) {
  const socials: string[] = [];
  const socialHosts = [
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "linkedin.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "threads.net",
  ];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;

    let abs = href;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    try {
      const h = new URL(abs).hostname.replace(/^www\./, "");
      if (socialHosts.some((sh) => h === sh || h.endsWith(`.${sh}`))) {
        socials.push(abs);
      }
    } catch {
      // ignore
    }
  });

  return Array.from(new Set(socials)).slice(0, 12);
}

function pickInternalLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  targetDomain: string
) {
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

type OnDomainPage = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  hasJsonLd: boolean;
  hasSchemaOrgMicrodata: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  extractedText: string;
  rawTextLength: number;
  foundEmails: string[];
  foundPhones: string[];
  foundAddressesLike: string[];
  foundCityOrRegionLike: string[];
  socialLinks: string[];
};

type CrawlContext = {
  targetDomain: string;
  seedUrl: string;
  pages: OnDomainPage[];
  pageCount: number;
};

type ScorePartKey =
  | "meta"
  | "structuredData"
  | "headings"
  | "contact"
  | "geo"
  | "social"
  | "textVolume";

type ScorePart = { score: number; max: number; notes: string[] };
type ScoreParts = Record<ScorePartKey, ScorePart>;

const SCORE_KEYS: ScorePartKey[] = [
  "meta",
  "structuredData",
  "headings",
  "contact",
  "geo",
  "social",
  "textVolume",
];

function emptyPart(max = 0): ScorePart {
  return { score: 0, max, notes: [] };
}

function normalizeScoreParts(input?: Partial<ScoreParts>): ScoreParts {
  const base: ScoreParts = {
    meta: emptyPart(),
    structuredData: emptyPart(),
    headings: emptyPart(),
    contact: emptyPart(),
    geo: emptyPart(),
    social: emptyPart(),
    textVolume: emptyPart(),
  };

  if (!input) return base;
  for (const k of SCORE_KEYS) {
    const v = input[k];
    if (v) base[k] = v;
  }
  return base;
}

function sumScore(parts: ScoreParts) {
  const total = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.score ?? 0), 0);
  const max = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.max ?? 0), 0);
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return { total, max, pct };
}

async function fetchHtml(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      return {
        ok: false as const,
        status: res.status,
        url,
        html: "",
        error: `Fetch failed: ${res.status}`,
      };
    }

    const html = await res.text();
    return {
      ok: true as const,
      status: 200,
      url,
      html,
      error: null as string | null,
    };
  } catch (e: any) {
    return {
      ok: false as const,
      status: 0,
      url,
      html: "",
      error: `Fetch error: ${String(e?.message ?? e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseOnDomainPage(url: string, html: string): OnDomainPage {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("title").first().text() || "") || null;
  const metaDescription =
    normalizeWhitespace($('meta[name="description"]').attr("content") || "") ||
    null;

  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;

  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasSchemaOrgMicrodata =
    $('[itemscope]').length > 0 || /https?:\/\/schema\.org/i.test(html);

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

  const mainCandidates = [
    "main",
    "#content",
    ".site-content",
    ".entry-content",
    ".elementor",
    "body",
  ];
  let bestText = "";
  for (const sel of mainCandidates) {
    const t = normalizeWhitespace($(sel).text());
    if (t && t.length > bestText.length) bestText = t;
  }

  const extractedText = truncate(
    [
      title ? `TITLE: ${title}` : "",
      metaDescription ? `META_DESCRIPTION: ${metaDescription}` : "",
      h1.length ? `H1: ${h1.join(" | ")}` : "",
      h2.length ? `H2: ${h2.join(" | ")}` : "",
      h3.length ? `H3: ${h3.join(" | ")}` : "",
      bestText ? `BODY_TEXT: ${bestText}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    5000
  );

  const foundEmails = extractEmails(bestText);
  const foundPhones = extractPhones(bestText);

  const addressLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) =>
      /utca|strada|street|nr\.|no\.|bl\.|ap\.|jud|county|romania|magyarország|ország/i.test(
        s
      )
    )
    .slice(0, 6);

  const cityRegionLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) =>
      /sepsi|târgu|maros|kolozsvár|cluj|bucharest|budapest|szatmár|românia|romania/i.test(
        s
      )
    )
    .slice(0, 6);

  const socialLinks = extractSocialLinks($, url);

  return {
    url,
    title,
    metaDescription,
    headings: { h1, h2, h3 },
    hasJsonLd,
    hasSchemaOrgMicrodata,
    hasOpenGraph,
    hasTwitterCard,
    extractedText,
    rawTextLength: bestText.length,
    foundEmails,
    foundPhones,
    foundAddressesLike: addressLike,
    foundCityOrRegionLike: cityRegionLike,
    socialLinks,
  };
}

async function crawlOnDomain(args: {
  seedUrl: string;
  targetDomain: string;
  maxPages: number;
  timeoutMsPerPage: number;
}): Promise<{ crawl: CrawlContext; errors: Array<{ url: string; error: string }> }> {
  const seed = toUrl(args.seedUrl).replace(/\/$/, "");
  const seen = new Set<string>();
  const queue: string[] = [seed];
  const pages: OnDomainPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  while (queue.length && pages.length < args.maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const fetched = await fetchHtml(url, args.timeoutMsPerPage);
    if (!fetched.ok) {
      errors.push({ url, error: fetched.error ?? "Unknown fetch error" });
      continue;
    }

    const page = parseOnDomainPage(url, fetched.html);
    pages.push(page);

    try {
      const $ = cheerio.load(fetched.html);
      const links = pickInternalLinks($, url, args.targetDomain);
      for (const l of links.slice(0, 25)) {
        if (!seen.has(l)) queue.push(l);
      }
    } catch {
      // ignore
    }
  }

  return {
    crawl: {
      targetDomain: args.targetDomain,
      seedUrl: seed,
      pages,
      pageCount: pages.length,
    },
    errors,
  };
}

function buildScorePartsFromCrawl(crawl: CrawlContext): ScoreParts {
  const parts = normalizeScoreParts();
  parts.meta.max = 20;
  parts.structuredData.max = 20;
  parts.headings.max = 15;
  parts.contact.max = 15;
  parts.geo.max = 10;
  parts.social.max = 10;
  parts.textVolume.max = 10;

  const pages = crawl.pages;

  const anyTitle = pages.some((p) => (p.title ?? "").length > 0);
  const anyMetaDesc = pages.some((p) => (p.metaDescription ?? "").length > 0);
  const anyOg = pages.some((p) => p.hasOpenGraph);
  const anyTw = pages.some((p) => p.hasTwitterCard);

  let metaScore = 0;
  if (anyTitle) metaScore += 8;
  else parts.meta.notes.push("Missing <title> on sampled pages.");

  if (anyMetaDesc) metaScore += 8;
  else parts.meta.notes.push("Missing meta description on sampled pages.");

  if (anyOg) metaScore += 2;
  else parts.meta.notes.push("No Open Graph meta tags detected.");

  if (anyTw) metaScore += 2;
  else parts.meta.notes.push("No Twitter Card meta tags detected.");

  parts.meta.score = metaScore;

  const anyJsonLd = pages.some((p) => p.hasJsonLd);
  const anyMicrodata = pages.some((p) => p.hasSchemaOrgMicrodata);

  let sdScore = 0;
  if (anyJsonLd) sdScore += 12;
  else parts.structuredData.notes.push("No JSON-LD (application/ld+json) detected.");

  if (anyMicrodata) sdScore += 8;
  else parts.structuredData.notes.push("No schema.org microdata/itemscope detected.");

  parts.structuredData.score = sdScore;

  const anyH1 = pages.some((p) => p.headings.h1.length > 0);
  const anyH2 = pages.some((p) => p.headings.h2.length > 0);

  let headingScore = 0;
  if (anyH1) headingScore += 8;
  else parts.headings.notes.push("No H1 detected on sampled pages.");

  if (anyH2) headingScore += 7;
  else parts.headings.notes.push("No H2 headings detected (weak content structure).");

  parts.headings.score = headingScore;

  const emails = Array.from(new Set(pages.flatMap((p) => p.foundEmails)));
  const phones = Array.from(new Set(pages.flatMap((p) => p.foundPhones)));

  let contactScore = 0;
  if (emails.length > 0) contactScore += 7;
  else parts.contact.notes.push("No email detected on sampled pages.");

  if (phones.length > 0) contactScore += 6;
  else parts.contact.notes.push("No phone number detected on sampled pages.");

  const hasContactPage = pages.some((p) => /kapcsolat|contact|impressum|about/i.test(p.url));
  if (hasContactPage) contactScore += 2;
  else parts.contact.notes.push("No obvious contact/about page found in sampled URLs.");

  parts.contact.score = Math.min(parts.contact.max, contactScore);

  const addressLike = Array.from(new Set(pages.flatMap((p) => p.foundAddressesLike))).filter(Boolean);
  const cityLike = Array.from(new Set(pages.flatMap((p) => p.foundCityOrRegionLike))).filter(Boolean);

  let geoScore = 0;
  if (addressLike.length > 0) geoScore += 6;
  else parts.geo.notes.push("No address-like text detected (street/number/county).");

  if (cityLike.length > 0) geoScore += 4;
  else parts.geo.notes.push("No city/region hints detected in text.");

  parts.geo.score = geoScore;

  const socialLinks = Array.from(new Set(pages.flatMap((p) => p.socialLinks)));

  let socialScore = 0;
  if (socialLinks.length >= 1) socialScore += 6;
  else parts.social.notes.push("No social profile links detected.");

  if (socialLinks.length >= 3) socialScore += 4;
  else parts.social.notes.push("Add more official social links (FB/IG/LinkedIn) in footer/header.");

  parts.social.score = Math.min(parts.social.max, socialScore);

  const totalText = pages.reduce((acc, p) => acc + (p.rawTextLength || 0), 0);
  const avgText = pages.length ? Math.round(totalText / pages.length) : 0;

  let tvScore = 0;
  if (avgText >= 2500) tvScore = 10;
  else if (avgText >= 1500) tvScore = 7;
  else if (avgText >= 800) tvScore = 4;
  else {
    tvScore = 1;
    parts.textVolume.notes.push(
      "Very low on-page text volume; add clearer service descriptions & sections."
    );
  }
  parts.textVolume.score = tvScore;

  return parts;
}

/**
 * ✅ UI-friendly evidence sample (oldalanként pár kulcsjel + rövid snippet)
 * Ezt fogod tudni szépen lenyithatóan megjeleníteni a compare UI-ban.
 */
function buildPagesSample(crawl: CrawlContext) {
  return crawl.pages.slice(0, 6).map((p) => {
    const bodyOnly = (p.extractedText || "").split("BODY_TEXT:")[1] ?? "";
    const snippet = truncate(normalizeWhitespace(bodyOnly), 700);

    return {
      url: p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.headings.h1.slice(0, 3),
      h2: p.headings.h2.slice(0, 5),
      h3: p.headings.h3.slice(0, 5),
      flags: {
        hasJsonLd: p.hasJsonLd,
        hasSchemaOrgMicrodata: p.hasSchemaOrgMicrodata,
        hasOpenGraph: p.hasOpenGraph,
        hasTwitterCard: p.hasTwitterCard,
      },
      signals: {
        emails: p.foundEmails,
        phones: p.foundPhones,
        socialLinks: p.socialLinks.slice(0, 8),
        addressLike: p.foundAddressesLike,
        cityOrRegionLike: p.foundCityOrRegionLike,
      },
      text: {
        rawTextLength: p.rawTextLength,
        snippet,
      },
    };
  });
}

function buildEvidence(crawl: CrawlContext) {
  // LLM-nek továbbra is tömör, de "idézhető" quote
  return crawl.pages.slice(0, 6).map((p) => ({
    url: p.url,
    quote: truncate(p.extractedText.replace(/^BODY_TEXT:\s*/i, ""), 500),
  }));
}

function categoriesFromScoreParts(parts: ScoreParts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of SCORE_KEYS) out[k] = parts[k]?.score ?? 0;
  return out;
}

function deltaParts(a: ScoreParts, b: ScoreParts) {
  // delta = b - a (competitor - main)
  const out: Record<string, number> = {};
  for (const k of SCORE_KEYS) {
    out[k] = (b[k]?.score ?? 0) - (a[k]?.score ?? 0);
  }
  return out;
}

function topDeltaHighlights(delta: Record<string, number>, topN = 3) {
  const entries = Object.entries(delta).map(([k, v]) => ({ k, v }));
  const pos = [...entries].filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, topN);
  const neg = [...entries].filter((x) => x.v < 0).sort((a, b) => a.v - b.v).slice(0, topN);
  return { competitorWins: pos, mainWins: neg };
}

async function buildInsightsLLM(args: {
  main: { url: string; score: number; scoreParts: ScoreParts; evidence: any[]; pagesSample: any[] };
  competitors: Array<{ url: string; score: number; scoreParts: ScoreParts; evidence: any[]; pagesSample: any[] }>;
  deltas: Array<{ competitor: string; delta: Record<string, number> }>;
}) {
  if (!process.env.OPENAI_API_KEY) return null;

  const system = `
You output STRICT JSON only. No markdown.

CRITICAL ACCURACY:
- Do NOT invent facts (addresses, years, team size, awards, etc).
- If you mention anything concrete about a site, support it with evidence quotes/snippets that are provided.
- If you are unsure, write "unknown".

Return JSON keys:
- summary (2-4 sentences)
- topGaps (array of strings)
- quickWins (array of strings)
- positioning (1 short paragraph)
- perSiteNotes: array of { url, strengths[], weaknesses[], suggestedNextSteps[] }
`.trim();

  // Deltas highlight: segít, hogy az LLM ne "általánoskodjon"
  const deltaHighlights = args.deltas.map((d) => ({
    competitor: d.competitor,
    ...topDeltaHighlights(d.delta, 3),
  }));

  const user = {
    main: args.main,
    competitors: args.competitors,
    deltas: args.deltas,
    deltaHighlights,
  };

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    temperature: 0.2,
  });

  const raw = (r.choices[0]?.message?.content ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const mainUrl = typeof body.mainUrl === "string" ? body.mainUrl.trim() : "";
    const competitors = Array.isArray(body.competitors) ? body.competitors : [];
    const maxPages = typeof body.maxPages === "number" ? body.maxPages : 5;
    const timeoutMsPerPage =
      typeof body.timeoutMsPerPage === "number" ? body.timeoutMsPerPage : 5000;

    if (!mainUrl) return badRequest("Missing 'mainUrl'.");
    if (!Array.isArray(competitors) || competitors.length === 0)
      return badRequest("Missing 'competitors'.");

    const cleanedCompetitors = competitors
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);

    if (cleanedCompetitors.length === 0)
      return badRequest("No valid competitors provided (max 3).");

    const sites = [mainUrl, ...cleanedCompetitors];

    const siteReports: Array<{
      url: string;
      domain: string;
      ok: boolean;
      error?: string;
      score: number;
      scoreParts: ScoreParts;
      scoreSummary: { total: number; max: number; pct: number };
      pageCount: number;
      crawlErrors: Array<{ url: string; error: string }>;
      evidence: Array<{ url: string; quote: string }>;
      pagesSample: any[];
      crawlStats: {
        maxPages: number;
        timeoutMsPerPage: number;
        errorsCount: number;
      };
    }> = [];

    for (const s of sites) {
      const seed = toUrl(s);
      const domain = toHostname(seed);

      const boundedMaxPages = Math.max(1, Math.min(10, maxPages));
      const boundedTimeout = Math.max(1500, Math.min(15000, timeoutMsPerPage));

      const { crawl, errors } = await crawlOnDomain({
        seedUrl: seed,
        targetDomain: domain,
        maxPages: boundedMaxPages,
        timeoutMsPerPage: boundedTimeout,
      });

      const ok = crawl.pageCount > 0;
      const scoreParts = ok ? buildScorePartsFromCrawl(crawl) : normalizeScoreParts();
      const scoreSummary = sumScore(scoreParts);

      siteReports.push({
        url: seed,
        domain,
        ok,
        error: ok ? undefined : "No pages crawled (fetch blocked or timed out).",
        score: scoreSummary.pct,
        scoreParts,
        scoreSummary,
        pageCount: crawl.pageCount,
        crawlErrors: errors.slice(0, 10),
        evidence: ok ? buildEvidence(crawl) : [],
        pagesSample: ok ? buildPagesSample(crawl) : [],
        crawlStats: {
          maxPages: boundedMaxPages,
          timeoutMsPerPage: boundedTimeout,
          errorsCount: errors.length,
        },
      });
    }

    const main = siteReports[0];
    const competitorsReports = siteReports.slice(1);

    const ranking = [...siteReports]
      .map((r) => ({ url: r.url, totalScore: r.score }))
      .sort((a, b) => b.totalScore - a.totalScore);

    const categoryMatrix = siteReports.map((r) => ({
      url: r.url,
      categories: categoriesFromScoreParts(r.scoreParts),
    }));

    const deltas = competitorsReports.map((c) => ({
      competitor: c.url,
      delta: deltaParts(main.scoreParts, c.scoreParts),
    }));

    const insights = await buildInsightsLLM({
      main: {
        url: main.url,
        score: main.score,
        scoreParts: main.scoreParts,
        evidence: main.evidence,
        pagesSample: main.pagesSample,
      },
      competitors: competitorsReports.map((c) => ({
        url: c.url,
        score: c.score,
        scoreParts: c.scoreParts,
        evidence: c.evidence,
        pagesSample: c.pagesSample,
      })),
      deltas,
    });

    return NextResponse.json(
      {
        mainUrl: main.url,
        results: siteReports.map((r) => ({
          url: r.url,
          ok: r.ok,
          error: r.error ?? null,
          score: r.score,
          scoreParts: r.scoreParts,
          pageCount: r.pageCount,
          crawlErrors: r.crawlErrors,
          evidence: r.evidence,

          // ✅ NEW (UI-proof)
          pagesSample: r.pagesSample,
          crawlStats: r.crawlStats,
        })),
        ranking,
        categoryMatrix,
        deltas,
        insights: insights ?? null,
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