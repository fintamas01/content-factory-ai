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

  const todayRaw = Array.isArray(o.today_plan) ? o.today_plan : Array.isArray(o.today) ? o.today : [];
  const today_plan = todayRaw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const actionsRaw = Array.isArray(o.actions) ? o.actions : [];
  const actions = actionsRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const title = typeof x.title === "string" ? x.title : "";
      const priority = x.priority === "high" || x.priority === "medium" || x.priority === "low" ? x.priority : "medium";
      const impact = x.impact === "high" || x.impact === "medium" || x.impact === "low" ? x.impact : "medium";
      const effort =
        x.effort === "low" || x.effort === "medium" || x.effort === "high"
          ? (x.effort as any)
          : "medium";
      const expected_result = typeof x.expected_result === "string" ? x.expected_result : "";
      const why_it_matters = typeof x.why_it_matters === "string" ? x.why_it_matters : "";
      const howRaw = Array.isArray(x.how_to_execute) ? x.how_to_execute : [];
      const how_to_execute = howRaw
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const cta = typeof x.cta === "string" ? x.cta : "";
      const action_url = typeof x.action_url === "string" ? x.action_url : undefined;
      if (!title && !expected_result && !cta) return null;
      return { title, priority, impact, effort, expected_result, why_it_matters, how_to_execute, cta, ...(action_url ? { action_url } : {}) };
    })
    .filter(Boolean) as NonNullable<GrowthAuditReport["actions"]>;

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
      let explanation =
        typeof x.explanation === "string"
          ? x.explanation
          : typeof x.detail === "string"
            ? x.detail
            : "";
      const impact = typeof x.impact === "string" ? x.impact : "";
      const fix = typeof x.fix === "string" ? x.fix : "";
      if (!explanation && impact) explanation = impact;
      const p = x.priority;
      const priority =
        p === "high" || p === "medium" || p === "low" ? p : "medium";
      if (!title && !impact && !fix) return null;
      return { title, explanation, impact, fix, priority };
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
    const how =
      typeof av.how_systems_see_site === "string"
        ? av.how_systems_see_site
        : typeof av.how_ai_sees_site === "string"
          ? av.how_ai_sees_site
          : "";
    const concreteRaw = av.concrete_improvements;
    const concrete_improvements = Array.isArray(concreteRaw)
      ? concreteRaw
          .filter((s): s is string => typeof s === "string")
          .slice(0, 12)
      : [];
    ai_visibility = {
      would_ai_recommend: coerceBool(av.would_ai_recommend),
      reason: typeof av.reason === "string" ? av.reason : "",
      improvement:
        typeof av.improvement === "string" ? av.improvement : "",
      how_systems_see_site: how,
      concrete_improvements,
    };
  } else {
    ai_visibility = {
      would_ai_recommend: false,
      reason: "AI visibility block missing from model output.",
      improvement: "Regenerate the audit.",
      how_systems_see_site: "",
      concrete_improvements: [],
    };
  }

  const ciRaw = o.competitor_intelligence;
  let competitor_intelligence: GrowthAuditReport["competitor_intelligence"] | undefined;
  if (ciRaw && typeof ciRaw === "object") {
    const ci = ciRaw as Record<string, unknown>;
    const summary = typeof ci.summary === "string" ? ci.summary : "";
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const sliceStrings = (v: unknown, n: number) =>
      arr(v)
        .filter((x): x is string => typeof x === "string")
        .slice(0, n);

    competitor_intelligence = {
      summary,
      competitor_advantages: arr(ci.competitor_advantages)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const evidenceRaw = r.evidence;
          const evidence =
            evidenceRaw && typeof evidenceRaw === "object"
              ? {
                  competitor_quotes: sliceStrings(
                    (evidenceRaw as Record<string, unknown>).competitor_quotes,
                    4
                  ),
                  user_quotes: sliceStrings(
                    (evidenceRaw as Record<string, unknown>).user_quotes,
                    3
                  ),
                }
              : undefined;
          return {
            competitor: str(r.competitor),
            advantage: str(r.advantage),
            why_it_matters: str(r.why_it_matters),
            ...(evidence ? { evidence } : {}),
          };
        })
        .filter(Boolean)
        .slice(0, 8) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["competitor_advantages"],
      missing_opportunities: arr(ci.missing_opportunities)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          return {
            opportunity: str(r.opportunity),
            why_missing_matters: str(r.why_missing_matters),
            what_to_ship: str(r.what_to_ship),
          };
        })
        .filter(Boolean)
        .slice(0, 8) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["missing_opportunities"],
      content_gaps: arr(ci.content_gaps)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          return {
            topic: str(r.topic),
            why_missing_matters: str(r.why_missing_matters),
            suggested_angle: str(r.suggested_angle),
          };
        })
        .filter(Boolean)
        .slice(0, 10) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["content_gaps"],
      positioning_opportunities: arr(ci.positioning_opportunities)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          return { idea: str(r.idea), why_it_works: str(r.why_it_works) };
        })
        .filter(Boolean)
        .slice(0, 8) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["positioning_opportunities"],
      cta_improvements: arr(ci.cta_improvements)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          return {
            current_problem: str(r.current_problem),
            suggested_rewrite: str(r.suggested_rewrite),
            where_to_use: str(r.where_to_use),
            why_it_works: str(r.why_it_works),
          };
        })
        .filter(Boolean)
        .slice(0, 12) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["cta_improvements"],
      messaging_swipes: arr(ci.messaging_swipes)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          return {
            competitor: str(r.competitor),
            pattern: str(r.pattern),
            example: str(r.example),
          };
        })
        .filter(Boolean)
        .slice(0, 10) as NonNullable<
        GrowthAuditReport["competitor_intelligence"]
      >["messaging_swipes"],
    };
    if (
      !competitor_intelligence.summary &&
      competitor_intelligence.competitor_advantages.length === 0 &&
      competitor_intelligence.content_gaps.length === 0 &&
      competitor_intelligence.positioning_opportunities.length === 0 &&
      competitor_intelligence.cta_improvements.length === 0
    ) {
      competitor_intelligence = undefined;
    }
  }

  return {
    summary: summary || "Analysis complete.",
    scores: { seo, ai_discoverability: aiDisc, conversion: conv },
    ...(today_plan.length ? { today_plan } : {}),
    ...(actions.length ? { actions } : {}),
    top_issues,
    quick_wins,
    content_opportunities,
    ai_visibility,
    ...(competitor_intelligence ? { competitor_intelligence } : {}),
  };
}
