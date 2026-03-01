"use client";

import React, { useMemo, useState } from "react";

type CompareResult = {
  mainUrl: string;
  results: Array<any>;
  ranking: Array<{ url: string; totalScore: number }>;
  categoryMatrix: Array<{ url: string; categories: Record<string, number> }>;
  deltas: Array<{ competitor: string; delta: Record<string, number> }>;
  insights: any;
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/80">
      {children}
    </span>
  );
}

/**
 * Normalize API response to safe defaults (prevents .map on undefined).
 * If API returns an error payload, we still keep raw.
 */
function normalizeCompareResult(raw: any): (CompareResult & { raw?: any }) | null {
  if (!raw) return null;

  // If it's not an object, wrap it
  if (!isRecord(raw)) {
    return {
      mainUrl: "",
      results: [],
      ranking: [],
      categoryMatrix: [],
      deltas: [],
      insights: raw,
      raw,
    };
  }

  const mainUrl = typeof raw.mainUrl === "string" ? raw.mainUrl : "";

  const results = Array.isArray(raw.results) ? raw.results : [];

  const ranking = Array.isArray(raw.ranking)
    ? raw.ranking
        .map((x: any) => ({
          url: typeof x?.url === "string" ? x.url : String(x?.url ?? ""),
          totalScore: typeof x?.totalScore === "number" ? x.totalScore : Number(x?.totalScore ?? 0),
        }))
        .filter((x: any) => x.url)
    : [];

  const categoryMatrix = Array.isArray(raw.categoryMatrix)
    ? raw.categoryMatrix
        .map((row: any) => ({
          url: typeof row?.url === "string" ? row.url : String(row?.url ?? ""),
          categories: isRecord(row?.categories) ? (row.categories as Record<string, number>) : {},
        }))
        .filter((x: any) => x.url)
    : [];

  const deltas = Array.isArray(raw.deltas)
    ? raw.deltas
        .map((d: any) => ({
          competitor:
            typeof d?.competitor === "string"
              ? d.competitor
              : String(d?.competitor ?? ""),
          delta: isRecord(d?.delta) ? (d.delta as Record<string, number>) : {},
        }))
        .filter((x: any) => x.competitor)
    : [];

  const insights = raw.insights ?? null;

  return {
    mainUrl,
    results,
    ranking,
    categoryMatrix,
    deltas,
    insights,
    raw, // keep original for debug
  };
}

export default function ComparePage() {
  const [mainUrl, setMainUrl] = useState("futuretechapps.ro");
  const [competitorsText, setCompetitorsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<(CompareResult & { raw?: any }) | null>(null);

  const competitors = useMemo(() => {
    return competitorsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [competitorsText]);

  const canRun = !loading && mainUrl.trim().length > 0 && competitors.length > 0;

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // NOTE: your API may expect url instead of mainUrl (depending on your route implementation)
          // Keep as-is because you already used it this way.
          mainUrl: mainUrl.trim(),
          competitors,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // Show server-provided error message if present
        const message =
          (isRecord(json) && (json.error || json.message || json.details)) ||
          "Request failed";
        throw new Error(String(message));
      }

      const normalized = normalizeCompareResult(json);
      setData(normalized);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const ranking = data?.ranking ?? [];
  const categoryMatrix = data?.categoryMatrix ?? [];
  const deltas = data?.deltas ?? [];
  const insights = data?.insights ?? null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Competitor Compare</h1>
        <p className="text-white/60">
          Multi-page crawl + determinisztikus GEO score + delta + AI stratégiai összegzés.
        </p>
      </div>

      <Card title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/60">Main site</label>
            <input
              value={mainUrl}
              onChange={(e) => setMainUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="futuretechapps.ro"
            />
            <p className="text-xs text-white/40 mt-1">Lehet domain vagy teljes URL.</p>
          </div>

          <div>
            <label className="text-xs text-white/60">Competitors (1 per line, max 3)</label>
            <textarea
              value={competitorsText}
              onChange={(e) => setCompetitorsText(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[110px]"
              placeholder={`competitor1.ro\ncompetitor2.ro\ncompetitor3.ro`}
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
            {loading ? "Running..." : "Run Compare"}
          </button>

          <div className="text-xs text-white/60 flex items-center gap-2">
            <Badge>Pages/site: 5</Badge>
            <Badge>Timeout: 5s/page</Badge>
            <Badge>Competitors: {competitors.length}/3</Badge>
          </div>
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data && (
        <>
          <Card title="Ranking">
            {ranking.length === 0 ? (
              <div className="text-white/60 text-sm">
                Nincs ranking adat (lehet API-hiba vagy üres válasz). Nézd meg a Debug részt lent.
              </div>
            ) : (
              <div className="space-y-2">
                {ranking.map((r, idx) => (
                  <div
                    key={`${r.url}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="text-white/90 font-semibold">
                      #{idx + 1} — {r.url}
                    </div>
                    <div className="text-white">
                      <Badge>Score: {r.totalScore}/100</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Category matrix">
            {categoryMatrix.length === 0 ? (
              <div className="text-white/60 text-sm">
                Nincs categoryMatrix adat. Nézd meg a Debug részt lent.
              </div>
            ) : (
              <div className="space-y-3">
                {categoryMatrix.map((row, idx) => (
                  <div
                    key={`${row.url}-${idx}`}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="text-white font-semibold mb-2">{row.url}</div>

                    {row.categories && Object.keys(row.categories).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-white/80">
                        {Object.entries(row.categories ?? {}).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                          >
                            <span className="uppercase text-[11px] tracking-widest text-white/50">
                              {k}
                            </span>
                            <span className="font-bold text-white">{Number(v ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/60 text-sm">Nincs kategória bontás.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Deltas vs main">
            {deltas.length === 0 ? (
              <div className="text-white/60 text-sm">
                Nincs delta adat. Nézd meg a Debug részt lent.
              </div>
            ) : (
              <div className="space-y-3">
                {deltas.map((d, idx) => (
                  <div
                    key={`${d.competitor}-${idx}`}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="text-white font-semibold mb-2">{d.competitor}</div>

                    {d.delta && Object.keys(d.delta).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {Object.entries(d.delta ?? {}).map(([k, vRaw]) => {
                          const v = Number(vRaw ?? 0);
                          return (
                            <div
                              key={k}
                              className={clsx(
                                "flex items-center justify-between rounded-lg border px-3 py-2",
                                v > 0
                                  ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                                  : v < 0
                                  ? "bg-red-500/10 border-red-400/20 text-red-200"
                                  : "bg-white/5 border-white/10 text-white/70"
                              )}
                            >
                              <span className="uppercase text-[11px] tracking-widest opacity-80">
                                {k}
                              </span>
                              <span className="font-bold">{v > 0 ? `+${v}` : v}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-white/60 text-sm">Nincs delta bontás.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="AI insights (strategic)">
            <pre className="text-xs text-white/80 whitespace-pre-wrap">
              {safeJsonStringify(insights, 2)}
            </pre>
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">
              Debug: raw JSON
            </summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(data.raw ?? data, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}