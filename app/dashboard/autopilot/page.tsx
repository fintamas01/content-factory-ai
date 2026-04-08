"use client";

import { useEffect, useMemo, useState } from "react";
import { Orbit, Play, Plus, ToggleLeft, ToggleRight, Link as LinkIcon } from "lucide-react";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { Spinner } from "@/app/components/ui/Spinner";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";
import type { PlanTier } from "@/lib/plan-config";
import { canAccess } from "@/lib/entitlements/features";
import { LockedFeatureStateClient } from "@/app/components/entitlements/LockedFeatureStateClient";

type Focus = "seo" | "content" | "conversion" | "ai_visibility";
const FOCUS: { id: Focus; label: string; desc: string }[] = [
  { id: "seo", label: "SEO", desc: "Search visibility & technical signals" },
  { id: "content", label: "Content", desc: "New angles grounded in audit" },
  { id: "conversion", label: "Conversion", desc: "Friction & next-step clarity" },
  { id: "ai_visibility", label: "AI visibility", desc: "How assistants interpret the page" },
];

type JobRow = {
  id: string;
  url: string;
  competitors: string[];
  frequency: "weekly";
  focus: Focus[];
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
};

type ResultRow = {
  id: string;
  job_id: string;
  summary: string;
  insights: Array<{
    id: string;
    title: string;
    explanation: string;
    tone?: string;
    action?: { label: string; href: string };
  }>;
  created_at: string;
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function AutoPilotPage() {
  const [plan, setPlan] = useState<PlanTier>("free");
  const [gateReady, setGateReady] = useState(false);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [focus, setFocus] = useState<Focus[]>(["seo", "conversion", "ai_visibility"]);
  const [enabled, setEnabled] = useState(true);

  const primaryJob = jobs[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing");
        const j = await res.json().catch(() => ({}));
        const p = (j?.plan ?? "free") as PlanTier;
        if (!cancelled) {
          setPlan(p);
          setGateReady(true);
        }
      } catch {
        if (!cancelled) setGateReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gateReady && !canAccess(plan, "autopilot")) {
    return (
      <Page>
        <ModulePageHeader moduleId="siteAudit" className="mb-2" />
        <LockedFeatureStateClient featureKey="autopilot" currentPlan={plan} />
      </Page>
    );
  }

  const competitors = useMemo(() => {
    return competitorsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [competitorsText]);

  useCopilotPageContext({
    page: "autopilot",
    data: {
      loading,
      saving,
      runningId,
      error,
      job: primaryJob
        ? {
            id: primaryJob.id,
            url: primaryJob.url,
            enabled: primaryJob.enabled,
            focus: primaryJob.focus,
            last_run_at: primaryJob.last_run_at,
          }
        : null,
      draft: {
        url,
        competitors,
        focus,
        enabled,
      },
      resultsPreview: results.slice(0, 4).map((r) => ({
        id: r.id,
        summary: r.summary?.slice(0, 280),
        created_at: r.created_at,
      })),
    },
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, resultsRes] = await Promise.all([
        fetch("/api/autopilot/jobs"),
        fetch("/api/autopilot/results?limit=20"),
      ]);
      const jobsJson = await jobsRes.json().catch(() => ({}));
      const resultsJson = await resultsRes.json().catch(() => ({}));
      if (!jobsRes.ok) throw new Error(jobsJson?.error || "Failed to load jobs.");
      if (!resultsRes.ok) throw new Error(resultsJson?.error || "Failed to load results.");
      const j = Array.isArray(jobsJson.jobs) ? (jobsJson.jobs as JobRow[]) : [];
      setJobs(j);
      setResults(Array.isArray(resultsJson.results) ? (resultsJson.results as ResultRow[]) : []);
      const first = j[0];
      if (first) {
        setUrl(first.url ?? "");
        setCompetitorsText((first.competitors ?? []).join("\n"));
        setFocus((first.focus ?? []) as Focus[]);
        setEnabled(Boolean(first.enabled));
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFocus = (id: Focus) => {
    setFocus((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveJob = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        url: url.trim(),
        competitors,
        frequency: "weekly",
        focus,
        enabled,
      };
      const res = primaryJob
        ? await fetch("/api/autopilot/jobs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: primaryJob.id, ...payload }),
          })
        : await fetch("/api/autopilot/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save.");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (jobId: string) => {
    setRunningId(jobId);
    setError(null);
    try {
      const res = await fetch("/api/autopilot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Run failed.");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Page>
      <ModulePageHeader moduleId="siteAudit" className="mb-2" />
      <PageHero
        icon={<Orbit className="h-6 w-6" aria-hidden />}
        eyebrow="AutoPilot"
        title="Continuous monitoring. Zero busywork."
        description="Enable weekly monitoring for your site. AutoPilot runs analysis, detects opportunities, and drops actionable insights into your feed."
        right={
          primaryJob ? (
            <Button
              variant="primary"
              size="lg"
              className="rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
              onClick={() => runNow(primaryJob.id)}
              disabled={runningId === primaryJob.id || loading}
            >
              {runningId === primaryJob.id ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              Run now
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              className="rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
              onClick={saveJob}
              disabled={saving || loading}
            >
              <Plus className="h-4 w-4" />
              Create job
            </Button>
          )
        }
      />

      {error ? (
        <Card className="p-5 border border-red-500/25 bg-red-500/[0.06]">
          <p className="text-sm font-semibold text-red-200">AutoPilot error</p>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-10 w-10" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Settings
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                  Monitoring job
                </p>
                <p className="mt-2 text-sm text-white/45">
                  MVP ships weekly monitoring. Run manually anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:border-white/16 hover:bg-white/[0.05]"
              >
                {enabled ? (
                  <ToggleRight className="h-5 w-5 text-emerald-300" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-white/40" />
                )}
                {enabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Website URL
                </label>
                <div className="relative">
                  <LinkIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Competitors (up to 3)
                </label>
                <Textarea
                  value={competitorsText}
                  onChange={(e) => setCompetitorsText(e.target.value)}
                  placeholder={"https://competitor-one.com\nhttps://competitor-two.com"}
                  rows={4}
                  className="resize-y"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Focus
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FOCUS.map((f) => {
                    const active = focus.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFocus(f.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-cyan-400/20 bg-gradient-to-r from-cyan-500/12 via-violet-500/[0.08] to-transparent text-white"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                        }`}
                      >
                        <p className="text-[12px] font-semibold tracking-tight">{f.label}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                          {f.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                onClick={saveJob}
                disabled={saving || !url.trim()}
              >
                {saving ? <Spinner className="h-4 w-4" /> : null}
                Save settings
              </Button>

              {primaryJob ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Status
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Last run: <span className="text-white/85">{fmt(primaryJob.last_run_at)}</span>
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    Frequency: <span className="text-white/70">Weekly (MVP)</span>
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Insights feed
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                    Latest opportunities
                  </p>
                  <p className="mt-2 text-sm text-white/45">
                    AutoPilot drops specific actions as your site and competitors evolve.
                  </p>
                </div>
              </div>
            </Card>

            {results.length === 0 ? (
              <EmptyState
                title="No AutoPilot runs yet."
                description="Create a job and click “Run now” to generate your first monitoring insight feed."
              />
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <Card key={r.id} className="p-5 sm:p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                      {fmt(r.created_at)}
                    </p>
                    <p className="mt-3 text-sm text-white/70">{r.summary}</p>
                    <div className="mt-5 grid gap-3">
                      {(Array.isArray(r.insights) ? r.insights : []).slice(0, 4).map((ins) => (
                        <div
                          key={ins.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <p className="text-sm font-semibold tracking-tight text-white">
                            {ins.title}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-white/45">
                            {ins.explanation}
                          </p>
                          {ins.action ? (
                            <div className="mt-4">
                              <a
                                href={ins.action.href}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/85 transition hover:border-white/16 hover:bg-white/[0.06]"
                              >
                                {ins.action.label}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

