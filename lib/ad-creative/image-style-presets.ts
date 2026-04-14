export type ImageStylePresetKey =
  | "iphone_ugc"
  | "dslr_product_photo"
  | "luxury_brand"
  | "natural_lifestyle"
  | "minimal_studio";

export type ImageStylePreset = {
  key: ImageStylePresetKey;
  label: string;
  lighting: string;
  camera: string;
  colorGrading: string;
  composition: string;
  negative: string[];
};

export const IMAGE_STYLE_PRESETS: Record<ImageStylePresetKey, ImageStylePreset> = {
  iphone_ugc: {
    key: "iphone_ugc",
    label: "iPhone UGC",
    lighting: "available light, real indoor/outdoor lighting, natural falloff, imperfect but believable exposure",
    camera:
      "shot on iPhone (recent model), 24–26mm equivalent wide camera, slight rolling shutter possibility, realistic HDR (not overprocessed)",
    colorGrading: "natural phone-camera color, mild contrast, realistic skin tones, no teal/orange grade",
    composition:
      "handheld framing, authentic user perspective, slight tilt OK, subject centered with casual negative space",
    negative: ["overly cinematic grading", "studio perfection", "fake bokeh", "hyper-sharp AI micro-detail"],
  },
  dslr_product_photo: {
    key: "dslr_product_photo",
    label: "DSLR product photo",
    lighting: "controlled softbox/key + fill, product-focused highlights, clean shadow definition",
    camera: "full-frame DSLR/mirrorless, 50–85mm prime, tack-sharp subject, shallow-but-realistic depth of field",
    colorGrading: "neutral commercial grade, accurate product colors, clean whites, no stylized tint",
    composition:
      "classic product hero framing, clean background separation, deliberate negative space for overlay (no text)",
    negative: ["phone-camera artifacts", "overly shallow DOF", "CGI-like perfect reflections"],
  },
  luxury_brand: {
    key: "luxury_brand",
    label: "Luxury brand",
    lighting: "premium editorial lighting, soft directional key, controlled specular highlights, deep but clean shadows",
    camera: "high-end full-frame camera, 50mm/85mm prime, crisp details, elegant falloff",
    colorGrading: "subtle filmic grade, rich blacks, restrained saturation, premium tonality",
    composition:
      "editorial composition, strong negative space, tasteful asymmetry, minimal props, refined background texture",
    negative: ["oversaturated colors", "cheap-looking gloss", "busy background clutter"],
  },
  natural_lifestyle: {
    key: "natural_lifestyle",
    label: "Natural lifestyle",
    lighting: "real daylight, window light, golden hour optional, believable bounce light",
    camera: "mirrorless camera, 35mm/50mm, candid feel, natural motion blur where appropriate",
    colorGrading: "warm natural grade, realistic skin tones, gentle contrast, no heavy LUT look",
    composition:
      "candid lifestyle framing, product integrated naturally, environment feels real and lived-in, avoid staged symmetry",
    negative: ["overly staged studio look", "plastic textures", "uncanny perfection"],
  },
  minimal_studio: {
    key: "minimal_studio",
    label: "Minimal studio",
    lighting: "clean studio key + soft fill, gentle gradients, controlled reflections, shadow softness dialed in",
    camera: "full-frame, 70mm/85mm, clean perspective, minimal distortion",
    colorGrading: "neutral minimal grade, clean whites/greys, accurate materials, low saturation",
    composition:
      "minimalist tabletop composition, lots of negative space, simple geometry, no clutter, premium restraint",
    negative: ["busy props", "overly complex scene", "CGI-like edges"],
  },
};

export function getImageStylePreset(key?: string | null): ImageStylePreset | null {
  const k = typeof key === "string" ? (key.trim() as ImageStylePresetKey) : null;
  if (!k) return null;
  return (IMAGE_STYLE_PRESETS as any)[k] ?? null;
}

