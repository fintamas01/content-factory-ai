import type { WebsiteExtractPayload } from "./types";
import { callOpenAIJson } from "./shared";

const SYSTEM = `You are an expert in AI-mediated discovery: how ChatGPT-style assistants, answer engines, and SGE-style surfaces cite, summarize, or recommend businesses when users ask for solutions ("best X near me", "who should I hire for Y", "alternatives to Z").

You only see ONE page extract. Judge whether an AI could confidently name this business, describe what it does, differentiate it, and justify a recommendation—using ONLY this text.

INPUT: JSON from one page extract.

OUTPUT: Strictly valid JSON. No markdown.

{
  "score": number (0-100 integer),
  "explanation": "string",
  "suggestions": [ "string" ]
}

SCORING (score): High when the page states a clear entity (who), specific offer (what), who it is for (who buys), geography or scope if relevant, and proof or specificity (numbers, outcomes, differentiation). Low when copy is vague, template-like, anonymous, or could describe any competitor—because LLMs hedge or omit weak sources.

"explanation": 4-6 sentences. Cover (1) whether an AI could answer a relevant user query from this page alone, (2) WHY or WHY NOT—cite concrete gaps (e.g. no clear category, no proof, no geography), (3) IMPACT—being omitted or mis-summarized means lost high-intent referrals and zero-sum visibility vs competitors who are specific.

"suggestions": 4-7 items. Each must be a concrete, executable change (rewrite angle, add proof block, clarify ICP, add FAQ with factual anchors)—not "improve content". Each suggestion should imply WHY it increases citation likelihood.

If the extract is thin, score low and say uncertainty is high. Never invent reviews, awards, or facts not in the extract.`;

export async function analyzeAIVisibility(
  extract: WebsiteExtractPayload
): Promise<
  | { ok: true; data: import("./types").AIVisibilityAnalysis }
  | { ok: false; error: string }
> {
  const res = await callOpenAIJson({
    system: SYSTEM,
    user: JSON.stringify({
      url: extract.url,
      title: extract.title,
      metaDescription: extract.metaDescription,
      h1: extract.h1,
      h2: extract.h2.slice(0, 15),
      textSample: extract.textSample.slice(0, 8000),
    }),
    temperature: 0.35,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const o = res.parsed;
  if (!o || typeof o !== "object") return { ok: false, error: "Invalid AI JSON." };
  const r = o as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  const explanation =
    typeof r.explanation === "string" ? r.explanation : "";
  const suggestions = Array.isArray(r.suggestions)
    ? (r.suggestions as unknown[])
        .filter((s): s is string => typeof s === "string")
        .slice(0, 12)
    : [];

  return { ok: true, data: { score, explanation, suggestions } };
}
