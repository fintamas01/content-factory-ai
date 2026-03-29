import type { UserBrandProfileRow } from "./types";

/** Payload from Content module (legacy multi-brand picker). */
export type RequestBrandProfile = {
  name?: string;
  desc?: string;
  audience?: string;
};

/** Normalized profile used in OpenAI system prompts. */
export type EffectiveBrandProfile = {
  name: string;
  desc: string;
  audience: string;
  toneOfVoice?: string;
  keySellingPoints?: string;
  websiteUrl?: string;
};

/**
 * When a unified row exists, it drives name/description/audience and optional
 * voice fields. Otherwise we use the request payload from the legacy picker.
 */
export function mergeBrandProfileForContent(
  requestBrand: RequestBrandProfile | null | undefined,
  unified: UserBrandProfileRow | null | undefined
): EffectiveBrandProfile {
  if (unified) {
    const name =
      (unified.brand_name && unified.brand_name.trim()) ||
      (requestBrand?.name && requestBrand.name.trim()) ||
      "";
    const desc =
      (unified.brand_description && unified.brand_description.trim()) ||
      (requestBrand?.desc && requestBrand.desc.trim()) ||
      "";
    const audience =
      (unified.target_audience && unified.target_audience.trim()) ||
      (requestBrand?.audience && requestBrand.audience.trim()) ||
      "";
    const toneOfVoice = unified.tone_of_voice?.trim() || undefined;
    const keySellingPoints = unified.key_selling_points?.trim() || undefined;
    const websiteUrl = unified.website_url?.trim() || undefined;
    return {
      name,
      desc,
      audience,
      toneOfVoice,
      keySellingPoints,
      websiteUrl,
    };
  }
  return {
    name: requestBrand?.name?.trim() ?? "",
    desc: requestBrand?.desc?.trim() ?? "",
    audience: requestBrand?.audience?.trim() ?? "",
  };
}
