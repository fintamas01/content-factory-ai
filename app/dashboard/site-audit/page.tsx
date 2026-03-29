"use client";

import { useState, type ComponentType } from "react";
import {
  Loader2,
  Radar,
  Globe,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Target,
  MessageCircleQuestion,
  Lightbulb,
  Bot,
  CheckCircle2,
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import type { GrowthAuditReport } from "@/lib/site-audit/types";

type ApiSuccess = {
  report: GrowthAuditReport;
  signals: {
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    h2Count: number;
  };
};

function LargeScoreCard({
  label,
  value,
  icon: Icon,
  accentBar,
  iconWrap,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accentBar: string;
  iconWrap: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-slate-200/90 dark:border-white/[0.08] bg-gradient-to-b from-white to-slate-50/90 dark:from-[#111827] dark:to-[#0b1220] p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] dark:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] transition-shadow hover:shadow-lg dark:hover:border-white/15">
      <div
        className={`absolute top-0 left-0 right-0 h-[3px] ${accentBar}`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-5xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-500">
            out of 100
          </p>
        </div>
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconWrap} shadow-inner`}
        >
          <Icon className="h-7 w-7 text-white opacity-95" />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  const styles =
    p === "high"
      ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25"
      : p === "low"
        ? "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/20"
        : "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${styles}`}
    >
      {priority}
    </span>
  );
}

function AiVisibilitySpotlight({ report }: { report: GrowthAuditReport }) {
  const v = report.ai_visibility;
  const positive = v.would_ai_recommend;

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border-2 border-violet-500/35 bg-gradient-to-br from-violet-600/[0.07] via-fuchsia-600/[0.05] to-transparent dark:from-violet-500/15 dark:via-fuchsia-600/10 dark:to-[#0b1220]/80 p-8 md:p-10 shadow-[0_0_0_1px_rgba(139,92,246,0.15)] dark:shadow-[0_20px_50px_-20px_rgba(139,92,246,0.35)]"
      aria-labelledby="ai-visibility-heading"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-400/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3 lg:max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
            <Bot className="h-3.5 w-3.5" aria-hidden />
            Key insight
          </div>
          <h2
            id="ai-visibility-heading"
            className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white md:text-2xl"
          >
            AI visibility
          </h2>
          <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            {v.reason}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <span
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold shadow-sm lg:text-right ${
              positive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200"
                : "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:border-white/10 dark:text-slate-200"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                positive ? "bg-emerald-500/20" : "bg-slate-500/20"
              }`}
            >
              {positive ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              )}
            </span>
            <span>
              {positive
                ? "Likely to be recommended or cited"
                : "Unlikely or unclear for AI assistants"}
            </span>
          </span>
        </div>
      </div>

      {v.improvement ? (
        <div className="relative mt-8 rounded-2xl border border-violet-500/20 bg-white/60 p-5 dark:bg-[#0f172a]/80 dark:backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            Recommended next step
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {v.improvement}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default function AIGrowthAuditPage() {
  const m = MODULES.siteAudit;
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSuccess | null>(null);

  const runAudit = async () => {
    setError(null);
    setData(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a website URL.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      setData(json as ApiSuccess);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 p-8">
      <ModulePageHeader moduleId="siteAudit" />

      <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 md:p-10 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-4">
              <Radar className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
              {m.productName}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
              AI Growth Audit
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl">
              Paste a public page URL. We fetch the HTML, extract key signals, and
              return an AI-powered growth report with scores and actions.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="audit-url"
              className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2"
            >
              Website URL
            </label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="audit-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAudit()}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={runAudit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              "Run Audit"
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {data && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Summary */}
          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 md:p-10 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Executive summary
            </div>
            <p className="text-base md:text-[17px] font-medium leading-[1.65] text-slate-700 dark:text-slate-200">
              {data.report.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {data.signals.url}
              </span>
              {data.signals.title ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  Title detected
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                H1: {data.signals.h1Count} · H2: {data.signals.h2Count}
              </span>
            </div>
          </div>

          {/* KPI strip */}
          <section aria-labelledby="scores-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2
                id="scores-heading"
                className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
              >
                Performance scores
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <LargeScoreCard
                label="SEO"
                value={data.report.scores.seo}
                icon={TrendingUp}
                accentBar="bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400"
                iconWrap="bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/25"
              />
              <LargeScoreCard
                label="AI Discoverability"
                value={data.report.scores.ai_discoverability}
                icon={MessageCircleQuestion}
                accentBar="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400"
                iconWrap="bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20"
              />
              <LargeScoreCard
                label="Conversion"
                value={data.report.scores.conversion}
                icon={Target}
                accentBar="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400"
                iconWrap="bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20"
              />
            </div>
          </section>

          <AiVisibilitySpotlight report={data.report} />

          {/* Top issues */}
          {data.report.top_issues.length > 0 ? (
            <section aria-labelledby="issues-heading">
              <h2
                id="issues-heading"
                className="mb-5 flex items-center gap-2 text-lg font-black uppercase italic text-slate-900 dark:text-white"
              >
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Top issues
              </h2>
              <ul className="grid gap-4">
                {data.report.top_issues.map((issue, i) => (
                  <li
                    key={`${issue.title}-${i}`}
                    className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]/90 dark:shadow-none"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-white pr-2">
                        {issue.title}
                      </h3>
                      <PriorityBadge priority={issue.priority} />
                    </div>
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-white/5">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-1.5">
                          Impact
                        </p>
                        <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                          {issue.impact}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 dark:bg-emerald-500/[0.06]">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400 mb-1.5">
                          Fix
                        </p>
                        <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                          {issue.fix}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Quick wins */}
          {data.report.quick_wins.length > 0 ? (
            <section aria-labelledby="quick-wins-heading">
              <h2
                id="quick-wins-heading"
                className="mb-5 flex items-center gap-2 text-lg font-black uppercase italic text-slate-900 dark:text-white"
              >
                <Sparkles className="h-5 w-5 text-emerald-500" />
                Quick wins
              </h2>
              <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {data.report.quick_wins.map((row, i) => (
                  <li
                    key={i}
                    className="flex gap-4 rounded-[20px] border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-5 dark:border-white/[0.08] dark:from-[#111827] dark:to-[#0b1220]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
                        {row.action}
                      </p>
                      {row.expected_result ? (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5 dark:bg-emerald-500/10">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300/90 mb-1">
                            Expected result
                          </p>
                          <p className="text-xs font-medium leading-relaxed text-emerald-950/90 dark:text-emerald-100/90">
                            {row.expected_result}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Content opportunities — full width section */}
          {data.report.content_opportunities.length > 0 ? (
            <section
              className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-slate-50/80 p-8 dark:bg-[#070d18] dark:ring-1 dark:ring-white/5 md:p-10"
              aria-labelledby="content-opp-heading"
            >
              <h2
                id="content-opp-heading"
                className="mb-6 flex items-center gap-2 text-lg font-black uppercase italic text-slate-900 dark:text-white"
              >
                <Lightbulb className="h-5 w-5 text-blue-500" />
                Content opportunities
              </h2>
              <ul className="space-y-5">
                {data.report.content_opportunities.map((row, i) => (
                  <li
                    key={i}
                    className="flex gap-4 rounded-[22px] border border-white bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-[#0b1220] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xs font-black text-blue-600 dark:text-blue-400">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[15px] font-bold leading-snug text-slate-900 dark:text-white">
                        {row.idea}
                      </p>
                      {row.why_it_works ? (
                        <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                          {row.why_it_works}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
