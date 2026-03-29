export type AuditIssuePriority = "high" | "medium" | "low";

export interface GrowthAuditScores {
  seo: number;
  ai_discoverability: number;
  conversion: number;
}

export interface GrowthAuditTopIssue {
  title: string;
  impact: string;
  fix: string;
  priority: AuditIssuePriority;
}

export interface GrowthAuditQuickWin {
  action: string;
  expected_result: string;
}

export interface GrowthAuditContentOpportunity {
  idea: string;
  why_it_works: string;
}

export interface GrowthAuditAiVisibility {
  would_ai_recommend: boolean;
  reason: string;
  improvement: string;
}

export interface GrowthAuditReport {
  summary: string;
  scores: GrowthAuditScores;
  top_issues: GrowthAuditTopIssue[];
  quick_wins: GrowthAuditQuickWin[];
  content_opportunities: GrowthAuditContentOpportunity[];
  ai_visibility: GrowthAuditAiVisibility;
}

export interface ExtractedPageSignals {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
}
