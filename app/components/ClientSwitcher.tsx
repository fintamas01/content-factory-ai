"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";

type Client = {
  id: string;
  name: string;
  website_url: string | null;
  created_at: string;
};

export function ClientSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "rename">("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createWebsite, setCreateWebsite] = useState("");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const active = useMemo(
    () => clients.find((c) => c.id === activeClientId) ?? null,
    [clients, activeClientId]
  );

  async function refreshClients() {
    setError(null);
    const res = await fetch("/api/clients", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Failed to load clients.");
      return;
    }
    setClients(Array.isArray(data.clients) ? data.clients : []);
    setActiveClientId(typeof data.activeClientId === "string" ? data.activeClientId : "");
  }

  useEffect(() => {
    refreshClients();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setMode("menu");
      setError(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setOpen(false);
      setMode("menu");
      setError(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const setActive = async (clientId: string) => {
    if (busy || clientId === activeClientId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data?.error === "string" ? data.error : "Could not switch client.");
      setBusy(false);
      return;
    }
    setActiveClientId(clientId);
    setOpen(false);
    setMode("menu");
    setBusy(false);
    router.refresh();
  };

  const openCreate = () => {
    setMode("create");
    setError(null);
    setCreateName("");
    setCreateWebsite("");
  };

  const submitCreate = async () => {
    if (busy) return;
    const name = createName.trim();
    const website_url = createWebsite.trim();
    if (!name) {
      setError("Client name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, website_url: website_url || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Could not create client.");
      setBusy(false);
      return;
    }
    await refreshClients();
    const createdId = typeof data?.client?.id === "string" ? data.client.id : null;
    if (createdId) setActiveClientId((prev) => prev || createdId);

    setMode("menu");
    setBusy(false);
    router.refresh();
  };

  const openRename = (client: Client) => {
    setMode("rename");
    setError(null);
    setRenameId(client.id);
    setRenameName(client.name);
  };

  const submitRename = async () => {
    if (busy) return;
    if (!renameId) return;
    const next = renameName.trim();
    if (!next) {
      setError("Client name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: renameId, name: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Could not rename client.");
      setBusy(false);
      return;
    }
    await refreshClients();
    setMode("menu");
    setBusy(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              setMode("menu");
              setError(null);
            }
            return next;
          });
        }}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/[0.14] hover:bg-white/[0.05]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.24em] text-white/40">
            Client
          </p>
          <div className="mt-0.5 flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
              aria-hidden
            />
            <p className="truncate text-[13px] font-semibold tracking-tight text-white">
              {active?.name ?? (clients.length ? "Select a client" : "No client yet")}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/60 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/[0.10] bg-[#070b12]/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <div className="p-3 border-b border-white/[0.08]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">
                  Workspace
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold text-white">
                  {active?.name ?? "Choose a client"}
                </p>
              </div>
              {busy ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating
                </span>
              ) : null}
            </div>
            {error ? (
              <p className="mt-2 text-[12px] text-rose-200/90">{error}</p>
            ) : null}
          </div>

          {mode === "create" ? (
            <div className="p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Client name
                </label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Acme Inc"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] font-semibold text-white outline-none transition focus:border-cyan-400/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Website (optional)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <Globe className="h-4 w-4 text-white/50" />
                  <input
                    value={createWebsite}
                    onChange={(e) => setCreateWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/35"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("menu");
                    setError(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:bg-white/[0.05]"
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-[12px] font-semibold text-cyan-950 shadow-[0_18px_44px_-28px_rgba(34,211,238,0.6)] transition hover:bg-cyan-400 active:scale-[0.99]"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </div>
          ) : mode === "rename" ? (
            <div className="p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Rename client
                </label>
                <input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] font-semibold text-white outline-none transition focus:border-cyan-400/30"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("menu");
                    setError(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:bg-white/[0.05]"
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitRename}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-3 py-2.5 text-[12px] font-semibold shadow transition hover:bg-white/90 active:scale-[0.99]"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto p-2">
                {clients.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-white/[0.12] bg-black/20">
                    <p className="text-[13px] font-semibold text-white">No clients yet</p>
                    <p className="mt-1 text-[12px] text-white/50">
                      Create your first client to keep audits, products, and content neatly separated.
                    </p>
                    <button
                      type="button"
                      onClick={openCreate}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-[12px] font-semibold text-cyan-950 shadow-[0_18px_44px_-28px_rgba(34,211,238,0.6)] transition hover:bg-cyan-400 active:scale-[0.99]"
                    >
                      <Plus className="h-4 w-4" />
                      Create client
                    </button>
                  </div>
                ) : (
                  clients.map((c) => {
                    const isActive = c.id === activeClientId;
                    return (
                      <div
                        key={c.id}
                        className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition ${
                          isActive
                            ? "bg-cyan-500/10 text-white"
                            : "text-white/80 hover:bg-white/[0.04]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActive(c.id)}
                          className="min-w-0 flex-1 text-left"
                          role="menuitem"
                          disabled={busy}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isActive
                                  ? "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
                                  : "bg-white/20"
                              }`}
                              aria-hidden
                            />
                            <p className="truncate text-[13px] font-semibold">{c.name}</p>
                          </div>
                          {c.website_url ? (
                            <p className="truncate text-[11px] text-white/45">{c.website_url}</p>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRename(c)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/60 opacity-0 transition group-hover:opacity-100 hover:text-white"
                          aria-label="Rename client"
                          disabled={busy}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-white/[0.08] p-2">
                <button
                  type="button"
                  onClick={openCreate}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/80 transition hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-white"
                  role="menuitem"
                  disabled={busy}
                >
                  <Plus className="h-4 w-4" />
                  New client
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

