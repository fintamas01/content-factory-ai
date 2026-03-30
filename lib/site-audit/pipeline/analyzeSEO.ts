import type { WebsiteExtractPayload } from "./types";
import { callOpenAIJson } from "./shared";

const SYSTEM = `You are a principal SEO strategist at a top-tier digital agency. Your client expects a paid audit quality: no fluff, no generic checklists.

INPUT: JSON from ONE public page (single URL crawl). You must ground every claim in the provided fields. If something is missing or empty, say so explicitly—do not invent rankings, backlinks, Core Web Vitals, crawl budget, or schema you cannot see.

OUTPUT: Strictly valid JSON only. No markdown, no code fences.

{
  "seo_score": number (0-100 integer),
  "seo_issues": [ { "title": "string", "detail": "string" } ],
  "technical_observations": "string",
  "content_observations": "string"
}

SCORING (seo_score): Reflect on-page signals only—title/meta alignment, H1 focus, heading hierarchy and topical support, keyword/intent clarity in visible copy, obvious thin or duplicate patterns. Penalize title/H1/meta mismatch, generic meta, missing or weak H1, heading soup, or copy that does not support a clear search intent.

FOR EACH seo_issues[] item:
- "title": A sharp, diagnostic headline (never "Improve SEO" or "Add keywords" without diagnosis). Name the actual pattern you see (e.g. "Meta describes brand only—no search intent").
- "detail": In 3-5 sentences, explain (1) WHY this hurts performance—tie to how search engines and users use titles/snippets/headings, (2) BUSINESS IMPACT—qualified traffic, snippet CTR, relevance for target queries, not vague "visibility", (3) what concrete on-page change would move the needle. Quote or paraphrase from the extract when useful.

technical_observations: 2-4 sentences on what you can infer from structure/signals in the extract (e.g. single vs multiple H1s, heading support, meta length appropriateness). State limits of what you cannot see.

content_observations: 2-4 sentences on topical depth, intent match, and whether the visible text sample supports ranking or looks thin/generic. If the sample is short, say uncertainty is capped.

BANNED: Generic advice ("create quality content", "optimize meta", "use keywords") without naming the problem mechanism and impact.`;

export async function analyzeSEO(
  extract: WebsiteExtractPayload
): Promise<
  | { ok: true; data: import("./types").SEOAnalysis }
  | { ok: false; error: string }
> {
  const res = await callOpenAIJson({
    system: SYSTEM,
    user: JSON.stringify({
      url: extract.url,
      title: extract.title,
      metaDescription: extract.metaDescription,
      h1: extract.h1,
      h2: extract.h2.slice(0, 20),
      textSample: extract.textSample.slice(0, 8000),
    }),
    temperature: 0.3,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const o = res.parsed;
  if (!o || typeof o !== "object") return { ok: false, error: "Invalid SEO JSON." };
  const r = o as Record<string, unknown>;
  const seo_score = Math.max(
    0,
    Math.min(100, Math.round(Number(r.seo_score) || 0))
  );
  const seo_issues = Array.isArray(r.seo_issues)
    ? (r.seo_issues as unknown[])
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const x = it as Record<string, unknown>;
          return {
            title: typeof x.title === "string" ? x.title : "",
            detail: typeof x.detail === "string" ? x.detail : "",
          };
        })
        .filter((x) => x && (x.title || x.detail))
    : [];
  return {
    ok: true,
    data: {
      seo_score,
      seo_issues: seo_issues as import("./types").SEOAnalysis["seo_issues"],
      technical_observations:
        typeof r.technical_observations === "string"
          ? r.technical_observations
          : "",
      content_observations:
        typeof r.content_observations === "string"
          ? r.content_observations
          : "",
    },
  };
}
