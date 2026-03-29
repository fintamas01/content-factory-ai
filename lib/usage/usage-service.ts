import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSaasLimitsForTier,
  resolvePlanTier,
  type PlanTier,
  type SubscriptionRow,
} from "@/lib/plan-config";
import type {
  MonthlyUsageCounts,
  UsageCheckResult,
  UsageFeature,
  UsageSummary,
} from "./types";

export function getCurrentMonthKeyUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function emptyUsage(): MonthlyUsageCounts {
  return { content: 0, product: 0, audit: 0 };
}

export async function fetchSubscriptionRow(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, status, price_id, stripe_subscription_id, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("subscriptions fetch:", error);
    return null;
  }
  return data as SubscriptionRow | null;
}

export function getUserPlanTier(subscription: SubscriptionRow | null): PlanTier {
  return resolvePlanTier(subscription);
}

/** Resolved tier for a user (reads `subscriptions` row). */
export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanTier> {
  const sub = await fetchSubscriptionRow(supabase, userId);
  return resolvePlanTier(sub);
}

type UsageRow = {
  content_count: number;
  product_count: number;
  audit_count: number;
};

export async function getCurrentUsage(
  supabase: SupabaseClient,
  userId: string,
  monthKey: string
): Promise<MonthlyUsageCounts> {
  const { data, error } = await supabase
    .from("monthly_usage")
    .select("content_count, product_count, audit_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    console.error("monthly_usage fetch:", error);
    return emptyUsage();
  }
  if (!data) return emptyUsage();
  const r = data as UsageRow;
  return {
    content: r.content_count ?? 0,
    product: r.product_count ?? 0,
    audit: r.audit_count ?? 0,
  };
}

function countForFeature(u: MonthlyUsageCounts, feature: UsageFeature): number {
  if (feature === "content") return u.content;
  if (feature === "product") return u.product;
  return u.audit;
}

function limitForFeature(
  limits: ReturnType<typeof getSaasLimitsForTier>,
  feature: UsageFeature
): number {
  if (feature === "content") return limits.content_generations_per_month;
  if (feature === "product") return limits.product_generations_per_month;
  return limits.audits_per_month;
}

export async function buildUsageSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageSummary> {
  const monthKey = getCurrentMonthKeyUtc();
  const sub = await fetchSubscriptionRow(supabase, userId);
  const plan = getUserPlanTier(sub);
  const limits = getSaasLimitsForTier(plan);
  const usage = await getCurrentUsage(supabase, userId, monthKey);
  return { monthKey, plan, limits, usage };
}

export async function canUseFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: UsageFeature
): Promise<UsageCheckResult> {
  const summary = await buildUsageSummary(supabase, userId);
  const used = countForFeature(summary.usage, feature);
  const cap = limitForFeature(summary.limits, feature);
  if (used >= cap) {
    return {
      allowed: false,
      summary,
      message:
        feature === "content"
          ? "Monthly content generation limit reached."
          : feature === "product"
            ? "Monthly product generation limit reached."
            : "Monthly site audit limit reached.",
    };
  }
  return { allowed: true, summary };
}

export async function incrementUsage(
  supabase: SupabaseClient,
  feature: UsageFeature
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("increment_monthly_usage", {
    p_feature: feature,
  });
  if (error) {
    console.error("increment_monthly_usage:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
