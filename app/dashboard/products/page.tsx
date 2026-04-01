"use client";

import { useMemo, useState, useEffect, type ComponentType, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
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
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import type { ProductCopyResult } from "@/lib/products/types";

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
    <div className="rounded-[24px] border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0b1220] p-6 md:p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {eyebrow}
            </p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
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
    "description" | "bullets" | "seo" | "marketplace" | "sync"
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
  const [wooLoadingList, setWooLoadingList] = useState(false);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_brand_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setUnifiedBrand(data ?? null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/woocommerce/connection");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.connected) {
        setWooConnected(true);
        if (typeof json.connection?.store_url === "string") setWooStoreUrl(json.connection.store_url);
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
      setWooCk("");
      setWooCs("");
      setWooSyncStatus({ state: "idle" });
    } catch {
      setError("Network error connecting store.");
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
    <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 sm:p-6 lg:p-8">
      <ModulePageHeader moduleId="products" />

      <ModuleUsageBanner feature="product" bump={usageBump} />

      {unifiedBrand ? (
        <p className="mb-4 text-xs font-semibold text-emerald-700/90 dark:text-emerald-400/90">
          Using your saved brand profile
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Left: Source + inputs */}
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">
                  {m.productName}
                </p>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                  Product AI workspace
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                  Generate or optimize listings. Manual or connected store.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600">
                <Package className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                  mode === "manual"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
                    : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode("store")}
                className={`flex-1 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                  mode === "store"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                    : "border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Connected store
              </button>
            </div>
          </div>

          {mode === "store" ? (
            <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      WooCommerce
                    </p>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Store connection
                    </h3>
                  </div>
                </div>
                {wooConnected && wooStoreUrl ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    <LinkIcon className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : null}
              </div>

              {!wooConnected ? (
                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                      Store URL
                    </label>
                    <input
                      value={wooStoreUrl}
                      onChange={(e) => setWooStoreUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      disabled={wooSaving}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                      Consumer key
                    </label>
                    <input
                      value={wooCk}
                      onChange={(e) => setWooCk(e.target.value)}
                      placeholder="ck_..."
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      disabled={wooSaving}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                      Consumer secret
                    </label>
                    <input
                      value={wooCs}
                      onChange={(e) => setWooCs(e.target.value)}
                      placeholder="cs_..."
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      disabled={wooSaving}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={connectWoo}
                    disabled={wooSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 disabled:opacity-50 transition-colors w-full"
                  >
                    {wooSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    {wooSaving ? "Saving…" : "Connect store"}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Credentials are stored in your Supabase project with row-level security. For production hardening, encrypt secrets at rest.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Connected to
                      </p>
                      <p className="mt-1 truncate text-sm font-mono text-slate-600 dark:text-slate-400">
                        {wooStoreUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadWooProducts()}
                      disabled={wooLoadingList}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      {wooLoadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      Refresh
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={wooQuery}
                      onChange={(e) => setWooQuery(e.target.value)}
                      placeholder="Search products…"
                      className="flex-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => loadWooProducts()}
                      className="rounded-2xl bg-blue-600 px-5 py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-500"
                    >
                      Search
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                      Select product
                    </label>
                    <select
                      value={wooSelectedId ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!n) {
                          setWooSelectedId(null);
                          return;
                        }
                        setWooSelectedId(n);
                        void loadWooProduct(n);
                      }}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
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
                      <p className="text-xs text-slate-500">Loading product…</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-5 sm:p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Inputs
            </p>
            <div className="grid gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                  Product name <span className="text-violet-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. AeroBrew Smart Kettle"
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                    Target audience <span className="text-slate-400 font-bold">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. remote teams, new parents"
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                    Tone <span className="text-slate-400 font-bold">(optional)</span>
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer"
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                  Key benefits <span className="text-slate-400 font-bold">(optional)</span>
                </label>
                <textarea
                  value={keyBenefits}
                  onChange={(e) => setKeyBenefits(e.target.value)}
                  placeholder="One per line or short notes — e.g. saves 2h/week, lifetime warranty…"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40 resize-y min-h-[100px]"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                  Product details / notes <span className="text-slate-400 font-bold">(optional)</span>
                </label>
                <textarea
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                  placeholder="Materials, size, category, differentiators…"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40 resize-y min-h-[88px]"
                  disabled={loading}
                />
              </div>

              <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Improve existing product (optional)
                </p>
                <div className="mt-3 grid gap-3">
                  <input
                    value={existingTitle}
                    onChange={(e) => setExistingTitle(e.target.value)}
                    placeholder="Existing title (optional)"
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30"
                    disabled={loading}
                  />
                  <textarea
                    value={existingShortDescription}
                    onChange={(e) => setExistingShortDescription(e.target.value)}
                    placeholder="Existing short description (optional)"
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30 resize-y"
                    disabled={loading}
                  />
                  <textarea
                    value={existingDescription}
                    onChange={(e) => setExistingDescription(e.target.value)}
                    placeholder="Existing long description (optional)"
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/30 resize-y"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runGeneration("generate")}
                  disabled={loading || !canGenerate}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => runGeneration("improve")}
                  disabled={loading || !canImprove}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Improve
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
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
                  {(
                    [
                      { id: "description", label: "Description" },
                      { id: "bullets", label: "Bullet points" },
                      { id: "seo", label: "SEO" },
                      { id: "marketplace", label: "Marketplace copy" },
                      { id: "sync", label: "Sync / Update" },
                    ] as const
                  ).map((t) => (
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
                        {([
                          { id: "title", label: "Title" },
                          { id: "description", label: "Long description" },
                          { id: "short", label: "Short description" },
                        ] as const).map((f) => (
                          <label
                            key={f.id}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200"
                          >
                            <input type="checkbox" defaultChecked className="h-4 w-4" id={`upd-${f.id}`} />
                            <span className="font-semibold">{f.label}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateInStore({
                            title: (document.getElementById("upd-title") as HTMLInputElement | null)?.checked ?? true,
                            description: (document.getElementById("upd-description") as HTMLInputElement | null)?.checked ?? true,
                            short: (document.getElementById("upd-short") as HTMLInputElement | null)?.checked ?? true,
                          })
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Update in store
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
