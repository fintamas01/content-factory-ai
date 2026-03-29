import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { fetchAndExtractPage, normalizeUrl } from "@/lib/site-audit/extract";
import type { GrowthAuditReport } from "@/lib/site-audit/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a senior SEO strategist, CRO (conversion rate) consultant, and AI search / LLM visibility specialist. Your client paid for a premium audit—deliver output that would justify a €50–€200 professional review: decisive, specific, revenue-aware, and non-generic.

INPUT: You receive JSON with fields extracted from ONE public HTML page (single URL—not a full-site crawl). You must ground every claim in that payload. If a field is empty or missing, say so explicitly and lower confidence—never invent page elements you were not given.

OUTPUT: Return strictly valid JSON only. No markdown, no code fences, no keys beyond this schema (no extra keys):

{
  "summary": "string",
  "scores": { "seo": number, "ai_discoverability": number, "conversion": number },
  "top_issues": [ { "title": "string", "impact": "string", "fix": "string", "priority": "high"|"medium"|"low" } ],
  "quick_wins": [ { "action": "string", "expected_result": "string" } ],
  "content_opportunities": [ { "idea": "string", "why_it_works": "string" } ],
  "ai_visibility": { "would_ai_recommend": boolean, "reason": "string", "improvement": "string" }
}

SCORES (integers 0–100 for each):
- seo: On-page signals visible in the extract—title/meta alignment, H1 focus, heading support, topical clarity vs generic fluff, obvious gaps (e.g. thin meta, title/H1 mismatch). Do not claim technical metrics you cannot see (Core Web Vitals, crawl budget, backlinks).
- ai_discoverability: How likely a consumer AI (ChatGPT-style) could confidently name, describe, or recommend this business from THIS page alone—entity clarity, specificity, service geography, proof, differentiation from “template” copy.
- conversion: Value prop clarity, friction, next step, risk reversal, specificity (numbers, outcomes), trust cues mentioned in the visible text sample.

SUMMARY (5–8 sentences): Executive tone. State what the page is trying to sell or achieve, one sharp strength with reference to actual wording from the extract, the biggest revenue or visibility risk, and what to ship first. If the extract is thin, say how that caps certainty.

TOP_ISSUES (5–8 items):
- BANNED: vague titles like “Improve SEO”, “Add more content”, “Better UX” without diagnosis.
- Each "title": diagnostic, specific (e.g. “Meta description repeats brand only—no search intent”).
- "impact": MUST tie to business outcome—qualified traffic, snippet CTR, rankings for a named intent, conversion rate, lead quality, or AI citation likelihood. Use concrete language (e.g. “Weak meta → lower CTR from search results even if rank holds”).
- "fix": One clear, executable fix—rewrite target, new H2, CTA copy pattern, proof placement—not a category label.
- "priority": high | medium | low based on revenue/visibility upside.

QUICK_WINS (5–8 items):
- "action": imperative, specific, doable in under ~90 minutes on this page (copy/meta/headings/CTA)—include what to change in plain language.
- "expected_result": measurable or directional outcome (e.g. “Higher CTR from search snippets for [intent]”, “Clearer primary CTA → fewer bounces on this landing”).

CONTENT_OPPORTUNITIES (4–7 items):
- "idea": a concrete asset or section (e.g. “Comparison table: vs hiring in-house”, “FAQ block targeting ‘pricing’ and ‘timeline’ objections”).
- "why_it_works": tie to funnel stage, objection handling, SEO long-tail capture, or AI-friendly factual density—never “because content is good”.

AI_VISIBILITY:
- "would_ai_recommend": boolean—your best judgment on whether an AI assistant would recommend or clearly cite this business for a relevant user query, from this page text alone.
- "reason": 2–4 sentences citing what supports or contradicts recommendation (specificity, proof, geography, entity name).
- "improvement": 1–3 concrete changes to increase the likelihood of being recommended or accurately summarized (not generic).

