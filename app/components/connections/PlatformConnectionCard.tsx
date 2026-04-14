"use client";

import Link from "next/link";
import { ExternalLink, HelpCircle, LogOut, Plug, RefreshCcw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { ConnectionStatusBadge } from "@/app/components/connections/ConnectionStatusBadge";

export function PlatformConnectionCard({
  platformLabel,
  description,
  status,
  connectedDomain,
  primaryAction,
  onPrimaryAction,
  onDisconnect,
  onHelp,
  busy,
  disabledReason,
}: {
  platformLabel: string;
  description: string;
  status: "connected" | "not_connected" | "coming_soon";
  connectedDomain?: string | null;
  primaryAction: "connect" | "reconnect";
  onPrimaryAction?: () => void;
  onDisconnect?: () => void;
  onHelp?: () => void;
  busy?: boolean;
  disabledReason?: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {platformLabel}
          </h3>
          <p className="mt-1 text-sm text-white/55 leading-relaxed">{description}</p>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ConnectionStatusBadge status={status} />
              {status === "connected" && connectedDomain ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-mono text-white/65">
                  Connected store: {connectedDomain}
                </span>
              ) : null}
            </div>

            {status === "connected" ? (
              <p className="text-xs text-white/45">
                Your store is connected. You can now manage and optimize products from the Products page.
              </p>
            ) : disabledReason ? (
              <p className="text-xs text-white/45">{disabledReason}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {status === "connected" ? (
            <>
              <Link
                href="/dashboard/products"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-violet-500/20 to-transparent px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:brightness-110"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Go to Products
              </Link>
              <Button
                type="button"
                variant="secondary"
                className="h-11 rounded-2xl"
                onClick={onPrimaryAction}
                disabled={busy}
              >
                <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
                {busy ? "Working…" : "Reconnect"}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="h-11 rounded-2xl"
                onClick={onDisconnect}
                disabled={busy}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                {busy ? "Disconnecting…" : "Disconnect"}
              </Button>
            </>
          ) : status === "coming_soon" ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
            >
              Planned for next release
            </button>
          ) : (
            <Button
              type="button"
              className="h-11 rounded-2xl"
              onClick={onPrimaryAction}
              disabled={!onPrimaryAction || busy}
            >
              <Plug className="mr-2 h-4 w-4" aria-hidden />
              {busy ? "Working…" : primaryAction === "connect" ? "Connect" : "Reconnect"}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onHelp}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 transition hover:text-white/85"
          >
            <HelpCircle className="h-4 w-4 text-white/50" aria-hidden />
            View setup guide
          </button>
        </div>
      </div>
    </div>
  );
}

