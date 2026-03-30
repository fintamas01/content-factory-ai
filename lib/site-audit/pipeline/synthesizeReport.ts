import type { GrowthAuditReport } from "@/lib/site-audit/types";
import { coerceReport, parseJsonFromAssistantContent } from "@/lib/site-audit/coerce-report";
import { buildCompactAuditInput } from "./compactContext";
import { siteAuditOpenAI, getSiteAuditModel } from "./shared";
import type {
  AIVisibilityAnalysis,
  ContentGapsAnalysis,
  ConversionAnalysis,
  SEOAnalysis,
  WebsiteExtractPayload,
} from "./types";

export type PhaseBundle = {
  extract: WebsiteExtractPayload;
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

const SYNTH_SYSTEM = `You are the engagement lead at a senior growth consultancy. You merge specialist inputs into ONE client-ready audit memo. The reader is a business owner or marketing lead paying for clarity—not buzzwords.

INPUT: (1) Raw page extract JSON. (2) Partial analyses from SEO, AI visibility, conversion, and content-gap specialists. Some phases may be missing or errored—still deliver a unified narrative; note uncertainty in the summary if inputs are partial.

VOICE: Confident, specific, revenue-aware. Sound like an agency deck: diagnosis → mechanism → business consequence → what to ship first.

Return strictly valid JSON only. No markdown, no extra keys. Schema:

{
  "summary": "string (6-10 sentences)",
  "scores": { "seo": number, "ai_discoverability": number, "conversion": number },
  "top_issues": [ { "title": "string", "explanation": "string (what is wrong, plainly)", "impact": "string (business consequence)", "fix": "string", "priority": "high"|"medium"|"low" } ],
  "quick_wins": [ { "action": "string", "expected_result": "string" } ],
  "content_opportunities": [ { "idea": "string", "why_it_works": "string" } ],
  "ai_visibility": { "would_ai_recommend": boolean, "reason": "string", "improvement": "string", "how_systems_see_site": "string (how crawlers/LLMs likely read entities, topic, trust from the extract)", "concrete_improvements": ["string", "..."] }
}

SUMMARY: Open with what this page is trying to achieve in one line. Then: strongest signal from the extract, the single biggest revenue or trust risk, how SEO / conversion / AI-mediated discovery interact on this URL, and the recommended sequencing (what to fix before spending on traffic). If specialist data was incomplete, say what was inferred vs certain.

SCORES: Prefer specialist phase scores when present and consistent with the extract. If a phase failed, infer conservatively (roughly 45-60) and reflect uncertainty in summary—not fake precision.

TOP_ISSUES (5-8): Each "title" is diagnostic and specific—never "Improve SEO" or "Better content" without naming the failure mode.

Each "explanation" states the on-page problem in plain language (distinct from impact).

Each "impact" must explain WHY the issue hurts the business (qualified traffic, snippet CTR, trust, lead quality, AI citation likelihood) in concrete terms—not "bad UX".

Each "fix" is one clear executable move (what to rewrite, add, or remove)—not a category.

QUICK_WINS (5-8): Actions doable in under ~90 minutes on this page; "expected_result" ties to a plausible commercial outcome.

CONTENT_OPPORTUNITIES: Merge and dedupe with content specialist ideas; each "why_it_works" must state marketing logic (stage, objection, query capture).

AI_VISIBILITY: Align with AI specialist score. "reason" cites evidence from the extract. "improvement" is 1-3 concrete changes. "how_systems_see_site" explains retrieval/representation (what topic/entity signals exist, what is ambiguous). "concrete_improvements" is 3-6 specific edits (not generic SEO).

GUARDRAILS: Never invent reviews, awards, metrics, or page elements not in the extract. Plain text only inside JSON strings.`;

function mergeFallback(bundle: PhaseBundle): GrowthAuditReport {
  const seoScore = bundle.seo.ok ? bundle.seo.data.seo_score : 50;
  const aiScore = bundle.aiVis.ok ? bundle.aiVis.data.score : 50;
  const convScore = bundle.conversion.ok
    ? bundle.conversion.data.conversion_score
    : 50;

  const top_issues: GrowthAuditReport["top_issues"] = [];

  if (bundle.seo.ok) {
    for (const issue of bundle.seo.data.seo_issues.slice(0, 4)) {
      top_issues.push({
        title: issue.title || "SEO issue",
        explanation: issue.detail || "On-page SEO signal gap or mismatch.",
        impact:
          "Search visibility, snippet CTR, and qualified clicks can suffer when titles/headings/meta do not match intent.",
        fix: "Rewrite meta/title/headings per SEO observations.",
        priority: "high",
      });
    }
  }
  if (bundle.conversion.ok) {
    for (const b of bundle.conversion.data.blockers.slice(0, 4)) {
      top_issues.push({
        title: b.title || "Conversion blocker",
        explanation: b.detail || "Messaging or proof gap on the page.",
        impact:
          "Conversion rate and lead quality suffer when visitors lack clarity, proof, or a crisp next step.",
        fix: "Clarify offer, CTA, and proof using conversion fixes below.",
        priority: "medium",
      });
    }
  }

  const quick_wins: GrowthAuditReport["quick_wins"] = [];
  if (bundle.conversion.ok) {
    for (const f of bundle.conversion.data.fixes.slice(0, 8)) {
      if (f.action || f.expected_result) {
        quick_wins.push({
          action: f.action || "Improve page clarity",
          expected_result: f.expected_result || "Higher conversion intent.",
        });
      }
    }
  }

  const content_opportunities: GrowthAuditReport["content_opportunities"] =
    bundle.gaps.ok
      ? bundle.gaps.data.content_ideas.slice(0, 7).map((c) => ({
          idea: c.idea,
          why_it_works: c.why_it_works,
        }))
      : [];

  const ai_visibility: GrowthAuditReport["ai_visibility"] = bundle.aiVis.ok
    ? {
        would_ai_recommend: bundle.aiVis.data.score >= 60,
        reason: bundle.aiVis.data.explanation,
        improvement: bundle.aiVis.data.suggestions.slice(0, 5).join(" "),
        how_systems_see_site: bundle.aiVis.data.explanation,
        concrete_improvements: bundle.aiVis.data.suggestions.slice(0, 8),
      }
    : {
        would_ai_recommend: false,
        reason: "AI discoverability phase did not complete.",
        improvement: "Re-run the audit or add clearer entity and proof on the page.",
        how_systems_see_site: "",
        concrete_improvements: [],
      };

  const failed: string[] = [];
  if (!bundle.seo.ok) failed.push(`SEO: ${bundle.seo.error}`);
  if (!bundle.aiVis.ok) failed.push(`AI: ${bundle.aiVis.error}`);
  if (!bundle.conversion.ok) failed.push(`Conversion: ${bundle.conversion.error}`);
  if (!bundle.gaps.ok) failed.push(`Gaps: ${bundle.gaps.error}`);

  const summary =
    failed.length === 0
      ? `Single-page audit for ${bundle.extract.url}. Scores reflect on-page signals only (not full-site crawl). Review top issues and quick wins first.`
      : `Single-page audit for ${bundle.extract.url}. Some analysis phases could not complete (${failed.length}); scores and lists may be partial. ${failed.join(" ")}`;

  return {
    summary,
    scores: {
      seo: seoScore,
      ai_discoverability: aiScore,
      conversion: convScore,
    },
    top_issues: top_issues.slice(0, 8),
    quick_wins: quick_wins.slice(0, 8),
    content_opportunities,
    ai_visibility,
  };
}

/**
 * Phase 6: combine phase outputs into the final GrowthAuditReport.
 * If synthesis fails, returns mergeFallback (still valid for UI).
 */
export async function synthesizeReport(
  bundle: PhaseBundle
): Promise<GrowthAuditReport> {
  const compact = buildCompactAuditInput(bundle.extract);
  const payload = {
    extract: compact,
    phases: {
      seo: bundle.seo.ok ? bundle.seo.data : { error: bundle.seo.error },
      ai_discoverability: bundle.aiVis.ok
        ? bundle.aiVis.data
        : { error: bundle.aiVis.error },
      conversion: bundle.conversion.ok
        ? bundle.conversion.data
        : { error: bundle.conversion.error },
      content_gaps: bundle.gaps.ok ? bundle.gaps.data : { error: bundle.gaps.error },
    },
  };

  try {
    const completion = await siteAuditOpenAI.chat.completions.create({
      model: getSiteAuditModel(),
      temperature: 0.25,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYNTH_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return mergeFallback(bundle);
    let parsed: unknown;
    try {
      parsed = parseJsonFromAssistantContent(content);
    } catch {
      return mergeFallback(bundle);
    }
    const report = coerceReport(parsed);
    if (!report) return mergeFallback(bundle);
    return report;
  } catch {
    return mergeFallback(bundle);
  }
}
