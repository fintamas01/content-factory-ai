"use client";

import { ReportCover, ReportShell, Section } from "./ReportShell";

function asText(v: any): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function list(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

export function ProductOptimizationReport({
  clientName,
  generatedAt,
  productName,
  health,
  optimized,
}: {
  clientName: string;
  generatedAt: string;
  productName: string;
  health?: any;
  optimized?: any;
}) {
  const issues = list(health?.issues);
  const opportunities = list(health?.opportunities);

  const seo = optimized?.seo ?? {};
  const bullets = list(optimized?.bulletPoints ?? optimized?.bullets);
  const shortDesc = asText(optimized?.shortDescription ?? optimized?.short_description ?? "");
  const longDesc = asText(optimized?.description ?? optimized?.longDescription ?? optimized?.long_description ?? "");

  return (
    <ReportShell footerRight={generatedAt}>
      <ReportCover
        eyebrow="Product Optimization"
        title={clientName || "Workspace"}
        subtitle="A client-ready summary of what’s weakening conversion on the listing and the AI-improved recommendations you can apply."
        metaLeft={
          <>
            <div style={{ fontWeight: 750, color: "#0f172a" }}>Product</div>
            <div style={{ marginTop: 2 }}>{productName || "Selected product"}</div>
          </>
        }
        metaRight={
          <>
            <div style={{ fontWeight: 800, color: "rgba(15,23,42,0.75)" }}>Generated</div>
            <div style={{ marginTop: 2 }}>{generatedAt}</div>
          </>
        }
      />

      {typeof health?.score === "number" ? (
        <Section
          title="Health score"
          tone={health.score >= 75 ? "emerald" : health.score >= 55 ? "amber" : "violet"}
          subtitle="A fast indicator of listing quality and conversion readiness."
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em" }}>{health.score}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(15,23,42,0.55)" }}>/100</div>
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 950,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(15,23,42,0.50)",
                background: "rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.08)",
                padding: "8px 12px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {health.score >= 75 ? "Conversion-ready" : health.score >= 55 ? "Improvement zone" : "High priority"}
            </div>
          </div>
          {health?.summary ? (
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.78)" }}>
              {asText(health.summary)}
            </div>
          ) : null}
        </Section>
      ) : null}

      {issues.length ? (
        <Section title="Current issues" tone="amber" subtitle="What’s weakening clarity, trust, or perceived value.">
          <div style={{ display: "grid", gap: 10 }}>
            {issues.slice(0, 10).map((it: any, idx: number) => (
              <div
                key={idx}
                style={{
                  border: "1px solid rgba(15,23,42,0.10)",
                  borderRadius: 16,
                  padding: "14px 14px",
                  background: "linear-gradient(180deg, rgba(245,158,11,0.06), rgba(15,23,42,0.01))",
                }}
              >
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
                      fontWeight: 950,
                      color: "rgba(15,23,42,0.70)",
                      background: "rgba(245,158,11,0.14)",
                      border: "1px solid rgba(245,158,11,0.22)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>
                      {asText(it.title || it.issue || `Issue ${idx + 1}`)}
                    </div>
                {it.why || it.impact ? (
                      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.65, color: "rgba(15,23,42,0.72)" }}>
                        {asText(it.why || it.impact)}
                      </div>
                ) : null}
                {it.fix || it.recommendation ? (
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
                        <span style={{ fontWeight: 950 }}>Fix:</span> {asText(it.fix || it.recommendation)}
                      </div>
                ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {opportunities.length ? (
        <Section title="AI opportunities" tone="violet" subtitle="High-impact improvements you can apply immediately.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.75, color: "rgba(15,23,42,0.78)" }}>
            {opportunities.slice(0, 10).map((o: any, idx: number) => (
              <li key={idx}>{asText(o.title || o.opportunity || o)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {shortDesc ? (
        <Section title="Suggested short description" tone="emerald" subtitle="Above-the-fold copy that sells the value fast.">
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.80)" }}>
            {shortDesc}
          </div>
        </Section>
      ) : null}

      {bullets.length ? (
        <Section title="Suggested bullet points" tone="emerald" subtitle="Scannable benefits with proof + specifics.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.75, color: "rgba(15,23,42,0.78)" }}>
            {bullets.slice(0, 10).map((b: any, idx: number) => (
              <li key={idx}>{asText(b)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {longDesc ? (
        <Section title="Suggested long description" tone="ink" subtitle="Deeper persuasion: objections, use-cases, and differentiation.">
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.78)" }}>
            {longDesc}
          </div>
        </Section>
      ) : null}

      {seo?.title || seo?.description ? (
        <Section title="Suggested SEO metadata" tone="ink" subtitle="Search-friendly copy while preserving accuracy.">
          {seo?.title ? (
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.82)" }}>
              <span style={{ fontWeight: 850 }}>SEO title:</span> {asText(seo.title)}
            </div>
          ) : null}
          {seo?.description ? (
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7, color: "rgba(15,23,42,0.82)" }}>
              <span style={{ fontWeight: 850 }}>SEO description:</span> {asText(seo.description)}
            </div>
          ) : null}
        </Section>
      ) : null}
    </ReportShell>
  );
}

