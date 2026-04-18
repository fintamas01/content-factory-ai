/**
 * Registry of Creatomate-backed social post image templates.
 * - `id` is the app-level template key (URL segment + API `templateId`).
 * - `creatomateTemplateId` is the Creatomate template id sent to the API.
 *   Use `__ENV_PRIMARY__` for the template id from `process.env.CREATOMATE_TEMPLATE_ID` (server).
 */

export type SocialPostFieldType = "text" | "textarea" | "url" | "image";

export type SocialPostFieldDefinition = {
  key: string;
  label: string;
  type: SocialPostFieldType;
  placeholder?: string;
  /** Default: required unless set to `false`. */
  required?: boolean;
  /** Shown next to the label when the field is optional but encouraged. */
  recommended?: boolean;
  /** Hard cap on character count (matches `maxLength` on inputs). */
  maxLength?: number;
  /** Short guidance under the field. */
  helperText?: string;
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
  /** Grouping label in the picker (optional). */
  category?: string;
  /** When to choose this layout (optional). */
  recommendedUseCase?: string;
  /** Placeholder hint for the AI brief box on the generator page. */
  aiBriefHint?: string;
  /** Tone select default: matches `TONE_OPTIONS` values, e.g. `professional`. */
  defaultTone?: string;
};

export const SOCIAL_POST_TEMPLATES: readonly SocialPostTemplateDefinition[] = [
  {
    id: "triple-image-story",
    name: "Triple image story",
    description: "Headline, subheadline, body, and three stacked product images.",
    category: "Story",
    recommendedUseCase:
      "Best for product storytelling, launches, or features with three distinct visuals (e.g. angles, steps, or benefits).",
    aiBriefHint:
      "Who is this for, what's the hook, and what should each image emphasize (e.g. hero product, detail, lifestyle)?",
    defaultTone: "professional",
    previewImage:
      "/templates/v2.png",
    creatomateTemplateId: "__ENV_PRIMARY__",
    fields: [
      {
        key: "headline",
        label: "Headline",
        type: "text",
        placeholder: "Main headline…",
        required: true,
        maxLength: 72,
        helperText: "One short line — largest text on the graphic.",
      },
      {
        key: "subheadline",
        label: "Subheadline",
        type: "text",
        placeholder: "Supporting line…",
        required: true,
        maxLength: 96,
        helperText: "Supports the headline; keep it tighter than the body.",
      },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        placeholder: "Body copy…",
        required: true,
        maxLength: 420,
        helperText: "Supporting copy; avoid long paragraphs so type stays legible.",
      },
      {
        key: "image_top",
        label: "Image (top)",
        type: "image",
        placeholder: "https://…",
        required: true,
        helperText: "First read in the stack — strong hero or primary product shot works well.",
      },
      {
        key: "image_middle",
        label: "Image (middle)",
        type: "image",
        placeholder: "https://…",
        required: true,
        helperText: "Detail, alternate angle, or proof (texture, ingredient, rating).",
      },
      {
        key: "image_bottom",
        label: "Image (bottom)",
        type: "image",
        placeholder: "https://…",
        required: true,
        helperText: "Closer or lifestyle shot to round out the story.",
      },
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
    category: "Promo",
    recommendedUseCase: "Bold offers, limited-time deals, or single-product hero creatives with one strong visual.",
    aiBriefHint: "Offer details, urgency, audience, and the main outcome (save %, free shipping, new drop, etc.).",
    defaultTone: "bold",
    previewImage:
      "/templates/v1.png",
    creatomateTemplateId: "f00877d6-c7d3-4a04-9745-b9e155a878b6",
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        placeholder: "Offer headline…",
        required: true,
        maxLength: 56,
        helperText: "Lead with the benefit or offer; this is the primary read.",
      },
      {
        key: "subtitle",
        label: "Subtitle",
        type: "text",
        placeholder: "Short supporting line…",
        required: true,
        maxLength: 100,
        helperText: "Clarify scope, dates, or eligibility in one line if needed.",
      },
      {
        key: "cta",
        label: "CTA label",
        type: "text",
        placeholder: "Shop now",
        required: true,
        maxLength: 28,
        helperText: "Short button-style label (verb + object).",
      },
      {
        key: "hero_image",
        label: "Hero image",
        type: "image",
        placeholder: "https://…",
        required: true,
        helperText: "Wide or square product/brand shot; avoid tiny text baked into the image.",
      },
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

/** Fields the AI text assist may fill (excludes image, url, etc.). */
export function getTemplateTextFieldDefinitions(
  template: SocialPostTemplateDefinition
): SocialPostFieldDefinition[] {
  return template.fields.filter((f) => f.type === "text" || f.type === "textarea");
}

function clampSocialPostFieldToMax(field: SocialPostFieldDefinition, value: string): string {
  const max = field.maxLength;
  if (typeof max !== "number" || max <= 0) return value;
  const textLike =
    field.type === "text" || field.type === "textarea" || field.type === "url";
  if (!textLike) return value;
  return value.length > max ? value.slice(0, max) : value;
}

/** Merge AI-generated strings into the form; only updates text/textarea keys; image/url unchanged. */
export function mergeAiTextValuesIntoForm(
  template: SocialPostTemplateDefinition,
  current: Record<string, string>,
  generated: Record<string, unknown>
): Record<string, string> {
  const textFields = getTemplateTextFieldDefinitions(template);
  const next = { ...current };
  if (!generated || typeof generated !== "object") return next;
  for (const f of textFields) {
    const raw = (generated as Record<string, unknown>)[f.key];
    if (typeof raw !== "string") continue;
    next[f.key] = clampSocialPostFieldToMax(f, raw);
  }
  return next;
}

/** sessionStorage key for "Reuse" from history (used with `?reuse=1` on the generator URL). */
export const SOCIAL_POST_REUSE_SESSION_KEY = "cf-social-post-reuse-v1";

export type SocialPostReusePayload = {
  templateId: string;
  values: Record<string, unknown>;
};

/** Empty strings for every field in the template (form default state). */
export function emptyTemplateValues(template: SocialPostTemplateDefinition): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of template.fields) v[f.key] = "";
  return v;
}

