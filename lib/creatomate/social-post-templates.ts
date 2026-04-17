/**
 * Registry of Creatomate-backed social post image templates.
 * - `id` is the app-level template key (URL segment + API `templateId`).
 * - `creatomateTemplateId` is the Creatomate template id sent to the API.
 *   Use `__ENV_PRIMARY__` for the template id from `process.env.CREATOMATE_TEMPLATE_ID` (server).
 */

export type SocialPostFieldType = "text" | "textarea" | "url";

export type SocialPostFieldDefinition = {
  key: string;
  label: string;
  type: SocialPostFieldType;
  placeholder?: string;
  required?: boolean;
};

export type SocialPostTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  /** Public URL or path to a preview asset */
  previewImage: string;
  /**
   * Creatomate template id, or `__ENV_PRIMARY__` to use `CREATOMATE_TEMPLATE_ID` on the server.
   */
  creatomateTemplateId: string;
  fields: SocialPostFieldDefinition[];
  /** Maps form field `key` -> Creatomate modification key (e.g. "headline.text") */
  modificationsMap: Record<string, string>;
};

export const SOCIAL_POST_TEMPLATES: readonly SocialPostTemplateDefinition[] = [
  {
    id: "triple-image-story",
    name: "Triple image story",
    description: "Headline, subheadline, body, and three stacked product images.",
    previewImage:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80&auto=format&fit=crop",
    creatomateTemplateId: "__ENV_PRIMARY__",
    fields: [
      { key: "headline", label: "Headline", type: "text", placeholder: "Main headline…", required: true },
      { key: "subheadline", label: "Subheadline", type: "text", placeholder: "Supporting line…", required: true },
      { key: "body", label: "Body", type: "textarea", placeholder: "Body copy…", required: true },
      { key: "image_top", label: "Image (top)", type: "url", placeholder: "https://…", required: true },
      { key: "image_middle", label: "Image (middle)", type: "url", placeholder: "https://…", required: true },
      { key: "image_bottom", label: "Image (bottom)", type: "url", placeholder: "https://…", required: true },
    ],
    modificationsMap: {
      headline: "headline.text",
      subheadline: "subheadline.text",
      body: "body.text",
      image_top: "image_top.source",
      image_middle: "image_middle.source",
      image_bottom: "image_bottom.source",
    },
  },
  {
    id: "promo-hero-strip",
    name: "Promo hero strip",
    description: "Placeholder template — swap Creatomate id and fields when your second design is ready.",
    previewImage:
      "/templates/v1.png",
    creatomateTemplateId: "f00877d6-c7d3-4a04-9745-b9e155a878b6",
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "Offer headline…", required: true },
      { key: "subtitle", label: "Subtitle", type: "text", placeholder: "Short supporting line…", required: true },
      { key: "cta", label: "CTA label", type: "text", placeholder: "Shop now", required: true },
      { key: "hero_image", label: "Hero image URL", type: "url", placeholder: "https://…", required: true },
    ],
    modificationsMap: {
      title: "Title.text",
      subtitle: "Subtitle.text",
      cta: "Cta.text",
      hero_image: "Hero.source",
    },
  },
] as const;

export function getSocialPostTemplateById(id: string): SocialPostTemplateDefinition | undefined {
  return SOCIAL_POST_TEMPLATES.find((t) => t.id === id);
}

/** Resolve Creatomate template id for API calls (server-only env injection). */
export function resolveCreatomateTemplateId(template: SocialPostTemplateDefinition): string {
  if (template.creatomateTemplateId === "__ENV_PRIMARY__") {
    return process.env.CREATOMATE_TEMPLATE_ID?.trim() ?? "";
  }
  return template.creatomateTemplateId.trim();
}

/** Build Creatomate `modifications` object from form values + template map. */
export function buildCreatomateModifications(
  template: SocialPostTemplateDefinition,
  values: Record<string, string>
): Record<string, string> {
  const modifications: Record<string, string> = {};
  for (const [fieldKey, creatomateKey] of Object.entries(template.modificationsMap)) {
    const v = typeof values[fieldKey] === "string" ? values[fieldKey].trim() : "";
    modifications[creatomateKey] = v;
  }
  return modifications;
}

/** Validate that all required fields are non-empty strings. */
export function validateTemplateValues(
  template: SocialPostTemplateDefinition,
  values: Record<string, unknown>
): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  const out: Record<string, string> = {};
  for (const field of template.fields) {
    const raw = values[field.key];
    const s = typeof raw === "string" ? raw.trim() : "";
    if (field.required !== false && !s) {
      return { ok: false, error: `Missing or empty field: ${field.label} (${field.key})` };
    }
    out[field.key] = s;
  }
  return { ok: true, values: out };
}

/** Flatten values into legacy DB columns when keys exist (for `triple-image-story`). */
export function valuesToLegacyRow(values: Record<string, string>): {
  headline: string;
  subheadline: string;
  body: string;
  image_top: string;
  image_middle: string;
  image_bottom: string;
} {
  return {
    headline: values.headline ?? "",
    subheadline: values.subheadline ?? "",
    body: values.body ?? "",
    image_top: values.image_top ?? "",
    image_middle: values.image_middle ?? "",
    image_bottom: values.image_bottom ?? "",
  };
}
