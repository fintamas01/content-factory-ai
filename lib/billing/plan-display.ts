import {
  resolvePlanTier,
  type SubscriptionRow,
} from "@/lib/plan-config";
import { getStripePriceIdBasic, getStripePriceIdPro } from "@/lib/billing/pricing";

/**
 * Short label for UI: Free vs paid product name from Stripe price id.
 */
export function subscriptionPlanLabel(
  sub: SubscriptionRow | null | undefined
): "Free" | "Pro" | "Basic" {
  if (!sub || sub.status !== "active") return "Free";
  const pid = sub.price_id?.trim() ?? "";
  const pro = getStripePriceIdPro();
  const basic = getStripePriceIdBasic();
  if (pid && pid === pro) return "Pro";
  if (pid && pid === basic) return "Basic";
  if (resolvePlanTier(sub) === "pro") return "Pro";
  return "Free";
}
