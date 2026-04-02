import type { GrowthAuditReport } from "@/lib/site-audit/types";
import type { AuditProgressComparison, AuditScorePillarKey } from "./types";

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function extractAuditScores(
  report: unknown
): Record<AuditScorePillarKey, number> | null {
  const r = report as GrowthAuditReport | null | undefined;
  const s = r?.scores;
  if (!s || typeof s !== "object") return null;
  return {
    seo: clampScore(Number((s as { seo?: unknown }).seo)),
    ai_discoverability: clampScore(
      Number((s as { ai_discoverability?: unknown }).ai_discoverability)
    ),
    conversion: clampScore(Number((s as { conversion?: unknown }).conversion)),
  };
}

function scoreBand(score: number): "low" | "medium" | "high" {
  if (score < 41) return "low";
  if (score < 71) return "medium";
  return "high";
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 96);
}

function titlesFromReport(report: GrowthAuditReport | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const issue of report?.top_issues ?? []) {
    const k = normalizeTitle(issue.title ?? "");
    if (k) m.set(k, issue.title);
  }
  return m;
}

/**
 * Compare previous audit report to current. Safe with partial/missing data.
 */
export function compareAuditReports(args: {
  previousReport: unknown;
  currentReport: GrowthAuditReport;
  previousRunAt: string | null;
  previousRunId: string | null;
}): AuditProgressComparison {
  const prev = args.previousReport as GrowthAuditReport | null;
  const curr = args.currentReport;

  const prevScores = extractAuditScores(prev);
  const currScores = extractAuditScores(curr);
  const base: Record<AuditScorePillarKey, number> = currScores ?? {
    seo: 0,
    ai_discoverability: 0,
    conversion: 0,
  };

  const deltas: Record<AuditScorePillarKey, number> = {
    seo: prevScores ? base.seo - prevScores.seo : 0,
    ai_discoverability: prevScores ? base.ai_discoverability - prevScores.ai_discoverability : 0,
    conversion: prevScores ? base.conversion - prevScores.conversion : 0,
  };

  const prevMap = titlesFromReport(prev);
  const currMap = titlesFromReport(curr);

  const prevKeys = new Set(prevMap.keys());
  const currKeys = new Set(currMap.keys());

  const resolvedIssueTitles: string[] = [];
  for (const k of prevKeys) {
    if (!currKeys.has(k)) resolvedIssueTitles.push(prevMap.get(k) ?? k);
  }
  const newIssueTitles: string[] = [];
  for (const k of currKeys) {
    if (!prevKeys.has(k)) newIssueTitles.push(currMap.get(k) ?? k);
  }
  const ongoingIssueTitles: string[] = [];
  for (const k of currKeys) {
    if (prevKeys.has(k)) ongoingIssueTitles.push(currMap.get(k) ?? k);
  }

  const aiBandPrevious = prevScores ? scoreBand(prevScores.ai_discoverability) : "low";
  const aiBandCurrent = scoreBand(base.ai_discoverability);

  const summaryLines: string[] = [];
  const pillars: { key: AuditScorePillarKey; label: string }[] = [
    { key: "seo", label: "SEO" },
    { key: "ai_discoverability", label: "AI visibility" },
    { key: "conversion", label: "Conversion" },
  ];
  for (const p of pillars) {
    const d = deltas[p.key];
    if (Math.abs(d) >= 1) {
      summaryLines.push(
        `${p.label} ${d > 0 ? "improved" : "changed"} by ${d > 0 ? "+" : ""}${d} points`
      );
    }
  }
  if (prevScores && aiBandPrevious !== aiBandCurrent) {
    summaryLines.push(
      `AI visibility band moved from ${aiBandPrevious} to ${aiBandCurrent}`
    );
  }
  if (resolvedIssueTitles.length) {
    summaryLines.push(
      `${resolvedIssueTitles.length} top issue${resolvedIssueTitles.length === 1 ? "" : "s"} no longer flagged (likely addressed)`
    );
  }
  if (newIssueTitles.length) {
    summaryLines.push(
      `${newIssueTitles.length} new focus area${newIssueTitles.length === 1 ? "" : "s"} in this run`
    );
  }

  const hasPrevious = Boolean(prevScores && args.previousRunAt);

  return {
    hasPrevious,
    previousRunAt: args.previousRunAt,
    previousRunId: args.previousRunId,
    deltas,
    previousScores: prevScores,
    currentScores: base,
    aiBandPrevious,
    aiBandCurrent,
    resolvedIssueTitles: resolvedIssueTitles.slice(0, 8),
    newIssueTitles: newIssueTitles.slice(0, 8),
    ongoingIssueTitles: ongoingIssueTitles.slice(0, 6),
    summaryLines: summaryLines.slice(0, 6),
  };
}
