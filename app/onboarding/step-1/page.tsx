"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowRight,
  Building2,
  Loader2,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { OnboardingShell } from "@/app/components/onboarding/OnboardingShell";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const tonePresets = [
  { key: "confident", label: "Confident", hint: "clear, direct, high-trust" },
  { key: "friendly", label: "Friendly", hint: "warm, approachable, human" },
  { key: "premium", label: "Premium", hint: "polished, concise, sharp" },
  { key: "playful", label: "Playful", hint: "light, witty, energetic" },
] as const;

type FormState = {
  brand_name: string;
  brand_description: string;
  target_audience: string;
  tone_of_voice: string;
};

export default function OnboardingStep1() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const [form, setForm] = useState<FormState>({
    brand_name: "",
    brand_description: "",
    target_audience: "",
    tone_of_voice: "",
  });

  const canContinue = form.brand_name.trim().length > 1;

  const benefitBullets = useMemo(
    () => [
      {
        icon: Sparkles,
        title: "Better outputs immediately",
        text: "Your brand context improves every generation across modules.",
      },
      {
        icon: Target,
        title: "Consistent voice",
        text: "No more mixed tone across content and product pages.",
      },
      {
        icon: Wand2,
        title: "Less editing",
        text: "Fewer rewrites because the system starts aligned.",
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/");
          return;
        }

        const { data } = await supabase
          .from("user_brand_profiles")
          .select("brand_name, brand_description, target_audience, tone_of_voice")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled && data) {
          setForm({
            brand_name: (data.brand_name as string) ?? "",
            brand_description: (data.brand_description as string) ?? "",
            target_audience: (data.target_audience as string) ?? "",
            tone_of_voice: (data.tone_of_voice as string) ?? "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSave = async () => {
    if (!canContinue || saving) return;
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

      const payload = {
        user_id: user.id,
        brand_name: form.brand_name.trim(),
        brand_description: form.brand_description.trim(),
        target_audience: form.target_audience.trim(),
        tone_of_voice: form.tone_of_voice.trim(),
      };

      const { error: upsertError } = await supabase
        .from("user_brand_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      router.push("/onboarding/step-2");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not save your brand profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step="brand"
      title="Set up your brand in 60 seconds"
      subtitle="This makes your first outputs feel like they came from your business—so you spend less time editing."
    >
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                Brand name <span className="text-blue-300">*</span>
              </label>
              <div className="relative">
                <Building2
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  value={form.brand_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand_name: e.target.value }))
                  }
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. Acme Fitness"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm font-semibold text-white placeholder:text-slate-600 outline-none transition focus:border-blue-400/40 focus:bg-white/[0.06]"
                />
              </div>
              {touched && !canContinue ? (
                <p className="text-[11px] font-semibold text-amber-200/80">
                  Add a brand name to continue.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Required. Everything else is optional.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Target audience
                </label>
                <input
                  value={form.target_audience}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_audience: e.target.value }))
                  }
                  placeholder="Who do you sell to? (optional)"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white placeholder:text-slate-600 outline-none transition focus:border-blue-400/40 focus:bg-white/[0.06]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Tone of voice
                </label>
                <input
                  value={form.tone_of_voice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tone_of_voice: e.target.value }))
                  }
                  placeholder="e.g. premium, friendly, direct (optional)"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white placeholder:text-slate-600 outline-none transition focus:border-blue-400/40 focus:bg-white/[0.06]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                One-sentence description
              </label>
              <textarea
                value={form.brand_description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_description: e.target.value }))
                }
                placeholder="What do you sell, and what makes you different? (optional)"
                rows={4}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-600 outline-none transition focus:border-blue-400/40 focus:bg-white/[0.06]"
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-300">
                Quick tone presets (optional)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {tonePresets.map((t) => {
                  const active = form.tone_of_voice.trim().toLowerCase() === t.label.toLowerCase();
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, tone_of_voice: t.label }))
                      }
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-blue-400/40 bg-blue-500/15 text-blue-50"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                      }`}
                    >
                      <p className="text-sm font-black">{t.label}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {t.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onSave}
                disabled={!canContinue || saving}
                className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-7 text-[15px] font-black text-white shadow-[0_8px_28px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    Continue to first win
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push("/onboarding/step-2")}
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]"
              >
                Skip for now
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Skipping is fine—your first outputs may need a quick edit until your brand is set.
            </p>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Why this matters
              </p>
              <ul className="mt-5 space-y-4">
                {benefitBullets.map((b) => {
                  const Icon = b.icon;
                  return (
                    <li key={b.title} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-blue-200">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{b.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                          {b.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </OnboardingShell>
  );
}

