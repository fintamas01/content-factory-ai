"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  History,
  Loader2,
  Search,
  Trash2,
  ExternalLink,
  FileText,
  Package,
  Radar,
  LayoutGrid,
} from "lucide-react";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import type { HistoryKind, HistoryListItem } from "@/lib/history/types";
import { KIND_LABEL } from "@/lib/history/map-rows";
import {
  KIND_VISUAL,
  formatHistoryDate,
} from "@/lib/history/kind-styles";
import { HistoryDetailModal } from "@/app/components/history/HistoryDetailModal";
import { Input } from "@/app/components/ui/Input";
import { Card } from "@/app/components/ui/Card";

type FilterTab = "all" | HistoryKind;
type HistoryApiError = { table: string; message: string; code?: string };

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "content", label: "Content" },
  { id: "product", label: "Products" },
  { id: "audit", label: "Audit" },
  { id: "matrix", label: "Matrix" },
];

function kindIcon(kind: HistoryKind) {
  switch (kind) {
    case "content":
      return FileText;
    case "product":
      return Package;
    case "audit":
      return Radar;
    default:
      return LayoutGrid;
  }
}

function tabButtonClass(active: boolean, tabId: FilterTab): string {
  if (!active) {
    return "border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-white/15 hover:bg-white/[0.06] hover:text-slate-300";
  }
  switch (tabId) {
    case "all":
      return "border border-white/20 bg-white/[0.12] text-white shadow-lg shadow-black/20";
    case "content":
      return "border border-transparent bg-blue-600 text-white shadow-lg shadow-blue-600/25";
    case "product":
      return "border border-transparent bg-violet-600 text-white shadow-lg shadow-violet-600/25";
    case "audit":
      return "border border-transparent bg-emerald-600 text-white shadow-lg shadow-emerald-600/25";
    case "matrix":
      return "border border-transparent bg-amber-600 text-white shadow-lg shadow-amber-600/25";
    default:
      return "border border-white/20 bg-white/[0.12] text-white";
  }
}

export default function DashboardHistoryPage() {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<HistoryApiError[]>([]);
  const [tab, setTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HistoryListItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/history");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to load history.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setWarnings(Array.isArray(json.errors) ? json.errors : []);
    } catch {
      setError("Network error.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab !== "all") {
      list = list.filter((i) => i.kind === tab);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.preview.toLowerCase().includes(q)
    );
  }, [items, tab, query]);

  const deleteItem = async (e: React.MouseEvent, item: HistoryListItem) => {
    e.stopPropagation();
    if (!confirm("Delete this item from your history?")) return;
    setDeleting(item.id);
    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, kind: item.kind }),
      });
      if (!res.ok) {
        alert("Could not delete.");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setSelected((s) => (s?.id === item.id ? null : s));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 p-4 sm:p-6 lg:p-8 text-white">
      <nav
        className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45"
        aria-label="Breadcrumb"
      >
        <Link
          href="/dashboard"
          className="text-white/40 transition hover:text-white/70"
        >
          {PLATFORM_DISPLAY_NAME}
        </Link>
        <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
        <span className="text-cyan-200/90">History</span>
      </nav>

      <header className="cf-hero rounded-[28px] p-6 sm:p-8">
        <div className="relative flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent" />
            <History className="relative h-7 w-7 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              History
            </h1>
            <p className="mt-1 text-sm font-medium text-white/55">
              Everything you&apos;ve generated — organized by module.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${tabButtonClass(tab === t.id, t.id)}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="pl-11 rounded-2xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : warnings.length ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold">Some history sources failed to load.</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
            {warnings.slice(0, 4).map((w, idx) => (
              <li key={`${w.table}-${idx}`}>
                <span className="font-semibold">{w.table}</span>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-black/15 py-20 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="font-bold text-slate-400">No saved activity yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Use Content, Products, or Site audit — outputs you save will show up here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-black/15 py-16 text-center">
          <p className="font-bold text-slate-400">No matches</p>
          <p className="mt-2 text-sm text-slate-500">
            Try another tab or clear the search.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const Icon = kindIcon(item.kind);
            const vis = KIND_VISUAL[item.kind];
            const { primary, sub } = item.created_at
              ? formatHistoryDate(item.created_at)
              : { primary: "—", sub: "" };
            return (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" onClick={() => setSelected(item)} className="w-full">
                  <Card className="group flex w-full gap-0 rounded-[22px] text-left">
                  <div
                    className={`w-1 shrink-0 bg-gradient-to-b ${vis.leftBar}`}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 items-start gap-4 p-4 pl-4 md:p-5">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${vis.iconBg} ring-2 ${vis.iconRing} shadow-inner`}
                    >
                      <Icon className={`h-5 w-5 opacity-95 ${vis.iconText}`} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] ${vis.badge}`}
                        >
                          {KIND_LABEL[item.kind]}
                        </span>
                        <span className="text-[11px] font-medium tabular-nums text-slate-500">
                          {primary}
                          {sub ? (
                            <span className="ml-1.5 font-normal text-slate-600">
                              {sub}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-slate-50">
                        {item.title}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                        {item.preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-0 transition group-hover:opacity-100">
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => deleteItem(e, item)}
                        disabled={deleting === item.id}
                        className="rounded-xl p-2 text-slate-600 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deleting === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <HistoryDetailModal item={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
