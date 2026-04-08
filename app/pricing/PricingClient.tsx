"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Info, Sparkles, Zap } from "lucide-react";
import type { PlanMarketingCard } from "@/lib/billing/pricing";
import { SimpleModal } from "@/app/components/ui/SimpleModal";

type CardKey = "free" | "basic" | "pro" | "elite";

function planDetailsCopy(plan: CardKey) {
  switch (plan) {
    case "free":
      return {
        title: "Free plan details",
        who: "Best for exploring the workflow and testing your first few generations.",
        notes: [
          "Includes core modules with starter monthly limits.",
          "Upgrade any time to increase quotas and reduce friction in your weekly cadence.",
        ],
      };
    case "basic":
      return {
        title: "Basic plan details",
        who: "Best for solo creators, small shops, and early-stage teams publishing consistently.",
        notes: [
          "Higher monthly limits than Free across Content, Products, and Audits.",
          "Paid subscription billed monthly via Stripe.",
          "Upgrade to Pro or Elite if you need substantially more volume.",
        ],
      };
    case "pro":
      return {
        title: "Pro plan details",
        who: "Best for teams and businesses scaling weekly output across multiple channels.",
        notes: [
          "High monthly limits across Content, Products, and Audits.",
          "Paid subscription billed monthly via Stripe.",
          "Upgrade to Elite for the highest quotas and premium features.",
        ],
      };
    case "elite":
      return {
        title: "Elite plan details",
        who: "Best for high-volume teams that need maximum capacity and top-tier capabilities.",
        notes: [
          "Highest monthly limits across Content, Products, and Audits.",
          "Includes everything in Pro plus Elite features (for example, Price Intelligence).",
          "Paid subscription billed monthly via Stripe.",
        ],
      };
  }
}

