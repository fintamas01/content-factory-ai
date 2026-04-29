import type { SocialPostFieldDefinition, SocialPostTemplateDefinition } from "@/lib/creatomate/social-post-templates";
import { stripHtmlForAnalysis } from "@/lib/products/product-health";

export type WooCommerceProductContext = {
  source: "woocommerce";
  id: number;
  name: string;
  price: string | null;
  short_description: string;
  description: string;
  image_url: string | null;
};

export function parseWooCommerceProductContext(raw: unknown): WooCommerceProductContext | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.source !== "woocommerce") return null;
  const idRaw = o.id;
  const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? idRaw : Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return null;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const priceRaw = o.price;
  const priceStr =
    priceRaw == null || priceRaw === ""
      ? null
      : typeof priceRaw === "number" && Number.isFinite(priceRaw)
        ? String(priceRaw)
        : String(priceRaw).trim() || null;

  return {
    source: "woocommerce",
    id: Math.trunc(id),
    name,
    price: priceStr,
    short_description: typeof o.short_description === "string" ? o.short_description : "",
    description: typeof o.description === "string" ? o.description : "",
    image_url:
      typeof o.image_url === "string" && o.image_url.trim() ? o.image_url.trim() : null,
  };
}

function fieldBlock(textFields: SocialPostFieldDefinition[]): string {
  return textFields
    .map((f) => {
      const hint = f.placeholder ? ` Suggested direction: ${f.placeholder}` : "";
      const lengthHint =
        f.type === "textarea"
          ? "Use 1–3 short sentences or a tight paragraph suitable for body copy on a graphic."
          : "Keep it very short — suitable for a single line on a social image.";
      const max =
        typeof f.maxLength === "number" && f.maxLength > 0
          ? ` HARD LIMIT: at most ${f.maxLength} characters (including spaces). Truncate for the template if needed.`
          : "";
      return `- ${f.key}: (${f.type}) ${f.label}.${hint} ${lengthHint}${max}`;
    })
    .join("\n");
}

/**
 * OpenAI chat messages for /api/social-posts/generate-text.
 * `brief` is always the current topic / brief textarea (may include user edits).
 */
export function buildSocialPostGenerateTextMessages(params: {
  template: SocialPostTemplateDefinition;
  textFields: SocialPostFieldDefinition[];
  brief: string;
  tone: string | null;
  languageLabel: string;
  product: WooCommerceProductContext | null;
}): { system: string; user: string } {
  const { template, textFields, brief, tone, languageLabel, product } = params;
  const keysList = textFields.map((f) => `"${f.key}"`).join(", ");
  const fieldsSection = fieldBlock(textFields);

  const toneLine = tone
    ? `Tone (must align with this voice): ${tone}.`
    : "Infer an appropriate tone from the brief and product context.";

  if (!product) {
    const system = `You write on-image copy for social media graphics. The design is fixed; you only supply text field values.

Return a single JSON object with EXACTLY these string keys and no others: ${keysList}

Template: ${template.name}
About this layout: ${template.description}

OUTPUT LANGUAGE: ${languageLabel}. Every string value in the JSON must be written entirely in ${languageLabel}.

Fields:
${fieldsSection}

Rules:
- Each value must be a non-empty string unless the brief truly cannot apply (then use a minimal sensible fallback).
- Match the user's brief and intent.
- ${toneLine}
- Do not include hashtags unless the brief asks for them.
- Output valid JSON only, no markdown fences.`;

    const user = `Brief / topic:\n${brief}`;
    return { system, user };
  }

  const shortPlain = stripHtmlForAnalysis(product.short_description).trim();
  const longPlain = stripHtmlForAnalysis(product.description).trim();
  const longClipped = longPlain.length > 1200 ? `${longPlain.slice(0, 1200)}…` : longPlain;

  const system = `You write on-image copy for PRODUCT-BASED social media ad creatives (static graphics). The layout/template is fixed; you only supply the text field values for the JSON keys below.

Return a single JSON object with EXACTLY these string keys and no others: ${keysList}

Template: ${template.name}
About this layout: ${template.description}

OUTPUT LANGUAGE: ${languageLabel}. Every string value in the JSON must be written entirely in ${languageLabel}.

GROUND TRUTH — WooCommerce product (use for facts only; do not invent catalog data):
- Product id: ${product.id}
- Name: ${product.name}
- Store price string (if any): ${product.price ?? "(not provided)"}
- Short description (plain text): ${shortPlain || "(none)"}
- Description excerpt (plain text): ${longClipped || "(none)"}

Fields to fill:
${fieldsSection}

PRODUCT AD RULES:
- This is a product ad creative, not a generic lifestyle post. Lead with the product and value.
- Mention the product name naturally at least once across the fields where it fits (headline/title, body, etc.).
- Mention price only when it fits the field (e.g. offer line, subtitle). If price is missing, do not invent one.
- Do NOT invent discounts, sales, or percentages unless the short description or description above explicitly indicates a sale or discount (look for terms like sale, discount, % off, save, clearance, reduced). If unsure, avoid promotional discount language.
- Do NOT make unsupported claims (health guarantees, medical claims, "best in the world", etc.).
- ${toneLine}
- Respect each field's character limits strictly when stated above.
- Do not include hashtags unless the additional brief asks for them.
- Output valid JSON only, no markdown fences.`;

  const user = `Additional direction / edited brief (use together with the product facts in the system message; if something conflicts, prefer the product facts for pricing and product identity):\n\n${brief}`;

  return { system, user };
}
