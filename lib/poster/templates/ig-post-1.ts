import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_1: PosterTemplate = {
  id: "ig-post-1",
  name: "Clean Gradient Promo (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    // Gradient background (primary → secondary)
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

    // Decorative blob behind the card (accent-tinted)
    {
      id: "blob-main",
      type: "ellipse",
      x: 720,
      y: 260,
      radiusX: 320,
      radiusY: 200,
      color: "accent",
      opacity: 0.18,
    },

    // Main content card
    {
      id: "card",
      type: "rect",
      x: 80,
      y: 120,
      width: 920,
      height: 840,
      color: "secondary",
      cornerRadius: 28,
      opacity: 0.96,
    },

    // Logo slot (top-left inside the card)
    {
      id: "logo",
      type: "logo",
      x: 120,
      y: 170,
      width: 140,
      height: 140,
      opacity: 1,
    },

    // Left column text block
    {
      id: "headline",
      type: "text",
      x: 120,
      y: 340,
      width: 840,
      text: "AI Agent-ek 2026-ban",
      fontSize: 64,
      fontStyle: "bold",
      color: "#EAF0FF",
      lineHeight: 1.1,
    },
    {
      id: "sub",
      type: "text",
      x: 120,
      y: 480,
      width: 840,
      text: "3 trend, ami átírja a marketinget: autonóm workflow, RAG memória, self-critique loop.",
      fontSize: 32,
      fontStyle: "normal",
      color: "#B8C4E6",
      lineHeight: 1.25,
    },

    // CTA text at the bottom of the card (accent-colored)
    {
      id: "cta",
      type: "text",
      x: 120,
      y: 820,
      width: 840,
      text: "👉 Kérj demót / Próbáld ki a ContentFactory-t",
      fontSize: 34,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1.2,
    },
  ],
};