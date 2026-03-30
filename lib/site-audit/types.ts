export type AuditIssuePriority = "high" | "medium" | "low";

export interface GrowthAuditScores {
  seo: number;
  ai_discoverability: number;
  conversion: number;
}

export interface GrowthAuditTopIssue {
  title: string;
  /** Plain-language diagnosis (what is wrong on the page). */
  explanation: string;
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
  /** How crawlers and LLMs likely interpret the page (entities, topic, trust). */
  how_systems_see_site: string;
  /** Specific on-page changes to improve AI-mediated discovery. */
  concrete_improvements: string[];
}

export interface GrowthAuditReport {
  summary: string;
  scores: GrowthAuditScores;
  top_issues: GrowthAuditTopIssue[];
  quick_wins: GrowthAuditQuickWin[];
  content_opportunities: GrowthAuditContentOpportunity[];
  ai_visibility: GrowthAuditAiVisibility;
}

/** Ready-to-paste output from POST /api/audit-fix */
export type AuditFixPackage = {
  /** How this change advances leads, revenue, or trust (mechanism + outcome). */
  conversion_impact: string;
  improved_text: string;
  /** Alternate copy blocks—different angle or funnel stage; empty if not applicable. */
  copy_variants: string[];
  seo_content_notes: string;
  meta_title: string;
  meta_description: string;
  /** A/B title tests (same page, different hooks). */
  meta_title_alternates: string[];
  headlines: string[];
  notes: string;
};

/** One row from POST /api/audit-content-plan */
export type AuditContentPlanDay = {
  day: number;
  content_idea: string;
  hook: string;
  caption: string;
};

/** Page context shared by audit agent APIs (matches site-audit response signals). */
export type AuditPageSignalsPayload = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h2Count: number;
};

export interface ExtractedPageSignals {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
}
