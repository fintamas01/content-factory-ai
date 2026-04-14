"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Images,
  Sparkles,
  Loader2,
  RotateCcw,
  History,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { SimpleModal } from "@/app/components/ui/SimpleModal";
import type { PlanTier } from "@/lib/plan-config";
import { canAccess } from "@/lib/entitlements/features";
import { LockedFeatureStateClient } from "@/app/components/entitlements/LockedFeatureStateClient";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import { OUTPUT_LANGUAGE_OPTIONS } from "@/lib/i18n/output-language";
import { formatHistoryDate } from "@/lib/history/kind-styles";
import type {
  AdCreativeAssets,
  AdCreativeAsset,
  AdCreativeAssetImageDraft,
  AdCreativeAspectRatio,
} from "@/lib/ad-creative/types";
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_MODULES,
} from "@/lib/persistence/workspace-storage";

type AspectRatio = AdCreativeAspectRatio;

type AdAngle = {
  id: string;
  hook: string;
  headlines: string[];
  primaryTexts: string[];
  ctas: string[];
  visualConcept: {
    subject: string;
    scene: string;
    composition: string;
    lighting: string;
    palette: string;
    typography: string;
    overlays: string[];
    doNotDo: string[];
  };
  adaptations: Record<AspectRatio, string[]>;
};

type AdCreativeResult = {
  language: { code: string; label: string };
  aspectRatios: AspectRatio[];
  angles: AdAngle[];
  assets?: AdCreativeAssets;
};

type SocialPlatform = "instagram" | "facebook" | "linkedin";

type GenerationApiResponse =
  | { ok: true; generationId: string; result: AdCreativeResult }
  | { ok: false; error: string; details?: string; generationId?: string | null };

type GenerationRow = {
  id: string;
  created_at: string;
  title: string | null;
  product_name: string | null;
  brand_name: string | null;
  language: string | null;
  aspect_ratios: string[] | null;
  generated_copy: any;
  generated_concepts: any;
  generated_assets?: AdCreativeAssets;
  status: string;
  error_message: string | null;
};

const FEATURE_KEY = "adCreativeStudio" as const;

