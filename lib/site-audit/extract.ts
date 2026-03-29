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

  return { ok: true, signals };
}
