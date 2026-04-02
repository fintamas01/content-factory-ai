/**
 * Weekly AI Growth Report: aggregate workspace signals and render HTML (Resend).
 * No LLM calls — uses persisted audit/product data and notification rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrowthAuditReport } from "@/lib/site-audit/types";
import type { ProductHealthResult } from "@/lib/products/product-health";
import { compareAuditReports } from "@/lib/progress/audit-comparison";
import { compareProductHealth } from "@/lib/progress/product-health-comparison";
import { sendNotificationDigestEmail } from "@/lib/notifications/email";

export type WeeklyGrowthDigestPayload = {
  clientName: string | null;
  /** Section 1 */
  improvements: string[];
  /** Section 2 */
  opportunities: string[];
  /** Section 3 — titles only (from audit actions / issues) */
  nextActions: Array<{ title: string; detail?: string }>;
  /** Recent alerts (optional fourth block in prose) */
  notificationHighlights: Array<{ title: string; message: string }>;
  /** True if we have almost nothing to show (still send a short nudge email) */
  isSparse: boolean;
};

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Display-only: keep email lines tight and scannable (does not change stored data). */
function clipForEmail(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

function parseHealthPayload(raw: unknown): ProductHealthResult | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const score = typeof h.score === "number" ? h.score : Number(h.score);
  if (!Number.isFinite(score)) return null;
  const issuesRaw = Array.isArray(h.issues) ? h.issues : [];
  const opportunitiesRaw = Array.isArray(h.opportunities) ? h.opportunities : [];
  const issues = issuesRaw
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "Issue",
      description: typeof x.description === "string" ? x.description : "",
      impact: typeof x.impact === "string" ? x.impact : "",
      fix: typeof x.fix === "string" ? x.fix : "",
    }));
  const opportunities = opportunitiesRaw
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "Opportunity",
      reason: typeof x.reason === "string" ? x.reason : "",
    }));
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    issues,
    opportunities,
  };
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Loads audit, product, and notification-derived bullets for one workspace.
 */
