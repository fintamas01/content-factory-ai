import { normalizeUrl } from "@/lib/site-audit/extract";
import { coerceReport } from "@/lib/site-audit/coerce-report";
import type { GrowthAuditReport } from "@/lib/site-audit/types";
import {
  analyzeCompetitorGaps,
  extractWebsiteData,
  runSpecialistPhases,
  synthesizeReport,
} from "@/lib/site-audit/pipeline";
import { generateFourteenDayPlan, generateAuditFixPackage } from "@/lib/site-audit/agent-generate";
import { generateProductCopy } from "@/lib/products/generate-product-copy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { getPlaybookDefinition, type PlaybookId, type PlaybookStepId } from "./definitions";

export type PlaybookRunParams = {
  url?: string;
  product_name?: string;
  competitor_url?: string;
};

export type PlaybookStepResult = {
  stepId: PlaybookStepId;
  title: string;
  status: "success" | "error" | "skipped";
  startedAt: string;
  endedAt: string;
  output: unknown | null;
  error: string | null;
};

export type PlaybookRunResult = {
  playbookId: PlaybookId;
  steps: PlaybookStepResult[];
  meta: {
    url?: string;
    competitorUrl?: string;
    productName?: string;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeRequiredUrl(raw: unknown, label: string) {
  const s = typeof raw === "string" ? raw.trim() : "";
  const u = normalizeUrl(s);
  if (!u) throw new Error(`Invalid ${label}.`);
  return u;
}

function takeText(x: unknown, max = 9000) {
  if (typeof x !== "string") return "";
  const t = x.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function runAudit(url: string): Promise<{
  report: GrowthAuditReport;
  signals: any;
  extracted: any;
}> {
  const extracted = await extractWebsiteData(url);
  if (!extracted.ok) throw new Error(extracted.error);
  const signals = extracted.data;
  const { seo, aiVis, conversion, gaps } = await runSpecialistPhases(signals);
  const report = await synthesizeReport({ extract: signals, seo, aiVis, conversion, gaps });
  const normalized = coerceReport(report as unknown) ?? (report as GrowthAuditReport);
  return { report: normalized, signals, extracted: signals };
}

async function stepWrap(
  stepId: PlaybookStepId,
  title: string,
  fn: () => Promise<unknown>
): Promise<PlaybookStepResult> {
  const startedAt = nowIso();
  try {
    const output = await fn();
    return { stepId, title, status: "success", startedAt, endedAt: nowIso(), output, error: null };
  } catch (e: any) {
    return {
      stepId,
      title,
      status: "error",
      startedAt,
      endedAt: nowIso(),
      output: null,
      error: String(e?.message ?? e ?? "Unknown error"),
    };
  }
}

export async function runPlaybook(args: {
  playbookId: PlaybookId;
  params: PlaybookRunParams;
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
}): Promise<PlaybookRunResult> {
  const def = getPlaybookDefinition(args.playbookId);
  if (!def) throw new Error("Unknown playbook.");

  const steps: PlaybookStepResult[] = [];

  const meta: PlaybookRunResult["meta"] = {
    url: typeof args.params.url === "string" ? args.params.url.trim() : undefined,
    competitorUrl:
      typeof args.params.competitor_url === "string"
        ? args.params.competitor_url.trim()
        : undefined,
    productName:
      typeof args.params.product_name === "string"
        ? args.params.product_name.trim()
        : undefined,
  };

  // Shared context for multi-step flows
  let audit: { report: GrowthAuditReport; signals: any; extracted: any } | null = null;
  let competitorCi: any | null = null;

  for (const s of def.steps) {
    if (s.id === "audit") {
      const url = normalizeRequiredUrl(args.params.url, "URL");
      steps.push(
        await stepWrap("audit", s.title, async () => {
          audit = await runAudit(url);
          return {
            signals: {
              url: audit.signals.url,
              title: audit.signals.title,
              metaDescription: audit.signals.metaDescription,
              h1Count: Array.isArray(audit.signals.h1) ? audit.signals.h1.length : 0,
              h2Count: Array.isArray(audit.signals.h2) ? audit.signals.h2.length : 0,
            },
            report: audit.report,
          };
        })
      );
      continue;
    }

    if (s.id === "competitor_intelligence") {
      const url = normalizeRequiredUrl(args.params.url, "URL");
      const competitorUrl = normalizeRequiredUrl(args.params.competitor_url, "competitor URL");
      steps.push(
        await stepWrap("competitor_intelligence", s.title, async () => {
          if (!audit) audit = await runAudit(url);

          const ex = await extractWebsiteData(competitorUrl);
          if (!ex.ok) throw new Error(ex.error);

          const ci = await analyzeCompetitorGaps({
            user: audit.extracted,
            competitors: [{ url: competitorUrl, ok: true as const, extract: ex.data }],
            userAuditContext: {
              scores: audit.report.scores,
              top_issues: audit.report.top_issues,
              quick_wins: audit.report.quick_wins,
              ai_visibility: audit.report.ai_visibility,
              content_opportunities: audit.report.content_opportunities,
            },
          });
          if (!ci.ok) throw new Error(ci.error);
          competitorCi = ci.competitor_intelligence;
          return competitorCi;
        })
      );
      continue;
    }

    if (s.id === "content_gap_list") {
      steps.push(
        await stepWrap("content_gap_list", s.title, async () => {
          if (!competitorCi) throw new Error("Competitor intelligence not available.");
          const gaps = Array.isArray(competitorCi?.content_gaps) ? competitorCi.content_gaps : [];
          return {
            gapCount: gaps.length,
            gaps: gaps.slice(0, 30),
          };
        })
      );
      continue;
    }

    if (s.id === "plan_14_days") {
      const url = normalizeRequiredUrl(args.params.url, "URL");
      steps.push(
        await stepWrap("plan_14_days", s.title, async () => {
          if (!audit) audit = await runAudit(url);
          const result = await generateFourteenDayPlan({
            pageUrl: audit.signals.url,
            signals: audit.signals,
            report: audit.report,
          });
          if (!result.ok) throw new Error(result.error);
          return { days: result.days };
        })
      );
      continue;
    }

    if (s.id === "conversion_quick_wins") {
      const url = normalizeRequiredUrl(args.params.url, "URL");
      steps.push(
        await stepWrap("conversion_quick_wins", s.title, async () => {
          if (!audit) audit = await runAudit(url);
          const issues = Array.isArray(audit.report?.top_issues) ? audit.report.top_issues : [];
          const quickWins = Array.isArray(audit.report?.quick_wins) ? audit.report.quick_wins : [];
          const conversionIssue =
            issues.find((i) => String(i?.title ?? "").toLowerCase().includes("conversion")) ??
            issues[0] ??
            null;

          let fixPack: unknown | null = null;
          if (conversionIssue) {
            const fix = await generateAuditFixPackage({
              pageUrl: audit.signals.url,
              signals: audit.signals,
              issue: conversionIssue as any,
              reportSummary: takeText(audit.report?.summary, 2500) || "Use audit context.",
            });
            if (fix.ok) fixPack = fix.fix;
          }

          return {
            quick_wins: quickWins.slice(0, 12),
            suggested_fix_pack: fixPack,
          };
        })
      );
      continue;
    }

    if (s.id === "ai_visibility_actions") {
      const url = normalizeRequiredUrl(args.params.url, "URL");
      steps.push(
        await stepWrap("ai_visibility_actions", s.title, async () => {
          if (!audit) audit = await runAudit(url);
          return {
            ai_visibility: audit.report.ai_visibility,
            content_opportunities: audit.report.content_opportunities?.slice?.(0, 12) ?? [],
            quick_wins: audit.report.quick_wins?.slice?.(0, 10) ?? [],
          };
        })
      );
      continue;
    }

    if (s.id === "product_copy") {
      steps.push(
        await stepWrap("product_copy", s.title, async () => {
          if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured.");
          const productName =
            typeof args.params.product_name === "string" ? args.params.product_name.trim() : "";
          if (!productName) throw new Error("Product name is required.");

          const unified = await fetchUserBrandProfile(
            args.supabase,
            args.userId,
            args.clientId
          );
          const gen = await generateProductCopy({
            input: { productName, lang: "en" },
            brandProfile: unified,
            openaiApiKey: process.env.OPENAI_API_KEY,
          });
          if (!gen.ok) throw new Error(gen.error);
          return gen.result;
        })
      );
      continue;
    }

    if (s.id === "seo_content") {
      steps.push(
        await stepWrap("seo_content", s.title, async () => {
          if (audit?.report) {
            return {
              content_opportunities: audit.report.content_opportunities?.slice?.(0, 12) ?? [],
              top_issues: audit.report.top_issues?.slice?.(0, 8) ?? [],
            };
          }
          return {
            note:
              "SEO content drafts are derived from your audit. Run a playbook with an audit step to unlock richer output.",
          };
        })
      );
      continue;
    }

    if (s.id === "positioning_strategy") {
      steps.push(
        await stepWrap("positioning_strategy", s.title, async () => {
          if (competitorCi) {
            return {
              competitor_advantages: competitorCi.competitor_advantages?.slice?.(0, 10) ?? [],
              positioning_angles: competitorCi.positioning_angles?.slice?.(0, 12) ?? [],
            };
          }
          if (audit?.report) {
            return {
              summary: audit.report.summary,
              quick_wins: audit.report.quick_wins?.slice?.(0, 8) ?? [],
              top_issues: audit.report.top_issues?.slice?.(0, 6) ?? [],
            };
          }
          return { note: "No context available yet." };
        })
      );
      continue;
    }

    steps.push({
      stepId: s.id,
      title: s.title,
      status: "skipped",
      startedAt: nowIso(),
      endedAt: nowIso(),
      output: null,
      error: null,
    });
  }

  return { playbookId: args.playbookId, steps, meta };
}

