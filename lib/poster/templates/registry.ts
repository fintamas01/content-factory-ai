import { IG_POST_1 } from "@/lib/poster/templates/ig-post-1";
import { IG_POST_2 } from "@/lib/poster/templates/ig-post-2";
import { IG_POST_3 } from "@/lib/poster/templates/ig-post-3";
import { IG_POST_4 } from "@/lib/poster/templates/ig-post-4";
import { IG_POST_5 } from "@/lib/poster/templates/ig-post-5";
import { IG_POST_6 } from "@/lib/poster/templates/ig-post-6";
import { IG_POST_7 } from "@/lib/poster/templates/ig-post-7";
import { IG_POST_8 } from "@/lib/poster/templates/ig-post-8";
import { IG_POST_9 } from "@/lib/poster/templates/ig-post-9";
import { IG_POST_10 } from "@/lib/poster/templates/ig-post-10";

export type PosterTemplate = typeof IG_POST_1;

export const POSTER_TEMPLATES = [
  IG_POST_1,
  IG_POST_2,
  IG_POST_3,
  IG_POST_4,
  IG_POST_5,
  IG_POST_6,
  IG_POST_7,
  IG_POST_8,
  IG_POST_9,
  IG_POST_10,
] as const;

export function getTemplateById(id?: string | null) {
  if (!id) return POSTER_TEMPLATES[0];
  return POSTER_TEMPLATES.find((t) => t.id === id) ?? POSTER_TEMPLATES[0];
}