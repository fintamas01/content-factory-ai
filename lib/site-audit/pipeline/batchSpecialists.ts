import type {
  AIVisibilityAnalysis,
  ContentGapsAnalysis,
  ConversionAnalysis,
  SEOAnalysis,
} from "./types";
import type { CompactAuditInput } from "./compactContext";
import { serializeAuditPageInput } from "./compactContext";
import { callOpenAIJson } from "./shared";

/**
 * Single OpenAI call: four specialist analyses on the SAME page JSON.
 * Cuts 4× duplicate user payloads + 3 extra round trips vs parallel single-phase calls.
 */
const BATCH_SYSTEM = `You are four senior consultants working on ONE client page. You receive the SAME JSON extract once. Produce ALL four analyses in ONE JSON object. Quality bar: paid agency audit—specific, non-generic, grounded in the extract only.

GROUND RULES FOR ALL SECTIONS:
- Do not invent rankings, backlinks, Core Web Vitals, crawl data, reviews, awards, or facts not in the extract.
- If the extract is thin, say so and score conservatively.
- No markdown. Plain text inside JSON strings only.

OUTPUT: strictly valid JSON with exactly these top-level keys and no extras:

{
  "seo": {
    "seo_score": number (0-100 integer),
    "seo_issues": [ { "title": "string", "detail": "string" } ],
    "technical_observations": "string",
    "content_observations": "string"
  },
  "ai_visibility": {
    "score": number (0-100 integer),
    "explanation": "string",
    "suggestions": [ "string" ]
  },
  "conversion": {
    "conversion_score": number (0-100 integer),
    "blockers": [ { "title": "string", "detail": "string" } ],
    "fixes": [ { "action": "string", "expected_result": "string" } ]
  },
  "content_gaps": {
    "content_ideas": [ { "idea": "string", "why_it_works": "string" } ],
    "gaps": [ "string" ]
  }
}

SECTION A — seo (principal SEO strategist):
- seo_score: on-page signals only—title/meta/H1 alignment, heading support, intent clarity in copy.
- seo_issues: diagnostic titles; each detail explains WHY + BUSINESS IMPACT + concrete fix angle (3-5 sentences).
- technical_observations & content_observations: 2-4 sentences each; state limits of what you cannot see.

SECTION B — ai_visibility (AI-mediated discovery / ChatGPT & SGE-style):
- score: can an AI recommend/cite this business from this page alone?
- explanation: 4-6 sentences: queryability, gaps, impact of omission.
- suggestions: 4-7 executable changes increasing citation likelihood.

SECTION C — conversion (CRO + messaging):
- conversion_score: clarity of offer, ICP, next step, trust from visible copy.
- blockers & fixes: specific; fixes tie actions to expected commercial outcomes.

SECTION D — content_gaps (performance content):
- gaps: 5-10 missing buyer topics/proof (not "more blogs").
- content_ideas: 5-8 concrete sections/assets; why_it_works ties to funnel stage, objection, or query capture.`;

function parseSeo(o: unknown): SEOAnalysis | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const seo_score = Math.max(
    0,
    Math.min(100, Math.round(Number(r.seo_score) || 0))
  );
  const seo_issues = Array.isArray(r.seo_issues)
    ? (r.seo_issues as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            title: typeof x.title === "string" ? x.title : "",
            detail: typeof x.detail === "string" ? x.detail : "",
          };
        })
        .filter((x) => x && (x.title || x.detail))
    : [];
  return {
    seo_score,
    seo_issues: seo_issues as SEOAnalysis["seo_issues"],
    technical_observations:
      typeof r.technical_observations === "string"
        ? r.technical_observations
        : "",
    content_observations:
      typeof r.content_observations === "string"
        ? r.content_observations
        : "",
  };
}

function parseAi(o: unknown): AIVisibilityAnalysis | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  const explanation =
    typeof r.explanation === "string" ? r.explanation : "";
  const suggestions = Array.isArray(r.suggestions)
    ? (r.suggestions as unknown[])
        .filter((s): s is string => typeof s === "string")
        .slice(0, 12)
    : [];
  return { score, explanation, suggestions };
}

function parseConv(o: unknown): ConversionAnalysis | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const conversion_score = Math.max(
    0,
    Math.min(100, Math.round(Number(r.conversion_score) || 0))
  );
  const blockers = Array.isArray(r.blockers)
    ? (r.blockers as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            title: typeof x.title === "string" ? x.title : "",
            detail: typeof x.detail === "string" ? x.detail : "",
          };
        })
        .filter((x) => x && (x!.title || x!.detail))
    : [];
  const fixes = Array.isArray(r.fixes)
    ? (r.fixes as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            action: typeof x.action === "string" ? x.action : "",
            expected_result:
              typeof x.expected_result === "string" ? x.expected_result : "",
          };
        })
        .filter((x) => x && (x!.action || x!.expected_result))
    : [];
  return {
    conversion_score,
    blockers: blockers as ConversionAnalysis["blockers"],
    fixes: fixes as ConversionAnalysis["fixes"],
  };
}

function parseGaps(o: unknown): ContentGapsAnalysis | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const content_ideas = Array.isArray(r.content_ideas)
    ? (r.content_ideas as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            idea: typeof x.idea === "string" ? x.idea : "",
            why_it_works:
              typeof x.why_it_works === "string" ? x.why_it_works : "",
          };
        })
        .filter((x) => x && (x!.idea || x!.why_it_works))
    : [];
  const gaps = Array.isArray(r.gaps)
    ? (r.gaps as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  return {
    content_ideas: content_ideas as ContentGapsAnalysis["content_ideas"],
    gaps: gaps.slice(0, 20),
  };
}

export type BatchedPhaseResults = {
  seo: { ok: true; data: SEOAnalysis } | { ok: false; error: string };
  aiVis:
    | { ok: true; data: AIVisibilityAnalysis }
    | { ok: false; error: string };
  conversion:
    | { ok: true; data: ConversionAnalysis }
    | { ok: false; error: string };
  gaps:
    | { ok: true; data: ContentGapsAnalysis }
    | { ok: false; error: string };
};

export async function runBatchedSpecialistAnalysis(
  compact: CompactAuditInput
): Promise<{ ok: true; results: BatchedPhaseResults } | { ok: false; error: string }> {
  const res = await callOpenAIJson({
    system: BATCH_SYSTEM,
    user: serializeAuditPageInput(compact),
    temperature: 0.32,
    max_tokens: 8192,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const root = res.parsed;
  if (!root || typeof root !== "object") {
    return { ok: false, error: "Invalid batch JSON root." };
  }
  const o = root as Record<string, unknown>;

  const seoData = parseSeo(o.seo);
  const aiData = parseAi(o.ai_visibility);
  const convData = parseConv(o.conversion);
  const gapsData = parseGaps(o.content_gaps);

  if (!seoData || !aiData || !convData || !gapsData) {
    return { ok: false, error: "Batch parse incomplete (missing sections)." };
  }

  return {
    ok: true,
    results: {
      seo: { ok: true, data: seoData },
      aiVis: { ok: true, data: aiData },
      conversion: { ok: true, data: convData },
      gaps: { ok: true, data: gapsData },
    },
  };
}
