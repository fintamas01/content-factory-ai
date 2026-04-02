"use client";

import type { ReactNode } from "react";

export function ReportShell({
  children,
  brandMark = "Content Factory",
  footerRight,
}: {
  children: ReactNode;
  brandMark?: string;
  footerRight?: ReactNode;
}) {
  return (
    <div
      style={{
        width: 794,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div
        style={{
          padding: "34px 34px",
          background: "linear-gradient(180deg, #f8fafc, #f1f5f9)",
        }}
      >
        <div
          style={{
            borderRadius: 28,
            border: "1px solid rgba(15,23,42,0.10)",
            background: "#ffffff",
            boxShadow:
              "0 1px 0 rgba(15,23,42,0.04), 0 32px 80px -40px rgba(15,23,42,0.35)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "44px 52px 34px 52px",
              background:
                "radial-gradient(900px 420px at 12% -10%, rgba(139,92,246,0.14), transparent 60%), radial-gradient(900px 420px at 110% 10%, rgba(34,211,238,0.10), transparent 60%)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 22,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background:
                      "linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.03))",
                    border: "1px solid rgba(15,23,42,0.10)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.75) inset",
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    fontWeight: 850,
                    textTransform: "uppercase",
                    color: "rgba(15,23,42,0.58)",
                  }}
                >
                  {brandMark}
                </div>
              </div>
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background:
                    "linear-gradient(to right, rgba(15,23,42,0.10), rgba(15,23,42,0.04), transparent)",
                }}
              />
            </div>

            {children}
          </div>

          <div
            style={{
              padding: "18px 52px 20px 52px",
              borderTop: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(248,250,252,0.65)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                fontWeight: 900,
                textTransform: "uppercase",
                color: "rgba(15,23,42,0.45)",
              }}
            >
              Confidential • For internal/client review
            </div>
            <div style={{ fontSize: 10, color: "rgba(15,23,42,0.45)" }}>
              {footerRight}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportCover({
  eyebrow,
  title,
  subtitle,
  metaLeft,
  metaRight,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  metaLeft?: ReactNode;
  metaRight?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "linear-gradient(180deg, rgba(139,92,246,0.45), rgba(34,211,238,0.35))",
            boxShadow: "0 8px 22px -14px rgba(2,132,199,0.55)",
          }}
        />
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            fontWeight: 950,
            textTransform: "uppercase",
            color: "rgba(15,23,42,0.58)",
          }}
        >
          {eyebrow}
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            lineHeight: 1.65,
            color: "rgba(15,23,42,0.68)",
            maxWidth: 620,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {(metaLeft || metaRight) ? (
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 18,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.80)",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(15,23,42,0.70)", lineHeight: 1.55 }}>{metaLeft}</div>
          </div>
          <div
            style={{
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 18,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.80)",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(15,23,42,0.65)", lineHeight: 1.55 }}>{metaRight}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  children,
  tone = "ink",
  subtitle,
}: {
  title: string;
  children: ReactNode;
  tone?: "ink" | "violet" | "emerald" | "amber";
  subtitle?: string;
}) {
  const accent =
    tone === "violet"
      ? "rgba(139,92,246,0.24)"
      : tone === "emerald"
        ? "rgba(16,185,129,0.24)"
        : tone === "amber"
          ? "rgba(245,158,11,0.24)"
          : "rgba(15,23,42,0.18)";
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 999, background: accent }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(15,23,42,0.60)", lineHeight: 1.4 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div
        style={{
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 18,
          background: "#ffffff",
          padding: "18px 18px",
          boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScorePills({
  scores,
}: {
  scores: Array<{ label: string; value: number; tone: "violet" | "emerald" | "amber" | "ink" }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
      {scores.map((s) => {
        const bg =
          s.tone === "violet"
            ? "rgba(139,92,246,0.12)"
            : s.tone === "emerald"
              ? "rgba(16,185,129,0.12)"
              : s.tone === "amber"
                ? "rgba(245,158,11,0.12)"
                : "rgba(15,23,42,0.06)";
        const br =
          s.tone === "violet"
            ? "rgba(139,92,246,0.22)"
            : s.tone === "emerald"
              ? "rgba(16,185,129,0.22)"
              : s.tone === "amber"
                ? "rgba(245,158,11,0.22)"
                : "rgba(15,23,42,0.12)";
        const bar =
          s.tone === "violet"
            ? "linear-gradient(90deg, rgba(139,92,246,0.70), rgba(34,211,238,0.55))"
            : s.tone === "emerald"
              ? "linear-gradient(90deg, rgba(16,185,129,0.78), rgba(34,197,94,0.50))"
              : s.tone === "amber"
                ? "linear-gradient(90deg, rgba(245,158,11,0.85), rgba(251,191,36,0.55))"
                : "linear-gradient(90deg, rgba(15,23,42,0.65), rgba(15,23,42,0.25))";
        const pct = Math.max(0, Math.min(100, Number(s.value) || 0));
        return (
          <div
            key={s.label}
            style={{
              border: `1px solid ${br}`,
              borderRadius: 18,
              padding: "14px 14px",
              background: bg,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 900, textTransform: "uppercase", color: "rgba(15,23,42,0.55)" }}>
              {s.label}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.02em" }}>
              {s.value}
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.55)" }}> /100</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 950, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(15,23,42,0.45)" }}>
                {pct >= 75 ? "Strong" : pct >= 55 ? "Mixed" : "Needs work"}
              </div>
            </div>
            <div style={{ marginTop: 10, height: 7, borderRadius: 999, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(15,23,42,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: bar }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

