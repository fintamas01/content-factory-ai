import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard/billing` — kept for bookmarks. */
export default function LegacyBillingRedirect() {
  redirect("/dashboard/billing");
}
