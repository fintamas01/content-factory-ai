import { Suspense } from "react";
import { CreditCard } from "lucide-react";
import { BillingDashboardClient } from "@/app/components/billing/BillingDashboardClient";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Spinner } from "@/app/components/ui/Spinner";

function BillingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <Spinner className="h-10 w-10" />
    </div>
  );
}

export default function DashboardBillingPage() {
  return (
    <Page>
      <PageHero
        icon={<CreditCard className="h-6 w-6" aria-hidden />}
        eyebrow="Billing"
        title="Plans & usage"
        description="Upgrade, manage subscription, and track your monthly allowances across modules."
      />
      <Suspense fallback={<BillingFallback />}>
        <BillingDashboardClient />
      </Suspense>
    </Page>
  );
}
