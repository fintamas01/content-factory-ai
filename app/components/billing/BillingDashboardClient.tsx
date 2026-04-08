"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  Settings,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { BillingApiResponse } from "@/app/api/billing/route";
import { subscriptionPlanLabel } from "@/lib/billing/plan-display";
import {
  getAllowedCheckoutPriceIds,
  getPlanMarketingCards,
  getStripePriceIdBasic,
  getStripePriceIdElite,
  getStripePriceIdPro,
} from "@/lib/billing/pricing";
import type { SubscriptionRow } from "@/lib/plan-config";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

function asSub(row: Record<string, unknown> | null): SubscriptionRow | null {
  if (!row) return null;
  return {
    user_id: row.user_id as string | undefined,
    status: row.status as string | null | undefined,
    price_id: row.price_id as string | null | undefined,
    stripe_subscription_id: row.stripe_subscription_id as string | null | undefined,
    current_period_end: row.current_period_end as string | null | undefined,
  };
}

function statusStyles(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "active")
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
  if (s === "canceled" || s === "cancelled")
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (s === "past_due" || s === "unpaid")
    return "border-rose-500/35 bg-rose-500/10 text-rose-200";
  return "border-white/15 bg-white/[0.06] text-slate-300";
}

export function BillingDashboardClient() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(
    null
  );
  const [data, setData] = useState<BillingApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  /** Which Stripe price id checkout is running for (null = idle). */
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const showSuccessBanner = searchParams.get("checkout") === "success";

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const u = auth.user;
    setUser(u ? { id: u.id, email: u.email } : null);
    if (!u) {
      setLoading(false);
      setData(null);
      return;
    }
    try {
      const res = await fetch("/api/billing");
      if (res.ok) {
        const json = (await res.json()) as BillingApiResponse;
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url as string;
      else
        alert(
          (json.error as string) || "Could not open billing portal. Try again."
        );
    } catch {
      /* ignore */
    } finally {
      setPortalLoading(false);
    }
  };

  const startCheckout = async (priceId: string, label: string) => {
    if (!priceId) {
      alert(`${label} is not configured in environment variables.`);
      return;
    }
    setCheckoutPriceId(priceId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (res.ok && json.url) window.location.href = json.url as string;
      else alert((json.error as string) || "Checkout could not start.");
    } catch {
      /* ignore */
    } finally {
      setCheckoutPriceId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2
          className="h-10 w-10 animate-spin text-blue-400"
          aria-hidden
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0c1220] to-[#050810] p-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-blue-600/20 blur-3xl"
          aria-hidden
        />
        <h1 className="relative text-2xl font-black tracking-tight text-white">
          Sign in to manage billing
        </h1>
        <p className="relative mt-2 text-sm text-slate-400">
          Subscription and usage are tied to your account.
        </p>
        <Link
          href="/"
          className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
        >
          Go to sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const usage = data?.usage;
  const cards = getPlanMarketingCards();
  const sub = asSub(data?.subscription ?? null);
  const planTier = data?.usage?.plan ?? data?.plan ?? "free";
  const isElite = planTier === "elite";
  const isProTier = planTier === "pro";
  const isBasicTier = planTier === "basic";
  const isPaid = isElite || isProTier || isBasicTier;
  const stripeStatus = sub?.status ?? null;
  const planLabel = isPaid ? subscriptionPlanLabel(sub) : "Free";
  /** Server returns runtime env; client NEXT_PUBLIC_* can be stale until rebuild. */
  const basicPriceId = data?.checkoutPriceIds?.basic ?? getStripePriceIdBasic();
  const proPriceId = data?.checkoutPriceIds?.pro ?? getStripePriceIdPro();
  const elitePriceId = data?.checkoutPriceIds?.elite ?? getStripePriceIdElite();
  const allowedCheckout =
    data?.allowedCheckoutPriceIds ?? getAllowedCheckoutPriceIds();
  const checkoutBusy = checkoutPriceId !== null;

  return (
    <div className="relative space-y-10 pb-16">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-blue-600/12 blur-[80px]"
        aria-hidden
      />

      {showSuccessBanner ? (
        <div
          role="status"
          className="relative rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.12] px-5 py-4 text-sm font-medium leading-relaxed text-emerald-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
        >
          <span className="font-semibold text-emerald-50">Payment received.</span> If your plan
          does not update within a minute, refresh — Stripe webhooks sync your subscription.
        </div>
      ) : null}

      {user && data && !usage ? (
        <div
          role="note"
          className="relative rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-5 py-3 text-sm text-amber-100/95"
        >
          <span className="font-semibold text-amber-50">Workspace required for usage.</span>{" "}
          Select a client/workspace in the header to see monthly quotas. You can still upgrade to
          Pro or Elite below.
        </div>
      ) : null}

      <header className="relative space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
          Billing
        </p>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Plan & usage
        </h1>
        <p className="max-w-xl text-sm font-medium text-slate-400">
          Your subscription status, quotas, and upgrade path — in one place.
        </p>
      </header>

      {/* Status hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0f172a]/90 via-[#0a0f1a] to-[#050810] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] md:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(59,130,246,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Current plan
              </span>
              {isElite ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100 shadow-sm shadow-amber-900/20">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-200/90" aria-hidden />
                  {planLabel}
                </span>
              ) : isPaid ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/35 bg-blue-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-100 shadow-sm shadow-blue-900/20">
                  <Sparkles className="h-3.5 w-3.5 text-amber-200/90" aria-hidden />
                  {planLabel}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Free
                </span>
              )}
            </div>

            <div>
              <p className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                {isPaid ? `${planLabel} workspace` : "Free workspace"}
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                {isElite
                  ? "Pro-level quotas plus Price Intelligence — track competitor listings and get AI pricing briefs."
                  : isPaid
                    ? "Paid monthly quotas are active across Content, Products, and Growth Audit."
                    : "Starter quotas each month. Upgrade to Basic, Pro, or Elite when you need more headroom."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {stripeStatus ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyles(stripeStatus)}`}
                >
                  <Shield className="mr-1.5 h-3 w-3 opacity-80" aria-hidden />
                  {stripeStatus}
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500">No Stripe subscription on file</span>
              )}
              {sub?.current_period_end && stripeStatus === "active" ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  Renews{" "}
                  {new Date(sub.current_period_end).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[min(100%,360px)] lg:shrink-0">
            {isPaid ? (
              <>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] text-sm font-bold text-white transition hover:bg-white/[0.11] disabled:opacity-60"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Manage subscription
                </button>
                {(isBasicTier || isProTier) && elitePriceId ? (
                  <button
                    type="button"
                    onClick={() => void startCheckout(elitePriceId, "Elite")}
                    disabled={checkoutBusy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-500/20 to-violet-600/25 text-sm font-bold text-amber-50 transition hover:brightness-110 disabled:opacity-40"
                  >
                    {checkoutPriceId === elitePriceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4" aria-hidden />
                    )}
                    Upgrade to Elite
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
                {isBasicTier && proPriceId ? (
                  <button
                    type="button"
                    onClick={() => void startCheckout(proPriceId, "Pro")}
                    disabled={checkoutBusy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/35 bg-blue-500/15 text-sm font-bold text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-40"
                  >
                    {checkoutPriceId === proPriceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" aria-hidden />
                    )}
                    Upgrade to Pro
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void startCheckout(basicPriceId, "Basic")}
                  disabled={
                    checkoutBusy ||
                    allowedCheckout.length === 0 ||
                    !basicPriceId
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-cyan-600/25 to-blue-600/20 text-sm font-bold text-cyan-50 transition hover:brightness-110 disabled:opacity-40"
                >
                  {checkoutPriceId === basicPriceId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-5 w-5" aria-hidden />
                      Upgrade to Basic
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void startCheckout(proPriceId, "Pro")}
                  disabled={
                    checkoutBusy ||
                    allowedCheckout.length === 0 ||
                    !proPriceId
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-sm font-black text-white shadow-[0_8px_28px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/15 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
                >
                  {checkoutPriceId === proPriceId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-5 w-5" aria-hidden />
                      Upgrade to Pro
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>
                {elitePriceId ? (
                  <button
                    type="button"
                    onClick={() => void startCheckout(elitePriceId, "Elite")}
                    disabled={checkoutBusy || !elitePriceId}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-violet-600/20 text-sm font-bold text-amber-100 transition hover:brightness-110 disabled:opacity-40"
                  >
                    {checkoutPriceId === elitePriceId ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <BarChart3 className="h-5 w-5" aria-hidden />
                        Upgrade to Elite
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </button>
                ) : null}
              </>
            )}
            <Link
              href="/pricing"
              className="text-center text-xs font-semibold text-slate-500 transition hover:text-slate-300"
            >
              Compare all plans →
            </Link>
          </div>
        </div>
      </section>

      {/* Usage */}
      {usage ? (
        <section
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#070b14]/80 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] md:p-8"
          aria-labelledby="billing-usage-heading"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2
              id="billing-usage-heading"
              className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"
            >
              Usage · {usage.monthKey}
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Resets monthly (UTC)
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(
              [
                ["Content", usage.usage.content, usage.limits.content_generations_per_month, "from-blue-500 to-cyan-400"],
                ["Products", usage.usage.product, usage.limits.product_generations_per_month, "from-violet-500 to-fuchsia-400"],
                ["Audits", usage.usage.audit, usage.limits.audits_per_month, "from-emerald-500 to-teal-400"],
              ] as const
            ).map(([label, used, cap, gradient]) => {
              const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
              return (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 font-mono text-xl font-bold tabular-nums text-white">
                    {used}{" "}
                    <span className="text-slate-500">/</span> {cap}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} opacity-90`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Plan cards */}
      <section aria-labelledby="plans-compare-heading" className="relative">
        <h2
          id="plans-compare-heading"
          className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"
        >
          Plans
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-4">
          <div className="flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Starter
            </p>
            <h3 className="mt-2 text-xl font-bold text-white">{cards.free.name}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{cards.free.priceLine}</span>
              <span className="text-sm text-slate-500">/ {cards.free.periodNote}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2">
              {cards.free.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10">
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              Open dashboard
            </Link>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.09] via-[#0a1424] to-[#050a12] p-8 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]">
            <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              Basic
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">
              Consistent
            </p>
            <h3 className="mt-2 flex items-center gap-2 text-xl font-bold text-white">
              {cards.basic.name}
              <Sparkles className="h-5 w-5 text-cyan-200/80" aria-hidden />
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{cards.basic.priceLine}</span>
              <span className="text-sm text-cyan-200/50">/ {cards.basic.periodNote}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2">
              {cards.basic.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-cyan-50/90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-500/10">
                    <Check className="h-3 w-3 text-cyan-200" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void startCheckout(basicPriceId, "Basic")}
              disabled={
                checkoutBusy ||
                isElite ||
                isProTier ||
                isBasicTier ||
                !basicPriceId ||
                allowedCheckout.length === 0
              }
              className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-cyan-600/25 to-blue-600/20 text-[15px] font-black text-white shadow-lg shadow-cyan-900/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {checkoutPriceId === basicPriceId ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isElite || isProTier ? (
                "Included in your plan"
              ) : isBasicTier ? (
                "Your current plan"
              ) : !basicPriceId ? (
                "Configure Basic in Stripe"
              ) : (
                <>
                  Upgrade to Basic
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </button>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-3xl border border-blue-500/35 bg-gradient-to-b from-blue-500/10 via-[#0a1424] to-[#050a12] p-8 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]">
            <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              Popular
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/80">
              Scale
            </p>
            <h3 className="mt-2 flex items-center gap-2 text-xl font-bold text-white">
              {cards.pro.name}
              <Sparkles className="h-5 w-5 text-amber-200/80" aria-hidden />
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{cards.pro.priceLine}</span>
              <span className="text-sm text-blue-200/50">/ {cards.pro.periodNote}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2">
              {cards.pro.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-blue-50/90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-blue-400/25 bg-blue-500/15">
                    <Check className="h-3 w-3 text-blue-200" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void startCheckout(proPriceId, "Pro")}
              disabled={
                checkoutBusy ||
                isElite ||
                isProTier ||
                isBasicTier ||
                !proPriceId ||
                allowedCheckout.length === 0
              }
              className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-[15px] font-black text-white shadow-lg shadow-blue-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {checkoutPriceId === proPriceId ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isElite ? (
                "Included in Elite"
              ) : isProTier ? (
                "Your current plan"
              ) : isBasicTier ? (
                "Upgrade from Basic"
              ) : (
                <>
                  Upgrade to Pro
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </button>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-3xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.12] via-[#0f1218] to-[#050810] p-8 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]">
            <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
              Price Intel
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">
              Top tier
            </p>
            <h3 className="mt-2 flex items-center gap-2 text-xl font-bold text-white">
              {cards.elite.name}
              <BarChart3 className="h-5 w-5 text-amber-200/90" aria-hidden />
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{cards.elite.priceLine}</span>
              <span className="text-sm text-amber-200/50">/ {cards.elite.periodNote}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2">
              {cards.elite.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-amber-50/95">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-500/15">
                    <Check className="h-3 w-3 text-amber-200" strokeWidth={2.5} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void startCheckout(elitePriceId, "Elite")}
              disabled={
                checkoutBusy ||
                isElite ||
                !elitePriceId ||
                allowedCheckout.length === 0
              }
              className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-violet-700 text-[15px] font-black text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {checkoutPriceId === elitePriceId ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isElite ? (
                "Your current plan"
              ) : !elitePriceId ? (
                "Configure Elite in Stripe"
              ) : (
                <>
                  Upgrade to Elite
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.06] pt-8 text-center text-[11px] font-medium text-slate-600">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="transition hover:text-slate-400">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-slate-400">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
