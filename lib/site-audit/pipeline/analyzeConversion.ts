import type { WebsiteExtractPayload } from "./types";
import {
  buildCompactAuditInput,
  serializeAuditPageInput,
} from "./compactContext";
import { callOpenAIJson } from "./shared";

const SYSTEM = `You are a senior conversion strategist (CRO + messaging). You audit ONE landing page from extracted text, headings, and meta only—no heatmaps, no analytics.

Your job: judge whether a motivated visitor would understand (1) what is being sold, (2) for whom, (3) why now, (4) what to do next—and whether trust and risk are addressed enough to act.

OUTPUT: Strictly valid JSON. No markdown.

{
  "conversion_score": number (0-100 integer),
  "blockers": [ { "title": "string", "detail": "string" } ],
  "fixes": [ { "action": "string", "expected_result": "string" } ]
}

SCORING (conversion_score): High when value prop, offer, and next step are obvious from headings + sample; proof (specificity, outcomes, credibility cues in text) supports the claim; friction objections are partially handled. Low when the visitor must guess the offer, the CTA path is unclear from copy, or trust is unsupported.

FOR EACH blockers[]:
- "title": Specific diagnosis (e.g. "No single primary outcome promised above the fold in headings").
- "detail": Explain WHY this kills conversion (cognitive load, ambiguity, trust gap, weak differentiation) and IMPACT (bounce, low lead quality, abandoned carts, unqualified calls)—grounded in the extract.

FOR EACH fixes[]:
- "action": Imperative, specific, doable on this page (rewrite H1 to X, add proof line naming Y, clarify single CTA path)—not "improve UX".
- "expected_result": Tie to a measurable or directional outcome (higher intent clicks, more qualified leads, fewer confused bounces).

If the extract is too short to judge CTA placement, say so and score conservatively. Never fabricate guarantees or social proof not present in the text.`;

export async function analyzeConversion(
  extract: WebsiteExtractPayload
): Promise<
  | { ok: true; data: import("./types").ConversionAnalysis }
  | { ok: false; error: string }
> {
  const ctx = buildCompactAuditInput(extract);
  const res = await callOpenAIJson({
    system: SYSTEM,
    user: serializeAuditPageInput(ctx),
    temperature: 0.35,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const o = res.parsed;
  if (!o || typeof o !== "object") return { ok: false, error: "Invalid conversion JSON." };
  const r = o as Record<string, unknown>;
  const conversion_score = Math.max(
    0,
    Math.min(100, Math.round(Number(r.conversion_score) || 0))
  );
  const blockers = Array.isArray(r.blockers)
    ? (r.blockers as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            title: typeof x.title === "string" ? x.title : "",
            detail: typeof x.detail === "string" ? x.detail : "",
          };
        })
        .filter((x) => x && (x!.title || x!.detail))
    : [];
  const fixes = Array.isArray(r.fixes)
    ? (r.fixes as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            action: typeof x.action === "string" ? x.action : "",
            expected_result:
              typeof x.expected_result === "string" ? x.expected_result : "",
          };
        })
        .filter((x) => x && (x!.action || x!.expected_result))
    : [];

  return {
    ok: true,
    data: {
      conversion_score,
      blockers: blockers as import("./types").ConversionAnalysis["blockers"],
      fixes: fixes as import("./types").ConversionAnalysis["fixes"],
    },
  };
}
