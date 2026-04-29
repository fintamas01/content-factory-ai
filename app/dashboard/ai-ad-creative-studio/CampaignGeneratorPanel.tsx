"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { OUTPUT_LANGUAGE_OPTIONS } from "@/lib/i18n/output-language";
import { SOCIAL_POST_TEMPLATES } from "@/lib/creatomate/social-post-templates";

type CampaignJobRow = {
  id: string;
  status: string | null;
  template_id: string | null;
  product_name: string | null;
  product_price: string | null;
  headline: string | null;
  caption: string | null;
  cta: string | null;
  render_url: string | null;
  error_message: string | null;
  created_at: string | null;
};

const DEFAULT_LANGUAGE_NAME = "English";
const DEFAULT_TONE = "premium";
const DEFAULT_TEMPLATE_ID = "promo-hero-strip";

const TONE_OPTIONS = ["premium", "bold", "professional", "playful", "urgent"] as const;

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "completed")
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  if (s === "failed") return "border-rose-500/35 bg-rose-500/10 text-rose-200";
  if (s === "rendering") return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/[0.05] text-white/65";
}

export function CampaignGeneratorPanel() {
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [languageName, setLanguageName] = useState(DEFAULT_LANGUAGE_NAME);
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);

  const [jobs, setJobs] = useState<CampaignJobRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign-jobs", { method: "GET" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJobs([]);
        setError(typeof j?.error === "string" ? j.error : "Could not load campaign jobs.");
        return;
      }
      setJobs(Array.isArray(j?.jobs) ? (j.jobs as CampaignJobRow[]) : []);
    } catch {
      setJobs([]);
      setError("Could not load campaign jobs.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function copyText(key: string, value: string) {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError("Product name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign-jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName.trim(),
          product_image: productImage.trim() || null,
          product_price: productPrice.trim() || null,
          language: languageName,
          tone,
          template_id: templateId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j?.error === "string" ? j.error : "Could not generate campaign.");
        return;
      }
      setProductName("");
      setProductImage("");
      setProductPrice("");
      await loadJobs();
    } catch {
      setError("Could not generate campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.08] bg-white/[0.03]">
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              Campaign generator
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Generate ad creative</h3>
            <p className="mt-1 text-sm text-white/55">
              AI writes headline, caption, and CTA; Creatomate renders a graphic for your active
              workspace.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Product name</label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Nimbus Running Shoes"
                  className="mt-1.5 rounded-2xl"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">
                  Product image URL <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Input
                  value={productImage}
                  onChange={(e) => setProductImage(e.target.value)}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">
                  Product price <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Input
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="e.g. 3999 RON"
                  className="mt-1.5 rounded-2xl"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Language</label>
                <select
                  value={languageName}
                  onChange={(e) => setLanguageName(e.target.value)}
                  disabled={submitting}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/85 outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-500/10"
                >
                  {OUTPUT_LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.code} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Tone</label>
                <select
                  value={TONE_OPTIONS.includes(tone as (typeof TONE_OPTIONS)[number]) ? tone : "premium"}
                  onChange={(e) => setTone(e.target.value)}
                  disabled={submitting}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/85 outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-500/10"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Template</label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={submitting}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/85 outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-500/10"
                >
                  {SOCIAL_POST_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button type="submit" className="rounded-2xl" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating creative...
                  </>
                ) : (
                  "Generate creative"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl"
                onClick={() => void loadJobs()}
                disabled={listLoading || submitting}
              >
                {listLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh list"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="border-white/[0.08] bg-white/[0.03]">
        <div className="p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                Recent campaigns
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">Your campaign jobs</h3>
              <p className="mt-1 text-sm text-white/55">
                Newest first. Copy text or open the rendered image in a new tab.
              </p>
            </div>
          </div>

          {listLoading && jobs.length === 0 ? (
            <div className="flex items-center gap-2 py-10 text-white/55">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/15 py-12 text-center text-sm text-white/50">
              No campaign jobs yet. Fill the form above to generate your first creative.
            </div>
          ) : (
            <ul className="space-y-5">
              {jobs.map((job) => {
                const created = job.created_at
                  ? new Date(job.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—";
                const headline = job.headline ?? "";
                const caption = job.caption ?? "";
                return (
                  <li key={job.id}>
                    <Card className="overflow-hidden border-white/[0.08] bg-white/[0.02]">
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-base font-semibold text-white">
                                {job.product_name ?? "Untitled product"}
                              </h4>
                              {job.product_price ? (
                                <span className="text-sm text-white/50">{job.product_price}</span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statusBadgeClass(job.status)}`}
                              >
                                {job.status ?? "—"}
                              </span>
                              {job.template_id ? (
                                <span className="font-mono text-[11px] text-white/45">
                                  {job.template_id}
                                </span>
                              ) : null}
                              <span className="text-[11px] text-white/40">{created}</span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                                    Headline
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void copyText(`${job.id}-h`, headline)}
                                    disabled={!headline.trim()}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-40"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copiedKey === `${job.id}-h` ? "Copied" : "Copy"}
                                  </button>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-white/85">
                                  {headline || "—"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                                    CTA
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-medium text-cyan-100/90">
                                  {job.cta ?? "—"}
                                </p>
                              </div>
                              <div className="sm:col-span-2 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                                    Caption
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void copyText(`${job.id}-c`, caption)}
                                    disabled={!caption.trim()}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-40"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copiedKey === `${job.id}-c` ? "Copied" : "Copy"}
                                  </button>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-white/80">
                                  {caption || "—"}
                                </p>
                              </div>
                            </div>

                            {job.status === "failed" && job.error_message ? (
                              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-100">
                                {job.error_message}
                              </div>
                            ) : null}

                            {job.render_url ? (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <a
                                  href={job.render_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Open image
                                </a>
                              </div>
                            ) : null}
                          </div>

                          {job.render_url ? (
                            <div className="w-full shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 lg:w-[280px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={job.render_url}
                                alt="Campaign creative preview"
                                className="h-auto w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
