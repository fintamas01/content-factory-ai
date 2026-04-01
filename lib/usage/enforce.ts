import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canUseFeature } from "./usage-service";
import type { UsageFeature } from "./types";

export type UsageLimitBody = {
  error: string;
  code: "USAGE_LIMIT";
  feature: UsageFeature;
  plan: string;
  limits: Record<string, number>;
  usage: { content: number; product: number; audit: number };
  monthKey: string;
};

/**
 * Returns a 429 response if the user may not run the feature; otherwise null.
 * Call after auth, before any expensive AI work.
 */
export async function enforceUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  feature: UsageFeature,
  clientId: string
): Promise<NextResponse | null> {
  const check = await canUseFeature(supabase, userId, feature, clientId);
  if (check.allowed) return null;

  const s = check.summary;
  const body: UsageLimitBody = {
    error: check.message,
    code: "USAGE_LIMIT",
    feature,
    plan: s.plan,
    limits: {
      content: s.limits.content_generations_per_month,
      product: s.limits.product_generations_per_month,
      audit: s.limits.audits_per_month,
    },
    usage: s.usage,
    monthKey: s.monthKey,
  };
  return NextResponse.json(body, { status: 429 });
}
