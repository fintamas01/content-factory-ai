"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

type Step = {
  key: "brand" | "firstAction" | "complete";
  label: string;
};

const STEPS: Step[] = [
  { key: "brand", label: "Brand" },
  { key: "firstAction", label: "First win" },
  { key: "complete", label: "Finish" },
];

export function OnboardingShell({
  step,
  title,
  subtitle,
  backHref,
  children,
}: {
  step: Step["key"];
  title: string;
  subtitle: string;
  backHref?: string;
  children: ReactNode;
}) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const current = idx >= 0 ? idx + 1 : 1;
  const total = STEPS.length;
  const progressPct = Math.round((current / total) * 100);

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

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-5 pb-14 pt-10 md:px-8 md:pb-16 md:pt-14">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
              Onboarding
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {PLATFORM_DISPLAY_NAME}
            </p>
          </div>

          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4 opacity-80" aria-hidden />
              Back
            </Link>
          ) : null}
        </header>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Step {current}/{total}
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {subtitle}
              </p>
            </div>

            <div className="w-full md:w-[280px]">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-90"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <ol className="mt-3 flex items-center justify-between gap-2">
                {STEPS.map((s, i) => {
                  const done = i < idx;
                  const active = s.key === step;
                  return (
                    <li
                      key={s.key}
                      className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition ${
                        active
                          ? "border border-blue-400/35 bg-blue-500/15 text-blue-100"
                          : "border border-white/10 bg-white/[0.03] text-slate-500"
                      }`}
                    >
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                          done
                            ? "bg-emerald-500/15 text-emerald-300"
                            : active
                              ? "bg-blue-500/20 text-blue-200"
                              : "bg-white/[0.04] text-slate-500"
                        }`}
                        aria-hidden
                      >
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      {s.label}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="mt-7">{children}</div>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-slate-600">
          Fast setup. Real outputs. You can refine everything later.
        </p>

        <p className="mt-4 text-center text-[11px] font-medium text-slate-600">
          <Link href="/privacy" className="text-slate-500 underline-offset-2 hover:text-slate-400">
            Privacy
          </Link>
          <span className="mx-1.5 text-slate-700" aria-hidden>
            ·
          </span>
          <Link href="/terms" className="text-slate-500 underline-offset-2 hover:text-slate-400">
            Terms
          </Link>
          <span className="mx-1.5 text-slate-700" aria-hidden>
            ·
          </span>
          <Link href="/pricing" className="text-slate-500 underline-offset-2 hover:text-slate-400">
            Pricing
          </Link>
        </p>
      </div>
    </div>
  );
}

