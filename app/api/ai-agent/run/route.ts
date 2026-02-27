import { NextResponse } from "next/server";
import OpenAI from "openai";

type Platform = "web" | "instagram" | "tiktok" | "linkedin";
type AgentGoal = "geo_audit" | "content_plan" | "brand_voice";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    // if user passed just domain
    return inputUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function isSameDomain(url: string, domain: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === domain || h.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  score?: number;
};

type WebContext = {
  query: string;
  targetDomain: string;
  onDomain: Array<{ url: string; title: string; text: string }>;
  offDomain: Array<{ url: string; title: string; text: string }>;
};

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

    const targetDomain = url ? toHostname(url) : "";

    // 1) Rövid keresőkifejezés generálás (geo_auditnál)
    const searchQuery =
      goal === "geo_audit"
        ? await generateSearchQuery({ url: url!, brandName, platform })
        : null;

    // 2) Web context (Tavily) – geo_auditnál: találatok, answer NINCS
    const webContext: WebContext | null =
      goal === "geo_audit"
        ? await fetchWebContextTavily({
            query: searchQuery ?? targetDomain,
            targetDomain,
          })
        : null;

    // 3) Elemzés + teendők JSON-ban (domain-lock + evidence)
    const result = await runAgentAnalysis({
      goal,
      url,
      platform,
      brandName,
      notes,
      targetDomain,
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
  const domain = toHostname(args.url);
  const prompt = `
Create a short (3-7 words) ENGLISH search query to assess AI/SEO discoverability for a website.
Website domain: ${domain}
Brand: ${args.brandName ?? "unknown"}
Return ONLY the query. No quotes. No punctuation.
`.trim();

  const r = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return (r.choices[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
}

async function fetchWebContextTavily(args: { query: string; targetDomain: string }): Promise<WebContext> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Missing TAVILY_API_KEY in environment.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: args.query,
      search_depth: "basic",
      include_answer: false, // ✅ IMPORTANT: avoid Tavily "answer" hallucinations
      max_results: 8,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Tavily request failed: ${res.status} ${t}`);
  }

  const data = await res.json().catch(() => null);
  const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

  const onDomain: Array<{ url: string; title: string; text: string }> = [];
  const offDomain: Array<{ url: string; title: string; text: string }> = [];

  for (const r of results) {
    const url = (r.url ?? "").trim();
    if (!url) continue;

    const title = (r.title ?? "").trim() || "Untitled";
    const text = (r.content ?? r.snippet ?? "").trim();

    // If Tavily didn't provide text, skip — we need something to ground.
    if (!text) continue;

    if (isSameDomain(url, args.targetDomain)) {
      onDomain.push({ url, title, text });
    } else {
      offDomain.push({ url, title, text });
    }
  }

  // Keep context compact:
  // - prefer on-domain (facts about the website)
  // - allow a few off-domain (reputation / mentions)
  const compactOnDomain = onDomain.slice(0, 6);
  const compactOffDomain = offDomain.slice(0, 3);

  return {
    query: args.query,
    targetDomain: args.targetDomain,
    onDomain: compactOnDomain,
    offDomain: compactOffDomain,
  };
}

async function runAgentAnalysis(args: {
  goal: AgentGoal;
  url?: string;
  platform: Platform;
  brandName?: string;
  notes?: string;
  targetDomain: string;
  webContext?: WebContext | null;
}) {
  const system = `
You are an AI Agent that outputs STRICT JSON.
No markdown. No extra text. Only JSON.

CRITICAL ACCURACY RULES:
- Do NOT invent facts (numbers, dates, installs, awards, company size, etc).
- You may ONLY state factual claims about the website/company if they are supported by EVIDENCE from the provided webContext.onDomain items (same domain as targetDomain).
- You may use webContext.offDomain only for "external mentions / reputation" and those claims must also include EVIDENCE.
- If you are unsure, write "unknown" or omit the claim.
- For geo_audit findings, include evidence[] where possible: [{ url, quote }].
`.trim();

  const goalSpec =
    args.goal === "geo_audit"
      ? `
Goal: GEO Audit (AI discoverability audit).

Return JSON with keys:
- summary: 2-4 sentences (NO unverified facts; focus on what is missing / what to improve)
- score: number 0-100
- findings: array of { area, issue, impact, fix, evidence?: [{url, quote}] }
- missingInfo: array of strings (what AI/bots can't easily find)
- quickWins: array of { title, steps[] }
- copySuggestions: array of { section, exampleText }

EVIDENCE REQUIREMENTS:
- If you mention anything specific about the website/company, attach evidence in findings where relevant.
- If no evidence exists for a specific claim, do not claim it.
`
      : args.goal === "content_plan"
      ? `
Goal: Content Plan.

Return JSON with keys:
- summary
- contentPillars: array
- 14dayPlan: array of { day, platform, hook, outline[] }
- reusableTemplates: array

Avoid inventing company facts. If brand specifics are unknown, keep it generic but useful.
`
      : `
Goal: Brand Voice.

Return JSON with keys:
- tone
- do: array
- dont: array
- exampleCaptions: array of { platform, caption }

Avoid inventing company facts. If brand specifics are unknown, infer from notes only.
`;

  const user = `
Input:
goal=${args.goal}
url=${args.url ?? ""}
targetDomain=${args.targetDomain}
platform=${args.platform}
brandName=${args.brandName ?? ""}
notes=${args.notes ?? ""}

webContext (structured):
${args.webContext ? JSON.stringify(args.webContext, null, 2) : "null"}
`.trim();

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${goalSpec}\n\n${user}` },
    ],
    temperature: 0.2,
  });

  const raw = (r.choices[0]?.message?.content ?? "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}