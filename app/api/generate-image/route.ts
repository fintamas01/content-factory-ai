import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt, platform, brandName } = await req.json();

    const enhancedPrompt = `A professional, high-quality social media ${platform} image for a brand named ${brandName}. 
    Visual concept: ${prompt}. 
    Style: PHOTOREALISTIC, modern, clean, high resolution, no text in the image, photorealistic.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
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