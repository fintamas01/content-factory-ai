import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_3: PosterTemplate = {
  id: "ig-post-3",
  name: "Minimal Centered (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    // Gradient background (minimal, centered composition)
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
        { offset: 1, color: "secondary" },
      ],
      opacity: 1,
    },

    // Subtle decorative blobs to frame the centered card
    {
      id: "blob-left",
      type: "ellipse",
      x: 180,
      y: 260,
      radiusX: 260,
      radiusY: 180,
      color: "accent",
      opacity: 0.12,
    },
    {
      id: "blob-right",
      type: "ellipse",
      x: 900,
      y: 860,
      radiusX: 260,
      radiusY: 180,
      color: "accent",
      opacity: 0.1,
    },

    // Center card
    {
      id: "card",
      type: "rect",
      x: 120,
      y: 160,
      width: 840,
      height: 760,
      color: "secondary",
      cornerRadius: 40,
      opacity: 0.9,
    },

    { id: "logo", type: "logo", x: 470, y: 220, width: 140, height: 140, opacity: 1 },

    { id: "headline", type: "text", x: 170, y: 410, width: 740, text: "AI Agent-ek 2026-ban", fontSize: 64, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.1 },

    { id: "sub", type: "text", x: 170, y: 540, width: 740, text: "Autonóm workflow + memória + önellenőrzés: így lesz gyorsabb a kampánygyártás.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.35 },

    { id: "cta", type: "text", x: 170, y: 820, width: 740, text: "Csatlakozz most!", fontSize: 34, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};