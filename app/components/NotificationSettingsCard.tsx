"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, Mail } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { enablePushNotifications } from "@/app/components/PushClient";

type Settings = {
  email_enabled: boolean;
  email_digest_frequency: "off" | "instant" | "daily" | "weekly";
  push_enabled: boolean;
  push_instant_severity: "info" | "success" | "warning" | "critical";
};

export function NotificationSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    email_enabled: true,
    email_digest_frequency: "daily",
    push_enabled: false,
    push_instant_severity: "critical",
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/notifications/settings");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.settings) setSettings({ ...settings, ...json.settings });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Save failed.");
        return;
      }
      if (json.settings) setSettings((p) => ({ ...p, ...(json.settings as any) }));
    } finally {
      setSaving(false);
    }
  };

  const onEnablePush = async () => {
    setError(null);
    const res = await enablePushNotifications();
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await save({ push_enabled: true });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-6 text-white/70">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading delivery preferences…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Delivery
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Email & Push</h2>
          <p className="mt-2 text-sm text-slate-500">
            Keep alerts high-signal. Use digests for routine items, push for urgent ones.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Email digests</p>
              <p className="mt-1 text-xs text-white/45">
                A curated batch of unread alerts.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-white/70">Enabled</label>
            <input
              type="checkbox"
              checked={settings.email_enabled}
              onChange={(e) => {
                setSettings((p) => ({ ...p, email_enabled: e.target.checked }));
                void save({ email_enabled: e.target.checked });
              }}
              className="h-4 w-4"
              disabled={saving}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-white/70">Frequency</label>
            <select
              value={settings.email_digest_frequency}
              onChange={(e) => {
                const v = e.target.value as Settings["email_digest_frequency"];
                setSettings((p) => ({ ...p, email_digest_frequency: v }));
                void save({ email_digest_frequency: v });
              }}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white outline-none"
              disabled={saving || !settings.email_enabled}
            >
              <option value="off">Off</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70">
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Browser push</p>
              <p className="mt-1 text-xs text-white/45">
                Instant alerts on supported browsers.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-white/70">Enabled</label>
            <input
              type="checkbox"
              checked={settings.push_enabled}
              onChange={(e) => {
                setSettings((p) => ({ ...p, push_enabled: e.target.checked }));
                void save({ push_enabled: e.target.checked });
              }}
              className="h-4 w-4"
              disabled={saving}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-white/70">Instant threshold</label>
            <select
              value={settings.push_instant_severity}
              onChange={(e) => {
                const v = e.target.value as Settings["push_instant_severity"];
                setSettings((p) => ({ ...p, push_instant_severity: v }));
                void save({ push_instant_severity: v });
              }}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white outline-none"
              disabled={saving || !settings.push_enabled}
            >
              <option value="critical">Critical only</option>
              <option value="warning">Warning+</option>
              <option value="success">Success+</option>
              <option value="info">All</option>
            </select>
          </div>

          <div className="mt-4">
            <Button
              type="button"
              onClick={() => void onEnablePush()}
              disabled={saving}
              variant="primary"
              className="w-full h-11 rounded-2xl text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Enable push for this browser
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

