import { NextResponse } from "next/server";
import { generateAuditFixPackage } from "@/lib/site-audit/agent-generate";
import { parseAuditSignals } from "@/lib/site-audit/parse-audit-signals";
import type { GrowthAuditReport, GrowthAuditTopIssue } from "@/lib/site-audit/types";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";

function parseIssue(raw: unknown): GrowthAuditTopIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const title = typeof i.title === "string" ? i.title.trim() : "";
  if (!title) return null;
  const explanation =
    typeof i.explanation === "string" ? i.explanation.trim() : "";
  const impactReal = typeof i.impact === "string" ? i.impact.trim() : "";
  const fix = typeof i.fix === "string" ? i.fix.trim() : "";
  const p = i.priority;
  const priority =
    p === "high" || p === "medium" || p === "low" ? p : "medium";
  return {
    title,
    explanation: explanation || impactReal,
    impact: impactReal || explanation,
    fix,
    priority,
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

    const session = await requireAuthenticatedClient();
    if (!session.ok) return session.response;

    const { supabase, user, clientId } = session;

    const body = await req.json().catch(() => ({}));
    const signals = parseAuditSignals(body?.signals);
    const issue = parseIssue(body?.issue);
    const reportSummary =
      typeof body?.reportSummary === "string"
        ? body.reportSummary
        : typeof body?.summary === "string"
          ? body.summary
          : "";

    if (!signals) {
      return NextResponse.json({ error: "Missing or invalid signals." }, { status: 400 });
    }
    if (!issue) {
      return NextResponse.json({ error: "Missing or invalid issue." }, { status: 400 });
    }

    const usageDenied = await enforceUsageLimit(
      supabase,
      user.id,
      "audit",
      clientId
    );
    if (usageDenied) return usageDenied;

    let report: GrowthAuditReport | undefined;
    if (body?.report && typeof body.report === "object") {
      report = body.report as GrowthAuditReport;
    }

    const summary =
      reportSummary ||
      (report?.summary ?? "") ||
      "Growth audit context not provided; use issue and page signals only.";

    const result = await generateAuditFixPackage({
      pageUrl: signals.url,
      signals,
      issue,
      reportSummary: summary,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    await incrementUsage(supabase, "audit", clientId);

    return NextResponse.json({ fix: result.fix });
  } catch (e) {
    console.error("audit-fix:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
