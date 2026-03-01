import { NextResponse } from "next/server";
import OpenAI from "openai";

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

async function buildLandingLayoutLLM(args: {
  url: string;
  language: string;
  tone: string;
  serviceFocus: string[];
}) {
  const system = `
You output STRICT JSON only. No markdown.
Create a modern landing page layout that looks premium in 2026.

Return JSON keys:
{
  "theme": { "accent": "blue", "style": "modern" },
  "page": {
    "title": "...",
    "sections": [
      { "type": "hero", "headline": "...", "subheadline": "...", "bullets":[], "ctaPrimary":"...", "ctaSecondary":"..." },
      { "type": "services", "items":[{ "title":"...", "desc":"...", "points":[] }] },
      { "type": "process", "steps":[{ "title":"...", "desc":"..." }] },
      { "type": "proof", "bullets":[] },
      { "type": "faq", "items":[{ "q":"...", "a":"..." }] },
      { "type": "cta", "headline":"...", "desc":"...", "ctaPrimary":"..." }
    ]
  }
}

Rules:
- Keep copy concise, premium, direct.
- Services must align with serviceFocus.
- Do not invent hard facts (numbers, awards, clients) unless implied by the URL name; keep generic.
`.trim();

  const user = {
    url: args.url,
    language: args.language,
    tone: args.tone,
    serviceFocus: args.serviceFocus,
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
    const serviceFocus = Array.isArray(body.serviceFocus)
      ? body.serviceFocus.map((x: any) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];

    const seed = toUrl(url);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          url: seed,
          error: "Missing OPENAI_API_KEY (server env).",
          diagnostics: { hasOpenAIKey: false },
          theme: { accent: "blue", style: "modern" },
          page: { title: "Landing Page", sections: [] },
        },
        { status: 200 }
      );
    }

    const layout = await buildLandingLayoutLLM({
      url: seed,
      language,
      tone,
      serviceFocus,
    });

    return NextResponse.json(
      {
        url: seed,
        language,
        tone,
        serviceFocus,
        layout,
        diagnostics: { hasOpenAIKey: true },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Landing page error:", e);
    return NextResponse.json(
      { error: "Landing page failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}