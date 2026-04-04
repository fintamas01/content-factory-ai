import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

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

    const { prompt, platform, brandName } = await req.json();

    const enhancedPrompt = `An authentic, highly realistic photograph capturing the following concept: "${prompt}". 
    Context: A premium lifestyle or corporate scene for the brand '${brandName}' on ${platform}.
    Execution details: 
    - Camera settings: Shot on a DSLR with a 35mm lens, shallow depth of field (f/1.8), soft blurred background (bokeh effect).
    - Lighting & Tone: Natural window daylight, candid, documentary style, authentic, unposed, true-to-life textures, subtle film grain.
    - Constraints: MUST look like a real, raw photograph. NOT a 3D render, NOT an illustration. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO WATERMARKS anywhere in the image.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    const openAiImageUrl = response.data?.[0]?.url;

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
