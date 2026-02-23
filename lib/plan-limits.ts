// app/lib/plan-limits.ts
export const PLAN_LIMITS = {
  free: { matrixGenerations: 0, maxBrands: 1 },
  // Cseréld le a 'price_...' részt a saját Stripe Price ID-jaidra!
  'price_1SuU0VPyQ1ZjCfjLjOYuHFuW': { matrixGenerations: 2, maxBrands: 2, label: 'basic' },
  'price_1SuU3CPyQ1ZjCfjL5JXGWjq7': { matrixGenerations: 4, maxBrands: 10, label: 'pro' },
};