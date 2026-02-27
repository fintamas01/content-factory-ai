import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_10: PosterTemplate = {
  id: "ig-post-10",
  name: "Simple Product Banner (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    // Gradient background
    {
      id: "bg",
      type: "gradient",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      angle: 135,
      colorStops: [
        { offset: 0, color: "primary" },
        { offset: 0.5, color: "secondary" },
        { offset: 1, color: "primary" },
      ],
      opacity: 1,
    },

    {
      id: "card",
      type: "rect",
      x: 70,
      y: 120,
      width: 940,
      height: 840,
      color: "secondary",
      cornerRadius: 42,
      opacity: 0.92,
    },

    // Decorative ellipse behind right visual block
    {
      id: "blob-visual",
      type: "ellipse",
      x: 850,
      y: 260,
      radiusX: 260,
      radiusY: 200,
      color: "accent",
      opacity: 0.16,
    },

    // Right “visual” placeholder block (for later image support)
    {
      id: "visual",
      type: "rect",
      x: 650,
      y: 170,
      width: 300,
      height: 300,
      color: "accent",
      cornerRadius: 34,
      opacity: 0.15,
    },

    { id: "logo", type: "logo", x: 120, y: 170, width: 120, height: 120, opacity: 1 },

    {
      id: "headline",
      type: "text",
      x: 120,
      y: 340,
      width: 500,
      text: "AI Agent-ek 2026-ban",
      fontSize: 62,
      fontStyle: "bold",
      color: "#EAF0FF",
      lineHeight: 1.08,
    },

    {
      id: "sub",
      type: "text",
      x: 120,
      y: 510,
      width: 520,
      text: "Tervezz kampányt sablonból, és töltsd ki AI-jal.",
      fontSize: 30,
      fontStyle: "normal",
      color: "#B8C4E6",
      lineHeight: 1.35,
    },

    {
      id: "cta",
      type: "text",
      x: 120,
      y: 860,
      width: 840,
      text: "👉 Indíts most",
      fontSize: 38,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1.2,
    },
  ],
};