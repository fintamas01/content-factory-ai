import { Resend } from "resend";
import type { NotificationRow } from "./types";

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.NOTIFICATIONS_EMAIL_FROM || "";
  const appName = process.env.NOTIFICATIONS_EMAIL_APP_NAME || "Content Factory";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return { apiKey, from, appName, baseUrl };
}

export function formatNotificationDigestEmail(args: {
  appName: string;
  clientName?: string | null;
  baseUrl: string;
  notifications: NotificationRow[];
}): { subject: string; html: string } {
  const n = args.notifications;
  const subject = `${args.appName} · ${n.length} new alert${n.length === 1 ? "" : "s"}`;

  const rows = n
    .slice(0, 12)
    .map((it) => {
      const href = it.action_url
        ? `${args.baseUrl}${it.action_url}`
        : `${args.baseUrl}/dashboard/notifications`;
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #1f2937;">
            <div style="font:600 14px/1.25 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#f9fafb;">
              ${escapeHtml(it.title)}
            </div>
            <div style="margin-top:6px;font:500 12px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#9ca3af;">
              ${escapeHtml(it.message)}
            </div>
            <div style="margin-top:10px;">
              <a href="${href}" style="display:inline-block;padding:8px 12px;border-radius:12px;background:#8b5cf6;color:#111827;text-decoration:none;font:700 11px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;letter-spacing:.08em;text-transform:uppercase;">
                ${escapeHtml(it.action_label || "Open")}
              </a>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const header = args.clientName ? `${args.appName} · ${escapeHtml(args.clientName)}` : args.appName;
  const html = `
  <div style="background:#05070c;padding:32px 12px;">
    <div style="max-width:640px;margin:0 auto;background:#0a0e14;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:22px 22px 0 22px;">
        <div style="font:800 10px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,0.45);">
          Notifications digest
        </div>
        <div style="margin-top:10px;font:700 22px/1.15 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#fff;">
          ${header}
        </div>
        <div style="margin-top:10px;font:500 13px/1.7 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:rgba(255,255,255,0.55);">
          You have ${n.length} new alert${n.length === 1 ? "" : "s"} that may impact growth, conversion, or next actions.
        </div>
      </div>
      <div style="padding:14px 22px 22px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${rows}
        </table>
        <div style="margin-top:18px;">
          <a href="${args.baseUrl}/dashboard/notifications" style="color:#a78bfa;text-decoration:none;font:700 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
            View all notifications →
          </a>
        </div>
      </div>
    </div>
    <div style="max-width:640px;margin:14px auto 0 auto;font:500 11px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:rgba(255,255,255,0.35);text-align:center;">
      You’re receiving this because email notifications are enabled for your workspace.
    </div>
  </div>
  `.trim();

  return { subject, html };
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendNotificationDigestEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = getEmailConfig();
  if (!cfg.apiKey) return { ok: false, error: "Missing RESEND_API_KEY." };
  if (!cfg.from) return { ok: false, error: "Missing NOTIFICATIONS_EMAIL_FROM." };

  const resend = new Resend(cfg.apiKey);
  try {
    const r = await resend.emails.send({
      from: cfg.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    const id = (r as any)?.data?.id;
    if (!id) return { ok: false, error: "Email provider did not return an id." };
    return { ok: true, id: String(id) };
  } catch (e) {
    console.error("resend send:", e);
    return { ok: false, error: "Email send failed." };
  }
}

