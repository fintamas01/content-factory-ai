"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Save, ExternalLink, Palette } from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { Spinner } from "@/app/components/ui/Spinner";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

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

  useCopilotPageContext({
    page: "brand",
    data: {
      loading,
      saving,
      hasUser: Boolean(userId),
      form: {
        brand_name: form.brand_name,
        brand_description: form.brand_description?.slice(0, 700),
        target_audience: form.target_audience?.slice(0, 700),
        tone_of_voice: form.tone_of_voice,
        key_selling_points: form.key_selling_points?.slice(0, 900),
        website_url: form.website_url,
      },
    },
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
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Page className="max-w-3xl">
        <EmptyState
          title="Sign in to manage your brand profile."
          description="Your saved brand profile is reused across Content and Products."
        />
      </Page>
    );
  }

  return (
    <Page className="max-w-3xl">
      <ModulePageHeader moduleId="brand" className="mb-2" />

      <PageHero
        icon={<Palette className="h-6 w-6" aria-hidden />}
        eyebrow={MODULES.brand.productName}
        title="Brand profile"
        description={
          <>
            Saved once and reused across{" "}
            <Link href={MODULES.content.href} className="text-cyan-200/90 hover:text-white underline-offset-4 hover:underline">
              Content
            </Link>{" "}
            and{" "}
            <Link href={MODULES.products.href} className="text-cyan-200/90 hover:text-white underline-offset-4 hover:underline">
              Products
            </Link>{" "}
            AI generation.
          </>
        }
      />

      <Card className="p-5 sm:p-6 lg:p-8">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Brand name <span className="text-red-300">*</span>
          </label>
          <Input
            value={form.brand_name}
            onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
            placeholder="Your company or product line"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Brand description
          </label>
          <Textarea
            className="min-h-[100px] resize-y"
            value={form.brand_description}
            onChange={(e) => setForm((f) => ({ ...f, brand_description: e.target.value }))}
            placeholder="What you do, positioning, personality."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Target audience
          </label>
          <Textarea
            className="min-h-[80px] resize-y"
            value={form.target_audience}
            onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
            placeholder="Who you serve and their context."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Tone of voice
          </label>
          <Input
            value={form.tone_of_voice}
            onChange={(e) => setForm((f) => ({ ...f, tone_of_voice: e.target.value }))}
            placeholder="e.g. confident, warm, direct, premium"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Key selling points
          </label>
          <Textarea
            className="min-h-[100px] resize-y"
            value={form.key_selling_points}
            onChange={(e) => setForm((f) => ({ ...f, key_selling_points: e.target.value }))}
            placeholder="Proof points, differentiators, guarantees — one per line or short notes."
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Website URL <span className="font-bold text-white/35">(optional)</span>
          </label>
          <Input
            type="url"
            value={form.website_url}
            onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            placeholder="https://"
          />
        </div>

        <Button
          type="button"
          onClick={save}
          disabled={saving || !form.brand_name.trim()}
          variant="primary"
          size="lg"
          className="rounded-2xl text-[11px] font-black uppercase tracking-[0.22em]"
        >
          {saving ? (
            <>
              <Spinner className="h-4 w-4" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save brand profile
            </>
          )}
        </Button>
      </Card>

      <p className="flex items-center gap-2 text-xs font-medium text-white/40">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        Multi-brand assets from Settings remain available for other tools; this profile is the shared default for
        Content and Products.
      </p>
    </Page>
  );
}