/** Apply saved JSON (e.g. from DB) onto the current template shape; unknown keys are ignored. */
export function mergeSavedValuesIntoTemplate(
  template: SocialPostTemplateDefinition,
  saved: Record<string, unknown> | null | undefined
): Record<string, string> {
  const out = emptyTemplateValues(template);
  if (!saved || typeof saved !== "object") return out;
  for (const field of template.fields) {
    const raw = saved[field.key];
    if (typeof raw === "string") out[field.key] = raw;
  }
  return out;
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

/** Validate required fields, optional max lengths, and return trimmed values for submit. */
export function validateTemplateValues(
  template: SocialPostTemplateDefinition,
  values: Record<string, unknown>
):
  | { ok: true; values: Record<string, string> }
  | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const out: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};

  for (const field of template.fields) {
    const raw = values[field.key];
    const rawStr = typeof raw === "string" ? raw : "";
    const trimmed = rawStr.trim();

    const max = field.maxLength;
    if (typeof max === "number" && max > 0 && rawStr.length > max) {
      fieldErrors[field.key] = `Must be at most ${max} characters.`;
      continue;
    }

    if (field.required !== false && !trimmed) {
      fieldErrors[field.key] = "This field is required.";
      continue;
    }

    out[field.key] = trimmed;
  }

  if (Object.keys(fieldErrors).length > 0) {
    const first = template.fields.find((f) => fieldErrors[f.key]);
    const error = first
      ? `${first.label}: ${fieldErrors[first.key]}`
      : "Please fix the highlighted fields.";
    return { ok: false, error, fieldErrors };
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
