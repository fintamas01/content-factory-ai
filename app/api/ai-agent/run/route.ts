// app/api/ai-agent/run/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";

type Platform = "web" | "instagram" | "tiktok" | "linkedin";
type AgentGoal = "geo_audit" | "content_plan" | "brand_voice";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toUrl(input: string) {
  const s = input.trim();
  if (!s) throw new Error("Empty url");
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(toUrl(inputUrl));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return inputUrl
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
  const t = s.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  score?: number;
};

type WebContext = {
  query: string;
  targetDomain: string;
  onDomain: Array<{ url: string; title: string; text: string }>;
  offDomain: Array<{ url: string; title: string; text: string }>;
};

type OnDomainPage = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  hasJsonLd: boolean;
  hasSchemaOrgMicrodata: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  extractedText: string; // compact combined text
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

type ScorePart = {
  score: number;
  max: number;
  notes: string[];
};

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

function extractEmails(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((m ?? []).map((x) => x.toLowerCase()))).slice(0, 10);
}

function extractPhones(text: string) {
  // best-effort: EU-ish + digits with separators
  const m = text.match(/(\+\d{1,3}\s?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g);
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

function pickInternalLinks($: cheerio.CheerioAPI, baseUrl: string, targetDomain: string) {
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;

    // skip anchors, mailto, tel, etc.
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

    // skip obvious assets
    if (/\.(jpg|jpeg|png|webp|svg|pdf|zip|rar|mp4|mp3)$/i.test(abs)) return;

    // normalize trailing slash for dedupe
    abs = abs.replace(/\/$/, "");
    links.push(abs);
  });

  return Array.from(new Set(links));
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ContentFactoryBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
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
  return { ok: true as const, status: 200, url, html, error: null as string | null };
}

function parseOnDomainPage(url: string, html: string): OnDomainPage {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("title").first().text() || "") || null;

  const metaDescription =
    normalizeWhitespace($('meta[name="description"]').attr("content") || "") || null;

  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;

  // Structured data signals
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasSchemaOrgMicrodata =
    $('[itemscope]').length > 0 || /https?:\/\/schema\.org/i.test(html);

  // Headings
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

  // Remove noise
  $("script,noscript,style,svg").remove();

  // Try main content containers commonly used in WP
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

  // Very light heuristics for address/city/region presence (best-effort, language-agnostic)
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

async function crawlOnDomain(seedUrl: string, targetDomain: string, maxPages: number): Promise<CrawlContext> {
  const seed = toUrl(seedUrl);
  const seen = new Set<string>();
  const queue: string[] = [seed.replace(/\/$/, "")];
  const pages: OnDomainPage[] = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const fetched = await fetchHtml(url);
    if (!fetched.ok) continue;

    const page = parseOnDomainPage(url, fetched.html);
    pages.push(page);

    // discover a few more internal links from this page
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

  return {
    targetDomain,
    seedUrl: seed,
    pages,
    pageCount: pages.length,
  };
}

