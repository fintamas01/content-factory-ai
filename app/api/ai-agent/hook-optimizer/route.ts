import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const topic = String(body.topic ?? "").trim();
    const platform = String(body.platform ?? "instagram");
    const tone = String(body.tone ?? "modern");
    const goal = String(body.goal ?? "engagement");

    if (!topic) return badRequest("Missing topic.");

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, clientId } = gate;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 200 }
      );
    }

    const system = `
You are a high-performance social media growth strategist.
Return STRICT JSON only.

Output format:
{
  hooks: [
    {
      type: "curiosity|controversial|authority|emotional|problem",
      headline: "...",
      explanation: "...",
      cta: "..."
    }
  ]
}

Hooks must be short, high-impact, platform-native.
No emojis unless platform = instagram.
Keep under 15 words per headline.
`.trim();

    const user = {
      topic,
      platform,
      tone,
      goal,
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(raw);
      await incrementUsage(supabase, "content", clientId);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ raw });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "Hook optimizer failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}