import type { GrowthAuditReport } from "@/lib/site-audit/types";

export function parseJsonFromAssistantContent(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/s, "");
  }
  return JSON.parse(cleaned);
}

function clampScore(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
}

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

/** Normalize model JSON into GrowthAuditReport (shared with site-audit route). */
export function coerceReport(data: unknown): GrowthAuditReport | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const summary = typeof o.summary === "string" ? o.summary : "";

  const scoresRaw = o.scores;
  let seo = 50;
  let aiDisc = 50;
  let conv = 50;
  if (scoresRaw && typeof scoresRaw === "object") {
    const s = scoresRaw as Record<string, unknown>;
    seo = clampScore(Number(s.seo));
    aiDisc = clampScore(
      Number(s.ai_discoverability ?? s.ai ?? s.ai_visibility_score)
    );
    conv = clampScore(Number(s.conversion));
  } else {
    seo = clampScore(Number(o.seo_score));
    aiDisc = clampScore(
      Number(o.ai_discoverability_score ?? o.ai_readiness_score)
    );
    conv = clampScore(Number(o.conversion_score));
  }

  const topRaw = Array.isArray(o.top_issues) ? o.top_issues : [];
  const top_issues = topRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title : "";
      const impact = typeof x.impact === "string" ? x.impact : "";
      const fix = typeof x.fix === "string" ? x.fix : "";
      const p = x.priority;
      const priority =
        p === "high" || p === "medium" || p === "low" ? p : "medium";
      if (!title && !impact && !fix) return null;
      return { title, impact, fix, priority };
    })
    .filter(Boolean) as GrowthAuditReport["top_issues"];

  const qwRaw = Array.isArray(o.quick_wins) ? o.quick_wins : [];
  const quick_wins = qwRaw
    .map((it) => {
      if (typeof it === "string") {
        return { action: it, expected_result: "" };
      }
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const action = typeof x.action === "string" ? x.action : "";
      const expected_result =
        typeof x.expected_result === "string" ? x.expected_result : "";
      if (!action && !expected_result) return null;
      return { action, expected_result };
    })
    .filter(Boolean) as GrowthAuditReport["quick_wins"];

  const coRaw = Array.isArray(o.content_opportunities)
    ? o.content_opportunities
    : [];
  const content_opportunities = coRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const idea = typeof x.idea === "string" ? x.idea : "";
      const why_it_works =
        typeof x.why_it_works === "string" ? x.why_it_works : "";
      if (!idea && !why_it_works) return null;
      return { idea, why_it_works };
    })
    .filter(Boolean) as GrowthAuditReport["content_opportunities"];

  const avRaw = o.ai_visibility;
  let ai_visibility: GrowthAuditReport["ai_visibility"];
  if (avRaw && typeof avRaw === "object") {
    const av = avRaw as Record<string, unknown>;
    ai_visibility = {
      would_ai_recommend: coerceBool(av.would_ai_recommend),
      reason: typeof av.reason === "string" ? av.reason : "",
      improvement:
        typeof av.improvement === "string" ? av.improvement : "",
    };
  } else {
    ai_visibility = {
      would_ai_recommend: false,
      reason: "AI visibility block missing from model output.",
      improvement: "Regenerate the audit.",
    };
  }

  return {
    summary: summary || "Analysis complete.",
    scores: { seo, ai_discoverability: aiDisc, conversion: conv },
    top_issues,
    quick_wins,
    content_opportunities,
    ai_visibility,
  };
}
