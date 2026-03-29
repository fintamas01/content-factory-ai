/**
 * Single source of truth for SaaS plan tiers and monthly usage limits.
 * Paid tier is derived from `subscriptions.price_id` (Stripe) via env price IDs.
 */

export type PlanTier = "free" | "pro";

export type SaasMonthlyLimits = {
  content_generations_per_month: number;
  product_generations_per_month: number;
  audits_per_month: number;
};

/** Logical limits per tier (not tied to Stripe product ids). */
export const SAAS_LIMITS: Record<PlanTier, SaasMonthlyLimits> = {
  free: {
    content_generations_per_month: 10,
    product_generations_per_month: 10,
    audits_per_month: 5,
  },
  pro: {
    content_generations_per_month: 500,
    product_generations_per_month: 500,
    audits_per_month: 100,
  },
};

export type SubscriptionRow = {
  user_id?: string;
  status?: string | null;
  price_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
};

function getStripePriceIds() {
  return {
    basic: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC?.trim() ?? "",
    pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO?.trim() ?? "",
  };
}

/**
 * Resolve plan tier for usage limits.
 * - Active subscription with Basic or Pro Stripe price → pro limits (MVP: both paid tiers share high quotas).
 * - Otherwise → free.
 * Stripe webhook already stores `price_id` on `subscriptions`; no schema change required.
 */
export function resolvePlanTier(sub: SubscriptionRow | null | undefined): PlanTier {
  if (!sub || sub.status !== "active") return "free";
  const { basic, pro } = getStripePriceIds();
  const pid = sub.price_id?.trim() ?? "";
  if (!pid) return "free";
  if (pid === pro || pid === basic) return "pro";
  return "free";
}

export function getSaasLimitsForTier(tier: PlanTier): SaasMonthlyLimits {
  return SAAS_LIMITS[tier];
}
