import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";

type Platform = "web" | "instagram" | "tiktok" | "linkedin";
type AgentGoal = "geo_audit" | "content_plan" | "brand_voice";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return inputUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
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

type HtmlSignals = {
  ok: boolean;
  status: number;
  url: string;
  title: string | null;
  metaDescription: string | null;
  extractedText: string;

  // Signals
  canonical: string | null;
  hreflangs: string[];
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;

  wordCount: number;
  textLength: number;

  hasEmail: boolean;
  hasPhone: boolean;
  hasAddressHints: boolean;
  hasGeoHints: boolean;
};

type ScoreBreakdown = {
  total: number; // 0-100
  parts: Record<
    | "structuredData"
    | "meta"
    | "headings"
    | "contact"
    | "geo"
    | "social"
    | "textVolume",
    { score: number; max: number; notes: string[] }
  >;
};

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
    }: {
      goal: AgentGoal;
      url?: string;
      platform?: Platform;
      brandName?: string;
      notes?: string;
    } = body;

    if (!goal) return badRequest("Missing 'goal'.");
    if (goal === "geo_audit" && !url) return badRequest("Missing 'url' for geo_audit.");

    const targetDomain = url ? toHostname(url) : "";

    // 1) Rövid keresőkifejezés generálás (geo_auditnál)
    const searchQuery =
      goal === "geo_audit"
        ? await generateSearchQuery({ url: url!, brandName, platform })
        : null;

    // 2a) On-domain HTML context (direct fetch) – GEO-nál ez a legmegbízhatóbb
    let onDomainHtml: HtmlSignals | null = null;

    if (goal === "geo_audit" && url) {
        const pages = await crawlSite(url, 5); // 1 homepage + 4 internal
        if (pages.length > 0) {
            onDomainHtml = combineHtmlSignals(pages);
        }
    }

    // 2b) Web context (Tavily) – geo_auditnál: találatok, answer NINCS
    const webContext: WebContext | null =
      goal === "geo_audit"
        ? await fetchWebContextTavily({
            query: searchQuery ?? targetDomain,
            targetDomain,
          })
        : null;

    // ✅ 2c) Determinisztikus GEO score (nem LLM)
    const scoreBreakdown: ScoreBreakdown | null =
      goal === "geo_audit" && onDomainHtml
        ? computeGeoScore(onDomainHtml)
        : null;

    // 3) Elemzés + teendők JSON-ban (domain-lock + evidence)
    const result = await runAgentAnalysis({
      goal,
      url,
      platform,
      brandName,
      notes,
      targetDomain,
      webContext,
      onDomainHtml,
      scoreBreakdown,
    });

    return NextResponse.json(
      {
        goal,
        url: url ?? null,
        platform,
        brandName: brandName ?? null,
        searchQuery,
        webContextUsed: Boolean(webContext),
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

async function fetchWebContextTavily(args: {
  query: string;
  targetDomain: string;
}): Promise<WebContext> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Missing TAVILY_API_KEY in environment.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: args.query,
      search_depth: "basic",
      include_answer: false, // ✅ IMPORTANT
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
    const url = (r.url ?? "").trim();
    if (!url) continue;

    const title = (r.title ?? "").trim() || "Untitled";
    const text = (r.content ?? r.snippet ?? r.title ?? "").trim();

    if (isSameDomain(url, args.targetDomain)) {
      onDomain.push({ url, title, text });
    } else {
      offDomain.push({ url, title, text });
    }
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
  onDomainHtml?: HtmlSignals | null;
  scoreBreakdown?: ScoreBreakdown | null;
}) {
  const system = `
You are an AI Agent that outputs STRICT JSON.
No markdown. No extra text. Only JSON.

CRITICAL ACCURACY RULES:
- Do NOT invent facts (numbers, dates, installs, awards, company size, etc).
- Prefer OnDomainHtmlContext as PRIMARY source for on-domain facts.
- You may ONLY state factual claims about the website/company if they are supported by EVIDENCE from:
  (1) OnDomainHtmlContext.extractedText (direct fetch), OR
  (2) provided webContext.onDomain items.
- You may use webContext.offDomain only for "external mentions / reputation" and those claims must also include EVIDENCE.
- If you are unsure, write "unknown" or omit the claim.
- For geo_audit findings, include evidence[] where possible: [{ url, quote }].
`.trim();

  const goalSpec =
    args.goal === "geo_audit"
      ? `
Goal: GEO Audit (AI discoverability audit).

Return JSON with keys:
- summary: 2-4 sentences (NO unverified facts)
- score: number 0-100 (MUST equal the provided deterministicScore below)
- findings: array of { area, issue, impact, fix, evidence?: [{url, quote}] }
- missingInfo: array of strings
- quickWins: array of { title, steps[] }
- copySuggestions: array of { section, exampleText }
- scoreBreakdown: include the provided scoreBreakdown unchanged
- signals: include the provided OnDomainHtmlContext signals summary

IMPORTANT:
- The score is deterministic and already computed. DO NOT change it.
`
      : args.goal === "content_plan"
      ? `
Goal: Content Plan.

Return JSON with keys:
- summary
- contentPillars: array
- 14dayPlan: array of { day, platform, hook, outline[] }
- reusableTemplates: array
`
      : `
Goal: Brand Voice.

Return JSON with keys:
- tone
- do: array
- dont: array
- exampleCaptions: array of { platform, caption }
`;

  const deterministicScore = args.scoreBreakdown?.total ?? null;

  const user = `
Input:
goal=${args.goal}
url=${args.url ?? ""}
targetDomain=${args.targetDomain}
platform=${args.platform}
brandName=${args.brandName ?? ""}
notes=${args.notes ?? ""}

deterministicScore: ${deterministicScore}

scoreBreakdown (deterministic):
${args.scoreBreakdown ? JSON.stringify(args.scoreBreakdown, null, 2) : "null"}

OnDomainHtmlContext (direct fetch):
${args.onDomainHtml ? JSON.stringify(args.onDomainHtml, null, 2) : "null"}

webContext (structured):
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

    // ✅ Safety: enforce deterministic score if present
    if (args.goal === "geo_audit" && args.scoreBreakdown) {
      parsed.score = args.scoreBreakdown.total;
      parsed.scoreBreakdown = args.scoreBreakdown;
      // keep a smaller signals object too
      if (args.onDomainHtml) {
        parsed.signals = {
          canonical: args.onDomainHtml.canonical,
          hreflangs: args.onDomainHtml.hreflangs,
          hasJsonLd: args.onDomainHtml.hasJsonLd,
          jsonLdTypes: args.onDomainHtml.jsonLdTypes,
          hasOpenGraph: args.onDomainHtml.hasOpenGraph,
          hasTwitterCard: args.onDomainHtml.hasTwitterCard,
          wordCount: args.onDomainHtml.wordCount,
          hasEmail: args.onDomainHtml.hasEmail,
          hasPhone: args.onDomainHtml.hasPhone,
          hasAddressHints: args.onDomainHtml.hasAddressHints,
          hasGeoHints: args.onDomainHtml.hasGeoHints,
        };
      }
    }

    return parsed;
  } catch {
    return { raw };
  }
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 4000) {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function extractJsonLdTypesFromHtml($: cheerio.CheerioAPI) {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt) return;
    try {
      const data = JSON.parse(txt);
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        if (!item) continue;
        const t = (item["@type"] ?? item.type) as any;
        if (Array.isArray(t)) t.forEach((x) => x && types.push(String(x)));
        else if (t) types.push(String(t));
        // Graph case
        if (item["@graph"] && Array.isArray(item["@graph"])) {
          for (const g of item["@graph"]) {
            const gt = (g?.["@type"] ?? g?.type) as any;
            if (Array.isArray(gt)) gt.forEach((x) => x && types.push(String(x)));
            else if (gt) types.push(String(gt));
          }
        }
      }
    } catch {
      // ignore invalid json-ld blocks
    }
  });
  return Array.from(new Set(types.map((x) => x.trim()).filter(Boolean)));
}

function detectEmail(text: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

function detectPhone(text: string) {
  // laza, nem tökéletes: +40 / 07xx / (0xx) + számcsoportok
  return /(\+\d{1,3}\s?)?(\(?0?\d{2,4}\)?[\s.-]?)\d{3}[\s.-]?\d{3,4}/.test(text);
}

function detectAddressHints(text: string) {
  const t = text.toLowerCase();
  const hints = ["utca", "strada", "street", "boulevard", "blvd", "nr.", "no.", "zip", "iranyitoszam", "cod poștal", "post code", "udvarter"];
  return hints.some((h) => t.includes(h));
}

function detectGeoHints(text: string) {
  const t = text.toLowerCase();
  // ország + tipikus “város/megye” jelleg
  const hints = ["romania", "românia", "szatmár", "satu mare", "sepsi", "sepsiszentgyörgy", "târgu mureș", "marosvásárhely", "cluj", "kolozsvár", "budapest", "hungary", "magyarország", "europe", "eu"];
  return hints.some((h) => t.includes(h));
}

async function fetchOnDomainHtmlContext(url: string): Promise<HtmlSignals> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ContentFactoryBot/1.0; +https://futuretechapps.ro)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      url,
      title: null,
      metaDescription: null,
      extractedText: "",
      canonical: null,
      hreflangs: [],
      hasJsonLd: false,
      jsonLdTypes: [],
      hasOpenGraph: false,
      hasTwitterCard: false,
      wordCount: 0,
      textLength: 0,
      hasEmail: false,
      hasPhone: false,
      hasAddressHints: false,
      hasGeoHints: false,
    };
  }

  const html = await res.text();
  const $raw = cheerio.load(html);

  const canonical = normalizeWhitespace($raw('link[rel="canonical"]').attr("href") || "") || null;

  const hreflangs = $raw('link[rel="alternate"][hreflang]')
    .map((_, el) => String($raw(el).attr("hreflang") || "").trim())
    .get()
    .filter(Boolean);

  const jsonLdTypes = extractJsonLdTypesFromHtml($raw);
  const hasJsonLd = $raw('script[type="application/ld+json"]').length > 0;

  const hasOpenGraph =
    $raw('meta[property="og:title"]').length > 0 ||
    $raw('meta[property="og:description"]').length > 0 ||
    $raw('meta[property="og:image"]').length > 0;

  const hasTwitterCard = $raw('meta[name="twitter:card"]').length > 0;

  // Now parse cleaned text for content signals
  const $ = cheerio.load(html);
  $("script,noscript,style,svg").remove();

  const title = normalizeWhitespace($("title").first().text() || "");
  const metaDescription = normalizeWhitespace(
    $('meta[name="description"]').attr("content") || ""
  );

  const h1 = normalizeWhitespace($("h1").first().text() || "");
  const h2s = $("h2")
    .slice(0, 6)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const mainCandidates = ["main", "#content", ".site-content", ".entry-content", ".elementor", "body"];

  let bodyText = "";
  for (const sel of mainCandidates) {
    const t = normalizeWhitespace($(sel).text());
    if (t && t.length > bodyText.length) bodyText = t;
  }

  const combinedText = [title, metaDescription, h1, h2s.join(" "), bodyText].filter(Boolean).join(" ");
  const words = combinedText
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = words.length;
  const textLength = combinedText.length;

  const hasEmail = detectEmail(combinedText);
  const hasPhone = detectPhone(combinedText);
  const hasAddressHints = detectAddressHints(combinedText);
  const hasGeoHints = detectGeoHints(combinedText);

  const extractedText = truncate(
    [
      title ? `TITLE: ${title}` : "",
      metaDescription ? `META_DESCRIPTION: ${metaDescription}` : "",
      h1 ? `H1: ${h1}` : "",
      h2s.length ? `H2: ${h2s.join(" | ")}` : "",
      bodyText ? `BODY_TEXT: ${bodyText}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    5000
  );

  return {
    ok: true,
    status: 200,
    url,
    title: title || null,
    metaDescription: metaDescription || null,
    extractedText,
    canonical,
    hreflangs,
    hasJsonLd,
    jsonLdTypes,
    hasOpenGraph,
    hasTwitterCard,
    wordCount,
    textLength,
    hasEmail,
    hasPhone,
    hasAddressHints,
    hasGeoHints,
  };
}

