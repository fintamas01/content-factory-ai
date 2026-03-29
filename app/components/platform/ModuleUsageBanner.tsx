"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { UsageSummary } from "@/lib/usage/types";

type Feature = "content" | "product" | "audit";

const ACCENT: Record<
  Feature,
  { bar: string; glow: string; label: string }
> = {
  content: {
    bar: "from-blue-500 to-cyan-400",
    glow: "shadow-[0_0_20px_-4px_rgba(59,130,246,0.45)]",
    label: "Content",
  },
  product: {
    bar: "from-violet-500 to-fuchsia-500",
    glow: "shadow-[0_0_20px_-4px_rgba(139,92,246,0.4)]",
    label: "Products",
  },
  audit: {
    bar: "from-emerald-500 to-teal-400",
    glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]",
    label: "Site audit",
  },
};

function pick(
  s: UsageSummary,
  feature: Feature
): { used: number; cap: number } {
  if (feature === "content") {
    return { used: s.usage.content, cap: s.limits.content_generations_per_month };
  }
  if (feature === "product") {
    return {
      used: s.usage.product,
      cap: s.limits.product_generations_per_month,
    };
  }
  return { used: s.usage.audit, cap: s.limits.audits_per_month };
}

function MiniCounter({
  label,
  used,
  cap,
  dim,
}: {
  label: string;
  used: number;
  cap: number;
  dim?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-lg px-2 py-1 font-mono text-[11px] tabular-nums ${
        dim
          ? "text-slate-500 dark:text-slate-500"
          : "bg-white/[0.06] text-slate-200 dark:text-slate-300"
      }`}
    >
      <span className="font-semibold text-slate-400 dark:text-slate-500">{label}</span>
      <span>
        {used}/{cap}
      </span>
    </span>
  );
}

export function ModuleUsageBanner({
  feature,
  bump = 0,
}: {
  feature: Feature;
  bump?: number;
}) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const data = (await res.json()) as UsageSummary;
        if (!cancelled) setSummary(data);
      } catch {
        setHidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bump]);

  if (hidden || !summary) return null;

  const accent = ACCENT[feature];
  const { used, cap } = pick(summary, feature);
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;
  const pct = Math.round(ratio * 100);
  const atLimit = used >= cap;
  const warn = !atLimit && ratio >= 0.8;
  const isPro = summary.plan === "pro";

  const u = summary.usage;
  const L = summary.limits;

  return (
    <div
      className={`relative mb-6 overflow-hidden rounded-[20px] border transition-colors ${
        atLimit
          ? "border-rose-500/25 bg-gradient-to-br from-rose-950/40 via-[#0b1220] to-[#070d18] dark:from-rose-950/30"
          : warn
            ? "border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-[#0b1220] to-[#070d18] dark:from-amber-950/20"
            : "border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-[#0b1220] to-[#070d18] dark:from-[#0f172a]/90"
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/[0.07]" />
      <div className="relative p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">
              Plan & usage
            </span>
            {isPro ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/35 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-300 dark:text-blue-200">
                <Sparkles className="h-3 w-3 text-blue-400" aria-hidden />
                Pro
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">
                Free
              </span>
            )}
          </div>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500">
            Month <span className="font-mono text-slate-400">{summary.monthKey}</span>
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-end justify-between gap-2">
            <p className="text-sm font-bold text-slate-200 dark:text-slate-100">
              {accent.label}{" "}
              <span className="font-mono text-base font-black tabular-nums text-white">
                {used}
              </span>
              <span className="text-slate-500 dark:text-slate-500"> / {cap}</span>
            </p>
            <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-500">
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06] dark:bg-black/40">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${accent.bar} ${accent.glow} transition-[width] duration-500 ease-out`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-4 dark:border-white/[0.06]">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            All modules
          </span>
          <MiniCounter
            label="Content"
            used={u.content}
            cap={L.content_generations_per_month}
            dim={feature !== "content"}
          />
          <MiniCounter
            label="Products"
            used={u.product}
            cap={L.product_generations_per_month}
            dim={feature !== "product"}
          />
          <MiniCounter
            label="Audits"
            used={u.audit}
            cap={L.audits_per_month}
            dim={feature !== "audit"}
          />
        </div>

        {atLimit ? (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium leading-snug text-slate-300 dark:text-slate-300">
              This module&apos;s monthly allowance is used. Upgrade for higher limits, or try again
              next month.
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-900 transition hover:bg-slate-100 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
            >
              View plans
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : warn ? (
          <p className="mt-4 text-xs font-medium leading-relaxed text-amber-200/90 dark:text-amber-200/80">
            You&apos;re nearing this module&apos;s limit.{" "}
            <Link
              href="/dashboard/billing"
              className="font-bold text-amber-100 underline decoration-amber-500/50 underline-offset-2 transition hover:text-white dark:text-amber-50"
            >
              Upgrade
            </Link>{" "}
            for more headroom.
          </p>
        ) : !isPro ? (
          <p className="mt-4 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-500">
            On Free, limits reset each calendar month.{" "}
            <Link
              href="/dashboard/billing"
              className="font-semibold text-slate-400 underline decoration-white/10 underline-offset-2 transition hover:text-slate-200 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Compare Pro
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
