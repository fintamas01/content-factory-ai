import Link from "next/link";
import { getPlanMarketingCards } from "@/lib/billing/pricing";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { PricingClient } from "@/app/pricing/PricingClient";

export const metadata = {
  title: `Pricing — ${PLATFORM_DISPLAY_NAME}`,
  description:
    "Free, Basic, Pro, and Elite plans with clear monthly limits for content, products, and audits.",
};

export default function PricingPage() {
  const { free, basic, pro, elite } = getPlanMarketingCards();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.22),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[90px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <header className="text-center md:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
            Plans built to scale{" "}
            <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">
              with you
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-slate-400 md:mx-0">
            Start free. Upgrade when you need higher monthly limits across every module.
          </p>
        </header>

        <PricingClient cards={{ free, basic, pro, elite }} />

        <footer className="mt-16 border-t border-white/[0.06] pt-8 text-xs text-slate-600">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-slate-500">{PLATFORM_DISPLAY_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/" className="hover:text-slate-400">
                Home
              </Link>
              <Link href="/privacy" className="hover:text-slate-400">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-slate-400">
                Terms
              </Link>
              <Link href="/dashboard/billing" className="hover:text-slate-400">
                Billing
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
