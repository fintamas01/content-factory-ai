import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateFourteenDayPlan } from "@/lib/site-audit/agent-generate";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import { parseAuditSignals } from "@/lib/site-audit/parse-audit-signals";

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
    const reportRaw = body?.report;

    if (!signals) {
      return NextResponse.json({ error: "Missing or invalid signals." }, { status: 400 });
    }

    const report = coerceReport(reportRaw);
    if (!report) {
      return NextResponse.json({ error: "Missing or invalid report." }, { status: 400 });
    }

    const result = await generateFourteenDayPlan({
      pageUrl: signals.url,
      signals,
      report,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ days: result.days });
  } catch (e) {
    console.error("audit-content-plan:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
