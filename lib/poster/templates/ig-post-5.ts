import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_5: PosterTemplate = {
  id: "ig-post-5",
  name: "Left Rail + Content (IG Post)",
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
      angle: 90,
      colorStops: [
        { offset: 0, color: "primary" },
        { offset: 0.5, color: "secondary" },
        { offset: 1, color: "primary" },
      ],
      opacity: 1,
    },

    // Decorative blob behind the left rail
    {
      id: "blob-rail",
      type: "ellipse",
      x: 120,
      y: 280,
      radiusX: 220,
      radiusY: 220,
      color: "accent",
      opacity: 0.16,
    },

    // Main card
    {
      id: "card",
      type: "rect",
      x: 70,
      y: 90,
      width: 940,
      height: 900,
      color: "secondary",
      cornerRadius: 40,
      opacity: 0.92,
    },

    // Left rail accent
    {
      id: "rail",
      type: "rect",
      x: 70,
      y: 90,
      width: 60,
      height: 900,
      color: "accent",
      cornerRadius: 40,
      opacity: 0.18,
    },

    { id: "logo", type: "logo", x: 160, y: 150, width: 130, height: 130, opacity: 1 },

    { id: "headline", type: "text", x: 160, y: 320, width: 820, text: "AI Agent-ek 2026-ban", fontSize: 66, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.05 },

    { id: "sub", type: "text", x: 160, y: 480, width: 800, text: "Autonóm workflow • memória • self-critique. Ez lesz a következő marketing stack.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.4 },

    { id: "cta", type: "text", x: 160, y: 875, width: 820, text: "Csatlakozz most!", fontSize: 36, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};