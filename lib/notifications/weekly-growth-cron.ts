import { getAdminSupabase } from "@/lib/notifications/cron";
import {
  buildWeeklyGrowthDigestPayload,
  formatWeeklyGrowthReportEmail,
  sendWeeklyGrowthReportEmail,
} from "@/lib/email/weekly-growth";
import { getEmailConfig } from "@/lib/notifications/email";

const MIN_MS_BETWEEN_SENDS = Math.floor(6.5 * 24 * 60 * 60 * 1000);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Weekly AI Growth Report — one email per user+workspace row (multi-client = multiple emails).
 * Respects weekly_growth_report_enabled, email_enabled, and last_weekly_growth_report_sent_at.
 */
export async function runWeeklyGrowthDigestSend(args: {
  maxPairs?: number;
  /** Manual test: send even if last_weekly_growth_report_sent_at is recent */
  ignoreLastSent?: boolean;
}): Promise<
  { ok: true; sent: number; skipped: number; errors: number } | { ok: false; error: string }
> {
  const supabase = getAdminSupabase();
  if (!supabase) return { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL." };

  const cfg = getEmailConfig();
  if (!cfg.baseUrl) {
    return {
      ok: false,
      error:
        "Missing public site URL: set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL (used for links in weekly emails).",
    };
  }
  if (!cfg.apiKey) return { ok: false, error: "Missing RESEND_API_KEY." };
  if (!cfg.from) return { ok: false, error: "Missing NOTIFICATIONS_EMAIL_FROM." };

  const maxPairs = Math.max(1, Math.min(500, args.maxPairs ?? 150));
  const cutoffIso = new Date(Date.now() - MIN_MS_BETWEEN_SENDS).toISOString();

  let settingsQuery = supabase
    .from("user_notification_settings")
    .select(
      "user_id, client_id, email_enabled, weekly_growth_report_enabled, last_weekly_growth_report_sent_at"
    )
    .eq("email_enabled", true)
    .eq("weekly_growth_report_enabled", true);

  if (!args.ignoreLastSent) {
    settingsQuery = settingsQuery.or(
      `last_weekly_growth_report_sent_at.is.null,last_weekly_growth_report_sent_at.lt.${cutoffIso}`
    );
  }

  const { data: settings, error: sErr } = await settingsQuery.limit(maxPairs);

  if (sErr) {
    console.error("weekly growth settings:", sErr);
    return { ok: false, error: "Failed to load notification settings." };
  }

  const targets = (settings ?? []).filter(
    (r: Record<string, unknown>) => r?.user_id && r?.client_id
  ) as Array<{
    user_id: string;
    client_id: string;
  }>;

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const group of chunk(targets, 15)) {
    await Promise.all(
      group.map(async (t) => {
        const { data: uidData } = await supabase.auth.admin.getUserById(t.user_id).catch(() => ({
          data: null as { user?: { email?: string | null } } | null,
        }));
        const email = uidData?.user?.email ?? null;
        if (!email) {
          skipped += 1;
          return;
        }

        try {
          const payload = await buildWeeklyGrowthDigestPayload(supabase, t.client_id, t.user_id);
          const formatted = formatWeeklyGrowthReportEmail({
            appName: cfg.appName,
            baseUrl: cfg.baseUrl,
            payload,
          });
          const sendRes = await sendWeeklyGrowthReportEmail({
            to: email,
            subject: formatted.subject,
            html: formatted.html,
          });
          if (!sendRes.ok) {
            console.error("weekly growth email:", sendRes.error);
            errors += 1;
            return;
          }

          const { error: upErr } = await supabase
            .from("user_notification_settings")
            .update({ last_weekly_growth_report_sent_at: new Date().toISOString() })
            .eq("user_id", t.user_id)
            .eq("client_id", t.client_id);
          if (upErr) console.error("weekly growth last_sent update:", upErr);

          sent += 1;
        } catch (e) {
          console.error("weekly growth digest row:", e);
          errors += 1;
        }
      })
    );
  }

  return { ok: true, sent, skipped, errors };
}
