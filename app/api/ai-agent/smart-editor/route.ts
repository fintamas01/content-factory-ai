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

function normalizeWhitespace(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 7000) {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
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

function extractReadableText(html: string) {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("title").first().text() || "");
  const metaDesc = normalizeWhitespace($('meta[name="description"]').attr("content") || "");

  $("script,noscript,style,svg").remove();

  const selectors = ["main", "#content", ".site-content", ".entry-content", ".elementor", "body"];
  let best = "";
  for (const sel of selectors) {
    const t = normalizeWhitespace($(sel).text());
    if (t.length > best.length) best = t;
  }

  return truncate(
    [
      title ? `TITLE: ${title}` : "",
      metaDesc ? `META_DESCRIPTION: ${metaDesc}` : "",
      best ? `BODY_TEXT: ${best}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    9000
  );
}

async function callSmartEditorLLM(args: {
  url: string;
  sourceText: string;
  language: string;
  tone: string;
  focus: string;
}) {
  const system = `
You output STRICT JSON only. No markdown.
Goal: rewrite/improve website copy.
Constraints:
- Do not invent company facts. Use only provided text.
- Return 4 variants: direct, premium, friendly, seo.
- Provide per-variant: headline, subheadline, bullets[], shortParagraph, ctaPrimary, ctaSecondary.
- Also return improvements[] (actionable notes) and keywords[].
JSON keys:
{
  "url": "...",
  "language": "...",
  "tone": "...",
  "focus": "...",
  "variants": {
    "direct": {...},
    "premium": {...},
    "friendly": {...},
    "seo": {...}
  },
  "improvements": ["..."],
  "keywords": ["..."]
}
`.trim();

  const user = {
    url: args.url,
    language: args.language,
    tone: args.tone,
    focus: args.focus,
    sourceText: args.sourceText,
  };

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.35,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
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

    const language = typeof body.language === "string" ? body.language.trim() : "en";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "modern, premium, direct";
    const focus = typeof body.focus === "string" ? body.focus.trim() : "homepage hero";

    const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 9000;

    const pageUrl = toUrl(url);
    const fetched = await fetchHtml(pageUrl, Math.max(1500, Math.min(15000, timeoutMs)));

    if (!fetched.ok) {
      return NextResponse.json(
        {
          error: "Fetch failed.",
          details: fetched.error,
          url: pageUrl,
          diagnostics: { ok: false, status: fetched.status },
        },
        { status: 200 }
      );
    }

    const readable = extractReadableText(fetched.html);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          url: pageUrl,
          language,
          tone,
          focus,
          error: "Missing OPENAI_API_KEY (server env).",
          diagnostics: { hasOpenAIKey: false },
          sourceTextPreview: readable.slice(0, 1200),
          variants: {},
          improvements: [],
          keywords: [],
        },
        { status: 200 }
      );
    }

    const llm = await callSmartEditorLLM({
      url: pageUrl,
      sourceText: readable,
      language,
      tone,
      focus,
    });

    return NextResponse.json(
      {
        ...llm,
        diagnostics: {
          hasOpenAIKey: true,
          sourceChars: readable.length,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Smart editor error:", e);
    return NextResponse.json(
      { error: "Smart editor failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}