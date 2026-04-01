"use client";

import { useMemo, useState, useEffect, type ComponentType, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { stripHtmlForAnalysis, type ProductHealthResult } from "@/lib/products/product-health";
import {
  Loader2,
  Package,
  Sparkles,
  Copy,
  CheckCircle2,
  ListOrdered,
  AlignLeft,
  Heading2,
  Search,
  Check,
  Plug,
  RefreshCcw,
  Link as LinkIcon,
  Activity,
  Columns2,
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import type { ProductCopyResult } from "@/lib/products/types";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

const TONE_OPTIONS = [
  { value: "", label: "Default (balanced)" },
  { value: "professional", label: "Professional" },
  { value: "modern", label: "Modern" },
  { value: "persuasive", label: "Persuasive" },
  { value: "luxury", label: "Luxury" },
  { value: "friendly", label: "Friendly" },
];

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

function SectionCard({
  icon: Icon,
  eyebrow,
  title,
  children,
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-200 shadow-inner">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              {eyebrow}
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default function ProductGeniePage() {
  const m = MODULES.products;
  const [mode, setMode] = useState<"manual" | "store">("manual");
  const [activeTab, setActiveTab] = useState<
    "description" | "bullets" | "seo" | "marketplace" | "sync" | "compare"
  >("description");

  const [productName, setProductName] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");
  const [keyBenefits, setKeyBenefits] = useState("");

  const [existingTitle, setExistingTitle] = useState("");
  const [existingDescription, setExistingDescription] = useState("");
  const [existingShortDescription, setExistingShortDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductCopyResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [unifiedBrand, setUnifiedBrand] = useState<UserBrandProfileRow | null>(null);
  const [usageBump, setUsageBump] = useState(0);

  // WooCommerce connection + product selection
  const [wooConnected, setWooConnected] = useState(false);
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  const [wooCk, setWooCk] = useState("");
  const [wooCs, setWooCs] = useState("");
  const [wooSaving, setWooSaving] = useState(false);
  const [wooEditing, setWooEditing] = useState(false);
  const [wooLoadingList, setWooLoadingList] = useState(false);
  const [wooLastRefreshAt, setWooLastRefreshAt] = useState<string | null>(null);
  const [wooQuery, setWooQuery] = useState("");
  const [wooItems, setWooItems] = useState<Array<any>>([]);
  const [wooSelectedId, setWooSelectedId] = useState<number | null>(null);
  const [wooProductLoading, setWooProductLoading] = useState(false);
  const [wooSyncStatus, setWooSyncStatus] = useState<
    | { state: "idle" }
    | { state: "ready"; storeUrl: string; productId: number }
    | { state: "updated"; fields: string[]; at: string }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const [wooUpdateFields, setWooUpdateFields] = useState({
    title: true,
    description: true,
    short: true,
  });

  const [healthResult, setHealthResult] = useState<ProductHealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [wooInsights, setWooInsights] = useState<{
    connected: boolean;
    total: number;
    needOptimization: number;
    weakShort: number;
    queue: Array<{ id: number; name: string; heuristicScore: number; sku?: string | null }>;
  } | null>(null);

  useCopilotPageContext({
    page: "products",
    data: {
      mode,
      activeTab,
      productName,
      productDetails,
      targetAudience,
      tone,
      keyBenefits,
      existingTitle,
      existingDescription,
      existingShortDescription,
      woo: {
        connected: wooConnected,
        storeUrl: wooStoreUrl || undefined,
        selectedId: wooSelectedId ?? undefined,
        syncStatus: wooSyncStatus,
      },
      healthScore: healthResult?.score,
      result,
      savedId,
    },
  });

  const canGenerate = useMemo(() => {
    if (mode === "manual") return productName.trim().length > 0;
    if (mode === "store") return wooSelectedId !== null && productName.trim().length > 0;
    return false;
  }, [mode, productName, wooSelectedId]);

  const canImprove = useMemo(() => {
    const hasExisting =
      existingTitle.trim() || existingDescription.trim() || existingShortDescription.trim();
    if (mode === "manual") return Boolean(hasExisting) && productName.trim().length > 0;
    if (mode === "store") return Boolean(hasExisting) && wooSelectedId !== null;
    return false;
  }, [mode, existingTitle, existingDescription, existingShortDescription, productName, wooSelectedId]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/brand-profile");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.profile) setUnifiedBrand(json.profile as UserBrandProfileRow);
      else setUnifiedBrand(null);
    })();
  }, []);

  useEffect(() => {
    if (mode !== "store" || !wooConnected) {
      setWooInsights(null);
      return;
    }
    void (async () => {
      const res = await fetch("/api/woocommerce/products/insights");
      const json = await res.json().catch(() => ({}));
      if (res.ok) setWooInsights(json);
    })();
  }, [mode, wooConnected, wooLastRefreshAt]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/woocommerce/connection");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.connected) {
        setWooConnected(true);
        if (typeof json.connection?.store_url === "string") setWooStoreUrl(json.connection.store_url);
        setWooEditing(false);
      } else {
        setWooConnected(false);
      }
    })();
  }, []);

  const runGeneration = async (kind: "generate" | "improve") => {
    setError(null);
    setResult(null);
    setSavedId(null);
    const name = productName.trim();
    if (!name) {
      setError("Enter a product name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name,
          productDetails: productDetails.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          tone: tone.trim() || undefined,
          keyBenefits: keyBenefits.trim() || undefined,
          existingTitle: kind === "improve" ? existingTitle.trim() || undefined : undefined,
          existingDescription:
            kind === "improve" ? existingDescription.trim() || undefined : undefined,
          existingShortDescription:
            kind === "improve" ? existingShortDescription.trim() || undefined : undefined,
          source: mode === "store" ? "woocommerce" : "manual",
          sourceMeta:
            mode === "store" && wooSelectedId
              ? { product_id: wooSelectedId, store_url: wooStoreUrl || null }
              : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === "USAGE_LIMIT") {
          setError(
            `${typeof json.error === "string" ? json.error : "Limit reached."} Upgrade on the Billing page for a higher quota.`
          );
          return;
        }
        setError(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      if (json.result) setResult(json.result as ProductCopyResult);
      else {
        setError("Unexpected response.");
        return;
      }
      if (typeof json.savedId === "string") setSavedId(json.savedId);
      setUsageBump((n) => n + 1);
      setActiveTab("description");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const connectWoo = async () => {
    setError(null);
    setWooSaving(true);
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
        setError(typeof json.error === "string" ? json.error : "Could not connect.");
        return;
      }
      setWooConnected(true);
      setWooEditing(false);
      setWooCk("");
      setWooCs("");
      setWooSyncStatus({ state: "idle" });
    } catch {
      setError("Network error connecting store.");
    } finally {
      setWooSaving(false);
    }
  };

  const disconnectWoo = async () => {
    setError(null);
    setWooSaving(true);
    try {
      const res = await fetch("/api/woocommerce/connection", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not disconnect.");
        return;
      }
      setWooConnected(false);
      setWooEditing(false);
      setWooItems([]);
      setWooSelectedId(null);
      setWooQuery("");
      setWooSyncStatus({ state: "idle" });
    } catch {
      setError("Network error disconnecting store.");
    } finally {
      setWooSaving(false);
    }
  };

  const loadWooProducts = async () => {
    if (!wooConnected) return;
    setWooLoadingList(true);
    try {
      const qs = new URLSearchParams();
      if (wooQuery.trim()) qs.set("search", wooQuery.trim());
      const res = await fetch(`/api/woocommerce/products?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not fetch products.");
        return;
      }
      setWooItems(Array.isArray(json.items) ? json.items : []);
      setWooLastRefreshAt(new Date().toISOString());
    } catch {
      setError("Network error fetching products.");
    } finally {
      setWooLoadingList(false);
    }
  };

  useEffect(() => {
    if (mode !== "store" || !wooConnected) return;
    void loadWooProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wooConnected]);

  const loadWooProduct = async (productId: number) => {
    setError(null);
    setWooProductLoading(true);
    setWooSyncStatus({ state: "idle" });
    try {
      const res = await fetch(`/api/woocommerce/products/${productId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not fetch product.");
        return;
      }
      const p = json.product;
      setProductName(String(p?.name ?? ""));
      setExistingTitle(String(p?.name ?? ""));
      setExistingDescription(String(p?.description ?? ""));
      setExistingShortDescription(String(p?.short_description ?? ""));
      setHealthResult(null);
      setWooSyncStatus({
        state: "ready",
        storeUrl: String(wooStoreUrl || ""),
        productId,
      });
    } catch {
      setError("Network error fetching product.");
    } finally {
      setWooProductLoading(false);
    }
  };

  const runHealthAnalysis = async () => {
    if (!wooSelectedId) {
      setError("Select a WooCommerce product first.");
      return;
    }
    setError(null);
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/woocommerce/products/${wooSelectedId}/health`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === "USAGE_LIMIT") {
          setError(
            `${typeof json.error === "string" ? json.error : "Limit reached."} Upgrade on the Billing page for a higher quota.`
          );
          return;
        }
        setError(typeof json.error === "string" ? json.error : "Health analysis failed.");
        return;
      }
      if (json.health) setHealthResult(json.health as ProductHealthResult);
      setUsageBump((n) => n + 1);
    } catch {
      setError("Network error running health analysis.");
    } finally {
      setHealthLoading(false);
    }
  };

  const runWooOptimize = async () => {
    if (!wooSelectedId) {
      setError("Select a WooCommerce product first.");
      return;
    }
    setError(null);
    setOptimizeLoading(true);
    setResult(null);
    setSavedId(null);
    try {
      const res = await fetch(`/api/woocommerce/products/${wooSelectedId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ health: healthResult ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === "USAGE_LIMIT") {
          setError(
            `${typeof json.error === "string" ? json.error : "Limit reached."} Upgrade on the Billing page for a higher quota.`
          );
          return;
        }
        setError(typeof json.error === "string" ? json.error : "Optimization failed.");
        return;
      }
      if (json.result) {
        setResult(json.result as ProductCopyResult);
        setActiveTab("compare");
      } else {
        setError("Unexpected response.");
        return;
      }
      if (typeof json.savedId === "string") setSavedId(json.savedId);
      setUsageBump((n) => n + 1);
    } catch {
      setError("Network error optimizing product.");
    } finally {
      setOptimizeLoading(false);
    }
  };

  const updateInStore = async (opts: { title: boolean; description: boolean; short: boolean }) => {
    if (!wooSelectedId || !result) return;
    const patch: any = {};
    if (opts.title) patch.name = result.title;
    if (opts.description) patch.description = result.description;
    if (opts.short) patch.short_description = result.short_description ?? "";
    if (Object.keys(patch).length === 0) return;
    setWooSyncStatus({ state: "idle" });
    try {
      const res = await fetch(`/api/woocommerce/products/${wooSelectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWooSyncStatus({ state: "error", message: typeof json.error === "string" ? json.error : "Update failed." });
        return;
      }
      setWooSyncStatus({ state: "updated", fields: Array.isArray(json.updated) ? json.updated : [], at: new Date().toISOString() });
    } catch {
      setWooSyncStatus({ state: "error", message: "Network error updating store." });
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAll = (r: ProductCopyResult) => {
    const text = [
      r.title,
      "",
      r.description,
      "",
      ...r.bullets.map((b) => `• ${b}`),
      "",
      `SEO title: ${r.seo_title}`,
      `SEO description: ${r.seo_description}`,
    ].join("\n");
    copy(text, "all");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20 p-4 sm:p-6 lg:p-8 text-white">
      <ModulePageHeader moduleId="products" />

      <ModuleUsageBanner feature="product" bump={usageBump} />

      {unifiedBrand ? (
        <p className="mb-4 text-xs font-semibold text-emerald-200/90">
          Using your saved brand profile
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Left: Source + inputs */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.10] bg-white/[0.03] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100"
              aria-hidden
              style={{
                background:
                  "radial-gradient(1000px 420px at 35% -10%, rgba(124,58,237,0.18), transparent 55%), radial-gradient(900px 420px at 110% 10%, rgba(59,130,246,0.12), transparent 52%)",
              }}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-violet-200/90 mb-1">
                  {m.productName}
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                  Product AI workspace
                </h1>
                <p className="mt-2 text-white/55 font-medium text-sm leading-relaxed">
                  Generate or optimize listings. Manual or connected store.
                </p>
              </div>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-200 shadow-inner">
                <Package className="h-6 w-6" />
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
              <Button
                type="button"
                onClick={() => setMode("manual")}
                variant={mode === "manual" ? "primary" : "secondary"}
                className="h-11 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
              >
                Manual
              </Button>
              <Button
                type="button"
                onClick={() => setMode("store")}
                variant={mode === "store" ? "primary" : "secondary"}
                className="h-11 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
              >
                Connected store
              </Button>
            </div>
          </div>

          {mode === "store" ? (
            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.10] bg-white/[0.03] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(950px 420px at 20% -10%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(900px 420px at 120% 20%, rgba(16,185,129,0.10), transparent 60%)",
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200 shadow-inner">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                      WooCommerce
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight text-white leading-tight">
                      Store connection
                    </h3>
                  </div>
                </div>
                {wooConnected && wooStoreUrl ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                    <LinkIcon className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : null}
              </div>

              {!wooConnected || wooEditing ? (
                <div className="mt-5 grid gap-4">
                  {wooConnected ? (
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
                      You’re updating connection details. This won’t change anything until you save.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65 leading-relaxed">
                      Connect your WooCommerce store to sync products and push updates back safely.
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                      Store URL
                    </label>
                    <Input
                      value={wooStoreUrl}
                      onChange={(e) => setWooStoreUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      className="rounded-2xl"
                      disabled={wooSaving}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                      Consumer key
                    </label>
                    <Input
                      value={wooCk}
                      onChange={(e) => setWooCk(e.target.value)}
                      placeholder="ck_..."
                      className="rounded-2xl"
                      disabled={wooSaving}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                      Consumer secret
                    </label>
                    <Input
                      value={wooCs}
                      onChange={(e) => setWooCs(e.target.value)}
                      placeholder="cs_..."
                      className="rounded-2xl"
                      disabled={wooSaving}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={connectWoo}
                      disabled={wooSaving}
                      variant="primary"
                      className="h-12 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                    >
                      {wooSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4" />
                      )}
                      {wooSaving ? "Saving…" : wooConnected ? "Save changes" : "Connect store"}
                    </Button>
                    {wooConnected ? (
                      <Button
                        type="button"
                        onClick={() => setWooEditing(false)}
                        disabled={wooSaving}
                        variant="secondary"
                        className="h-12 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Stored in your Supabase project with row-level security. For additional hardening,
                    encrypt secrets at rest.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                      Connected domain
                    </p>
                    <p className="mt-1 truncate text-sm font-mono text-white/70">
                      {wooStoreUrl}
                    </p>
                    {wooLastRefreshAt ? (
                      <p className="mt-1 text-[11px] text-white/40">
                        Last refreshed{" "}
                        <span className="font-mono text-white/60">
                          {new Date(wooLastRefreshAt).toLocaleString()}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-white/40">
                        Refresh to load your latest catalog.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      onClick={() => loadWooProducts()}
                      disabled={wooLoadingList || wooSaving}
                      variant="primary"
                      className="h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                    >
                      {wooLoadingList ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setWooEditing(true)}
                      disabled={wooSaving}
                      variant="secondary"
                      className="h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                    >
                      Change store
                    </Button>
                    <Button
                      type="button"
                      onClick={disconnectWoo}
                      disabled={wooSaving}
                      variant="danger"
                      className="h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                    >
                      Disconnect
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        value={wooQuery}
                        onChange={(e) => setWooQuery(e.target.value)}
                        placeholder="Search products…"
                        className="rounded-2xl pl-10"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => loadWooProducts()}
                      disabled={wooLoadingList}
                      variant="secondary"
                      className="h-11 rounded-2xl px-5 text-[11px] font-black uppercase tracking-[0.22em]"
                    >
                      Search
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                      Select product
                    </label>
                    <select
                      value={wooSelectedId ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!n) {
                          setWooSelectedId(null);
                          setHealthResult(null);
                          return;
                        }
                        setWooSelectedId(n);
                        setHealthResult(null);
                        void loadWooProduct(n);
                      }}
                      className="w-full rounded-2xl border border-white/[0.10] bg-black/30 px-4 py-3.5 text-sm font-semibold text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/[0.14] focus:shadow-[0_0_0_3px_var(--ring)] cursor-pointer"
                      disabled={wooProductLoading || wooLoadingList}
                    >
                      <option value="">Choose a product…</option>
                      {wooItems.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </option>
                      ))}
                    </select>
                    {wooProductLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          Loading product…
                        </div>
                      </div>
                    ) : wooItems.length === 0 && !wooLoadingList ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-4 text-sm text-white/45">
                        No products loaded yet. Click <span className="text-white/80">Refresh</span> to pull your latest catalog.
                      </div>
                    ) : wooLoadingList ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          Loading products…
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {wooInsights?.connected ? (
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/90">
                            Optimization queue
                          </p>
                          <p className="mt-1 text-xs text-white/55 leading-relaxed">
                            Heuristic preview — lowest scores first. Select a row to open the product.
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-mono text-white/60">
                          {wooInsights.total} synced
                        </span>
                      </div>
                      <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {wooInsights.queue.slice(0, 10).map((q) => (
                          <li key={q.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setWooSelectedId(q.id);
                                setHealthResult(null);
                                void loadWooProduct(q.id);
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                                wooSelectedId === q.id
                                  ? "border-violet-400/40 bg-violet-500/15 text-white"
                                  : "border-white/10 bg-black/25 text-white/75 hover:border-white/20"
                              }`}
                            >
                              <span className="min-w-0 truncate font-semibold">{q.name}</span>
                              <span className="shrink-0 font-mono text-[10px] text-white/45">
                                {q.heuristicScore}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/90">
                          Auto-optimization
                        </p>
                        <p className="mt-1 text-xs text-white/55 leading-relaxed">
                          Analyze listing health, then generate improved copy aligned with your brand profile.
                          Store updates are always explicit — use Sync / Update.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            onClick={() => void runHealthAnalysis()}
                            disabled={!wooSelectedId || healthLoading || optimizeLoading}
                            variant="secondary"
                            className="h-11 flex-1 rounded-2xl text-[11px] font-black uppercase tracking-[0.18em]"
                          >
                            {healthLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Activity className="h-4 w-4" />
                            )}
                            {healthLoading ? "Analyzing…" : "Analyze health"}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void runWooOptimize()}
                            disabled={!wooSelectedId || optimizeLoading || healthLoading}
                            variant="primary"
                            className="h-11 flex-1 rounded-2xl text-[11px] font-black uppercase tracking-[0.18em]"
                          >
                            {optimizeLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {optimizeLoading ? "Generating…" : "Full optimize"}
                          </Button>
                        </div>
                        {healthResult ? (
                          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
                            <p className="font-mono text-[11px] text-emerald-200/90">
                              Score {healthResult.score}/100
                            </p>
                            {healthResult.issues.length ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-white/65">
                                {healthResult.issues.slice(0, 4).map((i, idx) => (
                                  <li key={`${idx}-${i.title}`}>
                                    <span className="font-semibold text-white/85">{i.title}</span>
                                    {i.impact ? (
                                      <span className="text-white/45"> · {i.impact}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-white/[0.10] bg-white/[0.03] p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_36px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40 mb-2">
              Inputs
            </p>
            <div className="grid gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                  Product name <span className="text-violet-200">*</span>
                </label>
                <Input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. AeroBrew Smart Kettle"
                  className="rounded-2xl"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                    Target audience <span className="text-white/35 font-bold">(optional)</span>
                  </label>
                  <Input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. remote teams, new parents"
                    className="rounded-2xl"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                    Tone <span className="text-white/35 font-bold">(optional)</span>
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.10] bg-black/30 px-4 py-3.5 text-sm font-semibold text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/[0.14] focus:shadow-[0_0_0_3px_var(--ring)] cursor-pointer"
                    disabled={loading}
                  >
                    {TONE_OPTIONS.map((p) => (
                      <option key={p.value || "default"} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                  Key benefits <span className="text-white/35 font-bold">(optional)</span>
                </label>
                <Textarea
                  value={keyBenefits}
                  onChange={(e) => setKeyBenefits(e.target.value)}
                  placeholder="One per line or short notes — e.g. saves 2h/week, lifetime warranty…"
                  rows={4}
                  className="rounded-2xl resize-y min-h-[100px]"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45 block mb-2">
                  Product details / notes <span className="text-white/35 font-bold">(optional)</span>
                </label>
                <Textarea
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                  placeholder="Materials, size, category, differentiators…"
                  rows={3}
                  className="rounded-2xl resize-y min-h-[88px]"
                  disabled={loading}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Improve existing product (optional)
                </p>
                <div className="mt-3 grid gap-3">
                  <Input
                    value={existingTitle}
                    onChange={(e) => setExistingTitle(e.target.value)}
                    placeholder="Existing title (optional)"
                    className="rounded-2xl bg-black/25"
                    disabled={loading}
                  />
                  <Textarea
                    value={existingShortDescription}
                    onChange={(e) => setExistingShortDescription(e.target.value)}
                    placeholder="Existing short description (optional)"
                    rows={2}
                    className="rounded-2xl bg-black/25 resize-y"
                    disabled={loading}
                  />
                  <Textarea
                    value={existingDescription}
                    onChange={(e) => setExistingDescription(e.target.value)}
                    placeholder="Existing long description (optional)"
                    rows={4}
                    className="rounded-2xl bg-black/25 resize-y"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => runGeneration("generate")}
                  disabled={loading || !canGenerate}
                  variant="primary"
                  className="h-12 flex-1 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate
                </Button>
                <Button
                  type="button"
                  onClick={() => runGeneration("improve")}
                  disabled={loading || !canImprove}
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Improve
                </Button>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm font-medium text-red-200">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {result ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[20px] border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  <Check className="h-5 w-5 shrink-0" />
                  {savedId ? (
                    <span>
                      Saved to your account
                      <span className="ml-2 font-mono text-xs opacity-70">#{savedId.slice(0, 8)}…</span>
                    </span>
                  ) : (
                    <span>Generated (save skipped — check DB migration if unexpected)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => copyAll(result)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-900 hover:bg-white dark:bg-[#0b1220] dark:text-emerald-100 dark:hover:bg-[#111827]"
                >
                  {copiedKey === "all" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy all
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {[
                    ...(mode === "store" && result && wooSelectedId
                      ? [{ id: "compare" as const, label: "Compare" }]
                      : []),
                    { id: "description" as const, label: "Description" },
                    { id: "bullets" as const, label: "Bullet points" },
                    { id: "seo" as const, label: "SEO" },
                    { id: "marketplace" as const, label: "Marketplace copy" },
                    { id: "sync" as const, label: "Sync / Update" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                        activeTab === t.id
                          ? "border border-white/20 bg-white/[0.12] text-white shadow-lg shadow-black/20"
                          : "border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-white/15 hover:bg-white/[0.06] hover:text-slate-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "compare" && result && mode === "store" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/60">
                    <Columns2 className="h-4 w-4 text-violet-300" />
                    <span>
                      Current store copy vs AI proposal. Copy any block, then use{" "}
                      <span className="font-semibold text-white/85">Sync / Update</span> to push changes explicitly.
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-4 sm:p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                        Current (WooCommerce)
                      </p>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">Title</p>
                          <p className="text-sm font-semibold text-white">{existingTitle || "—"}</p>
                          <button
                            type="button"
                            onClick={() => copy(existingTitle, "cur-title")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "cur-title" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">
                            Short description
                          </p>
                          <p className="text-sm leading-relaxed text-white/75 whitespace-pre-wrap">
                            {stripHtmlForAnalysis(existingShortDescription) || "—"}
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(stripHtmlForAnalysis(existingShortDescription), "cur-short")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "cur-short" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">
                            Long description
                          </p>
                          <p className="text-sm leading-relaxed text-white/75 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {stripHtmlForAnalysis(existingDescription) || "—"}
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(stripHtmlForAnalysis(existingDescription), "cur-long")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "cur-long" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-[24px] border border-violet-500/20 bg-violet-500/[0.06] p-4 sm:p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/90">
                        AI proposal
                      </p>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">Title</p>
                          <p className="text-sm font-semibold text-white">{result.title}</p>
                          <button
                            type="button"
                            onClick={() => copy(result.title, "ai-title")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "ai-title" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">
                            Short description
                          </p>
                          <p className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
                            {result.short_description ?? "—"}
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(result.short_description ?? "", "ai-short")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "ai-short" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">
                            Long description
                          </p>
                          <p className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {result.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(result.description, "ai-long")}
                            className="mt-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                          >
                            {copiedKey === "ai-long" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">
                            Bullets
                          </p>
                          <ul className="space-y-2 text-sm text-white/85">
                            {result.bullets.map((b, i) => (
                              <li key={i}>• {b}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-1">SEO</p>
                          <p className="text-xs font-semibold text-white">{result.seo_title}</p>
                          <p className="mt-1 text-xs text-white/70">{result.seo_description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "description" ? (
                <div className="space-y-6">
                  <SectionCard
                    icon={Heading2}
                    eyebrow="Listing"
                    title="Product title"
                    actions={
                      <button
                        type="button"
                        onClick={() => copy(result.title, "title")}
                        className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        {copiedKey === "title" ? "Copied" : "Copy"}
                      </button>
                    }
                  >
                    <p className="text-xl font-black leading-snug text-slate-900 dark:text-white md:text-2xl">
                      {result.title}
                    </p>
                  </SectionCard>

                  {result.short_description ? (
                    <SectionCard
                      icon={AlignLeft}
                      eyebrow="Short"
                      title="Short description"
                      actions={
                        <button
                          type="button"
                          onClick={() => copy(result.short_description ?? "", "short")}
                          className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          {copiedKey === "short" ? "Copied" : "Copy"}
                        </button>
                      }
                    >
                      <p className="text-sm font-medium leading-[1.7] text-slate-600 dark:text-slate-300">
                        {result.short_description}
                      </p>
                    </SectionCard>
                  ) : null}

                  <SectionCard
                    icon={AlignLeft}
                    eyebrow="Main copy"
                    title="Description"
                    actions={
                      <button
                        type="button"
                        onClick={() => copy(result.description, "desc")}
                        className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        {copiedKey === "desc" ? "Copied" : "Copy"}
                      </button>
                    }
                  >
                    <p className="text-sm font-medium leading-[1.7] text-slate-600 dark:text-slate-300">
                      {result.description}
                    </p>
                  </SectionCard>
                </div>
              ) : null}

              {activeTab === "bullets" ? (
                <SectionCard icon={ListOrdered} eyebrow="Scan-friendly" title="Bullet points">
                  <ul className="space-y-3">
                    {result.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-800 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-200"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-[11px] font-black text-violet-600 dark:text-violet-400">
                          {i + 1}
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {activeTab === "seo" ? (
                <SectionCard icon={Search} eyebrow="Search" title="SEO">
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 dark:border-white/5 dark:bg-[#070d18]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          SEO title
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(result.seo_title, "seo-t")}
                          className="text-xs font-bold text-violet-600 dark:text-violet-400"
                        >
                          {copiedKey === "seo-t" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {result.seo_title}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {result.seo_title.length} characters
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 dark:border-white/5 dark:bg-[#070d18]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          SEO description
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(result.seo_description, "seo-d")}
                          className="text-xs font-bold text-violet-600 dark:text-violet-400"
                        >
                          {copiedKey === "seo-d" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                        {result.seo_description}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {result.seo_description.length} characters
                      </p>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {activeTab === "marketplace" ? (
                <SectionCard icon={Package} eyebrow="Optional" title="Marketplace copy">
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-sm text-slate-400">
                    Marketplace-specific formats (Amazon/eBay/Etsy) are scaffolded for the next iteration.
                  </div>
                </SectionCard>
              ) : null}

              {activeTab === "sync" ? (
                <SectionCard icon={RefreshCcw} eyebrow="Sync / Update" title="WooCommerce writeback">
                  {mode !== "store" ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-sm text-slate-400">
                      Switch to <span className="text-white">Connected store</span> mode to update a product in WooCommerce.
                    </div>
                  ) : wooSelectedId ? (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Choose exactly what you want to update in your store. Nothing is overwritten silently.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={wooUpdateFields.title}
                            onChange={(e) => setWooUpdateFields((p) => ({ ...p, title: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          <span className="font-semibold">Title</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={wooUpdateFields.description}
                            onChange={(e) => setWooUpdateFields((p) => ({ ...p, description: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          <span className="font-semibold">Long description</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={wooUpdateFields.short}
                            onChange={(e) => setWooUpdateFields((p) => ({ ...p, short: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          <span className="font-semibold">Short description</span>
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => updateInStore({ title: false, description: true, short: false })}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/[0.1]"
                        >
                          Long only
                        </button>
                        <button
                          type="button"
                          onClick={() => updateInStore({ title: false, description: false, short: true })}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/[0.1]"
                        >
                          Short only
                        </button>
                        <button
                          type="button"
                          onClick={() => updateInStore({ title: false, description: true, short: true })}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/[0.1]"
                        >
                          Both bodies
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        SEO title/description stay in-app for now; Woo SEO plugins often use separate meta fields — a dedicated sync hook can be added later.
                      </p>
                      <button
                        type="button"
                        onClick={() => updateInStore(wooUpdateFields)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Update in store (selected fields)
                      </button>
                      {wooSyncStatus.state === "updated" ? (
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                          Updated: {wooSyncStatus.fields.join(", ") || "fields"}.
                        </div>
                      ) : wooSyncStatus.state === "error" ? (
                        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {wooSyncStatus.message}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-sm text-slate-400">
                      Select a WooCommerce product first.
                    </div>
                  )}
                </SectionCard>
              ) : null}
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] py-24 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="font-bold text-slate-300">No results yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Pick a product, then generate or improve copy. Your outputs save to History.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
