"use client";

import React, { useMemo, useState } from "react";

type PatchFile = { path: string; content: string };

type PatchTask = {
  id?: string;
  priority?: "P0" | "P1" | "P2" | string;
  title?: string;
  why?: string;
  steps?: string[];
  acceptance?: string[];
};

type PatchResponse = {
  summary?: string;
  risks?: string[];
  tasks?: PatchTask[];
  files?: PatchFile[];
  error?: string;
  raw?: any;
  diagnostics?: any;
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isRecord(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeJsonStringify(value: any, space = 2) {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-white font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "red" | "amber";
}) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
      : tone === "green"
      ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
      : tone === "red"
      ? "bg-red-500/10 border-red-400/20 text-red-200"
      : tone === "amber"
      ? "bg-amber-500/10 border-amber-400/20 text-amber-200"
      : "bg-white/5 border-white/10 text-white/80";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={clsx(
        "rounded-xl px-3 py-2 text-xs font-semibold border transition",
        copied
          ? "bg-emerald-600/20 text-emerald-200 border-emerald-400/20"
          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
      )}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function priorityTone(p?: string) {
  if (p === "P0") return "red";
  if (p === "P1") return "amber";
  if (p === "P2") return "blue";
  return "neutral";
}

function CodeViewer({ title, code }: { title: string; code: string }) {
  const lines = useMemo(() => String(code ?? "").split("\n"), [code]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="text-white/90 font-semibold text-sm">{title}</div>
        <CopyButton text={String(code ?? "")} />
      </div>

      <div className="max-h-[520px] overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: "72px 1fr" }}>
          <div className="border-r border-white/10 bg-black/40 text-white/35 text-xs py-3">
            {lines.map((_, i) => (
              <div key={i} className="px-3 leading-6 tabular-nums">
                {i + 1}
              </div>
            ))}
          </div>

          <pre className="text-xs text-white/80 py-3 px-3 whitespace-pre leading-6">
            {String(code ?? "")}
          </pre>
        </div>
      </div>
    </div>
  );
}

function normalizePatch(raw: any): PatchResponse {
  if (!raw) return { error: "Empty response", raw };
  if (!isRecord(raw)) return { error: "Non-object response", raw };

  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const files = Array.isArray(raw.files) ? raw.files : [];
  const risks = Array.isArray(raw.risks) ? raw.risks : [];

  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    risks: risks.map((x) => String(x)).filter(Boolean),
    tasks: tasks.map((t: any) => ({
      id: typeof t?.id === "string" ? t.id : undefined,
      priority: typeof t?.priority === "string" ? t.priority : undefined,
      title: typeof t?.title === "string" ? t.title : undefined,
      why: typeof t?.why === "string" ? t.why : undefined,
      steps: Array.isArray(t?.steps) ? t.steps.map((s: any) => String(s)) : [],
      acceptance: Array.isArray(t?.acceptance)
        ? t.acceptance.map((s: any) => String(s))
        : [],
    })),
    files: files
      .map((f: any) => ({
        path: String(f?.path ?? ""),
        content: String(f?.content ?? ""),
      }))
      .filter((f: PatchFile) => f.path),
    error: typeof raw.error === "string" ? raw.error : undefined,
    diagnostics: raw.diagnostics,
    raw,
  };
}

