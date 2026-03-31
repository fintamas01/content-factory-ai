import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { generateGrowthSprintPlan } from "@/lib/site-audit/growth-sprint";

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

    return NextResponse.json({ plan: result.plan });
  } catch (e) {
    console.error("growth-sprint:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