GUARDRAILS:
- No fabricated reviews, awards, or schema you cannot see.
- Plain text inside JSON strings only (no **, no bullet markdown).
- Think like someone optimizing revenue and pipeline, not checklist SEO.`;

function parseJsonFromAssistantContent(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/s, "");
  }
  return JSON.parse(cleaned);
}

function clampScore(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
}

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

function coerceReport(data: unknown): GrowthAuditReport | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const summary = typeof o.summary === "string" ? o.summary : "";

  const scoresRaw = o.scores;
  let seo = 50;
  let aiDisc = 50;
  let conv = 50;
  if (scoresRaw && typeof scoresRaw === "object") {
    const s = scoresRaw as Record<string, unknown>;
    seo = clampScore(Number(s.seo));
    aiDisc = clampScore(Number(s.ai_discoverability));
    conv = clampScore(Number(s.conversion));
  } else {
    seo = clampScore(Number(o.seo_score));
    aiDisc = clampScore(
      Number(o.ai_discoverability_score ?? o.ai_readiness_score)
    );
    conv = clampScore(Number(o.conversion_score));
  }

  const topRaw = Array.isArray(o.top_issues) ? o.top_issues : [];
  const top_issues = topRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title : "";
      const impact = typeof x.impact === "string" ? x.impact : "";
      const fix = typeof x.fix === "string" ? x.fix : "";
      const p = x.priority;
      const priority =
        p === "high" || p === "medium" || p === "low" ? p : "medium";
      if (!title && !impact && !fix) return null;
      return { title, impact, fix, priority };
    })
    .filter(Boolean) as GrowthAuditReport["top_issues"];

  const qwRaw = Array.isArray(o.quick_wins) ? o.quick_wins : [];
  const quick_wins = qwRaw
    .map((it) => {
      if (typeof it === "string") {
        return { action: it, expected_result: "" };
      }
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const action = typeof x.action === "string" ? x.action : "";
      const expected_result =
        typeof x.expected_result === "string" ? x.expected_result : "";
      if (!action && !expected_result) return null;
      return { action, expected_result };
    })
    .filter(Boolean) as GrowthAuditReport["quick_wins"];

  const coRaw = Array.isArray(o.content_opportunities)
    ? o.content_opportunities
    : [];
  const content_opportunities = coRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const idea = typeof x.idea === "string" ? x.idea : "";
      const why_it_works =
        typeof x.why_it_works === "string" ? x.why_it_works : "";
      if (!idea && !why_it_works) return null;
      return { idea, why_it_works };
    })
    .filter(Boolean) as GrowthAuditReport["content_opportunities"];

  const avRaw = o.ai_visibility;
  let ai_visibility: GrowthAuditReport["ai_visibility"];
  if (avRaw && typeof avRaw === "object") {
    const av = avRaw as Record<string, unknown>;
    ai_visibility = {
      would_ai_recommend: coerceBool(av.would_ai_recommend),
      reason: typeof av.reason === "string" ? av.reason : "",
      improvement:
        typeof av.improvement === "string" ? av.improvement : "",
    };
  } else {
    const ad = o.ai_discoverability;
    if (ad && typeof ad === "object") {
      const a = ad as Record<string, unknown>;
      ai_visibility = {
        would_ai_recommend: clampScore(Number(a.score)) >= 60,
        reason:
          typeof a.explanation === "string"
            ? a.explanation
            : typeof a.verdict === "string"
              ? a.verdict
              : "",
        improvement: "Re-run audit with updated schema for full AI visibility block.",
      };
    } else {
      ai_visibility = {
        would_ai_recommend: false,
        reason: "AI visibility block missing from model output.",
        improvement: "Regenerate the audit.",
      };
    }
  }

  return {
    summary: summary || "Analysis complete.",
    scores: { seo, ai_discoverability: aiDisc, conversion: conv },
    top_issues,
    quick_wins,
    content_opportunities,
    ai_visibility,
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
        { role: "system", content: SYSTEM_PROMPT },
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
