import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

type PatchFile = { path: string; content: string };
type PatchResponse = {
  summary: string;
  risks: string[];
  tasks: Array<{
    id: string;
    priority: "P0" | "P1" | "P2";
    title: string;
    why: string;
    steps: string[];
    acceptance: string[];
  }>;
  files: PatchFile[];
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const siteName = typeof body.siteName === "string" ? body.siteName.trim() : "";
    const stack = typeof body.stack === "string" ? body.stack.trim() : "Next.js App Router";

    if (!goal) return badRequest("Missing 'goal'.");

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, clientId } = gate;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "Missing OPENAI_API_KEY (server env).",
          diagnostics: { hasOpenAIKey: false },
        },
        { status: 200 }
      );
    }

    const system = `
You are a senior Next.js engineer.
Return STRICT JSON only. No markdown. No extra text.

You must produce a patch bundle that can be applied manually by copying file contents.

Rules:
- Never invent URLs, phone numbers, addresses, company claims.
- Keep content generic if missing facts.
- Prefer safe defaults and minimal changes.
- Use Next.js App Router patterns.
- Provide complete file contents for each file in files[] (not diffs).
- Keep files small and focused.
Return JSON schema:
{
  "summary": string,
  "risks": string[],
  "tasks": [{ "id": string, "priority": "P0"|"P1"|"P2", "title": string, "why": string, "steps": string[], "acceptance": string[] }],
  "files": [{ "path": string, "content": string }]
}
`.trim();

    const user = {
      goal,
      siteName,
      stack,
      context: {
        existingAgents: ["geo_audit", "compare", "action_plan", "content_builder", "landing_page_export"],
        project: "Next.js App Router dashboard tool",
      },
      constraints: {
        mustBeCopyPasteable: true,
        noSecrets: true,
      },
    };

    const r = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      temperature: 0.2,
    });

    const raw = (r.choices[0]?.message?.content ?? "").trim();

    let parsed: PatchResponse | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: "Model returned non-JSON.",
          raw,
          diagnostics: { hasOpenAIKey: true },
        },
        { status: 200 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json(
      {
        ...parsed,
        diagnostics: { hasOpenAIKey: true },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Apply patch error:", e);
    return NextResponse.json(
      { error: "Apply patch failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}