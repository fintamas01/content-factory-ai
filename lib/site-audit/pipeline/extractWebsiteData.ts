import { fetchAndExtractPage } from "@/lib/site-audit/extract";
import type { WebsiteExtractPayload } from "./types";

/**
 * Phase 1: fetch HTML and structure clean JSON for downstream analysis.
 * Reuses existing extraction logic (no duplicate fetch/parsing).
 */
export async function extractWebsiteData(
  targetUrl: string
): Promise<
  | { ok: true; data: WebsiteExtractPayload }
  | { ok: false; error: string; status?: number }
> {
  const extracted = await fetchAndExtractPage(targetUrl);
  if (!extracted.ok) {
    return { ok: false, error: extracted.error, status: extracted.status };
  }
  return { ok: true, data: extracted.signals };
}
