import type {
  ExtractedPageSignals,
  GrowthAuditCompetitorIntelligence,
  GrowthAuditReport,
} from "@/lib/site-audit/types";
import { callOpenAIJson } from "./shared";
import {
  AUDIT_H1_MAX,
  AUDIT_H2_MAX,
  AUDIT_TEXT_SAMPLE_MAX,
} from "./compactContext";

type CompactCompetitorInput = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
  cta_guess?: string | null;
  trust_indicators?: string[];
  topic_patterns?: string[];
};

function compactFromSignals(s: ExtractedPageSignals): CompactCompetitorInput {
  return {
    url: s.url,
    title: s.title,
    metaDescription: s.metaDescription,
    h1: s.h1.slice(0, AUDIT_H1_MAX),
    h2: s.h2.slice(0, AUDIT_H2_MAX),
    textSample: s.textSample.slice(0, AUDIT_TEXT_SAMPLE_MAX),
    ...(s.cta_guess != null ? { cta_guess: s.cta_guess } : {}),
    ...(s.trust_indicators?.length ? { trust_indicators: s.trust_indicators.slice(0, 10) } : {}),
    ...(s.topic_patterns?.length ? { topic_patterns: s.topic_patterns.slice(0, 14) } : {}),
  };
}

const SYSTEM = `You are a principal growth strategist at a top-tier agency. You are writing a paid “Competitor Intelligence / Gap Analysis” deliverable.

You will receive JSON containing:
- user: { url, title, metaDescription, h1[], h2[], textSample, cta_guess?, trust_indicators?, topic_patterns? }
- competitors: array of up to 3 items:
  { url, ok: boolean, error?: string, extract?: same shape as user }
- (optional) user_audit_context: { scores, top_issues, quick_wins, ai_visibility, content_opportunities }

YOUR JOB
Compare the user page against available competitor extracts and identify meaningful differences that affect:
- conversion (clarity, persuasion, friction, proof, CTA)
- positioning (category, ICP, differentiation, mechanism, outcomes)
- SEO/topic coverage (what problems/queries competitors cover that user doesn’t)
- AI discoverability positioning (how clearly entities/offer are represented for LLMs)

QUALITY BAR (non-negotiable)
- No generic advice. Ban phrases like “improve UX”, “add more content”, “optimize SEO”, “be more engaging”, “use stronger CTAs” unless you tie them to specific evidence from the extracts.
- Every claimed competitor advantage MUST cite evidence using short quotes from that competitor’s title/meta/headings/textSample.
- Every user weakness/opportunity MUST cite evidence using short quotes from the user extract (or explicitly say “not present in extract”).
- Be business-first: each insight must explain why it matters (mechanism → outcome: CTR, lead quality, demo rate, trust, objection handling, AI citation likelihood).
- Do NOT invent facts: no reviews, metrics, awards, pricing, features, integrations unless present in the extracts.
- If competitors are missing/failed, proceed with what you have and state coverage limits in the summary.

OUTPUT FORMAT
Return STRICTLY valid JSON only (no markdown). No extra keys beyond this schema:

{
  "competitor_intelligence": {
    "summary": "5-8 sentences. Mention which competitors were successfully analyzed and what the comparison suggests about the category. Include 1-2 highest-impact gaps to fix first.",
    "competitor_advantages": [
      {
        "competitor": "string (competitor url or short host)",
        "advantage": "string (specific: what they do better)",
        "why_it_matters": "string (mechanism + business outcome)",
        "evidence": {
          "competitor_quotes": ["string", "string"],
          "user_quotes": ["string"]
        }
      }
    ],
    "missing_opportunities": [
      {
        "opportunity": "string (missing on user page; concrete)",
        "why_missing_matters": "string (business consequence)",
        "what_to_ship": "string (1-3 concrete edits to the page)"
      }
    ],
    "content_gaps": [
      {
        "topic": "string (topic/query cluster competitors cover)",
        "why_missing_matters": "string",
        "suggested_angle": "string (how to cover it distinctively, not copy)"
      }
    ],
    "positioning_opportunities": [
      {
        "idea": "string (differentiated positioning move)",
        "why_it_works": "string (who it resonates with + why competitors can’t easily claim it)"
      }
    ],
    "cta_improvements": [
      {
        "current_problem": "string (what’s wrong with the current CTA or next-step clarity on user page)",
        "suggested_rewrite": "string (a stronger CTA phrase or microcopy line)",
        "where_to_use": "string (hero button, sticky header, pricing block, form headline, etc.)",
        "why_it_works": "string (reduces friction / increases intent / improves qualification)"
      }
    ],
    "messaging_swipes": [
      {
        "competitor": "string",
        "pattern": "string (the messaging pattern they use: e.g. 'Outcome-first + proof line + CTA')",
        "example": "string (short example inspired by, but NOT copying, their phrasing; must be grounded in category implied by extracts)"
      }
    ]
  }
}

SCORING / PRIORITIZATION
- competitor_advantages: max 6 items, ordered by expected revenue impact.
- missing_opportunities: max 5 items, ordered by fastest-to-ship first.
- content_gaps: max 6 items, de-duplicated.
- positioning_opportunities: 3-5 items.
- cta_improvements: 5-8 items. Provide variety: low-friction, high-intent, qualification, objection-handling.
- messaging_swipes: 3-6 items.

STYLE
- Crisp, executive, agency-deck tone. Short paragraphs. No buzzwords.
- Use the language of the category implied by the extracts (don’t guess wildly).

Now produce the JSON.`;

function coerce(parsed: unknown): GrowthAuditCompetitorIntelligence | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const ciRaw = o.competitor_intelligence;
  if (!ciRaw || typeof ciRaw !== "object") return null;
  return ciRaw as GrowthAuditCompetitorIntelligence;
}

export async function analyzeCompetitorGaps(args: {
  user: ExtractedPageSignals;
  competitors: Array<
    | { url: string; ok: true; extract: ExtractedPageSignals }
    | { url: string; ok: false; error: string }
  >;
  userAuditContext?: Pick<
    GrowthAuditReport,
    "scores" | "top_issues" | "quick_wins" | "ai_visibility" | "content_opportunities"
  >;
}): Promise<
  | { ok: true; competitor_intelligence: GrowthAuditCompetitorIntelligence }
  | { ok: false; error: string }
> {
  const payload = {
    user: compactFromSignals(args.user),
    competitors: args.competitors.map((c) =>
      c.ok
        ? { url: c.url, ok: true, extract: compactFromSignals(c.extract) }
        : { url: c.url, ok: false, error: c.error }
    ),
    ...(args.userAuditContext ? { user_audit_context: args.userAuditContext } : {}),
  };

  const res = await callOpenAIJson({
    system: SYSTEM,
    user: JSON.stringify(payload),
    temperature: 0.35,
    max_tokens: 4096,
  });
  if (!res.ok) return { ok: false, error: res.error };
  const ci = coerce(res.parsed);
  if (!ci) return { ok: false, error: "Could not parse competitor intelligence output." };
  return { ok: true, competitor_intelligence: ci };
}

