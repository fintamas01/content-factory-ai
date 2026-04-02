import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeUrl } from "@/lib/site-audit/extract";
import {
  analyzeCompetitorGaps,
  extractWebsiteData,
  runSpecialistPhases,
  synthesizeReport,
} from "@/lib/site-audit/pipeline";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import type { GrowthAuditReport } from "@/lib/site-audit/types";
import { requireActiveClientId } from "@/lib/clients/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { buildAutopilotInsights, type AutopilotFocus } from "@/lib/autopilot/insights";
import { callOpenAIJson } from "@/lib/site-audit/pipeline/shared";
import {
  buildAutopilotInsightsSystemPrompt,
  buildAutopilotInsightsUserPrompt,
} from "@/lib/autopilot/prompt";
import { createNotification } from "@/lib/notifications/server";

async function getRouteCtx() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;
  const cookieStore = await cookies();
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
  return { supabase, cookieStore };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured on the server." },
        { status: 500 }
      );
    }

    const ctx = await getRouteCtx();
    if (!ctx) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
    const { supabase, cookieStore } = ctx;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const usageDenied = await enforceUsageLimit(supabase, user.id, "audit", clientId);
    if (usageDenied) return usageDenied;

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId : null;
    if (!jobId) return NextResponse.json({ error: "Missing jobId." }, { status: 400 });

    const { data: job, error: jobErr } = await supabase
      .from("autopilot_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr || !job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (String((job as { client_id?: string }).client_id) !== clientId) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.enabled === false) {
      return NextResponse.json({ error: "AutoPilot is disabled for this job." }, { status: 400 });
    }

    const targetUrl = normalizeUrl(String(job.url ?? ""));
    if (!targetUrl) return NextResponse.json({ error: "Invalid url." }, { status: 400 });

    const extracted = await extractWebsiteData(targetUrl);
    if (!extracted.ok) return NextResponse.json({ error: extracted.error }, { status: 422 });
    const signals = extracted.data;

    const { seo, aiVis, conversion, gaps } = await runSpecialistPhases(signals);
    let report: GrowthAuditReport = await synthesizeReport({
      extract: signals,
      seo,
      aiVis,
      conversion,
      gaps,
    });

    const competitorsClean = (Array.isArray(job.competitors) ? (job.competitors as unknown[]) : [])
      .filter((c): c is string => typeof c === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((u) => normalizeUrl(u))
      .filter((u) => typeof u === "string" && u.length > 0)
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .filter((u) => u !== signals.url);

    if (competitorsClean.length > 0) {
      const extractedCompetitors = await Promise.all(
        competitorsClean.map(async (u) => {
          const ex = await extractWebsiteData(u);
          if (!ex.ok) return { url: u, ok: false as const, error: ex.error };
          return { url: u, ok: true as const, extract: ex.data };
        })
      );
      const okCount = extractedCompetitors.filter((c) => c.ok).length;
      if (okCount > 0) {
        const ci = await analyzeCompetitorGaps({
          user: signals,
          competitors: extractedCompetitors,
          userAuditContext: {
            scores: report.scores,
            top_issues: report.top_issues,
            quick_wins: report.quick_wins,
            ai_visibility: report.ai_visibility,
            content_opportunities: report.content_opportunities,
          },
        });
        if (ci.ok) report = { ...report, competitor_intelligence: ci.competitor_intelligence };
      }
    }

    const normalized = coerceReport(report as unknown) ?? report;

    const focus = (Array.isArray(job.focus) ? (job.focus as unknown[]) : [])
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean) as AutopilotFocus[];

    // 1) Attempt alert-quality insights via LLM (grounded in audit JSON + competitor intelligence)
    const llm = await callOpenAIJson({
      system: buildAutopilotInsightsSystemPrompt(),
      user: buildAutopilotInsightsUserPrompt({
        url: signals.url,
        competitors: competitorsClean,
        focus,
        signals: {
          title: signals.title,
          metaDescription: signals.metaDescription,
          h1Count: signals.h1.length,
          h2Count: signals.h2.length,
        },
        report: normalized,
      }),
      temperature: 0.25,
      max_tokens: 1200,
    });

    let summary: string;
    let insights: any;

    if (llm.ok) {
      const parsed = llm.parsed as any;
      summary =
        typeof parsed?.summary === "string"
          ? parsed.summary
          : `AutoPilot ran on ${signals.url} and detected new opportunities.`;
      insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
    } else {
      // 2) Fallback to deterministic heuristic insights (never blocks a run)
      const fallback = buildAutopilotInsights({
        url: signals.url,
        report: normalized,
        focus,
      });
      summary = fallback.summary;
      insights = fallback.insights;
    }

    const { data: saved, error: saveErr } = await supabase
      .from("autopilot_results")
      .insert({
        user_id: user.id,
        client_id: clientId,
        job_id: job.id,
        summary,
        insights: insights as unknown as Record<string, unknown>,
      })
      .select("*")
      .maybeSingle();
    if (saveErr) {
      console.error("autopilot_results insert:", saveErr);
      return NextResponse.json({ error: "Failed to save result." }, { status: 500 });
    }

    await supabase
      .from("autopilot_jobs")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", job.id);

    await incrementUsage(supabase, "audit", clientId);

    // Retention-friendly alert: only surface when there are actionable items.
    const insightCount = Array.isArray(insights) ? insights.length : 0;
    if (insightCount > 0) {
      void createNotification(supabase, {
        userId: user.id,
        clientId,
        type: "autopilot_new_opportunity",
        title: "AutoPilot found new opportunities",
        message: summary,
        severity: insightCount >= 3 ? "warning" : "info",
        sourceModule: "autopilot",
        actionLabel: "Open AutoPilot",
        actionUrl: "/dashboard/autopilot",
        metadata: {
          autopilot_job_id: job.id,
          autopilot_result_id: (saved as any)?.id ?? null,
          insights_count: insightCount,
          url: signals.url,
        },
      });
    }

    return NextResponse.json({ ok: true, result: saved });
  } catch (e) {
    console.error("autopilot/run:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

