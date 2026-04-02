"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createBrowserClient } from "@supabase/ssr";
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
  ClipboardList,
  Copy,
  Check,
  LayoutDashboard,
  PanelRight,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import { fetchActiveClientSummary, safeFilenamePart } from "@/lib/reports/client-meta";
import { renderReportToPdf } from "@/lib/reports/render-to-pdf";
import { AuditReport } from "@/app/components/reports/AuditReport";
import { SprintReport } from "@/app/components/reports/SprintReport";
import type {
  AuditContentPlanDay,
  AuditFixPackage,
  GrowthAuditReport,
  GrowthSprintPlan,
  GrowthAuditTopIssue,
} from "@/lib/site-audit/types";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_MODULES,
} from "@/lib/persistence/workspace-storage";
import { WorkspaceSessionBanner } from "@/app/components/persistence/WorkspaceSessionBanner";
import { ReviewWorkspaceStrip } from "@/app/components/review/ReviewWorkspaceStrip";
import { AuditProgressPanel } from "@/app/components/progress/AuditProgressPanel";
import type { AuditProgressComparison } from "@/lib/progress/types";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

type ApiSuccess = {
  report: GrowthAuditReport;
  signals: {
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    h2Count: number;
    competitors?: string[];
  };
  auditRunId?: string | null;
  auditProgress?: AuditProgressComparison | null;
};

type TabId =
  | "overview"
  | "seo"
  | "ai"
  | "conversion"
  | "content"
  | "competitors"
  | "sprint"
  | "actions";

const PRI_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const NAV: {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "seo", label: "SEO", icon: TrendingUp },
  { id: "ai", label: "AI Visibility", icon: MessageCircleQuestion },
  { id: "conversion", label: "Conversion", icon: Target },
  { id: "content", label: "Content Opportunities", icon: Lightbulb },
  { id: "competitors", label: "Competitor Intelligence", icon: PanelRight },
  { id: "sprint", label: "30-Day Growth Sprint", icon: ClipboardList },
  { id: "actions", label: "Actions", icon: Zap },
];

const shell =
  "min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#080c14] via-[#070b12] to-[#05070c] text-zinc-100 antialiased selection:bg-emerald-500/25 selection:text-emerald-100";

/** Primary surface — cards & panels */
const panel =
  "rounded-2xl border border-white/[0.06] bg-[#0c1018]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-[box-shadow,border-color] duration-300 hover:border-white/[0.09] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_28px_56px_-20px_rgba(0,0,0,0.5)]";

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500";

const tabTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

function ScoreTile({
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
    <motion.div
      initial={false}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 shadow-lg shadow-black/20 transition-colors duration-300 hover:border-white/[0.12]"
    >
      <div className={`absolute left-0 right-0 top-0 h-[2px] ${accent}`} />
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.03] blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={`${sectionLabel} text-zinc-500`}>{label}</p>
          <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight text-white">
            {value}
          </p>
          <p className="mt-1.5 text-[13px] text-zinc-500">out of 100</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-inner transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-6 w-6 text-zinc-300" />
        </div>
      </div>
    </motion.div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  const styles =
    p === "high"
      ? "bg-red-500/15 text-red-300 border-red-500/25"
      : p === "low"
        ? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
        : "bg-amber-500/12 text-amber-200 border-amber-500/25";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles}`}
    >
      {priority}
    </span>
  );
}

function Pill({
  tone,
  label,
}: {
  tone: "emerald" | "amber" | "zinc" | "violet" | "blue";
  label: string;
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
        : tone === "violet"
          ? "border-violet-500/25 bg-violet-500/10 text-violet-200"
          : tone === "blue"
            ? "border-blue-500/25 bg-blue-500/10 text-blue-200"
            : "border-white/10 bg-white/[0.04] text-zinc-300";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles}`}
    >
      {label}
    </span>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3 transition-colors duration-200 hover:border-white/[0.1]">
      <div className="flex items-center justify-between gap-2">
        <p className={`${sectionLabel} !tracking-[0.15em]`}>{label}</p>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-[0.97] disabled:opacity-40"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{value || "—"}</p>
    </div>
  );
}

function FixResultPanel({ fix }: { fix: AuditFixPackage }) {
  return (
    <div className="space-y-4 rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-4 shadow-[0_0_32px_-12px_rgba(16,185,129,0.25)] transition-shadow duration-300 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]">
      <div className={`flex items-center gap-2 ${sectionLabel} text-emerald-400/95`}>
        <Sparkles className="h-3.5 w-3.5" />
        Generated fix pack
      </div>
      {fix.conversion_impact ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
            Conversion &amp; business impact
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-100">
            {fix.conversion_impact}
          </p>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <CopyField label="Meta title" value={fix.meta_title} />
        <CopyField label="Meta description" value={fix.meta_description} />
      </div>
      {fix.meta_title_alternates.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Title A/B options
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fix.meta_title_alternates.map((t, i) => (
              <CopyField key={i} label={`Alt ${i + 1}`} value={t} />
            ))}
          </div>
        </div>
      ) : null}
      {fix.headlines.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Headlines
          </p>
          <ul className="space-y-1.5">
            {fix.headlines.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-sm text-zinc-200"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fix.improved_text ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Primary improved copy
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/25 p-3 text-sm leading-relaxed text-zinc-200">
            {fix.improved_text}
          </p>
        </div>
      ) : null}
      {fix.copy_variants.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Alternate angles
          </p>
          <ul className="space-y-2">
            {fix.copy_variants.map((block, i) => (
              <li
                key={i}
                className="whitespace-pre-wrap rounded-lg border border-violet-500/15 bg-violet-500/[0.06] p-3 text-sm leading-relaxed text-zinc-200"
              >
                {block}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fix.seo_content_notes ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            SEO notes
          </p>
          <p className="text-sm leading-relaxed text-zinc-300">
            {fix.seo_content_notes}
          </p>
        </div>
      ) : null}
      {fix.notes ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm text-zinc-400">
          {fix.notes}
        </div>
      ) : null}
    </div>
  );
}

