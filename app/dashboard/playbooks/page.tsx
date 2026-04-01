"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Copy, Check } from "lucide-react";
import { PLAYBOOKS, type PlaybookDefinition } from "@/lib/playbooks/definitions";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

type RunResponse =
  | { ok: true; result: { playbookId: string; meta: any; steps: any[] } }
  | { ok?: false; error: string; details?: string };

const shell =
  "min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#080c14] via-[#070b12] to-[#05070c] text-zinc-100 antialiased selection:bg-emerald-500/25 selection:text-emerald-100";

const panel =
  "rounded-2xl border border-white/[0.06] bg-[#0c1018]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-[box-shadow,border-color] duration-300 hover:border-white/[0.09] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_28px_56px_-20px_rgba(0,0,0,0.5)]";

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-[0.98]"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({
  label,
  placeholder,
  required,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className={`${sectionLabel} !tracking-[0.15em]`}>{label}</label>
        {required ? (
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Required
          </span>
        ) : null}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10"
      />
    </div>
  );
}

export default function PlaybooksPage() {
  const [active, setActive] = useState<PlaybookDefinition | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const [url, setUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [productName, setProductName] = useState("");

  useCopilotPageContext({
    page: "playbooks",
    data: {
      open,
      active: active ? { id: active.id, title: active.title } : null,
      inputs: {
        url: url.trim() || null,
        competitor_url: competitorUrl.trim() || null,
        product_name: productName.trim() || null,
      },
      loading,
      error,
      resultPreview: result
        ? {
            playbookId: result.playbookId,
            stepsCount: Array.isArray(result.steps) ? result.steps.length : null,
          }
        : null,
    },
  });

  const requiredOk = useMemo(() => {
    if (!active) return false;
    for (const p of active.params) {
      if (!p.required) continue;
      if (p.key === "url" && !url.trim()) return false;
      if (p.key === "competitor_url" && !competitorUrl.trim()) return false;
      if (p.key === "product_name" && !productName.trim()) return false;
    }
    return true;
  }, [active, url, competitorUrl, productName]);

  const run = async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/playbooks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: active.id,
          params: {
            url: url.trim() || undefined,
            competitor_url: competitorUrl.trim() || undefined,
            product_name: productName.trim() || undefined,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as RunResponse | null;
      if (!res.ok || !data) {
        setError(
          (data && "error" in data && data.error) ||
            `Request failed (${res.status}).`
        );
        return;
      }
      if (!("ok" in data) || !data.ok) {
        setError(("error" in (data as any) && (data as any).error) || "Failed.");
        return;
      }
      setResult(data.result);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const openRun = (p: PlaybookDefinition) => {
    setActive(p);
    setOpen(true);
    setError(null);
    setResult(null);
    setLoading(false);
    // keep any previously typed values (feels fast)
  };

  const exportJson = () => {
    const raw = JSON.stringify(result, null, 2);
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook-${String(result?.playbookId ?? "run")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={shell}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className={sectionLabel}>One-click growth workflows</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Saved Playbooks
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Run high-value workflows end-to-end—audit, competitor intel, and generators—without
              re-building the same pipeline every time.
            </p>
          </div>
          <div className="hidden sm:block rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Premium workflow mode
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Structured outputs by step. Copy/export ready.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLAYBOOKS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className={`${panel} group relative overflow-hidden p-6`}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-inner">
                        <Icon className="h-5 w-5 text-zinc-200" />
                      </div>
                      <p className="text-base font-semibold text-white">{p.title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      {p.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {p.steps.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                      >
                        {s.title}
                      </span>
                    ))}
                    {p.steps.length > 3 ? (
                      <span className="rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        +{p.steps.length - 3}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => openRun(p)}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.65)] transition hover:bg-emerald-400 active:scale-[0.99]"
                  >
                    Run Playbook
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {open && active ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-10"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <motion.div
              initial={{ y: 12, opacity: 0, scale: 0.99 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0b101a] to-[#070a10] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.85)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
                <div className="min-w-0">
                  <p className={sectionLabel}>Playbook</p>
                  <p className="mt-2 text-lg font-semibold text-white">{active.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">{active.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6 px-6 py-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {active.params.map((p) => {
                    if (p.key === "url")
                      return (
                        <Field
                          key={p.key}
                          label={p.label}
                          placeholder={p.placeholder}
                          required={p.required}
                          value={url}
                          onChange={setUrl}
                        />
                      );
                    if (p.key === "competitor_url")
                      return (
                        <Field
                          key={p.key}
                          label={p.label}
                          placeholder={p.placeholder}
                          required={p.required}
                          value={competitorUrl}
                          onChange={setCompetitorUrl}
                        />
                      );
                    if (p.key === "product_name")
                      return (
                        <Field
                          key={p.key}
                          label={p.label}
                          placeholder={p.placeholder}
                          required={p.required}
                          value={productName}
                          onChange={setProductName}
                        />
                      );
                    return null;
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Steps: {active.steps.length}
                    </span>
                    {result ? (
                      <button
                        type="button"
                        onClick={exportJson}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/[0.16] hover:bg-white/[0.05]"
                      >
                        Export JSON
                      </button>
                    ) : null}
                    {result ? (
                      <CopyButton value={JSON.stringify(result, null, 2)} />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={run}
                    disabled={!requiredOk || loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_18px_40px_-22px_rgba(16,185,129,0.65)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Running…" : "Run now"}
                  </button>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4">
                    <p className="text-sm font-semibold text-red-200">Execution failed</p>
                    <p className="mt-1 text-sm text-red-200/80">{error}</p>
                  </div>
                ) : null}

                {result?.steps?.length ? (
                  <div className="space-y-4">
                    <p className={sectionLabel}>Results (grouped by step)</p>
                    <div className="space-y-3">
                      {result.steps.map((s: any, idx: number) => (
                        <div
                          key={`${s.stepId}-${idx}`}
                          className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">
                                {s.title ?? s.stepId}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Status:{" "}
                                <span
                                  className={
                                    s.status === "success"
                                      ? "text-emerald-300"
                                      : s.status === "error"
                                        ? "text-red-300"
                                        : "text-zinc-400"
                                  }
                                >
                                  {String(s.status)}
                                </span>
                              </p>
                            </div>
                            <CopyButton value={JSON.stringify(s.output ?? s, null, 2)} />
                          </div>

                          {s.error ? (
                            <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-red-200/90">
                                Error
                              </p>
                              <p className="mt-1 text-sm text-red-200/80">{String(s.error)}</p>
                            </div>
                          ) : null}

                          <pre className="mt-3 max-h-[320px] overflow-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs leading-relaxed text-zinc-200">
                            {JSON.stringify(s.output, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

