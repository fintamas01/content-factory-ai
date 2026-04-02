"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushClient() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
  }, []);

  useEffect(() => {
    if (!supported) return;
    // Register SW early so the bell/settings can subscribe instantly later.
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [supported]);

  return null;
}

export async function enablePushNotifications(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Push is not supported in this browser." };
  }
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  if (!publicKey) return { ok: false, error: "Missing VAPID public key." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "Permission denied." };

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: typeof json.error === "string" ? json.error : "Subscribe failed." };
  return { ok: true };
}

