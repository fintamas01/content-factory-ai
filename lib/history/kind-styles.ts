import type { HistoryKind } from "./types";

/** Shared visual language for History list + detail (UI only). */
export const KIND_VISUAL: Record<
  HistoryKind,
  {
    label: string;
    leftBar: string;
    iconRing: string;
    iconBg: string;
    iconText: string;
    badge: string;
    headerGradient: string;
  }
> = {
  content: {
    label: "Content",
    leftBar: "from-blue-500 via-cyan-400 to-cyan-500",
    iconRing: "ring-blue-500/30",
    iconBg: "from-blue-600/30 to-cyan-600/20",
    iconText: "text-cyan-200",
    badge: "border-blue-500/30 bg-blue-500/10 text-cyan-200",
    headerGradient: "from-blue-600/90 via-blue-500/50 to-cyan-500/30",
  },
  product: {
    label: "Products",
    leftBar: "from-violet-600 via-fuchsia-500 to-pink-500",
    iconRing: "ring-violet-500/30",
    iconBg: "from-violet-600/35 to-fuchsia-600/20",
    iconText: "text-fuchsia-100",
    badge: "border-violet-500/30 bg-violet-500/10 text-fuchsia-100",
    headerGradient: "from-violet-600/90 via-fuchsia-600/40 to-pink-500/30",
  },
  audit: {
    label: "Audit",
    leftBar: "from-emerald-500 via-teal-400 to-cyan-600",
    iconRing: "ring-emerald-500/30",
    iconBg: "from-emerald-600/35 to-teal-700/25",
    iconText: "text-emerald-100",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-teal-100",
    headerGradient: "from-emerald-600/90 via-teal-600/45 to-cyan-600/30",
  },
  matrix: {
    label: "Matrix",
    leftBar: "from-amber-500 via-orange-400 to-rose-500",
    iconRing: "ring-amber-500/30",
    iconBg: "from-amber-600/35 to-orange-600/20",
    iconText: "text-amber-100",
    badge: "border-amber-500/30 bg-amber-500/10 text-orange-100",
    headerGradient: "from-amber-600/80 via-orange-500/40 to-rose-500/30",
  },
};

export function formatHistoryDate(iso: string): { primary: string; sub: string } {
  try {
    const d = new Date(iso);
    const primary = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const sub = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { primary, sub };
  } catch {
    return { primary: "—", sub: "" };
  }
}
