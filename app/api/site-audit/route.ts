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
          content: `You are a senior marketing strategist and SEO lead reviewing ONE public HTML page (extracted fields only—this is not a full-site crawl). Write with the tone of a premium SaaS audit: confident, specific, and commercially useful.

OUTPUT: Strictly valid JSON only, matching this exact schema (no extra keys):
{
  "summary": "string",
  "seo_score": number,
  "ai_readiness_score": number,
  "conversion_score": number,
  "issues": [ { "title": "string", "description": "string", "priority": "high"|"medium"|"low" } ],
  "quick_wins": [ "string" ],
  "content_suggestions": [ "string" ]
}

SUMMARY (4–6 sentences):
- Open with what this page is trying to accomplish based ONLY on title, meta description, headings, and text sample.
- Call out 1–2 concrete strengths (quote or paraphrase specific phrases from the payload when possible).
- Name the biggest gap or risk in plain language (e.g. missing primary keyword intent in H1, thin meta, unclear offer).
- End with one sentence on what to fix first for impact. If the extract is thin or empty in places, say that explicitly and explain how that limits certainty—do not fabricate page elements you were not given.

SCORING (0–100 each, integers):
- seo_score: Title/meta, heading hierarchy, topical focus, and whether copy suggests clear keyword/entity focus vs. generic filler. Penalize missing or duplicate H1 patterns, very short meta, or title/meta mismatch with visible headings—only when inferable from the data.
- ai_readiness_score: How machine-readable the page seems from text: clear topic, structured headings, definitional language, lists/facts vs. vague marketing fluff. Reward clear “who / what / why” in the sample.
- conversion_score: Clarity of value prop, next step, friction words, trust/credibility signals visible in the text sample only (e.g. specificity, numbers, outcomes, guarantees mentioned in copy).

ISSUES (max 8):
- Each issue needs a short, diagnostic title (not “Improve SEO”).
- Description must: (1) state what you observe from the provided fields, (2) explain why it hurts rankings, AI understanding, or conversions, (3) give ONE specific fix with a realistic example tied to this page’s topic (e.g. “Rewrite meta to ~150 characters including primary intent: ‘[example phrase]…’” or “Add a single H2 that answers ‘Pricing’ if the sample never mentions price”).
- Priority: high = materially hurts crawlability, clarity, or trust from the evidence; medium = meaningful improvement; low = polish.
- Never claim technical facts you cannot see (schema markup, page speed, Core Web Vitals, backlinks). If you infer a risk, label it as inference.

QUICK WINS (4–7 items):
- Imperative, start with a verb. Each line is one tactic + expected outcome, e.g. “Front-load the primary benefit in the first 160 characters of meta: compare current ‘…’ vs proposed ‘…’ (use your own words from the payload).”
- Prefer changes that can be executed in under an hour on this page copy alone.

CONTENT SUGGESTIONS (4–7 items):
- Specific content angles, sections, or copy blocks to add (FAQ, comparison table, proof bar, objection handler)—each tied to a gap in the current text sample.
- Where helpful, include a short example headline or bullet in quotes grounded in the page’s apparent topic.

GUARDRAILS:
- Ground every claim in the JSON payload (url, title, metaDescription, h1, h2, textSample). If something is missing, say “Not visible in extract” rather than guessing.
- Do not output markdown inside JSON string values—plain text only.`,
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
