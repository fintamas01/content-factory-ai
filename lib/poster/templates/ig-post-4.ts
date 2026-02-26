import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_4: PosterTemplate = {
  id: "ig-post-4",
  name: "Offer Badge (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    { id: "bg", type: "rect", x: 0, y: 0, width: 1080, height: 1080, color: "primary" },

    // Large card
    { id: "card", type: "rect", x: 70, y: 110, width: 940, height: 860, color: "secondary", cornerRadius: 36, opacity: 0.92 },

    // Badge
    { id: "badge", type: "rect", x: 70, y: 110, width: 280, height: 84, color: "accent", cornerRadius: 28, opacity: 0.22 },
    { id: "badgeText", type: "text", x: 100, y: 134, width: 260, text: "ÚJ FUNKCIÓ", fontSize: 28, fontStyle: "bold", color: "accent", lineHeight: 1.1 },

    { id: "logo", type: "logo", x: 860, y: 150, width: 110, height: 110 },

    { id: "headline", type: "text", x: 120, y: 300, width: 840, text: "AI Agent-ek 2026-ban", fontSize: 68, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.06 },

    { id: "sub", type: "text", x: 120, y: 470, width: 820, text: "Készülj fel: automatizált kampányok, többnyelvű posztok és okos sablonok.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.35 },

    { id: "cta", type: "text", x: 120, y: 860, width: 840, text: "👉 Próbáld ki — 1 perc alatt kész poszt", fontSize: 34, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};