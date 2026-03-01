"use client";

import React, { useMemo, useState } from "react";

type ActionPlanResponse = {
  url: string;
  scoreBefore: number;
  estimatedScoreAfter: number;
  scoreParts: any;
  tasks: any[];
  schemaSnippets: any[];
  copyBlocks: any[];
  diagnostics?: any;
  error?: string;
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/80">
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

export default function ActionPlanPage() {
  const [url, setUrl] = useState("futuretechapps.ro");
  const [maxPages, setMaxPages] = useState(7);
  const [timeoutMsPerPage, setTimeoutMsPerPage] = useState(7000);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ActionPlanResponse | null>(null);

  const canRun = useMemo(() => {
    if (loading) return false;
    return url.trim().length > 0;
  }, [url, loading]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          maxPages,
          timeoutMsPerPage,
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Action Plan Agent</h1>
        <p className="text-white/60">
          Multi-page crawl → determinisztikus GEO score → priorizált teendők + JSON-LD snippetek.
        </p>
      </div>

      <Card title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-white/60">Website URL / domain</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="futuretechapps.ro"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Max pages (1..10)</label>
            <input
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Timeout per page (ms)</label>
            <input
              type="number"
              value={timeoutMsPerPage}
              onChange={(e) => setTimeoutMsPerPage(Number(e.target.value))}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            />
          </div>
        </div>

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
            {loading ? "Running..." : "Generate Action Plan"}
          </button>

          {data?.diagnostics ? (
            <div className="text-xs text-white/60 flex items-center gap-2">
              <Badge>OpenAI key: {String(Boolean(data.diagnostics?.hasOpenAIKey))}</Badge>
              <Badge>Pages: {Number(data.diagnostics?.pagesCrawled ?? 0)}</Badge>
            </div>
          ) : null}
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data && (
        <>
          {data.error && (
            <Card title="Error">
              <div className="text-red-300 text-sm">{data.error}</div>
            </Card>
          )}

          <Card
            title="Scores"
            right={<CopyButton text={JSON.stringify({ scoreParts: data.scoreParts }, null, 2)} />}
          >
            <div className="flex flex-wrap gap-2">
              <Badge>Before: {data.scoreBefore}/100</Badge>
              <Badge>After (est.): {data.estimatedScoreAfter}/100</Badge>
            </div>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(data.scoreParts, null, 2)}
            </pre>
          </Card>

          <Card title={`Tasks (${data.tasks?.length ?? 0})`}>
            {Array.isArray(data.tasks) && data.tasks.length > 0 ? (
              <div className="space-y-3">
                {data.tasks.map((t: any, idx: number) => (
                  <div key={t?.id ?? idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">
                          {t?.priority ?? "P?"} — {t?.title ?? `Task ${idx + 1}`}
                        </div>
                        <div className="text-white/60 text-xs mt-1">
                          impact: {t?.impact ?? "?"}/10 • effort: {t?.effort ?? "?"}/10
                        </div>
                      </div>
                      <CopyButton text={JSON.stringify(t, null, 2)} />
                    </div>

                    {Array.isArray(t?.steps) && t.steps.length > 0 && (
                      <ul className="list-disc pl-5 text-white/70 text-sm mt-3 space-y-1">
                        {t.steps.map((s: any, i: number) => (
                          <li key={i}>{String(s)}</li>
                        ))}
                      </ul>
                    )}

                    {Array.isArray(t?.codeSnippets) && t.codeSnippets.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {t.codeSnippets.map((sn: any, i: number) => (
                          <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-white/80 text-xs font-semibold">
                                {String(sn?.label ?? "Snippet")}
                              </div>
                              <CopyButton text={String(sn?.code ?? "")} />
                            </div>
                            <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                              {String(sn?.code ?? "")}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">Nincs task (lehet token hiány / LLM raw).</div>
            )}
          </Card>

          <Card title={`Schema snippets (${data.schemaSnippets?.length ?? 0})`}>
            {Array.isArray(data.schemaSnippets) && data.schemaSnippets.length > 0 ? (
              <div className="space-y-3">
                {data.schemaSnippets.map((s: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white font-semibold">{String(s?.type ?? "Schema")}</div>
                      <CopyButton text={JSON.stringify(s?.jsonLd ?? {}, null, 2)} />
                    </div>
                    <div className="text-white/60 text-xs mt-1">
                      {String(s?.whereToPlace ?? "")}
                    </div>
                    <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                      {JSON.stringify(s?.jsonLd ?? {}, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">Nincs schema snippet.</div>
            )}
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">Debug: raw JSON</summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}