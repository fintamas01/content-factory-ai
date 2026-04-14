import OpenAI from "openai";

export type ImageQualityScores = {
  realism_score: number; // 0-10 (higher is better)
  artifact_score: number; // 0-10 (higher is worse)
  brand_consistency_score: number; // 0-10 (higher is better)
  issues: string[];
  summary: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clamp(n: unknown, lo: number, hi: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function evaluateImageQuality(params: {
  generatedImageUrl: string;
  referenceImageUrl?: string;
  brandName: string;
  conceptIntent: string;
  mode: "studio_product_shot" | "lifestyle_scene";
}): Promise<ImageQualityScores> {
  const model = process.env.OPENAI_IMAGE_QC_MODEL ?? "gpt-4o-mini";

  const system = `You are a strict commercial creative QA reviewer.
Return ONLY valid JSON.

Task:
Score the generated image for:
- realism_score (0-10): does it look like a real photo suitable for marketing?
- artifact_score (0-10): AI artifacts, uncanny textures, warped geometry, weird objects (higher = worse).
- brand_consistency_score (0-10): does it plausibly match the brand + concept intent?

Also return:
- issues: 3-8 short bullet-like strings describing visible problems (if any)
- summary: one-sentence verdict

Rules:
- Be conservative. Marketing-ready means few/no artifacts.
- If product integrity is violated (shape/logo/colors/proportions changed vs reference), reduce realism and brand scores and increase artifact score.

JSON shape:
{
  "realism_score": 0,
  "artifact_score": 0,
  "brand_consistency_score": 0,
  "issues": ["..."],
  "summary": "..."
}`;

  const userText = `Brand: ${params.brandName}
Mode: ${params.mode}
Concept intent: ${params.conceptIntent}
Reference image present: ${params.referenceImageUrl ? "yes" : "no"}`;

  const content: any[] = [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: params.generatedImageUrl } },
  ];
  if (params.referenceImageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: params.referenceImageUrl },
    });
  }

  const resp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    realism_score: clamp(parsed.realism_score, 0, 10),
    artifact_score: clamp(parsed.artifact_score, 0, 10),
    brand_consistency_score: clamp(parsed.brand_consistency_score, 0, 10),
    issues: Array.isArray(parsed.issues)
      ? (parsed.issues as unknown[])
          .map(asString)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [],
    summary: asString(parsed.summary).trim(),
  };
}

