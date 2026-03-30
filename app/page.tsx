import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Megaphone,
  Package,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { getPlanMarketingCards } from "@/lib/billing/pricing";
import { StartFreeButton } from "@/app/components/marketing/StartFreeButton";

const modules = [
  {
    icon: BarChart3,
    title: "AI Growth Audit",
    description:
      "Find quick wins on pages, SEO, and conversion—then turn them into an action plan.",
  },
  {
    icon: Megaphone,
    title: "Content Generator",
    description:
      "Ship campaign-ready posts in minutes with consistent quality and faster iteration.",
  },
  {
    icon: Package,
    title: "Product Generator",
    description:
      "Turn product specs into high-converting descriptions, bullets, and SEO copy—at scale.",
  },
  {
    icon: Target,
    title: "Brand Profile",
    description:
      "Keep your voice consistent across every module, channel, and generation.",
  },
] as const;

const howItWorks = [
  {
    title: "Add your brand",
    description: "Save your positioning, audience, and tone once.",
  },
  {
    title: "Generate or audit",
    description: "Create content, product copy, or run a growth audit in seconds.",
  },
  {
    title: "Grow with focus",
    description: "Use the outputs to publish faster, rank better, and convert more.",
  },
] as const;

export default function HomePage() {
  const { free, pro } = getPlanMarketingCards();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-blue-600/14 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[90px]"
        aria-hidden
      />

      {/* HERO */}
      <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <header className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/80">
            <Sparkles className="h-4 w-4 text-amber-200/90" aria-hidden />
            One workspace for content, products, and growth
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Grow your business with{" "}
            <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">
              AI-powered execution
            </span>
            .
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-400 md:mx-0 md:text-base">
            Stop juggling tools. Create better content, stronger product pages, and clear
            growth actions—faster than your competitors.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-start gap-3 sm:flex-row sm:items-center">
            <StartFreeButton />
            <Link
              href="#features"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              See features
              <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              <Zap className="h-3.5 w-3.5 text-blue-300" aria-hidden />
              Start Free in 1 minute
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Built for real outputs, not prompts
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
              Upgrade anytime
            </span>
          </div>
        </header>

        {/* PROBLEM -> SOLUTION */}
        <section className="mt-16 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              The problem
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Growth feels chaotic.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Teams lose momentum across content, SEO, product pages, and audits—because
              everything lives in different tools and workflows. The result: slow output,
              inconsistent quality, and missed opportunities.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-blue-500/35 bg-gradient-to-br from-blue-500/[0.10] via-[#0a1628] to-[#050b14] p-8 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl"
              aria-hidden
            />
            <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/70">
              The solution
            </p>
            <h2 className="relative mt-3 text-2xl font-bold tracking-tight text-white">
              One AI platform to execute.
            </h2>
            <p className="relative mt-3 text-sm leading-relaxed text-blue-50/80">
              Add your brand once. Then generate content, product copy, and growth audits
              that actually ship—aligned to your voice and limited by clean monthly quotas.
            </p>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mt-16 md:mt-24">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
                Features
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Everything you need to publish, rank, and convert.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                Four modules that work together—so every output compounds.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              Explore dashboard
              <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition hover:border-white/[0.12]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-blue-200">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{m.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        {m.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-16 md:mt-24">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            Three steps to consistent growth.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {howItWorks.map((s, idx) => (
              <div
                key={s.title}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] font-mono text-sm font-bold text-slate-200">
                  {idx + 1}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="mt-16 md:mt-24">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
            Social proof
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            Results teams can feel.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Swap these placeholders with real testimonials when you’re ready.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                quote:
                  "“We went from ‘ideas’ to publish-ready content in one afternoon.”",
                who: "Marketing lead · Placeholder",
              },
              {
                quote:
                  "“The audit surfaced quick wins we had missed for months.”",
                who: "Founder · Placeholder",
              },
              {
                quote:
                  "“Our product pages finally sound consistent and convert better.”",
                who: "Ecommerce manager · Placeholder",
              },
            ].map((t) => (
              <figure
                key={t.quote}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7"
              >
                <p className="text-sm leading-relaxed text-slate-200">{t.quote}</p>
                <figcaption className="mt-4 text-xs font-semibold text-slate-500">
                  {t.who}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* PRICING PREVIEW */}
        <section className="mt-16 md:mt-24">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
                Pricing
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Start free. Upgrade when it pays for itself.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                Free is perfect to validate your workflow. Pro unlocks higher monthly
                quotas across every module.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              View full pricing
              <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {free.name}
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">{free.priceLine}</span>
                <span className="text-sm text-slate-500">/ {free.periodNote}</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {free.bullets.slice(0, 3).map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-400" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <StartFreeButton variant="secondary" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-blue-500/35 bg-gradient-to-br from-blue-500/[0.10] via-[#0a1628] to-[#050b14] p-8 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]">
              <div className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                Pro
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/80">
                {pro.name}
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">{pro.priceLine}</span>
                <span className="text-sm text-blue-200/60">/ {pro.periodNote}</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {pro.bullets.slice(0, 4).map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-blue-50/90">
                    <Check className="mt-0.5 h-4 w-4 text-blue-200" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/billing"
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-sm font-black text-white shadow-lg shadow-blue-900/40 transition hover:brightness-110"
              >
                Upgrade to Pro
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mt-16 md:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0f172a]/80 via-[#0a0f1a] to-[#050810] p-10 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] md:p-12">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
                Ready?
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                Start free. Get your first wins today.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                {PLATFORM_DISPLAY_NAME} is designed for execution: publish faster, improve pages,
                and keep quality consistent as you scale.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartFreeButton />
                <Link
                  href="/pricing"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  See pricing
                  <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
                </Link>
              </div>
              <p className="mt-6 text-xs font-medium text-slate-500">
                No credit card needed to start · Upgrade only when you hit the limits
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-white/[0.06] pt-8 text-xs text-slate-600">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-slate-500">{PLATFORM_DISPLAY_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/pricing" className="hover:text-slate-400">
                Pricing
              </Link>
              <Link href="/dashboard" className="hover:text-slate-400">
                Dashboard
              </Link>
              <Link href="/dashboard/billing" className="hover:text-slate-400">
                Billing
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}