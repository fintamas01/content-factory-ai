import type { ExtractedPageSignals } from "./types";

const MAX_HTML_BYTES = 500_000;
const MAX_TEXT_SAMPLE_CHARS = 12_000;

export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function pickMeta(html: string, nameOrProperty: string): string | null {
  const reProp = new RegExp(
    `<meta[^>]+property=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m1 = html.match(reProp);
  if (m1?.[1]) return m1[1].trim();

  const reName = new RegExp(
    `<meta[^>]+name=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m2 = html.match(reName);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return stripTags(m[1]).replace(/\s+/g, " ").trim() || null;
}

function stripTags(fragment: string): string {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(html: string, tag: "h1" | "h2"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).slice(0, 500);
    if (text) out.push(text);
  }
  return out.slice(0, 30);
}

function textSampleFromHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const chunk = bodyMatch?.[1] ?? html;
  const stripped = stripTags(chunk);
  return stripped.slice(0, MAX_TEXT_SAMPLE_CHARS);
}

function extractCtas(html: string): string[] {
  const out: string[] = [];
  // Grab common CTA-bearing elements. Keep it cheap + regex-based.
  const re = /<(a|button)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = stripTags(m[2]);
    const txt = decodeHtmlEntities(raw).slice(0, 120);
    if (!txt) continue;
    // Filter out nav noise.
    const low = txt.toLowerCase();
    if (low.length < 2) continue;
    if (low === "menu" || low === "close" || low === "search") continue;
    out.push(txt);
    if (out.length >= 60) break;
  }
  return out;
}

function guessPrimaryCta(ctas: string[], title: string | null): string | null {
  const verbs = [
    "book",
    "schedule",
    "get",
    "start",
    "try",
    "request",
    "contact",
    "talk",
    "buy",
    "pricing",
    "quote",
    "demo",
    "call",
    "join",
    "subscribe",
    "download",
    "sign up",
    "signup",
    "register",
  ];
  const deny = [
    "learn more",
    "read more",
    "view",
    "explore",
    "privacy",
    "terms",
    "cookies",
    "login",
    "log in",
    "sign in",
  ];
  const scored = ctas
    .map((t) => {
      const low = t.toLowerCase();
      let score = 0;
      for (const d of deny) if (low.includes(d)) score -= 2;
      for (const v of verbs) if (low.includes(v)) score += 3;
      if (low.includes("free")) score += 2;
      if (low.includes("trial")) score += 2;
      if (low.includes("demo")) score += 3;
      if (low.includes("quote")) score += 3;
      if (t.length <= 22) score += 1;
      if (t.length >= 60) score -= 1;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return null;
  if (top.score <= 0) return null;
  // Slightly prefer CTAs that mention the title topic (if any).
  if (title) {
    const titleWords = title
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 4)
      .slice(0, 8);
    if (titleWords.some((w) => top.t.toLowerCase().includes(w))) return top.t;
  }
  return top.t;
}

function detectTrustIndicators(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  const patterns: Array<[string, RegExp]> = [
    ["Testimonials", /\btestimonials?\b/],
    ["Reviews", /\breviews?\b/],
    ["Case studies", /\bcase studies?\b|\bcase study\b/],
    ["Client logos / trusted by", /\btrusted by\b|\bclients?\b|\blogos?\b/],
    ["Guarantee", /\bguarantee\b/],
    ["Certifications", /\bcertified\b|\bcertification\b|\biso\b/],
    ["Awards", /\baward\b|\bawards\b/],
    ["Press", /\bas seen in\b|\bpress\b/],
    ["Security/compliance", /\bsoc 2\b|\bhipaa\b|\bgdpr\b|\bcompliance\b/],
    ["Team expertise", /\bexperts?\b|\bteam\b|\bfounded\b|\byears?\b/],
    ["Pricing transparency", /\bpricing\b|\bplans?\b/],
  ];
  for (const [label, re] of patterns) {
    if (re.test(t)) hits.push(label);
    if (hits.length >= 8) break;
  }
  return hits;
}

function topicPatternsFromSignals(args: {
  title: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
}): string[] {
  const src = normalizeSpace(
    [args.title ?? "", ...args.h1, ...args.h2, args.textSample].join(" ")
  );
  const raw = src
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "your",
    "you",
    "our",
    "are",
    "was",
    "were",
    "have",
    "has",
    "will",
    "can",
    "not",
    "but",
    "all",
    "any",
    "their",
    "they",
    "them",
    "what",
    "when",
    "where",
    "why",
    "how",
    "who",
    "about",
    "into",
    "over",
    "under",
    "more",
    "less",
    "best",
    "top",
    "new",
    "free",
  ]);

  const words = raw
    .split(" ")
    .filter((w) => w.length >= 4 && w.length <= 22 && !stop.has(w))
    .slice(0, 2500);

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const top = [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
  return top;
}

export async function fetchAndExtractPage(
  targetUrl: string
): Promise<{ ok: true; signals: ExtractedPageSignals } | { ok: false; error: string; status?: number }> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, error: "Only http(s) URLs are allowed." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; AIGrowthAudit/1.0)",
      },
      cache: "no-store",
    });
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "Fetch failed.";
    if ((e as Error).name === "AbortError") {
      return { ok: false, error: "Request timed out." };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Could not load page (HTTP ${res.status}).`,
      status: res.status,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return { ok: false, error: "URL did not return HTML." };
  }

  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
  const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

  const title = extractTitle(html);
  const metaDescription =
    pickMeta(html, "description") ?? pickMeta(html, "og:description");

  const signals: ExtractedPageSignals = {
    url: url.toString(),
    title,
    metaDescription,
    h1: extractHeadings(html, "h1"),
    h2: extractHeadings(html, "h2"),
    textSample: textSampleFromHtml(html),
  };

  // Best-effort “competitor intelligence” enrichments (heuristic, deterministic).
  const ctas = extractCtas(html);
  const cta_guess = guessPrimaryCta(ctas, title);
  const trust_indicators = detectTrustIndicators(
    [signals.title ?? "", signals.metaDescription ?? "", ...signals.h1, ...signals.h2, signals.textSample].join(
      " "
    )
  );
  const topic_patterns = topicPatternsFromSignals({
    title: signals.title,
    h1: signals.h1,
    h2: signals.h2,
    textSample: signals.textSample,
  });

  if (cta_guess) signals.cta_guess = cta_guess;
  if (trust_indicators.length) signals.trust_indicators = trust_indicators;
  if (topic_patterns.length) signals.topic_patterns = topic_patterns;

  return { ok: true, signals };
}
