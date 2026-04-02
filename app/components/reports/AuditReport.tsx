"use client";

import { ReportCover, ReportShell, ScorePills, Section } from "./ReportShell";

function asText(v: any): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function bullets(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
}

export function AuditReport({
  clientName,
  websiteUrl,
  generatedAt,
  audit,
  competitorSummary,
}: {
  clientName: string;
  websiteUrl?: string;
  generatedAt: string;
  audit: any;
  competitorSummary?: string;
}) {
  const overallScore = Number(audit?.scores?.overall ?? audit?.score ?? 0) || 0;
  const brandScore = Number(audit?.scores?.brand ?? audit?.scores?.messaging ?? 0) || 0;
  const growthScore = Number(audit?.scores?.growth ?? audit?.scores?.strategy ?? 0) || 0;

  const summary = asText(audit?.summary ?? audit?.executiveSummary ?? "");
  const topIssues = Array.isArray(audit?.issues) ? audit.issues : [];
  const quickWins = Array.isArray(audit?.quickWins) ? audit.quickWins : bullets(audit?.quick_wins);
  const recommendations = Array.isArray(audit?.recommendations)
    ? audit.recommendations
    : bullets(audit?.actionRecommendations ?? audit?.actions);

  return (
    <ReportShell footerRight={generatedAt}>
      <ReportCover
        eyebrow="AI Growth Audit"
        title={clientName || "Workspace"}
        subtitle="A client-ready snapshot of what’s working, what’s holding growth back, and the highest-leverage next moves."
        metaLeft={
          <>
            {websiteUrl ? (
              <>
                <div style={{ fontWeight: 750, color: "#0f172a" }}>Website</div>
                <div style={{ marginTop: 2 }}>{websiteUrl}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 750, color: "#0f172a" }}>Context</div>
                <div style={{ marginTop: 2 }}>Workspace-level audit export</div>
              </>
            )}
          </>
        }
        metaRight={
          <>
            <div style={{ fontWeight: 800, color: "rgba(15,23,42,0.75)" }}>Generated</div>
            <div style={{ marginTop: 2 }}>{generatedAt}</div>
          </>
        }
      />

      <ScorePills
        scores={[
          { label: "Overall", value: overallScore, tone: overallScore >= 75 ? "emerald" : overallScore >= 55 ? "amber" : "violet" },
          { label: "Brand & messaging", value: brandScore, tone: brandScore >= 75 ? "emerald" : brandScore >= 55 ? "amber" : "violet" },
          { label: "Growth readiness", value: growthScore, tone: growthScore >= 75 ? "emerald" : growthScore >= 55 ? "amber" : "violet" },
        ]}
      />

      {summary ? (
        <Section title="Executive summary" tone="ink" subtitle="What to know before diving into details.">
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(15,23,42,0.78)" }}>{summary}</div>
        </Section>
      ) : null}

      {topIssues.length ? (
        <Section title="Top issues" tone="amber" subtitle="These are the highest-impact blockers to improved performance.">
          <div style={{ display: "grid", gap: 10 }}>
            {topIssues.slice(0, 8).map((it: any, idx: number) => (
              <div
                key={idx}
                style={{
                  border: "1px solid rgba(15,23,42,0.10)",
                  borderRadius: 16,
                  padding: "14px 14px",
                  background: "linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.01))",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 900,
                        color: "rgba(15,23,42,0.70)",
                        background: "rgba(245,158,11,0.14)",
                        border: "1px solid rgba(245,158,11,0.22)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>
                        {asText(it.title || it.issue || it.name || `Issue ${idx + 1}`)}
                      </div>
                      {it.why || it.impact || it.description ? (
                        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: "rgba(15,23,42,0.72)" }}>
                          {asText(it.why || it.impact || it.description)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {it.priority || it.severity ? (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 950,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "rgba(15,23,42,0.55)",
                        background: "rgba(15,23,42,0.04)",
                        border: "1px solid rgba(15,23,42,0.08)",
                        padding: "6px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {asText(it.priority || it.severity)}
                    </div>
                  ) : null}
                </div>
                {it.why || it.impact || it.description ? (
                  <div style={{ display: "none" }} />
                ) : null}
                {it.recommendation || it.fix ? (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      lineHeight: 1.65,
                      color: "rgba(15,23,42,0.82)",
                      borderTop: "1px solid rgba(15,23,42,0.08)",
                      paddingTop: 10,
                    }}
                  >
                    <span style={{ fontWeight: 950 }}>Recommended fix:</span> {asText(it.recommendation || it.fix)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {quickWins?.length ? (
        <Section title="Quick wins" tone="emerald" subtitle="Fast improvements you can ship with minimal lift.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.75, color: "rgba(15,23,42,0.78)" }}>
            {quickWins.slice(0, 10).map((w: any, idx: number) => (
              <li key={idx}>{asText(w)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {competitorSummary ? (
        <Section title="Competitor intelligence" tone="violet" subtitle="Where competitors out-position or out-communicate you.">
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.78)" }}>{competitorSummary}</div>
        </Section>
      ) : null}

      {recommendations?.length ? (
        <Section title="Action recommendations" tone="ink" subtitle="A sequenced set of moves to improve results.">
          <div style={{ display: "grid", gap: 10 }}>
            {recommendations.slice(0, 10).map((r: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  alignItems: "start",
                  border: "1px solid rgba(15,23,42,0.10)",
                  borderRadius: 16,
                  padding: "12px 12px",
                  background: "rgba(15,23,42,0.01)",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 950,
                    color: "rgba(15,23,42,0.70)",
                    background: "rgba(15,23,42,0.04)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(15,23,42,0.80)" }}>{asText(r)}</div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

    </ReportShell>
  );
}