export async function buildWeeklyGrowthDigestPayload(
  supabase: SupabaseClient,
  clientId: string,
  userId: string
): Promise<WeeklyGrowthDigestPayload> {
  const { data: clientRow } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  const clientName = (clientRow as { name?: string } | null)?.name ?? null;

  const improvements: string[] = [];
  const opportunities: string[] = [];
  const nextActions: Array<{ title: string; detail?: string }> = [];
  const notificationHighlights: Array<{ title: string; message: string }> = [];

  const { data: latestRun } = await supabase
    .from("site_audit_runs")
    .select("id, page_url, report, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestReport: GrowthAuditReport | null = null;
  if (latestRun?.report) {
    latestReport = latestRun.report as GrowthAuditReport;
    const pageUrl = String(latestRun.page_url ?? "");

    const { data: pair } = await supabase
      .from("site_audit_runs")
      .select("id, report, created_at")
      .eq("client_id", clientId)
      .eq("page_url", pageUrl)
      .order("created_at", { ascending: false })
      .limit(2);

    const runs = pair ?? [];
    const [cur, prev] = runs;
    if (cur?.report) {
      const cmp = compareAuditReports({
        previousReport: prev?.report ?? null,
        currentReport: cur.report as GrowthAuditReport,
        previousRunAt: prev?.created_at ?? null,
        previousRunId: prev?.id ?? null,
      });
      for (const line of cmp.summaryLines) improvements.push(line);
      for (const t of cmp.resolvedIssueTitles.slice(0, 4)) {
        improvements.push(`Addressed issue: ${t}`);
      }
      for (const t of cmp.newIssueTitles.slice(0, 3)) {
        opportunities.push(`New focus from audit: ${t}`);
      }
    }

    const rep = latestReport;
    const ci = rep.competitor_intelligence;
    if (ci?.missing_opportunities?.length) {
      for (const o of ci.missing_opportunities.slice(0, 2)) {
        if (o?.opportunity) opportunities.push(`Market gap: ${o.opportunity}`);
      }
    }
    if (rep.content_opportunities?.length) {
      for (const c of rep.content_opportunities.slice(0, 2)) {
        if (c?.idea) opportunities.push(`Content: ${c.idea}`);
      }
    }
    const concrete = rep.ai_visibility?.concrete_improvements;
    if (concrete?.length) {
      for (const line of concrete.slice(0, 2)) {
        opportunities.push(`AI visibility: ${line}`);
      }
    }

    const actions = rep.actions ?? [];
    if (actions.length) {
      for (const a of actions.slice(0, 3)) {
        nextActions.push({
          title: a.title,
          detail: a.expected_result || a.why_it_matters,
        });
      }
    } else if (rep.top_issues?.length) {
      for (const t of rep.top_issues.slice(0, 3)) {
        nextActions.push({ title: t.title, detail: t.fix });
      }
    }
  }

  const { data: prodRows } = await supabase
    .from("product_generations")
    .select("id, product_name, input_data, output_data, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(120);

  const byProduct = new Map<
    number,
    Array<{ id: string; created_at: string; health: ProductHealthResult; name: string }>
  >();

  for (const row of prodRows ?? []) {
    const inp = row.input_data as Record<string, unknown> | null;
    if (inp?.phase !== "health_analysis") continue;
    const wid = Number(inp?.woo_product_id);
    if (!Number.isFinite(wid)) continue;
    const out = row.output_data as Record<string, unknown> | null;
    if (out?.kind !== "health_analysis" || !out?.health) continue;
    const health = parseHealthPayload(out.health);
    if (!health) continue;
    const list = byProduct.get(wid) ?? [];
    list.push({
      id: row.id,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      health,
      name: typeof row.product_name === "string" ? row.product_name : "Product",
    });
    byProduct.set(wid, list);
  }

  for (const [, list] of byProduct) {
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (list.length < 2) continue;
    const [latest, previous] = list;
    const ph = compareProductHealth({
      previous: previous.health,
      current: latest.health,
      previousRunAt: previous.created_at,
      previousGenerationId: previous.id,
    });
    if (ph.hasPrevious && ph.summaryLines.length) {
      improvements.push(`${latest.name}: ${ph.summaryLines[0]}`);
    }
  }

  const since = daysAgoIso(8);
  const { data: notifs } = await supabase
    .from("notifications")
    .select("title, message, severity, created_at")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(12);

  const rank = (s: string) =>
    s === "critical" ? 4 : s === "warning" ? 3 : s === "success" ? 2 : 1;
  const sorted = [...(notifs ?? [])].sort(
    (a, b) => rank(String(b.severity)) - rank(String(a.severity))
  );
  for (const n of sorted.slice(0, 4)) {
    notificationHighlights.push({
      title: String(n.title ?? ""),
      message: String(n.message ?? ""),
    });
  }

  if (
    improvements.length === 0 &&
    opportunities.length === 0 &&
    nextActions.length === 0 &&
    notificationHighlights.length === 0 &&
    latestReport?.summary?.trim()
  ) {
    opportunities.push(latestReport.summary.trim().slice(0, 280));
  }

  const cleanedOpportunities = opportunities.map((s) => s.trim()).filter(Boolean).slice(0, 8);

  const isSparse =
    improvements.length === 0 &&
    cleanedOpportunities.length === 0 &&
    nextActions.length === 0 &&
    notificationHighlights.length === 0;

  return {
    clientName,
    improvements: improvements.slice(0, 10),
    opportunities: cleanedOpportunities,
    nextActions: nextActions.slice(0, 3),
    notificationHighlights,
    isSparse,
  };
}

export function formatWeeklyGrowthReportEmail(args: {
  appName: string;
  baseUrl: string;
  payload: WeeklyGrowthDigestPayload;
}): { subject: string; html: string } {
  const { appName, baseUrl, payload } = args;
  const clientLabel = payload.clientName ? escapeHtml(payload.clientName) : null;
  const subject = payload.clientName
    ? `${appName} — Weekly brief · ${payload.clientName}`
    : `${appName} — Your weekly growth brief`;

  const hasBody =
    payload.improvements.length > 0 ||
    payload.opportunities.length > 0 ||
    payload.nextActions.length > 0 ||
    payload.notificationHighlights.length > 0;

  const lede = payload.isSparse
    ? "We don’t have enough fresh signals in this workspace yet to fill every section. Run a growth audit and refresh key listings—next week’s brief will be richer."
    : hasBody
      ? "This is your condensed weekly readout: movement on scores and issues, open gaps, and the three moves that deserve attention first—sourced from your latest audit, listing health, and workspace alerts."
      : "Here is your weekly snapshot for this workspace.";

  const bullet = (items: string[], maxPerLine: number) =>
    items
      .filter(Boolean)
      .map((raw) => clipForEmail(raw, maxPerLine))
      .map(
        (t) => `
        <tr>
          <td style="padding:0 0 10px 0;">
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td width="20" valign="top" style="padding-top:4px;color:#34d399;font-size:14px;line-height:1;">▸</td>
                <td style="font:500 13px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#e4e4e7;">${escapeHtml(t)}</td>
              </tr>
            </table>
          </td>
        </tr>`
      )
      .join("");

  const improvementsBlock = payload.improvements.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${bullet(payload.improvements, 150)}</table>`
    : `<p style="margin:0;font:500 13px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#a1a1aa;">No score lift or cleared top issues showed up in the data we compared. After you ship changes, run another audit so we can measure a true before/after.</p>`;

  const opportunitiesBlock = payload.opportunities.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${bullet(payload.opportunities, 150)}</table>`
    : `<p style="margin:0;font:500 13px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#a1a1aa;">Nothing new to flag here yet. Run a growth audit or listing health check—this section fills in when the model surfaces gaps and angles.</p>`;

  const sparseAside = payload.isSparse
    ? `<p style="margin:14px 0 0;font:500 12px/1.55 system-ui;color:#fcd34d;">Quick win: connect WooCommerce (if you sell there) and run one full audit on your primary URL—your next brief will mirror real movement.</p>`
    : "";

  const actionsHtml = payload.nextActions
    .map((a, i) => {
      const detailRaw = a.detail?.trim();
      const detail = detailRaw
        ? `<p style="margin:8px 0 0;font:500 12px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#a1a1aa;"><span style="color:#71717a;font:600 10px/1 system-ui;letter-spacing:0.12em;text-transform:uppercase;">Expected outcome</span><br/>${escapeHtml(clipForEmail(detailRaw, 160))}</p>`
        : "";
      return `
        <tr>
          <td style="padding:0 0 14px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.22);border-radius:12px;">
              <tr>
                <td style="padding:14px 16px 16px 16px;">
                  <div style="font:700 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;color:#6ee7b7;">Priority ${i + 1}</div>
                  <div style="margin-top:8px;font:600 15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#fafafa;">${escapeHtml(clipForEmail(a.title, 120))}</div>
                  ${detail}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  const actionsFallback = `<p style="margin:0;font:500 13px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#a1a1aa;">Your latest saved audit did not include a ranked action list. Open the growth audit, run a fresh pass on your main URL, then revisit this email—priorities populate from that report.</p>`;

  const notifRows = payload.notificationHighlights
    .map(
      (n) => `
      <tr>
        <td style="padding:0 0 12px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
            <tr>
              <td style="padding:12px 14px;">
                <div style="font:600 13px/1.35 system-ui;color:#f4f4f5;">${escapeHtml(clipForEmail(n.title, 90))}</div>
                <div style="margin-top:5px;font:500 12px/1.5 system-ui;color:#a1a1aa;">${escapeHtml(clipForEmail(n.message, 130))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const signalsSection = payload.notificationHighlights.length
    ? `
      <tr>
        <td style="padding:0 28px 24px 28px;">
          <p style="margin:0;font:700 11px/1 system-ui;letter-spacing:0.16em;text-transform:uppercase;color:#a1a1aa;">Workspace signals</p>
          <p style="margin:6px 0 14px;font:500 12px/1.5 system-ui;color:#71717a;">High-signal alerts from the last several days—triage these alongside your priorities above.</p>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${notifRows}</table>
        </td>
      </tr>`
    : "";

  const html = `
  <div style="margin:0;padding:0;background:#030406;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#030406;">
      <tr>
        <td align="center" style="padding:28px 14px 36px 14px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#0a0f16;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,#10b981,#059669,#0d9488);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:26px 28px 8px 28px;">
                <p style="margin:0;font:700 10px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;letter-spacing:0.22em;text-transform:uppercase;color:#71717a;">Executive brief · Weekly</p>
                <h1 style="margin:12px 0 0;font:700 24px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#fafafa;letter-spacing:-0.02em;">Growth snapshot</h1>
                <p style="margin:8px 0 0;font:600 14px/1.4 system-ui;color:#d4d4d8;">${clientLabel ? `${escapeHtml(appName)} · ${clientLabel}` : escapeHtml(appName)}</p>
                <p style="margin:16px 0 0;font:500 14px/1.65 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#a1a1aa;">${escapeHtml(lede)}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 28px 20px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid rgba(255,255,255,0.06);">
                  <tr>
                    <td style="padding:20px 0 12px 0;">
                      <p style="margin:0;font:700 11px/1 system-ui;letter-spacing:0.16em;text-transform:uppercase;color:#34d399;">Momentum</p>
                      <p style="margin:6px 0 0;font:500 12px/1.5 system-ui;color:#71717a;">What moved—scores, bands, and issues that dropped off the list.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">${improvementsBlock}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 20px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid rgba(255,255,255,0.06);">
                  <tr>
                    <td style="padding:20px 0 12px 0;">
                      <p style="margin:0;font:700 11px/1 system-ui;letter-spacing:0.16em;text-transform:uppercase;color:#c4b5fd;">Where to win</p>
                      <p style="margin:6px 0 0;font:500 12px/1.5 system-ui;color:#71717a;">Gaps, angles, and new focus areas worth scheduling.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">${opportunitiesBlock}${sparseAside}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 24px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid rgba(255,255,255,0.06);">
                  <tr>
                    <td style="padding:20px 0 14px 0;">
                      <p style="margin:0;font:700 11px/1 system-ui;letter-spacing:0.16em;text-transform:uppercase;color:#fafafa;">What to do next</p>
                      <p style="margin:6px 0 0;font:500 12px/1.5 system-ui;color:#71717a;">Three concrete moves from your latest audit backlog—do these before you re-run analysis.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        ${payload.nextActions.length ? actionsHtml : `<tr><td>${actionsFallback}</td></tr>`}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${signalsSection}

            <tr>
              <td style="padding:0 28px 32px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid rgba(255,255,255,0.06);">
                  <tr>
                    <td style="padding:22px 0 0 0;">
                      <a href="${baseUrl}/dashboard" style="display:inline-block;padding:14px 24px;border-radius:12px;background:linear-gradient(180deg,#10b981 0%,#059669 100%);color:#022c22;text-decoration:none;font:800 11px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;letter-spacing:0.12em;text-transform:uppercase;">Open dashboard</a>
                      <p style="margin:14px 0 0;font:500 12px/1.55 system-ui;color:#71717a;">Review audits, products, and alerts in one place. Pin this tab for your weekly growth review.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 26px 28px;">
                <p style="margin:0;font:500 11px/1.55 system-ui;color:#52525b;text-align:center;">You receive this because the weekly growth brief is enabled for this workspace in ${escapeHtml(appName)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();

  return { subject, html };
}

export async function sendWeeklyGrowthReportEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return sendNotificationDigestEmail(args);
}
