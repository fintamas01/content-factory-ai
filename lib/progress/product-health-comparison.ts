import type { ProductHealthResult } from "@/lib/products/product-health";
import type { ProductHealthProgressComparison } from "./types";

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 96);
}

function titleMap(issues: ProductHealthResult["issues"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const issue of issues ?? []) {
    const k = normalizeTitle(issue.title ?? "");
    if (k) m.set(k, issue.title);
  }
  return m;
}

export function compareProductHealth(args: {
  previous: ProductHealthResult | null;
  current: ProductHealthResult;
  previousRunAt: string | null;
  previousGenerationId: string | null;
}): ProductHealthProgressComparison {
  const prev = args.previous;
  const curr = args.current;

  const prevScore = prev ? Math.round(Math.max(0, Math.min(100, prev.score))) : null;
  const currScore = Math.round(Math.max(0, Math.min(100, curr.score)));
  const scoreDelta = prevScore !== null ? currScore - prevScore : 0;

  const prevMap = prev ? titleMap(prev.issues) : new Map<string, string>();
  const currMap = titleMap(curr.issues);

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

  const summaryLines: string[] = [];
  if (prevScore !== null && Math.abs(scoreDelta) >= 1) {
    summaryLines.push(
      `Listing health score ${scoreDelta >= 0 ? "improved" : "changed"} by ${scoreDelta >= 0 ? "+" : ""}${scoreDelta} (${prevScore} → ${currScore})`
    );
  }
  if (resolvedIssueTitles.length) {
    summaryLines.push(
      `${resolvedIssueTitles.length} issue${resolvedIssueTitles.length === 1 ? "" : "s"} cleared from the last analysis`
    );
  }
  if (newIssueTitles.length) {
    summaryLines.push(`${newIssueTitles.length} new issue${newIssueTitles.length === 1 ? "" : "s"} flagged`);
  }

  return {
    hasPrevious: prev !== null && args.previousRunAt !== null,
    previousRunAt: args.previousRunAt,
    previousGenerationId: args.previousGenerationId,
    scoreDelta,
    previousScore: prevScore,
    currentScore: currScore,
    resolvedIssueTitles: resolvedIssueTitles.slice(0, 10),
    newIssueTitles: newIssueTitles.slice(0, 10),
    ongoingIssueTitles: ongoingIssueTitles.slice(0, 8),
    summaryLines: summaryLines.slice(0, 6),
  };
}
