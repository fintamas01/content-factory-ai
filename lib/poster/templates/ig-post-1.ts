export type PosterTextLayer = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  text: string;
  fontSize: number;
  fontStyle?: "normal" | "bold";
  // ✅ token vagy hex:
  color: "primary" | "secondary" | "accent" | string;
  lineHeight?: number;
};

export type PosterRectLayer = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  // ✅ token vagy hex:
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

export const IG_POST_1: PosterTemplate = {
  id: "ig-post-1",
  name: "Clean Gradient Promo (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    // ✅ tokenek
    { id: "bg", type: "rect", x: 0, y: 0, width: 1080, height: 1080, color: "primary" },
    { id: "card", type: "rect", x: 80, y: 120, width: 920, height: 840, color: "secondary", cornerRadius: 28, opacity: 0.95 },

    { id: "logo", type: "logo", x: 120, y: 170, width: 140, height: 140 },

    // ✅ a headline/sub maradhat fix fehér/kékes, vagy kötheted accenthez is
    { id: "headline", type: "text", x: 120, y: 340, width: 840, text: "AI Agent-ek 2026-ban", fontSize: 64, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.1 },
    { id: "sub", type: "text", x: 120, y: 480, width: 840, text: "3 trend, ami átírja a marketinget: autonóm workflow, RAG memória, self-critique loop.", fontSize: 32, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.25 },

    // ✅ CTA az accent színhez kötve -> pickerre reagál
    { id: "cta", type: "text", x: 120, y: 820, width: 840, text: "👉 Kérj demót / Próbáld ki a ContentFactory-t", fontSize: 34, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};