import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_2: PosterTemplate = {
  id: "ig-post-2",
  name: "Bold Split Title (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    { id: "bg", type: "rect", x: 0, y: 0, width: 1080, height: 1080, color: "primary" },

    // Top bar
    { id: "bar", type: "rect", x: 80, y: 90, width: 920, height: 18, color: "accent", cornerRadius: 10, opacity: 0.9 },

    // Card
    { id: "card", type: "rect", x: 80, y: 140, width: 920, height: 860, color: "secondary", cornerRadius: 32, opacity: 0.92 },

    { id: "logo", type: "logo", x: 120, y: 190, width: 120, height: 120 },

    // Headline (big)
    { id: "headline", type: "text", x: 120, y: 360, width: 840, text: "AI Agent-ek 2026-ban", fontSize: 72, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.05 },

    // Subtitle
    { id: "sub", type: "text", x: 120, y: 540, width: 840, text: "3 trend, ami átírja a marketinget: autonóm workflow, RAG memória, self-critique loop.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.3 },

    // CTA pill
    { id: "ctaPill", type: "rect", x: 120, y: 860, width: 520, height: 74, color: "accent", cornerRadius: 40, opacity: 0.22 },
    { id: "cta", type: "text", x: 150, y: 882, width: 740, text: "👉 Kérj demót / Próbáld ki a ContentFactory-t", fontSize: 30, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};