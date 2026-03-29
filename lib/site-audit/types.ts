export type AuditIssuePriority = "high" | "medium" | "low";

export interface GrowthAuditIssue {
  title: string;
  description: string;
  priority: AuditIssuePriority;
}

export interface GrowthAuditReport {
  summary: string;
  seo_score: number;
  ai_readiness_score: number;
  conversion_score: number;
  issues: GrowthAuditIssue[];
  quick_wins: string[];
  content_suggestions: string[];
}

export interface ExtractedPageSignals {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
}
