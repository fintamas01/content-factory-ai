"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { SimpleModal } from "@/app/components/ui/SimpleModal";
import { FEATURES, type FeatureKey } from "@/lib/entitlements/features";
import type { PlanTier } from "@/lib/plan-config";

function planLabel(p: PlanTier): string {
  if (p === "elite") return "Elite";
  if (p === "pro") return "Pro";
  if (p === "basic") return "Basic";
  return "Free";
}

export function UpgradeAccessModal({
  featureKey,
  open,
  onClose,
  currentPlan,
}: {
  featureKey: FeatureKey;
  open: boolean;
  onClose: () => void;
  currentPlan: PlanTier;
}) {
  const f = FEATURES[featureKey];
  const required = f.minPlan;
  const requiredLabel = planLabel(required);
  const cta = required === "elite" ? "Upgrade to Elite" : required === "pro" ? "Upgrade to Pro" : "Upgrade to Basic";

  return (
    <SimpleModal title="Upgrade required" open={open} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Locked feature
            </p>
            <p className="mt-2 text-base font-black tracking-tight text-white">{f.label}</p>
            <p className="mt-2 text-sm text-slate-300">{f.description}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Your plan
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">{planLabel(currentPlan)}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Required plan
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">{requiredLabel} or higher</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
          >
            Not now
          </button>
          <Link
            href={`/dashboard/billing?upgrade=${encodeURIComponent(required)}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 text-sm font-black text-white shadow-[0_8px_28px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/15 transition hover:brightness-110 active:scale-[0.99]"
          >
            {cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </SimpleModal>
  );
}

