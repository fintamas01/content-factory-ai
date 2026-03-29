// Legacy Smart Matrix limits keyed by Stripe price id (see env NEXT_PUBLIC_STRIPE_PRICE_*).
// SaaS monthly quotas for Content / Products / Site audit live in `lib/plan-config.ts`.
export const PLAN_LIMITS = {
  free: { matrixGenerations: 0, maxBrands: 1 },
  // Cseréld le a 'price_...' részt a saját Stripe Price ID-jaidra!
  'price_1SuU0VPyQ1ZjCfjLjOYuHFuW': { matrixGenerations: 2, maxBrands: 2, label: 'basic' },
  'price_1SuU3CPyQ1ZjCfjL5JXGWjq7': { matrixGenerations: 4, maxBrands: 10, label: 'pro' },
};