import OpenAI from "openai";
import { getImageStylePreset, type ImageStylePresetKey } from "@/lib/ad-creative/image-style-presets";

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
    preset?: { key: ImageStylePresetKey; label: string };
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
  stylePreset?: ImageStylePresetKey;
  referenceImageUrl?: string;
  mode?: "studio_product_shot" | "lifestyle_scene";
}): Promise<RealismPipelineOutput> {
  const { id, brandName, conceptIntent, styleDirection, referenceImageUrl } = params;
  const mode = params.mode === "studio_product_shot" ? "studio_product_shot" : "lifestyle_scene";
  const preset = getImageStylePreset(params.stylePreset ?? null);

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
Style preset (optional): ${preset ? `${preset.label} (${preset.key})` : ""}
Preset controls (if provided, incorporate them):\n- lighting: ${preset?.lighting ?? ""}\n- camera: ${preset?.camera ?? ""}\n- color grading: ${preset?.colorGrading ?? ""}\n- composition: ${preset?.composition ?? ""}
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

  const defaultNegatives = [
    // Text & logos
    "text, letters, typography, watermark, logo text",
    // Requested negatives
    "no CGI",
    "no artificial skin",
    "no plastic textures",
    "no unrealistic reflections",
    // Common failure modes
    "cgi, 3d render, illustration, cartoon, anime",
    "uncanny, overly smooth surfaces, airbrushed",
    "warped geometry, melted objects, duplicated objects",
    "weird hands, extra fingers, distorted objects",
    "cheap lens flare, overbloom, oversharpening halos",
  ];

  const negative = [
    ...plan.negativePrompts,
    ...(preset?.negative ?? []),
    ...defaultNegatives,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  // Layered prompt builder (reusable + consistent):
  // scene + product + camera + lighting + grading + composition + realism constraints
  const promptSections: string[] = [];
  promptSections.push("SCENE");
  promptSections.push(
    [
      "Photorealistic commercial photography (real photo, not AI-looking).",
      mode === "studio_product_shot"
        ? "Studio product shot in a real studio environment."
        : "Lifestyle scene captured in a real environment (candid, believable).",
      plan.environment ? `Environment: ${plan.environment}.` : "",
      styleDirection ? `Creative direction: ${styleDirection}.` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("PRODUCT");
  promptSections.push(
    [
      referenceImageUrl
        ? "Use the provided reference image as the product identity source; preserve shape, proportions, materials, colors."
        : "Keep product identity consistent, realistic materials, believable proportions.",
      plan.productPlacement ? `Placement: ${plan.productPlacement}.` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("CAMERA");
  promptSections.push(
    [
      preset?.camera ? `Preset camera: ${preset.camera}.` : "",
      plan.camera?.body || plan.camera?.lens
        ? `Camera: ${plan.camera.body || "DSLR"}; Lens: ${plan.camera.lens || "35mm"}.`
        : "Camera: professional photo camera; Lens: realistic focal length for the scene.",
      plan.camera?.framing ? `Framing: ${plan.camera.framing}.` : "",
      plan.camera?.angle ? `Angle: ${plan.camera.angle}.` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("LIGHTING");
  promptSections.push(
    [
      preset?.lighting ? `Preset lighting: ${preset.lighting}.` : "",
      plan.lighting?.setup ? `Setup: ${plan.lighting.setup}.` : "",
      plan.lighting?.timeOfDay ? `Time of day: ${plan.lighting.timeOfDay}.` : "",
      plan.lighting?.shadows ? `Shadows: ${plan.lighting.shadows}.` : "",
      "Lighting continuity: consistent direction, consistent color temperature, believable falloff.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("COLOR GRADING");
  promptSections.push(
    [
      preset?.colorGrading ? `Preset grade: ${preset.colorGrading}.` : "",
      plan.postProcessNotes.length ? `Notes: ${plan.postProcessNotes.join("; ")}.` : "",
      "Keep tones natural. Avoid HDR halos, oversharpening, and fake plastic sheen.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("COMPOSITION");
  promptSections.push(
    [
      preset?.composition ? `Preset composition: ${preset.composition}.` : "",
      plan.composition ? `Composition: ${plan.composition}.` : "",
      "Leave clean negative space for later overlay (but DO NOT include any text in the image).",
    ]
      .filter(Boolean)
      .join("\n")
  );

  promptSections.push("REALISM CONSTRAINTS");
  promptSections.push(
    [
      plan.realismConstraints.length
        ? plan.realismConstraints.map((x) => `- ${x}`).join("\n")
        : "- Natural micro-texture, subtle sensor grain, realistic depth, imperfect realism.",
      "- No CGI/illustration look; no plastic textures; no unrealistic reflections.",
      "- No broken shapes/warped objects; avoid uncanny symmetry.",
    ].join("\n")
  );

  const prompt = promptSections.join("\n\n");

  const out: RealismPipelineOutput = {
    concepts: [{ id, intent: conceptIntent, plan }],
    prompts: [{ id, prompt, negative_prompt: negative }],
    style_metadata: {
      realism_version: 1,
      emphasis: referenceImageUrl ? "reference-first" : "text-to-image-fallback",
      preset: preset ? { key: preset.key, label: preset.label } : undefined,
    },
  };
  return out;
}

