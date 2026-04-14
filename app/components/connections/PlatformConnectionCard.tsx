"use client";

import Link from "next/link";
import { HelpCircle, LogOut, Plug, RefreshCcw } from "lucide-react";
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
          <div className="mt-3">
            <ConnectionStatusBadge
              status={status}
              label={status === "connected" ? connectedDomain ?? null : null}
            />
            {disabledReason ? (
              <p className="mt-2 text-xs text-amber-200/80">{disabledReason}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {status === "connected" ? (
          <>
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
        ) : (
          <Button
            type="button"
            className="h-11 rounded-2xl"
            onClick={onPrimaryAction}
            disabled={status === "coming_soon" || !onPrimaryAction || busy}
          >
            <Plug className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Working…" : primaryAction === "connect" ? "Connect" : "Reconnect"}
          </Button>
        )}

        <button
          type="button"
          onClick={onHelp}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
        >
          <HelpCircle className="h-4 w-4 text-white/70" aria-hidden />
          View setup guide
        </button>

        <Link
          href="/dashboard/products"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.06]"
        >
          Go to Products
        </Link>
      </div>
    </div>
  );
}

