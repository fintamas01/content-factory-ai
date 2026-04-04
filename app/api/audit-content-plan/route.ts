import { NextResponse } from "next/server";
import { generateFourteenDayPlan } from "@/lib/site-audit/agent-generate";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { parseAuditSignals } from "@/lib/site-audit/parse-audit-signals";
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
    const signals = parseAuditSignals(body?.signals);
    const reportRaw = body?.report;

    if (!signals) {
      return NextResponse.json({ error: "Missing or invalid signals." }, { status: 400 });
    }

    const report = coerceReport(reportRaw);
    if (!report) {
      return NextResponse.json({ error: "Missing or invalid report." }, { status: 400 });
    }

    const usageDenied = await enforceUsageLimit(
      supabase,
      user.id,
      "audit",
      clientId
    );
    if (usageDenied) return usageDenied;

    const result = await generateFourteenDayPlan({
      pageUrl: signals.url,
      signals,
      report,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    await incrementUsage(supabase, "audit", clientId);

    return NextResponse.json({ days: result.days });
  } catch (e) {
    console.error("audit-content-plan:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