export default function ApplyPatchPage() {
  const [goal, setGoal] = useState("Improve GEO + add schema + better homepage copy");
  const [siteName, setSiteName] = useState("FutureTech Applications");

  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PatchResponse | null>(null);

  const [fileQuery, setFileQuery] = useState("");
  const [activeFilePath, setActiveFilePath] = useState<string>("");

  const canRun = useMemo(() => !loading && goal.trim().length > 5, [loading, goal]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/apply-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          siteName: siteName.trim(),
          stack: "Next.js App Router",
        }),
      });

      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      const normalized = normalizePatch(json);
      setData(normalized);

      const first = normalized.files?.[0]?.path ?? "";
      setActiveFilePath(first);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!data?.files || data.files.length === 0) return;

    setZipLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/ai-agent/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipName: "patch",
          files: data.files,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "ZIP export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "patch.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setZipLoading(false);
    }
  }

  const tasks = data?.tasks ?? [];
  const risks = data?.risks ?? [];
  const files = data?.files ?? [];

  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, fileQuery]);

  const activeFile = useMemo(() => {
    const found = files.find((f) => f.path === activeFilePath);
    return found ?? files[0] ?? null;
  }, [files, activeFilePath]);

  const copyAllFilesBundle = () => {
    const payload = { files };
    return safeJsonStringify(payload, 2);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Apply Patch Agent</h1>
        <p className="text-white/60">
          Goal → AI generates tasks + complete file contents you can copy-paste into your repo.
        </p>
      </div>

      <Card title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/60">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[110px]"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Site name</label>
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={run}
                disabled={!canRun}
                className={clsx(
                  "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
                  !canRun
                    ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
                )}
              >
                {loading ? "Running..." : "Generate Patch"}
              </button>

              <button
                onClick={downloadZip}
                disabled={zipLoading || !data?.files?.length}
                className={clsx(
                  "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
                  zipLoading || !data?.files?.length
                    ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/20"
                )}
              >
                {zipLoading ? "Building ZIP..." : "Download ZIP"}
              </button>

              {data && <CopyButton text={safeJsonStringify(data.raw ?? data, 2)} />}
              {files.length > 0 && <CopyButton text={copyAllFilesBundle()} />}
            </div>

            {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
          </div>
        </div>
      </Card>

      {data?.error && (
        <Card title="Error">
          <div className="text-red-300 text-sm">{data.error}</div>
        </Card>
      )}

      {data && (
        <>
          <Card title="Summary" right={data.summary ? <CopyButton text={data.summary} /> : undefined}>
            <div className="text-white/85 text-sm whitespace-pre-wrap">
              {data.summary?.trim() ? data.summary : "—"}
            </div>

            {risks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {risks.slice(0, 12).map((r, idx) => (
                  <Badge key={idx} tone="amber">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Tasks (${tasks.length})`} right={<CopyButton text={safeJsonStringify(tasks, 2)} />}>
            {tasks.length === 0 ? (
              <div className="text-white/60 text-sm">No tasks returned. Check Debug below.</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((t, idx) => (
                  <details
                    key={t.id ?? idx}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    open={idx === 0}
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={priorityTone(t.priority)}>{String(t.priority ?? "P?")}</Badge>
                            <div className="text-white font-semibold">{t.title ?? `Task ${idx + 1}`}</div>
                          </div>
                          {t.why ? <div className="text-white/60 text-sm">{t.why}</div> : null}
                        </div>
                        <CopyButton text={safeJsonStringify(t, 2)} />
                      </div>
                    </summary>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-white/80 text-xs font-semibold mb-2">Steps</div>
                        {Array.isArray(t.steps) && t.steps.length > 0 ? (
                          <ul className="space-y-2 text-sm text-white/80">
                            {t.steps.map((s, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-[6px] h-2 w-2 rounded-full bg-white/30" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-white/60 text-sm">—</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-white/80 text-xs font-semibold mb-2">Acceptance criteria</div>
                        {Array.isArray(t.acceptance) && t.acceptance.length > 0 ? (
                          <ul className="space-y-2 text-sm text-white/80">
                            {t.acceptance.map((a, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-[6px] h-2 w-2 rounded-full bg-emerald-400/50" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-white/60 text-sm">—</div>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Files (${files.length})`} right={files.length ? <CopyButton text={safeJsonStringify(files, 2)} /> : undefined}>
            {files.length === 0 ? (
              <div className="text-white/60 text-sm">No files returned.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={fileQuery}
                      onChange={(e) => setFileQuery(e.target.value)}
                      placeholder="Search files..."
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                    />
                    <CopyButton text={copyAllFilesBundle()} />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                    <div className="max-h-[520px] overflow-auto">
                      {filteredFiles.map((f) => {
                        const active = f.path === (activeFile?.path ?? "");
                        return (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => setActiveFilePath(f.path)}
                            className={clsx(
                              "w-full text-left px-3 py-2 border-b border-white/5 transition",
                              active ? "bg-blue-500/10 text-white" : "hover:bg-white/5 text-white/80"
                            )}
                          >
                            <div className="text-xs font-semibold truncate">{f.path}</div>
                            <div className="text-[11px] text-white/45 truncate">
                              {f.content.length.toLocaleString()} chars
                            </div>
                          </button>
                        );
                      })}
                      {filteredFiles.length === 0 && <div className="p-3 text-white/60 text-sm">No matches.</div>}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  {activeFile ? <CodeViewer title={activeFile.path} code={activeFile.content} /> : <div className="text-white/60 text-sm">Select a file.</div>}
                </div>
              </div>
            )}
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">Debug: raw JSON</summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(data.raw ?? data, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}