function computeGeoScore(sig: HtmlSignals): ScoreBreakdown {
  const parts: ScoreBreakdown["parts"] = {
    structuredData: { score: 0, max: 20, notes: [] },
    meta: { score: 0, max: 15, notes: [] },
    headings: { score: 0, max: 10, notes: [] },
    contact: { score: 0, max: 15, notes: [] },
    geo: { score: 0, max: 15, notes: [] },
    social: { score: 0, max: 10, notes: [] },
    textVolume: { score: 0, max: 15, notes: [] },
  };

  // 1) Structured data (20)
  if (sig.hasJsonLd) {
    parts.structuredData.score += 12;
    parts.structuredData.notes.push("JSON-LD detected.");
    if (sig.jsonLdTypes.length > 0) {
      parts.structuredData.score += 8;
      parts.structuredData.notes.push(`Types: ${sig.jsonLdTypes.slice(0, 6).join(", ")}`);
    } else {
      parts.structuredData.notes.push("JSON-LD present but types not detected.");
    }
  } else {
    parts.structuredData.notes.push("No JSON-LD schema found.");
  }

  // 2) Meta (15)
  const hasTitle = Boolean(sig.title && sig.title.trim().length >= 10);
  const hasDesc = Boolean(sig.metaDescription && sig.metaDescription.trim().length >= 50);
  if (hasTitle) parts.meta.score += 7;
  else parts.meta.notes.push("Title missing/too short.");
  if (hasDesc) parts.meta.score += 8;
  else parts.meta.notes.push("Meta description missing/too short.");

  // 3) Headings (10) — ebből itt csak a kinyert textből következtetünk (H1/H2 jelenlét a kimenetben van)
  // Mivel a sig.extractedText tartalmazza a H1/H2-t, egyszerűen nézzük meg a marker-eket:
  const hasH1 = /(^|\n)H1:\s*\S+/m.test(sig.extractedText);
  const hasH2 = /(^|\n)H2:\s*\S+/m.test(sig.extractedText);
  if (hasH1) parts.headings.score += 6;
  else parts.headings.notes.push("No H1 detected.");
  if (hasH2) parts.headings.score += 4;
  else parts.headings.notes.push("No H2 detected (or too little structure).");

  // 4) Contact (15)
  if (sig.hasEmail) parts.contact.score += 6;
  else parts.contact.notes.push("No email detected.");
  if (sig.hasPhone) parts.contact.score += 6;
  else parts.contact.notes.push("No phone detected.");
  if (sig.hasAddressHints) parts.contact.score += 3;
  else parts.contact.notes.push("No address hints detected.");

  // 5) Geo (15)
  // geoHints = ország/város/regió említések; addressHints = utcás/cím jelleg
  if (sig.hasGeoHints) parts.geo.score += 8;
  else parts.geo.notes.push("No clear geo/location hints detected.");
  if (sig.hasAddressHints) parts.geo.score += 7;
  else parts.geo.notes.push("No structured address-like text detected.");

  // 6) Social previews (10)
  if (sig.hasOpenGraph) parts.social.score += 6;
  else parts.social.notes.push("OpenGraph tags missing.");
  if (sig.hasTwitterCard) parts.social.score += 4;
  else parts.social.notes.push("Twitter card missing.");

  // 7) Text volume (15)
  // egyszerű küszöbök
  if (sig.wordCount >= 600) {
    parts.textVolume.score += 15;
    parts.textVolume.notes.push(`Good text volume (${sig.wordCount} words).`);
  } else if (sig.wordCount >= 300) {
    parts.textVolume.score += 10;
    parts.textVolume.notes.push(`Medium text volume (${sig.wordCount} words).`);
  } else if (sig.wordCount >= 120) {
    parts.textVolume.score += 6;
    parts.textVolume.notes.push(`Low text volume (${sig.wordCount} words).`);
  } else {
    parts.textVolume.score += 2;
    parts.textVolume.notes.push(`Very low text volume (${sig.wordCount} words).`);
  }

  const total =
    parts.structuredData.score +
    parts.meta.score +
    parts.headings.score +
    parts.contact.score +
    parts.geo.score +
    parts.social.score +
    parts.textVolume.score;

  return { total: Math.max(0, Math.min(100, total)), parts };
}

