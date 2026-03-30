import type { ExtractedPageSignals } from "@/lib/site-audit/types";

/** Phase 1: structured payload passed to later phases (mirrors extract output). */
export type WebsiteExtractPayload = ExtractedPageSignals;

export type PhaseErr = { ok: false; phase: string; error: string };

export type SEOAnalysis = {
  seo_score: number;
  seo_issues: Array<{ title: string; detail: string }>;
  technical_observations: string;
  content_observations: string;
};

export type AIVisibilityAnalysis = {
  score: number;
  explanation: string;
  suggestions: string[];
};

export type ConversionAnalysis = {
  conversion_score: number;
  blockers: Array<{ title: string; detail: string }>;
  fixes: Array<{ action: string; expected_result: string }>;
};

export type ContentGapsAnalysis = {
  content_ideas: Array<{ idea: string; why_it_works: string }>;
  gaps: string[];
};
