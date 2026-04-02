"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import type { NotificationRow, NotificationSeverity } from "@/lib/notifications/types";

function severityDot(sev: NotificationSeverity) {
  if (sev === "critical") return "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.55)]";
  if (sev === "warning") return "bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.45)]";
  if (sev === "success") return "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.45)]";
  return "bg-cyan-300/80 shadow-[0_0_14px_rgba(34,211,238,0.35)]";
}

function clip(s: string, n: number) {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const badge = useMemo(() => {
    if (count <= 0) return null;
    return (
      <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-500 px-1.5 text-[10px] font-black text-violet-950 shadow-[0_10px_26px_-18px_rgba(139,92,246,0.75)]">
        {count > 99 ? "99+" : String(count)}
      </span>
    );
  }, [count]);

  const refreshCount = async () => {
    const res = await fetch("/api/notifications/unread-count");
    const json = await res.json().catch(() => ({}));
    if (res.ok && typeof json.count === "number") setCount(json.count);
  };

  const refreshItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=12");
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.items)) setItems(json.items as NotificationRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => void refreshCount(), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshItems();
    void refreshCount();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    void refreshCount();
  };

  const markAll = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    void refreshCount();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.04] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.98] ${
          compact ? "h-10 w-10" : "h-10 w-10"
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {badge}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#070a10]/90 shadow-[0_32px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                Alerts
              </p>
              <p className="mt-0.5 text-xs font-semibold text-white/85">
                {count > 0 ? `${count} unread` : "Nothing urgent"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAll()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/75 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <CheckCheck className="h-4 w-4" />
              Clear unread
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-sm text-white/60">
                <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-white/70">No alerts yet</p>
                <p className="mt-2 text-xs text-white/45">
                  AutoPilot and Product Health will surface the next best actions here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {items.map((n) => (
                  <li key={n.id} className="px-4 py-3 hover:bg-white/[0.03]">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityDot(n.severity)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white/90">
                          {n.title}
                          {!n.is_read ? (
                            <span className="ml-2 align-middle text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/90">
                              New
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-white/55">
                          {clip(n.message, 170)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {n.action_url ? (
                            <Link
                              href={n.action_url}
                              onClick={() => {
                                if (!n.is_read) void markRead(n.id);
                                setOpen(false);
                              }}
                              className="inline-flex items-center rounded-xl bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-violet-950 hover:bg-violet-400"
                            >
                              {n.action_label || "Open"}
                            </Link>
                          ) : null}
                          {!n.is_read ? (
                            <button
                              type="button"
                              onClick={() => void markRead(n.id)}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:border-white/20 hover:bg-white/[0.06]"
                            >
                              Dismiss
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="shrink-0 text-[10px] font-mono text-white/35">
                        {n.created_at ? formatWhen(n.created_at) : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-white/70 hover:text-white"
            >
              Open inbox
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-white/45 hover:text-white/70"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

