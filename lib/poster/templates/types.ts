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

  // opcionális: kerekítés vagy kör kivágás
  cornerRadius?: number;
  /** "circle" => képet körbe vágja (pl. event plakátok) */
  clip?: "circle";
};

/** Gradient háttér (pl. event / career fair stílus) */
export type PosterGradientLayer = {
  id: string;
  type: "gradient";
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 = bal→jobb, 90 = fent→lent */
  angle?: number;
  colorStops: Array<{ offset: number; color: "primary" | "secondary" | "accent" | string }>;
  opacity?: number;
};

/** Dekoratív ellipszis / blob (pl. hullámok, formák) */
export type PosterEllipseLayer = {
  id: string;
  type: "ellipse";
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  color: "primary" | "secondary" | "accent" | string;
  opacity?: number;
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
  | PosterImageLayer
  | PosterGradientLayer
  | PosterEllipseLayer;

export type PosterTemplate = {
  id: string;
  name: string;
  platform: "instagram_post";
  width: number;
  height: number;
  layers: PosterLayer[];
};