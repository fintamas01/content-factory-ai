import Link from "next/link";
import { ArrowRight, Check, Sparkles, Zap } from "lucide-react";
import { getPlanMarketingCards } from "@/lib/billing/pricing";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

export const metadata = {
  title: `Pricing — ${PLATFORM_DISPLAY_NAME}`,
  description: "Free and Pro plans with clear monthly limits.",
};

export default function PricingPage() {
  const { free, pro } = getPlanMarketingCards();

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

      <div className="relative mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-24">
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
            Start free. Move to Pro when you need higher monthly limits across every module.
          </p>
        </header>

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
          {/* Free */}
          <section className="group relative flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-white/[0.12]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Starter
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{free.name}</h2>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Forever
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-5xl font-black tabular-nums tracking-tight text-white">
                {free.priceLine}
              </span>
              <span className="text-sm font-medium text-slate-500">/ {free.periodNote}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Best for trying the full workflow.</p>

            <ul className="mt-8 flex flex-1 flex-col gap-2.5">
              {free.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-[13px] leading-snug text-slate-300"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10">
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <Link
              href="/"
              className="mt-10 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Start free
              <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </section>

          {/* Pro — primary */}
          <section className="relative flex flex-col overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-500/[0.12] via-[#0a1628] to-[#050b14] p-8 shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_24px_80px_-12px_rgba(37,99,235,0.35)]">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300/90">
                  Best value
                </p>
                <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
                  {pro.name}
                  <Sparkles className="h-5 w-5 text-amber-300/90" aria-hidden />
                </h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/40">
                <Zap className="h-3 w-3" aria-hidden />
                Pro
              </span>
            </div>

            <div className="relative mt-6 flex items-baseline gap-1.5">
              <span className="text-5xl font-black tabular-nums tracking-tight text-white">
                {pro.priceLine}
              </span>
              <span className="text-sm font-medium text-blue-200/60">/ {pro.periodNote}</span>
            </div>
            <p className="relative mt-2 text-xs text-blue-100/50">
              Full monthly quotas · Secure Stripe checkout
            </p>

            <ul className="relative mt-8 flex flex-1 flex-col gap-2.5">
              {pro.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-[13px] leading-snug text-blue-50/90"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-blue-400/30 bg-blue-500/20">
                    <Check className="h-3 w-3 text-blue-200" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <div className="relative mt-10 space-y-3">
              <Link
                href="/dashboard/billing"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-[15px] font-black text-white shadow-[0_8px_32px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/20 transition hover:brightness-110 active:scale-[0.99]"
              >
                Upgrade to Pro
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="text-center text-[11px] font-medium text-blue-200/45">
                Sign in required · Cancel anytime from billing
              </p>
            </div>
          </section>
        </div>

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
