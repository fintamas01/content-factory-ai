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
  return (s ?? "").replace(/\s+/g, " ").trim();
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
      if (socialHosts.some((sh) => h === sh || h.endsWith(`.${sh}`))) socials.push(abs);
    } catch {
      // ignore
    }
  });

  return Array.from(new Set(socials)).slice(0, 12);
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
      return { ok: false as const, status: res.status, url, html: "", error: `Fetch failed: ${res.status}` };
    }

    const html = await res.text();
    return { ok: true as const, status: 200, url, html, error: null as string | null };
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
      /utca|strada|street|nr\.|no\.|bl\.|ap\.|jud|county|romania|magyarország|ország/i.test(s)
    )
    .slice(0, 6);

  const cityRegionLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) =>
      /sepsi|târgu|maros|kolozsvár|cluj|bucharest|budapest|szatmár|românia|romania/i.test(s)
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
    parts.textVolume.notes.push("Very low on-page text volume; add clearer service descriptions & sections.");
  }
  parts.textVolume.score = tvScore;

  return parts;
}

function buildEvidence(crawl: CrawlContext) {
  return crawl.pages.slice(0, 6).map((p) => ({
    url: p.url,
    quote: truncate(p.extractedText.replace(/^BODY_TEXT:\s*/i, ""), 500),
  }));
}

async function buildActionPlanLLM(args: {
  url: string;
  scoreBefore: number;
  scoreParts: ScoreParts;
  evidence: Array<{ url: string; quote: string }>;
}) {
  const system = `
You output STRICT JSON only. No markdown.
Do NOT invent company facts. Only use evidence quotes.
Return JSON keys:
- estimatedScoreAfter
- tasks (at least 8)
- schemaSnippets
- copyBlocks
Tasks must include: JSON-LD, contact/footer, headings, social links, service content structure.
Each task: {id,priority,title,impact,effort,steps[],acceptanceCriteria[],filesToChange[],codeSnippets[]}
schemaSnippets items must have jsonLd as an object (not a string).
`.trim();

  const user = {
    url: args.url,
    scoreBefore: args.scoreBefore,
    scoreParts: args.scoreParts,
    evidence: args.evidence,
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

    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return badRequest("Missing 'url'.");

    const maxPages = typeof body.maxPages === "number" ? body.maxPages : 7;
    const timeoutMsPerPage = typeof body.timeoutMsPerPage === "number" ? body.timeoutMsPerPage : 7000;

    const clampedPages = Math.max(1, Math.min(10, maxPages));
    const clampedTimeout = Math.max(1500, Math.min(15000, timeoutMsPerPage));

    const seed = toUrl(url);
    const domain = toHostname(seed);

    const { crawl, errors } = await crawlOnDomain({
      seedUrl: seed,
      targetDomain: domain,
      maxPages: clampedPages,
      timeoutMsPerPage: clampedTimeout,
    });

    const ok = crawl.pageCount > 0;
    const scoreParts = ok ? buildScorePartsFromCrawl(crawl) : normalizeScoreParts();
    const scoreSummary = sumScore(scoreParts);
    const evidence = ok ? buildEvidence(crawl) : [];

    // No token? Return deterministic output with diagnostics (UI won't crash)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          url: seed,
          scoreBefore: scoreSummary.pct,
          estimatedScoreAfter: scoreSummary.pct,
          scoreParts,
          tasks: [],
          schemaSnippets: [],
          copyBlocks: [],
          diagnostics: {
            hasOpenAIKey: false,
            hasTavilyKey: Boolean(process.env.TAVILY_API_KEY),
            pagesCrawled: crawl.pageCount,
            crawlErrors: errors.slice(0, 10),
          },
          error: "Missing OPENAI_API_KEY (server env).",
        },
        { status: 200 }
      );
    }

    const llm = await buildActionPlanLLM({
      url: seed,
      scoreBefore: scoreSummary.pct,
      scoreParts,
      evidence,
    });

    return NextResponse.json(
      {
        url: seed,
        scoreBefore: scoreSummary.pct,
        estimatedScoreAfter:
          typeof llm?.estimatedScoreAfter === "number" ? llm.estimatedScoreAfter : scoreSummary.pct,
        scoreParts,
        tasks: Array.isArray(llm?.tasks) ? llm.tasks : [],
        schemaSnippets: Array.isArray(llm?.schemaSnippets) ? llm.schemaSnippets : [],
        copyBlocks: Array.isArray(llm?.copyBlocks) ? llm.copyBlocks : [],
        diagnostics: {
          hasOpenAIKey: true,
          hasTavilyKey: Boolean(process.env.TAVILY_API_KEY),
          pagesCrawled: crawl.pageCount,
          crawlErrors: errors.slice(0, 10),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Action plan error:", e);
    return NextResponse.json(
      { error: "Action plan failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}