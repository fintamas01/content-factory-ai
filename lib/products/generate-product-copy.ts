/**
 * PDP copy generation / improve (JSON): `/api/generate-product` and Woo optimize.
 *
 * Strategy:
 * - SYSTEM_BASE: outcome-led conversion framework, strict field rules (short = above-the-fold hook,
 *   SEO = SERP-useful, bullets = distinct angles), anti-template and anti-fake-proof.
 * - SYSTEM_MODE_IMPROVE: store-ready rewrite; remove cross-field redundancy; optional OPTIMIZATION BRIEF.
 * - Brand: `buildProductBrandIdentityAddendumEn` on system message; structured `brandVoiceContext` in user JSON.
 * - Woo optimize appends `buildProductOptimizationAppendix(optimizationContext)`; temperature bumps slightly
 *   when that appendix is present. Keep claims grounded in user payload only.
 */
import OpenAI from "openai";
import { parseJsonFromAssistantContent } from "@/lib/openai/parse-json-content";
import type { ProductCopyResult, ProductGeneratorInput } from "@/lib/products/types";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";

const SYSTEM_BASE = `You are a principal e-commerce conversion copywriter for PDPs and on-site search. You write copy that could ship on a serious D2C or marketplace catalog: specific, benefit-led, and commercially defensible — never template filler.

CONVERSION FRAMEWORK (apply implicitly)
- Lead with outcomes: what changes for the buyer (time saved, friction removed, confidence gained) before adjectives.
- Feature → mechanism → benefit: when you mention a feature, tie it to a practical payoff the buyer feels.
- Differentiation: say why this product vs. a generic alternative — without invented claims.
- Objections: pre-handle common doubts (fit, complexity, maintenance) only when grounded in provided details.

NON-NEGOTIABLES
- Ground every claim in the provided input only. Do NOT invent certifications, awards, numbers, materials, warranties, compatibility, or guarantees unless provided.
- Be concrete: prefer “what it is + who it’s for + what outcome it delivers” over hollow adjectives.
- Avoid generic AI language and empty hype.

STYLE
- Premium, confident, human. Crisp rhythm. Minimal fluff.
- Use brand voice naturally if provided: mirror tone and audience, without repeating slogans or stuffing the brand name.

OUTPUT FORMAT (STRICT)
Return ONLY valid JSON, no markdown, no code fences, no extra keys:
{
  "title": "string",
  "short_description": "string",
  "description": "string",
  "bullets": ["string"],
  "seo_title": "string",
  "seo_description": "string"
}

FIELD RULES (premium bar)
- title: 6–12 words. Merchant-ready: clear category + differentiator. Avoid spammy stacks of keywords; no “Ultimate/Best/Revolutionary” unless supported by input.
- short_description: 1–2 sentences, ≤ 220 characters. This is above-the-fold: hook + clearest outcome + one credible differentiator. Must read like a human merchandiser, not a bullet list crammed into prose.
- description: 2–4 short paragraphs OR 4–7 sentences. Plain text, no markdown. Progressive detail: promise → supporting detail → use cases → reassurance (only if grounded). No duplicated sentences from short_description.
- bullets: exactly 5 bullets. Each ≤ 120 characters. Each bullet must add a new angle: feature→benefit, scenario, comparison-to-generic, setup/usage clarity, or “what you’ll notice first” — not five ways to say “great quality”.
- seo_title: ~50–60 characters when possible. Natural language; primary intent clear; avoid pipe-stuffing and repetition.
- seo_description: ~150–160 characters. Compelling SERP snippet: clear value + specificity + soft CTA (“Shop…”, “See…”, “Discover…”) without fake urgency.

BANNED (unless explicitly supported)
- “high quality”, “great value”, “best-in-class”, “game-changer”, “premium quality” (without specifics)
- fabricated proof (“trusted by 10,000+”, “award-winning”, “#1”)
- repeating the same idea across title/short/description/bullets/SEO with light synonym swaps`;

const SYSTEM_MODE_GENERATE = `MODE: GENERATE
- Create fresh copy from the provided inputs.
- If details are thin, write tightly and transparently. Prefer safe, universal benefits that follow from the input.
- Do not add “features” that are not provided. If you need missing info, choose conservative wording.`;

const SYSTEM_MODE_IMPROVE = `MODE: IMPROVE (store-ready listing rewrite)
You receive existingTitle / existingShortDescription / existingDescription (may include HTML noise). Optimize for conversion and search clarity:

- Preserve factual product meaning and constraints. Do NOT alter specs, dimensions, compatibility, or variant logic.
- Rebalance weak areas: if the short description is thin, rebuild it as a persuasive above-the-fold hook (still honest).
- Remove redundancy across fields: title vs. short vs. long should not repeat the same sentence with synonyms.
- Strengthen benefit language where the text is feature-only (“stainless steel”) → add grounded payoff (“easy to clean daily”, “built for daily use”) only when it follows from the input.
- If an OPTIMIZATION BRIEF or LISTING SIGNALS section is present, treat it as prioritized editorial direction — still never invent proof.
- Output must be clean plain text (no HTML).`;

