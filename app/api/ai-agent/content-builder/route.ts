// app/api/ai-agent/content-builder/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

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

function truncate(s: string, max = 5000) {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
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
  extractedText: string;
  rawTextLength: number;
};

type CrawlContext = {
  targetDomain: string;
  seedUrl: string;
  pages: OnDomainPage[];
  pageCount: number;
};

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

  const h1 = $("h1")
    .slice(0, 8)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h2 = $("h2")
    .slice(0, 12)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h3 = $("h3")
    .slice(0, 12)
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
    6000
  );

  return {
    url,
    title,
    metaDescription,
    headings: { h1, h2, h3 },
    extractedText,
    rawTextLength: bestText.length,
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

function buildEvidence(crawl: CrawlContext) {
  return crawl.pages.slice(0, 8).map((p) => ({
    url: p.url,
    quote: truncate(p.extractedText, 900),
  }));
}

type ContentBuilderRequest = {
  url: string;
  language?: string; // default: "en"
  tone?: string; // default: "modern, premium, direct"
  serviceFocus?: string[]; // default list
  companyFacts?: Record<string, any> | null; // optional
  maxPages?: number;
  timeoutMsPerPage?: number;
};

async function buildContentLLM(args: {
  url: string;
  language: string;
  tone: string;
  serviceFocus: string[];
  companyFacts: Record<string, any> | null;
  evidence: Array<{ url: string; quote: string }>;
}) {
  const system = `
You output STRICT JSON only. No markdown.
Do NOT invent facts (addresses, phone numbers, awards). If companyFacts do not include it, leave as placeholder or omit.
Use evidence quotes when making concrete claims about what exists on the site.
Language MUST be: ${args.language}

Return JSON with EXACT keys:
{
  "pages": {
    "home": {
      "sections": [
        // hero/services/process/proof/faq/cta
      ],
      "meta": { "title": "", "description": "", "ogTitle": "", "ogDescription": "" }
    },
    "services_web": { "title": "", "sections": [], "meta": {} },
    "services_ecommerce": { "title": "", "sections": [], "meta": {} },
    "services_mobile": { "title": "", "sections": [], "meta": {} },
    "services_seo": { "title": "", "sections": [], "meta": {} }
  },
  "schema": {
    "faqPageJsonLd": { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [] },
    "organizationJsonLd": null
  },
  "notes": {
    "placeholdersUsed": [],
    "assumptions": []
  }
}

Section formats:
- hero: { "id":"hero", "headline":"", "subheadline":"", "ctaPrimary":"", "ctaSecondary":"", "bullets":[] }
- services: { "id":"services", "items":[ { "title":"", "desc":"", "outcomes":[] } ] }
- process: { "id":"process", "steps":[ { "title":"", "desc":"" } ] }
- proof: { "id":"proof", "bullets":[] }
- faq: { "id":"faq", "items":[ { "q":"", "a":"" } ] }
- cta: { "id":"cta", "headline":"", "desc":"", "cta":"" }

Tone: ${args.tone}
Service focus: ${JSON.stringify(args.serviceFocus)}
`.trim();

  const user = {
    url: args.url,
    language: args.language,
    tone: args.tone,
    serviceFocus: args.serviceFocus,
    companyFacts: args.companyFacts,
    evidence: args.evidence,
  };

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    temperature: 0.3,
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
    const body = (await req.json().catch(() => null)) as ContentBuilderRequest | null;
    if (!body) return badRequest("Invalid JSON body.");

    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return badRequest("Missing 'url'.");

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, clientId } = gate;

    const language = typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "en";

    const tone = typeof body.tone === "string" && body.tone.trim()
      ? body.tone.trim()
      : "modern, premium, direct";

    const serviceFocus = Array.isArray(body.serviceFocus) && body.serviceFocus.length
      ? body.serviceFocus.map((x) => String(x)).filter(Boolean).slice(0, 8)
      : ["web development", "e-commerce", "mobile apps", "SEO"];

    const companyFacts =
      body.companyFacts && typeof body.companyFacts === "object" ? (body.companyFacts as any) : null;

    const maxPages = typeof body.maxPages === "number" ? body.maxPages : 7;
    const timeoutMsPerPage =
      typeof body.timeoutMsPerPage === "number" ? body.timeoutMsPerPage : 7000;

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

    const evidence = crawl.pageCount > 0 ? buildEvidence(crawl) : [];

    // If no OpenAI key, return deterministic skeleton + diagnostics
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          url: seed,
          language,
          tone,
          serviceFocus,
          pages: {},
          schema: { faqPageJsonLd: null, organizationJsonLd: null },
          notes: {
            placeholdersUsed: ["OPENAI_API_KEY missing -> no content generated"],
            assumptions: [],
          },
          diagnostics: {
            hasOpenAIKey: false,
            pagesCrawled: crawl.pageCount,
            crawlErrors: errors.slice(0, 10),
          },
          error: "Missing OPENAI_API_KEY (server env).",
        },
        { status: 200 }
      );
    }

    const llm = await buildContentLLM({
      url: seed,
      language,
      tone,
      serviceFocus,
      companyFacts,
      evidence,
    });

    const resultOk =
      llm &&
      typeof llm === "object" &&
      "pages" in llm &&
      !(llm as { raw?: unknown }).raw;

    if (resultOk) {
      await incrementUsage(supabase, "content", clientId);
    }

    return NextResponse.json(
      {
        url: seed,
        language,
        tone,
        serviceFocus,
        result: llm,
        diagnostics: {
          hasOpenAIKey: true,
          pagesCrawled: crawl.pageCount,
          crawlErrors: errors.slice(0, 10),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Content builder error:", e);
    return NextResponse.json(
      { error: "Content builder failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}