export default function AiAdCreativeStudioPage() {
  const [plan, setPlan] = useState<PlanTier>("free");
  const [gateReady, setGateReady] = useState(false);
  const [usageBump, setUsageBump] = useState(0);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!;
    return createBrowserClient(url, anon);
  }, []);

  const [workspaceScope, setWorkspaceScope] = useState<{
    userId: string;
    clientId: string;
  } | null>(null);
  const workspaceHydrated = useRef(false);

  const [form, setForm] = useState({
    productName: "",
    brandName: "",
    targetAudience: "",
    offerSummary: "",
    landingPageUrl: "",
    sourceImageUrl: "",
    language: "en",
    aspectRatios: ["1:1", "4:5", "9:16"] as AspectRatio[],
    styleDirection: "",
    callToAction: "",
    generateImages: false,
  });

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdCreativeResult | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [historyRows, setHistoryRows] = useState<GenerationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<"use" | "schedule">("use");
  const [publishPlatform, setPublishPlatform] = useState<SocialPlatform>("instagram");
  const [publishText, setPublishText] = useState("");
  const [publishImageUrl, setPublishImageUrl] = useState<string>("");
  const [scheduleDateTime, setScheduleDateTime] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing");
        const j = await res.json().catch(() => ({}));
        const p = (j?.plan ?? "free") as PlanTier;
        if (!cancelled) {
          setPlan(p);
          setGateReady(true);
        }
      } catch {
        if (!cancelled) setGateReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const res = await fetch("/api/clients");
      const j = await res.json().catch(() => ({}));
      const clientId = typeof j.activeClientId === "string" ? j.activeClientId : "";
      if (!clientId || cancelled) return;
      setWorkspaceScope({ userId: user.id, clientId });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  type WorkspaceSnapshot = {
    form: typeof form;
    generationId: string | null;
    result: AdCreativeResult | null;
  };

  useEffect(() => {
    if (!workspaceScope || workspaceHydrated.current) return;
    const w = loadWorkspace<WorkspaceSnapshot>(
      workspaceScope.userId,
      workspaceScope.clientId,
      WORKSPACE_MODULES.adCreativeStudio
    );
    if (w) {
      if (w.form) setForm((prev) => ({ ...prev, ...w.form }));
      if (w.generationId) setGenerationId(w.generationId);
      if (w.result) setResult(w.result);
    }
    workspaceHydrated.current = true;
  }, [workspaceScope]);

  useEffect(() => {
    if (!workspaceScope || !workspaceHydrated.current) return;
    const t = window.setTimeout(() => {
      saveWorkspace(
        workspaceScope.userId,
        workspaceScope.clientId,
        WORKSPACE_MODULES.adCreativeStudio,
        { form, generationId, result } satisfies WorkspaceSnapshot
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [workspaceScope, form, generationId, result]);

  function toggleAspectRatio(ar: AspectRatio) {
    setForm((prev) => {
      const has = prev.aspectRatios.includes(ar);
      const next = has ? prev.aspectRatios.filter((x) => x !== ar) : [...prev.aspectRatios, ar];
      return { ...prev, aspectRatios: next.length ? next : prev.aspectRatios };
    });
  }

  const canSubmit = useMemo(() => {
    return (
      form.productName.trim().length > 0 &&
      form.brandName.trim().length > 0 &&
      form.targetAudience.trim().length > 0 &&
      form.offerSummary.trim().length > 0 &&
      form.aspectRatios.length > 0 &&
      !generating
    );
  }, [form, generating]);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/ad-creative/history");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHistoryRows([]);
        setHistoryError(typeof json?.error === "string" ? json.error : "Could not load history.");
        return;
      }
      setHistoryRows(Array.isArray(json.items) ? (json.items as GenerationRow[]) : []);
    } catch {
      setHistoryRows([]);
      setHistoryError("Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!workspaceScope) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceScope?.clientId]);

  function hydrateResultFromRow(r: GenerationRow): AdCreativeResult | null {
    if (!r) return null;
    const ratios = (Array.isArray(r.aspect_ratios) ? r.aspect_ratios : [])
      .map((x) => (typeof x === "string" ? (x as AspectRatio) : null))
      .filter(Boolean) as AspectRatio[];

    const copyAngles = Array.isArray(r.generated_copy?.angles) ? r.generated_copy.angles : [];
    const conceptAngles = Array.isArray(r.generated_concepts?.angles)
      ? r.generated_concepts.angles
      : [];

    const byId = new Map<string, any>();
    for (const c of conceptAngles) {
      if (c && typeof c.id === "string") byId.set(c.id, c);
    }

    const angles: AdAngle[] = copyAngles
      .filter((a: any) => a && typeof a.id === "string")
      .map((a: any) => {
        const concept = byId.get(a.id) ?? {};
        return {
          id: String(a.id),
          hook: String(a.hook ?? concept.hook ?? ""),
          headlines: Array.isArray(a.headlines) ? a.headlines.map(String) : [],
          primaryTexts: Array.isArray(a.primaryTexts) ? a.primaryTexts.map(String) : [],
          ctas: Array.isArray(a.ctas) ? a.ctas.map(String) : [],
          visualConcept: {
            subject: String(concept?.visualConcept?.subject ?? ""),
            scene: String(concept?.visualConcept?.scene ?? ""),
            composition: String(concept?.visualConcept?.composition ?? ""),
            lighting: String(concept?.visualConcept?.lighting ?? ""),
            palette: String(concept?.visualConcept?.palette ?? ""),
            typography: String(concept?.visualConcept?.typography ?? ""),
            overlays: Array.isArray(concept?.visualConcept?.overlays)
              ? concept.visualConcept.overlays.map(String)
              : [],
            doNotDo: Array.isArray(concept?.visualConcept?.doNotDo)
              ? concept.visualConcept.doNotDo.map(String)
              : [],
          },
          adaptations: (concept?.adaptations ?? {}) as Record<AspectRatio, string[]>,
        };
      })
      .slice(0, 5);

    return {
      language: { code: String(r.language ?? "en"), label: String(r.language ?? "en") },
      aspectRatios: ratios.length ? ratios : (["1:1", "4:5", "9:16"] as AspectRatio[]),
      angles,
      assets: (r as any).generated_assets ?? undefined,
    };
  }

  async function submit() {
    setGenerating(true);
    setError(null);
    try {
      const payload = {
        productName: form.productName.trim(),
        brandName: form.brandName.trim(),
        targetAudience: form.targetAudience.trim(),
        offerSummary: form.offerSummary.trim(),
        landingPageUrl: form.landingPageUrl.trim() || undefined,
        sourceImageUrl: form.sourceImageUrl.trim() || undefined,
        language: form.language,
        aspectRatios: form.aspectRatios,
        styleDirection: form.styleDirection.trim() || undefined,
        callToAction: form.callToAction.trim() || undefined,
        generateImages: Boolean(form.generateImages),
      };

      const res = await fetch("/api/ad-creative/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as GenerationApiResponse;

      if (!res.ok || !json || (json as any).ok !== true) {
        const msg =
          typeof (json as any)?.error === "string"
            ? (json as any).error
            : "Generation failed.";
        const details =
          typeof (json as any)?.details === "string" ? (json as any).details : "";
        setError(details ? `${msg} ${details}` : msg);
        if (typeof (json as any)?.generationId === "string") {
          setGenerationId((json as any).generationId);
        }
        return;
      }

      setGenerationId(json.generationId);
      setResult(json.result);
      setUsageBump((x) => x + 1);
      await loadHistory();
    } catch {
      setError("Network error.");
    } finally {
      setGenerating(false);
    }
  }

  function generateNew() {
    setResult(null);
    setGenerationId(null);
    setError(null);
    setCopiedKey(null);
    if (workspaceScope) {
      clearWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.adCreativeStudio);
      workspaceHydrated.current = false;
      // Re-hydration will happen on next effect tick; preserve form values in state.
    }
  }

  async function copyText(key: string, value: string) {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
  }

  function composeSocialText(angle: AdAngle): string {
    const headline = angle.headlines?.[0]?.trim() ?? "";
    const primary = angle.primaryTexts?.[0]?.trim() ?? "";
    const cta = angle.ctas?.[0]?.trim() ?? "";
    const parts = [headline, primary, cta].filter(Boolean);
    return parts.join("\n\n");
  }

  function pickDraftImageUrlForAngle(angleId: string): string {
    const items: AdCreativeAsset[] = Array.isArray(result?.assets?.items)
      ? result!.assets!.items
      : [];
    const first = items.find(
      (x) =>
        x.kind === "image" &&
        x.angleId === angleId &&
        x.status === "succeeded" &&
        typeof (x as any).url === "string"
    ) as AdCreativeAssetImageDraft | undefined;
    return typeof first?.url === "string" ? first.url : "";
  }

  function openPublish(angle: AdAngle, mode: "use" | "schedule") {
    setPublishMode(mode);
    setPublishPlatform("instagram");
    setPublishText(composeSocialText(angle));
    setPublishImageUrl(pickDraftImageUrlForAngle(angle.id));
    setPublishError(null);
    setPublishSuccess(null);
    setScheduleDateTime("");
    setPublishOpen(true);
  }

  async function doPublish() {
    setPublishBusy(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      if (!publishText.trim()) {
        setPublishError("Post text is required.");
        return;
      }
      const needsImage = publishPlatform === "instagram";
      if (needsImage && !publishImageUrl.trim()) {
        setPublishError("Instagram publishing requires an image URL.");
        return;
      }

      if (publishMode === "schedule") {
        if (!scheduleDateTime.trim()) {
          setPublishError("Pick a date and time.");
          return;
        }
        const scheduledUnix = Math.floor(new Date(scheduleDateTime).getTime() / 1000);
        const nowUnix = Math.floor(Date.now() / 1000);
        if (!Number.isFinite(scheduledUnix) || scheduledUnix <= nowUnix) {
          setPublishError("Pick a time in the future.");
          return;
        }

        const res = await fetch("/api/schedule-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: publishPlatform,
            imageUrl: needsImage ? publishImageUrl : null,
            caption: publishText,
            scheduledTime: scheduledUnix,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (j?.code === "NOT_CONNECTED") {
            setPublishError(
              `${j.error || "Not connected."} Connect accounts in /dashboard/social-connections.`
            );
            return;
          }
          if (j?.code === "FEATURE_LOCKED") {
            setPublishError("Social publishing is locked for your plan. Upgrade under Billing.");
            return;
          }
          setPublishError(typeof j?.error === "string" ? j.error : "Scheduling failed.");
          return;
        }
        setPublishSuccess("Scheduled. Your post will go out at the selected time.");
        return;
      }

      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: publishPlatform,
          imageUrl: needsImage ? publishImageUrl : null,
          text: publishText,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j?.code === "NOT_CONNECTED") {
          setPublishError(
            `${j.error || "Not connected."} Connect accounts in /dashboard/social-connections.`
          );
          return;
        }
        if (j?.code === "FEATURE_LOCKED") {
          setPublishError("Social publishing is locked for your plan. Upgrade under Billing.");
          return;
        }
        setPublishError(typeof j?.error === "string" ? j.error : "Publishing failed.");
        return;
      }
      setPublishSuccess(`Published to ${publishPlatform}.`);
    } finally {
      setPublishBusy(false);
    }
  }

  if (gateReady && !canAccess(plan, FEATURE_KEY)) {
    return (
      <Page>
        <LockedFeatureStateClient featureKey={FEATURE_KEY} currentPlan={plan} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHero
        icon={<Images className="h-6 w-6" />}
        eyebrow="V1 · Static ad concepts · Copy variants · History"
        title="AI Ad Creative Studio"
        description="Generate ad creative concepts (static), placement-ready copy (headline/text/CTA), and quick variations across aspect ratios—so you can test faster with less guesswork."
      />

      <ModuleUsageBanner feature="content" bump={usageBump} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  Creative brief
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Generate angles, copy variants, and visual concepts
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Fill in the essentials, then generate 3–5 ad angles with placement-aware adaptation
                  notes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-2xl"
                  onClick={generateNew}
                  disabled={generating && !result}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Generate new
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="text-xs font-semibold text-white/60">Product name</label>
                <Input
                  value={form.productName}
                  onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                  placeholder="e.g. Nimbus Running Shoes"
                  className="mt-1.5 rounded-2xl"
                  required
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs font-semibold text-white/60">Brand name</label>
                <Input
                  value={form.brandName}
                  onChange={(e) => setForm((p) => ({ ...p, brandName: e.target.value }))}
                  placeholder="e.g. Nimbus"
                  className="mt-1.5 rounded-2xl"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Target audience</label>
                <Textarea
                  value={form.targetAudience}
                  onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value }))}
                  placeholder="Who is this for? What do they care about?"
                  className="mt-1.5 min-h-[92px] rounded-2xl"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Offer summary</label>
                <Textarea
                  value={form.offerSummary}
                  onChange={(e) => setForm((p) => ({ ...p, offerSummary: e.target.value }))}
                  placeholder="What’s the offer? Benefits, pricing, guarantees, shipping, etc."
                  className="mt-1.5 min-h-[96px] rounded-2xl"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">
                  Landing page URL <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Input
                  value={form.landingPageUrl}
                  onChange={(e) => setForm((p) => ({ ...p, landingPageUrl: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">
                  Source image URL <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Input
                  value={form.sourceImageUrl}
                  onChange={(e) => setForm((p) => ({ ...p, sourceImageUrl: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-xs font-semibold text-white/60">Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/85 outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-500/10"
                >
                  {OUTPUT_LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="text-xs font-semibold text-white/60">Aspect ratios</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["1:1", "4:5", "9:16"] as AspectRatio[]).map((ar) => {
                    const active = form.aspectRatios.includes(ar);
                    return (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => toggleAspectRatio(ar)}
                        className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                          active
                            ? "border border-transparent bg-cyan-500/20 text-cyan-100 shadow-[0_0_22px_-10px_rgba(34,211,238,0.55)]"
                            : "border border-white/[0.1] bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/75"
                        }`}
                      >
                        {ar}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">
                  Style direction <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Textarea
                  value={form.styleDirection}
                  onChange={(e) => setForm((p) => ({ ...p, styleDirection: e.target.value }))}
                  placeholder="e.g. clean premium product photography, minimal typography, high contrast"
                  className="mt-1.5 min-h-[82px] rounded-2xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">
                  CTA direction <span className="font-normal text-white/35">(optional)</span>
                </label>
                <Input
                  value={form.callToAction}
                  onChange={(e) => setForm((p) => ({ ...p, callToAction: e.target.value }))}
                  placeholder="e.g. Shop now"
                  className="mt-1.5 rounded-2xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-white/60">Draft images</label>
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, generateImages: !p.generateImages }))}
                    className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                      form.generateImages
                        ? "border border-transparent bg-cyan-500/20 text-cyan-100 shadow-[0_0_22px_-10px_rgba(34,211,238,0.55)]"
                        : "border border-white/[0.1] bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/75"
                    }`}
                  >
                    {form.generateImages ? "On" : "Off"}
                  </button>
                  <p className="text-sm text-white/55">
                    Optionally generate AI draft images for each concept. Drafts are not final,
                    and may fail independently without blocking the copy results.
                  </p>
                </div>
              </div>
            </div>

            {!result && !generating ? (
              <div className="mt-8 rounded-[28px] border border-dashed border-white/10 bg-black/15 py-12 text-center">
                <Images className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="font-bold text-slate-400">No results yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Fill in the brief above, then click Generate.
                </p>
              </div>
            ) : null}

            {result ? (
              <div className="mt-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                      Output
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      Angles, copy variants, and concepts
                    </h3>
                    <p className="mt-1 text-sm text-white/55">
                      Generation id:{" "}
                      <span className="font-mono text-white/75">{generationId ?? "—"}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {result.angles.map((a, idx) => (
                    <Card key={a.id} className="border-white/[0.08] bg-white/[0.03]">
                      <div className="p-6 sm:p-7">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                              Angle {idx + 1}
                            </p>
                            <h4 className="mt-2 text-base font-semibold text-white">
                              {a.hook || "Untitled angle"}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-2xl"
                              onClick={() => openPublish(a, "use")}
                            >
                              Use in Social Post
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-2xl"
                              onClick={() => openPublish(a, "schedule")}
                            >
                              Schedule Post
                            </Button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold text-white/70">Headlines</p>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyText(`h:${a.id}`, a.headlines.join("\n"))
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white/80"
                              >
                                {copiedKey === `h:${a.id}` ? (
                                  <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                {copiedKey === `h:${a.id}` ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-white/75">
                              {a.headlines.length ? (
                                a.headlines.map((t, i) => <li key={i}>• {t}</li>)
                              ) : (
                                <li className="text-white/35">No headline variants.</li>
                              )}
                            </ul>
                          </div>

                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold text-white/70">CTAs</p>
                              <button
                                type="button"
                                onClick={() => void copyText(`c:${a.id}`, a.ctas.join("\n"))}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white/80"
                              >
                                {copiedKey === `c:${a.id}` ? (
                                  <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                {copiedKey === `c:${a.id}` ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-white/75">
                              {a.ctas.length ? (
                                a.ctas.map((t, i) => <li key={i}>• {t}</li>)
                              ) : (
                                <li className="text-white/35">No CTA suggestions.</li>
                              )}
                            </ul>
                          </div>

                          <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold text-white/70">Primary text</p>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyText(`p:${a.id}`, a.primaryTexts.join("\n\n"))
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white/80"
                              >
                                {copiedKey === `p:${a.id}` ? (
                                  <Check className="h-4 w-4 text-emerald-300" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                {copiedKey === `p:${a.id}` ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <div className="mt-3 space-y-3 text-sm text-white/75">
                              {a.primaryTexts.length ? (
                                a.primaryTexts.map((t, i) => (
                                  <div
                                    key={i}
                                    className="rounded-2xl border border-white/[0.06] bg-black/15 p-4 leading-relaxed"
                                  >
                                    {t}
                                  </div>
                                ))
                              ) : (
                                <div className="text-white/35">No primary text variants.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-cyan-500/10 via-violet-500/[0.08] to-transparent p-5">
                            <p className="text-xs font-semibold text-white/80">Visual concept</p>
                            <div className="mt-3 space-y-2 text-sm text-white/75">
                              <p>
                                <span className="font-semibold text-white/80">Subject:</span>{" "}
                                {a.visualConcept.subject || "—"}
                              </p>
                              <p>
                                <span className="font-semibold text-white/80">Scene:</span>{" "}
                                {a.visualConcept.scene || "—"}
                              </p>
                              <p>
                                <span className="font-semibold text-white/80">Composition:</span>{" "}
                                {a.visualConcept.composition || "—"}
                              </p>
                              <p>
                                <span className="font-semibold text-white/80">Lighting:</span>{" "}
                                {a.visualConcept.lighting || "—"}
                              </p>
                              <p>
                                <span className="font-semibold text-white/80">Palette:</span>{" "}
                                {a.visualConcept.palette || "—"}
                              </p>
                              <p>
                                <span className="font-semibold text-white/80">Typography:</span>{" "}
                                {a.visualConcept.typography || "—"}
                              </p>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                                <p className="text-[11px] font-black uppercase tracking-wider text-white/45">
                                  Overlays
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-white/70">
                                  {a.visualConcept.overlays?.length ? (
                                    a.visualConcept.overlays.slice(0, 8).map((t, i) => (
                                      <li key={i}>• {t}</li>
                                    ))
                                  ) : (
                                    <li className="text-white/35">—</li>
                                  )}
                                </ul>
                              </div>
                              <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                                <p className="text-[11px] font-black uppercase tracking-wider text-white/45">
                                  Do not do
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-white/70">
                                  {a.visualConcept.doNotDo?.length ? (
                                    a.visualConcept.doNotDo.slice(0, 8).map((t, i) => (
                                      <li key={i}>• {t}</li>
                                    ))
                                  ) : (
                                    <li className="text-white/35">—</li>
                                  )}
                                </ul>
                              </div>
                            </div>

                            {Array.isArray(result.assets?.items) ? (
                              <div className="mt-5">
                                <p className="text-[11px] font-black uppercase tracking-wider text-white/45">
                                  Draft image (AI-generated)
                                </p>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                  {(result.assets?.items ?? [])
                                    .filter(
                                      (x) =>
                                        x.kind === "image" &&
                                        x.angleId === a.id &&
                                        x.status === "succeeded" &&
                                        typeof (x as any).url === "string"
                                    )
                                    .slice(0, 2)
                                    .map((img: any, i) => (
                                      <a
                                        key={`${a.id}-img-${i}`}
                                        href={img.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={img.url}
                                          alt="Draft ad creative (AI generated)"
                                          className="h-auto w-full transition group-hover:scale-[1.01]"
                                          loading="lazy"
                                        />
                                      </a>
                                    ))}
                                </div>
                                {(result.assets?.items ?? []).some(
                                  (x) => x.kind === "image" && x.angleId === a.id && x.status === "failed"
                                ) ? (
                                  <p className="mt-2 text-xs text-amber-200/70">
                                    Some draft images failed for this angle. You can regenerate later.
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs text-white/45">
                                  Draft only — not production-ready. No guaranteed brand compliance.
                                </p>
                                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                                  <p className="text-[11px] font-black uppercase tracking-wider text-white/45">
                                    Video draft (coming later)
                                  </p>
                                  <p className="mt-2 text-xs text-white/50">
                                    This module is now structured to support short-form video drafts as assets in the
                                    same list as images. No video generation is enabled in V1.
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                            <p className="text-xs font-semibold text-white/80">
                              Aspect-ratio adaptations
                            </p>
                            <div className="mt-3 space-y-3">
                              {(result.aspectRatios.length
                                ? result.aspectRatios
                                : (["1:1", "4:5", "9:16"] as AspectRatio[])
                              ).map((ar) => (
                                <div
                                  key={ar}
                                  className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"
                                >
                                  <p className="text-[11px] font-black uppercase tracking-wider text-white/45">
                                    {ar}
                                  </p>
                                  <ul className="mt-2 space-y-1 text-sm text-white/70">
                                    {a.adaptations?.[ar]?.length ? (
                                      a.adaptations[ar].slice(0, 8).map((t, i) => (
                                        <li key={i}>• {t}</li>
                                      ))
                                    ) : (
                                      <li className="text-white/35">—</li>
                                    )}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  History
                </p>
                <h3 className="mt-2 text-base font-semibold text-white">Recent generations</h3>
                <p className="mt-1 text-sm text-white/55">
                  Click any item to reload its results.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl"
                onClick={() => void loadHistory()}
                disabled={historyLoading}
              >
                {historyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <History className="h-4 w-4" />
                )}
              </Button>
            </div>

            {historyError ? (
              <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
                {historyError}
              </div>
            ) : null}

            {historyLoading ? (
              <div className="mt-6 flex items-center gap-2 text-white/50">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : historyRows.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-black/15 py-10 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="font-bold text-slate-400">No history yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Your generations will appear here after you run your first one.
                </p>
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {historyRows.slice(0, 12).map((r) => {
                  const active = r.id === generationId;
                  const title =
                    (r.title ?? "").trim() ||
                    `${r.product_name ?? "Ad creative"} · ${r.brand_name ?? ""}`.trim();
                  const previewHook = Array.isArray(r.generated_copy?.angles)
                    ? String(r.generated_copy.angles?.[0]?.hook ?? "")
                    : "";
                  const { primary, sub } = r.created_at
                    ? formatHistoryDate(r.created_at)
                    : { primary: "—", sub: "" };
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setGenerationId(r.id);
                          setError(null);
                          const hydrated = hydrateResultFromRow(r);
                          setResult(hydrated);
                        }}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-cyan-400/25 bg-cyan-500/10 shadow-[0_0_28px_-18px_rgba(34,211,238,0.55)]"
                            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{title}</p>
                            <p className="mt-1 truncate text-xs text-white/45">
                              {previewHook || "—"}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold text-white/40">
                              {String(r.language ?? "en").toUpperCase()} · {primary}
                              {sub ? ` · ${sub}` : ""} ·{" "}
                              <span
                                className={
                                  r.status === "failed"
                                    ? "text-rose-200/80"
                                    : r.status === "running"
                                      ? "text-amber-200/80"
                                      : "text-emerald-200/70"
                                }
                              >
                                {r.status}
                              </span>
                            </p>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
                        </div>
                        {r.status === "failed" ? (
                          <p className="mt-2 text-xs text-rose-200/80">
                            Failed: {r.error_message ?? "Unknown error"}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <SimpleModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={publishMode === "schedule" ? "Schedule social post" : "Use in social post"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/60">Platform</label>
            <select
              value={publishPlatform}
              onChange={(e) => setPublishPlatform(e.target.value as SocialPlatform)}
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/85 outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-500/10"
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <p className="mt-2 text-xs text-white/45">
              Publishing is handled by the existing social module and respects your plan access.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60">Post text</label>
            <Textarea
              value={publishText}
              onChange={(e) => setPublishText(e.target.value)}
              className="mt-1.5 min-h-[140px] rounded-2xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60">
              Image URL{" "}
              <span className="font-normal text-white/35">
                (required for Instagram)
              </span>
            </label>
            <Input
              value={publishImageUrl}
              onChange={(e) => setPublishImageUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1.5 rounded-2xl"
            />
            <p className="mt-2 text-xs text-white/45">
              If you generated draft images in Ad Creative Studio, the first draft is prefilled. You
              can paste another URL if needed.
            </p>
          </div>

          {publishMode === "schedule" ? (
            <div>
              <label className="text-xs font-semibold text-white/60">Schedule time</label>
              <Input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="mt-1.5 rounded-2xl"
              />
            </div>
          ) : null}

          {publishError ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {publishError}
            </div>
          ) : null}
          {publishSuccess ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {publishSuccess}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void doPublish()}
              disabled={publishBusy}
            >
              {publishBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…
                </>
              ) : publishMode === "schedule" ? (
                "Schedule"
              ) : (
                "Publish"
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => setPublishOpen(false)}
              disabled={publishBusy}
            >
              Close
            </Button>
          </div>
        </div>
      </SimpleModal>
    </Page>
  );
}

