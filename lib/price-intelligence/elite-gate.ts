import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSubscriptionRow, getUserPlanTier } from "@/lib/usage/usage-service";

/**
 * Price Intelligence is limited to Elite (top) Stripe price id.
 */
export async function assertPriceIntelligenceAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const sub = await fetchSubscriptionRow(supabase, userId);
  const tier = getUserPlanTier(sub);
  if (tier !== "elite") {
    return {
      ok: false,
      status: 403,
      message: "Price Intelligence is available on the Elite plan.",
    };
  }
  return { ok: true };
}
