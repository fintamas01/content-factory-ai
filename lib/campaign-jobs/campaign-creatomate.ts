import {
  getSocialPostTemplateById,
  SOCIAL_POST_TEMPLATES,
  type SocialPostTemplateDefinition,
} from "@/lib/creatomate/social-post-templates";

const DEFAULT_REGISTRY_TEMPLATE_ID = "promo-hero-strip";

/** Placeholder so image-required templates validate when URL is missing. */
export const CAMPAIGN_PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x600";

/**
 * Registry template id for Creatomate (e.g. `promo-hero-strip`).
 * Uses request body value when valid; else `promo-hero-strip` if present; else first registry entry.
 */
export function resolveCampaignRegistryTemplateId(requested: string | null | undefined): {
  template: SocialPostTemplateDefinition;
  registryId: string;
} {
  const trimmed = typeof requested === "string" ? requested.trim() : "";
  if (trimmed) {
    const t = getSocialPostTemplateById(trimmed);
    if (t) return { template: t, registryId: t.id };
  }
  const promo = getSocialPostTemplateById(DEFAULT_REGISTRY_TEMPLATE_ID);
  if (promo) return { template: promo, registryId: promo.id };
  const first = SOCIAL_POST_TEMPLATES[0];
  return { template: first, registryId: first.id };
}

export type CampaignJobCopyFields = {
  headline: string;
  caption: string;
  cta: string;
  product_name: string | null;
  product_image: string | null;
  product_price: string | null;
};

/**
 * Maps campaign job fields onto registry template keys. Only keys that exist on the template
 * are included so `validateTemplateValues` receives a compatible shape.
 */
export function mapCampaignJobToRegistryValues(
  template: SocialPostTemplateDefinition,
  fields: CampaignJobCopyFields
): Record<string, unknown> {
  const img = fields.product_image?.trim() || CAMPAIGN_PLACEHOLDER_IMAGE_URL;
  const price = fields.product_price?.trim() || "";
  const caption = fields.caption.trim();
  const headline =
    fields.headline.trim() || (typeof fields.product_name === "string" ? fields.product_name.trim() : "");
  const cta = fields.cta.trim() || "Shop now";

  const subtitleFallback =
    price ||
    (caption ? caption.slice(0, 100) : "") ||
    (typeof fields.product_name === "string" ? fields.product_name.trim() : "") ||
    "—";

  const bucket: Record<string, string> = {
    headline,
    subheadline: price,
    body: caption,
    cta,
    image: img,
    image_top: img,
    image_middle: img,
    image_bottom: img,
    product_image: img,
    price,
    title: headline,
    subtitle: subtitleFallback,
    hero_image: img,
  };

  const out: Record<string, unknown> = {};
  for (const f of template.fields) {
    if (Object.prototype.hasOwnProperty.call(bucket, f.key)) {
      out[f.key] = bucket[f.key];
    }
  }
  return out;
}
