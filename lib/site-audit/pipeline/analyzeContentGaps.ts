import type { WebsiteExtractPayload } from "./types";
import {
  buildCompactAuditInput,
  serializeAuditPageInput,
} from "./compactContext";
import { callOpenAIJson } from "./shared";

const SYSTEM = `You are a content strategist at a performance marketing agency. Your job is to find what this ONE page fails to cover that buyers and searchers still need—so the business can capture demand and handle objections.

INPUT: JSON extracted from a single URL (not a full site map). Infer gaps only from what the page implies it is trying to sell and who it serves.

OUTPUT: Strictly valid JSON. No markdown.

{
  "content_ideas": [ { "idea": "string", "why_it_works": "string" } ],
  "gaps": [ "string" ]
}

"gaps": 5-10 short strings. Each names a missing topic, proof type, or buyer question (e.g. pricing transparency, comparison to alternatives, implementation timeline, risk reversal, industry-specific objection). Avoid generic entries like "more blog posts".

"content_ideas": 5-8 items. Each "idea" is a concrete asset or on-page section (e.g. "Comparison table: vs in-house hire", "FAQ block for pricing and contract length", "Case snippet: before/after metric for [vertical]"). No vague "create more content".

"why_it_works" for each idea must explain marketing logic: which funnel stage it serves (awareness vs consideration vs decision), which objection it removes, which long-tail queries or AI-surface questions it captures, or how it increases trust and time-on-page. Tie to IMPACT: leads, sales conversations, snippet eligibility—not "engagement" alone.

If the extract is thin, state that gap analysis is limited and prioritize the highest-leverage additions you can justify.`;

export async function analyzeContentGaps(
  extract: WebsiteExtractPayload
): Promise<
  | { ok: true; data: import("./types").ContentGapsAnalysis }
  | { ok: false; error: string }
> {
  const ctx = buildCompactAuditInput(extract);
  const res = await callOpenAIJson({
    system: SYSTEM,
    user: serializeAuditPageInput(ctx),
    temperature: 0.4,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const o = res.parsed;
  if (!o || typeof o !== "object") return { ok: false, error: "Invalid gaps JSON." };
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
    ok: true,
    data: {
      content_ideas:
        content_ideas as import("./types").ContentGapsAnalysis["content_ideas"],
      gaps: gaps.slice(0, 20),
    },
  };
}
