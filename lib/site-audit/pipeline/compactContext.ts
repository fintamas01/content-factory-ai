import type { WebsiteExtractPayload } from "./types";

/**
 * Single source of truth for how much page text we send to models.
 * Keeps input tokens predictable and avoids duplicating huge blobs per phase.
 */
export const AUDIT_TEXT_SAMPLE_MAX = 5000;
export const AUDIT_H1_MAX = 8;
export const AUDIT_H2_MAX = 15;

/** Narrowed extract shared by batched + per-phase calls + synthesis. */
export type CompactAuditInput = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  textSample: string;
};

export function buildCompactAuditInput(
  extract: WebsiteExtractPayload
): CompactAuditInput {
  return {
    url: extract.url,
    title: extract.title,
    metaDescription: extract.metaDescription,
    h1: extract.h1.slice(0, AUDIT_H1_MAX),
    h2: extract.h2.slice(0, AUDIT_H2_MAX),
    textSample: extract.textSample.slice(0, AUDIT_TEXT_SAMPLE_MAX),
  };
}

/** One JSON blob for the user message (same string reused conceptually across phases). */
export function serializeAuditPageInput(input: CompactAuditInput): string {
  return JSON.stringify(input);
}
