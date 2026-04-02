"use client";

import type { ReactNode } from "react";
import { BookmarkCheck } from "lucide-react";

/**
 * Subtle, consistent “latest session persisted” messaging for dashboard modules.
 * Copy should reassure: saved until explicit “Start new”, no surprise clears.
 */
export function WorkspaceSessionBanner({
  title,
  hint,
  actions,
  variant = "dark",
}: {
  title: string;
  hint?: string;
  actions: ReactNode;
  variant?: "dark" | "light" | "emerald";
}) {
  const shell =
    variant === "light"
      ? "border border-slate-200/90 bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]/80 dark:shadow-none"
      : variant === "emerald"
        ? "border border-emerald-500/15 bg-gradient-to-r from-emerald-500/[0.07] to-transparent dark:from-emerald-500/[0.09]"
        : "border border-white/[0.08] bg-white/[0.02]";

  const titleClass =
    variant === "light"
      ? "text-slate-800 dark:text-zinc-100"
      : "text-zinc-100";
  const hintClass =
    variant === "light"
      ? "text-slate-500 dark:text-zinc-500"
      : "text-zinc-500";
  const iconBox =
    variant === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : "border-white/[0.10] bg-white/[0.04] text-emerald-400/90";

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${shell}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${iconBox}`}
          aria-hidden
        >
          <BookmarkCheck className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className={`text-[13px] font-semibold leading-snug tracking-tight ${titleClass}`}>
            {title}
          </p>
          {hint ? (
            <p className={`mt-1 text-[11px] font-medium leading-relaxed ${hintClass}`}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
    </div>
  );
}
