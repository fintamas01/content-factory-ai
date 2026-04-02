/**
 * Marketing copy and Stripe price allowlist for checkout.
 * Plan limits stay in `lib/plan-config.ts` / usage service.
 */

import { SAAS_LIMITS, type PlanTier } from "@/lib/plan-config";
import {
  envStripePriceIdBasic,
  envStripePriceIdElite,
  envStripePriceIdPro,
} from "@/lib/billing/stripe-price-ids";

/** Display string for Pro monthly price (set in env for marketing accuracy). */
export function getProPriceMonthlyDisplay(): string {
  const v = process.env.NEXT_PUBLIC_PRO_PRICE_MONTHLY?.trim();
  if (v && v.length > 0) return v;
  return "$29";
}

/** Display string for Elite monthly price (marketing; set in env). */
export function getElitePriceMonthlyDisplay(): string {
  const v = process.env.NEXT_PUBLIC_ELITE_PRICE_MONTHLY?.trim();
  if (v && v.length > 0) return v;
  return "$99";
}

export function getStripePriceIdPro(): string {
  return envStripePriceIdPro();
}

export function getStripePriceIdBasic(): string {
  return envStripePriceIdBasic();
}

/** Elite / Agency tier — Price Intelligence and other top-tier features. */
export function getStripePriceIdElite(): string {
  return envStripePriceIdElite();
}

/**
 * Returns allowed Stripe price IDs for subscription checkout (server-side guard).
 */
export function getAllowedCheckoutPriceIds(): string[] {
  const ids = [
    getStripePriceIdPro(),
    getStripePriceIdBasic(),
    getStripePriceIdElite(),
  ].filter((id) => id.length > 0);
  return ids;
}

export function isAllowedCheckoutPriceId(priceId: string): boolean {
  return getAllowedCheckoutPriceIds().includes(priceId);
}

export type PlanMarketingCard = {
  tier: PlanTier;
  name: string;
  priceLine: string;
  periodNote: string;
  bullets: string[];
};

/** Free vs Pro vs Elite cards for pricing / billing (limits from SAAS_LIMITS). */
export function getPlanMarketingCards(): {
  free: PlanMarketingCard;
  pro: PlanMarketingCard;
  elite: PlanMarketingCard;
} {
  const f = SAAS_LIMITS.free;
  const p = SAAS_LIMITS.pro;
  const e = SAAS_LIMITS.elite;
  return {
    free: {
      tier: "free",
      name: "Free",
      priceLine: "$0",
      periodNote: "per month",
      bullets: [
        `${f.content_generations_per_month} content generations / month`,
        `${f.product_generations_per_month} product generations / month`,
        `${f.audits_per_month} site audits / month`,
        "Core modules: Brand, Content, Products, Growth Audit",
      ],
    },
    pro: {
      tier: "pro",
      name: "Pro",
      priceLine: getProPriceMonthlyDisplay(),
      periodNote: "per month",
      bullets: [
        `${p.content_generations_per_month} content generations / month`,
        `${p.product_generations_per_month} product generations / month`,
        `${p.audits_per_month} site audits / month`,
        "Higher quotas across all modules",
        "Priority usage and room to scale",
      ],
    },
    elite: {
      tier: "elite",
      name: "Elite",
      priceLine: getElitePriceMonthlyDisplay(),
      periodNote: "per month",
      bullets: [
        `${e.content_generations_per_month} content generations / month`,
        `${e.product_generations_per_month} product generations / month`,
        `${e.audits_per_month} site audits / month`,
        "Everything in Pro",
        "Price Intelligence — competitor URL tracking & AI pricing briefs",
      ],
    },
  };
}
