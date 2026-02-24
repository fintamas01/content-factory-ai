import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supabase kliens inicializálása a szerveren
// Biztonsági okokból a SERVICE_ROLE kulcsot használjuk, hogy a szervernek legyen joga feltölteni
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { prompt, platform, brandName } = await req.json();

    const enhancedPrompt = `An authentic, highly realistic photograph capturing the following concept: "${prompt}". 
    Context: A premium lifestyle or corporate scene for the brand '${brandName}' on ${platform}.
    Execution details: 
    - Camera settings: Shot on a DSLR with a 35mm lens, shallow depth of field (f/1.8), soft blurred background (bokeh effect).
    - Lighting & Tone: Natural window daylight, candid, documentary style, authentic, unposed, true-to-life textures, subtle film grain.
    - Constraints: MUST look like a real, raw photograph. NOT a 3D render, NOT an illustration. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO WATERMARKS anywhere in the image.`;

    // 1. DALL-E Kép generálása
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

    console.log("⏳ Kép letöltése az OpenAI szerveréről...");

    // 2. Kép letöltése a memóriába
    const imageResponse = await fetch(openAiImageUrl);
    const imageBlob = await imageResponse.blob();

    // Egyedi fájlnév generálása (időbélyeg + márkanév)
    const safeBrandName = brandName ? brandName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'brand';
    const fileName = `${Date.now()}-${safeBrandName}.png`;

    console.log(`⏳ Feltöltés a Supabase Storage-ba (${fileName})...`);

    // 3. Feltöltés a Supabase 'generated-images' mappájába
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error("❌ Supabase feltöltési hiba:", uploadError);
      throw new Error("Nem sikerült elmenteni a képet a felhőbe.");
    }

    // 4. Publikus link lekérése
    const { data: publicUrlData } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    const finalImageUrl = publicUrlData.publicUrl;
    console.log("✅ Sikeres mentés! Végleges link:", finalImageUrl);

    // Visszaadjuk a kliensnek az örökös linket!
    return NextResponse.json({ imageUrl: finalImageUrl });

  } catch (error: any) {
    console.error("Hiba a folyamat során:", error);
    return NextResponse.json({ error: error.message || "Képgenerálási hiba történt." }, { status: 500 });
  }
}