import OpenAI from "openai";
import { parseJsonFromAssistantContent } from "@/lib/openai/parse-json-content";
import type { ProductCopyResult, ProductGeneratorInput } from "@/lib/products/types";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";

const SYSTEM_BASE = `You are a senior e-commerce conversion copywriter and product marketer. You write copy that can ship on a real PDP: specific, benefit-led, and commercially credible—not template filler.

NON-NEGOTIABLES
- Ground every claim in the provided input only. Do NOT invent certifications, awards, numbers, materials, warranties, compatibility, or guarantees unless provided.
- Be concrete: prefer “what it is + who it’s for + what outcome it delivers” over adjectives.
- Avoid generic AI language and empty hype.

STYLE
- Premium, confident, human. Minimal fluff.
- Use brand voice naturally if provided, without repeating slogans or forcing keywords.

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

FIELD RULES
- title: 6–12 words, specific, no “Ultimate/Best/Revolutionary” unless supported by input.
- short_description: 1–2 punchy sentences, \u2264 220 characters total. This must feel conversion-focused (clarity + outcome + differentiator).
- description: 2–4 short paragraphs OR 4–7 sentences. No list formatting. Make it scannable with short lines.
- bullets: exactly 5 bullets. Each bullet \u2264 120 characters. Each bullet must add a new angle (feature\u2192benefit, use case, objection handler, differentiator, proof-needed).
- seo_title: 50–60 chars when possible. Reads like a real listing, not keyword stuffing.
- seo_description: 150–160 chars when possible. Natural, commercially useful, includes a soft CTA.

BANNED (unless explicitly supported)
- “high quality”, “great value”, “best-in-class”, “game-changer”, “premium quality” (without specifics)
- fabricated proof (“trusted by 10,000+”, “award-winning”, “#1”)
- repeating the same idea across title/description/bullets with synonyms`;

const SYSTEM_MODE_GENERATE = `MODE: GENERATE
- Create fresh copy from the provided inputs.
- If details are thin, write tightly and transparently. Prefer safe, universal benefits that follow from the input.
- Do not add “features” that are not provided. If you need missing info, choose conservative wording.`;

const SYSTEM_MODE_IMPROVE = `MODE: IMPROVE
You will receive existingTitle/existingDescription/existingShortDescription. Optimize them for conversion and clarity:
- Preserve true product facts and meaning. Do NOT change specs.
- Keep any genuinely strong phrases, but remove fluff, redundancy, and vague claims.
- Improve scannability, specificity, and commercial clarity.
- If the existing copy contains HTML, treat it as noisy input; output must be clean plain text.`;

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

  const completion = await openai.chat.completions.create({
    model: args.model ?? process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
    temperature: goal === "improve" ? 0.35 : 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: JSON.stringify(userPayload) },
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

