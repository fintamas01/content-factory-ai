export type PosterTextLayer = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  text: string;
  fontSize: number;
  fontStyle?: "normal" | "bold";
  color: "primary" | "secondary" | "accent" | string;
  lineHeight?: number;

  // opcionális: ha később role alapján akarsz fontot választani
  role?: "headline" | "body" | "cta" | string;
  fontFamily?: string;
  opacity?: number;
};

export type PosterRectLayer = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: "primary" | "secondary" | "accent" | string;
  cornerRadius?: number;
  opacity?: number;
};

/**
 * ✅ ÚJ: Image layer (háttérkép / fotó)
 * - fit: "cover" => kitölti a keretet, levágással
 * - fit: "contain" => teljes kép látszik, üres sávokkal
 */
export type PosterImageLayer = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  fit?: "cover" | "contain";

  /**
   * Ha több képet is támogatnál:
   * - srcKey: "bg" | "photo1" | ...
   * Most elég a "bg" (háttér).
   */
  srcKey?: "bg" | string;

  // opcionális: kerekítés
  cornerRadius?: number;
};

export type PosterLogoLayer = {
  id: string;
  type: "logo";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
};

export type PosterLayer =
  | PosterRectLayer
  | PosterTextLayer
  | PosterLogoLayer
  | PosterImageLayer;

export type PosterTemplate = {
  id: string;
  name: string;
  platform: "instagram_post";
  width: number;
  height: number;
  layers: PosterLayer[];
};