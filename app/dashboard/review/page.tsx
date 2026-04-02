"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Send,
  Check,
  X,
  CircleCheck,
  ExternalLink,
  Filter,
  Sparkles,
} from "lucide-react";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import type { ReviewItemRow, ReviewModule, ReviewPermissions, ReviewStatus } from "@/lib/review/types";
import {
  ReviewModuleBadge,
  ReviewStatusBadge,
  reviewStatusAccentClass,
} from "@/app/components/review/ReviewBadges";

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  applied: "Applied",
};

const FILTER_ORDER = ["all", "draft", "in_review", "approved", "applied"] as const;

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItemRow[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [perms, setPerms] = useState<ReviewPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        filter === "all"
          ? "/api/review?limit=80"
          : `/api/review?limit=80&status=${encodeURIComponent(filter)}`;
      const res = await fetch(q);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not load queue.");
        setItems([]);
        return;
      }
      setItems((j.items as ReviewItemRow[]) ?? []);
      if (typeof j.viewerId === "string") setViewerId(j.viewerId);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadPerms = useCallback(async () => {
    const res = await fetch("/api/review/permissions");
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.permissions) setPerms(j.permissions);
  }, []);

  useEffect(() => {
    void loadPerms();
  }, [loadPerms]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLabel = useMemo(() => {
    if (filter === "all") return "All statuses";
    return STATUS_LABEL[filter];
  }, [filter]);

  const isFilteredEmpty = !loading && items.length === 0 && filter !== "all";

  const patch = async (id: string, action: "submit" | "approve" | "reject" | "apply") => {
    setActionId(`${id}:${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Action failed.");
        return;
      }
      await load();
    } finally {
      setActionId(null);
    }
  };

  const moduleHref = (m: ReviewModule): string => {
    switch (m) {
      case "content":
        return "/dashboard/content";
      case "products":
        return "/dashboard/products";
      case "site_audit":
        return "/dashboard/site-audit";
      case "playbooks":
        return "/dashboard/playbooks";
      case "matrix":
        return "/dashboard/matrix";
      default:
        return "/dashboard";
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#06080d] text-zinc-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[min(480px,55vh)] bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(16,185,129,0.12),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 py-10 md:px-8 lg:px-10">
        <ModulePageHeader moduleId="review" />

        <header className="relative mt-6 border-b border-white/[0.06] pb-10">
          <div className="absolute -left-px top-0 h-12 w-px bg-gradient-to-b from-emerald-400/60 via-emerald-500/20 to-transparent" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-500/80">
            Approvals
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-[2rem] md:leading-tight">
            Review queue
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            One place for drafts, reviews, and sign-off. Nothing ships to production until your team
            moves it forward.
          </p>
        </header>

        {/* Toolbar */}
        <div className="relative mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-[11px] font-medium text-zinc-500">
              <Filter className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
              Filter
            </span>
            <div
              className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-[#0a0e14]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              role="tablist"
              aria-label="Status filter"
            >
              {FILTER_ORDER.map((s) => {
                const active = filter === s;
                const label = s === "all" ? "All" : STATUS_LABEL[s];
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(s)}
                    className={`rounded-xl px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                      active
                        ? "bg-gradient-to-b from-white/[0.12] to-white/[0.04] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {perms?.role ? (
              <span className="hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500 sm:inline">
                Role{" "}
                <span className="ml-1 font-semibold capitalize text-zinc-200">{perms.role}</span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-[12px] font-semibold text-zinc-200 shadow-sm transition hover:border-white/[0.14] hover:bg-white/[0.07] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <p className="mt-4 text-[12px] text-zinc-500">
          <span className="text-zinc-400">{filteredLabel}</span>
          {!loading ? (
            <span className="ml-2 text-zinc-600">
              · {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          ) : null}
        </p>

        {error ? (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-100 shadow-[0_0_40px_-12px_rgba(244,63,94,0.35)]"
            role="alert"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
              !
            </span>
            <span>{error}</span>
          </div>
        ) : null}

        {/* Queue body */}
        <div className="mt-8">
          {loading ? (
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c1018]/60 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur-md">
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-24">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20 blur-xl" />
                  <Loader2 className="relative h-9 w-9 animate-spin text-emerald-400/80" aria-hidden />
                </div>
                <p className="text-sm font-medium text-zinc-400">Loading your queue…</p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-dashed border-white/[0.1] bg-gradient-to-b from-white/[0.03] to-transparent px-6 py-16 text-center shadow-inner">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]">
                <ClipboardCheck className="h-8 w-8 text-emerald-400/70" aria-hidden />
              </div>
              {isFilteredEmpty ? (
                <>
                  <p className="mt-6 text-lg font-semibold text-white">Nothing in this filter</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                    Try another status, or view everything to see the full pipeline.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 py-2.5 text-[12px] font-semibold text-zinc-200 transition hover:bg-white/[0.09]"
                  >
                    Show all items
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-6 text-lg font-semibold text-white">Your queue is ready</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                    When you or your team send AI output from Content, Products, Playbooks, Matrix, or
                    Growth Audit, it appears here for review—draft through applied.
                  </p>
                  <div className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-3 text-[12px] text-zinc-500">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400/80" aria-hidden />
                      Generate in any module
                    </span>
                    <span className="text-zinc-600">→</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
                      Send to review
                    </span>
                    <span className="text-zinc-600">→</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200/90">
                      Approve & apply
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((it) => {
                const busy = actionId?.startsWith(`${it.id}:`);
                const canSubmit =
                  it.status === "draft" &&
                  perms?.canSubmitForReview &&
                  viewerId !== null &&
                  it.user_id === viewerId;
                const showReviewer =
                  it.status === "in_review" && (perms?.canApprove || perms?.canReject);
                const showApply = it.status === "approved" && perms?.canMarkApplied;

                return (
                  <li key={it.id}>
                    <article
                      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c1018]/85 shadow-[0_20px_50px_-38px_rgba(0,0,0,0.85)] transition hover:border-white/[0.11] hover:shadow-[0_28px_60px_-40px_rgba(16,185,129,0.12)]"
                    >
                      <div
                        className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${reviewStatusAccentClass(it.status)}`}
                        aria-hidden
                      />
                      <div className="relative pl-5 pr-4 py-5 sm:pl-6 sm:pr-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <ReviewModuleBadge module={it.module} />
                              <ReviewStatusBadge status={it.status} />
                            </div>
                            <div>
                              <h2 className="text-lg font-semibold leading-snug tracking-tight text-white group-hover:text-white">
                                {it.title}
                              </h2>
                              {it.summary ? (
                                <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-zinc-500">
                                  {it.summary}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                              <span>
                                Created{" "}
                                <time dateTime={it.created_at} className="text-zinc-500">
                                  {new Date(it.created_at).toLocaleString()}
                                </time>
                              </span>
                              {it.reviewed_at ? (
                                <span>
                                  Reviewed{" "}
                                  <time dateTime={it.reviewed_at} className="text-zinc-500">
                                    {new Date(it.reviewed_at).toLocaleString()}
                                  </time>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Actions: secondary left, primary right */}
                          <div className="flex w-full flex-col gap-2 sm:w-auto lg:min-w-[280px] lg:items-end">
                            <div className="flex w-full flex-wrap items-center justify-end gap-2">
                              <Link
                                href={moduleHref(it.module)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-zinc-200"
                              >
                                Open module
                                <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                              </Link>
                            </div>
                            <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-white/[0.05] pt-3 lg:border-t-0 lg:pt-0">
                              {canSubmit ? (
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => void patch(it.id, "submit")}
                                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-50 sm:flex-none"
                                >
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <Send className="h-4 w-4" aria-hidden />
                                  )}
                                  Submit for review
                                </button>
                              ) : null}
                              {showReviewer ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={!!busy}
                                    onClick={() => void patch(it.id, "reject")}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-[11px] font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                                  >
                                    {busy ? (
                                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                      <X className="h-4 w-4" aria-hidden />
                                    )}
                                    Send back
                                  </button>
                                  {perms?.canApprove ? (
                                    <button
                                      type="button"
                                      disabled={!!busy}
                                      onClick={() => void patch(it.id, "approve")}
                                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/35 transition hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                      {busy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                      ) : (
                                        <Check className="h-4 w-4" aria-hidden />
                                      )}
                                      Approve
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                              {showApply ? (
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => void patch(it.id, "apply")}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-gradient-to-b from-sky-500/20 to-sky-900/20 px-5 text-[11px] font-bold uppercase tracking-wider text-sky-100 shadow-[0_0_24px_-10px_rgba(56,189,248,0.4)] transition hover:border-sky-400/45 disabled:opacity-50"
                                >
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <CircleCheck className="h-4 w-4" aria-hidden />
                                  )}
                                  Mark applied
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
