import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdCreativeAssetImageDraft, AdCreativeAspectRatio } from "@/lib/ad-creative/types";
import { buildRealismVisualPlan } from "@/lib/ai/image-realism-pipeline";
import { evaluateImageQuality } from "@/lib/ai/image-quality";

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
  brandName: string;
  conceptIntent: string;
  styleDirection?: string;
  referenceImageUrl?: string;
  mode?: "studio_product_shot" | "lifestyle_scene";
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

    const realism = await buildRealismVisualPlan({
      id: params.angleId,
      brandName: params.brandName,
      conceptIntent: params.conceptIntent,
      styleDirection: params.styleDirection,
      referenceImageUrl: params.referenceImageUrl,
      mode: params.mode,
    });
    const prompt = realism.prompts[0]?.prompt || params.conceptIntent;
    const negative = realism.prompts[0]?.negative_prompt || "";
    const composition_description =
      realism.concepts[0]?.plan?.composition || realism.concepts[0]?.plan?.environment || "";
    const mode =
      realism.concepts[0]?.plan?.mode === "studio_product_shot"
        ? "studio_product_shot"
        : "lifestyle_scene";

    // Reference-first workflow + QC retries:
    // - Prefer edit/composite when a reference image exists
    // - Validate realism/artifacts and retry (max 2) with tightened constraints
    const imagesAny = openai.images as any;

    const tryEditOrGenerate = async (promptOverride?: string): Promise<{ url: string | null; usedBase: boolean }> => {
      const p = promptOverride ?? prompt;
      let url: string | null = null;
      let usedBase = false;

      if (params.referenceImageUrl) {
        try {
          const r = await fetch(params.referenceImageUrl);
          if (r.ok) {
            const buf = await r.arrayBuffer();
            const file = new File([buf], "reference.png", { type: "image/png" });
            const editsApi = imagesAny?.edits?.create;
            if (typeof editsApi === "function") {
              const editResp = await editsApi({
                model: process.env.OPENAI_IMAGE_EDIT_MODEL ?? "gpt-image-1",
                image: file,
                prompt: `${p}

STRICT PRESERVATION (HIGHEST PRIORITY):
- Preserve the product exactly from the reference image (shape, proportions, materials, colors).
- Do NOT alter or invent logos/marks; do NOT change logo placement.
- Keep the product edges, silhouette, and proportions realistic.
- Place the product naturally in the scene; do not warp, melt, or deform it.`,
                negative_prompt: negative || undefined,
                size,
              });
              url = editResp?.data?.[0]?.url ?? null;
              usedBase = Boolean(url);
            }
          }
        } catch {
          // ignore; fallback
        }
      }

      if (!url) {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: p,
          n: 1,
          size,
          quality: "standard",
          style: "natural",
        });
        url = response.data?.[0]?.url ?? null;
        usedBase = false;
      }

      return { url, usedBase };
    };

    const modeForQc =
      params.mode === "studio_product_shot" ? "studio_product_shot" : "lifestyle_scene";

    const pass = (s: { realism_score: number; artifact_score: number; brand_consistency_score: number }) => {
      // Conservative defaults; tune later per brand.
      return s.realism_score >= 7 && s.artifact_score <= 3 && s.brand_consistency_score >= 6;
    };

    let best: {
      url: string;
      usedBase: boolean;
      qc: Awaited<ReturnType<typeof evaluateImageQuality>>;
      retryCount: number;
    } | null = null;

    let promptAttempt = prompt;
    for (let attempt = 0; attempt < 3; attempt++) {
      const gen = await tryEditOrGenerate(promptAttempt);
      if (!gen.url) {
        if (!best) {
          return { ok: false, provider, error: "No image URL returned by provider." };
        }
        break;
      }

      const qc = await evaluateImageQuality({
        generatedImageUrl: gen.url,
        referenceImageUrl: params.referenceImageUrl,
        brandName: params.brandName,
        conceptIntent: params.conceptIntent,
        mode: modeForQc,
      });

      const score = qc.realism_score - qc.artifact_score * 0.9 + qc.brand_consistency_score * 0.3;
      const bestScore =
        best ? best.qc.realism_score - best.qc.artifact_score * 0.9 + best.qc.brand_consistency_score * 0.3 : -Infinity;
      if (!best || score > bestScore) {
        best = { url: gen.url, usedBase: gen.usedBase, qc, retryCount: attempt };
      }

      if (pass(qc)) break;

      // Tighten prompt to address observed issues (no new UI; purely internal).
      const fixes = qc.issues.slice(0, 6).join("; ");
      promptAttempt = `${prompt}

RETRY FIXES:
- Fix these visible issues: ${fixes || "remove AI artifacts and improve realism"}.
- Increase realism: natural shadows, believable depth, micro-texture, slight asymmetry.
- Remove any uncanny/warped geometry; ensure product edges are crisp and undistorted.
- Keep materials and colors true-to-life.`;
    }

    if (!best) {
      return { ok: false, provider, error: "Image generation failed." };
    }

    const imageResponse = await fetch(best.url);
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
        base_image_used: Boolean(params.referenceImageUrl && best.usedBase),
        composition_description,
        mode,
        qc: {
          realism_score: best.qc.realism_score,
          artifact_score: best.qc.artifact_score,
          brand_consistency_score: best.qc.brand_consistency_score,
          retry_count: best.retryCount,
        },
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

