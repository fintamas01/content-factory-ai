"use client";

import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { AuditProgressComparison, AuditScorePillarKey } from "@/lib/progress/types";

const PILLAR: { key: AuditScorePillarKey; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "ai_discoverability", label: "AI visibility" },
  { key: "conversion", label: "Conversion" },
];

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Sparkles;
  const cls = up
    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
    : down
      ? "border-rose-500/35 bg-rose-500/12 text-rose-200"
      : "border-zinc-600/40 bg-zinc-800/60 text-zinc-400";
  const text = delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : "0";
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 sm:px-3 ${cls}`}
      aria-label={
        delta > 0 ? `Up ${delta} points` : delta < 0 ? `Down ${Math.abs(delta)} points` : "No change"
      }
    >
      <Icon className="h-3.5 w-3.5 opacity-90 sm:h-4 sm:w-4" aria-hidden />
      <span className="font-mono text-[11px] font-bold tabular-nums tracking-tight sm:text-xs">{text}</span>
    </div>
  );
}

function PillarCompareRow({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
      <div className="rounded-xl border border-zinc-600/30 bg-gradient-to-br from-zinc-900/90 to-zinc-950/80 px-3 py-3 shadow-inner shadow-black/20 sm:px-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Before</p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-400 sm:text-2xl">{before}</p>
        <p className="mt-0.5 text-[11px] font-medium text-zinc-600">{label}</p>
      </div>
      <div className="flex min-w-[3.25rem] items-center justify-center sm:min-w-[4rem]">
        <DeltaBadge delta={delta} />
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/70 to-zinc-950/80 px-3 py-3 shadow-[0_0_24px_-8px_rgba(16,185,129,0.25)] sm:px-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-500/90">After</p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-100 sm:text-2xl">{after}</p>
        <p className="mt-0.5 text-[11px] font-medium text-emerald-600/80">{label}</p>
      </div>
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

export function AuditProgressPanel({
  progress,
  previousLabel,
}: {
  progress: AuditProgressComparison;
  /** e.g. formatted date of previous run */
  previousLabel?: string | null;
}) {
  if (!progress.hasPrevious) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-gradient-to-br from-zinc-900/40 to-zinc-950/80 px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-500">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Baseline captured</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              Run another audit on this URL to unlock before/after score movement and issue tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const prev = progress.previousScores;
  const cur = progress.currentScores;

  const oneLineSummary =
    progress.summaryLines.length > 0
      ? progress.summaryLines.slice(0, 2).join(" · ")
      : "Scores compared to your last run on this URL.";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/50 via-zinc-950/90 to-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
      <div className="relative border-b border-white/[0.06] bg-black/30 px-4 py-4 sm:px-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_-20%,rgba(16,185,129,0.12),transparent)]" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/85">
            Before / after
          </p>
          <p className="mt-1.5 text-sm font-medium text-white">
            Progress vs previous audit
            {previousLabel ? (
              <span className="font-normal text-zinc-500"> · {previousLabel}</span>
            ) : null}
          </p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">{oneLineSummary}</p>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {PILLAR.map(({ key, label }) => {
          const b = prev?.[key] ?? 0;
          const a = cur[key];
          const d = progress.deltas[key];
          return <PillarCompareRow key={key} label={label} before={b} after={a} delta={d} />;
        })}
      </div>

      <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">AI visibility band</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="rounded-lg border border-zinc-600/35 bg-zinc-900/70 px-3 py-1.5 text-xs capitalize text-zinc-400">
            Before · {progress.aiBandPrevious}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-1.5 text-xs font-medium capitalize text-emerald-200/95">
            After · {progress.aiBandCurrent}
          </span>
        </div>
      </div>

      {progress.summaryLines.length > 2 ? (
        <ul className="space-y-1.5 border-t border-white/[0.06] px-4 py-4 text-[12px] leading-relaxed text-zinc-400 sm:px-5">
          {progress.summaryLines.slice(2).map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/60" />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {progress.resolvedIssueTitles.length > 0 || progress.newIssueTitles.length > 0 ? (
        <div className="grid gap-3 border-t border-white/[0.06] px-4 py-4 sm:grid-cols-2 sm:px-5">
          {progress.resolvedIssueTitles.length > 0 ? (
            <IssueColumn title="Likely addressed" items={progress.resolvedIssueTitles} accent="emerald" />
          ) : null}
          {progress.newIssueTitles.length > 0 ? (
            <IssueColumn title="New focus" items={progress.newIssueTitles} accent="amber" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
