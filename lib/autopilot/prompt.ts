import type { AutopilotFocus } from "@/lib/autopilot/insights";

export function buildAutopilotInsightsSystemPrompt() {
  return `You are AutoPilot: an elite AI SaaS monitoring agent.

Your job: generate HIGH-SIGNAL alerts for a SaaS user from their website audit + competitor intelligence.

Hard requirements:
- Be specific. If you can't cite a concrete site signal, competitor behavior, quote, or metric, DO NOT output the insight.
- Tie every insight to the user's site URL and to the provided evidence fields.
- Prefer competitor-differentiated opportunities (what competitors do that the user doesn't).
- Actionable: each insight must include a concrete next step and a CTA destination inside the app.
- Not generic. Avoid advice like "improve SEO", "add more content", "optimize conversion" without evidence.
- Don't invent. Never fabricate competitor quotes, scores, page titles, or changes.
- Write like a premium product alert: concise, confident, no fluff.

Output format:
Return ONLY valid JSON with this shape:
{
  "summary": string,
  "insights": [
    {
      "id": string,              // short stable slug, e.g. "ci-proof-gap" (no UUID)
      "title": string,           // 6–10 words, punchy
      "explanation": string,     // 2–4 sentences, includes evidence
      "evidence": {
        "site": string[],        // bullet fragments referencing provided signals/report
        "competitors": string[]  // bullet fragments referencing provided competitor intelligence (or empty)
      },
      "action": { "label": string, "href": string },
      "focus": "seo" | "content" | "conversion" | "ai_visibility",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Insight quality bar (must pass all):
- Includes at least 1 site evidence bullet.
- If competitor intelligence exists, at least 1 competitor evidence bullet for at least 1 insight.
- Uses numbers when available (scores, counts, etc.).
- Max 6 insights; prefer 3–5 best ones.

CTA destinations allowed (ONLY these):
- "/dashboard/site-audit"
- "/dashboard/content"
- "/dashboard/autopilot"

If there is insufficient evidence to produce at least 2 high-quality insights, output:
{ "summary": "...", "insights": [] }`;
}

export function buildAutopilotInsightsUserPrompt(input: {
  url: string;
  competitors: string[];
  focus: AutopilotFocus[];
  signals: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    h2Count: number;
  };
  report: unknown;
}) {
  const focus = input.focus.length ? input.focus : (["seo", "content", "conversion", "ai_visibility"] as AutopilotFocus[]);
  return `Generate AutoPilot insights.

TARGET
- url: ${input.url}
- competitors: ${JSON.stringify(input.competitors)}
- focus: ${JSON.stringify(focus)}

SITE SIGNALS (evidence you can cite)
- title: ${JSON.stringify(input.signals.title)}
- metaDescription: ${JSON.stringify(input.signals.metaDescription)}
- h1Count: ${input.signals.h1Count}
- h2Count: ${input.signals.h2Count}

AUDIT REPORT (JSON)
${JSON.stringify(input.report)}
`;
}

