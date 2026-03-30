import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { normalizeUrl } from "@/lib/site-audit/extract";
import {
  analyzeAIVisibility,
  analyzeContentGaps,
  analyzeConversion,
  analyzeSEO,
  extractWebsiteData,
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

    // Phases 2–5: parallel specialist calls (partial failure tolerated)
    const [seo, aiVis, conversion, gaps] = await Promise.all([
      analyzeSEO(signals),
      analyzeAIVisibility(signals),
      analyzeConversion(signals),
      analyzeContentGaps(signals),
    ]);

    // Phase 6: synthesize final report (fallback merge inside synthesizeReport)
    const report: GrowthAuditReport = await synthesizeReport({
      extract: signals,
      seo,
      aiVis,
      conversion,
      gaps,
    });

    // Ensure coerce in case synthesis returned edge shapes (defensive)
    const normalized = coerceReport(report as unknown) ?? report;

    await incrementUsage(supabase, "audit");

    const signalsPayload = {
      url: signals.url,
      title: signals.title,
      metaDescription: signals.metaDescription,
      h1Count: signals.h1.length,
      h2Count: signals.h2.length,
    };

    const { error: saveAuditErr } = await supabase.from("site_audit_runs").insert({
      user_id: user.id,
      page_url: signals.url,
      report: normalized as unknown as Record<string, unknown>,
      signals: signalsPayload,
    });
    if (saveAuditErr) {
      console.error("site_audit_runs insert:", saveAuditErr);
    }

    return NextResponse.json({
      report: normalized,
      signals: signalsPayload,
    });
  } catch (e) {
    console.error("site-audit:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
