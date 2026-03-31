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

export type GrowthAuditCompetitorIntelligence = {
  summary: string;
  competitor_advantages: Array<{
    competitor: string;
    advantage: string;
    why_it_matters: string;
    evidence?: {
      competitor_quotes?: string[];
      user_quotes?: string[];
    };
  }>;
  missing_opportunities: Array<{
    opportunity: string;
    why_missing_matters: string;
    what_to_ship: string;
  }>;
  content_gaps: Array<{
    topic: string;
    why_missing_matters: string;
    suggested_angle: string;
  }>;
  positioning_opportunities: Array<{
    idea: string;
    why_it_works: string;
  }>;
  cta_improvements: Array<{
    current_problem: string;
    suggested_rewrite: string;
    where_to_use: string;
    why_it_works: string;
  }>;
  messaging_swipes?: Array<{
    competitor: string;
    pattern: string;
    example: string;
  }>;
};

export type GrowthSprintTask = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimated_impact: string;
  effort: "low" | "medium" | "high";
};

export type GrowthSprintWeek = {
  week: number;
  theme: string;
  goal: string;
  tasks: GrowthSprintTask[];
};

export type GrowthSprintPlan = {
  summary: string;
  weeks: GrowthSprintWeek[];
  quickest_wins: Array<{ title: string; reason: string }>;
  highest_leverage_moves: Array<{ title: string; reason: string }>;
};

export interface GrowthAuditReport {
  summary: string;
  scores: GrowthAuditScores;
  top_issues: GrowthAuditTopIssue[];
  quick_wins: GrowthAuditQuickWin[];
  content_opportunities: GrowthAuditContentOpportunity[];
  ai_visibility: GrowthAuditAiVisibility;
  competitor_intelligence?: GrowthAuditCompetitorIntelligence;
  /** Optional saved 30-day sprint plan (generated on-demand). */
  growth_sprint?: GrowthSprintPlan;
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
  /** Best-effort guess from visible button/link text. */
  cta_guess?: string | null;
  /** Best-effort detected trust indicators from visible text. */
  trust_indicators?: string[];
  /** Best-effort topic patterns (frequent terms from headings/text). */
  topic_patterns?: string[];
}
