import { NextResponse } from "next/server";
import { openai, getCopilotModel } from "@/lib/openai/client";
import { trimCopilotContext } from "@/lib/copilot/trim";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

function coerceMessage(x: unknown): string {
  if (typeof x !== "string") return "";
  return x.trim();
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = coerceMessage(body?.message);
    const contextRaw = body?.context as unknown;

    if (!message) {
      return NextResponse.json({ error: "Missing message." }, { status: 400 });
    }

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const context = trimCopilotContext(contextRaw ?? null);

    const system = [
      "You are Live AI Co-Pilot for a premium multi-module SaaS.",
      "You help users improve, rewrite, explain, and plan next steps based on the current page and data.",
      "Be fast, direct, and practical. Prefer bullets and concrete edits.",
      "If context is missing, ask 1-2 focused questions instead of guessing.",
      "Never claim you performed actions in the app. Provide guidance and copy the user can paste.",
    ].join("\n");

    const user = JSON.stringify({
      message,
      context,
    });

    const completion = await openai.chat.completions.create({
      model: getCopilotModel(),
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Empty model response." },
        { status: 502 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({ response: content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
