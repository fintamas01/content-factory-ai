export type AuditScorePillarKey = "seo" | "ai_discoverability" | "conversion";

export type AuditProgressComparison = {
  hasPrevious: boolean;
  previousRunAt: string | null;
  previousRunId: string | null;
  deltas: Record<AuditScorePillarKey, number>;
  previousScores: Record<AuditScorePillarKey, number> | null;
  currentScores: Record<AuditScorePillarKey, number>;
  aiBandPrevious: string;
  aiBandCurrent: string;
  /** Issue titles no longer in top list (treated as addressed). */
  resolvedIssueTitles: string[];
  /** New or resurfaced issue titles vs previous run. */
  newIssueTitles: string[];
  /** Still present (title match). */
  ongoingIssueTitles: string[];
  summaryLines: string[];
};

export type ProductHealthProgressComparison = {
  hasPrevious: boolean;
  previousRunAt: string | null;
  previousGenerationId: string | null;
  scoreDelta: number;
  previousScore: number | null;
  currentScore: number;
  resolvedIssueTitles: string[];
  newIssueTitles: string[];
  ongoingIssueTitles: string[];
  summaryLines: string[];
};
