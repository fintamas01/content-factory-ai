import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { fetchAndExtractPage, normalizeUrl } from "@/lib/site-audit/extract";
import type { GrowthAuditReport } from "@/lib/site-audit/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseJsonFromAssistantContent(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/s, "");
  }
  return JSON.parse(cleaned);
}

function coerceReport(data: unknown): GrowthAuditReport | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const summary = typeof o.summary === "string" ? o.summary : "";
  const seo = Number(o.seo_score);
  const aiReady = Number(o.ai_readiness_score);
  const conv = Number(o.conversion_score);

  const issuesRaw = Array.isArray(o.issues) ? o.issues : [];
  const issues = issuesRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title : "";
      const description = typeof x.description === "string" ? x.description : "";
      const p = x.priority;
      const priority =
        p === "high" || p === "medium" || p === "low" ? p : "medium";
      if (!title && !description) return null;
      return { title, description, priority };
    })
    .filter(Boolean) as GrowthAuditReport["issues"];

  const qw = Array.isArray(o.quick_wins)
    ? o.quick_wins.filter((s): s is string => typeof s === "string")
    : [];
  const cs = Array.isArray(o.content_suggestions)
    ? o.content_suggestions.filter((s): s is string => typeof s === "string")
    : [];

  const clamp = (n: number) =>
    Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;

  return {
    summary: summary || "Analysis complete.",
    seo_score: clamp(seo),
    ai_readiness_score: clamp(aiReady),
    conversion_score: clamp(conv),
    issues,
    quick_wins: qw,
    content_suggestions: cs,
  };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured on the server." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* ignore */
          }
        },
      },
    });

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const websiteInput = body?.url as string | undefined;
    if (!websiteInput || typeof websiteInput !== "string") {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const targetUrl = normalizeUrl(websiteInput);
    if (!targetUrl) {
      return NextResponse.json({ error: "Invalid url." }, { status: 400 });
    }

    const extracted = await fetchAndExtractPage(targetUrl);
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: 422 });
    }

    const { signals } = extracted;

    const payload = {
      url: signals.url,
      title: signals.title,
      metaDescription: signals.metaDescription,
      h1: signals.h1,
      h2: signals.h2.slice(0, 20),
      textSample: signals.textSample,
    };

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_SITE_AUDIT_MODEL ?? "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert growth and SEO analyst. You receive structured data extracted from a single public web page (not full site crawl). Output strictly valid JSON matching this schema:
{
  "summary": "string (2-4 sentences)",
  "seo_score": number 0-100,
  "ai_readiness_score": number 0-100 (how well the page works for AI assistants, clarity, structured meaning)",
  "conversion_score": number 0-100 (CTAs, clarity, trust signals — based only on visible text sample)",
  "issues": [ { "title": "string", "description": "string", "priority": "high"|"medium"|"low" } ],
  "quick_wins": [ "string" ],
  "content_suggestions": [ "string" ]
}
Be practical. If data is thin, say so in summary and score conservatively. Never invent facts not supported by the provided fields. Max 8 issues.`,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No analysis returned from the model." },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromAssistantContent(content);
    } catch {
      return NextResponse.json(
        { error: "Could not parse AI response." },
        { status: 502 }
      );
    }

    const report = coerceReport(parsed);
    if (!report) {
      return NextResponse.json(
        { error: "Invalid AI response shape." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      report,
      signals: {
        url: signals.url,
        title: signals.title,
        metaDescription: signals.metaDescription,
        h1Count: signals.h1.length,
        h2Count: signals.h2.length,
      },
    });
  } catch (e) {
    console.error("site-audit:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
