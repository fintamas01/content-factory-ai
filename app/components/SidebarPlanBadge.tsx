"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { isPaidPlanTier, planTierShortLabel } from "@/lib/usage/plan-ui";
import type { UsageSummary } from "@/lib/usage/types";

/**
 * Compact plan indicator for the shell (Free / Pro / Elite from `/api/usage`).
 */
export function SidebarPlanBadge() {
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
  const elite = summary.plan === "elite";

  return (
    <div className="px-4 pb-2">
      <div
        className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[9px] font-black uppercase tracking-widest ${
          paid
            ? elite
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-blue-500/30 bg-blue-500/10 text-blue-200"
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
        }`}
      >
        {paid ? <Sparkles className="h-3 w-3 shrink-0" aria-hidden /> : null}
        {planTierShortLabel(summary.plan)}
      </div>
    </div>
  );
}
