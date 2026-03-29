"use client";

import { useState } from "react";
import {
  Loader2,
  Package,
  Sparkles,
  Copy,
  CheckCircle2,
  ListOrdered,
} from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import type { ProductCopyResult } from "@/lib/products/types";

const TONE_PRESETS = [
  { value: "", label: "Default (balanced)" },
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "luxury", label: "Luxury" },
  { value: "direct", label: "Direct / punchy" },
  { value: "technical", label: "Technical" },
];

export default function ProductGeniePage() {
  const m = MODULES.products;
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductCopyResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setResult(null);
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
          description: description.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          tone: tone.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      if (json.result) setResult(json.result as ProductCopyResult);
      else setError("Unexpected response.");
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
          Product copy generator
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
              Short description <span className="text-slate-400 font-bold">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key features, materials, use case…"
              rows={3}
              className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40 resize-y min-h-[88px]"
              disabled={loading}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                Target audience <span className="text-slate-400 font-bold">(optional)</span>
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. busy parents, SMB owners"
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
                {TONE_PRESETS.map((p) => (
                  <option key={p.value || "default"} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {result.title}
              </h2>
              <button
                type="button"
                onClick={() => copy(`${result.title}\n\n${result.description}`, "all-top")}
                className="shrink-0 rounded-xl border border-slate-200 dark:border-white/10 p-2 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                aria-label="Copy title and description"
              >
                {copiedKey === "all-top" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {result.description}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ListOrdered className="h-5 w-5 text-violet-500" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">
                Bullet points
              </h3>
            </div>
            <ul className="space-y-3">
              {result.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.03] px-4 py-3"
                >
                  <span className="text-violet-500 font-black">·</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#070d18] dark:ring-1 dark:ring-white/5 p-8 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              SEO snippet
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Title (~60 chars)
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
                <p className="text-[10px] text-slate-400 mt-1">{result.seo_title.length} chars</p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Meta description (~160 chars)
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(result.seo_description, "seo-d")}
                    className="text-xs font-bold text-violet-600 dark:text-violet-400"
                  >
                    {copiedKey === "seo-d" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  {result.seo_description}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">{result.seo_description.length} chars</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
