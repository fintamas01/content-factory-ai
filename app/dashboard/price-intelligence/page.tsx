"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Loader2,
  RefreshCcw,
  Trash2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Card } from "@/app/components/ui/Card";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";
import type { PriceTrackingRow } from "@/lib/price-intelligence/types";

type WooItem = { id: number; name: string };

export default function PriceIntelligencePage() {
  const [rows, setRows] = useState<PriceTrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [ownPrice, setOwnPrice] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [wooId, setWooId] = useState<string>("");
  const [wooItems, setWooItems] = useState<WooItem[]>([]);
  const [wooErr, setWooErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useCopilotPageContext({
    page: "price-intelligence",
    data: {
      module: "Price Intelligence",
      eliteOnly: true,
    },
  });

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/price-intelligence");
    const json = await res.json().catch(() => ({}));
    if (res.status === 403) {
      setLocked(true);
      setRows([]);
      return;
    }
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Could not load.");
      return;
    }
    setLocked(false);
    setRows((json.rows as PriceTrackingRow[]) ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (locked) return;
    void (async () => {
      const res = await fetch("/api/woocommerce/products?per_page=40");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWooErr(typeof json.error === "string" ? json.error : null);
        setWooItems([]);
        return;
      }
      setWooErr(null);
      setWooItems((json.items as WooItem[]) ?? []);
    })();
  }, [locked]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        product_name: productName.trim(),
        competitor_url: competitorUrl.trim(),
      };
      if (ownPrice.trim()) body.own_price = Number(ownPrice);
      if (wooId) body.woo_product_id = Number(wooId);

      const res = await fetch("/api/price-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Save failed.");
        return;
      }
      setProductName("");
      setOwnPrice("");
      setCompetitorUrl("");
      setWooId("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function refresh(id: string) {
    setRefreshingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/price-intelligence/${id}/refresh`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Refresh failed.");
        return;
      }
      await load();
    } finally {
      setRefreshingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this tracked competitor?")) return;
    setError(null);
    const res = await fetch(`/api/price-intelligence/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === "string" ? json.error : "Delete failed.");
      return;
    }
    await load();
  }

  function fmtMoney(n: number | null) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return `$${Number(n).toFixed(2)}`;
  }

  function fmtPct(n: number | null) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    const v = Number(n);
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  }

  return (
    <Page>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
        <Link href="/dashboard" className="hover:text-white/60">
          Dashboard
        </Link>
        <span className="mx-2 text-white/25">/</span>
        <span className="text-cyan-200/90">Price Intelligence</span>
      </div>

      <PageHero
        icon={<BarChart3 className="h-6 w-6" />}
        eyebrow="Elite · Competitive pricing · Beta"
        title="Price Intelligence"
        description="Beta: track a competitor URL, compare against your price, and get positioning guidance—not just “go cheaper.” Automated reads are often incomplete or wrong; always confirm prices on the seller’s site before you act."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : locked ? (
        <Card className="border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Elite plan required</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Price Intelligence is included on the Elite (top) tier. Upgrade your subscription to
                track competitor listings and generate AI pricing briefs.
              </p>
              <Link
                href="/dashboard/billing"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/20 via-violet-500/15 to-transparent px-5 text-sm font-semibold text-white shadow-[0_0_32px_-18px_rgba(34,211,238,0.55)] transition hover:border-cyan-300/35 hover:bg-white/[0.06]"
              >
                View billing &amp; plans
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Card className="border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Add competitor</h2>
            <p className="mt-1 text-sm text-white/50">
              Paste a public product page URL. We fetch HTML server-side and extract a best-effort
              price (many stores block bots or load prices in JavaScript—null or odd numbers are
              normal).
            </p>
            <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Product name</label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Organic cotton tee"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Your price (optional)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={ownPrice}
                  onChange={(e) => setOwnPrice(e.target.value)}
                  placeholder="29.99"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">
                  WooCommerce product (optional)
                </label>
                <select
                  value={wooId}
                  onChange={(e) => setWooId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none"
                >
                  <option value="">— Manual only —</option>
                  {wooItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {wooErr ? (
                  <p className="mt-1 text-xs text-amber-200/80">{wooErr} (reference only)</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Competitor product URL</label>
                <Input
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  placeholder="https://competitor.com/product/..."
                  className="mt-1.5"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={saving}
                  variant="primary"
                  className="h-11 rounded-2xl"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Scoring…
                    </>
                  ) : (
                    "Track & analyze"
                  )}
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
              Tracked listings
            </h2>
            {rows.length === 0 ? (
              <p className="text-sm text-white/45">No rows yet. Add a competitor URL above.</p>
            ) : (
              rows.map((r) => (
                <Card
                  key={r.id}
                  className="border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">{r.product_name}</h3>
                      <a
                        href={r.competitor_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300/90 hover:text-cyan-200"
                      >
                        {r.competitor_url.slice(0, 64)}
                        {r.competitor_url.length > 64 ? "…" : ""}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="text-white/45">
                          Yours:{" "}
                          <span className="font-mono text-white/80">{fmtMoney(r.own_price)}</span>
                        </span>
                        <span className="text-white/45">
                          Competitor:{" "}
                          <span className="font-mono text-white/80">
                            {fmtMoney(r.competitor_price)}
                          </span>
                        </span>
                        <span className="text-white/45">
                          Gap: <span className="font-mono text-emerald-200/90">{fmtPct(r.difference_pct)}</span>{" "}
                          <span className="text-white/35">(vs your price)</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 rounded-xl"
                        disabled={refreshingId === r.id}
                        onClick={() => void refresh(r.id)}
                      >
                        {refreshingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Refresh</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 rounded-xl text-red-300 hover:bg-red-500/10"
                        onClick={() => void remove(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {r.recommendation ? (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/80">
                        AI brief
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                        {r.recommendation}
                      </p>
                    </div>
                  ) : null}
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </Page>
  );
}
