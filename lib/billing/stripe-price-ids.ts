/**
 * Stripe subscription Price IDs from environment.
 * Prefer NEXT_PUBLIC_* (inlined for the browser bundle); fall back to STRIPE_PRICE_*
 * so server routes work when only server-side env is set (common on Vercel).
 */
function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

export function envStripePriceIdBasic(): string {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
    process.env.STRIPE_PRICE_BASIC
  );
}

export function envStripePriceIdPro(): string {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_PRO
  );
}

export function envStripePriceIdElite(): string {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE,
    process.env.STRIPE_PRICE_ELITE
  );
}
