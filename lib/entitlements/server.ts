import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { PlanTier, SubscriptionRow } from "@/lib/plan-config";
import { resolvePlanTier } from "@/lib/plan-config";
import { FEATURES, isPlanAtLeast, type FeatureKey } from "@/lib/entitlements/features";

export async function getUserPlanTierServer(userId: string): Promise<PlanTier> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  if (!supabaseUrl || !supabaseAnon) return "free";

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

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id,status,price_id,stripe_subscription_id,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return resolvePlanTier(sub as SubscriptionRow | null);
}

export async function requirePlanAtLeast(featureKey: FeatureKey): Promise<
  | { allowed: true; plan: PlanTier; required: PlanTier }
  | { allowed: false; plan: PlanTier; required: PlanTier }
> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return { allowed: false, plan: "free", required: FEATURES[featureKey].minPlan };
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

  const required = FEATURES[featureKey].minPlan;
  if (!user) return { allowed: false, plan: "free", required };
  const plan = await getUserPlanTierServer(user.id);
  if (!isPlanAtLeast(plan, required)) return { allowed: false, plan, required };
  return { allowed: true, plan, required };
}

