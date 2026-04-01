"use client";

import React, { useMemo, useState } from "react";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

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

function MiniTag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold",
        tone === "good"
          ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
          : tone === "bad"
          ? "bg-red-500/10 border-red-400/20 text-red-200"
          : "bg-white/5 border-white/10 text-white/70"
      )}
    >
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
          totalScore:
            typeof x?.totalScore === "number"
              ? x.totalScore
              : Number(x?.totalScore ?? 0),
        }))
        .filter((x: any) => x.url)
    : [];

  const categoryMatrix = Array.isArray(raw.categoryMatrix)
    ? raw.categoryMatrix
        .map((row: any) => ({
          url: typeof row?.url === "string" ? row.url : String(row?.url ?? ""),
          categories: isRecord(row?.categories)
            ? (row.categories as Record<string, number>)
            : {},
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

function getSiteResult(results: any[], url: string) {
  return results.find((r) => String(r?.url ?? "") === String(url ?? "")) ?? null;
}

function renderInsights(insights: any) {
  if (!insights) {
    return (
      <div className="text-white/60 text-sm">
        Nincs AI insight (insights=null). (Ha nincs OPENAI_API_KEY a szerveren, ez normális.)
      </div>
    );
  }

  // if it's not an object -> show raw
  if (!isRecord(insights)) {
    return (
      <pre className="text-xs text-white/80 whitespace-pre-wrap">
        {typeof insights === "string" ? insights : safeJsonStringify(insights, 2)}
      </pre>
    );
  }

  const summary = typeof insights.summary === "string" ? insights.summary : "";
  const topGaps = Array.isArray(insights.topGaps) ? insights.topGaps : [];
  const quickWins = Array.isArray(insights.quickWins) ? insights.quickWins : [];
  const positioning =
    typeof insights.positioning === "string" ? insights.positioning : "";

  const perSiteNotes = Array.isArray(insights.perSiteNotes)
    ? insights.perSiteNotes
    : [];

  return (
    <div className="space-y-4">
      {(summary || positioning) && (
        <div className="space-y-2">
          {summary && (
            <div className="text-white/80 text-sm leading-relaxed">{summary}</div>
          )}
          {positioning && (
            <div className="text-white/70 text-sm leading-relaxed">
              <span className="text-white/85 font-semibold">Positioning:</span>{" "}
              {positioning}
            </div>
          )}
        </div>
      )}

      {(topGaps.length > 0 || quickWins.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-white font-semibold mb-2">Top gaps</div>
            {topGaps.length === 0 ? (
              <div className="text-white/60 text-sm">—</div>
            ) : (
              <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                {topGaps.map((x: any, i: number) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-white font-semibold mb-2">Quick wins</div>
            {quickWins.length === 0 ? (
              <div className="text-white/60 text-sm">—</div>
            ) : (
              <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                {quickWins.map((x: any, i: number) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {perSiteNotes.length > 0 && (
        <div className="space-y-3">
          <div className="text-white font-semibold">Per-site notes</div>
          {perSiteNotes.map((n: any, i: number) => {
            const url = String(n?.url ?? `site-${i + 1}`);
            const strengths = Array.isArray(n?.strengths) ? n.strengths : [];
            const weaknesses = Array.isArray(n?.weaknesses) ? n.weaknesses : [];
            const nextSteps = Array.isArray(n?.suggestedNextSteps)
              ? n.suggestedNextSteps
              : [];

            return (
              <div
                key={url}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="text-white/90 font-semibold">{url}</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-white/80 font-semibold text-sm mb-2">
                      Strengths
                    </div>
                    {strengths.length === 0 ? (
                      <div className="text-white/60 text-sm">—</div>
                    ) : (
                      <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                        {strengths.map((x: any, j: number) => (
                          <li key={j}>{String(x)}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-white/80 font-semibold text-sm mb-2">
                      Weaknesses
                    </div>
                    {weaknesses.length === 0 ? (
                      <div className="text-white/60 text-sm">—</div>
                    ) : (
                      <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                        {weaknesses.map((x: any, j: number) => (
                          <li key={j}>{String(x)}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-white/80 font-semibold text-sm mb-2">
                      Suggested next steps
                    </div>
                    {nextSteps.length === 0 ? (
                      <div className="text-white/60 text-sm">—</div>
                    ) : (
                      <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                        {nextSteps.map((x: any, j: number) => (
                          <li key={j}>{String(x)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* fallback raw */}
      <details className="rounded-xl border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-white/70 font-semibold text-sm">
          Raw insights JSON
        </summary>
        <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
          {safeJsonStringify(insights, 2)}
        </pre>
      </details>
    </div>
  );
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

  useCopilotPageContext({
    page: "compare",
    data: {
      mainUrl,
      competitors,
      loading,
      error: err,
      hasData: Boolean(data),
      rankingTop: data?.ranking ? data.ranking.slice(0, 4) : null,
      insightsPreview: data?.insights ? data.insights : null,
    },
  });

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
          mainUrl: mainUrl.trim(),
          competitors,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
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
  const results = Array.isArray(data?.results) ? (data?.results as any[]) : [];

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

          <div className="text-xs text-white/60 flex items-center gap-2 flex-wrap">
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
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-white font-semibold">{row.url}</div>
                      {(() => {
                        const site = getSiteResult(results, row.url);
                        const pageCount = Number(site?.pageCount ?? 0);
                        const errorsCount = Number(site?.crawlStats?.errorsCount ?? 0);
                        return (
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Badge>Pages: {pageCount}</Badge>
                            <Badge>Errors: {errorsCount}</Badge>
                          </div>
                        );
                      })()}
                    </div>

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

          {/* ✅ NEW: Crawl evidence pages */}
          <Card
            title="Crawl evidence (pages)"
            right={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge>Tip: itt látod, mit “talált” a crawler</Badge>
              </div>
            }
          >
            {results.length === 0 ? (
              <div className="text-white/60 text-sm">
                Nincs results adat. Nézd meg a Debug részt lent.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r: any, idx: number) => {
                  const url = String(r?.url ?? `site-${idx + 1}`);
                  const ok = Boolean(r?.ok);
                  const score = Number(r?.score ?? 0);
                  const pageCount = Number(r?.pageCount ?? 0);
                  const errorsCount = Number(r?.crawlStats?.errorsCount ?? 0);
                  const timeout = Number(r?.crawlStats?.timeoutMsPerPage ?? 0);
                  const maxPages = Number(r?.crawlStats?.maxPages ?? 0);

                  const pagesSample = Array.isArray(r?.pagesSample) ? r.pagesSample : [];
                  const crawlErrors = Array.isArray(r?.crawlErrors) ? r.crawlErrors : [];
                  const evidence = Array.isArray(r?.evidence) ? r.evidence : [];

                  return (
                    <div
                      key={`${url}-${idx}`}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-white/90 font-semibold">{url}</div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <MiniTag tone={ok ? "good" : "bad"}>
                              {ok ? "crawl ok" : "crawl failed"}
                            </MiniTag>
                            <MiniTag tone="neutral">score: {score}/100</MiniTag>
                            <MiniTag tone="neutral">pages: {pageCount}/{maxPages || 5}</MiniTag>
                            <MiniTag tone={errorsCount > 0 ? "bad" : "neutral"}>
                              errors: {errorsCount}
                            </MiniTag>
                            {timeout ? (
                              <MiniTag tone="neutral">timeout: {timeout}ms</MiniTag>
                            ) : null}
                          </div>
                        </div>

                        {r?.error ? (
                          <div className="text-red-300 text-sm">{String(r.error)}</div>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <details className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <summary className="cursor-pointer text-white/80 font-semibold text-sm">
                            Pages sample ({pagesSample.length})
                          </summary>

                          {pagesSample.length === 0 ? (
                            <div className="mt-2 text-white/60 text-sm">
                              Nincs pagesSample (valószínűleg nem került be a response-ba vagy nem volt crawl).
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {pagesSample.map((p: any, j: number) => {
                                const pUrl = String(p?.url ?? `page-${j + 1}`);
                                const title = p?.title ? String(p.title) : "";
                                const meta = p?.metaDescription ? String(p.metaDescription) : "";
                                const h1 = Array.isArray(p?.h1) ? p.h1 : [];
                                const h2 = Array.isArray(p?.h2) ? p.h2 : [];
                                const snippet = p?.text?.snippet ? String(p.text.snippet) : "";

                                const flags = isRecord(p?.flags) ? p.flags : {};
                                const signals = isRecord(p?.signals) ? p.signals : {};

                                const hasJsonLd = Boolean(flags?.hasJsonLd);
                                const hasOG = Boolean(flags?.hasOpenGraph);
                                const hasTW = Boolean(flags?.hasTwitterCard);

                                const emails = Array.isArray(signals?.emails) ? signals.emails : [];
                                const phones = Array.isArray(signals?.phones) ? signals.phones : [];
                                const socials = Array.isArray(signals?.socialLinks)
                                  ? signals.socialLinks
                                  : [];
                                const addressLike = Array.isArray(signals?.addressLike)
                                  ? signals.addressLike
                                  : [];
                                const cityLike = Array.isArray(signals?.cityOrRegionLike)
                                  ? signals.cityOrRegionLike
                                  : [];

                                return (
                                  <div
                                    key={`${pUrl}-${j}`}
                                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                                  >
                                    <div className="text-white/90 font-semibold text-sm break-all">
                                      {pUrl}
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                      <MiniTag tone={hasJsonLd ? "good" : "neutral"}>
                                        JSON-LD: {hasJsonLd ? "yes" : "no"}
                                      </MiniTag>
                                      <MiniTag tone={hasOG ? "good" : "neutral"}>
                                        OG: {hasOG ? "yes" : "no"}
                                      </MiniTag>
                                      <MiniTag tone={hasTW ? "good" : "neutral"}>
                                        TW: {hasTW ? "yes" : "no"}
                                      </MiniTag>
                                      <MiniTag tone={emails.length ? "good" : "neutral"}>
                                        emails: {emails.length}
                                      </MiniTag>
                                      <MiniTag tone={phones.length ? "good" : "neutral"}>
                                        phones: {phones.length}
                                      </MiniTag>
                                      <MiniTag tone={socials.length ? "good" : "neutral"}>
                                        socials: {socials.length}
                                      </MiniTag>
                                      <MiniTag tone={addressLike.length ? "good" : "neutral"}>
                                        address: {addressLike.length}
                                      </MiniTag>
                                      <MiniTag tone={cityLike.length ? "good" : "neutral"}>
                                        city/region: {cityLike.length}
                                      </MiniTag>
                                    </div>

                                    {(title || meta) && (
                                      <div className="mt-3 space-y-1">
                                        {title && (
                                          <div className="text-white/80 text-sm">
                                            <span className="text-white/60 font-semibold">
                                              Title:
                                            </span>{" "}
                                            {title}
                                          </div>
                                        )}
                                        {meta && (
                                          <div className="text-white/75 text-sm">
                                            <span className="text-white/60 font-semibold">
                                              Meta:
                                            </span>{" "}
                                            {meta}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {(h1.length > 0 || h2.length > 0) && (
                                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">
                                            H1
                                          </div>
                                          {h1.length === 0 ? (
                                            <div className="text-white/60 text-sm">—</div>
                                          ) : (
                                            <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                                              {h1.slice(0, 3).map((x: any, k: number) => (
                                                <li key={k}>{String(x)}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>

                                        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">
                                            H2
                                          </div>
                                          {h2.length === 0 ? (
                                            <div className="text-white/60 text-sm">—</div>
                                          ) : (
                                            <ul className="list-disc pl-5 text-white/70 text-sm space-y-1">
                                              {h2.slice(0, 5).map((x: any, k: number) => (
                                                <li key={k}>{String(x)}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {snippet && (
                                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
                                        <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">
                                          Snippet
                                        </div>
                                        <div className="text-white/70 text-sm whitespace-pre-wrap">
                                          {snippet}
                                        </div>
                                      </div>
                                    )}

                                    {(emails.length || phones.length || socials.length) ? (
                                      <details className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
                                        <summary className="cursor-pointer text-white/70 font-semibold text-sm">
                                          Signals (emails/phones/socials)
                                        </summary>

                                        <div className="mt-2 space-y-2 text-sm">
                                          {emails.length > 0 && (
                                            <div className="text-white/70">
                                              <span className="text-white/60 font-semibold">
                                                Emails:
                                              </span>{" "}
                                              {emails.join(", ")}
                                            </div>
                                          )}
                                          {phones.length > 0 && (
                                            <div className="text-white/70">
                                              <span className="text-white/60 font-semibold">
                                                Phones:
                                              </span>{" "}
                                              {phones.join(", ")}
                                            </div>
                                          )}
                                          {socials.length > 0 && (
                                            <div className="text-white/70">
                                              <span className="text-white/60 font-semibold">
                                                Socials:
                                              </span>
                                              <ul className="list-disc pl-5 mt-1 space-y-1">
                                                {socials.slice(0, 8).map((s: any, k: number) => (
                                                  <li key={k} className="break-all">
                                                    {String(s)}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </details>

                        <details className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <summary className="cursor-pointer text-white/80 font-semibold text-sm">
                            Crawl errors ({crawlErrors.length})
                          </summary>
                          {crawlErrors.length === 0 ? (
                            <div className="mt-2 text-white/60 text-sm">—</div>
                          ) : (
                            <ul className="mt-3 list-disc pl-5 text-white/70 text-sm space-y-1">
                              {crawlErrors.slice(0, 10).map((ce: any, j: number) => (
                                <li key={j} className="break-all">
                                  <span className="text-white/80 font-semibold">
                                    {String(ce?.url ?? "")}:
                                  </span>{" "}
                                  {String(ce?.error ?? "")}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="mt-4">
                            <details className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <summary className="cursor-pointer text-white/70 font-semibold text-sm">
                                Evidence quotes ({evidence.length})
                              </summary>
                              {evidence.length === 0 ? (
                                <div className="mt-2 text-white/60 text-sm">—</div>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {evidence.slice(0, 6).map((ev: any, j: number) => (
                                    <div
                                      key={j}
                                      className="rounded-lg border border-white/10 bg-white/5 p-2"
                                    >
                                      <div className="text-white/80 text-sm font-semibold break-all">
                                        {String(ev?.url ?? "")}
                                      </div>
                                      <div className="mt-1 text-white/70 text-sm whitespace-pre-wrap">
                                        {String(ev?.quote ?? "")}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </details>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="AI insights (strategic)">{renderInsights(insights)}</Card>

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