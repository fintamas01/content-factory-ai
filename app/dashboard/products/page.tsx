"use client";

import { useState, type ComponentType, type ReactNode } from "react";
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
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import type { ProductCopyResult } from "@/lib/products/types";

const TONE_OPTIONS = [
  { value: "", label: "Default (balanced)" },
  { value: "professional", label: "Professional" },
  { value: "modern", label: "Modern" },
  { value: "persuasive", label: "Persuasive" },
  { value: "luxury", label: "Luxury" },
  { value: "friendly", label: "Friendly" },
];

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
  const [productName, setProductName] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");
  const [keyBenefits, setKeyBenefits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductCopyResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generate = async () => {
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
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      if (json.result) setResult(json.result as ProductCopyResult);
      else {
        setError("Unexpected response.");
        return;
      }
      if (typeof json.savedId === "string") setSavedId(json.savedId);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20 p-8">
      <ModulePageHeader moduleId="products" />

      <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 md:p-10 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 mb-4">
          <Package className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">
          {m.productName}
        </p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
          Product generator
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium text-sm max-w-2xl">
          {m.description}
        </p>

        <div className="mt-8 grid gap-5">
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

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
              Product details / notes{" "}
              <span className="text-slate-400 font-bold">(optional)</span>
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                Target audience{" "}
                <span className="text-slate-400 font-bold">(optional)</span>
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
                Tone of voice{" "}
                <span className="text-slate-400 font-bold">(optional)</span>
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
              Key benefits{" "}
              <span className="text-slate-400 font-bold">(optional)</span>
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

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-8 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate product copy
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
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

          <SectionCard
            icon={ListOrdered}
            eyebrow="Scan-friendly"
            title="Bullet points"
          >
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

          <SectionCard
            icon={Search}
            eyebrow="Search"
            title="SEO"
          >
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
        </div>
      )}
    </div>
  );
}
