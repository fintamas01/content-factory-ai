import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_2: PosterTemplate = {
  id: "ig-post-2",
  name: "Bold Split Title (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    // Gradient background with subtle diagonal split
    {
      id: "bg",
      type: "gradient",
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      angle: 120,
      colorStops: [
        { offset: 0, color: "primary" },
        { offset: 0.55, color: "secondary" },
        { offset: 1, color: "primary" },
      ],
      opacity: 1,
    },

    // Decorative blobs echoing the top bar accent
    {
      id: "blob-top",
      type: "ellipse",
      x: 540,
      y: 120,
      radiusX: 420,
      radiusY: 90,
      color: "accent",
      opacity: 0.18,
    },
    {
      id: "blob-side",
      type: "ellipse",
      x: 960,
      y: 420,
      radiusX: 220,
      radiusY: 180,
      color: "accent",
      opacity: 0.14,
    },

    // Card
    {
      id: "card",
      type: "rect",
      x: 80,
      y: 140,
      width: 920,
      height: 860,
      color: "secondary",
      cornerRadius: 32,
      opacity: 0.94,
    },

    // Accent bar at the top of the card
    {
      id: "bar",
      type: "rect",
      x: 80,
      y: 90,
      width: 920,
      height: 18,
      color: "accent",
      cornerRadius: 10,
      opacity: 0.9,
    },

    // Logo
    {
      id: "logo",
      type: "logo",
      x: 120,
      y: 190,
      width: 120,
      height: 120,
      opacity: 1,
    },

    // Left column text
    {
      id: "headline",
      type: "text",
      x: 120,
      y: 360,
      width: 840,
      text: "AI Agent-ek 2026-ban",
      fontSize: 72,
      fontStyle: "bold",
      color: "#EAF0FF",
      lineHeight: 1.05,
    },
    {
      id: "sub",
      type: "text",
      x: 120,
      y: 540,
      width: 840,
      text: "3 trend, ami átírja a marketinget: autonóm workflow, RAG memória, self-critique loop.",
      fontSize: 30,
      fontStyle: "normal",
      color: "#B8C4E6",
      lineHeight: 1.3,
    },

    // CTA pill (accent-colored) + text
    {
      id: "ctaPill",
      type: "rect",
      x: 120,
      y: 860,
      width: 520,
      height: 74,
      color: "accent",
      cornerRadius: 40,
      opacity: 0.22,
    },
    {
      id: "cta",
      type: "text",
      x: 150,
      y: 882,
      width: 740,
      text: "👉 Kérj demót / Próbáld ki a ContentFactory-t",
      fontSize: 30,
      fontStyle: "bold",
      color: "accent",
      lineHeight: 1.2,
    },
  ],
};