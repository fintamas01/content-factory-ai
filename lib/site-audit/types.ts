export type AuditIssuePriority = "high" | "medium" | "low";

export interface GrowthAuditIssue {
  title: string;
  description: string;
  priority: AuditIssuePriority;
}

/** Likelihood an AI assistant (e.g. ChatGPT-style) would recommend or clearly cite this business from this page alone. */
export interface AiDiscoverability {
  score: number;
  /** Short headline, e.g. "Moderate — citeable with caveats" */
  verdict: string;
  /** Why: entity clarity, specificity, trust cues in copy, etc. */
  explanation: string;
}

export interface ConversionBlockerItem {
  blocker: string;
  detail: string;
}

/** Inferred vs category norms — no live competitor crawl in MVP. */
export interface ContentGapVsCompetitorsItem {
  gap: string;
  /** What strong peers in this space typically surface (inferred). */
  competitor_norm: string;
  suggestion: string;
}

export interface GrowthAuditReport {
  summary: string;
  seo_score: number;
  ai_readiness_score: number;
  conversion_score: number;
  issues: GrowthAuditIssue[];
  quick_wins: string[];
  content_suggestions: string[];
  ai_discoverability: AiDiscoverability;
  conversion_blockers: ConversionBlockerItem[];
  trust_signals_missing: string[];
  content_gaps_vs_competitors: ContentGapVsCompetitorsItem[];
}

export interface ExtractedPageSignals {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
}
