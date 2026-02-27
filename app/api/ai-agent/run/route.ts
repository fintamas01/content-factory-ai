import { NextResponse } from "next/server";
import OpenAI from "openai";

type Platform = "web" | "instagram" | "tiktok" | "linkedin";
type AgentGoal = "geo_audit" | "content_plan" | "brand_voice";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const {
      goal,
      url,
      platform = "web",
      brandName,
      notes,
    }: {
      goal: AgentGoal;
      url?: string;
      platform?: Platform;
      brandName?: string;
      notes?: string;
    } = body;

    if (!goal) return badRequest("Missing 'goal'.");
    if (goal === "geo_audit" && !url) return badRequest("Missing 'url' for geo_audit.");

    // 1) Agent: rövid keresőkifejezés generálás (ha kell)
    const searchQuery =
      goal === "geo_audit"
        ? await generateSearchQuery({ url: url!, brandName, platform })
        : null;

    // 2) Web context (Tavily) – ha geo audit, akkor hasznos
    const webContext =
      goal === "geo_audit"
        ? await fetchWebContextTavily(searchQuery ?? url!)
        : null;

    // 3) Elemzés + teendők JSON-ban
    const result = await runAgentAnalysis({
      goal,
      url,
      platform,
      brandName,
      notes,
      webContext,
    });

    return NextResponse.json(
      {
        goal,
        url: url ?? null,
        platform,
        brandName: brandName ?? null,
        searchQuery,
        webContextUsed: Boolean(webContext),
        result,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("AI Agent error:", e);
    return NextResponse.json(
      { error: "AI Agent failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

async function generateSearchQuery(args: { url: string; brandName?: string; platform: Platform }) {
  const prompt = `
Create a short (3-6 words) ENGLISH search query to find what the internet says about this brand/site.
URL: ${args.url}
Brand: ${args.brandName ?? "unknown"}
Platform intent: ${args.platform}
Return ONLY the query, no quotes, no punctuation.
`.trim();

  const r = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return (r.choices[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
}

async function fetchWebContextTavily(query: string) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Missing TAVILY_API_KEY in environment.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Tavily request failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  return data?.answer ?? JSON.stringify(data?.results ?? []);
}

async function runAgentAnalysis(args: {
  goal: AgentGoal;
  url?: string;
  platform: Platform;
  brandName?: string;
  notes?: string;
  webContext?: string | null;
}) {
  const system = `
You are an AI Agent that produces STRICT JSON output.
No markdown. No extra text. Only JSON.
`.trim();

  const goalSpec =
    args.goal === "geo_audit"
      ? `
Goal: GEO Audit (AI discoverability audit).
Given a website URL and optional web context, produce:
- summary: 2-3 sentences
- findings: array of { area, issue, impact, fix }
- missingInfo: array of strings (what AI/bots can't easily find)
- quickWins: array of { title, steps[] }
- copySuggestions: array of { section, exampleText }
- score: number 0-100
`
      : args.goal === "content_plan"
      ? `
Goal: Content Plan.
Produce:
- summary
- contentPillars: array
- 14dayPlan: array of { day, platform, hook, outline[] }
- reusableTemplates: array
`
      : `
Goal: Brand Voice.
Produce:
- tone
- do: array
- dont: array
- exampleCaptions: array of { platform, caption }
`;

  const user = `
Input:
goal=${args.goal}
url=${args.url ?? ""}
platform=${args.platform}
brandName=${args.brandName ?? ""}
notes=${args.notes ?? ""}

WebContext (optional):
${args.webContext ?? ""}
`.trim();

  const schemaHint =
    args.goal === "geo_audit"
      ? `Return JSON with keys: summary, score, findings, missingInfo, quickWins, copySuggestions`
      : args.goal === "content_plan"
      ? `Return JSON with keys: summary, contentPillars, 14dayPlan, reusableTemplates`
      : `Return JSON with keys: tone, do, dont, exampleCaptions`;

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${goalSpec}\n${schemaHint}\n\n${user}` },
    ],
    temperature: 0.3,
  });

  const raw = (r.choices[0]?.message?.content ?? "").trim();
  // Próbáljuk JSON-ként visszaadni – ha a modell hibázik, visszaadjuk nyersen is
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}