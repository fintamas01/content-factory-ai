import type { PlanTier } from "@/lib/plan-config";

/** Basic, Pro, or Elite — paid tiers with higher quotas than Free. */
export function isPaidPlanTier(plan: PlanTier): boolean {
  return plan === "basic" || plan === "pro" || plan === "elite";
}

export function planTierShortLabel(plan: PlanTier): string {
  switch (plan) {
    case "elite":
      return "Elite";
    case "basic":
      return "Basic";
    case "pro":
      return "Pro";
    default:
      return "Free";
  }
}

/** Tones supported by dashboard KPI cards and similar components. */
export type PlanKpiTone =
  | "emerald"
  | "blue"
  | "violet"
  | "amber"
  | "zinc";

export function planTierKpiTone(plan: PlanTier): PlanKpiTone {
  if (plan === "elite") return "amber";
  if (plan === "pro") return "violet";
  if (plan === "basic") return "blue";
  return "zinc";
}
