import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { normalizeUrl } from "@/lib/site-audit/extract";
import type { GrowthAuditReport } from "@/lib/site-audit/types";
import { compareAuditReports } from "@/lib/progress/audit-comparison";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

/** GET: last two audit runs for same URL → comparison (current vs previous). */
export async function GET(req: Request) {
  try {
    const { supabaseUrl, supabaseAnon } = getEnv();
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("url");
    if (!raw?.trim()) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }
    const pageUrl = normalizeUrl(raw);

    const { data: runs, error } = await supabase
      .from("site_audit_runs")
      .select("id, report, created_at")
      .eq("client_id", clientId)
      .eq("page_url", pageUrl)
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) {
      console.error("audit-comparison:", error);
      return NextResponse.json({ error: "Could not load audits." }, { status: 500 });
    }

    const list = runs ?? [];
    if (list.length === 0) {
      return NextResponse.json({ auditProgress: null });
    }
    if (list.length === 1) {
      const only = list[0];
      const auditProgress = compareAuditReports({
        previousReport: null,
        currentReport: only.report as GrowthAuditReport,
        previousRunAt: null,
        previousRunId: null,
      });
      return NextResponse.json({ auditProgress });
    }

    const [latest, previous] = list;
    const currentReport = latest.report as GrowthAuditReport;
    const auditProgress = compareAuditReports({
      previousReport: previous.report ?? null,
      currentReport: currentReport,
      previousRunAt: previous.created_at ?? null,
      previousRunId: previous.id ?? null,
    });

    return NextResponse.json({ auditProgress });
  } catch (e) {
    console.error("GET /api/progress/audit-comparison:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