async function crawlSite(startUrl: string, maxPages = 5): Promise<HtmlSignals[]> {
    const visited = new Set<string>();
    const queue: string[] = [startUrl];
    const results: HtmlSignals[] = [];
    const domain = toHostname(startUrl);
  
    while (queue.length > 0 && results.length < maxPages) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
  
      try {
        const page = await fetchOnDomainHtmlContext(current);
        if (page.ok) {
          results.push(page);
  
          // extract internal links from HTML
          const html = await fetch(current).then(r => r.text()).catch(() => null);
          if (!html) continue;
  
          const $ = cheerio.load(html);
          $("a[href]").each((_, el) => {
            const href = ($(el).attr("href") || "").trim();
            if (!href) return;
  
            let full: string | null = null;
  
            if (href.startsWith("http")) full = href;
            else if (href.startsWith("/")) full = new URL(href, startUrl).toString();
  
            if (!full) return;
  
            if (isSameDomain(full, domain) && !visited.has(full)) {
              queue.push(full.split("#")[0]);
            }
          });
        }
      } catch {
        continue;
      }
    }
  
    return results;
  }

  function combineHtmlSignals(pages: HtmlSignals[]): HtmlSignals {
    const base = pages[0];
  
    const combinedText = pages.map(p => p.extractedText).join("\n");
  
    const combinedWords = combinedText
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  
    return {
      ...base,
      extractedText: combinedText,
      wordCount: combinedWords.length,
      textLength: combinedText.length,
      hasJsonLd: pages.some(p => p.hasJsonLd),
      jsonLdTypes: Array.from(new Set(pages.flatMap(p => p.jsonLdTypes))),
      hasOpenGraph: pages.some(p => p.hasOpenGraph),
      hasTwitterCard: pages.some(p => p.hasTwitterCard),
      hasEmail: pages.some(p => p.hasEmail),
      hasPhone: pages.some(p => p.hasPhone),
      hasAddressHints: pages.some(p => p.hasAddressHints),
      hasGeoHints: pages.some(p => p.hasGeoHints),
    };
  }