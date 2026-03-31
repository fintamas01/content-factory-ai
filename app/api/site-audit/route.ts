import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { normalizeUrl } from "@/lib/site-audit/extract";
import {
  analyzeCompetitorGaps,
  extractWebsiteData,
  runSpecialistPhases,
  synthesizeReport,
} from "@/lib/site-audit/pipeline";
import type { GrowthAuditReport } from "@/lib/site-audit/types";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";

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

    const usageDenied = await enforceUsageLimit(supabase, user.id, "audit");
    if (usageDenied) return usageDenied;

    const body = await req.json().catch(() => ({}));
    const websiteInput = body?.url as string | undefined;
    const competitorsInput = Array.isArray(body?.competitors)
      ? (body.competitors as unknown[])
      : [];
    if (!websiteInput || typeof websiteInput !== "string") {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const targetUrl = normalizeUrl(websiteInput);
    if (!targetUrl) {
      return NextResponse.json({ error: "Invalid url." }, { status: 400 });
    }

    // Phase 1: structured extract (reuses fetch + HTML parsing in extract module)
    const extracted = await extractWebsiteData(targetUrl);
    if (!extracted.ok) {
      return NextResponse.json(
        { error: extracted.error },
        { status: 422 }
      );
    }

    const signals = extracted.data;

    // Phases 2–5: one batched OpenAI call (fallback: four parallel calls with same compact input)
    const { seo, aiVis, conversion, gaps } = await runSpecialistPhases(signals);

    // Phase 6: synthesize final report (fallback merge inside synthesizeReport)
    let report: GrowthAuditReport = await synthesizeReport({
      extract: signals,
      seo,
      aiVis,
      conversion,
      gaps,
    });

    // Phase 7 (optional): competitor intelligence (best-effort; never blocks main audit)
    const competitorsClean = competitorsInput
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
        if (ci.ok) {
          report = { ...report, competitor_intelligence: ci.competitor_intelligence };
        } else {
          console.warn("[site-audit] competitor intelligence failed:", ci.error);
        }
      }
    }

    // Ensure coerce in case synthesis returned edge shapes (defensive)
    const normalized = coerceReport(report as unknown) ?? report;

    await incrementUsage(supabase, "audit");

    const signalsPayload = {
      url: signals.url,
      title: signals.title,
      metaDescription: signals.metaDescription,
      h1Count: signals.h1.length,
      h2Count: signals.h2.length,
      competitors: competitorsClean,
    };

    const { data: savedAudit, error: saveAuditErr } = await supabase
      .from("site_audit_runs")
      .insert({
        user_id: user.id,
        page_url: signals.url,
        report: normalized as unknown as Record<string, unknown>,
        signals: signalsPayload,
      })
      .select("id")
      .maybeSingle();
    if (saveAuditErr) console.error("site_audit_runs insert:", saveAuditErr);

    return NextResponse.json({
      report: normalized,
      signals: signalsPayload,
      auditRunId: savedAudit?.id ?? null,
    });
  } catch (e) {
    console.error("site-audit:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
