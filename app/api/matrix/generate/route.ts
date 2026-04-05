import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import {
  resolveOutputLanguage,
  outputLanguageContractMatrixPack,
} from "@/lib/i18n/output-language";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function performDeepResearch(query: string) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        max_results: 5,
      }),
    });
    const data = await response.json();
    return data.results
      .map((r: { content?: string; url?: string }) => `Info: ${r.content} (Source: ${r.url})`)
      .join("\n\n");
  } catch {
    return "Could not retrieve fresh web data.";
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, user, clientId } = gate;

    const body = await req.json().catch(() => ({}));
    const { brand, audience, topic, tone, useResearch, lang } = body;
    const { label: outputLabel } = resolveOutputLanguage(lang);

    let researchData = "";
    if (useResearch && typeof topic === "string" && topic.trim()) {
      researchData = await performDeepResearch(topic);
    }

    const langBlock = outputLanguageContractMatrixPack(outputLabel);

    const completion = await openai.chat.completions.create({
      model: useResearch ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a senior social media strategist. Tone: "${String(tone ?? "")}".

            TASK: Produce a 5-day, multi-platform "content pack" in ${outputLabel}.

            DIVERSITY:
            - Day 1: LinkedIn (authority / thought leadership)
            - Day 2: Instagram (carousel / swipeable post)
            - Day 3: X/Twitter (short, punchy hook)
            - Day 4: Instagram (story-style or single-image post)
            - Day 5: LinkedIn or newsletter (weekly recap / CTA)

            Each day MUST include an "image_prompt" string describing the visual for image generation.

            ${langBlock}`,
        },
        {
          role: "user",
          content: `Brand: ${String(brand ?? "")}. Target audience: ${String(audience ?? "")}. Topic: ${String(topic ?? "")}.
            ${researchData ? `RECENT WEB SIGNALS: ${researchData}` : ""}

            Respond with JSON only:
            { 
              "days": [{ 
                "day": "Day name",
                "title": "Title", 
                "platform": "Platform name", 
                "outline": "Strategy notes", 
                "content": "Full post copy",
                "image_prompt": "Image generation prompt",
                "slides": ["Optional carousel card copy if applicable"]
              }] 
            }

            All string values must be in ${outputLabel}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    if (!raw?.trim()) {
      return NextResponse.json(
        { error: "Empty model response." },
        { status: 502 }
      );
    }
    let generatedContent: unknown;
    try {
      generatedContent = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model." },
        { status: 502 }
      );
    }

    const { error: insertErr } = await supabase.from("matrix_generations").insert({
      user_id: user.id,
      brand_name: brand,
      month_year: new Date().toISOString().slice(0, 7),
      generation_data: generatedContent,
    });

    if (insertErr) {
      console.error("matrix_generations insert:", insertErr);
      return NextResponse.json(
        { error: "Could not save content pack." },
        { status: 500 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json(generatedContent);
  } catch (error: unknown) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
