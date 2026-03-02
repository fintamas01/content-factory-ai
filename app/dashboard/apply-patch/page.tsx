"use client";

import React, { useMemo, useState } from "react";

type PatchFile = { path: string; content: string };

type PatchResponse = {
  summary?: string;
  risks?: string[];
  tasks?: any[];
  files?: PatchFile[];
  raw?: any;
  error?: string;
  diagnostics?: any;
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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

export default function ApplyPatchPage() {
  const [goal, setGoal] = useState("Improve GEO + add schema + better homepage copy");
  const [siteName, setSiteName] = useState("FutureTech Applications");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PatchResponse | null>(null);

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
      setData(json);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const files = Array.isArray(data?.files) ? data!.files : [];

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

            <div className="mt-4 flex items-center gap-3">
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

              {data && <CopyButton text={JSON.stringify(data, null, 2)} />}
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
          <Card title="Summary" right={<CopyButton text={String(data.summary ?? "")} />}>
            <div className="text-white/80 text-sm whitespace-pre-wrap">
              {String(data.summary ?? "—")}
            </div>
          </Card>

          <Card title={`Tasks (${Array.isArray(data.tasks) ? data.tasks.length : 0})`}>
            <pre className="text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(data.tasks ?? [], null, 2)}
            </pre>
          </Card>

          <Card
            title={`Files (${files.length})`}
            right={<CopyButton text={JSON.stringify(files, null, 2)} />}
          >
            {files.length === 0 ? (
              <div className="text-white/60 text-sm">
                No files returned (check Debug below).
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((f, idx) => (
                  <div
                    key={`${f.path}-${idx}`}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white font-semibold">{f.path}</div>
                      <CopyButton text={f.content} />
                    </div>
                    <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                      {f.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">
              Debug: raw JSON
            </summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}