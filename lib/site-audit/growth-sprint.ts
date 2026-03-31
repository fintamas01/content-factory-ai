import type {
  GrowthAuditReport,
  GrowthSprintPlan,
  GrowthSprintTask,
} from "@/lib/site-audit/types";
import { callOpenAIJson } from "@/lib/site-audit/pipeline/shared";

const SYSTEM = `You are a senior growth consultant and operating partner. You turn audits into 30-day execution roadmaps that feel like a paid agency deliverable.

INPUT
You receive JSON for ONE audited page:
- signals: { url, title, metaDescription, h1Count, h2Count }
- report: { summary, scores, top_issues[], quick_wins[], content_opportunities[], ai_visibility, competitor_intelligence? }

MISSION
Produce a 30-day growth sprint plan that a small team can ship. This is a sequencing problem: fix the highest leverage constraints first, then scale content and competitive differentiation.

NON‑NEGOTIABLE QUALITY BAR
- No generic tasks. A task cannot be a category (“Improve SEO”, “Build trust”). It must be a ship-able change with a clear location (hero, above-the-fold, FAQ, pricing section, footer, meta tags, H1/H2 structure, proof block, etc.).
- Traceability: every task must reference at least ONE concrete input:
  - an audit issue title OR
  - a quick win action OR
  - an AI visibility improvement OR
  - a content opportunity idea OR
  - a competitor intelligence item (if present)
  If competitor_intelligence is missing, do NOT mention competitors.
- Business-first impact: estimated_impact must state mechanism → outcome (e.g. “clarifies offer → higher demo intent”, “adds proof → reduces risk → higher conversion”, “intent-matched title/meta → higher CTR”).
- Realistic sequencing:
  - Week 1 = foundational conversion & clarity (value prop, offer, proof, CTA, friction removal) + must-fix technical/on-page blockers if present.
  - Week 2 = differentiation + competitive gaps + trust expansion.
  - Week 3 = demand capture content (clusters tied to opportunities/gaps) + distribution basics.
  - Week 4 = optimization & iteration (A/B tests, measurement, refine what worked).
- Distinguish quick wins vs foundational work:
  - Quick wins: low effort, same-day shipping, minimal dependencies.
  - Foundational: architecture of messaging/offer/proof; may require design or stakeholder input.
- Avoid busywork. Prefer fewer tasks with clearer outcomes.

TASK WRITING RULES
- title: short, specific, starts with a verb (“Rewrite hero headline to …”, “Add proof block: …”).
- description: 2–4 sentences. Include WHAT to ship, WHERE to ship it, and one dependency or acceptance criterion when relevant.
- priority:
  - high = blocks conversion/clarity or unlocks multiple downstream efforts
  - medium = meaningful improvement but not a bottleneck
  - low = nice-to-have or later optimization
- effort:
  - low = < 2 hours
  - medium = half day to 2 days
  - high = multi-day / cross-functional

OUTPUT
Return STRICTLY valid JSON only. No markdown. No extra keys. Keep it concise but decisive.

Schema:
{
  "summary": "string (6-10 sentences; include sequencing rationale and 2-3 highest-leverage moves)",
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "goal": "string",
      "tasks": [
        {
          "title": "string",
          "description": "string (2-4 sentences; what/where + acceptance criteria or dependency)",
          "priority": "high|medium|low",
          "estimated_impact": "string (mechanism + outcome)",
          "effort": "low|medium|high"
        }
      ]
    }
  ],
  "quickest_wins": [
    { "title": "string", "reason": "string (why it’s fast + what it unlocks)" }
  ],
  "highest_leverage_moves": [
    { "title": "string", "reason": "string (why it moves key metrics and what it depends on)" }
  ]
}

CONSTRAINTS
- weeks must include exactly 4 items (week 1..4).
- each week tasks: 4–7 items.
- quickest_wins: exactly 5 items.
- highest_leverage_moves: exactly 5 items.
- Avoid repeating the same task across weeks; sequence instead.
`;

function coercePriority(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function coerceEffort(v: unknown): "low" | "medium" | "high" {
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function coerceTask(raw: unknown): GrowthSprintTask | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const estimated_impact =
    typeof o.estimated_impact === "string" ? o.estimated_impact.trim() : "";
  if (!title && !description) return null;
  return {
    title,
    description,
    priority: coercePriority(o.priority),
    estimated_impact,
    effort: coerceEffort(o.effort),
  };
}

export function coerceGrowthSprintPlan(parsed: unknown): GrowthSprintPlan | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : "";
  const weeksRaw = Array.isArray(o.weeks) ? o.weeks : [];
  const weeks = weeksRaw
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const ww = w as Record<string, unknown>;
      const week = Number(ww.week);
      const theme = typeof ww.theme === "string" ? ww.theme : "";
      const goal = typeof ww.goal === "string" ? ww.goal : "";
      const tasksRaw = Array.isArray(ww.tasks) ? ww.tasks : [];
      const tasks = tasksRaw.map(coerceTask).filter(Boolean) as GrowthSprintTask[];
      if (!Number.isFinite(week)) return null;
      return { week, theme, goal, tasks };
    })
    .filter(Boolean) as GrowthSprintPlan["weeks"];

  const list = (raw: unknown, max: number) =>
    (Array.isArray(raw) ? raw : [])
      .map((r) => {
        if (!r || typeof r !== "object") return null;
        const rr = r as Record<string, unknown>;
        const title = typeof rr.title === "string" ? rr.title : "";
        const reason = typeof rr.reason === "string" ? rr.reason : "";
        if (!title && !reason) return null;
        return { title, reason };
      })
      .filter(Boolean)
      .slice(0, max) as Array<{ title: string; reason: string }>;

  const quickest_wins = list(o.quickest_wins, 8);
  const highest_leverage_moves = list(o.highest_leverage_moves, 8);

  if (!summary && weeks.length === 0) return null;
  return { summary, weeks, quickest_wins, highest_leverage_moves };
}

export async function generateGrowthSprintPlan(args: {
  report: GrowthAuditReport;
  signals: {
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    h2Count: number;
  };
}): Promise<{ ok: true; plan: GrowthSprintPlan } | { ok: false; error: string }> {
  const user = JSON.stringify({
    signals: args.signals,
    report: args.report,
  });

  const res = await callOpenAIJson({
    system: SYSTEM,
    user,
    temperature: 0.33,
    max_tokens: 4096,
  });

  if (!res.ok) return { ok: false, error: res.error };
  const plan = coerceGrowthSprintPlan(res.parsed);
  if (!plan) return { ok: false, error: "Could not parse growth sprint plan." };
  return { ok: true, plan };
}

