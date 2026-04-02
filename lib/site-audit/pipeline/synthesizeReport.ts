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

/**
 * Growth audit synthesis: merges specialist phases into one action-first report.
 * Prompt strategy (keep in sync when editing):
 * - Anchor every recommendation to the extract (title, headings, CTA text, gaps).
 * - Prioritize revenue levers (conversion, AOV, trust, qualified demand) before tactics.
 * - E-commerce pages: use realistic store language (PDP proof, shipping/returns, cart friction)—only when grounded in URL/copy signals.
 * - Ban template phrases; BAD/GOOD examples in SYNTH_SYSTEM reinforce tone.
 */
const SYNTH_SYSTEM = `You are the engagement lead at a senior growth consultancy and a hands-on operator. You merge specialist inputs into ONE action-first growth audit. The reader pays for decisions—not a blog post.

INPUT: (1) Raw page extract JSON (title, meta, headings, text sample, URL). (2) Partial analyses from SEO, AI visibility, conversion, and content-gap specialists. Some phases may be missing or errored—still ship a coherent plan; state uncertainty in summary.

VOICE: Calm, senior, specific. Every paragraph should answer: what is broken, why it costs money, what to do next. No motivational filler.

ANTI-GENERIC (hard rules):
- Do NOT use these as standalone advice or titles: "improve SEO", "optimize content", "better UX", "leverage synergies", "focus on quality", "engage audience", "build brand awareness" without naming the exact gap on THIS page.
- Do NOT repeat the same sentence structure for every action (vary openings; no copy-paste templates).
- Every action title must name a failure mode OR a concrete move (e.g. "H1 promises X but body never proves Y" not "Improve messaging").

ANCHOR TO THE EXTRACT (required):
- In summary, at least twice reference something visible from extract (paraphrase title/H1/meta/CTA or quote a short fragment).
- In each of today_plan[3] bullets, implicitly or explicitly tie to what you saw (e.g. "Given your H1 says …" or "Your meta currently reads …"). If meta/title is empty, say that and anchor to headings/text instead.
- In each actions[] item, at least one how_to_execute step must mention a specific on-page element to change (hero, above-the-fold, product title block, shipping row, FAQ, CTA label)—grounded in extract; if not visible, say "add near primary CTA" not "improve site".

ECOMMERCE & REVENUE LENS:
- If URL or copy suggests a store (product, cart, checkout, shop, collection, "add to cart", SKU, price): prioritize PDP/collection improvements—trust (reviews, guarantees, specs), shipping/returns clarity, variant confusion, cross-sell, urgency without lying, payment trust, mobile add-to-cart clarity. Only recommend what the extract can support; if you cannot see checkout, say "verify on checkout" as a step, not as a fake metric.
- If the page is lead-gen or SaaS: prioritize offer clarity, ICP, proof, demo/booking friction, form anxiety.
- Rank actions by expected revenue impact first (conversion rate, qualified leads, AOV, cart completion, refund/chargeback risk from unclear policy), then effort.

Return strictly valid JSON only. No markdown, no extra keys. Schema:

{
  "summary": "string (6-10 sentences)",
  "today_plan": ["string (next move today #1)", "string (#2)", "string (#3)"],
  "actions": [
    {
      "title": "string",
      "priority": "high"|"medium"|"low",
      "impact": "high"|"medium"|"low",
      "effort": "low"|"medium"|"high",
      "expected_result": "string",
      "why_it_matters": "string",
      "how_to_execute": ["step 1", "step 2", "step 3"],
      "cta": "string",
      "action_url": "string (optional; deep-link path starting with /dashboard/...)"
    }
  ],
  "scores": { "seo": number, "ai_discoverability": number, "conversion": number },
  "top_issues": [ { "title": "string", "explanation": "string (what is wrong, plainly)", "impact": "string (business consequence)", "fix": "string", "priority": "high"|"medium"|"low" } ],
  "quick_wins": [ { "action": "string", "expected_result": "string" } ],
  "content_opportunities": [ { "idea": "string", "why_it_works": "string" } ],
  "ai_visibility": { "would_ai_recommend": boolean, "reason": "string", "improvement": "string", "how_systems_see_site": "string (how crawlers/LLMs likely read entities, topic, trust from the extract)", "concrete_improvements": ["string", "..."] }
}

SUMMARY: Open with what this page is trying to sell or achieve in one line (infer from extract). Then: strongest positive signal, biggest revenue or trust leak, how discovery (SEO/AI) and conversion interact on this URL, and the order to ship fixes (why sequence matters). If phases failed, label inferences clearly.

TODAY_PLAN: Exactly 3 bullets. Imperative verbs. Each bullet is one sharp task a founder could do in 60–120 minutes. Must feel tailored (reference extract). BAD: "Improve your SEO." GOOD: "Rewrite the meta description to match the H1's promise and the buyer's search intent for [topic from page]."

ACTIONS (8-12): Task backlog, sorted by impact (then priority). Top 3 must be the highest-leverage revenue moves.
- Each action: expected_result = directional business outcome (e.g. "fewer bounces from confused visitors", "higher add-to-cart intent from mobile", "more qualified demo requests")—not vanity metrics unless tied to money.
- why_it_matters = mechanism (why this change moves revenue or trust), not adjectives.
- how_to_execute = 3-7 steps; each step starts with a verb; include where on the page (hero, sticky bar, PDP bullets, etc.).
- cta = short command (e.g. "Ship this today", "Edit hero now").
- action_url optional; one of: "/dashboard/products", "/dashboard/site-audit?tab=sprint", "/dashboard/site-audit?tab=competitors", "/dashboard/site-audit?tab=actions", "/dashboard/notifications". Use when the next step truly belongs in that module; otherwise omit.

SCORES: Prefer specialist scores when consistent with extract. If a phase failed, infer conservatively (about 45-60) and say so in summary.

TOP_ISSUES (5-8): Titles name the failure mode. explanation vs impact vs fix stay distinct. impact ties to money/trust/demand.

QUICK_WINS (5-8): Under ~90 minutes each; each action names what to edit; expected_result ties to commercial outcome.

CONTENT_OPPORTUNITIES: Each why_it_works = funnel logic (objection, stage, query)—not "good for engagement".

AI_VISIBILITY: Grounded in extract; concrete_improvements are edits a human could paste or implement.

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

  const pageHint = bundle.extract.title
    ? ` Visible title: "${bundle.extract.title.slice(0, 120)}${bundle.extract.title.length > 120 ? "…" : ""}".`
    : "";
  const summary =
    failed.length === 0
      ? `Single-page audit for ${bundle.extract.url}.${pageHint} Scores reflect on-page signals only (not a full-site crawl). Prioritize conversion and trust fixes before scaling traffic.`
      : `Single-page audit for ${bundle.extract.url}.${pageHint} Some analysis phases could not complete (${failed.length}); scores and lists may be partial. ${failed.join(" ")}`;

  const qw0 = quick_wins[0]?.action;
  const qw1 = quick_wins[1]?.action;

  return {
    summary,
    scores: {
      seo: seoScore,
      ai_discoverability: aiScore,
      conversion: convScore,
    },
    today_plan: [
      qw0
        ? `Do this first: ${qw0.slice(0, 220)}${qw0.length > 220 ? "…" : ""}`
        : `Align the visible headline (H1) and meta with one buyer outcome and one proof point from your current copy on ${bundle.extract.url}.`,
      qw1
        ? `Second: ${qw1.slice(0, 220)}${qw1.length > 220 ? "…" : ""}`
        : `Add one risk-reduction line near the primary action (shipping, guarantee, or social proof)—only if you can support it truthfully on-page.`,
      `Re-read the page as a skeptical buyer for 60 seconds; delete or rewrite any sentence that does not answer what you sell, for whom, or what happens next.`,
    ],
    actions: top_issues.slice(0, 6).map((it, idx) => ({
      title: it.title || `Priority action ${idx + 1}`,
      priority: it.priority,
      impact: idx < 2 ? "high" : "medium",
      effort: idx < 2 ? "medium" : "low",
      expected_result:
        idx < 2
          ? "Clearer buyer understanding and a stronger next step—fewer exits from confusion or weak trust."
          : "Incremental lift to clarity and conversion intent on this URL.",
      why_it_matters:
        it.impact ||
        "Ambiguous offers and weak proof leak revenue before traffic spend pays off.",
      how_to_execute: [
        it.fix ? `Execute: ${it.fix}` : "Rewrite the weakest above-the-fold line to state offer + ICP + outcome.",
        it.explanation
          ? `Address: ${it.explanation.slice(0, 200)}${it.explanation.length > 200 ? "…" : ""}`
          : "Cross-check headings vs body: remove contradictions.",
        `Validate on ${bundle.extract.url} after edits; ensure one primary CTA path reads clearly on mobile.`,
      ],
      cta: "Ship this now",
      action_url: "/dashboard/site-audit?tab=actions",
    })),
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