function buildScorePartsFromCrawl(crawl: CrawlContext): ScoreParts {
  // We score based on presence across crawled pages (not just homepage)
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

  // Contact page hint: URL contains keywords
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

function buildEvidenceFromCrawl(crawl: CrawlContext) {
  // Provide short quotes from on-domain extracted text so the model can cite evidence
  return crawl.pages.slice(0, 6).map((p) => ({
    url: p.url,
    quote: truncate(p.extractedText.replace(/^BODY_TEXT:\s*/i, ""), 500),
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const {
      goal,
      url,
      platform = "web",
      brandName,
      notes,
      // optional knobs (safe defaults)
      crawl = true,
      maxPages = 5,
    }: {
      goal: AgentGoal;
      url?: string;
      platform?: Platform;
      brandName?: string;
      notes?: string;
      crawl?: boolean;
      maxPages?: number;
    } = body;

    if (!goal) return badRequest("Missing 'goal'.");
    if (goal === "geo_audit" && !url) return badRequest("Missing 'url' for geo_audit.");

    const targetDomain = url ? toHostname(url) : "";

    // 1) Search query (geo_audit only)
    const searchQuery =
      goal === "geo_audit" ? await generateSearchQuery({ url: url!, brandName, platform }) : null;

    // 2) Web context (Tavily) – structured (no "answer")
    const webContext: WebContext | null =
      goal === "geo_audit"
        ? await fetchWebContextTavily({
            query: searchQuery ?? targetDomain,
            targetDomain,
          })
        : null;

    // 3) On-domain crawl context (this is what makes it “profibb” / stabilabb)
    const crawlContext: CrawlContext | null =
      goal === "geo_audit" && crawl
        ? await crawlOnDomain(toUrl(url!), targetDomain, Math.max(1, Math.min(10, maxPages ?? 5)))
        : null;

    // 4) Local scoring (deterministic) from on-domain crawl
    const scoreParts =
      goal === "geo_audit" && crawlContext ? buildScorePartsFromCrawl(crawlContext) : normalizeScoreParts();

    const scoreSummary = sumScore(scoreParts);

    // 5) LLM analysis (domain-locked + evidence)
    const result = await runAgentAnalysis({
      goal,
      url,
      platform,
      brandName,
      notes,
      targetDomain,
      webContext,
      crawlContext,
      scoreParts,
      scoreSummary,
    });

    return NextResponse.json(
      {
        goal,
        url: url ?? null,
        platform,
        brandName: brandName ?? null,
        searchQuery,
        webContextUsed: Boolean(webContext),
        crawlUsed: Boolean(crawlContext),
        result,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("AI Agent error:", e);
    return NextResponse.json(
      { error: "AI Agent failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

async function generateSearchQuery(args: { url: string; brandName?: string; platform: Platform }) {
  const domain = toHostname(args.url);
  const prompt = `
Create a short (3-7 words) ENGLISH search query to assess AI/SEO discoverability for a website.
Website domain: ${domain}
Brand: ${args.brandName ?? "unknown"}
Return ONLY the query. No quotes. No punctuation.
`.trim();

  const r = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return (r.choices[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
}

async function fetchWebContextTavily(args: { query: string; targetDomain: string }): Promise<WebContext> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Missing TAVILY_API_KEY in environment.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: args.query,
      search_depth: "basic",
      include_answer: false, // ✅ avoid Tavily "answer" hallucinations
      max_results: 8,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Tavily request failed: ${res.status} ${t}`);
  }

  const data = await res.json().catch(() => null);
  const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

  const onDomain: Array<{ url: string; title: string; text: string }> = [];
  const offDomain: Array<{ url: string; title: string; text: string }> = [];

  for (const r of results) {
    const u = (r.url ?? "").trim();
    if (!u) continue;

    const title = (r.title ?? "").trim() || "Untitled";
    const text = (r.content ?? r.snippet ?? r.title ?? "").trim();

    if (isSameDomain(u, args.targetDomain)) onDomain.push({ url: u, title, text });
    else offDomain.push({ url: u, title, text });
  }

  return {
    query: args.query,
    targetDomain: args.targetDomain,
    onDomain: onDomain.slice(0, 6),
    offDomain: offDomain.slice(0, 3),
  };
}

async function runAgentAnalysis(args: {
  goal: AgentGoal;
  url?: string;
  platform: Platform;
  brandName?: string;
  notes?: string;
  targetDomain: string;
  webContext?: WebContext | null;
  crawlContext?: CrawlContext | null;
  scoreParts: ScoreParts;
  scoreSummary: { total: number; max: number; pct: number };
}) {
  const system = `
You are an AI Agent that outputs STRICT JSON.
No markdown. No extra text. Only JSON.

CRITICAL ACCURACY RULES:
- Do NOT invent facts (numbers, dates, installs, awards, company size, etc).
- You may ONLY state factual claims about the website/company if they are supported by EVIDENCE provided.
- Prefer ON-DOMAIN evidence from crawlContext.pages and webContext.onDomain.
- Use webContext.offDomain only for external mentions, and cite evidence too.
- If you are unsure, write "unknown" or omit the claim.
`.trim();

  const goalSpec =
    args.goal === "geo_audit"
      ? `
Goal: GEO Audit (AI discoverability audit).

Return JSON with keys:
- summary: 2-4 sentences (no unverified facts; focus on what is missing / what to improve)
- score: number 0-100 (use provided scoreSummary.pct as base; you may adjust +-5 ONLY if justified)
- scoreParts: object with keys meta, structuredData, headings, contact, geo, social, textVolume each {score,max,notes[]}
- findings: array of { area, issue, impact, fix, evidence?: [{url, quote}] }
- missingInfo: array of strings (what AI/bots can't easily find)
- quickWins: array of { title, steps[] }
- copySuggestions: array of { section, exampleText }

EVIDENCE REQUIREMENTS:
- For any concrete claim, attach evidence in the relevant finding (url + short quote).
- If no evidence exists, do not claim it.
`.trim()
      : args.goal === "content_plan"
      ? `
Goal: Content Plan.

Return JSON with keys:
- summary
- contentPillars: array
- 14dayPlan: array of { day, platform, hook, outline[] }
- reusableTemplates: array

Avoid inventing company facts. If brand specifics are unknown, keep it generic but useful.
`.trim()
      : `
Goal: Brand Voice.

Return JSON with keys:
- tone
- do: array
- dont: array
- exampleCaptions: array of { platform, caption }

Avoid inventing company facts. If brand specifics are unknown, infer from notes only.
`.trim();

  const evidence = args.crawlContext ? buildEvidenceFromCrawl(args.crawlContext) : [];

  const user = `
Input:
goal=${args.goal}
url=${args.url ?? ""}
targetDomain=${args.targetDomain}
platform=${args.platform}
brandName=${args.brandName ?? ""}
notes=${args.notes ?? ""}

Scoring (deterministic, computed from on-domain crawl):
scoreSummary=${JSON.stringify(args.scoreSummary)}
scoreParts=${JSON.stringify(args.scoreParts, null, 2)}

On-domain crawl evidence (quotes):
${JSON.stringify(evidence, null, 2)}

Tavily webContext (structured):
${args.webContext ? JSON.stringify(args.webContext, null, 2) : "null"}
`.trim();

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${goalSpec}\n\n${user}` },
    ],
    temperature: 0.2,
  });

  const raw = (r.choices[0]?.message?.content ?? "").trim();

  try {
    const parsed = JSON.parse(raw);

    // Hard safety: for geo_audit always include scoreParts we computed if missing
    if (args.goal === "geo_audit") {
      if (!parsed.scoreParts) parsed.scoreParts = args.scoreParts;
      if (typeof parsed.score !== "number") parsed.score = args.scoreSummary.pct;
    }

    return parsed;
  } catch {
    // If the model fails JSON, return raw + our deterministic score so UI still works
    if (args.goal === "geo_audit") {
      return {
        raw,
        score: args.scoreSummary.pct,
        scoreParts: args.scoreParts,
      };
    }
    return { raw };
  }
}