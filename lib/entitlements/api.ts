import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTier, SubscriptionRow } from "@/lib/plan-config";
import { resolvePlanTier } from "@/lib/plan-config";
import { canAccess, requiredPlan, type FeatureKey } from "@/lib/entitlements/features";

export async function requireFeatureAccess(params: {
  supabase: SupabaseClient;
  userId: string;
  featureKey: FeatureKey;
}): Promise<null | NextResponse> {
  const { supabase, userId, featureKey } = params;
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id,status,price_id,stripe_subscription_id,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const plan = resolvePlanTier(sub as SubscriptionRow | null);
  if (!canAccess(plan, featureKey)) {
    return NextResponse.json(
      {
        error: "Feature is locked for your current plan.",
        code: "FEATURE_LOCKED",
        featureKey,
        plan,
        requiredPlan: requiredPlan(featureKey) as PlanTier,
      },
      { status: 403 }
    );
  }
  return null;
}

