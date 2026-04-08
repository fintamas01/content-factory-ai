"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Link2, Loader2, LogOut, XCircle } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { useSearchParams } from "next/navigation";
import { SimpleModal } from "@/app/components/ui/SimpleModal";

type Connection = {
  id: string;
  platform: "instagram" | "facebook" | "linkedin";
  account_type: string;
  provider_account_id: string;
  account_display_name: string | null;
  status: string;
  connected_at: string;
};

function PlatformCard({
  title,
  description,
  connected,
  onConnect,
  onDisconnect,
  connectedLabel,
  disabledReason,
  busy = false,
}: {
  title: string;
  description: string;
  connected: boolean;
  connectedLabel: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  disabledReason?: string | null;
  busy?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/55 leading-relaxed">{description}</p>
          {connected ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Connected{connectedLabel ? ` · ${connectedLabel}` : ""}
            </div>
          ) : disabledReason ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
              <XCircle className="h-4 w-4" aria-hidden />
              {disabledReason}
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70">
              <Link2 className="h-4 w-4" aria-hidden />
              Not connected
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={!onConnect}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-violet-500/20 to-transparent px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:brightness-110 disabled:opacity-40"
          >
            Connect
          </button>
        )}

        <Link
          href="/dashboard/content"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
        >
          Back to Content
        </Link>
      </div>
    </div>
  );
}

function OAuthResultBanner() {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    const success = searchParams?.get("success");
    const err = searchParams?.get("error");
    if (!success && !err) return;

    const successMsg: Record<string, string> = {
      facebook_connected: "Facebook connected successfully.",
      instagram_connected: "Instagram connected successfully.",
      connected: "Connected successfully.",
    };
    const errorMsg: Record<string, string> = {
      oauth_denied: "Connection was cancelled or denied in Meta.",
      missing_code: "OAuth callback missing code. Please try again.",
      meta_exchange_failed:
        "Could not complete Meta OAuth exchange. Check app credentials and redirect URIs.",
      meta_pages_fetch_failed: "Could not load Pages from Meta. Check permissions and try again.",
      meta_pages_missing: "No Facebook Page was found for this account (or missing permissions).",
      missing_instagram_business_account:
        "No Instagram Business/Creator account is linked to the selected Facebook Page.",
      save_facebook_failed: "Could not save Facebook connection. Please try again.",
      save_instagram_failed: "Could not save Instagram connection. Please try again.",
      linkedin_not_enabled: "LinkedIn connections aren’t enabled yet.",
      oauth_callback_failed: "OAuth callback failed. Please try again.",
    };

    if (success) {
      setBanner({
        kind: "success",
        message: successMsg[success] ?? "Connected successfully.",
      });
    } else if (err) {
      setBanner({
        kind: "error",
        message: errorMsg[err] ?? `Connection failed (${err}).`,
      });
    }

    // Clear the query params so refresh/back doesn't re-trigger banners.
    try {
      window.history.replaceState(null, "", "/dashboard/social-connections");
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  if (!banner) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        banner.kind === "success"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/25 bg-red-500/10 text-red-200"
      }`}
    >
      {banner.message}
    </div>
  );
}

export default function SocialConnectionsPage() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const byPlatform = useMemo(() => {
    const pick = (p: Connection["platform"]) =>
      connections.find((c) => c.platform === p && c.status === "connected") ?? null;
    return {
      instagram: pick("instagram"),
      facebook: pick("facebook"),
      linkedin: pick("linkedin"),
    };
  }, [connections]);

  const load = async () => {
    setError(null);
    const res = await fetch("/api/social-connections");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Could not load connections.");
      setConnections([]);
      return;
    }
    setConnections((json.connections as Connection[]) ?? []);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/social-connections/${id}/disconnect`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not disconnect.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/60">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <Page>
      <PageHero
        icon={<Link2 className="h-6 w-6" />}
        eyebrow="Publishing"
        title="Social connections"
        description="Connect your accounts to publish generated content directly. Tokens are stored server-side and scoped to your current workspace."
      />

      <Suspense fallback={null}>
        <OAuthResultBanner />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
        >
          <HelpCircle className="h-4 w-4 text-white/70" aria-hidden />
          How connections work
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <PlatformCard
          title="Instagram"
          description="Requires an Instagram Business/Creator account connected to a Facebook Page. Publishing is image + caption."
          connected={Boolean(byPlatform.instagram)}
          connectedLabel={byPlatform.instagram?.account_display_name ?? null}
          onConnect={() => {
            window.location.href = "/api/social-connections/connect/instagram";
          }}
          onDisconnect={
            byPlatform.instagram
              ? () => void disconnect(byPlatform.instagram!.id)
              : undefined
          }
          disabledReason={busyId ? "Working…" : null}
          busy={busyId === byPlatform.instagram?.id}
        />
        <PlatformCard
          title="Facebook"
          description="Connect a Facebook Page to publish posts to the Page feed."
          connected={Boolean(byPlatform.facebook)}
          connectedLabel={byPlatform.facebook?.account_display_name ?? null}
          onConnect={() => {
            window.location.href = "/api/social-connections/connect/facebook";
          }}
          onDisconnect={
            byPlatform.facebook
              ? () => void disconnect(byPlatform.facebook!.id)
              : undefined
          }
          disabledReason={busyId ? "Working…" : null}
          busy={busyId === byPlatform.facebook?.id}
        />
        <PlatformCard
          title="LinkedIn"
          description="Member publishing requires LinkedIn OAuth permissions and app approval. This connector is staged after Meta for launch safety."
          connected={Boolean(byPlatform.linkedin)}
          connectedLabel={byPlatform.linkedin?.account_display_name ?? null}
          disabledReason="Coming soon"
        />
      </div>

      <SimpleModal
        title="Social connections: what to expect"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      >
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              What a connection means
            </p>
            <p className="mt-2 text-sm text-slate-300">
              A connection links your social account to this workspace so you can publish posts directly
              from the Content module. Publishing happens only after you explicitly connect and choose to
              publish.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Requirements before connecting
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              <li>Facebook: you must have access to at least one Facebook Page.</li>
              <li>
                Instagram: you need an <strong>Instagram Business or Creator</strong> account connected to a{" "}
                <strong>Facebook Page</strong> (Meta requirement for publishing).
              </li>
              <li>LinkedIn: not enabled yet in this release.</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">How it works</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              <li>You authenticate with the platform (OAuth) and grant permissions.</li>
              <li>
                We store the access token <strong>encrypted</strong> on the server, scoped to your current
                workspace.
              </li>
              <li>When you publish, we use that token to post on your behalf to the connected Page/account.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
            Instagram publishing requires a connected Facebook Page and an Instagram Business/Creator account
            linked to that Page.
          </div>
        </div>
      </SimpleModal>
    </Page>
  );
}

