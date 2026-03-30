import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateAuditFixPackage } from "@/lib/site-audit/agent-generate";
import { parseAuditSignals } from "@/lib/site-audit/parse-audit-signals";
import type { GrowthAuditReport, GrowthAuditTopIssue } from "@/lib/site-audit/types";

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

    return NextResponse.json({ fix: result.fix });
  } catch (e) {
    console.error("audit-fix:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
