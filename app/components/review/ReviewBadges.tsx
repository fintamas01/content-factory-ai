"use client";

import type { ComponentType } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileEdit,
  LayoutGrid,
  Megaphone,
  Package,
  Radar,
  Sparkles,
} from "lucide-react";
import type { ReviewModule, ReviewStatus } from "@/lib/review/types";

const STATUS_META: Record<
  ReviewStatus,
  { label: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  draft: {
    label: "Draft",
    Icon: FileEdit,
    className:
      "border-zinc-500/35 bg-zinc-500/10 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  },
  in_review: {
    label: "In review",
    Icon: Eye,
    className:
      "border-amber-400/35 bg-gradient-to-b from-amber-500/20 to-amber-600/10 text-amber-50 shadow-[0_0_20px_-8px_rgba(251,191,36,0.45)]",
  },
  approved: {
    label: "Approved",
    Icon: CheckCircle2,
    className:
      "border-emerald-400/35 bg-gradient-to-b from-emerald-500/18 to-emerald-700/10 text-emerald-50 shadow-[0_0_20px_-8px_rgba(52,211,153,0.35)]",
  },
  applied: {
    label: "Applied",
    Icon: BadgeCheck,
    className:
      "border-sky-400/35 bg-gradient-to-b from-sky-500/18 to-cyan-800/10 text-sky-50 shadow-[0_0_22px_-8px_rgba(56,189,248,0.35)]",
  },
};

const MODULE_META: Record<
  ReviewModule,
  { label: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  content: {
    label: "Content",
    Icon: Megaphone,
    className: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  },
  products: {
    label: "Products",
    Icon: Package,
    className: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  },
  site_audit: {
    label: "Growth audit",
    Icon: Radar,
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  },
  playbooks: {
    label: "Playbooks",
    Icon: Sparkles,
    className: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-200",
  },
  matrix: {
    label: "Matrix",
    Icon: LayoutGrid,
    className: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200",
  },
};

/** Accent line color for queue cards (left border) */
export function reviewStatusAccentClass(status: ReviewStatus): string {
  switch (status) {
    case "draft":
      return "from-zinc-500/80 via-zinc-400/40 to-transparent";
    case "in_review":
      return "from-amber-400/90 via-amber-500/30 to-transparent";
    case "approved":
      return "from-emerald-400/90 via-emerald-500/30 to-transparent";
    case "applied":
      return "from-sky-400/90 via-cyan-500/30 to-transparent";
    default:
      return "from-zinc-500/50 to-transparent";
  }
}

export function ReviewStatusBadge({
  status,
  size = "md",
}: {
  status: ReviewStatus;
  size?: "sm" | "md";
}) {
  const meta = STATUS_META[status];
  const { Icon } = meta;
  const pad = size === "sm" ? "gap-1 px-2 py-0.5 text-[9px]" : "gap-1.5 px-2.5 py-1 text-[10px]";
  const iconSz = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.14em] ${pad} ${meta.className}`}
    >
      <Icon className={`${iconSz} shrink-0 opacity-90`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function ReviewModuleBadge({ module }: { module: ReviewModule }) {
  const meta = MODULE_META[module];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-wide ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      {meta.label}
    </span>
  );
}
