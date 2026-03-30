import { callOpenAIJson } from "@/lib/site-audit/pipeline/shared";
import type {
  AuditContentPlanDay,
  AuditFixPackage,
  AuditPageSignalsPayload,
  GrowthAuditReport,
  GrowthAuditTopIssue,
} from "@/lib/site-audit/types";

const FIX_SYSTEM = `You are a principal conversion copywriter + SEO lead at a top-tier growth agency. Your client is paying for work that sounds like a human expert who has read THIS page—not generic AI filler.

INPUT: JSON with pageUrl, signals (url, title, metaDescription, heading counts), issue (title, explanation, impact, fix, priority), and reportSummary. Treat signals and issue as ground truth about what exists; infer industry/topic only from those strings and the URL host/path.

NON-NEGOTIABLE QUALITY BAR
- SPECIFICITY: Name the actual topic, product type, or problem space implied by title/meta/URL. Ban phrases like "unlock potential", "elevate your brand", "in today's digital world", "cutting-edge", "take your X to the next level", "seamless experience" unless the page itself uses that exact language.
- TAILORING: The reader must feel you wrote for this URL. Reference concrete nouns from title or meta when rewriting. If title/meta are empty, infer cautiously from the URL slug and issue text only—say what you inferred in seo_content_notes.
- CONVERSION & BUSINESS: Every asset must tie to a plausible commercial outcome (qualified clicks, demo requests, purchases, trust, fewer drop-offs). In conversion_impact, state the mechanism (e.g. clearer value prop, stronger proof placement, intent-match headline) and who it helps (visitor stage).
- VARIATIONS: Provide real alternatives, not synonyms. copy_variants must use different angles (e.g. risk-reduction vs outcome-led vs speed) or funnel stages—not the same sentence rearranged.
- HONESTY: Do not invent awards, stats, client names, or reviews. Do not claim rankings or results you cannot know.

OUTPUT RULES
- meta_title ≤60 characters; meta_description ≤155 characters (count roughly).
- meta_title_alternates: exactly 2 strings, different hooks (e.g. benefit-led vs proof-led vs question), same page.
- headlines: exactly 5 strings. Prefix each with a short label in brackets so teams know the angle, e.g. "[Benefit-led] …" "[Proof-led] …" "[Objection] …" "[Urgency—only if honest] …" "[Question] …". Use five distinct angles where possible.
- improved_text: one primary rewrite block (hero or key section) in plain text, ≥2 sentences, tied to the issue.
- copy_variants: exactly 2 strings, each a full alternate paragraph or short block (not one-line slogans).
- seo_content_notes: 2–4 sentences on topic/query alignment and what to preserve or change for this URL—no generic SEO advice.
- notes: concise implementation checklist (where to place copy, what to A/B test, one measurement idea).

Return strictly valid JSON only. Schema:
{
  "conversion_impact": "string",
  "improved_text": "string",
  "copy_variants": ["string", "string"],
  "seo_content_notes": "string",
  "meta_title": "string",
  "meta_description": "string",
  "meta_title_alternates": ["string", "string"],
  "headlines": ["string", "string", "string", "string", "string"],
  "notes": "string"
}`;

const PLAN_SYSTEM = `You are a social and content growth lead. Build a practical 14-day calendar tied to the audit: one row per day, building on scores, issues, and opportunities. Hooks and captions must feel specific to the brand/page topic, not generic platitudes.

Return strictly valid JSON only. Schema:
{
  "days": [
    { "day": 1, "content_idea": "string", "hook": "string", "caption": "string" }
  ]
}

Exactly 14 items; "day" runs 1..14. Vary formats (story, proof, objection, FAQ, behind-the-scenes) across the week.`;

function coerceFix(parsed: unknown): AuditFixPackage | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const conversion_impact =
    typeof o.conversion_impact === "string" ? o.conversion_impact.trim() : "";
  const improved_text = typeof o.improved_text === "string" ? o.improved_text : "";
  const variantsRaw = o.copy_variants;
  const copy_variants = Array.isArray(variantsRaw)
    ? variantsRaw
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 3)
    : [];
  const seo_content_notes =
    typeof o.seo_content_notes === "string" ? o.seo_content_notes : "";
  const meta_title = typeof o.meta_title === "string" ? o.meta_title : "";
  const meta_description =
    typeof o.meta_description === "string" ? o.meta_description : "";
  const altRaw = o.meta_title_alternates;
  const meta_title_alternates = Array.isArray(altRaw)
    ? altRaw
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 3)
    : [];
  const headlines = Array.isArray(o.headlines)
    ? o.headlines.filter((h): h is string => typeof h === "string").slice(0, 8)
    : [];
  const notes = typeof o.notes === "string" ? o.notes : "";
  if (!improved_text && !meta_title && headlines.length === 0) return null;
  return {
    conversion_impact,
    improved_text,
    copy_variants,
    seo_content_notes,
    meta_title,
    meta_description,
    meta_title_alternates,
    headlines,
    notes,
  };
}

function coercePlan(parsed: unknown): AuditContentPlanDay[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const daysRaw = o.days;
  if (!Array.isArray(daysRaw)) return null;
  const days: AuditContentPlanDay[] = [];
  for (const row of daysRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const day = Number(r.day);
    const content_idea =
      typeof r.content_idea === "string" ? r.content_idea : "";
    const hook = typeof r.hook === "string" ? r.hook : "";
    const caption = typeof r.caption === "string" ? r.caption : "";
    if (!content_idea && !hook && !caption) continue;
    days.push({
      day: Number.isFinite(day) ? day : days.length + 1,
      content_idea,
      hook,
      caption,
    });
  }
  if (days.length === 0) return null;
  return days.slice(0, 14);
}

export async function generateAuditFixPackage(args: {
  pageUrl: string;
  signals: AuditPageSignalsPayload;
  issue: GrowthAuditTopIssue;
  reportSummary: string;
}): Promise<{ ok: true; fix: AuditFixPackage } | { ok: false; error: string }> {
  const user = JSON.stringify({
    pageUrl: args.pageUrl,
    signals: args.signals,
    issue: args.issue,
    reportSummary: args.reportSummary.slice(0, 4000),
  });

  const res = await callOpenAIJson({
    system: FIX_SYSTEM,
    user,
    temperature: 0.42,
    max_tokens: 3072,
  });

  if (!res.ok) return { ok: false, error: res.error };
  const fix = coerceFix(res.parsed);
  if (!fix) return { ok: false, error: "Could not parse fix output." };
  return { ok: true, fix };
}

export async function generateFourteenDayPlan(args: {
  pageUrl: string;
  signals: AuditPageSignalsPayload;
  report: GrowthAuditReport;
}): Promise<
  { ok: true; days: AuditContentPlanDay[] } | { ok: false; error: string }
> {
  const user = JSON.stringify({
    pageUrl: args.pageUrl,
    signals: args.signals,
    report: {
      summary: args.report.summary,
      scores: args.report.scores,
      top_issues: args.report.top_issues,
      quick_wins: args.report.quick_wins,
      content_opportunities: args.report.content_opportunities,
      ai_visibility: args.report.ai_visibility,
    },
  });

  const res = await callOpenAIJson({
    system: PLAN_SYSTEM,
    user,
    temperature: 0.45,
    max_tokens: 4096,
  });

  if (!res.ok) return { ok: false, error: res.error };
  const days = coercePlan(res.parsed);
  if (!days) return { ok: false, error: "Could not parse content plan." };
  return { ok: true, days };
}
