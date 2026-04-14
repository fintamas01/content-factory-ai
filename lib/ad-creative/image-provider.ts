import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdCreativeAssetImageDraft, AdCreativeAspectRatio } from "@/lib/ad-creative/types";

export type ImageProviderId = "openai-dalle3";

export type DraftImageResult =
  | { ok: true; asset: AdCreativeAssetImageDraft }
  | { ok: false; provider: ImageProviderId; error: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function arToSize(ar: AdCreativeAspectRatio): {
  size: "1024x1024";
  w: number;
  h: number;
} {
  // DALL·E 3 supports 1024x1024, 1024x1792, 1792x1024.
  // We keep V1 simple and map ratios to the closest supported size.
  if (ar === "9:16") return { size: "1024x1024", w: 1024, h: 1024 };
  if (ar === "4:5") return { size: "1024x1024", w: 1024, h: 1024 };
  return { size: "1024x1024", w: 1024, h: 1024 };
}

function safeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function generateDraftImage(params: {
  prompt: string;
  brandName: string;
  aspectRatio: AdCreativeAspectRatio;
  generationId: string;
  angleId: string;
}): Promise<DraftImageResult> {
  const provider: ImageProviderId = "openai-dalle3";
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { ok: false, provider, error: "OpenAI is not configured." };
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { ok: false, provider, error: "Storage is not configured." };
    }

    const { size, w, h } = arToSize(params.aspectRatio);

    const enhancedPrompt = `Create a premium static ad creative draft image.
Brand: ${params.brandName}
Concept: ${params.prompt}

Style rules:
- Photoreal or premium product photography feel (not illustration).
- Clean layout with negative space (leave room for potential overlay text later).
- ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO WATERMARKS in the image.
- Avoid unsafe/medical/financial claim visuals.

Output: one single image.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size,
      quality: "standard",
      style: "natural",
    });

    const openAiImageUrl = response.data?.[0]?.url;
    if (!openAiImageUrl) {
      return { ok: false, provider, error: "No image URL returned by provider." };
    }

    const imageResponse = await fetch(openAiImageUrl);
    if (!imageResponse.ok) {
      return { ok: false, provider, error: "Failed to download provider image." };
    }
    const imageBytes = await imageResponse.arrayBuffer();

    const brandSlug = safeSlug(params.brandName || "brand");
    const path = `ad-creative/${params.generationId}/${params.angleId}-${Date.now()}-${brandSlug}.png`;
    const bucket = "brand-assets";

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      return { ok: false, provider, error: "Could not upload image to storage." };
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      return { ok: false, provider, error: "Could not create signed URL." };
    }

    return {
      ok: true,
      asset: {
        id: `${params.generationId}:${params.angleId}:${Date.now()}`,
        kind: "image",
        angleId: params.angleId,
        aspectRatio: params.aspectRatio,
        createdAt: new Date().toISOString(),
        provider,
        status: "succeeded",
        draft: true,
        width: w,
        height: h,
        url: signed.signedUrl,
        storage: { bucket, path },
      },
    };
  } catch (e: any) {
    return { ok: false, provider, error: String(e?.message ?? e ?? "Image generation failed.") };
  }
}

