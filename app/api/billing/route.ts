import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import {
  getAllowedCheckoutPriceIds,
  getStripePriceIdBasic,
  getStripePriceIdElite,
  getStripePriceIdPro,
} from "@/lib/billing/pricing";
import { buildUsageSummary, getUserPlanTier } from "@/lib/usage/usage-service";
import type { UsageSummary } from "@/lib/usage/types";
import type { PlanTier, SubscriptionRow } from "@/lib/plan-config";

export type BillingApiResponse = {
  subscription: Record<string, unknown> | null;
  /** Monthly usage; null if no workspace is selected (checkout still works). */
  usage: UsageSummary | null;
  /** From Stripe subscription; same as usage.plan when usage is present. */
  plan: PlanTier;
  /**
   * Stripe Price IDs read on the server (runtime env).
   * Client components cannot rely on NEXT_PUBLIC_* alone — those are inlined at build time.
   */
  checkoutPriceIds: {
    pro: string;
    basic: string;
    elite: string;
  };
  allowedCheckoutPriceIds: string[];
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

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const subRow = subscription as SubscriptionRow | null;
    const plan = getUserPlanTier(subRow);

    let usage: UsageSummary | null = null;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      usage = await buildUsageSummary(supabase, user.id, active.clientId);
    } catch {
      /* No active workspace — still return checkout price IDs and plan for billing UI. */
    }

    const body: BillingApiResponse = {
      subscription: subscription as Record<string, unknown> | null,
      usage,
      plan,
      checkoutPriceIds: {
        pro: getStripePriceIdPro(),
        basic: getStripePriceIdBasic(),
        elite: getStripePriceIdElite(),
      },
      allowedCheckoutPriceIds: getAllowedCheckoutPriceIds(),
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
