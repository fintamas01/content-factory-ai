"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Save, ExternalLink } from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function BrandProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand_name: "",
    brand_description: "",
    target_audience: "",
    tone_of_voice: "",
    key_selling_points: "",
    website_url: "",
  });

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from("user_brand_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setForm({
          brand_name: data.brand_name ?? "",
          brand_description: data.brand_description ?? "",
          target_audience: data.target_audience ?? "",
          tone_of_voice: data.tone_of_voice ?? "",
          key_selling_points: data.key_selling_points ?? "",
          website_url: data.website_url ?? "",
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("user_brand_profiles").upsert(
        {
          user_id: userId,
          brand_name: form.brand_name.trim(),
          brand_description: form.brand_description.trim() || null,
          target_audience: form.target_audience.trim() || null,
          tone_of_voice: form.tone_of_voice.trim() || null,
          key_selling_points: form.key_selling_points.trim() || null,
          website_url: form.website_url.trim() || null,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        console.error(error);
        alert("Could not save. Check the Supabase migration and RLS policies.");
        return;
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center text-slate-500">
        Sign in to manage your brand profile.
      </div>
    );
  }

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-black/30 dark:text-white";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 p-4 sm:p-6 lg:p-8">
      <ModulePageHeader moduleId="brand" className="mb-2" />

      <header>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
          {MODULES.brand.productName}
        </p>
        <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
          Brand profile
        </h1>
        <p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">
          Saved once and reused across{" "}
          <Link href={MODULES.content.href} className="text-blue-600 hover:underline">
            Content
          </Link>{" "}
          and{" "}
          <Link href={MODULES.products.href} className="text-blue-600 hover:underline">
            Products
          </Link>{" "}
          AI generation.
        </p>
      </header>

      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6 lg:p-8 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Brand name <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={form.brand_name}
            onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
            placeholder="Your company or product line"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Brand description
          </label>
          <textarea
            className={`${inputClass} min-h-[100px] resize-y`}
            value={form.brand_description}
            onChange={(e) => setForm((f) => ({ ...f, brand_description: e.target.value }))}
            placeholder="What you do, positioning, personality."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Target audience
          </label>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={form.target_audience}
            onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
            placeholder="Who you serve and their context."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Tone of voice
          </label>
          <input
            className={inputClass}
            value={form.tone_of_voice}
            onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}
            placeholder="e.g. confident, warm, direct, premium"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Key selling points
          </label>
          <textarea
            className={`${inputClass} min-h-[100px] resize-y`}
            value={form.key_selling_points}
            onChange={(e) => setForm((f) => ({ ...f, key_selling_points: e.target.value }))}
            placeholder="Proof points, differentiators, guarantees — one per line or short notes."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Website URL <span className="font-bold text-slate-400">(optional)</span>
          </label>
          <input
            className={inputClass}
            type="url"
            value={form.website_url}
            onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            placeholder="https://"
          />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !form.brand_name.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save brand profile
            </>
          )}
        </button>
      </div>

      <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        Multi-brand assets from Settings remain available for other tools; this profile is the shared default for
        Content and Products.
      </p>
    </div>
  );
}
