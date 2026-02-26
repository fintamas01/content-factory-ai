import { IG_POST_1 } from "@/lib/poster/templates/ig-post-1";

// Ha lesz több template: import { IG_POST_2 } ... stb.

export type PosterTemplate = typeof IG_POST_1;

export const POSTER_TEMPLATES = [
  IG_POST_1,
  // IG_POST_2,
  // IG_STORY_1,
] as const;

export function getTemplateById(id?: string | null) {
  if (!id) return POSTER_TEMPLATES[0];
  return POSTER_TEMPLATES.find((t) => t.id === id) ?? POSTER_TEMPLATES[0];
}