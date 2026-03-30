import { buildCompactAuditInput } from "./compactContext";
import type { WebsiteExtractPayload } from "./types";
import { analyzeAIVisibility } from "./analyzeAIVisibility";
import { analyzeContentGaps } from "./analyzeContentGaps";
import { analyzeConversion } from "./analyzeConversion";
import { analyzeSEO } from "./analyzeSEO";
import { runBatchedSpecialistAnalysis } from "./batchSpecialists";
import type { PhaseBundle } from "./synthesizeReport";

/**
 * Runs specialist phases (2–5): one batched OpenAI call by default; on parse/network failure,
 * falls back to four parallel calls with the same compact page input (quality preserved).
 */
export async function runSpecialistPhases(
  extract: WebsiteExtractPayload
): Promise<
  Pick<PhaseBundle, "seo" | "aiVis" | "conversion" | "gaps">
> {
  const compact = buildCompactAuditInput(extract);

  const batched = await runBatchedSpecialistAnalysis(compact);
  if (batched.ok) {
    return batched.results;
  }

  console.warn("[site-audit] Batched specialists failed, using parallel fallback:", batched.error);

  const compactPayload = compact as unknown as WebsiteExtractPayload;

  const [seo, aiVis, conversion, gaps] = await Promise.all([
    analyzeSEO(compactPayload),
    analyzeAIVisibility(compactPayload),
    analyzeConversion(compactPayload),
    analyzeContentGaps(compactPayload),
  ]);

  return { seo, aiVis, conversion, gaps };
}
