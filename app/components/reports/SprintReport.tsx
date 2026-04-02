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

export function SprintReport({
  clientName,
  generatedAt,
  sprint,
}: {
  clientName: string;
  generatedAt: string;
  sprint: any;
}) {
  const summary = asText(sprint?.summary ?? sprint?.overview ?? "");
  const quickWins = list(sprint?.quickWins ?? sprint?.quick_wins);
  const highestLeverage = list(sprint?.highestLeverageMoves ?? sprint?.highest_leverage_moves ?? sprint?.leverageMoves);
  const weeks = list(sprint?.weeks ?? sprint?.roadmap ?? sprint?.weeklyRoadmap ?? sprint?.weekly_roadmap);

  return (
    <ReportShell footerRight={generatedAt}>
      <ReportCover
        eyebrow="30-Day Growth Sprint"
        title={clientName || "Workspace"}
        subtitle="A focused 4-week plan designed for measurable growth with clear priorities, tasks, and quick wins."
        metaRight={
          <>
            <div style={{ fontWeight: 800, color: "rgba(15,23,42,0.75)" }}>Generated</div>
            <div style={{ marginTop: 2 }}>{generatedAt}</div>
          </>
        }
      />

      {summary ? (
        <Section title="Sprint summary" tone="ink" subtitle="The goal, the approach, and what success looks like.">
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(15,23,42,0.78)" }}>{summary}</div>
        </Section>
      ) : null}

      {weeks.length ? (
        <Section title="Weekly roadmap" tone="violet" subtitle="A week-by-week sequence of work so efforts compound.">
          <div style={{ display: "grid", gap: 12 }}>
            {weeks.slice(0, 6).map((w: any, idx: number) => {
              const title = asText(w?.title ?? w?.week ?? `Week ${idx + 1}`);
              const goal = asText(w?.goal ?? w?.focus ?? "");
              const tasks = list(w?.tasks ?? w?.actions ?? w?.items);
              return (
                <div
                  key={idx}
                  style={{
                    border: "1px solid rgba(15,23,42,0.10)",
                    borderRadius: 18,
                    padding: "14px 14px",
                    background: "linear-gradient(180deg, rgba(139,92,246,0.06), rgba(15,23,42,0.01))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{title}</div>
                    {w?.impact ? (
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
                        {asText(w.impact)}
                      </div>
                    ) : null}
                  </div>
                  {goal ? (
                    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.65, color: "rgba(15,23,42,0.74)" }}>
                      {goal}
                    </div>
                  ) : null}
                  {tasks.length ? (
                    <ul style={{ margin: "10px 0 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.75, color: "rgba(15,23,42,0.80)" }}>
                      {tasks.slice(0, 10).map((t: any, tIdx: number) => (
                        <li key={tIdx}>{asText(t?.title ?? t?.task ?? t)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {quickWins.length ? (
        <Section title="Quick wins" tone="emerald" subtitle="Small changes with outsized return.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.75, color: "rgba(15,23,42,0.78)" }}>
            {quickWins.slice(0, 12).map((w: any, idx: number) => (
              <li key={idx}>{asText(w?.title ?? w?.win ?? w)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {highestLeverage.length ? (
        <Section title="Highest leverage moves" tone="amber" subtitle="If you only do a few things, do these.">
          <div style={{ display: "grid", gap: 10 }}>
            {highestLeverage.slice(0, 10).map((m: any, idx: number) => (
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
                  background: "rgba(245,158,11,0.06)",
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
                    background: "rgba(245,158,11,0.14)",
                    border: "1px solid rgba(245,158,11,0.22)",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(15,23,42,0.82)" }}>
                  {asText(m?.title ?? m?.move ?? m)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </ReportShell>
  );
}