function AiVisibilityPanel({ report }: { report: GrowthAuditReport }) {
  const v = report.ai_visibility;
  const positive = v.would_ai_recommend;
  const how =
    v.how_systems_see_site?.trim() ||
    v.reason ||
    "Clear entities, headings, and proof help LLMs represent this page accurately.";
  const concrete =
    v.concrete_improvements?.length > 0
      ? v.concrete_improvements
      : v.improvement
        ? [v.improvement]
        : [];

  return (
    <div className={`${panel} p-6 md:p-8`}>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4 lg:max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/[0.08] px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-violet-300/95 shadow-sm shadow-violet-950/40">
            <Bot className="h-3.5 w-3.5" aria-hidden />
            AI systems
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            How AI sees this page
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-400">{v.reason}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-shadow duration-300 ${
            positive
              ? "border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-100 shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)]"
              : "border-zinc-600/40 bg-zinc-900/50 text-zinc-300"
          }`}
        >
          {positive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-zinc-500" />
          )}
          {positive
            ? "Likely cited or recommended"
            : "Unclear for assistants"}
        </span>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-5 transition-colors duration-300 hover:border-violet-500/30">
          <p className={`${sectionLabel} text-violet-300/90`}>
            Retrieval &amp; representation
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{how}</p>
        </div>
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-5 transition-colors duration-300 hover:border-fuchsia-500/30">
          <p className={`${sectionLabel} text-fuchsia-300/90`}>
            Concrete improvements
          </p>
          <ul className="mt-3 space-y-2">
            {concrete.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fuchsia-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

type AuditWorkspaceSnapshot = {
  url: string;
  competitors: [string, string, string];
  data: ApiSuccess | null;
  tab: TabId;
  selectedIssueIdx: number | null;
  fixByIssue: Record<string, AuditFixPackage>;
  planDays: AuditContentPlanDay[] | null;
  sprintPlan: GrowthSprintPlan | null;
  reviewItemId: string | null;
};

export default function AIGrowthAuditPage() {
  const m = MODULES.siteAudit;
  const [url, setUrl] = useState("");
  const [competitors, setCompetitors] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [usageBump, setUsageBump] = useState(0);
  const [exportLoadingKey, setExportLoadingKey] = useState<"audit" | "sprint" | null>(null);
  const [workspaceScope, setWorkspaceScope] = useState<{
    userId: string;
    clientId: string;
  } | null>(null);
  const workspaceHydrated = useRef(false);
  const [auditWorkspaceReady, setAuditWorkspaceReady] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditProgressComparison | null>(null);

  const [tab, setTab] = useState<TabId>("overview");
  const [selectedIssueIdx, setSelectedIssueIdx] = useState<number | null>(null);

  const [fixLoadingKey, setFixLoadingKey] = useState<string | null>(null);
  const [fixByIssue, setFixByIssue] = useState<Record<string, AuditFixPackage>>(
    {}
  );
  const [fixError, setFixError] = useState<string | null>(null);

  const [planLoading, setPlanLoading] = useState(false);
  const [planDays, setPlanDays] = useState<AuditContentPlanDay[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintPlan, setSprintPlan] = useState<GrowthSprintPlan | null>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const res = await fetch("/api/clients");
      const j = await res.json().catch(() => ({}));
      const clientId = typeof j.activeClientId === "string" ? j.activeClientId : "";
      if (!clientId || cancelled) return;
      setWorkspaceScope({ userId: user.id, clientId });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceScope || workspaceHydrated.current) return;
    const w = loadWorkspace<AuditWorkspaceSnapshot>(
      workspaceScope.userId,
      workspaceScope.clientId,
      WORKSPACE_MODULES.siteAudit
    );
    if (w) {
      if (typeof w.url === "string") setUrl(w.url);
      if (Array.isArray(w.competitors) && w.competitors.length === 3) {
        setCompetitors([w.competitors[0] ?? "", w.competitors[1] ?? "", w.competitors[2] ?? ""]);
      }
      if (w.data) setData(w.data);
      if (w.tab) setTab(w.tab);
      if (w.selectedIssueIdx !== undefined) setSelectedIssueIdx(w.selectedIssueIdx);
      if (w.fixByIssue && typeof w.fixByIssue === "object") setFixByIssue(w.fixByIssue);
      if (w.planDays !== undefined) setPlanDays(w.planDays);
      if (w.sprintPlan !== undefined) setSprintPlan(w.sprintPlan);
      if (typeof w.reviewItemId === "string") setReviewItemId(w.reviewItemId);
    }
    workspaceHydrated.current = true;
    setAuditWorkspaceReady(true);
  }, [workspaceScope]);

  useEffect(() => {
    if (!workspaceScope || !workspaceHydrated.current) return;
    const t = window.setTimeout(() => {
      saveWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.siteAudit, {
        url,
        competitors,
        data,
        tab,
        selectedIssueIdx,
        fixByIssue,
        planDays,
        sprintPlan,
        reviewItemId,
      } satisfies AuditWorkspaceSnapshot);
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    workspaceScope,
    url,
    competitors,
    data,
    tab,
    selectedIssueIdx,
    fixByIssue,
    planDays,
    sprintPlan,
    reviewItemId,
  ]);

  const startNewAudit = () => {
    if (workspaceScope) {
      clearWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.siteAudit);
    }
    setUrl("");
    setCompetitors(["", "", ""]);
    setData(null);
    setError(null);
    setPlanDays(null);
    setPlanError(null);
    setFixByIssue({});
    setSprintPlan(null);
    setSprintError(null);
    setSelectedIssueIdx(null);
    setTab("overview");
    setFixError(null);
    setReviewItemId(null);
    setAuditProgress(null);
  };

  useEffect(() => {
    const u = data?.signals?.url;
    if (!u) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/progress/audit-comparison?url=${encodeURIComponent(u)}`
        );
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (j?.auditProgress) setAuditProgress(j.auditProgress as AuditProgressComparison);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.signals?.url, data?.auditRunId]);

  const exportAuditPdf = async () => {
    if (!data?.report) return;
    setExportLoadingKey("audit");
    try {
      const client = await fetchActiveClientSummary();
      const clientName = client?.name || "Workspace";
      const generatedAt = new Date().toLocaleString();
      const filename = `${safeFilenamePart(clientName)}_ai_growth_audit_${safeFilenamePart(
        new Date().toISOString().slice(0, 10)
      )}.pdf`;
      const res = await renderReportToPdf({
        filename,
        backgroundColor: "#ffffff",
        node: (
          <AuditReport
            clientName={clientName}
            websiteUrl={data?.signals?.url || url}
            generatedAt={generatedAt}
            audit={data.report}
            competitorSummary={data.report?.competitor_intelligence?.summary || ""}
          />
        ),
      });
      if (!res.ok) setError(res.error);
    } finally {
      setExportLoadingKey(null);
    }
  };

  const exportSprintPdf = async () => {
    const sprint = sprintPlan || data?.report?.growth_sprint;
    if (!sprint) return;
    setExportLoadingKey("sprint");
    try {
      const client = await fetchActiveClientSummary();
      const clientName = client?.name || "Workspace";
      const generatedAt = new Date().toLocaleString();
      const filename = `${safeFilenamePart(clientName)}_30_day_growth_sprint_${safeFilenamePart(
        new Date().toISOString().slice(0, 10)
      )}.pdf`;
      const res = await renderReportToPdf({
        filename,
        backgroundColor: "#ffffff",
        node: <SprintReport clientName={clientName} generatedAt={generatedAt} sprint={sprint} />,
      });
      if (!res.ok) setError(res.error);
    } finally {
      setExportLoadingKey(null);
    }
  };

  const selectedKeyForCopilot =
    selectedIssueIdx !== null ? `issue-${selectedIssueIdx}` : null;

  useCopilotPageContext({
    page: "audit",
    data: {
      url,
      competitors: competitors.map((c) => c.trim()).filter(Boolean).slice(0, 3),
      tab,
      signals: data?.signals ?? null,
      report: data
        ? {
            summary: data.report.summary,
            scores: data.report.scores,
            today_plan: (data.report.today_plan ?? []).slice(0, 3),
            actions: (data.report.actions ?? []).slice(0, 8).map((a) => ({
              title: a.title,
              priority: a.priority,
              impact: a.impact,
              effort: a.effort,
              expected_result: a.expected_result,
              cta: a.cta,
              action_url: (a as any).action_url,
            })),
            top_issues: (data.report.top_issues ?? []).slice(0, 8).map((x) => ({
              title: x.title,
              priority: x.priority,
              impact: x.impact,
              fix: x.fix,
            })),
            ai_visibility: data.report.ai_visibility,
            quick_wins: (data.report.quick_wins ?? []).slice(0, 6),
            competitor_intelligence: data.report.competitor_intelligence
              ? {
                  summary: data.report.competitor_intelligence.summary,
                }
              : null,
          }
        : null,
      selectedIssueIdx,
      selectedFix: selectedKeyForCopilot
        ? fixByIssue[selectedKeyForCopilot] ?? null
        : null,
      contentPlanDays: planDays ? planDays.slice(0, 4) : null,
      sprintPlan: sprintPlan
        ? { summary: sprintPlan.summary, weeks: sprintPlan.weeks?.slice(0, 1) ?? [] }
        : null,
    },
  });

  const sortedIssueIndices = useMemo(() => {
    if (!data) return [];
    return data.report.top_issues
      .map((issue, idx) => ({ issue, idx }))
      .sort(
        (a, b) =>
          PRI_ORDER[a.issue.priority] - PRI_ORDER[b.issue.priority]
      )
      .map((x) => x.idx);
  }, [data]);

  useEffect(() => {
    if (!data) {
      setTab("overview");
      setSelectedIssueIdx(null);
    }
  }, [data]);

  useEffect(() => {
    if (tab !== "actions" || !data?.report.top_issues.length) return;
    if (selectedIssueIdx === null) {
      setSelectedIssueIdx(sortedIssueIndices[0] ?? 0);
    }
  }, [tab, data, selectedIssueIdx, sortedIssueIndices]);

  const runAudit = async () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a website URL.");
      return;
    }
    const competitorUrls = competitors
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    setLoading(true);
    try {
      const res = await fetch("/api/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, competitors: competitorUrls }),
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
      setPlanDays(null);
      setPlanError(null);
      setFixByIssue({});
      setSprintPlan(null);
      setSprintError(null);
      setSelectedIssueIdx(null);
      setTab("overview");
      setData(json as ApiSuccess);
      setAuditProgress(
        (json as ApiSuccess).auditProgress ??
          null
      );
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

  const runGrowthSprint = async () => {
    if (!data) return;
    setSprintLoading(true);
    setSprintError(null);
    try {
      const res = await fetch("/api/growth-sprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: data.report,
          signals: data.signals,
          auditRunId: data.auditRunId ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSprintError(
          typeof json.error === "string" ? json.error : "Sprint generation failed."
        );
        return;
      }
      const plan = json.plan as GrowthSprintPlan | undefined;
      if (plan) setSprintPlan(plan);
      // If server saved the plan into the audit run report, keep local report in sync.
      if (plan) {
        setData((prev) =>
          prev ? { ...prev, report: { ...prev.report, growth_sprint: plan } } : prev
        );
      }
    } catch {
      setSprintError("Network error.");
    } finally {
      setSprintLoading(false);
    }
  };

  const selectedIssue: GrowthAuditTopIssue | null =
    data && selectedIssueIdx !== null
      ? data.report.top_issues[selectedIssueIdx] ?? null
      : null;
  const selectedKey =
    selectedIssueIdx !== null ? `issue-${selectedIssueIdx}` : null;
  const selectedFix = selectedKey ? fixByIssue[selectedKey] : undefined;

  const renderPanel = () => {
    if (!data) return null;
    const { report, signals } = data;
    const actions = report.actions ?? [];
    const today = report.today_plan ?? [];

    switch (tab) {
      case "overview":
        return (
          <div className="space-y-10">
            <div className="grid gap-5 sm:grid-cols-3">
              <ScoreTile
                label="SEO"
                value={report.scores.seo}
                icon={TrendingUp}
                accent="bg-gradient-to-r from-sky-500 to-cyan-400"
              />
              <ScoreTile
                label="AI discoverability"
                value={report.scores.ai_discoverability}
                icon={MessageCircleQuestion}
                accent="bg-gradient-to-r from-amber-500 to-orange-500"
              />
              <ScoreTile
                label="Conversion"
                value={report.scores.conversion}
                icon={Target}
                accent="bg-gradient-to-r from-emerald-500 to-teal-500"
              />
            </div>
            <div className={`${panel} p-7 md:p-9`}>
              <p className={sectionLabel}>Executive summary</p>
              <p className="mt-5 text-[15px] leading-[1.7] text-zinc-300">
                {report.summary}
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 font-mono text-[11px] leading-snug text-zinc-400 transition-colors hover:border-white/15">
                  {signals.url}
                </span>
                {signals.title ? (
                  <span className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-[11px] text-zinc-500">
                    Title detected
                  </span>
                ) : null}
                <span className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-[11px] text-zinc-500">
                  H1 {signals.h1Count} · H2 {signals.h2Count}
                </span>
              </div>
            </div>
            <div className={`${panel} p-7 md:p-9`}>
              <p className={sectionLabel}>Your next 3 moves today</p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                A crisp operator plan for the next 60–120 minutes.
              </p>
              <div className="mt-6 grid gap-3">
                {(today.length ? today : actions.slice(0, 3).map((a) => a.title)).slice(0, 3).map((t, i) => (
                  <div
                    key={i}
                    className="group flex items-start justify-between gap-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5 transition-colors duration-300 hover:border-emerald-500/25"
                  >
                    <div className="flex gap-4">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[12px] font-semibold text-emerald-200">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium leading-snug text-white">
                          {t}
                        </p>
                        {actions[i]?.expected_result ? (
                          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                            {actions[i]!.expected_result}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("actions")}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.10]"
                    >
                      Do this now <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {actions.length ? (
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>Top actions (ranked by impact)</p>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                  This is your action backlog. Start from the top.
                </p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {actions.slice(0, 4).map((a, i) => (
                    <div
                      key={`${a.title}-${i}`}
                      className="rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-colors duration-300 hover:border-white/[0.12]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-semibold leading-snug text-white">
                          {a.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            {a.effort} effort
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              a.priority === "high"
                                ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
                                : a.priority === "low"
                                  ? "border-white/[0.08] bg-white/[0.03] text-zinc-500"
                                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                            }`}
                          >
                            {a.priority} priority
                          </span>
                        </div>
                      </div>
                      {a.expected_result ? (
                        <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
                          {a.expected_result}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTab("actions")}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-500 active:scale-[0.98]"
                        >
                          Do this now
                        </button>
                        {typeof (a as any).action_url === "string" && (a as any).action_url.startsWith("/dashboard/") ? (
                          <button
                            type="button"
                            onClick={() => window.location.assign((a as any).action_url)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.06] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.10]"
                          >
                            Open module
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );

      case "seo":
        return (
          <div className="space-y-8">
            <div className="max-w-md">
              <ScoreTile
                label="SEO score"
                value={report.scores.seo}
                icon={TrendingUp}
                accent="bg-gradient-to-r from-sky-500 to-cyan-400"
              />
            </div>
            <div className={`${panel} p-7`}>
              <p className={sectionLabel}>On-page signals</p>
              <dl className="mt-6 space-y-5 text-[14px]">
                <div>
                  <dt className={sectionLabel}>URL</dt>
                  <dd className="mt-2 font-mono text-[13px] leading-relaxed text-zinc-300 break-all">
                    {signals.url}
                  </dd>
                </div>
                <div>
                  <dt className={sectionLabel}>Title</dt>
                  <dd className="mt-2 text-zinc-200">
                    {signals.title || "—"}
                  </dd>
                </div>
                <div>
                  <dt className={sectionLabel}>Meta description</dt>
                  <dd className="mt-2 text-zinc-400">
                    {signals.metaDescription || "—"}
                  </dd>
                </div>
                <div className="flex gap-10">
                  <div>
                    <dt className={sectionLabel}>H1</dt>
                    <dd className="mt-2 tabular-nums text-lg font-medium text-zinc-100">
                      {signals.h1Count}
                    </dd>
                  </div>
                  <div>
                    <dt className={sectionLabel}>H2</dt>
                    <dd className="mt-2 tabular-nums text-lg font-medium text-zinc-100">
                      {signals.h2Count}
                    </dd>
                  </div>
                </div>
              </dl>
              <p className="mt-8 text-[14px] leading-relaxed text-zinc-500">
                Align title, meta, and headings with the query and intent you want
                to win. Use the Actions tab to generate copy fixes per issue.
              </p>
            </div>
          </div>
        );

      case "ai":
        return (
          <div>
            <AiVisibilityPanel report={report} />
          </div>
        );

      case "conversion":
        return (
          <div className="space-y-8">
            <div className="max-w-md">
              <ScoreTile
                label="Conversion score"
                value={report.scores.conversion}
                icon={Target}
                accent="bg-gradient-to-r from-emerald-500 to-teal-500"
              />
            </div>
            <div className={`${panel} p-7 md:p-9`}>
              <p className={sectionLabel}>Quick wins</p>
              <ul className="mt-6 space-y-3">
                {report.quick_wins.map((row, i) => (
                  <li
                    key={i}
                    className="group flex gap-4 rounded-xl border border-white/[0.05] bg-black/25 p-5 transition-all duration-300 hover:border-white/[0.1] hover:bg-black/35"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500/80 transition-transform duration-300 group-hover:scale-105" />
                    <div>
                      <p className="font-medium leading-snug text-zinc-100">
                        {row.action}
                      </p>
                      {row.expected_result ? (
                        <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-500">
                          {row.expected_result}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case "content":
        return (
          <div className="space-y-10">
            <div className={`${panel} p-7 md:p-9`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={sectionLabel}>Content opportunities</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                    Ideas grounded in your audit
                  </h3>
                </div>
              </div>
              {report.content_opportunities.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">
                  No content angles in this run—try re-running the audit.
                </p>
              ) : (
                <ul className="mt-8 space-y-3">
                  {report.content_opportunities.map((row, i) => (
                    <li
                      key={i}
                      className="group flex gap-4 rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-all duration-300 hover:border-blue-500/20 hover:bg-black/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-semibold text-blue-300 transition-transform duration-300 group-hover:scale-105">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium leading-snug text-zinc-100">
                          {row.idea}
                        </p>
                        {row.why_it_works ? (
                          <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-500">
                            {row.why_it_works}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={`${panel} p-7 md:p-9`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className={sectionLabel}>14-day growth plan</p>
                  <p className="mt-2 text-[14px] text-zinc-400">
                    Daily ideas, hooks, and captions from this report.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runContentPlan}
                  disabled={planLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {planLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                  Generate plan
                </button>
              </div>
              {planError ? (
                <p className="mt-4 text-sm text-red-400">{planError}</p>
              ) : null}
              {planDays && planDays.length > 0 ? (
                <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                  {planDays.map((d, i) => (
                    <li
                      key={`${d.day}-${i}`}
                      className="rounded-xl border border-white/[0.06] bg-black/25 p-5 transition-colors duration-300 hover:border-white/[0.1]"
                    >
                      <p className={`${sectionLabel} text-blue-400/95`}>
                        Day {d.day}
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-100">
                        {d.content_idea}
                      </p>
                      <p className="mt-2 text-xs text-violet-300/90">
                        Hook: {d.hook}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        {d.caption}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        );

      case "competitors": {
        const ci = report.competitor_intelligence;
        if (!ci) {
          return (
            <div className={`${panel} p-7 md:p-9`}>
              <p className={sectionLabel}>Competitor intelligence</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                Add competitors to unlock gap analysis
              </h3>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-zinc-500">
                Enter 1–3 competitor URLs in the audit form and re-run the audit.
                If a competitor fails to load, the analysis still runs with the
                remaining competitors.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-10">
            <div className={`${panel} p-7 md:p-9`}>
              <p className={sectionLabel}>Summary</p>
              <p className="mt-5 text-[15px] leading-[1.7] text-zinc-300">
                {ci.summary}
              </p>
            </div>

            {ci.competitor_advantages.length > 0 ? (
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>What competitors do better</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {ci.competitor_advantages.map((row, i) => (
                    <div
                      key={`${row.competitor}-${i}`}
                      className="group rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-black/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] font-medium text-zinc-200">
                          {row.competitor}
                        </p>
                        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-200">
                          Advantage
                        </span>
                      </div>
                      <p className="mt-3 text-[14px] font-medium leading-relaxed text-white">
                        {row.advantage}
                      </p>
                      <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
                        {row.why_it_matters}
                      </p>
                      {row.evidence?.competitor_quotes?.length ? (
                        <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <p className={`${sectionLabel} text-zinc-500`}>
                            Evidence
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {row.evidence.competitor_quotes
                              .slice(0, 2)
                              .map((q, qi) => (
                                <li
                                  key={qi}
                                  className="text-[12px] leading-relaxed text-zinc-400"
                                >
                                  “{q}”
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              {ci.missing_opportunities.length > 0 ? (
                <div className={`${panel} p-7 md:p-9`}>
                  <p className={sectionLabel}>Missing opportunities</p>
                  <ul className="mt-6 space-y-3">
                    {ci.missing_opportunities.map((row, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-colors duration-300 hover:border-white/[0.12]"
                      >
                        <p className="text-[14px] font-medium text-white">
                          {row.opportunity}
                        </p>
                        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                          {row.why_missing_matters}
                        </p>
                        <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
                          {row.what_to_ship}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {ci.positioning_opportunities.length > 0 ? (
                <div className={`${panel} p-7 md:p-9`}>
                  <p className={sectionLabel}>Positioning opportunities</p>
                  <ul className="mt-6 space-y-3">
                    {ci.positioning_opportunities.map((row, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-violet-500/[0.06] to-transparent p-5 transition-colors duration-300 hover:border-violet-500/20"
                      >
                        <p className="text-[14px] font-medium text-white">
                          {row.idea}
                        </p>
                        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                          {row.why_it_works}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {ci.content_gaps.length > 0 ? (
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>Content gaps vs competitors</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {ci.content_gaps.map((row, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-colors duration-300 hover:border-blue-500/20"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-blue-300/90">
                        Topic
                      </p>
                      <p className="mt-2 text-[14px] font-medium text-white">
                        {row.topic}
                      </p>
                      <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
                        {row.why_missing_matters}
                      </p>
                      <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
                        Suggested angle: {row.suggested_angle}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ci.cta_improvements.length > 0 ? (
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>CTA upgrades (ready to paste)</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {ci.cta_improvements.map((row, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 transition-colors duration-300 hover:border-emerald-500/25"
                    >
                      <p className={`${sectionLabel} text-emerald-300/90`}>
                        Suggested rewrite
                      </p>
                      <p className="mt-2 text-[15px] font-medium text-white">
                        {row.suggested_rewrite}
                      </p>
                      <div className="mt-4 grid gap-2">
                        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <p className={sectionLabel}>Where to use</p>
                          <p className="mt-1 text-[13px] text-zinc-300">
                            {row.where_to_use}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <p className={sectionLabel}>Why it works</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                            {row.why_it_works}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <p className={sectionLabel}>Current problem</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                            {row.current_problem}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      }

      case "sprint": {
        if (!sprintPlan) {
          return (
            <div className={`${panel} p-7 md:p-9`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className={sectionLabel}>30-Day Growth Sprint</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    A practical roadmap from your audit
                  </h3>
                  <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-zinc-500">
                    Generate a week-by-week plan that sequences fixes, positioning,
                    and content moves based on your audit, AI visibility, and
                    competitor intelligence (if available).
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={runGrowthSprint}
                  disabled={sprintLoading}
                  whileTap={{ scale: sprintLoading ? 1 : 0.98 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-black/30 transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  {sprintLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="h-4 w-4" />
                  )}
                  Generate sprint
                </motion.button>
              </div>
              {sprintError ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5 text-[14px] text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  {sprintError}
                </div>
              ) : null}
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
                  <p className={sectionLabel}>Outputs</p>
                  <p className="mt-2 text-[14px] text-zinc-300">
                    4-week roadmap, quickest wins, and highest leverage moves.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
                  <p className={sectionLabel}>Designed for</p>
                  <p className="mt-2 text-[14px] text-zinc-300">
                    A small team shipping weekly improvements without busywork.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
                  <p className={sectionLabel}>Uses</p>
                  <p className="mt-2 text-[14px] text-zinc-300">
                    Issues, quick wins, content opportunities, AI visibility, and competitors.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-10">
            <div className={`${panel} p-7 md:p-9`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className={sectionLabel}>Sprint summary</p>
                  <p className="mt-5 text-[15px] leading-[1.7] text-zinc-300">
                    {sprintPlan.summary}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={runGrowthSprint}
                  disabled={sprintLoading}
                  whileTap={{ scale: sprintLoading ? 1 : 0.98 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 hover:shadow-emerald-500/25 disabled:opacity-50"
                >
                  {sprintLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Regenerate
                </motion.button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>Quickest wins</p>
                <ul className="mt-6 space-y-3">
                  {sprintPlan.quickest_wins.map((w, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-white/[0.06] bg-black/30 p-5"
                    >
                      <p className="text-[14px] font-medium text-white">
                        {w.title}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                        {w.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${panel} p-7 md:p-9`}>
                <p className={sectionLabel}>Highest leverage moves</p>
                <ul className="mt-6 space-y-3">
                  {sprintPlan.highest_leverage_moves.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-white/[0.06] bg-black/30 p-5"
                    >
                      <p className="text-[14px] font-medium text-white">
                        {m.title}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                        {m.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              {sprintPlan.weeks.map((w) => (
                <section key={w.week} className={`${panel} p-7 md:p-9`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className={sectionLabel}>Week {w.week}</p>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                        {w.theme}
                      </h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                        Goal: <span className="text-zinc-300">{w.goal}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {w.tasks.map((t, i) => (
                      <div
                        key={`${t.title}-${i}`}
                        className="group rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-black/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[14px] font-medium leading-snug text-white">
                            {t.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <Pill
                              tone={
                                t.priority === "high"
                                  ? "emerald"
                                  : t.priority === "medium"
                                    ? "amber"
                                    : "zinc"
                              }
                              label={t.priority}
                            />
                            <Pill
                              tone={
                                t.effort === "low"
                                  ? "blue"
                                  : t.effort === "medium"
                                    ? "violet"
                                    : "zinc"
                              }
                              label={`effort: ${t.effort}`}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
                          {t.description}
                        </p>
                        {t.estimated_impact ? (
                          <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                            <p className={sectionLabel}>Estimated impact</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                              {t.estimated_impact}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        );
      }

      case "actions":
        return (
          <div>
            {fixError ? (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5 text-[14px] text-amber-100 shadow-lg shadow-amber-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                {fixError}
              </div>
            ) : null}
            {(report.actions ?? []).length ? (
              <div className={`${panel} mb-8 p-7 md:p-9`}>
                <p className={sectionLabel}>Action engine</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                  Prioritized actions (do these in order)
                </h3>
                <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-zinc-500">
                  These aren’t generic recommendations—they’re sequenced moves with expected outcomes and execution steps.
                </p>

                <div className="mt-7 grid gap-4 lg:grid-cols-2">
                  {(report.actions ?? []).slice(0, 10).map((a, i) => (
                    <div
                      key={`${a.title}-${i}`}
                      className={`rounded-2xl border bg-black/30 p-6 transition-colors duration-300 hover:bg-black/35 ${
                        i < 3
                          ? "border-emerald-500/20 shadow-[0_0_48px_-28px_rgba(16,185,129,0.45)]"
                          : "border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                            {i < 3 ? "Top action" : "Action"}
                          </p>
                          <p className="mt-2 text-[15px] font-semibold leading-snug text-white">
                            {a.title}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <PriorityBadge priority={a.priority} />
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              a.impact === "high"
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                                : a.impact === "low"
                                  ? "border-white/[0.08] bg-white/[0.03] text-zinc-500"
                                  : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            impact: {a.impact}
                          </span>
                          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            effort: {a.effort}
                          </span>
                        </div>
                      </div>

                      {a.expected_result ? (
                        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                          <p className={sectionLabel}>Expected result</p>
                          <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                            {a.expected_result}
                          </p>
                        </div>
                      ) : null}

                      {a.why_it_matters ? (
                        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
                          <span className="font-medium text-zinc-300">
                            Why it matters:
                          </span>{" "}
                          {a.why_it_matters}
                        </p>
                      ) : null}

                      {Array.isArray(a.how_to_execute) && a.how_to_execute.length ? (
                        <div className="mt-5">
                          <p className={sectionLabel}>How to execute</p>
                          <ol className="mt-3 space-y-2.5">
                            {a.how_to_execute.slice(0, 7).map((step, si) => (
                              <li key={si} className="flex gap-3 text-[13px] leading-relaxed text-zinc-300">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.03] text-[11px] font-medium text-zinc-400">
                                  {si + 1}
                                </span>
                                <span className="min-w-0">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}

                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Keep user inside the audit flow; action execution is guided by steps + optional module links.
                            if (typeof (a as any).action_url === "string" && (a as any).action_url.startsWith("/dashboard/")) {
                              window.location.assign((a as any).action_url);
                              return;
                            }
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 hover:shadow-emerald-500/30 active:scale-[0.98]"
                        >
                          {a.cta || "Do this now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab("sprint")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.10] active:scale-[0.98]"
                        >
                          Add to sprint
                        </button>
                        <button
                          type="button"
                          onClick={() => window.location.assign("/dashboard/notifications")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.10] active:scale-[0.98]"
                        >
                          Create alert
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {report.top_issues.length === 0 ? (
              <p className="text-[14px] text-zinc-500">
                No issues returned for this URL.
              </p>
            ) : (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
                <div className="lg:w-[min(100%,400px)] lg:shrink-0 lg:border-r lg:border-white/[0.06] lg:pr-6">
                  <p className={`mb-4 ${sectionLabel}`}>Priority queue</p>
                  <ul className="space-y-1.5">
                    {sortedIssueIndices.map((idx) => {
                      const issue = report.top_issues[idx]!;
                      const active = selectedIssueIdx === idx;
                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => setSelectedIssueIdx(idx)}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all duration-200 ${
                              active
                                ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 shadow-[0_0_24px_-12px_rgba(16,185,129,0.35)]"
                                : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]"
                            } active:scale-[0.99]`}
                          >
                            <ChevronRight
                              className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ${
                                active
                                  ? "translate-x-0.5 text-emerald-400"
                                  : "text-zinc-600"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-medium leading-snug text-zinc-100">
                                {issue.title}
                              </p>
                              <div className="mt-2">
                                <PriorityBadge priority={issue.priority} />
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="min-h-[360px] flex-1 lg:min-w-0 lg:pl-2">
                  {selectedIssue && selectedIssueIdx !== null ? (
                    <div className="flex h-full flex-col gap-6 lg:flex-row lg:gap-8">
                      <div
                        className={`flex-1 space-y-5 ${panel} p-6`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-semibold leading-snug tracking-tight text-white">
                            {selectedIssue.title}
                          </h3>
                          <PriorityBadge priority={selectedIssue.priority} />
                        </div>
                        {selectedIssue.explanation ? (
                          <div>
                            <p className={sectionLabel}>Explanation</p>
                            <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                              {selectedIssue.explanation}
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <p className={sectionLabel}>Impact</p>
                          <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">
                            {selectedIssue.impact}
                          </p>
                        </div>
                        <div>
                          <p className={sectionLabel}>Suggested fix</p>
                          <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                            {selectedIssue.fix}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            requestFix(selectedIssue, selectedIssueIdx)
                          }
                          disabled={fixLoadingKey === `issue-${selectedIssueIdx}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:px-8"
                        >
                          {fixLoadingKey === `issue-${selectedIssueIdx}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          Fix this
                        </button>
                      </div>
                      <div className="flex-1 lg:max-w-[min(100%,520px)]">
                        <div
                          className={`mb-3 flex items-center gap-2 ${sectionLabel}`}
                        >
                          <PanelRight className="h-3.5 w-3.5 text-zinc-600" />
                          Generated output
                        </div>
                        {selectedFix ? (
                          <FixResultPanel fix={selectedFix} />
                        ) : (
                          <div
                            className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-black/30 p-10 text-center transition-colors duration-300 hover:border-white/[0.14]`}
                          >
                            <p className="max-w-xs text-[14px] leading-relaxed text-zinc-500">
                              Run &quot;Fix this&quot; to generate meta, headlines,
                              and copy tailored to this issue.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex min-h-[300px] flex-col items-center justify-center ${panel} p-10`}
                    >
                      <p className="max-w-sm text-center text-[14px] leading-relaxed text-zinc-500">
                        Select an issue from the queue to view details and
                        generate a fix.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={shell}>
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 lg:px-8">
        <ModulePageHeader moduleId="siteAudit" />
        <ModuleUsageBanner feature="audit" bump={usageBump} />

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0e14] p-6 shadow-[0_32px_64px_-32px_rgba(0,0,0,0.85)] md:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.09),transparent)]" />
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          {data ? (
            <div className="relative mb-6">
              <WorkspaceSessionBanner
                variant="dark"
                title={
                  auditWorkspaceReady
                    ? "Latest audit saved for this workspace"
                    : "Audit loaded"
                }
                hint={
                  auditWorkspaceReady
                    ? "Persists in this browser for this client until you start a new audit."
                    : undefined
                }
                actions={
                  <>
                    <motion.button
                      type="button"
                      onClick={startNewAudit}
                      disabled={loading}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Start new audit
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={exportAuditPdf}
                      disabled={loading || exportLoadingKey !== null}
                      whileTap={{
                        scale: loading || exportLoadingKey !== null ? 1 : 0.98,
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/[0.10] disabled:opacity-50"
                    >
                      {exportLoadingKey === "audit" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Export PDF
                    </motion.button>
                  </>
                }
              />
            </div>
          ) : null}
          {data && auditWorkspaceReady ? (
            <div className="relative mb-6">
              <ReviewWorkspaceStrip
                module="site_audit"
                variant="dark"
                reviewItemId={reviewItemId}
                onReviewItemIdChange={setReviewItemId}
                hasOutput={Boolean(data?.report)}
                title={url.trim() ? `Audit · ${url.trim()}` : "Growth audit"}
                summary={
                  data.signals.title
                    ? String(data.signals.title).slice(0, 280)
                    : undefined
                }
                buildPayload={() => ({
                  url,
                  competitors,
                  auditRunId: data.auditRunId ?? null,
                  pageTitle: data.signals.title,
                  signals: data.signals,
                })}
              />
            </div>
          ) : null}
          {data && auditWorkspaceReady && auditProgress ? (
            <div className="relative mb-6">
              <AuditProgressPanel
                progress={auditProgress}
                previousLabel={
                  auditProgress.previousRunAt
                    ? new Date(auditProgress.previousRunAt).toLocaleString()
                    : null
                }
              />
            </div>
          ) : null}
          <div className="relative flex flex-col gap-8">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-inner shadow-emerald-950/50">
                <Radar className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.28em] text-emerald-500/85">
                {m.productName}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-[2rem] md:leading-tight">
                AI Growth Agent
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500">
                Workspace view: jump between overview, pillars, and prioritized
                actions without losing context.
              </p>
            </div>
          </div>
          <div className="relative mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="audit-url"
                className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500"
              >
                Website URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors" />
                <input
                  id="audit-url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAudit()}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-3.5 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-[border,box-shadow] duration-200 focus:border-emerald-500/40 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] disabled:opacity-60"
                  disabled={loading}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {competitors.map((val, idx) => (
                  <div key={idx} className="min-w-0">
                    <label
                      htmlFor={`competitor-${idx}`}
                      className={sectionLabel}
                    >
                      Competitor {idx + 1} (optional)
                    </label>
                    <input
                      id={`competitor-${idx}`}
                      type="url"
                      placeholder="https://competitor.com"
                      value={val}
                      onChange={(e) =>
                        setCompetitors((prev) => {
                          const next = [...prev] as [string, string, string];
                          next[idx] = e.target.value;
                          return next;
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-[border,box-shadow] duration-200 focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] disabled:opacity-60"
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
                Add up to 3 competitors to unlock <span className="text-zinc-300">Competitor Intelligence</span>. If one fails to load, the audit still completes.
              </p>
            </div>
            <motion.button
              type="button"
              onClick={runAudit}
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/30 transition-[background,box-shadow] duration-200 hover:bg-emerald-500 hover:shadow-emerald-800/40 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Run audit
            </motion.button>
          </div>
          {error ? (
            <div className="relative mt-5 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3.5 text-[14px] text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              {error}
            </div>
          ) : null}
        </div>

        {data ? (
          <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
            <aside className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
              <nav
                className="sticky top-14 z-10 -mx-4 flex flex-row gap-1 overflow-x-auto rounded-none border-y border-white/[0.06] bg-[#0a0e14]/95 px-4 py-2 shadow-xl shadow-black/30 backdrop-blur-md sm:top-14 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-2xl lg:border lg:px-1.5 lg:py-1.5 lg:flex-col lg:overflow-visible"
                aria-label="Audit sections"
              >
                {NAV.map(({ id, label, icon: Icon }) => {
                  const active = tab === id;
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      layout
                      onClick={() => setTab(id)}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors duration-200 lg:w-full ${
                        active
                          ? "bg-white/[0.09] text-white shadow-sm"
                          : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                      }`}
                    >
                      {active ? (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-transparent"
                          transition={tabTransition}
                        />
                      ) : null}
                      <Icon
                        className={`relative z-[1] h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      />
                      <span className="relative z-[1] whitespace-nowrap">
                        {label}
                      </span>
                    </motion.button>
                  );
                })}
                {tab === "sprint" && (sprintPlan || data?.report?.growth_sprint) ? (
                  <motion.button
                    type="button"
                    onClick={exportSprintPdf}
                    disabled={exportLoadingKey !== null}
                    whileTap={{ scale: exportLoadingKey !== null ? 1 : 0.98 }}
                    className="relative mt-2 flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/[0.10] disabled:opacity-50 lg:w-full"
                  >
                    {exportLoadingKey === "sprint" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Export sprint PDF
                  </motion.button>
                ) : null}
              </nav>
            </aside>

            <main className="min-h-[min(70vh,640px)] min-w-0 flex-1 pb-20">
              <header className="mb-6 border-b border-white/[0.06] pb-5 lg:mb-8 lg:pb-6">
                <p className={sectionLabel}>Current view</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white lg:text-2xl">
                  {NAV.find((n) => n.id === tab)?.label}
                </h2>
              </header>
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  role="tabpanel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={tabTransition}
                  className="will-change-[opacity,transform]"
                >
                  {renderPanel()}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        ) : null}
      </div>
    </div>
  );
}
