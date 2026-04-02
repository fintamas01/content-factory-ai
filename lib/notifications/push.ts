import webpush from "web-push";

export type WebPushSubscriptionRow = {
  id: string;
  user_id: string;
  client_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return { ok: false as const, error: "Missing VAPID keys." };
  webpush.setVapidDetails(subject, pub, priv);
  return { ok: true as const };
}

export async function sendWebPush(args: {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  payload: { title: string; body: string; url?: string };
}): Promise<{ ok: true; statusCode: number } | { ok: false; statusCode?: number; error: string }> {
  const cfg = configureWebPush();
  if (!cfg.ok) return { ok: false, error: cfg.error };

  try {
    const r = await webpush.sendNotification(args.subscription as any, JSON.stringify(args.payload));
    return { ok: true, statusCode: r.statusCode };
  } catch (e: any) {
    const statusCode = typeof e?.statusCode === "number" ? e.statusCode : undefined;
    console.error("webpush send:", e);
    return { ok: false, statusCode, error: "Push send failed." };
  }
}

