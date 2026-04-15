"use client";

import { useMemo, useState } from "react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { SimpleModal } from "@/app/components/ui/SimpleModal";
import { PlatformConnectionCard } from "@/app/components/connections/PlatformConnectionCard";
import { WooCommerceSetupGuide } from "@/app/components/connections/WooCommerceSetupGuide";
import { ShopifySetupGuide } from "@/app/components/connections/ShopifySetupGuide";
import type { StoreConnectionsSnapshot } from "@/lib/store-connections/types";

export function ConnectionsClient({ initial }: { initial: StoreConnectionsSnapshot }) {
  const [snapshot, setSnapshot] = useState<StoreConnectionsSnapshot>(initial);
  const [busy, setBusy] = useState<null | "woocommerce" | "shopify">(null);
  const [error, setError] = useState<string | null>(null);

  const [wooModalOpen, setWooModalOpen] = useState(false);
  const [wooHelpOpen, setWooHelpOpen] = useState(false);
  const [shopifyHelpOpen, setShopifyHelpOpen] = useState(false);

  const [wooStoreUrl, setWooStoreUrl] = useState("");
  const [wooCk, setWooCk] = useState("");
  const [wooCs, setWooCs] = useState("");

  const wooConnected = snapshot.woocommerce.status === "connected";

  const wooDomainLabel = useMemo(() => {
    return snapshot.woocommerce.storeDomain ?? null;
  }, [snapshot.woocommerce.storeDomain]);

  async function reloadWooStatus() {
    const res = await fetch("/api/woocommerce/connection");
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.connected) {
      const storeUrl = typeof json.connection?.store_url === "string" ? json.connection.store_url : "";
      setSnapshot((prev) => ({
        ...prev,
        woocommerce: {
          ...prev.woocommerce,
          status: "connected",
          storeDomain: storeUrl ? storeUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "") : prev.woocommerce.storeDomain,
        },
      }));
    } else {
      setSnapshot((prev) => ({
        ...prev,
        woocommerce: { ...prev.woocommerce, status: "not_connected", storeDomain: null },
      }));
    }
  }

  function openWooConnect() {
    setError(null);
    setWooStoreUrl(wooConnected ? (snapshot.woocommerce.storeDomain ? `https://${snapshot.woocommerce.storeDomain}` : "") : "");
    setWooCk("");
    setWooCs("");
    setWooModalOpen(true);
  }

  async function saveWoo() {
    setError(null);
    setBusy("woocommerce");
    try {
      const res = await fetch("/api/woocommerce/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_url: wooStoreUrl,
          consumer_key: wooCk,
          consumer_secret: wooCs,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Could not connect.");
        return;
      }
      setWooModalOpen(false);
      await reloadWooStatus();
    } finally {
      setBusy(null);
    }
  }

  async function disconnectWoo() {
    setError(null);
    setBusy("woocommerce");
    try {
      const res = await fetch("/api/woocommerce/connection", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Could not disconnect.");
        return;
      }
      await reloadWooStatus();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformConnectionCard
          platformLabel="WooCommerce"
          description="Connect your WordPress / WooCommerce store to import and optimize products."
          status={wooConnected ? "connected" : "not_connected"}
          connectedDomain={wooDomainLabel}
          primaryAction={wooConnected ? "reconnect" : "connect"}
          onPrimaryAction={openWooConnect}
          onDisconnect={disconnectWoo}
          onHelp={() => setWooHelpOpen(true)}
          busy={busy === "woocommerce"}
        />

        <PlatformConnectionCard
          platformLabel="Shopify"
          description="Connect your Shopify store to sync products and generate optimized content."
          status="coming_soon"
          connectedDomain={null}
          primaryAction="connect"
          onPrimaryAction={() => setShopifyHelpOpen(true)}
          onHelp={() => setShopifyHelpOpen(true)}
          busy={busy === "shopify"}
          disabledReason="Shopify app setup is in progress. Finish setup, then enable the connection flow."
        />
      </div>

      <SimpleModal
        title={wooConnected ? "Reconnect WooCommerce" : "Connect WooCommerce"}
        open={wooModalOpen}
        onClose={() => setWooModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-white/65">
            Add your store URL and WooCommerce REST API keys. Product sync and writeback happens only
            when you explicitly choose actions inside Products.
          </p>

          <div>
            <label className="text-xs font-semibold text-white/60">Store URL</label>
            <Input
              value={wooStoreUrl}
              onChange={(e) => setWooStoreUrl(e.target.value)}
              placeholder="https://yourstore.com"
              className="mt-1.5 rounded-2xl"
              disabled={busy === "woocommerce"}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60">Consumer key</label>
            <Input
              value={wooCk}
              onChange={(e) => setWooCk(e.target.value)}
              placeholder="ck_..."
              className="mt-1.5 rounded-2xl"
              disabled={busy === "woocommerce"}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60">Consumer secret</label>
            <Input
              value={wooCs}
              onChange={(e) => setWooCs(e.target.value)}
              placeholder="cs_..."
              className="mt-1.5 rounded-2xl"
              disabled={busy === "woocommerce"}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void saveWoo()}
              disabled={busy === "woocommerce"}
            >
              {busy === "woocommerce" ? "Saving…" : wooConnected ? "Save & reconnect" : "Connect"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => setWooModalOpen(false)}
              disabled={busy === "woocommerce"}
            >
              Cancel
            </Button>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
            Security note: keys are stored server-side in your Supabase project and scoped to your workspace.
          </div>
        </div>
      </SimpleModal>

      <SimpleModal
        title="WooCommerce setup guide"
        open={wooHelpOpen}
        onClose={() => setWooHelpOpen(false)}
      >
        <WooCommerceSetupGuide />
      </SimpleModal>

      <SimpleModal
        title="Shopify setup guide"
        open={shopifyHelpOpen}
        onClose={() => setShopifyHelpOpen(false)}
      >
        <ShopifySetupGuide />
      </SimpleModal>
    </div>
  );
}

