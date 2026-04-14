/**
 * Shared types for AI Ad Creative Studio outputs.
 *
 * These boundaries are intentional:
 * - copy: text variants meant for posts/ads
 * - concepts: textual visual direction (no render guarantee)
 * - assets: generated media drafts (static now; video later)
 *
 * When video is introduced, add new `AdCreativeAssetVideoDraft` entries to `assets.items`
 * without changing the rest of the page architecture.
 */

export type AdCreativeAspectRatio = "1:1" | "4:5" | "9:16";

export type AdCreativeAngleId = string;

export type AdCreativeCopyAngle = {
  id: AdCreativeAngleId;
  hook: string;
  headlines: string[];
  primaryTexts: string[];
  ctas: string[];
};

export type AdCreativeConceptAngle = {
  id: AdCreativeAngleId;
  hook: string;
  visualConcept: {
    subject: string;
    scene: string;
    composition: string;
    lighting: string;
    palette: string;
    typography: string;
    overlays: string[];
    doNotDo: string[];
  };
  adaptations: Record<AdCreativeAspectRatio, string[]>;
};

export type AdCreativeLanguage = { code: string; label: string };

export type AdCreativeOutputV1 = {
  language: AdCreativeLanguage;
  aspectRatios: AdCreativeAspectRatio[];
  angles: Array<
    AdCreativeCopyAngle & {
      visualConcept: AdCreativeConceptAngle["visualConcept"];
      adaptations: AdCreativeConceptAngle["adaptations"];
    }
  >;
  assets?: AdCreativeAssets;
};

export type AdCreativeAssetBase = {
  id: string;
  angleId: AdCreativeAngleId;
  createdAt: string;
  provider: string;
  status: "succeeded" | "failed";
  error?: string;
  draft: true;
};

export type AdCreativeAssetImageDraft = AdCreativeAssetBase & {
  kind: "image";
  aspectRatio: AdCreativeAspectRatio;
  /** True when generated using a reference/base image (edit/composite mode). */
  base_image_used?: boolean;
  /** Human-readable composition summary (from the realism plan). */
  composition_description?: string;
  /** Studio vs lifestyle mode used for this draft. */
  mode?: "studio_product_shot" | "lifestyle_scene";
  /**
   * Quality control scores for the best selected candidate.
   * - realism_score: higher is better
   * - artifact_score: higher is worse
   * - brand_consistency_score: higher is better
   */
  qc?: {
    realism_score: number;
    artifact_score: number;
    brand_consistency_score: number;
    retry_count: number;
  };
  width?: number;
  height?: number;
  url?: string;
  storage?: { bucket: string; path: string };
};

/**
 * Placeholder type for future short-form ad video generation.
 * Do NOT rely on this yet in UI beyond safe existence checks.
 */
export type AdCreativeAssetVideoDraft = AdCreativeAssetBase & {
  kind: "video";
  aspectRatio: AdCreativeAspectRatio;
  durationSeconds?: number;
  posterImageUrl?: string;
  url?: string;
  storage?: { bucket: string; path: string };
};

export type AdCreativeAsset = AdCreativeAssetImageDraft | AdCreativeAssetVideoDraft;

export type AdCreativeAssets = {
  /** Optional default provider hint for drafts. */
  provider?: string | null;
  /**
   * Unified list of generated assets.
   * - V1: image drafts only
   * - Future: add video drafts here
   */
  items: AdCreativeAsset[];
};

