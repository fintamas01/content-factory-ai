"use client";

import { useMemo, useState, type ComponentType } from "react";
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
  Zap,
  CalendarDays,
  Copy,
  Check,
  LayoutDashboard,
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import type {
  AuditContentPlanDay,
  AuditFixPackage,
  GrowthAuditReport,
  GrowthAuditTopIssue,
} from "@/lib/site-audit/types";

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

const PRI_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

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

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-[#0f172a]/90">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

function FixResultPanel({ fix }: { fix: AuditFixPackage }) {
  return (
    <div className="mt-5 space-y-4 rounded-[20px] border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 dark:from-emerald-500/10">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        <Sparkles className="h-3.5 w-3.5" />
        Generated fix pack
      </div>
      {fix.conversion_impact ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 dark:bg-amber-500/[0.08]">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-800 dark:text-amber-300/90">
            Conversion &amp; business impact
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            {fix.conversion_impact}
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CopyField label="Meta title" value={fix.meta_title} />
        <CopyField label="Meta description" value={fix.meta_description} />
      </div>
      {fix.meta_title_alternates.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">
            Title A/B options
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fix.meta_title_alternates.map((t, i) => (
              <CopyField key={i} label={`Alt title ${i + 1}`} value={t} />
            ))}
          </div>
        </div>
      ) : null}
      {fix.headlines.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">
            Headlines
          </p>
          <ul className="space-y-2">
            {fix.headlines.map((h, i) => (
              <li
                key={i}
                className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fix.improved_text ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">
            Primary improved copy
          </p>
          <p className="whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm leading-relaxed text-slate-800 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200">
            {fix.improved_text}
          </p>
        </div>
      ) : null}
      {fix.copy_variants.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">
            Alternate angles
          </p>
          <ul className="space-y-3">
            {fix.copy_variants.map((block, i) => (
              <li
                key={i}
                className="whitespace-pre-wrap rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 text-sm leading-relaxed text-slate-800 dark:border-violet-500/20 dark:bg-violet-500/[0.08] dark:text-slate-200"
              >
                {block}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fix.seo_content_notes ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">
            SEO notes
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {fix.seo_content_notes}
          </p>
        </div>
      ) : null}
      {fix.notes ? (
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          {fix.notes}
        </div>
      ) : null}
    </div>
  );
}

function AiVisibilityModule({ report }: { report: GrowthAuditReport }) {
  const v = report.ai_visibility;
  const positive = v.would_ai_recommend;
  const how =
    v.how_systems_see_site?.trim() ||
    v.reason ||
    "How LLMs interpret this page depends on clear entities, headings, and proof in the extract.";
  const concrete =
    v.concrete_improvements?.length > 0
      ? v.concrete_improvements
      : v.improvement
        ? [v.improvement]
        : [];

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
            AI visibility agent
          </div>
          <h2
            id="ai-visibility-heading"
            className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white md:text-2xl"
          >
            How AI systems see your site
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

      <div className="relative mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-violet-500/20 bg-white/60 p-5 dark:bg-[#0f172a]/80 dark:backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            Retrieval &amp; representation
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {how}
          </p>
        </div>
        <div className="rounded-2xl border border-fuchsia-500/20 bg-white/60 p-5 dark:bg-[#0f172a]/80">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-400">
            Concrete improvements
          </p>
          <ul className="mt-3 space-y-2">
            {concrete.map((line, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-500" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RecommendedActionsPanel({
  report,
  onFixIssue,
  fixLoadingKey,
}: {
  report: GrowthAuditReport;
  onFixIssue: (issue: GrowthAuditTopIssue, idx: number) => void;
  fixLoadingKey: string | null;
}) {
  const items = useMemo(() => {
    const ranked = report.top_issues
      .map((issue, idx) => ({ issue, idx }))
      .sort(
        (a, b) =>
          (PRI_ORDER[a.issue.priority] ?? 9) -
          (PRI_ORDER[b.issue.priority] ?? 9)
      );
    const out: Array<
      | { kind: "issue"; idx: number; title: string; priority: string }
      | { kind: "win"; idx: number; action: string }
    > = [];
    ranked.slice(0, 6).forEach(({ issue, idx }) => {
      out.push({
        kind: "issue",
        idx,
        title: issue.title,
        priority: issue.priority,
      });
    });
    report.quick_wins.slice(0, 4).forEach((w, idx) => {
      out.push({ kind: "win", idx, action: w.action });
    });
    return out.slice(0, 10);
  }, [report]);

  if (items.length === 0) return null;

  return (
    <section
      className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-50 to-white dark:from-[#0f172a] dark:to-[#0b1220] p-6 md:p-8 shadow-sm"
      aria-labelledby="actions-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="actions-heading"
              className="text-lg font-black uppercase italic text-slate-900 dark:text-white"
            >
              Recommended actions
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Prioritized from your audit—jump to fixes with one tap.
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-6 divide-y divide-slate-200/80 dark:divide-white/[0.06]">
        {items.map((row, i) => (
          <li
            key={`${row.kind}-${row.idx}-${i}`}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {row.kind === "issue" ? "Issue" : "Quick win"}
              </p>
              <p className="mt-1 font-bold leading-snug text-slate-900 dark:text-white">
                {row.kind === "issue" ? row.title : row.action}
              </p>
              {row.kind === "issue" ? (
                <PriorityBadge priority={row.priority} />
              ) : null}
            </div>
            {row.kind === "issue" ? (
              <button
                type="button"
                onClick={() =>
                  onFixIssue(report.top_issues[row.idx]!, row.idx)
                }
                disabled={fixLoadingKey === `issue-${row.idx}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {fixLoadingKey === `issue-${row.idx}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Fix this
              </button>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Under 90 min
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AIGrowthAuditPage() {
  const m = MODULES.siteAudit;
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [usageBump, setUsageBump] = useState(0);

  const [fixLoadingKey, setFixLoadingKey] = useState<string | null>(null);
  const [fixByIssue, setFixByIssue] = useState<Record<string, AuditFixPackage>>(
    {}
  );
  const [fixError, setFixError] = useState<string | null>(null);

  const [planLoading, setPlanLoading] = useState(false);
  const [planDays, setPlanDays] = useState<AuditContentPlanDay[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const runAudit = async () => {
    setError(null);
    setData(null);
    setPlanDays(null);
    setPlanError(null);
    setFixByIssue({});
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
        if (json?.code === "USAGE_LIMIT") {
          setError(
            "Monthly site audit limit reached. Upgrade on the Billing page for a higher quota."
          );
          return;
        }
        setError(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      setData(json as ApiSuccess);
      setUsageBump((n) => n + 1);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const requestFix = async (issue: GrowthAuditTopIssue, idx: number) => {
    if (!data) return;
    const key = `issue-${idx}`;
    setFixLoadingKey(key);
    setFixError(null);
    try {
      const res = await fetch("/api/audit-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signals: data.signals,
          issue,
          reportSummary: data.report.summary,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFixError(
          typeof json.error === "string" ? json.error : "Fix generation failed."
        );
        return;
      }
      const fix = json.fix as AuditFixPackage | undefined;
      if (fix) setFixByIssue((prev) => ({ ...prev, [key]: fix }));
    } catch {
      setFixError("Network error.");
    } finally {
      setFixLoadingKey(null);
    }
  };

  const runContentPlan = async () => {
    if (!data) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/audit-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: data.report,
          signals: data.signals,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlanError(
          typeof json.error === "string" ? json.error : "Plan failed."
        );
        return;
      }
      const days = json.days as AuditContentPlanDay[] | undefined;
      if (Array.isArray(days)) setPlanDays(days);
    } catch {
      setPlanError("Network error.");
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 p-8">
      <ModulePageHeader moduleId="siteAudit" />

      <ModuleUsageBanner feature="audit" bump={usageBump} />

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
              AI Growth Agent
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl">
              Audit your page, then generate fixes, meta copy, and a 14-day growth
              calendar—built from the same signals as your report.
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
              "Run audit"
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

          <RecommendedActionsPanel
            report={data.report}
            onFixIssue={requestFix}
            fixLoadingKey={fixLoadingKey}
          />

          {fixError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{fixError}</span>
            </div>
          ) : null}

          <section className="rounded-[28px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.06] to-transparent p-6 md:p-8 dark:from-blue-500/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase italic text-slate-900 dark:text-white">
                    14-day growth plan
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Daily ideas, hooks, and captions aligned to this audit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={runContentPlan}
                disabled={planLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50"
              >
                {planLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate 14-day growth plan
              </button>
            </div>
            {planError ? (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {planError}
              </p>
            ) : null}
            {planDays && planDays.length > 0 ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {planDays.map((d, i) => (
                  <li
                    key={`${d.day}-${i}`}
                    className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#0f172a]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                      Day {d.day}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                      {d.content_idea}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
                      Hook: {d.hook}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {d.caption}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

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

          <AiVisibilityModule report={data.report} />

          {data.report.top_issues.length > 0 ? (
            <section aria-labelledby="issues-heading">
              <h2
                id="issues-heading"
                className="mb-5 flex items-center gap-2 text-lg font-black uppercase italic text-slate-900 dark:text-white"
              >
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Actionable issues
              </h2>
              <ul className="grid gap-4">
                {data.report.top_issues.map((issue, i) => {
                  const k = `issue-${i}`;
                  const fix = fixByIssue[k];
                  const loading = fixLoadingKey === k;
                  return (
                    <li
                      key={`${issue.title}-${i}`}
                      id={`audit-issue-${i}`}
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
                            Explanation
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                            {issue.explanation}
                          </p>
                        </div>
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
                            Suggested fix
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                            {issue.fix}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestFix(issue, i)}
                          disabled={loading}
                          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          Fix this
                        </button>
                        {fix ? <FixResultPanel fix={fix} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

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
