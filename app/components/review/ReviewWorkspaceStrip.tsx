"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, Send, RotateCcw, Check, X, CircleCheck } from "lucide-react";
import type { ReviewItemRow, ReviewModule, ReviewPermissions } from "@/lib/review/types";
import { ReviewModuleBadge, ReviewStatusBadge } from "@/app/components/review/ReviewBadges";

export function ReviewWorkspaceStrip(props: {
  module: ReviewModule;
  reviewItemId: string | null;
  onReviewItemIdChange: (id: string | null) => void;
  hasOutput: boolean;
  buildPayload: () => Record<string, unknown>;
  title: string;
  summary?: string;
  /** Dark card (site audit / playbooks) vs light border */
  variant?: "dark" | "light";
}) {
  const {
    module,
    reviewItemId,
    onReviewItemIdChange,
    hasOutput,
    buildPayload,
    title,
    summary,
    variant = "light",
  } = props;

  const [perms, setPerms] = useState<ReviewPermissions | null>(null);
  const [item, setItem] = useState<ReviewItemRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    const res = await fetch("/api/review/permissions");
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.permissions) setPerms(j.permissions);
  }, []);

  const loadItem = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/review/${id}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setItem(null);
          onReviewItemIdChange(null);
          return;
        }
        setItem(j.item as ReviewItemRow);
      } finally {
        setLoading(false);
      }
    },
    [onReviewItemIdChange]
  );

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (reviewItemId) void loadItem(reviewItemId);
    else setItem(null);
  }, [reviewItemId, loadItem]);

  const shell =
    variant === "dark"
      ? "border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      : "border border-white/[0.1] bg-gradient-to-b from-slate-900/80 to-slate-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

  const postReview = async (status: "draft" | "in_review") => {
    setActionLoading("post");
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          title: title.slice(0, 500),
          summary: summary?.slice(0, 2000),
          payload: buildPayload(),
          status,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not create review item.");
        return;
      }
      const created = j.item as ReviewItemRow;
      onReviewItemIdChange(created.id);
      setItem(created);
    } finally {
      setActionLoading(null);
    }
  };

  const patchAction = async (action: "submit" | "approve" | "reject" | "apply") => {
    if (!reviewItemId) return;
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/review/${reviewItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Action failed.");
        return;
      }
      setItem(j.item as ReviewItemRow);
    } finally {
      setActionLoading(null);
    }
  };

  if (!perms) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-medium text-zinc-500 ${shell}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-emerald-500/70" aria-hidden />
        Loading review workflow…
      </div>
    );
  }

  const showCreate =
    hasOutput && !reviewItemId && perms.canSubmitForReview && !loading;
  const showDraftActions =
    item?.status === "draft" && reviewItemId && perms.canSubmitForReview;
  const showReviewer =
    item?.status === "in_review" && (perms.canApprove || perms.canReject);
  const showApply = item?.status === "approved" && perms.canMarkApplied;

  return (
    <div className={`relative overflow-hidden rounded-2xl px-4 py-4 ${shell}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-inner ${
              variant === "dark"
                ? "border-white/10 bg-white/[0.05] text-emerald-300/90 shadow-emerald-950/40"
                : "border-white/10 bg-white/[0.06] text-emerald-400/90"
            }`}
          >
            <ClipboardCheck className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ReviewModuleBadge module={module} />
              {item ? <ReviewStatusBadge status={item.status} size="sm" /> : null}
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" aria-hidden />
              ) : null}
            </div>
            <p className="mt-2 text-[12px] font-medium leading-snug text-zinc-300">
              {item
                ? "Synced with the team queue."
                : "Queue this output for approval before go-live."}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              {item
                ? "Updates here match the Review queue for this workspace."
                : "Reviewers get notified when you send to review."}
            </p>
            {error ? (
              <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/dashboard/review"
            className="inline-flex items-center justify-center rounded-lg px-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-500/90 transition hover:text-emerald-400 sm:justify-end"
          >
            Open queue →
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
          {showCreate ? (
            <>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => void postReview("draft")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {actionLoading === "post" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Save draft
              </button>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => void postReview("in_review")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {actionLoading === "post" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send to review
              </button>
            </>
          ) : null}

          {showDraftActions ? (
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => void patchAction("submit")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {actionLoading === "submit" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit for review
            </button>
          ) : null}

          {showReviewer ? (
            <>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => void patchAction("reject")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {actionLoading === "reject" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Send back
              </button>
              {perms.canApprove ? (
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => void patchAction("approve")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {actionLoading === "approve" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>
              ) : null}
            </>
          ) : null}

          {showApply ? (
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => void patchAction("apply")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-gradient-to-b from-sky-500/20 to-sky-900/25 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sky-100 shadow-[0_0_20px_-8px_rgba(56,189,248,0.35)] transition hover:border-sky-400/50 disabled:opacity-50"
            >
              {actionLoading === "apply" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5" />
              )}
              Mark as applied
            </button>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