function pickGoal(input: ProductGeneratorInput): "generate" | "improve" {
  if (input.goal === "generate" || input.goal === "improve") return input.goal;
  const hasExisting =
    Boolean(input.existingTitle?.trim()) ||
    Boolean(input.existingDescription?.trim()) ||
    Boolean(input.existingShortDescription?.trim());
  return hasExisting ? "improve" : "generate";
}

function buildSystemPrompt(goal: "generate" | "improve", brandAppendix?: string) {
  const mode = goal === "improve" ? SYSTEM_MODE_IMPROVE : SYSTEM_MODE_GENERATE;
  const base = `${SYSTEM_BASE}\n\n${mode}`.trim();
  return brandAppendix ? `${base}\n\n${brandAppendix}` : base;
}

/** Wraps structured diagnosis + signals for the user message (Woo optimize and similar). */
export function buildProductOptimizationAppendix(optimizationContext: string): string {
  const t = optimizationContext.trim();
  if (!t) return "";
  return [
    "---",
    "OPTIMIZATION BRIEF (follow closely; honor facts; do not invent certifications, stats, or reviews):",
    t,
    "",
    "Execute: address each gap where possible without new facts; prioritize short_description + differentiated title + high-CTR SEO; keep fields non-redundant.",
  ].join("\n");
}

function coerceProductCopy(data: unknown): ProductCopyResult | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim() : "";
  const shortDesc =
    typeof o.short_description === "string" ? o.short_description.trim() : "";
  const description =
    typeof o.description === "string" ? o.description.trim() : "";
  const bulletsRaw = Array.isArray(o.bullets) ? o.bullets : [];
  const bullets = bulletsRaw
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .map((b) => b.trim())
    .slice(0, 10);

  const seo_title = typeof o.seo_title === "string" ? o.seo_title.trim() : "";
  const seo_description =
    typeof o.seo_description === "string" ? o.seo_description.trim() : "";

  if (!title && !description) return null;

  return {
    title: title || "Product",
    short_description: shortDesc || undefined,
    description: description || "",
    bullets,
    seo_title: seo_title || title.slice(0, 60),
    seo_description:
      seo_description || description.slice(0, 160) || title.slice(0, 160),
  };
}

export async function generateProductCopy(args: {
  input: ProductGeneratorInput;
  brandProfile: UserBrandProfileRow | null;
  openaiApiKey: string;
  model?: string;
  /** Extra context (e.g. structured health analysis) appended to the user message. */
  optimizationContext?: string;
}): Promise<{ ok: true; result: ProductCopyResult } | { ok: false; error: string }> {
  const productName =
    typeof args.input.productName === "string" ? args.input.productName.trim() : "";
  if (!productName) return { ok: false, error: "Product name is required." };

  const openai = new OpenAI({ apiKey: args.openaiApiKey });

  const effectiveBrand = mergeBrandProfileForContent(undefined, args.brandProfile);
  const goal = pickGoal(args.input);
  const brandAppendix =
    args.brandProfile && effectiveBrand.name.trim()
      ? buildProductBrandIdentityAddendumEn(effectiveBrand)
      : "";
  const systemContent = buildSystemPrompt(goal, brandAppendix || undefined);

  const userPayload: Record<string, unknown> = {
    productName,
    goal,
    productDetails: args.input.productDetails?.trim() || undefined,
    targetAudience: args.input.targetAudience?.trim() || undefined,
    tone: args.input.tone?.trim() || undefined,
    keyBenefits: args.input.keyBenefits?.trim() || undefined,
    existingTitle: args.input.existingTitle?.trim() || undefined,
    existingDescription: args.input.existingDescription?.trim() || undefined,
    existingShortDescription: args.input.existingShortDescription?.trim() || undefined,
  };

  if (args.brandProfile) {
    userPayload.brandVoiceContext = {
      brandName: args.brandProfile.brand_name,
      brandDescription: args.brandProfile.brand_description,
      targetAudience: args.brandProfile.target_audience,
      toneOfVoice: args.brandProfile.tone_of_voice,
      keySellingPoints: args.brandProfile.key_selling_points,
      websiteUrl: args.brandProfile.website_url,
    };
  }

  let userMessage = JSON.stringify(userPayload);
  const optAppendix = args.optimizationContext?.trim()
    ? buildProductOptimizationAppendix(args.optimizationContext)
    : "";
  if (optAppendix) userMessage += `\n\n${optAppendix}`;

  const improveBoost = goal === "improve" && Boolean(optAppendix);
  const completion = await openai.chat.completions.create({
    model: args.model ?? process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
    temperature: goal === "improve" ? (improveBoost ? 0.4 : 0.35) : 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return { ok: false, error: "No response from the model." };

  let parsed: unknown;
  try {
    parsed = parseJsonFromAssistantContent(content);
  } catch {
    return { ok: false, error: "Could not parse model output." };
  }

  const result = coerceProductCopy(parsed);
  if (!result) return { ok: false, error: "Invalid product copy shape." };

  return { ok: true, result };
}

