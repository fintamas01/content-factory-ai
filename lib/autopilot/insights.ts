import type { GrowthAuditReport } from "@/lib/site-audit/types";

export type AutopilotFocus = "seo" | "content" | "conversion" | "ai_visibility";

export type AutopilotInsight = {
  id: string;
  title: string;
  explanation: string;
  action?: { label: string; href: string };
  tone?: "cyan" | "violet" | "emerald" | "amber";
};

function pickTopIssue(report: GrowthAuditReport, focus: AutopilotFocus) {
  const issues = report.top_issues ?? [];
  // MVP: keep selection robust across report schema versions.
  // Prefer high-priority issues first; otherwise fall back to the first issue.
  const preferred =
    focus === "seo" || focus === "conversion"
      ? issues.filter((i) => i.priority === "high").concat(issues)
      : issues;
  return preferred[0] || null;
}

export function buildAutopilotInsights(opts: {
  url: string;
  report: GrowthAuditReport;
  focus: AutopilotFocus[];
}): { summary: string; insights: AutopilotInsight[] } {
  const { url, report, focus } = opts;
  const enabled = focus.length ? focus : ["seo", "content", "conversion", "ai_visibility"];

  const insights: AutopilotInsight[] = [];

  for (const f of enabled) {
    if (f === "ai_visibility") {
      const v = report.ai_visibility;
      const positive = Boolean(v?.would_ai_recommend);
      const title = positive
        ? "AI assistants likely recommend you"
        : "AI assistants may miss your page";
      const explanation =
        (positive
          ? v?.how_systems_see_site || v?.reason
          : v?.reason || v?.how_systems_see_site) ||
        "Improve entity clarity, proof, and structured headings to increase assistant confidence.";
      insights.push({
        id: `ai-${Date.now()}`,
        title,
        explanation,
        tone: positive ? "emerald" : "violet",
        action: { label: "Open Audit", href: "/dashboard/site-audit" },
      });
    }

    if (f === "seo") {
      const issue = pickTopIssue(report, "seo");
      if (issue) {
        insights.push({
          id: `seo-${Date.now()}`,
          title: `SEO opportunity: ${issue.title}`,
          explanation:
            issue.impact ||
            issue.explanation ||
            "Address this to improve relevance and crawl clarity.",
          tone: "cyan",
          action: { label: "Open Actions", href: "/dashboard/site-audit" },
        });
      }
    }

    if (f === "conversion") {
      const issue = pickTopIssue(report, "conversion");
      if (issue) {
        insights.push({
          id: `conv-${Date.now()}`,
          title: `Conversion opportunity: ${issue.title}`,
          explanation:
            issue.impact ||
            issue.explanation ||
            "Tighten the next-step and reduce friction to lift conversions.",
          tone: "emerald",
          action: { label: "Open Actions", href: "/dashboard/site-audit" },
        });
      }
    }

    if (f === "content") {
      const idea = (report.content_opportunities ?? [])[0];
      if (idea) {
        insights.push({
          id: `content-${Date.now()}`,
          title: `Content angle: ${idea.idea}`,
          explanation:
            idea.why_it_works ||
            "This angle maps to the demand signals found in your audit.",
          tone: "violet",
          action: { label: "Generate Content", href: "/dashboard/content" },
        });
      }
    }
  }

  const scores = report.scores;
  const summary = scores
    ? `AutoPilot ran on ${url}. Snapshot: SEO ${scores.seo}/100, AI ${scores.ai_discoverability}/100, Conversion ${scores.conversion}/100.`
    : `AutoPilot ran on ${url} and detected new opportunities.`;

  return { summary, insights: insights.slice(0, 8) };
}

