import OpenAI from "openai";

export const siteAuditOpenAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function getSiteAuditModel(): string {
  return process.env.OPENAI_SITE_AUDIT_MODEL ?? "gpt-4o-mini";
}

export function parseJsonFromAssistantContent(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/s, "");
  }
  return JSON.parse(cleaned);
}

export async function callOpenAIJson(params: {
  system: string;
  user: string;
  temperature?: number;
  /** Larger outputs (e.g. batched specialists) may need a higher cap. */
  max_tokens?: number;
}): Promise<{ ok: true; parsed: unknown } | { ok: false; error: string }> {
  try {
    const completion = await siteAuditOpenAI.chat.completions.create({
      model: getSiteAuditModel(),
      temperature: params.temperature ?? 0.35,
      ...(params.max_tokens != null ? { max_tokens: params.max_tokens } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, error: "Empty model response." };
    const parsed = parseJsonFromAssistantContent(content);
    return { ok: true, parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI request failed.";
    return { ok: false, error: msg };
  }
}
