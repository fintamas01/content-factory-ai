/**
 * Product listing health (LLM JSON): conversion + PDP/search diagnosis for Woo sync flows.
 *
 * Strategy:
 * - System prompt: principal conversion strategist; calibrated score bands; issues must be
 *   listing-specific (description = observable gap, impact = why it underperforms, fix = direction).
 * - User payload includes raw fields plus `listingSignals` from `listing-signals.ts` (heuristics only).
 * - Never invent product facts; brand appendix is fit/voice only.
 *
 * Downstream: `healthToOptimizationBrief` feeds Woo optimize (`generate-product-copy` + appendix).
 */
import OpenAI from "openai";
import { parseJsonFromAssistantContent } from "@/lib/openai/parse-json-content";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";
import { buildListingSignalsForPrompt } from "@/lib/products/listing-signals";

export type ProductHealthIssue = {
  title: string;
  description: string;
  impact: string;
  fix: string;
};

export type ProductHealthOpportunity = {
  title: string;
  reason: string;
};

export type ProductHealthResult = {
  score: number;
  issues: ProductHealthIssue[];
  opportunities: ProductHealthOpportunity[];
};

export function stripHtmlForAnalysis(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function coerceHealth(data: unknown): ProductHealthResult | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const score = typeof o.score === "number" ? o.score : Number(o.score);
  if (!Number.isFinite(score)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const issuesRaw = Array.isArray(o.issues) ? o.issues : [];
  const opportunitiesRaw = Array.isArray(o.opportunities) ? o.opportunities : [];

  const issues: ProductHealthIssue[] = issuesRaw
    .filter((x): x is Record<string, unknown> => x && typeof x === "object")
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "Issue",
      description: typeof x.description === "string" ? x.description : "",
      impact: typeof x.impact === "string" ? x.impact : "",
      fix: typeof x.fix === "string" ? x.fix : "",
    }))
    .slice(0, 12);

  const opportunities: ProductHealthOpportunity[] = opportunitiesRaw
    .filter((x): x is Record<string, unknown> => x && typeof x === "object")
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "Opportunity",
      reason: typeof x.reason === "string" ? x.reason : "",
    }))
    .slice(0, 12);

  return { score: clamped, issues, opportunities };
}

export async function analyzeProductHealthWithOpenAI(args: {
  productName: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  brandProfile: UserBrandProfileRow | null;
  openaiApiKey: string;
  model?: string;
}): Promise<{ ok: true; health: ProductHealthResult } | { ok: false; error: string }> {
  const openai = new OpenAI({ apiKey: args.openaiApiKey });

  const effectiveBrand = mergeBrandProfileForContent(undefined, args.brandProfile);
  const brandAppendix =
    args.brandProfile && effectiveBrand.name.trim()
      ? buildProductBrandIdentityAddendumEn(effectiveBrand)
      : "";

  const system = `You are a principal e-commerce conversion strategist (PDP + search). Your job is a realistic listing diagnosis: what hurts clarity, trust, differentiation, and purchase intent — and why.

## What you receive
- Raw listing fields and optional deterministic "signals" (length, redundancy heuristics). Treat signals as hints, not product facts.
- Optional brand context: use it to judge fit (voice, audience, proof types) — never invent product claims.

## Scoring rubric (calibrate honestly)
- 85–100: Clear promise, specific benefits tied to features, strong above-the-fold short copy, long copy adds proof/use cases without repeating the title; SEO title/meta would earn clicks without stuffing.
- 60–84: Usable but leaves money on the table: generic phrasing, weak hooks, thin short description, or long copy that repeats without adding value.
- 40–59: Meaningful gaps: thin or confusing copy, weak differentiation, poor scannability, or mismatch between title/short/long.
- 0–39: Missing, broken, or misleading surface — lots of filler, contradictory, or almost no usable buyer information.

## Issue quality (premium bar)
- Prefer 4–7 high-signal issues over a long vague list.
- Each issue must name a *specific* weakness in THIS listing (quote or paraphrase briefly).
- "description": what is wrong (observable).
- "impact": why it likely underperforms commercially (conversion, clarity, trust, search CTR, mobile skim) — one or two sentences.
- "fix": concrete direction for improvement (not a full rewrite). Mention what to add or re-balance (benefits, proof type, structure), still without inventing facts.

## Opportunities
- 3–6 forward-looking wins: positioning, benefit framing, objection handling, structure — distinct from issues (not restating the same point).

## Guardrails
- Do NOT invent specs, awards, materials, certifications, numbers, or social proof.
- Do NOT assume inventory, shipping, or returns unless stated in the fields.
- If copy is non-English, still analyze; write issues/opportunities in English.

Return ONLY valid JSON with keys: score (number), issues (array of {title, description, impact, fix}), opportunities (array of {title, reason}).
Max 8 issues, max 6 opportunities.`;

  const longPlain = stripHtmlForAnalysis(args.longDescription).slice(0, 12000);
  const listingSignals = buildListingSignalsForPrompt({
    title: args.title,
    shortDescription: args.shortDescription,
    longDescriptionHtml: args.longDescription,
  });

  const userPayload = {
    productName: args.productName,
    title: args.title,
    shortDescription: args.shortDescription,
    longDescriptionPlain: longPlain,
    longDescriptionWordCount: longPlain.split(/\s+/).filter(Boolean).length,
    listingSignals,
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: brandAppendix ? `${system}\n\nBrand context:\n${brandAppendix}` : system,
    },
    { role: "user", content: JSON.stringify(userPayload) },
  ];

  const completion = await openai.chat.completions.create({
    model: args.model ?? process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return { ok: false, error: "No response from the model." };

  let parsed: unknown;
  try {
    parsed = parseJsonFromAssistantContent(content);
  } catch {
    return { ok: false, error: "Could not parse health analysis." };
  }

  const health = coerceHealth(parsed);
  if (!health) return { ok: false, error: "Invalid health analysis shape." };

  return { ok: true, health };
}

export function healthSummaryText(h: ProductHealthResult): string {
  const issueTitles = h.issues.map((i) => i.title).filter(Boolean);
  const oppTitles = h.opportunities.map((o) => o.title).filter(Boolean);
  return [
    `Health score: ${h.score}/100.`,
    issueTitles.length ? `Priority gaps: ${issueTitles.slice(0, 5).join("; ")}.` : "",
    oppTitles.length ? `Upside: ${oppTitles.slice(0, 3).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Structured block appended to product-copy optimization so the writer addresses diagnosis + upside,
 * not just issue titles.
 */
export function healthToOptimizationBrief(h: ProductHealthResult): string {
  const issueLines = h.issues.slice(0, 6).map(
    (i) =>
      `- ${i.title}: ${i.description} → Impact: ${i.impact} → Direction: ${i.fix}`
  );
  const oppLines = h.opportunities.slice(0, 4).map((o) => `- ${o.title}: ${o.reason}`);
  const parts = ["LISTING DIAGNOSIS (honor facts; do not invent proof):", ...issueLines];
  if (oppLines.length) {
    parts.push("", "OPPORTUNITIES TO WEAVE INTO COPY:", ...oppLines);
  }
  return parts.join("\n");
}
