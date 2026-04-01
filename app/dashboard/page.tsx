import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  Orbit,
  Megaphone,
  Package,
  Radar,
  Sparkles,
  Target,
  MessageCircleQuestion,
  TrendingUp,
  PanelRight,
} from "lucide-react";
import { MODULES, PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { requireActiveClientId } from "@/lib/clients/server";
import { buildUsageSummary } from "@/lib/usage/usage-service";
import {
  mapAuditRow,
  mapContentRow,
  mapMatrixRow,
  mapProductRow,
  mergeAndSort,
} from "@/lib/history/map-rows";
import type { GrowthAuditReport, GrowthSprintPlan } from "@/lib/site-audit/types";

function pillClass(tone: "emerald" | "blue" | "violet" | "amber" | "zinc") {
  if (tone === "emerald")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "blue") return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  if (tone === "violet")
    return "border-violet-500/25 bg-violet-500/10 text-violet-200";
  if (tone === "amber")
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function accentClass(tone: "emerald" | "blue" | "violet" | "amber" | "zinc") {
  if (tone === "emerald") return "from-emerald-500/55 via-teal-400/35 to-transparent";
  if (tone === "blue") return "from-blue-500/55 via-cyan-400/35 to-transparent";
  if (tone === "violet") return "from-violet-500/55 via-fuchsia-400/35 to-transparent";
  if (tone === "amber") return "from-amber-500/55 via-orange-400/35 to-transparent";
  return "from-white/25 via-white/10 to-transparent";
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  helper,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "blue" | "violet" | "amber" | "zinc";
  helper?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_80px_-44px_rgba(0,0,0,0.9)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_44px_90px_-46px_rgba(0,0,0,0.85)]">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClass(tone)}`} />
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.04] blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/[0.02] blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-[44px] font-semibold tracking-tight text-white leading-none">
            {value}
          </p>
          {helper ? (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
              {helper}
            </p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-inner ${pillClass(
            tone
          )}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default async function PlatformDashboardPage() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <p className="text-slate-500">Server configuration error.</p>
      </div>
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If auth guard exists elsewhere, this is just a safe fallback.
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <p className="text-slate-500">Please sign in.</p>
      </div>
    );
  }

  let clientId: string;
  try {
    const active = await requireActiveClientId(supabase, cookieStore, user.id);
    clientId = active.clientId;
  } catch {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <p className="text-slate-500">Could not resolve active client.</p>
      </div>
    );
  }

  const [usage, latestAuditRes, recentRes, latestAutopilotRes] = await Promise.all([
    buildUsageSummary(supabase, user.id, clientId),
    supabase
      .from("site_audit_runs")
      .select("id, page_url, report, created_at, signals")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (async () => {
      const LIMIT = 18;
      const [genRes, prodRes, auditRes, matrixRes] = await Promise.all([
        supabase
          .from("generations")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        supabase
          .from("product_generations")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        supabase
          .from("site_audit_runs")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        supabase
          .from("matrix_generations")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
      ]);

      const items = mergeAndSort([
        ...(genRes.data ?? []).map((r) => mapContentRow(r as any)),
        ...(prodRes.data ?? []).map((r) => mapProductRow(r as any)),
        ...(auditRes.data ?? []).map((r) => mapAuditRow(r as any)),
        ...(matrixRes.data ?? []).map((r) => mapMatrixRow(r as any)),
      ]).slice(0, 10);

      return { items };
    })(),
    supabase
      .from("autopilot_results")
      .select("id, summary, insights, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestAuditRow = latestAuditRes.data as
    | {
        id: string;
        page_url: string;
        report: unknown;
        created_at: string;
        signals?: unknown;
      }
    | null;

  const latestReport = (latestAuditRow?.report ?? null) as GrowthAuditReport | null;
  const scores = latestReport?.scores;
  const ci = latestReport?.competitor_intelligence;
  const sprint = (latestReport as any)?.growth_sprint as GrowthSprintPlan | undefined;
  const latestAutopilot = (latestAutopilotRes as any)?.data as
    | { id: string; summary: string; insights: any; created_at: string }
    | null;

  const topActions = (() => {
    if (!latestReport) return [];
    const issues = [...(latestReport.top_issues ?? [])].sort(
      (a, b) =>
        (a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2) -
        (b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2)
    );
    const picks = issues.slice(0, 3).map((it) => ({
      title: it.title,
      reason: it.impact || it.explanation || "High-impact improvement.",
      priority: it.priority,
      href: "/dashboard/site-audit",
      cta: "Open Audit",
    }));
    return picks;
  })();

  const currentWeek = sprint?.weeks?.find((w) => w.week === 1) ?? sprint?.weeks?.[0];
  const currentWeekTasks = currentWeek?.tasks?.slice(0, 3) ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#080c14] via-[#070b12] to-[#05070c] pb-24">
      <div className="mx-auto max-w-6xl space-y-10 p-4 sm:space-y-12 sm:p-6 lg:p-8">
        <header className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0e14] p-5 sm:p-8 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_55%_-20%,rgba(16,185,129,0.12),transparent)]" />
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/45 to-transparent" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <LayoutDashboard className="h-4 w-4 text-emerald-400" />
                {PLATFORM_DISPLAY_NAME} · Command Center
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Executive Dashboard
              </h1>
              <p className="max-w-2xl text-[15px] leading-relaxed text-slate-500">
                Your operating view across site health, priorities, opportunities, and execution.
              </p>
            </div>
            {latestAuditRow ? (
              <div className="rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3 text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Latest audit
                </p>
                <p className="mt-1 break-all font-mono text-[12px] text-slate-300">
                  {latestAuditRow.page_url}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        {/* A) Top summary row */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Site health snapshot
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                KPIs
              </h2>
            </div>
            <Link
              href="/dashboard/site-audit"
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white transition hover:border-emerald-500/25 hover:bg-emerald-500/10 md:inline-flex"
            >
              Open audit workspace
              <ArrowRight className="h-3.5 w-3.5 opacity-80" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="SEO score"
            value={scores ? String(scores.seo) : "—"}
            icon={TrendingUp}
            tone="blue"
            helper={latestAuditRow ? "From latest audit" : "Run an audit to populate"}
          />
          <KpiCard
            label="AI visibility"
            value={scores ? String(scores.ai_discoverability) : "—"}
            icon={MessageCircleQuestion}
            tone="amber"
            helper={latestAuditRow ? "AI-mediated discovery" : "No audit yet"}
          />
          <KpiCard
            label="Conversion"
            value={scores ? String(scores.conversion) : "—"}
            icon={Target}
            tone="emerald"
            helper={latestAuditRow ? "Clarity + next-step strength" : "No audit yet"}
          />
          <KpiCard
            label="Plan / usage"
            value={usage.plan === "pro" ? "Pro" : "Free"}
            icon={Sparkles}
            tone={usage.plan === "pro" ? "violet" : "zinc"}
            helper={`Audits ${usage.usage.audit}/${usage.limits.audits_per_month} · Content ${usage.usage.content}/${usage.limits.content_generations_per_month}`}
          />
          </div>
        </section>

        {/* AutoPilot highlight */}
        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e14] p-6 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_-10%,rgba(34,211,238,0.10),transparent)]" />
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  AutoPilot monitoring
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {latestAutopilot ? "New opportunity detected" : "Enable AutoPilot"}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
                  {latestAutopilot
                    ? latestAutopilot.summary
                    : "Weekly monitoring that generates actionable insights—even when you don’t log in."}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200 shadow-inner">
                <Orbit className="h-6 w-6" />
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/autopilot"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-[11px] font-semibold text-cyan-950 shadow-[0_18px_44px_-28px_rgba(34,211,238,0.6)] transition hover:bg-cyan-400 active:scale-[0.98]"
              >
                Open AutoPilot
                <ArrowRight className="h-3.5 w-3.5 opacity-80" />
              </Link>
              <Link
                href="/dashboard/site-audit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.98]"
              >
                Run Audit
                <ArrowRight className="h-3.5 w-3.5 opacity-70" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Last AutoPilot run
            </p>
            <p className="mt-3 font-mono text-[12px] text-slate-300">
              {latestAutopilot ? latestAutopilot.created_at : "—"}
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Tip: Run AutoPilot after major site changes or new competitor launches.
            </p>
          </div>
        </section>

        {/* Quick actions */}
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Quick actions
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Launch points
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/site-audit"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-emerald-500/25 hover:bg-emerald-500/10"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Quick action
                </p>
                <p className="mt-2 text-[15px] font-semibold text-white">Run Audit</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Scores, actions, competitors, sprint
                </p>
              </div>
              <Radar className="h-5 w-5 text-emerald-400" />
            </div>
          </Link>
          <Link
            href="/dashboard/content"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-blue-500/25 hover:bg-blue-500/10"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Quick action
                </p>
                <p className="mt-2 text-[15px] font-semibold text-white">Generate Content</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Hooks, captions, campaigns
                </p>
              </div>
              <Megaphone className="h-5 w-5 text-blue-300" />
            </div>
          </Link>
          <Link
            href="/dashboard/products"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-violet-500/25 hover:bg-violet-500/10"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Quick action
                </p>
                <p className="mt-2 text-[15px] font-semibold text-white">Generate Product</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Listings, titles, descriptions
                </p>
              </div>
              <Package className="h-5 w-5 text-violet-300" />
            </div>
          </Link>
          <Link
            href="/dashboard/brand"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-white/[0.14] hover:bg-white/[0.06]"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/[0.06] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Quick action
                </p>
                <p className="mt-2 text-[15px] font-semibold text-white">Brand Profile</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Voice, positioning, constraints
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300" />
            </div>
          </Link>
          </div>
        </section>

        {/* Priority Actions */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e14] p-7 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_-10%,rgba(16,185,129,0.10),transparent)]" />
            <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Priority actions
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  What to do next
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
                  Pulled from your latest audit. Fix the bottlenecks before scaling traffic.
                </p>
              </div>
              <ClipboardList className="h-5 w-5 text-emerald-400" />
            </div>

            {latestAuditRow && topActions.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {topActions.map((a, i) => (
                  <li
                    key={i}
                    className="group rounded-xl border border-white/[0.06] bg-black/30 p-5 transition-[transform,border-color,background] duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-black/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-snug text-white">
                          {a.title}
                        </p>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                          {a.reason}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          a.priority === "high"
                            ? pillClass("emerald")
                            : a.priority === "medium"
                              ? pillClass("amber")
                              : pillClass("zinc")
                        }`}
                      >
                        {a.priority}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Link
                        href={a.href}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-emerald-500/25 hover:bg-emerald-500/10 active:scale-[0.98]"
                      >
                        {a.cta}
                        <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-white/[0.1] bg-black/20 p-7">
                <p className="text-[14px] leading-relaxed text-slate-500">
                  Run your first audit to generate priority actions.
                </p>
                <Link
                  href="/dashboard/site-audit"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 active:scale-[0.98]"
                >
                  Run Audit
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Latest Growth Sprint */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e14] p-7 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_-10%,rgba(139,92,246,0.10),transparent)]" />
              <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                    Latest growth sprint
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    30-day roadmap preview
                  </h2>
                </div>
                <Sparkles className="h-5 w-5 text-violet-300" />
              </div>

              {sprint && currentWeek ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Week {currentWeek.week}
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-white">
                      {currentWeek.theme}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                      Goal: <span className="text-slate-300">{currentWeek.goal}</span>
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {currentWeekTasks.map((t, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/[0.06] bg-black/25 p-4"
                      >
                        <p className="text-[13px] font-medium text-white">{t.title}</p>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                          {t.estimated_impact}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/dashboard/site-audit"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-violet-500/25 hover:bg-violet-500/10 active:scale-[0.98]"
                  >
                    View Sprint
                    <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-white/[0.1] bg-black/20 p-7">
                  <p className="text-[14px] leading-relaxed text-slate-500">
                    No sprint saved yet. Generate one from your latest audit.
                  </p>
                  <Link
                    href="/dashboard/site-audit"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 active:scale-[0.98]"
                  >
                    Open Audit Workspace
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
              </div>
            </div>

            {/* Competitor Snapshot */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e14] p-7 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_-10%,rgba(59,130,246,0.10),transparent)]" />
              <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                    Competitor snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    One insight to act on
                  </h2>
                </div>
                <PanelRight className="h-5 w-5 text-blue-300" />
              </div>

              {ci ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Key advantage
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-white">
                      {ci.competitor_advantages[0]?.advantage ?? "—"}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                      {ci.competitor_advantages[0]?.why_it_matters ?? ""}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/25 p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Missed opportunity
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-white">
                      {ci.missing_opportunities[0]?.opportunity ?? "—"}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                      {ci.missing_opportunities[0]?.what_to_ship ?? ""}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/site-audit"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white transition hover:border-blue-500/25 hover:bg-blue-500/10 active:scale-[0.98]"
                  >
                    Open Competitor Intelligence
                    <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-white/[0.1] bg-black/20 p-7">
                  <p className="text-[14px] leading-relaxed text-slate-500">
                    Add 1–3 competitors in the audit workspace to unlock gap analysis.
                  </p>
                  <Link
                    href="/dashboard/site-audit"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 active:scale-[0.98]"
                  >
                    Run Audit + Competitors
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
              </div>
            </div>
          </div>
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0a0e14] p-5 sm:p-7 shadow-[0_36px_90px_-56px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Recent activity
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                What you shipped recently
              </h2>
            </div>
            <Activity className="h-5 w-5 text-slate-300" />
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {recentRes.items.map((it) => (
              <li
                key={`${it.kind}-${it.id}`}
                className="group rounded-xl border border-white/[0.06] bg-black/25 p-5 transition-[transform,border-color,background] duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-black/35"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  {it.kind}
                </p>
                <p className="mt-2 text-[14px] font-medium text-white">{it.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  {it.preview}
                </p>
                <div className="mt-4 flex justify-end">
                  <Link
                    href="/dashboard/history"
                    className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-300 transition hover:text-white"
                  >
                    Open History
                    <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
