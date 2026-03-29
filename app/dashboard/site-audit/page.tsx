"use client";

import { useState, type ComponentType } from "react";
import {
  Loader2,
  Radar,
  Globe,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Bot,
  Target,
  MessageCircleQuestion,
  Ban,
  ShieldOff,
  Users,
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

function ScoreCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
          {value}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
    </div>
  );
}

function priorityStyles(p: string) {
  if (p === "high")
    return "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400";
  if (p === "low")
    return "border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400";
  return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20 p-8">
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
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-2">
              Summary
            </h2>
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {data.report.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
              <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">
                {data.signals.url}
              </span>
              {data.signals.title && (
                <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">
                  Title detected
                </span>
              )}
              <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">
                H1: {data.signals.h1Count} · H2: {data.signals.h2Count}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ScoreCard
              label="SEO score"
              value={data.report.seo_score}
              icon={TrendingUp}
              accent="bg-gradient-to-br from-blue-600 to-cyan-600"
            />
            <ScoreCard
              label="AI readiness"
              value={data.report.ai_readiness_score}
              icon={Bot}
              accent="bg-gradient-to-br from-violet-600 to-fuchsia-600"
            />
            <ScoreCard
              label="Conversion"
              value={data.report.conversion_score}
              icon={Target}
              accent="bg-gradient-to-br from-emerald-600 to-teal-600"
            />
            <ScoreCard
              label="AI discoverability"
              value={data.report.ai_discoverability.score}
              icon={MessageCircleQuestion}
              accent="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          </div>

          <div className="rounded-[28px] border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/5 p-8 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5 text-amber-500 shrink-0" />
                Would ChatGPT recommend this business?
              </h2>
              <span className="inline-flex w-fit rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                {data.report.ai_discoverability.verdict}
              </span>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {data.report.ai_discoverability.explanation}
            </p>
          </div>

          {data.report.issues.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-6 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Issues
              </h2>
              <ul className="space-y-4">
                {data.report.issues.map((issue, i) => (
                  <li
                    key={`${issue.title}-${i}`}
                    className={`rounded-2xl border px-5 py-4 ${priorityStyles(issue.priority)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase tracking-widest">
                        {issue.priority}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {issue.title}
                      </span>
                    </div>
                    <p className="text-sm font-medium opacity-90">{issue.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.report.conversion_blockers.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-6 flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500 shrink-0" />
                Conversion blockers
              </h2>
              <ul className="space-y-4">
                {data.report.conversion_blockers.map((row, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] px-5 py-4"
                  >
                    <p className="font-bold text-slate-900 dark:text-white">
                      {row.blocker}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                      {row.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.report.trust_signals_missing.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-4 flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-slate-500 shrink-0" />
                Trust signals missing
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                Based on visible copy in this page extract—not your whole site.
              </p>
              <ul className="space-y-2">
                {data.report.trust_signals_missing.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-slate-400 font-black">·</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.report.content_gaps_vs_competitors.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500 shrink-0" />
                Content gaps vs competitors
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6">
                Category-level inference (no live competitor crawl)—use as a
                directional checklist.
              </p>
              <div className="space-y-4">
                {data.report.content_gaps_vs_competitors.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] p-5 space-y-3"
                  >
                    <p className="font-bold text-slate-900 dark:text-white">
                      {row.gap}
                    </p>
                    {row.competitor_norm ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 uppercase text-[10px] tracking-widest mr-2">
                          Typical in category
                        </span>
                        {row.competitor_norm}
                      </p>
                    ) : null}
                    {row.suggestion ? (
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 border-t border-indigo-500/10 pt-3">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-widest mr-2">
                          Suggestion
                        </span>
                        {row.suggestion}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data.report.quick_wins.length > 0 ||
            data.report.content_suggestions.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {data.report.quick_wins.length > 0 && (
                <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                    Quick wins
                  </h2>
                  <ul className="space-y-3">
                    {data.report.quick_wins.map((line, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm font-medium text-slate-600 dark:text-slate-300"
                      >
                        <span className="text-emerald-500 font-black">→</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.report.content_suggestions.length > 0 && (
                <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    Content ideas
                  </h2>
                  <ul className="space-y-3">
                    {data.report.content_suggestions.map((line, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm font-medium text-slate-600 dark:text-slate-300"
                      >
                        <span className="text-blue-500 font-black">→</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
