import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NotificationRow } from "./types";
import { formatNotificationDigestEmail, getEmailConfig, sendNotificationDigestEmail } from "./email";

export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

export function severityRank(sev: string): number {
  if (sev === "critical") return 4;
  if (sev === "warning") return 3;
  if (sev === "success") return 2;
  return 1;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Selects unread notifications that have not been delivered via email, grouped by user+client.
 * MVP sending strategy:
 * - daily/weekly digests: send up to N newest, prefer higher severities first.
 * - instant: handled elsewhere (optional future).
 */
export async function runEmailDigestSend(args: {
  maxUsers?: number;
  perUserMax?: number;
  frequency: "daily" | "weekly";
}): Promise<{ ok: true; sent: number; skipped: number } | { ok: false; error: string }> {
  const supabase = getAdminSupabase();
  if (!supabase) return { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL." };

  const cfg = getEmailConfig();
  if (!cfg.baseUrl) {
    return {
      ok: false,
      error:
        "Missing public site URL: set NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL (used for links in notification emails).",
    };
  }

  const perUserMax = Math.max(1, Math.min(20, args.perUserMax ?? 8));
  const maxUsers = Math.max(1, Math.min(200, args.maxUsers ?? 50));

  // Load settings for users that want this digest frequency.
  const { data: settings, error: sErr } = await supabase
    .from("user_notification_settings")
    .select("user_id, client_id, email_enabled, email_digest_frequency")
    .eq("email_enabled", true)
    .eq("email_digest_frequency", args.frequency)
    .limit(maxUsers);
  if (sErr) {
    console.error("digest settings:", sErr);
    return { ok: false, error: "Failed to load notification settings." };
  }

  const targets = (settings ?? []).filter((r: any) => r?.user_id && r?.client_id) as Array<{
    user_id: string;
    client_id: string;
    email_enabled: boolean;
    email_digest_frequency: string;
  }>;

  let sent = 0;
  let skipped = 0;

  // Batch for performance.
  for (const group of chunk(targets, 20)) {
    await Promise.all(
      group.map(async (t) => {
        const { data: user } = await supabase.auth.admin.getUserById(t.user_id).catch(() => ({ data: null as any }));
        const email = user?.user?.email ?? null;
        if (!email) {
          skipped += 1;
          return;
        }

        // Pull unread notifications not yet delivered via email.
        const { data: notifs, error: nErr } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", t.user_id)
          .eq("client_id", t.client_id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(60);
        if (nErr) {
          console.error("digest notifications:", nErr);
          skipped += 1;
          return;
        }

        const notifications = (notifs ?? []) as unknown as NotificationRow[];
        if (notifications.length === 0) {
          skipped += 1;
          return;
        }

        // Filter out ones already emailed.
        const ids = notifications.map((n) => n.id);
        const { data: deliveries } = await supabase
          .from("notification_deliveries")
          .select("notification_id")
          .in("notification_id", ids)
          .eq("channel", "email");
        const emailed = new Set((deliveries ?? []).map((d: any) => String(d.notification_id)));

        const pending = notifications
          .filter((n) => !emailed.has(n.id))
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

        const sendList = pending.slice(0, perUserMax);
        if (sendList.length === 0) {
          skipped += 1;
          return;
        }

        const { data: clientRow } = await supabase
          .from("clients")
          .select("name")
          .eq("id", t.client_id)
          .maybeSingle();

        const formatted = formatNotificationDigestEmail({
          appName: cfg.appName,
          clientName: (clientRow as any)?.name ?? null,
          baseUrl: cfg.baseUrl,
          notifications: sendList,
        });

        const sendRes = await sendNotificationDigestEmail({
          to: email,
          subject: formatted.subject,
          html: formatted.html,
        });

        if (!sendRes.ok) {
          console.error("digest email failed:", sendRes.error);
          skipped += 1;
          return;
        }

        // Record deliveries to avoid duplicates.
        const rows = sendList.map((n) => ({
          notification_id: n.id,
          channel: "email" as const,
          provider_id: sendRes.id,
          metadata: { frequency: args.frequency },
        }));
        const { error: dErr } = await supabase.from("notification_deliveries").insert(rows);
        if (dErr) console.error("delivery insert:", dErr);

        sent += 1;
      })
    );
  }

  return { ok: true, sent, skipped };
}

