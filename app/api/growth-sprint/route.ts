import { NextResponse } from "next/server";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { generateGrowthSprintPlan } from "@/lib/site-audit/growth-sprint";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured on the server." },
        { status: 500 }
      );
    }

    const session = await requireAuthenticatedClient();
    if (!session.ok) return session.response;

    const { supabase, user, clientId } = session;

    const body = await req.json().catch(() => ({}));
    const report = coerceReport(body?.report);
    const auditRunId = typeof body?.auditRunId === "string" ? body.auditRunId : "";
    const signals = body?.signals as
      | {
          url: string;
          title: string | null;
          metaDescription: string | null;
          h1Count: number;
          h2Count: number;
        }
      | undefined;

    if (!report) {
      return NextResponse.json({ error: "Missing or invalid report." }, { status: 400 });
    }
    if (!signals || typeof signals.url !== "string" || !signals.url.trim()) {
      return NextResponse.json({ error: "Missing or invalid signals." }, { status: 400 });
    }

    const usageDenied = await enforceUsageLimit(
      supabase,
      user.id,
      "audit",
      clientId
    );
    if (usageDenied) return usageDenied;

    const result = await generateGrowthSprintPlan({ report, signals });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    if (auditRunId) {
      const merged = {
        ...(report as unknown as Record<string, unknown>),
        growth_sprint: result.plan as unknown as Record<string, unknown>,
        growth_sprint_generated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("site_audit_runs")
        .update({ report: merged })
        .eq("id", auditRunId)
        .eq("user_id", user.id);
      if (upErr) console.error("growth-sprint save:", upErr);
    }

    await incrementUsage(supabase, "audit", clientId);

    return NextResponse.json({ plan: result.plan });
  } catch (e) {
    console.error("growth-sprint:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

