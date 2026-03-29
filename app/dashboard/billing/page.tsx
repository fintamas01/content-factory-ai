import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BillingDashboardClient } from "@/app/components/billing/BillingDashboardClient";

function BillingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#030712] p-8">
      <Loader2 className="h-10 w-10 animate-spin text-blue-400" aria-hidden />
    </div>
  );
}

export default function DashboardBillingPage() {
  return (
    <div className="relative min-h-full w-full bg-[#030712] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.14),transparent)]"
        aria-hidden
      />
      <div className="relative p-6 md:p-8 lg:p-10">
        <Suspense fallback={<BillingFallback />}>
          <BillingDashboardClient />
        </Suspense>
      </div>
    </div>
  );
}
