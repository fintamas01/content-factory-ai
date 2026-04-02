import type { WebsiteExtractPayload } from "./types";
import {
  buildCompactAuditInput,
  serializeAuditPageInput,
} from "./compactContext";
import { callOpenAIJson } from "./shared";

const SYSTEM = `You are a senior conversion strategist (CRO + messaging). You audit ONE page from extracted text, headings, and meta only—no heatmaps, no analytics.

Your job: judge whether a motivated visitor would understand (1) what is being sold, (2) for whom, (3) why now, (4) what to do next—and whether trust and risk are addressed enough to act.

If URL or copy suggests e-commerce (product, shop, cart, price, SKU, collection): evaluate like a PDP or storefront—offer clarity, proof near price, shipping/returns anxiety, variant/spec confusion, payment/trust signals visible in text. Do not claim you saw checkout unless the extract shows it.

OUTPUT: Strictly valid JSON. No markdown.

{
  "conversion_score": number (0-100 integer),
  "blockers": [ { "title": "string", "detail": "string" } ],
  "fixes": [ { "action": "string", "expected_result": "string" } ]
}

SCORING (conversion_score): High when value prop, offer, and next step are obvious from headings + sample; proof (specificity, outcomes, credibility cues in text) supports the claim; friction objections are partially handled. For e-com, also reward visible policy/spec/trust cues when present. Low when the visitor must guess the offer, the CTA path is unclear from copy, or trust is unsupported.

FOR EACH blockers[]:
- "title": Specific diagnosis tied to extract (e.g. "H1 names the product but not the primary outcome or who it is for" or "Price exists but no risk reversal or shipping hint in visible copy").
- "detail": WHY this hurts conversion (cognitive load, ambiguity, trust gap) and business impact (bounce, abandoned cart, unqualified leads—pick what fits the page type). Ground every claim in the extract.

FOR EACH fixes[]:
- "action": Imperative, specific, doable on this page—rewrite a named element (H1, meta, hero subhead, bullet list, CTA label), not "improve UX".
- "expected_result": Directional revenue outcome (higher add-to-cart confidence, fewer confused exits, more qualified demos)—avoid generic "better engagement".

Ban vague fixes: never output only "improve conversion" or "optimize the page" without naming what to change.

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
