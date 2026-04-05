import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { resolveOutputLanguage } from "@/lib/i18n/output-language";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { content, critique, suggestions, lang } = body;

    if (!content || typeof content !== "string" || !critique || typeof critique !== "string") {
      return NextResponse.json(
        { error: "Missing content or critique for rewrite." },
        { status: 400 }
      );
    }

    const list = Array.isArray(suggestions) ? suggestions.filter((s: unknown) => typeof s === "string") : [];
    const { label: targetLang } = resolveOutputLanguage(lang);

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const prompt = `You are a senior social media copywriter.

Critique from the analyzer:
"${critique}"

Suggestions to incorporate (use all that apply):
${list.map((s: string) => `- ${s}`).join("\n")}

ORIGINAL POST:
"${content}"

TASK:
Rewrite the post so it fully addresses the critique and incorporates the suggestions. Make it more engaging and aligned with current social trends.

OUTPUT LANGUAGE — STRICT: Write the entire post only in ${targetLang}. Do not use Hungarian unless the output language is Hungarian.

Return ONLY the new post text — no preamble, no quotes around the whole thing, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const updatedText = completion.choices[0].message.content?.trim();
    if (!updatedText) {
      return NextResponse.json(
        { error: "Empty model response." },
        { status: 502 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({ updatedText });
  } catch (error: unknown) {
    console.error("improve-post:", error);
    return NextResponse.json(
      { error: "Something went wrong while rewriting the post." },
      { status: 500 }
    );
  }
}
