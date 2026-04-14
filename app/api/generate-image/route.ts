import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { buildRealismVisualPlan } from "@/lib/ai/image-realism-pipeline";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const storageClient = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const body = await req.json().catch(() => ({}));
    const concept =
      typeof body?.concept === "string"
        ? body.concept
        : typeof body?.prompt === "string"
          ? body.prompt
          : "";
    const brandName = typeof body?.brandName === "string" ? body.brandName : "";
    const platform = typeof body?.platform === "string" ? body.platform : "";
    const referenceImageUrl =
      typeof body?.referenceImageUrl === "string" ? body.referenceImageUrl.trim() : "";

    if (!concept.trim()) {
      return NextResponse.json({ error: "Missing concept." }, { status: 400 });
    }

    const realism = await buildRealismVisualPlan({
      id: "content-image",
      brandName: brandName || "Brand",
      conceptIntent: platform ? `${concept}\nPlatform: ${platform}` : concept,
      referenceImageUrl: referenceImageUrl || undefined,
    });
    const prompt = realism.prompts[0]?.prompt || concept;
    const negative = realism.prompts[0]?.negative_prompt || "";

    // Reference-first attempt (edit/composite) when a reference image is provided.
    const imagesAny = openai.images as any;
    let openAiImageUrl: string | null = null;
    if (referenceImageUrl) {
      try {
        const r = await fetch(referenceImageUrl);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          const file = new File([buf], "reference.png", { type: "image/png" });
          const editsApi = imagesAny?.edits?.create;
          if (typeof editsApi === "function") {
            const editResp = await editsApi({
              model: process.env.OPENAI_IMAGE_EDIT_MODEL ?? "gpt-image-1",
              image: file,
              prompt: `${prompt}\n\nSTRICT PRESERVATION:\nPreserve the product identity from the reference image (shape, materials, colors).`,
              negative_prompt: negative || undefined,
              size: "1024x1024",
            });
            openAiImageUrl = editResp?.data?.[0]?.url ?? null;
          }
        }
      } catch {
        // ignore; fallback below
      }
    }

    if (!openAiImageUrl) {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural",
      });
      openAiImageUrl = response.data?.[0]?.url ?? null;
    }

    if (!openAiImageUrl) {
      throw new Error("Nem érkezett képadat az OpenAI-tól.");
    }

    const imageResponse = await fetch(openAiImageUrl);
    const imageBlob = await imageResponse.blob();

    const safeBrandName = brandName
      ? brandName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
      : "brand";
    const fileName = `${Date.now()}-${safeBrandName}.png`;

    const { error: uploadError } = await storageClient.storage
      .from("generated-images")
      .upload(fileName, imageBlob, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase feltöltési hiba:", uploadError);
      throw new Error("Nem sikerült elmenteni a képet a felhőbe.");
    }

    const { data: publicUrlData } = storageClient.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    const finalImageUrl = publicUrlData.publicUrl;

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({ imageUrl: finalImageUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Képgenerálási hiba történt.";
    console.error("generate-image:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
