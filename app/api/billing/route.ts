import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildUsageSummary } from "@/lib/usage/usage-service";
import type { UsageSummary } from "@/lib/usage/types";

export type BillingApiResponse = {
  subscription: Record<string, unknown> | null;
  usage: UsageSummary;
};

export async function GET() {
  try {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usage = await buildUsageSummary(supabase, user.id);
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const body: BillingApiResponse = {
      subscription: subscription as Record<string, unknown> | null,
      usage,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("GET /api/billing:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
