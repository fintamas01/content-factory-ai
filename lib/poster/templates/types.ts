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
  fontFamily?: string;
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

export type PosterLogoLayer = {
  id: string;
  type: "logo";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
};

export type PosterLayer = PosterRectLayer | PosterTextLayer | PosterLogoLayer;

export type PosterTemplate = {
  id: string;
  name: string;
  platform: "instagram_post";
  width: number;
  height: number;
  layers: PosterLayer[];
};