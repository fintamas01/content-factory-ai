"use client";

import React, { useMemo, useState } from "react";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Card({
  title,
  right,
  children,
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

type PatchFileInput = { path: string; before?: string; after: string };

type ApiResp = {
  files: Array<{ path: string; hasBefore: boolean; afterBytes: number }>;
  unifiedDiff: string;
};

function DiffBlock({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="max-h-[65vh] overflow-auto">
        <div className="font-mono text-[12px] leading-5">
          {lines.map((line, i) => {
            const kind =
              line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : line.startsWith("@@") ? "hunk" : "ctx";

            return (
              <div
                key={i}
                className={clsx(
                  "flex gap-3 px-3 py-[2px] border-b border-white/5",
                  kind === "add" && "bg-emerald-500/10",
                  kind === "del" && "bg-red-500/10",
                  kind === "hunk" && "bg-blue-500/10"
                )}
              >
                <div className="w-[56px] text-white/30 select-none text-right">{i + 1}</div>
                <div className="text-white/85 whitespace-pre">{line || " "}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PatchViewerPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);

  // Demo input (replace this by wiring it to your Apply Patch Agent output)
  const [filesJson, setFilesJson] = useState(
    JSON.stringify(
      [
        {
          path: "app/layout.tsx",
          before: "export default function Layout(){\n  return null;\n}\n",
          after: "export default function Layout(){\n  return <div>Hello</div>;\n}\n",
        },
      ] satisfies PatchFileInput[],
      null,
      2
    )
  );

  const files = useMemo(() => {
    try {
      const parsed = JSON.parse(filesJson);
      return Array.isArray(parsed) ? (parsed as PatchFileInput[]) : [];
    } catch {
      return [];
    }
  }, [filesJson]);

  useCopilotPageContext({
    page: "patch-viewer",
    data: {
      loading,
      error: err,
      filesJsonPreview: filesJson.slice(0, 1800),
      filesCount: files.length,
      hasDiff: Boolean(data?.unifiedDiff),
    },
  });

  const canRun = !loading && files.length > 0;

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/patch-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });

      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setData(json as ApiResp);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Patch Viewer</h1>
        <p className="text-white/60">GitHub-style unified diff preview + copy.</p>
      </div>

      <Card
        title="Input: files[] (path, before?, after)"
        right={
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
            {loading ? "Rendering..." : "Render Diff"}
          </button>
        }
      >
        <textarea
          value={filesJson}
          onChange={(e) => setFilesJson(e.target.value)}
          className="w-full min-h-[220px] rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white font-mono text-xs"
        />
        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data && (
        <>
          <Card
            title={`Files (${data.files.length})`}
            right={<CopyButton text={data.unifiedDiff} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.files.map((f) => (
                <div
                  key={f.path}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 flex items-center justify-between"
                >
                  <div className="text-white/90 font-semibold text-sm">{f.path}</div>
                  <div className="text-white/60 text-xs">
                    {f.hasBefore ? "modified" : "new"} • {f.afterBytes} bytes
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Unified diff" right={<CopyButton text={data.unifiedDiff} />}>
            <DiffBlock text={data.unifiedDiff} />
          </Card>
        </>
      )}
    </div>
  );
}