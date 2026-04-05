import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { resolveOutputLanguage } from "@/lib/i18n/output-language";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const { text, action, lang } = await req.json();
    const { label: targetLang } = resolveOutputLanguage(lang);

    const prompts: Record<string, string> = {
      shorten: "Shorten this text while keeping the tone; be concise.",
      expand: "Expand this idea with more useful detail; stay on-topic.",
      emoji: "Add appropriate emojis where they help readability (not every line).",
      professional: "Rewrite in a clear, professional business tone.",
      funny: "Rewrite with a light, friendly humorous tone (still appropriate for social).",
    };

    const instruction =
      typeof action === "string" && action.trim() && prompts[action]
        ? prompts[action]
        : typeof action === "string"
          ? action
          : "Improve this text.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional editor. Reply only with the revised text, nothing else.

OUTPUT LANGUAGE — STRICT: The revised text must be entirely in ${targetLang}. Do not use Hungarian unless the output language is Hungarian.`,
        },
        {
          role: "user",
          content: `${instruction}\n\nText:\n${typeof text === "string" ? text : ""}`,
        },
      ],
    });

    const updatedText = response.choices[0]?.message?.content;
    if (!updatedText || !String(updatedText).trim()) {
      return NextResponse.json(
        { error: "Empty model response." },
        { status: 502 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({ updatedText });
  } catch (error) {
    console.error("edit:", error);
    return NextResponse.json({ error: "Edit failed." }, { status: 500 });
  }
}
