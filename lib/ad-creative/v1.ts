import { resolveOutputLanguage } from "@/lib/i18n/output-language";
import { outputLanguageContract } from "@/lib/i18n/output-language";

export type AspectRatio = "1:1" | "4:5" | "9:16";

export type AdCreativeV1Input = {
  productName: string;
  brandName: string;
  targetAudience: string;
  offerSummary: string;
  landingPageUrl?: string;
  sourceImageUrl?: string;
  language?: string;
  aspectRatios: AspectRatio[];
  styleDirection?: string;
  callToAction?: string;
};

export type AdAngleV1 = {
  id: string;
  hook: string;
  headlines: string[];
  primaryTexts: string[];
  ctas: string[];
  visualConcept: {
    subject: string;
    scene: string;
    composition: string;
    lighting: string;
    palette: string;
    typography: string;
    overlays: string[];
    doNotDo: string[];
  };
  adaptations: Record<AspectRatio, string[]>;
};

export type AdCreativeV1Output = {
  language: { code: string; label: string };
  aspectRatios: AspectRatio[];
  angles: AdAngleV1[];
};

function clampArray<T>(v: unknown, max: number): T[] {
  if (!Array.isArray(v)) return [];
  return (v as T[]).slice(0, max);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function uniqStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of xs) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function safeAspectRatios(input: unknown): AspectRatio[] {
  const allowed: AspectRatio[] = ["1:1", "4:5", "9:16"];
  const raw = Array.isArray(input) ? input : [];
  const picked = raw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x): x is AspectRatio => allowed.includes(x as AspectRatio));
  const uniq = Array.from(new Set(picked));
  return uniq.length ? uniq : ["1:1", "4:5", "9:16"];
}

function normalizeAngle(
  raw: any,
  idx: number,
  aspectRatios: AspectRatio[]
): AdAngleV1 {
  const headlines = uniqStrings(clampArray<string>(raw?.headlines, 6).map(asString));
  const primaryTexts = uniqStrings(
    clampArray<string>(raw?.primaryTexts, 6).map(asString)
  );
  const ctas = uniqStrings(clampArray<string>(raw?.ctas, 6).map(asString));

  const overlays = uniqStrings(clampArray<string>(raw?.visualConcept?.overlays, 8).map(asString));
  const doNotDo = uniqStrings(clampArray<string>(raw?.visualConcept?.doNotDo, 8).map(asString));

  const adaptations: Record<AspectRatio, string[]> = {
    "1:1": [],
    "4:5": [],
    "9:16": [],
  };
  const rawAdapt = raw?.adaptations ?? {};
  for (const ar of aspectRatios) {
    adaptations[ar] = uniqStrings(
      clampArray<string>(rawAdapt?.[ar], 8).map(asString)
    );
  }

  return {
    id: asString(raw?.id) || `angle_${idx + 1}`,
    hook: asString(raw?.hook) || asString(raw?.angle) || "",
    headlines,
    primaryTexts,
    ctas,
    visualConcept: {
      subject: asString(raw?.visualConcept?.subject),
      scene: asString(raw?.visualConcept?.scene),
      composition: asString(raw?.visualConcept?.composition),
      lighting: asString(raw?.visualConcept?.lighting),
      palette: asString(raw?.visualConcept?.palette),
      typography: asString(raw?.visualConcept?.typography),
      overlays,
      doNotDo,
    },
    adaptations,
  };
}

export function normalizeAdCreativeV1Output(params: {
  raw: unknown;
  language?: string;
  aspectRatios: AspectRatio[];
}): AdCreativeV1Output {
  const { raw, language, aspectRatios } = params;
  const resolved = resolveOutputLanguage(language);
  const ratios = safeAspectRatios(aspectRatios);

  const anglesRaw = (raw as any)?.angles;
  const anglesArr = Array.isArray(anglesRaw) ? anglesRaw : [];
  const angles = anglesArr.slice(0, 5).map((a, i) => normalizeAngle(a, i, ratios));

  return {
    language: { code: resolved.code, label: resolved.label },
    aspectRatios: ratios,
    angles,
  };
}

export function buildAdCreativeV1Prompts(params: {
  input: AdCreativeV1Input;
  brandIdentityAddendumEn?: string;
  memoryBlock?: string;
}): {
  system: string;
  user: string;
  resolvedLanguageLabel: string;
} {
  const input = params.input;
  const { label: targetLang } = resolveOutputLanguage(input.language);

  const ratios = safeAspectRatios(input.aspectRatios);
  const ctaHint =
    typeof input.callToAction === "string" && input.callToAction.trim()
      ? input.callToAction.trim()
      : "";
  const styleHint =
    typeof input.styleDirection === "string" && input.styleDirection.trim()
      ? input.styleDirection.trim()
      : "";

  const system = `${outputLanguageContract(targetLang)}

You are a senior performance creative strategist and direct-response copywriter.
Return ONLY valid JSON (no markdown, no commentary).

OUTPUT LANGUAGE:
- All strings in the JSON MUST be entirely in ${targetLang}.

${params.brandIdentityAddendumEn ? `\n${params.brandIdentityAddendumEn}\n` : ""}

${params.memoryBlock ? `\nPAST BRAND MEMORY (use as subtle guidance; do not copy verbatim):\n${params.memoryBlock}\n` : ""}

GOAL:
Generate 3–5 distinct ad angles/hooks for a static ad campaign.
For each angle, produce copy variants + a textual visual concept + per-aspect-ratio adaptation notes.

ASPECT RATIOS:
- Only generate adaptation notes for: ${ratios.join(", ")}.

STRICT JSON SHAPE:
{
  "angles": [
    {
      "id": "angle_1",
      "hook": "One-sentence hook / angle",
      "headlines": ["...", "..."],
      "primaryTexts": ["...", "..."],
      "ctas": ["...", "..."],
      "visualConcept": {
        "subject": "What is shown",
        "scene": "Where/when the scene takes place",
        "composition": "Framing, focus, layout, negative space",
        "lighting": "Lighting description",
        "palette": "Color palette guidance",
        "typography": "Font/typographic direction",
        "overlays": ["On-image text overlays (short)"],
        "doNotDo": ["What to avoid (brand safety / claims / visuals)"]
      },
      "adaptations": {
        "1:1": ["..."],
        "4:5": ["..."],
        "9:16": ["..."]
      }
    }
  ]
}

COPY RULES:
- Headlines: 4–9 words each (2–5 variants).
- Primary text: 1–3 short sentences each (2–5 variants).
- CTAs: 2–6 words each (2–5 variants).
- Avoid unverifiable claims. No medical/financial promises. No all-caps spam.
- Keep it ad-ready (clear offer, clear audience, clear benefit).

If information is missing, make reasonable assumptions but keep them conservative.`;

  const user = `INPUT:
Product: ${input.productName}
Brand: ${input.brandName}
Target audience: ${input.targetAudience}
Offer summary: ${input.offerSummary}
Landing page URL (optional): ${input.landingPageUrl ?? ""}
Source image URL (optional): ${input.sourceImageUrl ?? ""}
Style direction (optional): ${styleHint}
Preferred CTA (optional): ${ctaHint}
Aspect ratios: ${ratios.join(", ")}`;

  return { system, user, resolvedLanguageLabel: targetLang };
}

