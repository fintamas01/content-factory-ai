import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NotificationRow } from "@/lib/notifications/types";
import { sendWebPush } from "@/lib/notifications/push";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") || "";
  return got && got === secret;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const supabase = getAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    // MVP: send instant push for CRITICAL unread notifications not yet pushed, when user has push enabled.
    const { data: settings } = await supabase
      .from("user_notification_settings")
      .select("user_id, client_id, push_enabled, push_instant_severity")
      .eq("push_enabled", true)
      .limit(200);

    let sent = 0;
    let skipped = 0;

    for (const s of settings ?? []) {
      const userId = (s as any).user_id as string;
      const clientId = (s as any).client_id as string;
      const threshold = String((s as any).push_instant_severity ?? "critical");

      const { data: subs } = await supabase
        .from("web_push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .limit(5);

      if (!subs || subs.length === 0) {
        skipped += 1;
        continue;
      }

      // Pull a small set of unread notifications by severity threshold.
      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      const notifications = (notifs ?? []) as unknown as NotificationRow[];
      if (notifications.length === 0) {
        skipped += 1;
        continue;
      }

      const ids = notifications.map((n) => n.id);
      const { data: deliveries } = await supabase
        .from("notification_deliveries")
        .select("notification_id")
        .in("notification_id", ids)
        .eq("channel", "push");
      const pushed = new Set((deliveries ?? []).map((d: any) => String(d.notification_id)));

      const eligible = notifications
        .filter((n) => !pushed.has(n.id))
        .filter((n) => {
          if (threshold === "info") return true;
          if (threshold === "success") return n.severity !== "info";
          if (threshold === "warning") return n.severity === "warning" || n.severity === "critical";
          return n.severity === "critical";
        })
        .slice(0, 3);

      if (eligible.length === 0) {
        skipped += 1;
        continue;
      }

      for (const n of eligible) {
        const payload = {
          title: n.title,
          body: n.message,
          url: n.action_url ?? "/dashboard/notifications",
        };

        for (const sub of subs) {
          const res = await sendWebPush({
            subscription: {
              endpoint: (sub as any).endpoint,
              keys: { p256dh: (sub as any).p256dh, auth: (sub as any).auth },
            },
            payload,
          });

          if (!res.ok) {
            // 410/404 => subscription is gone, delete it.
            if (res.statusCode === 410 || res.statusCode === 404) {
              await supabase
                .from("web_push_subscriptions")
                .delete()
                .eq("endpoint", (sub as any).endpoint);
            }
            continue;
          }
        }

        await supabase.from("notification_deliveries").insert({
          notification_id: n.id,
          channel: "push",
          metadata: { sent_at: new Date().toISOString() },
        });
        sent += 1;
      }
    }

    return NextResponse.json({ ok: true, sent, skipped });
  } catch (e) {
    console.error("POST /api/cron/notifications-push:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

