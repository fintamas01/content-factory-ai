import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import {
  resolveOutputLanguage,
  outputLanguageContractMatrixPack,
} from "@/lib/i18n/output-language";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const body = await req.json().catch(() => ({}));
    const { brand, audience, topic, tone, day, platform, currentPost, lang } = body;
    const { label: outputLabel } = resolveOutputLanguage(lang);
    const langBlock = outputLanguageContractMatrixPack(outputLabel);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert social media manager. Tone: "${String(tone ?? "")}".

            TASK: Rewrite the given social post in ${outputLabel}.
            The user wants a more creative, stronger version for the same day/topic—do not repeat the old title or angle.

            Include a "slides" array (carousel card copy) where it makes sense, educational and clear.

            JSON response shape:
            {
              "title": "New compelling title",
              "outline": "Updated strategic angle...",
              "content": "Full post copy...",
              "slides": ["Slide 1", "Slide 2", "Slide 3", "Slide 4"]
            }

            ${langBlock}`,
        },
        {
          role: "user",
          content: `
            Brand: ${String(brand ?? "")}
            Audience: ${String(audience ?? "")}
            Topic: ${String(topic ?? "")}
            Day: ${String(day ?? "")}
            Platform: ${String(platform ?? "")}

            Previous title to improve on (do not repeat; make it different):
            "${currentPost?.title ?? ""}"
            `,
        },
      ],
      response_format: { type: "json_object" },
    });

    const newPostData = JSON.parse(completion.choices[0].message.content!);

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      ...currentPost,
      day: day,
      platform: platform,
      title: newPostData.title,
      outline: newPostData.outline,
      content: newPostData.content,
      slides: newPostData.slides,
    });
  } catch (error: unknown) {
    console.error("Remix Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