function Card({
  card,
  variant,
  ctaHref,
  ctaLabel,
  badge,
  onDetails,
}: {
  card: PlanMarketingCard;
  variant: "free" | "basic" | "pro" | "elite";
  ctaHref: string;
  ctaLabel: string;
  badge?: { label: string; icon?: React.ReactNode; className: string };
  onDetails: () => void;
}) {
  const header = useMemo(() => {
    if (variant === "pro")
      return {
        eyebrow: "Best value",
        icon: <Sparkles className="h-5 w-5 text-amber-300/90" aria-hidden />,
      };
    if (variant === "elite")
      return {
        eyebrow: "Top tier",
        icon: <BarChart3 className="h-5 w-5 text-amber-200/90" aria-hidden />,
      };
    if (variant === "basic")
      return { eyebrow: "For consistent output", icon: <Zap className="h-5 w-5 text-cyan-200/80" /> };
    return { eyebrow: "Starter", icon: null };
  }, [variant]);

  const sectionClass =
    variant === "pro"
      ? "relative flex flex-col overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-500/[0.12] via-[#0a1628] to-[#050b14] p-8 shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_24px_80px_-12px_rgba(37,99,235,0.35)]"
      : variant === "elite"
        ? "relative flex flex-col overflow-hidden rounded-3xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.12] via-[#0f1218] to-[#050810] p-8 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
        : variant === "basic"
          ? "group relative flex flex-col rounded-3xl border border-white/[0.09] bg-gradient-to-b from-cyan-500/[0.07] via-white/[0.02] to-transparent p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-white/[0.14]"
          : "group relative flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition hover:border-white/[0.12]";

  const checkPill =
    variant === "pro"
      ? "border-blue-400/30 bg-blue-500/20"
      : variant === "elite"
        ? "border-amber-400/30 bg-amber-500/15"
        : variant === "basic"
          ? "border-cyan-400/25 bg-cyan-500/10"
          : "border-emerald-500/20 bg-emerald-500/10";

  const checkIcon =
    variant === "elite"
      ? "text-amber-200"
      : variant === "pro"
        ? "text-blue-200"
        : variant === "basic"
          ? "text-cyan-200"
          : "text-emerald-400";

  const periodTone =
    variant === "pro"
      ? "text-blue-200/60"
      : variant === "elite"
        ? "text-amber-200/50"
        : "text-slate-500";

  return (
    <section className={sectionClass}>
      {badge ? (
        <span className={badge.className}>
          {badge.icon}
          {badge.label}
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              variant === "pro"
                ? "text-blue-300/90"
                : variant === "elite"
                  ? "text-amber-200/80"
                  : variant === "basic"
                    ? "text-cyan-300/80"
                    : "text-slate-500"
            }`}
          >
            {header.eyebrow}
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            {card.name}
            {header.icon}
          </h2>
        </div>
      </div>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-5xl font-black tabular-nums tracking-tight text-white">
          {card.priceLine}
        </span>
        <span className={`text-sm font-medium ${periodTone}`}>/ {card.periodNote}</span>
      </div>

      <ul className="mt-8 flex flex-1 flex-col gap-2.5">
        {card.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[13px] leading-snug text-slate-300">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checkPill}`}>
              <Check className={`h-3 w-3 ${checkIcon}`} strokeWidth={2.5} aria-hidden />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-3">
        <Link
          href={ctaHref}
          className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition ${
            variant === "pro"
              ? "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white ring-1 ring-white/20 hover:brightness-110"
              : variant === "elite"
                ? "bg-gradient-to-r from-amber-500 to-violet-700 text-white ring-1 ring-white/15 hover:brightness-110"
                : variant === "basic"
                  ? "bg-gradient-to-r from-cyan-600/70 via-blue-600/70 to-transparent text-white ring-1 ring-white/15 hover:brightness-110"
                  : "border border-white/10 bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.08]"
          }`}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
        </Link>

        <button
          type="button"
          onClick={onDetails}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-xs font-bold text-slate-200/90 transition hover:bg-white/[0.06]"
        >
          <Info className="h-4 w-4 text-slate-300/70" aria-hidden />
          What’s included
        </button>
      </div>
    </section>
  );
}

export function PricingClient({
  cards,
}: {
  cards: Record<CardKey, PlanMarketingCard>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPlan, setDetailsPlan] = useState<CardKey>("free");

  const openDetails = (p: CardKey) => {
    setDetailsPlan(p);
    setDetailsOpen(true);
  };

  const details = planDetailsCopy(detailsPlan);

  return (
    <>
      <div className="mt-14 grid gap-6 lg:grid-cols-4 lg:gap-6 lg:items-stretch">
        <Card
          card={cards.free}
          variant="free"
          ctaHref="/"
          ctaLabel="Start free"
          onDetails={() => openDetails("free")}
          badge={{
            label: "Forever",
            className:
              "absolute right-8 top-8 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400",
          }}
        />

        <Card
          card={cards.basic}
          variant="basic"
          ctaHref="/dashboard/billing"
          ctaLabel="Upgrade to Basic"
          onDetails={() => openDetails("basic")}
          badge={{
            label: "Basic",
            className:
              "absolute right-8 top-8 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-900/25",
          }}
        />

        <Card
          card={cards.pro}
          variant="pro"
          ctaHref="/dashboard/billing"
          ctaLabel="Upgrade to Pro"
          onDetails={() => openDetails("pro")}
          badge={{
            label: "Popular",
            className:
              "absolute right-8 top-8 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/40",
          }}
        />

        <Card
          card={cards.elite}
          variant="elite"
          ctaHref="/dashboard/billing"
          ctaLabel="Upgrade to Elite"
          onDetails={() => openDetails("elite")}
          badge={{
            label: "Elite",
            className:
              "absolute right-8 top-8 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-900/30",
          }}
        />
      </div>

      <SimpleModal
        title={details.title}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Who it’s for
            </p>
            <p className="mt-2 text-sm font-medium text-slate-200">{details.who}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              What you get
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {details.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
            Limits reset monthly (UTC) and are enforced per workspace.
          </div>
        </div>
      </SimpleModal>
    </>
  );
}

