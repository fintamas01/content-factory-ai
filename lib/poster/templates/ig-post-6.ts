import type { PosterTemplate } from "@/lib/poster/templates/types";

export const IG_POST_6: PosterTemplate = {
  id: "ig-post-6",
  name: "Big Headline + Footer (IG Post)",
  platform: "instagram_post",
  width: 1080,
  height: 1080,
  layers: [
    { id: "bg", type: "rect", x: 0, y: 0, width: 1080, height: 1080, color: "primary" },

    // Top card
    { id: "card", type: "rect", x: 90, y: 120, width: 900, height: 720, color: "secondary", cornerRadius: 40, opacity: 0.9 },

    { id: "logo", type: "logo", x: 140, y: 170, width: 120, height: 120 },

    { id: "headline", type: "text", x: 140, y: 330, width: 800, text: "AI Agent-ek 2026-ban", fontSize: 76, fontStyle: "bold", color: "#EAF0FF", lineHeight: 1.02 },

    { id: "sub", type: "text", x: 140, y: 520, width: 800, text: "Ha a kampánygyártás lassú: itt az autonóm megoldás.", fontSize: 30, fontStyle: "normal", color: "#B8C4E6", lineHeight: 1.35 },

    // Footer
    { id: "footer", type: "rect", x: 90, y: 870, width: 900, height: 120, color: "accent", cornerRadius: 34, opacity: 0.18 },
    { id: "cta", type: "text", x: 140, y: 905, width: 820, text: "👉 Kérj demót / Próbáld ki a ContentFactory-t", fontSize: 34, fontStyle: "bold", color: "accent", lineHeight: 1.2 },
  ],
};