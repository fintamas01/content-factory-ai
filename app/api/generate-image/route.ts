import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt, platform, brandName } = await req.json();

    // Új, "Fotós" stílusú prompt, ami kizárja a 3D renderelt, műanyag hatást
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
      style: "natural", // <--- EZ A TITKOS FEGYVER! Megakadályozza a túlzott, műanyag hatást.
    });

    if (!response.data || response.data.length === 0 || !response.data[0].url) {
        throw new Error("No image data received");
    }

    return NextResponse.json({ imageUrl: response.data[0].url });
  } catch (error: any) {
    console.error("DALL-E hiba:", error);
    return NextResponse.json({ error: "Képgenerálási hiba" }, { status: 500 });
  }
}