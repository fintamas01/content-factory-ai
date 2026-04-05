export interface ProductCopyResult {
  title: string;
  description: string;
  bullets: string[];
  seo_title: string;
  seo_description: string;
  short_description?: string;
}

/** Form payload sent to /api/generate-product */
export interface ProductGeneratorInput {
  productName: string;
  productDetails?: string;
  targetAudience?: string;
  tone?: string;
  keyBenefits?: string;
  existingTitle?: string;
  existingDescription?: string;
  existingShortDescription?: string;
  goal?: "generate" | "improve";
  /** ISO-ish code (en, hu, …). Defaults to English server-side if missing/invalid. */
  lang?: string;
}
