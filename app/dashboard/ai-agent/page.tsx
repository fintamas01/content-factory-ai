"use client";

import React, { useMemo, useState } from "react";

type Goal = "geo_audit" | "content_plan" | "brand_voice";
type Platform = "web" | "instagram" | "tiktok" | "linkedin";

type AgentResponse = {
  goal: Goal;
  url: string | null;
  platform: Platform;
  brandName: string | null;
  searchQuery?: string | null;
  webContextUsed?: boolean;
  result: any;
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isRecord(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: do nothing
    }
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

function Card({
  title,
  children,
  right,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          {title ? <div className="text-white font-semibold">{title}</div> : <div />}
          {right}
        </div>
      )}
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

function KV({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="text-white/90 text-sm mt-1">{value}</div>
    </div>
  );
}

function GeoAuditReport({ data }: { data: AgentResponse }) {
  const r = data?.result;

  // If model returned non-JSON (raw), show it safely.
  if (!isRecord(r)) {
    return (
      <Card title="Report (raw)">
        <pre className="text-xs text-white/80 whitespace-pre-wrap">
          {typeof r === "string" ? r : JSON.stringify(r, null, 2)}
        </pre>
      </Card>
    );
  }

  const score = typeof r.score === "number" ? r.score : null;
  const summary = typeof r.summary === "string" ? r.summary : "";

  const findings = Array.isArray(r.findings) ? r.findings : [];
  const missingInfo = Array.isArray(r.missingInfo) ? r.missingInfo : [];
  const quickWins = Array.isArray(r.quickWins) ? r.quickWins : [];
  const copySuggestions = Array.isArray(r.copySuggestions) ? r.copySuggestions : [];

  return (
    <div className="space-y-4">
      <Card
        title="Overview"
        right={
          <div className="flex items-center gap-2">
            {score !== null && (
              <Badge>
                Score: <span className="ml-1 text-blue-200">{score}/100</span>
              </Badge>
            )}
            {data.searchQuery ? <Badge>Query: {data.searchQuery}</Badge> : null}
            {data.webContextUsed ? <Badge>Web context: ON</Badge> : <Badge>Web context: OFF</Badge>}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KV label="Brand" value={data.brandName ?? "—"} />
          <KV label="Platform" value={data.platform} />
          <KV label="URL" value={data.url ?? "—"} />
        </div>

        {summary && <p className="mt-4 text-white/70 text-sm leading-relaxed">{summary}</p>}
      </Card>

      {findings.length > 0 && (
        <Card title="Findings">
          <div className="space-y-3">
            {findings.map((f: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white font-semibold">{f?.area ?? "Area"}</div>
                <div className="mt-2 space-y-1 text-sm text-white/70">
                  {f?.issue && (
                    <div>
                      <span className="text-white/80 font-semibold">Issue:</span>{" "}
                      {f.issue}
                    </div>
                  )}
                  {f?.impact && (
                    <div>
                      <span className="text-white/80 font-semibold">Impact:</span>{" "}
                      {f.impact}
                    </div>
                  )}
                  {f?.fix && (
                    <div>
                      <span className="text-white/80 font-semibold">Fix:</span>{" "}
                      {f.fix}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {missingInfo.length > 0 && (
        <Card title="Missing information (AI can’t easily find)">
          <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
            {missingInfo.map((x: any, i: number) => (
              <li key={i}>{String(x)}</li>
            ))}
          </ul>
        </Card>
      )}

      {quickWins.length > 0 && (
        <Card title="Quick wins (actionable)">
          <div className="space-y-3">
            {quickWins.map((q: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white font-semibold">{q?.title ?? `Quick win ${i + 1}`}</div>
                {Array.isArray(q?.steps) && q.steps.length > 0 && (
                  <ul className="list-disc pl-5 text-white/70 text-sm mt-2 space-y-1">
                    {q.steps.map((s: any, j: number) => (
                      <li key={j}>{String(s)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {copySuggestions.length > 0 && (
        <Card title="Copy suggestions" right={<CopyButton text={JSON.stringify(copySuggestions, null, 2)} />}>
          <div className="space-y-3">
            {copySuggestions.map((c: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white font-semibold">{c?.section ?? `Section ${i + 1}`}</div>
                {c?.exampleText && (
                  <div className="text-white/70 text-sm mt-2 whitespace-pre-wrap">
                    {String(c.exampleText)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Debug toggle: show raw JSON if needed */}
      <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-white/80 font-semibold">
          Debug: raw JSON
        </summary>
        <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ContentPlanReport({ data }: { data: AgentResponse }) {
  const r = data?.result;

  if (!isRecord(r)) {
    return (
      <Card title="Plan (raw)">
        <pre className="text-xs text-white/80 whitespace-pre-wrap">
          {typeof r === "string" ? r : JSON.stringify(r, null, 2)}
        </pre>
      </Card>
    );
  }

  const summary = typeof r.summary === "string" ? r.summary : "";
  const pillars = Array.isArray(r.contentPillars) ? r.contentPillars : [];
  const plan = Array.isArray(r["14dayPlan"]) ? r["14dayPlan"] : [];
  const templates = Array.isArray(r.reusableTemplates) ? r.reusableTemplates : [];

  return (
    <div className="space-y-4">
      <Card title="Overview">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KV label="Brand" value={data.brandName ?? "—"} />
          <KV label="Platform" value={data.platform} />
          <KV label="Goal" value={data.goal} />
        </div>
        {summary && <p className="mt-4 text-white/70 text-sm leading-relaxed">{summary}</p>}
      </Card>

      {pillars.length > 0 && (
        <Card title="Content pillars">
          <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
            {pillars.map((x: any, i: number) => (
              <li key={i}>{String(x)}</li>
            ))}
          </ul>
        </Card>
      )}

      {plan.length > 0 && (
        <Card title="14-day plan" right={<CopyButton text={JSON.stringify(plan, null, 2)} />}>
          <div className="space-y-3">
            {plan.map((p: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white font-semibold">
                    Day {p?.day ?? i + 1} • {p?.platform ?? data.platform}
                  </div>
                </div>
                {p?.hook && <div className="text-white/70 text-sm mt-2"><b>Hook:</b> {String(p.hook)}</div>}
                {Array.isArray(p?.outline) && p.outline.length > 0 && (
                  <ul className="list-disc pl-5 text-white/70 text-sm mt-2 space-y-1">
                    {p.outline.map((s: any, j: number) => (
                      <li key={j}>{String(s)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {templates.length > 0 && (
        <Card title="Reusable templates">
          <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
            {templates.map((x: any, i: number) => (
              <li key={i}>{String(x)}</li>
            ))}
          </ul>
        </Card>
      )}

      <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-white/80 font-semibold">
          Debug: raw JSON
        </summary>
        <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function BrandVoiceReport({ data }: { data: AgentResponse }) {
  const r = data?.result;

  if (!isRecord(r)) {
    return (
      <Card title="Brand voice (raw)">
        <pre className="text-xs text-white/80 whitespace-pre-wrap">
          {typeof r === "string" ? r : JSON.stringify(r, null, 2)}
        </pre>
      </Card>
    );
  }

  const tone = typeof r.tone === "string" ? r.tone : "";
  const doList = Array.isArray(r.do) ? r.do : [];
  const dontList = Array.isArray(r.dont) ? r.dont : [];
  const examples = Array.isArray(r.exampleCaptions) ? r.exampleCaptions : [];

  return (
    <div className="space-y-4">
      <Card title="Overview">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KV label="Brand" value={data.brandName ?? "—"} />
          <KV label="Platform" value={data.platform} />
          <KV label="Tone" value={tone || "—"} />
        </div>
      </Card>

      {doList.length > 0 && (
        <Card title="Do">
          <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
            {doList.map((x: any, i: number) => (
              <li key={i}>{String(x)}</li>
            ))}
          </ul>
        </Card>
      )}

      {dontList.length > 0 && (
        <Card title="Don't">
          <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
            {dontList.map((x: any, i: number) => (
              <li key={i}>{String(x)}</li>
            ))}
          </ul>
        </Card>
      )}

      {examples.length > 0 && (
        <Card title="Example captions" right={<CopyButton text={JSON.stringify(examples, null, 2)} />}>
          <div className="space-y-3">
            {examples.map((ex: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white font-semibold">
                  {String(ex?.platform ?? data.platform)}
                </div>
                {ex?.caption && (
                  <div className="text-white/70 text-sm mt-2 whitespace-pre-wrap">
                    {String(ex.caption)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer text-white/80 font-semibold">
          Debug: raw JSON
        </summary>
        <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function AIAgentPage() {
  const [goal, setGoal] = useState<Goal>("geo_audit");
  const [platform, setPlatform] = useState<Platform>("web");
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canRun = useMemo(() => {
    if (loading) return false;
    if (goal === "geo_audit") return url.trim().length > 0;
    return true;
  }, [goal, url, loading]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          platform,
          url: goal === "geo_audit" ? url : undefined,
          brandName: brandName.trim() ? brandName.trim() : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      });

      const json = (await res.json()) as AgentResponse & { error?: string };
      if (!res.ok) throw new Error((json as any)?.error ?? "Request failed");
      setData(json as AgentResponse);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI Agent</h1>
        <p className="text-white/60">
          Cél-alapú futtatás (query → web context → elemzés → teendők).
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            >
              <option value="geo_audit">GEO audit</option>
              <option value="content_plan">Content plan</option>
              <option value="brand_voice">Brand voice</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            >
              <option value="web">web</option>
              <option value="instagram">instagram</option>
              <option value="tiktok">tiktok</option>
              <option value="linkedin">linkedin</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Brand name</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="FutureTech Applications / ApplePlug / ..."
            />
          </div>
        </div>

        {goal === "geo_audit" && (
          <div>
            <label className="text-xs text-white/60">Website URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="https://example.com"
            />
            <p className="text-xs text-white/40 mt-1">
              GEO auditnál kötelező.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-white/60">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[90px]"
            placeholder="Mit szeretnél kiemelten? (pl. célközönség, stílus, termékek)"
          />
        </div>

        <div className="flex items-center gap-3">
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
            {loading ? "Running..." : "Run Agent"}
          </button>

          {data?.result ? (
            <CopyButton text={JSON.stringify(data.result, null, 2)} />
          ) : null}
        </div>

        {err && <div className="text-red-300 text-sm">{err}</div>}
      </div>

      {data && (
        <>
          {goal === "geo_audit" && <GeoAuditReport data={data} />}
          {goal === "content_plan" && <ContentPlanReport data={data} />}
          {goal === "brand_voice" && <BrandVoiceReport data={data} />}
        </>
      )}
    </div>
  );
}