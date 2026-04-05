"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, Sparkles } from "lucide-react";
import { isPaidPlanTier, planTierShortLabel } from "@/lib/usage/plan-ui";
import type { UsageSummary } from "@/lib/usage/types";

function Bar({
  label,
  used,
  cap,
  gradient,
}: {
  label: string;
  used: number;
  cap: number;
  gradient: string;
}) {
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-slate-300 dark:text-slate-300">
          {used}/{cap}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] dark:bg-black/30">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} opacity-90`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardUsageOverview() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const data = (await res.json()) as UsageSummary;
        if (!cancelled) setSummary(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  const paid = isPaidPlanTier(summary.plan);
  const u = summary.usage;
  const L = summary.limits;

  return (
    <section
      className="rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-slate-900/50 via-[#0b1220] to-[#070d18] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:from-[#0f172a]/80"
      aria-labelledby="usage-overview-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2
              id="usage-overview-heading"
              className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"
            >
              Usage this month
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {paid ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                    summary.plan === "elite"
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-200"
                  }`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {planTierShortLabel(summary.plan)}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Free
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-500">{summary.monthKey}</span>
            </div>
          </div>
        </div>
        {!paid ? (
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 transition hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-white"
          >
            Upgrade
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <Bar
          label="Content"
          used={u.content}
          cap={L.content_generations_per_month}
          gradient="from-blue-500 to-cyan-400"
        />
        <Bar
          label="Products"
          used={u.product}
          cap={L.product_generations_per_month}
          gradient="from-violet-500 to-fuchsia-500"
        />
        <Bar
          label="Site audits"
          used={u.audit}
          cap={L.audits_per_month}
          gradient="from-emerald-500 to-teal-400"
        />
      </div>

      {!paid ? (
        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-500">
          Pro includes much higher monthly quotas across all modules.{" "}
          <Link href="/dashboard/billing" className="font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-200">
            See details
          </Link>
        </p>
      ) : (
        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[11px] text-slate-500 dark:text-slate-500">
          Manage billing anytime from{" "}
          <Link href="/dashboard/billing" className="font-semibold text-slate-400 hover:text-slate-200">
            Billing
          </Link>
          .
        </p>
      )}
    </section>
  );
}
