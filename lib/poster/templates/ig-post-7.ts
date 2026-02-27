import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_7: PosterTemplate = {
  id: "ig-post-7",
  name: "Corner Logo + Framed Text (IG Post)",
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
        { offset: 1, color: "secondary" },
      ],
      opacity: 1,
    },

    // Decorative blob to support the framed layout
    {
      id: "blob-frame",
      type: "ellipse",
      x: 880,
      y: 260,
      radiusX: 260,
      radiusY: 180,
      color: "accent",
      opacity: 0.14,
    },

    // Frame
    {
      id: "frame",
      type: "rect",
      x: 80,
      y: 80,
      width: 920,
      height: 920,
      color: "secondary",
      cornerRadius: 44,
      opacity: 0.75,
    },

    // Inner panel
    {
      id: "panel",
      type: "rect",
      x: 120,
      y: 140,
      width: 840,
      height: 800,
      color: "secondary",
      cornerRadius: 40,
      opacity: 0.92,
    },

    { id: "logo", type: "logo", x: 140, y: 160, width: 110, height: 110, opacity: 1 },

    {
      id: "headline",
      type: "text",
      x: 140,
      y: 330,
      width: 800,
      text: "AI Agent-ek 2026-ban",
      fontSize: 68,
      fontStyle: "bold",
      color: "#EAF0FF",
      lineHeight: 1.06,
    },

    {
      id: "sub",
      type: "text",
      x: 140,
      y: 500,
      width: 800,
      text: "Sablonok + AI copy + export: poszt 1 gombnyomásra.",
      fontSize: 30,
      fontStyle: "normal",
      color: "#B8C4E6",
      lineHeight: 1.35,
    },

    {
      id: "cta",
      type: "text",
      x: 140,
      y: 850,
      width: 800,
      text: "Csatlakozz most!",
      fontSize: 36,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1.2,
    },
  ],
};