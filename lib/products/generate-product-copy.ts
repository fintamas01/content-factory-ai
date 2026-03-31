import OpenAI from "openai";
import { parseJsonFromAssistantContent } from "@/lib/openai/parse-json-content";
import type { ProductCopyResult, ProductGeneratorInput } from "@/lib/products/types";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";

const SYSTEM = `You are a senior ecommerce and B2B SaaS copy chief. Your job is copy that could ship on a real storefront or PDP: specific, benefit-led, and commercially credible—not template filler.

INPUT: You receive JSON with productName plus optional productDetails, targetAudience, tone, keyBenefits. When brandVoiceContext is present, it is the saved brand profile (facts). If a BRAND IDENTITY section appears below in the system message, follow it for how to apply that context—natural voice, no robotic repetition across fields. Product-level JSON fields override for factual product details when they conflict.

Ground every claim in that input. If details are thin, write tightly from what is given; do not invent certifications, awards, numbers, materials, or guarantees unless the user supplied them.

OUTPUT: Strictly valid JSON only. No markdown, no code fences, no keys beyond this schema (no extra keys):
{
  "title": "string",
  "description": "string",
  "bullets": ["string", ...],
  "seo_title": "string",
  "seo_description": "string"
}

TITLE: Short, specific headline (listing or hero). Prefer concrete nouns and outcome over vague adjectives. Avoid “The ultimate…”, “Revolutionary…”, “Best-in-class…” unless the input supports it.

DESCRIPTION: 2–4 sentences. Lead with the clearest outcome for the buyer (who it’s for + what problem it removes or result it enables). Tie features to benefits using details from the input. No bullet list here. No empty hype.

BULLETS: Exactly 4–6 items. Each line: one tight idea—prefer “[Concrete feature or fact] → [buyer payoff]” or a sharp standalone benefit. Under ~120 characters per bullet where possible. No “Lorem” style repeats; each line must add a new angle (use case, proof point from input, objection handled, differentiator).

TONE: Honor the requested tone (professional, modern, persuasive, luxury, friendly) or default to confident and clear. Luxury = refined, not flowery. Persuasive = proof and specificity, not exclamation spam.

SEO_TITLE: ~50–60 characters when possible. Read like a real search result: primary intent + product type + differentiator if space. Clickable and human—no ALL CAPS, no pipe-stuffed keyword stuffing.

SEO_DESCRIPTION: ~150–160 characters. One natural sentence (or two very short ones) with benefit + light CTA or qualifier (“for …”, “with …”). Should read like a trustworthy snippet, not a keyword dump.

BANNED: Generic phrases alone (“high quality”, “great value”, “perfect for everyone”) without tying to input. Repeated synonyms across fields. Fabricated stats.

Plain text inside JSON strings only (no ** or HTML).`;

function coerceProductCopy(data: unknown): ProductCopyResult | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim() : "";
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
  const systemContent =
    args.brandProfile && effectiveBrand.name.trim()
      ? `${SYSTEM}\n\n${buildProductBrandIdentityAddendumEn(effectiveBrand)}`
      : SYSTEM;

  const userPayload: Record<string, unknown> = {
    productName,
    productDetails: args.input.productDetails?.trim() || undefined,
    targetAudience: args.input.targetAudience?.trim() || undefined,
    tone: args.input.tone?.trim() || undefined,
    keyBenefits: args.input.keyBenefits?.trim() || undefined,
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
    temperature: 0.45,
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

