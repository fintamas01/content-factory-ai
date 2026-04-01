import { stripHtmlForAnalysis } from "@/lib/products/product-health";

/** Fast 0–100 score without LLM — for sorting and dashboard counts. */
export function heuristicListingScore(input: {
  name: string;
  description?: string;
  short_description?: string;
}): number {
  const title = (input.name ?? "").trim();
  const shortRaw = (input.short_description ?? "").trim();
  const longPlain = stripHtmlForAnalysis(input.description ?? "");
  const words = longPlain.split(/\s+/).filter(Boolean).length;
  const shortPlain = stripHtmlForAnalysis(shortRaw);
  const shortLen = shortPlain.length;

  let score = 100;

  if (title.length < 8) score -= 18;
  else if (title.length < 16) score -= 8;

  if (words < 25) score -= 28;
  else if (words < 55) score -= 14;
  else if (words < 90) score -= 6;

  if (shortLen === 0) score -= 22;
  else if (shortLen < 40) score -= 12;
  else if (shortLen < 80) score -= 4;

  if (longPlain.length > 0 && !shortPlain) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isWeakShortDescription(short?: string): boolean {
  const s = stripHtmlForAnalysis(short ?? "");
  return s.length > 0 && s.length < 50;
}

export function needsOptimizationHeuristic(input: {
  name: string;
  description?: string;
  short_description?: string;
}): boolean {
  return heuristicListingScore(input) < 72;
}
