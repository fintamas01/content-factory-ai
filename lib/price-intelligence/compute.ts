/** Competitor vs own: positive % means competitor is more expensive. */
export function computeDifferencePct(
  ownPrice: number | null,
  competitorPrice: number | null
): number | null {
  if (ownPrice == null || competitorPrice == null) return null;
  if (!Number.isFinite(ownPrice) || !Number.isFinite(competitorPrice)) return null;
  if (ownPrice <= 0) return null;
  return ((competitorPrice - ownPrice) / ownPrice) * 100;
}
