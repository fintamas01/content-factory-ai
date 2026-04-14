/**
 * Single source of truth for SaaS plan tiers and monthly usage limits.
 * Paid tier is derived from `subscriptions.price_id` (Stripe) via env price IDs.
 */

import {
  envStripePriceIdBasic,
  envStripePriceIdElite,
  envStripePriceIdPro,
} from "@/lib/billing/stripe-price-ids";
import { isAdminEmail } from "@/lib/auth/is-admin";

export type PlanTier = "free" | "basic" | "pro" | "elite";

export type SaasMonthlyLimits = {
  content_generations_per_month: number;
  product_generations_per_month: number;
  audits_per_month: number;
};

/** Logical limits per tier (not tied to Stripe product ids). */
export const SAAS_LIMITS: Record<PlanTier, SaasMonthlyLimits> = {
  free: {
    content_generations_per_month: 3,
    product_generations_per_month: 3,
    audits_per_month: 3,
  },
  basic: {
    content_generations_per_month: 10,
    product_generations_per_month: 10,
    audits_per_month: 5,
  },
  pro: {
    content_generations_per_month: 50,
    product_generations_per_month: 50,
    audits_per_month: 30,
  },
  elite: {
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
    basic: envStripePriceIdBasic(),
    pro: envStripePriceIdPro(),
    elite: envStripePriceIdElite(),
  };
}

/**
 * Resolve plan tier for usage limits.
 * - Active subscription with Elite Stripe price → elite (highest quotas + Elite features).
 * - Active Pro → pro.
 * - Active Basic → basic.
 * - Otherwise → free.
 */
export function resolvePlanTier(sub: SubscriptionRow | null | undefined): PlanTier {
  if (!sub || sub.status !== "active") return "free";
  const { basic, pro, elite } = getStripePriceIds();
  const pid = sub.price_id?.trim() ?? "";
  if (!pid) return "free";
  if (elite && pid === elite) return "elite";
  if (pro && pid === pro) return "pro";
  if (basic && pid === basic) return "basic";
  console.warn(
    "[billing] Active subscription price_id does not match NEXT_PUBLIC_STRIPE_PRICE_* env vars; treating plan as free. price_id=",
    pid
  );
  return "free";
}

/**
 * Resolve the *effective* plan tier for access/limits.
 * Admin/owner accounts are always treated as Elite (override) without touching billing rows.
 */
export function resolveEffectivePlanTier(
  sub: SubscriptionRow | null | undefined,
  userEmail?: string | null
): PlanTier {
  if (isAdminEmail(userEmail)) return "elite";
  return resolvePlanTier(sub);
}

export function getSaasLimitsForTier(tier: PlanTier): SaasMonthlyLimits {
  return SAAS_LIMITS[tier];
}
