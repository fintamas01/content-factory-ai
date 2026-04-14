import OpenAI from "openai";

export type RealismVisualPlan = {
  mode: "studio_product_shot" | "lifestyle_scene";
  environment: string;
  camera: {
    body: string;
    lens: string;
    framing: string;
    angle: string;
  };
  lighting: {
    setup: string;
    timeOfDay?: string;
    shadows: string;
  };
  productPlacement: string;
  composition: string;
  realismConstraints: string[];
  negativePrompts: string[];
  postProcessNotes: string[];
};

export type RealismPipelineOutput = {
  concepts: Array<{
    id: string;
    intent: string;
    plan: RealismVisualPlan;
  }>;
  prompts: Array<{
    id: string;
    prompt: string;
    negative_prompt: string;
  }>;
  style_metadata: {
    realism_version: 1;
    emphasis: "reference-first" | "text-to-image-fallback";
  };
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clampLines(xs: unknown, max: number): string[] {
  if (!Array.isArray(xs)) return [];
  return xs
    .map(asString)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function safeJsonParse(raw: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: "Invalid JSON from model." };
  }
}

export async function buildRealismVisualPlan(params: {
  id: string;
  brandName: string;
  conceptIntent: string;
  styleDirection?: string;
  referenceImageUrl?: string;
  mode?: "studio_product_shot" | "lifestyle_scene";
}): Promise<RealismPipelineOutput> {
  const { id, brandName, conceptIntent, styleDirection, referenceImageUrl } = params;
  const mode = params.mode === "studio_product_shot" ? "studio_product_shot" : "lifestyle_scene";

  const system = `You are a senior commercial photographer + ad creative director.
Return ONLY valid JSON.

Goal:
Create a visual plan that results in a realistic, marketing-ready photo (not AI-looking).

Hard constraints:
- Photorealistic commercial photography (no illustration, no CGI, no plastic look).
- Natural imperfections: micro-textures, subtle sensor grain, slight asymmetry.
- Real lighting with believable shadows and depth.
- Leave negative space for potential overlay text (but DO NOT include any text in the image).
- Avoid perfect symmetry, overly smooth surfaces, and uncanny textures.

If a reference image URL is provided, treat it as the product reference to preserve identity (shape, materials, colors).
Do not mention the URL in output; it is internal context only.

Required JSON shape:
{
  "mode": "studio_product_shot" | "lifestyle_scene",
  "environment": "...",
  "camera": { "body": "...", "lens": "...", "framing": "...", "angle": "..." },
  "lighting": { "setup": "...", "timeOfDay": "...", "shadows": "..." },
  "productPlacement": "...",
  "composition": "...",
  "realismConstraints": ["..."],
  "negativePrompts": ["..."],
  "postProcessNotes": ["..."]
}`;

  const user = `Brand: ${brandName}
Concept intent: ${conceptIntent}
Style direction (optional): ${styleDirection ?? ""}
Reference image provided: ${referenceImageUrl ? "yes" : "no"}
Mode: ${mode}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_IMAGE_PLAN_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw.trim()) {
    return {
      concepts: [
        {
          id,
          intent: conceptIntent,
          plan: {
            mode,
            environment: "",
            camera: { body: "", lens: "", framing: "", angle: "" },
            lighting: { setup: "", shadows: "" },
            productPlacement: "",
            composition: "",
            realismConstraints: [],
            negativePrompts: [],
            postProcessNotes: [],
          },
        },
      ],
      prompts: [],
      style_metadata: { realism_version: 1, emphasis: referenceImageUrl ? "reference-first" : "text-to-image-fallback" },
    };
  }

  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const p = parsed.value ?? {};
  const plan: RealismVisualPlan = {
    mode,
    environment: asString(p.environment),
    camera: {
      body: asString(p?.camera?.body),
      lens: asString(p?.camera?.lens),
      framing: asString(p?.camera?.framing),
      angle: asString(p?.camera?.angle),
    },
    lighting: {
      setup: asString(p?.lighting?.setup),
      timeOfDay: asString(p?.lighting?.timeOfDay) || undefined,
      shadows: asString(p?.lighting?.shadows),
    },
    productPlacement: asString(p.productPlacement),
    composition: asString(p.composition),
    realismConstraints: clampLines(p.realismConstraints, 10),
    negativePrompts: clampLines(p.negativePrompts, 14),
    postProcessNotes: clampLines(p.postProcessNotes, 10),
  };

  const negative = [
    ...plan.negativePrompts,
    "text, letters, typography, watermark, logo text",
    "cgi, 3d render, illustration, cartoon, anime",
    "uncanny, plastic skin, overly smooth surfaces, airbrushed",
    "weird hands, extra fingers, distorted objects",
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "Ultra realistic commercial product photo, premium marketing photography.",
    mode === "studio_product_shot"
      ? "Mode: studio product shot (controlled studio lighting, seamless background, premium tabletop/studio setup)."
      : "Mode: lifestyle scene (product naturally integrated into a real environment, believable context, candid feel).",
    plan.environment ? `Environment: ${plan.environment}.` : "",
    plan.productPlacement ? `Product placement: ${plan.productPlacement}.` : "",
    plan.composition ? `Composition: ${plan.composition}.` : "",
    plan.camera?.body || plan.camera?.lens
      ? `Shot on ${plan.camera.body || "DSLR"} with ${plan.camera.lens || "35mm"}; ${plan.camera.framing || ""} ${plan.camera.angle ? `(${plan.camera.angle})` : ""}.`
      : "",
    plan.lighting?.setup ? `Lighting: ${plan.lighting.setup}.` : "",
    plan.lighting?.timeOfDay ? `Time of day: ${plan.lighting.timeOfDay}.` : "",
    plan.lighting?.shadows ? `Shadows: ${plan.lighting.shadows}.` : "",
    plan.realismConstraints.length
      ? `Realism constraints: ${plan.realismConstraints.join("; ")}.`
      : "",
    "Natural texture detail, believable depth, imperfect realism, subtle sensor grain, natural shadows.",
    "No text in the image. Leave clean negative space for later overlay.",
  ]
    .filter(Boolean)
    .join("\n");

  const out: RealismPipelineOutput = {
    concepts: [{ id, intent: conceptIntent, plan }],
    prompts: [{ id, prompt, negative_prompt: negative }],
    style_metadata: { realism_version: 1, emphasis: referenceImageUrl ? "reference-first" : "text-to-image-fallback" },
  };
  return out;
}

