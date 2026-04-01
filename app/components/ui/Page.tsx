"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl space-y-8 pb-24 p-4 sm:p-6 lg:p-8 text-white", className)}>
      {children}
    </div>
  );
}

export function PageHero({
  icon,
  eyebrow,
  title,
  description,
  right,
  className,
}: {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("cf-hero rounded-[28px] p-6 sm:p-8", className)}>
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-2 flex items-start gap-4">
            {icon ? (
              <div className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent" />
                <div className="relative text-cyan-200">{icon}</div>
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[34px]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {right ? <div className="relative shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}

