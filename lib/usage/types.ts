import type { PlanTier, SaasMonthlyLimits } from "@/lib/plan-config";

export type UsageFeature = "content" | "product" | "audit";

export type MonthlyUsageCounts = {
  content: number;
  product: number;
  audit: number;
};

export type UsageSummary = {
  monthKey: string;
  plan: PlanTier;
  limits: SaasMonthlyLimits;
  usage: MonthlyUsageCounts;
};

export type UsageCheckResult =
  | {
      allowed: true;
      summary: UsageSummary;
    }
  | {
      allowed: false;
      summary: UsageSummary;
      message: string;
    };
