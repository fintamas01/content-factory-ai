import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_8: PosterTemplate = {
  id: "ig-post-8",
  name: "Two Blocks Layout (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    { id: "bg", type: "rect", x: 0, y: 0, width: 1080, height: 1080, color: "primary" },

    // Top block
    { id: "top", type: "rect", x: 90, y: 110, width: 900, height: 520, color: "secondary", cornerRadius: 40, opacity: 0.9 },

    // Bottom block
    { id: "bottom", type: "rect", x: 90, y: 670, width: 900, height: 300, color: "secondary", cornerRadius: 40, opacity: 0.75 },

    { id: "logo", type: "logo", x: 130, y: 150, width: 120, height: 120 },

    { id: "headline", type: "text", x: 130, y: 320, width: 820, text: "AI Agent-ek 2026-ban", fontSize: 70, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.05 },

    { id: "sub", type: "text", x: 130, y: 470, width: 820, text: "Gyorsabb kampányok. Kevesebb kézi munka. Több konzisztencia.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.35 },

    { id: "cta", type: "text", x: 130, y: 770, width: 820, text: "👉 Próbáld ki 7 napig", fontSize: 38, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};