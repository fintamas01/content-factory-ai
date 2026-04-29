import OpenAI from "openai";
import { OUTPUT_LANG_BY_CODE } from "@/lib/i18n/output-language";
import { parseJsonFromAssistantContent } from "@/lib/site-audit/pipeline/shared";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type CampaignAdCopy = {
  headline: string;
  caption: string;
  cta: string;
};

/**
 * Maps ISO-ish codes ("en") to labels; passes through full names like "English".
 */
export function resolveCampaignLanguageLabel(lang: unknown): string {
  const raw = typeof lang === "string" ? lang.trim() : "";
  if (!raw) return "English";
  const code = raw.toLowerCase();
  if (OUTPUT_LANG_BY_CODE[code]) return OUTPUT_LANG_BY_CODE[code];
  return raw;
}

export function resolveCampaignTone(tone: unknown): string {
  const raw = typeof tone === "string" ? tone.trim() : "";
  return raw || "premium";
}

/** When OpenAI or JSON parsing fails — matches product requirement. */
export function fallbackCampaignAdCopy(productName: string | null): CampaignAdCopy {
  const headline = typeof productName === "string" ? productName.trim() : "";
  return {
    headline,
    caption: "",
    cta: "Shop now",
  };
}

export async function generateCampaignAdCopy(params: {
  product_name: string | null;
  product_price: string | null;
  product_image: string | null;
  languageLabel: string;
  tone: string;
}): Promise<CampaignAdCopy | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;

  const productName =
    typeof params.product_name === "string" && params.product_name.trim()
      ? params.product_name.trim()
      : null;

  const nameForPrompt = productName ?? "the product";

  const priceLine = params.product_price?.trim()
    ? `Price (mention in copy only if it feels natural; otherwise omit): ${params.product_price.trim()}`
    : "No price was provided — do not invent a numeric price or currency.";

  const system = `You write high-converting social media ad copy for static image ads.

Return a single JSON object with EXACTLY these keys and string values: "headline", "caption", "cta"

Rules:
- headline: short and catchy (works as a single-line overlay on an ad creative).
- caption: exactly 1–2 persuasive sentences.
- cta: short, direct, action-oriented (e.g. Shop now, Get yours).
- Write every string in ${params.languageLabel}.
- Tone: ${params.tone}.
- You MUST mention this product name at least once across the three fields: ${nameForPrompt}.
- ${priceLine}
- Output valid JSON only, no markdown code fences.`;

  const userParts = [`Product: ${nameForPrompt}`];
  if (params.product_image?.trim()) {
    userParts.push(`Product image URL (context only): ${params.product_image.trim()}`);
  }

  const model =
    process.env.OPENAI_CAMPAIGN_JOBS_MODEL?.trim() ||
    process.env.OPENAI_AD_CREATIVE_MODEL?.trim() ||
    "gpt-4o-mini";

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
      response_format: { type: "json_object" },
      temperature: 0.72,
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    if (!raw.trim()) return null;

    let parsed: unknown;
    try {
      parsed = parseJsonFromAssistantContent(raw);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    const headline = typeof o.headline === "string" ? o.headline.trim() : "";
    const caption = typeof o.caption === "string" ? o.caption.trim() : "";
    const cta = typeof o.cta === "string" ? o.cta.trim() : "";

    const fb = fallbackCampaignAdCopy(productName);
    return {
      headline: headline || fb.headline,
      caption,
      cta: cta || fb.cta,
    };
  } catch (e) {
    console.error("generateCampaignAdCopy:", e);
    return null;
  }
}
