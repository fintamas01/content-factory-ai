import {
  resolvePlanTier,
  type SubscriptionRow,
} from "@/lib/plan-config";
import {
  getStripePriceIdBasic,
  getStripePriceIdElite,
  getStripePriceIdPro,
} from "@/lib/billing/pricing";

/**
 * Short label for UI: Free vs paid product name from Stripe price id.
 */
export function subscriptionPlanLabel(
  sub: SubscriptionRow | null | undefined
): "Free" | "Pro" | "Basic" | "Elite" {
  if (!sub || sub.status !== "active") return "Free";
  const pid = sub.price_id?.trim() ?? "";
  const pro = getStripePriceIdPro();
  const basic = getStripePriceIdBasic();
  const elite = getStripePriceIdElite();
  if (elite && pid === elite) return "Elite";
  if (pid && pid === pro) return "Pro";
  if (pid && pid === basic) return "Basic";
  if (resolvePlanTier(sub) === "elite") return "Elite";
  if (resolvePlanTier(sub) === "pro") return "Pro";
  return "Free";
}
