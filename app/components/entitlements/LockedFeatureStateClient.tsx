"use client";

import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements/features";
import { FEATURES } from "@/lib/entitlements/features";
import type { PlanTier } from "@/lib/plan-config";

function planLabel(p: PlanTier): string {
  if (p === "elite") return "Elite";
  if (p === "pro") return "Pro";
  if (p === "basic") return "Basic";
  return "Free";
}

export function LockedFeatureStateClient({
  featureKey,
  currentPlan = "free",
}: {
  featureKey: FeatureKey;
  currentPlan?: PlanTier;
}) {
  const f = FEATURES[featureKey];
  const required = f.minPlan;
  const requiredLabel = planLabel(required);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/85">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Upgrade required
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{f.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.description}</p>
          <p className="mt-4 text-xs font-medium text-slate-400">
            Your plan: <span className="font-semibold text-slate-200">{planLabel(currentPlan)}</span> ·
            Required: <span className="font-semibold text-slate-200">{requiredLabel}+</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/billing?upgrade=${encodeURIComponent(required)}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 text-sm font-black text-white ring-1 ring-white/15 transition hover:brightness-110"
            >
              Upgrade to {requiredLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

