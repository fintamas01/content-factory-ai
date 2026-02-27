import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_9: PosterTemplate = {
  id: "ig-post-9",
  name: "Clean Quote Style (IG Post)",
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
        { offset: 0.6, color: "secondary" },
        { offset: 1, color: "primary" },
      ],
      opacity: 1,
    },

    // Decorative ellipse behind the quote card
    {
      id: "blob-quote",
      type: "ellipse",
      x: 900,
      y: 320,
      radiusX: 260,
      radiusY: 180,
      color: "accent",
      opacity: 0.16,
    },

    {
      id: "card",
      type: "rect",
      x: 90,
      y: 140,
      width: 900,
      height: 800,
      color: "secondary",
      cornerRadius: 44,
      opacity: 0.9,
    },

    { id: "logo", type: "logo", x: 140, y: 190, width: 110, height: 110, opacity: 1 },

    // Big quote mark
    {
      id: "quote",
      type: "text",
      x: 140,
      y: 320,
      width: 200,
      text: "“",
      fontSize: 130,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1,
    },

    {
      id: "headline",
      type: "text",
      x: 210,
      y: 350,
      width: 760,
      text: "AI Agent-ek 2026-ban",
      fontSize: 62,
      fontStyle: "bold",
      color: "#EAF0FF",
      lineHeight: 1.1,
    },

    {
      id: "sub",
      type: "text",
      x: 140,
      y: 520,
      width: 840,
      text: "Aki automatizál, az skáláz. Aki memóriát ad, az stabilitást nyer.",
      fontSize: 34,
      fontStyle: "normal",
      color: "#B8C4E6",
      lineHeight: 1.35,
    },

    {
      id: "cta",
      type: "text",
      x: 140,
      y: 850,
      width: 840,
      text: "Csatlakozz most!",
      fontSize: 36,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1.2,
    },
  ],
};