"use client";

import { Activity, ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { ProductHealthProgressComparison } from "@/lib/progress/types";

function DeltaHero({ delta }: { delta: number }) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Sparkles;
  const cls = up
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
    : down
      ? "border-rose-500/40 bg-rose-500/12 text-rose-100"
      : "border-zinc-600/45 bg-zinc-800/70 text-zinc-400";
  const text = delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : "0";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 ${cls}`}
      aria-label={
        delta > 0
          ? `Score up ${delta} points`
          : delta < 0
            ? `Score down ${Math.abs(delta)} points`
            : "No score change"
      }
    >
      <Icon className="h-5 w-5 opacity-90" aria-hidden />
      <span className="font-mono text-lg font-bold tabular-nums tracking-tight">{text}</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">pts</span>
    </div>
  );
}

function IssueColumn({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "emerald" | "amber";
}) {
  const border =
    accent === "emerald" ? "border-emerald-500/20 bg-emerald-950/20" : "border-amber-500/20 bg-amber-950/15";
  const titleCls = accent === "emerald" ? "text-emerald-400/90" : "text-amber-400/90";
  return (
    <div className={`rounded-xl border ${border} p-3 sm:p-4`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${titleCls}`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-zinc-400">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductHealthProgressPanel({
  progress,
}: {
  progress: ProductHealthProgressComparison;
}) {
  if (!progress.hasPrevious) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-gradient-to-br from-zinc-900/40 to-zinc-950/80 px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
            <Activity className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">First health snapshot</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              Run health again after you change the listing to see score and issue movement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const prev = progress.previousScore ?? 0;
  const cur = progress.currentScore;
  const summary =
    progress.summaryLines.length > 0
      ? progress.summaryLines.slice(0, 2).join(" · ")
      : "Health score compared to your last snapshot.";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/50 via-zinc-950/90 to-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
      <div className="relative border-b border-white/[0.06] bg-black/30 px-4 py-4 sm:px-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_-20%,rgba(139,92,246,0.12),transparent)]" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/90">
            Listing health · before / after
          </p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">{summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="rounded-xl border border-zinc-600/30 bg-gradient-to-br from-zinc-900/90 to-zinc-950/80 px-4 py-4 shadow-inner shadow-black/20">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Before</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-zinc-400 sm:text-4xl">{prev}</p>
          <p className="mt-1 text-[11px] text-zinc-600">/ 100</p>
        </div>
        <div className="flex items-center justify-center">
          <DeltaHero delta={progress.scoreDelta} />
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/60 to-zinc-950/80 px-4 py-4 shadow-[0_0_28px_-10px_rgba(139,92,246,0.35)]">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-400/90">After</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-violet-100 sm:text-4xl">{cur}</p>
          <p className="mt-1 text-[11px] text-violet-600/70">/ 100</p>
        </div>
      </div>

      {progress.summaryLines.length > 2 ? (
        <ul className="space-y-1.5 border-t border-white/[0.06] px-4 py-4 text-[12px] leading-relaxed text-zinc-400 sm:px-5">
          {progress.summaryLines.slice(2).map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-500/60" />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {progress.resolvedIssueTitles.length > 0 || progress.newIssueTitles.length > 0 ? (
        <div className="grid gap-3 border-t border-white/[0.06] px-4 py-4 sm:grid-cols-2 sm:px-5">
          {progress.resolvedIssueTitles.length > 0 ? (
            <IssueColumn title="Cleared" items={progress.resolvedIssueTitles} accent="emerald" />
          ) : null}
          {progress.newIssueTitles.length > 0 ? (
            <IssueColumn title="New flags" items={progress.newIssueTitles} accent="amber" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
