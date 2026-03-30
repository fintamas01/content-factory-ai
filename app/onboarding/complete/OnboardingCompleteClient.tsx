"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowRight,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Zap,
} from "lucide-react";
import { OnboardingShell } from "@/app/components/onboarding/OnboardingShell";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export function OnboardingCompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/dashboard";
  const primaryCta = searchParams.get("cta") ?? "Start";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeNext = useMemo(() => {
    if (nextHref.startsWith("/dashboard")) return nextHref;
    return "/dashboard";
  }, [nextHref]);

  const markCompleteAndGo = async (href: string) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { error: upsertError } = await supabase
        .from("user_onboarding")
        .upsert(
          { user_id: user.id, onboarding_completed: true },
          { onConflict: "user_id" }
        );

      if (upsertError) throw upsertError;

      router.push(href);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not complete onboarding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step="complete"
      title="You’re ready to get value"
      subtitle="One click and you’ll land directly in your first task."
      backHref="/onboarding/step-2"
    >
      <div className="grid gap-7 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-bold text-white">First win: now</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                You’ll start with one focused action. After that, the full dashboard is
                yours.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => markCompleteAndGo(safeNext)}
              disabled={saving}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 text-[15px] font-black text-white shadow-[0_8px_28px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/15 transition hover:brightness-110 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Zap className="h-5 w-5" aria-hidden />
              )}
              {primaryCta}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => markCompleteAndGo("/dashboard")}
              disabled={saving}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              <LayoutGrid className="h-5 w-5 opacity-80" aria-hidden />
              Browse dashboard
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <p className="mt-5 text-[11px] text-slate-500">
            You can always update your brand later in{" "}
            <Link
              href="/dashboard/brand"
              className="font-semibold text-slate-400 hover:text-slate-200"
            >
              Brand Profile
            </Link>
            .
          </p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              What happens next
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-black text-slate-400">
                  1
                </span>
                You’ll land directly in your first task.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-black text-slate-400">
                  2
                </span>
                Usage limits keep the experience clear and predictable.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-black text-slate-400">
                  3
                </span>
                Upgrade to Pro whenever you hit the limits.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </OnboardingShell>
  );
}

