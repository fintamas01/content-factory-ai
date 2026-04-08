"use client";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { OUTPUT_LANGUAGE_OPTIONS } from "@/lib/i18n/output-language";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import { Button } from "@/app/components/ui/Button";
import { Textarea } from "@/app/components/ui/Textarea";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Type,
  Zap,
  Copy,
  History as HistoryIcon,
  Send,
  Search,
  Image as ImageIcon,
  Globe,
  CheckCircle2,
  Loader2,
  X,
  Wand2,
  Smile,
  Briefcase,
  Eye,
  Layout,
  Edit3,
  Target,
  RotateCcw,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { motion, AnimatePresence } from "framer-motion";
import type { UserBrandProfileRow } from "@/lib/brand-profile/types";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_MODULES,
} from "@/lib/persistence/workspace-storage";
import { WorkspaceSessionBanner } from "@/app/components/persistence/WorkspaceSessionBanner";
import { ReviewWorkspaceStrip } from "@/app/components/review/ReviewWorkspaceStrip";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const shell =
  "min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#080c14] via-[#070b12] to-[#05070c] text-zinc-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-100";

const panel =
  "rounded-2xl border border-white/[0.06] bg-[#0c1018]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm";

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500";

const templates = [
  { id: "custom", name: "✨ Pro content", prompt: "" },
  {
    id: "blog",
    name: "📝 Blog to viral post",
    prompt:
      "Summarize the core idea and turn it into a scroll-stopping, engaging post.",
  },
  {
    id: "product",
    name: "🚀 Product launch",
    prompt:
      "Focus on benefits and problem-solving; use a strong, clear call to action.",
  },
  {
    id: "event",
    name: "📅 Event invite",
    prompt: "Highlight date, location, and why people should attend.",
  },
];

/** Legacy saved workspaces used Hungarian tone keys */
const LEGACY_TONE: Record<string, string> = {
  szakmai: "professional",
  vicces: "funny",
  lelkesito: "enthusiastic",
  provokativ: "provocative",
};

const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "funny", label: "Funny" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "provocative", label: "Bold" },
];

function normalizeTone(raw: string): string {
  return LEGACY_TONE[raw] ?? raw;
}

const allPlatforms = [
  { id: 'LinkedIn', label: 'LinkedIn' },
  { id: 'Instagram', label: 'Instagram' },
  { id: 'Facebook', label: 'Facebook' },
  { id: 'X (Twitter)', label: 'X (Twitter)' },
  { id: 'Newsletter', label: 'Newsletter' },
  { id: 'TikTok Script', label: 'TikTok Script' },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [tone, setTone] = useState("professional");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("en");
  const [useResearch, setUseResearch] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [isBasic, setIsBasic] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [unifiedBrand, setUnifiedBrand] = useState<UserBrandProfileRow | null>(null);
  const [usageBump, setUsageBump] = useState(0);

  const [workspaceScope, setWorkspaceScope] = useState<{
    userId: string;
    clientId: string;
  } | null>(null);
  const contentWorkspaceHydrated = useRef(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const pendingBrandIdRef = useRef<string | null>(null);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);

  useCopilotPageContext({
    page: "content",
    data: {
      lang,
      tone,
      useResearch,
      selectedTemplate: { id: selectedTemplate?.id, name: selectedTemplate?.name },
      selectedPlatforms,
      hasUnifiedBrand: Boolean(unifiedBrand),
      selectedBrand: selectedBrand
        ? { id: selectedBrand.id, brand_name: selectedBrand.brand_name }
        : null,
      inputPreview: input.slice(0, 1200),
      resultsPreview: results
        ? Object.fromEntries(
            Object.entries(results).slice(0, 6).map(([k, v]: any) => [
              k,
              typeof v?.text === "string" ? v.text.slice(0, 900) : String(v ?? "").slice(0, 900),
            ])
          )
        : null,
      loading,
    },
  });

  useEffect(() => {
    const fetchBrands = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('brand_name', { ascending: true });
        
      if (data) {
        setBrands(data);
        if (!selectedBrand && data.length > 0) setSelectedBrand(data[0]);
      }
    };
    fetchBrands();
  }, [user]);

  useEffect(() => {
    const loadUnified = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_brand_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setUnifiedBrand(data ?? null);
    };
    loadUnified();
  }, [user]);
  
  useEffect(() => {
    setMounted(true);
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const billingRes = await fetch("/api/billing").catch(() => null);
        if (billingRes && billingRes.ok) {
          const j = (await billingRes.json().catch(() => ({}))) as { plan?: string };
          const p = String(j.plan ?? "free");
          setIsPro(p === "pro" || p === "elite");
          setIsBasic(p === "basic");
        } else {
          setIsPro(false);
          setIsBasic(false);
        }
        const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setGenCount(count || 0);
      }
    };
    checkStatus();
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
  }, []);

  type ContentWorkspaceSnapshot = {
    input: string;
    tone: string;
    results: any | null;
    lang: string;
    useResearch: boolean;
    templateId: string;
    selectedPlatforms: string[];
    selectedBrandId: string | null;
    reviewItemId: string | null;
  };

  useEffect(() => {
    if (!workspaceScope || contentWorkspaceHydrated.current) return;
    const w = loadWorkspace<ContentWorkspaceSnapshot>(
      workspaceScope.userId,
      workspaceScope.clientId,
      WORKSPACE_MODULES.content
    );
    if (w) {
      if (typeof w.input === "string") setInput(w.input);
      if (typeof w.tone === "string") setTone(normalizeTone(w.tone));
      if (w.results) setResults(w.results);
      if (typeof w.lang === "string") setLang(w.lang);
      if (typeof w.useResearch === "boolean") setUseResearch(w.useResearch);
      if (typeof w.templateId === "string") {
        const t = templates.find((x) => x.id === w.templateId);
        if (t) setSelectedTemplate(t);
      }
      if (Array.isArray(w.selectedPlatforms)) setSelectedPlatforms(w.selectedPlatforms);
      if (typeof w.selectedBrandId === "string" && w.selectedBrandId) {
        pendingBrandIdRef.current = w.selectedBrandId;
      }
      if (typeof w.reviewItemId === "string") setReviewItemId(w.reviewItemId);
    }
    contentWorkspaceHydrated.current = true;
    setWorkspaceReady(true);
  }, [workspaceScope]);

  useEffect(() => {
    if (!pendingBrandIdRef.current || !brands.length) return;
    const b = brands.find((x: any) => x.id === pendingBrandIdRef.current);
    if (b) {
      setSelectedBrand(b);
      pendingBrandIdRef.current = null;
    }
  }, [brands]);

  useEffect(() => {
    if (!workspaceScope || !contentWorkspaceHydrated.current) return;
    const t = window.setTimeout(() => {
      saveWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.content, {
        input,
        tone,
        results,
        lang,
        useResearch,
        templateId: selectedTemplate?.id ?? "custom",
        selectedPlatforms,
        selectedBrandId: selectedBrand?.id ?? null,
        reviewItemId,
      } satisfies ContentWorkspaceSnapshot);
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    workspaceScope,
    input,
    tone,
    results,
    lang,
    useResearch,
    selectedTemplate?.id,
    selectedPlatforms,
    selectedBrand?.id,
    reviewItemId,
  ]);

  const startNewContentGeneration = () => {
    if (workspaceScope) {
      clearWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.content);
    }
    setInput("");
    setResults(null);
    setSelectedPlatforms([]);
    setReviewItemId(null);
  };

  const handleButtonMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setButtonPos({ x: x * 0.2, y: y * 0.2 });
  };

  const generateAll = async () => {
    if (!input || selectedPlatforms.length === 0) {
      alert("Add a source and select at least one platform.");
      return;
    }
    if (!unifiedBrand && !selectedBrand) {
      alert(
        "Select a brand from the list, or save a shared brand profile under Brand."
      );
      return;
    }
    setLoading(true);
    try {
      const brandProfile = unifiedBrand
        ? {
            name: unifiedBrand.brand_name,
            desc: unifiedBrand.brand_description ?? "",
            audience: unifiedBrand.target_audience ?? "",
          }
        : {
            name: selectedBrand.brand_name,
            desc: selectedBrand.description,
            audience: selectedBrand.target_audience,
          };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: input, 
          tone, 
          lang, 
          useResearch,
          templatePrompt: selectedTemplate.prompt, 
          platforms: selectedPlatforms,
          brandProfile,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "USAGE_LIMIT") {
          alert(
            `${data.error}\n\nUpgrade your plan under Billing to get more monthly generations.`
          );
        } else {
          alert(data.error || "Request failed.");
        }
      } else {
        const { __agent, ...platformResults } = data; // <-- itt kivesszük
        setResults(platformResults);                  // csak platformok mennek a UI-ba
        setUsageBump((n) => n + 1);

        // opcionális: ha később ki akarod írni a score-t
        if (__agent) {
          console.log("Agent score:", __agent.score);
        }
      }
    } catch (e) {
      console.error("Error:", e);
    }
    setLoading(false);
  };

  const togglePlatform = (id: string) => {
    const limit = isPro ? 5 : isBasic ? 2 : 1;
    if (selectedPlatforms.includes(id)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== id));
    } else if (selectedPlatforms.length < limit) {
      setSelectedPlatforms([...selectedPlatforms, id]);
    } else {
      alert(`Your plan allows up to ${limit} platform(s). Upgrade in Billing for more.`);
    }
  };

  if (!mounted) return null;

  if (!user) {
    return (
      <div className={`${shell} flex min-h-[50vh] items-center justify-center`}>
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400/90" aria-hidden />
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="mx-auto max-w-6xl space-y-8 pb-20 p-4 sm:p-6 lg:p-8">
        <ModulePageHeader moduleId="content" />
        <ModuleUsageBanner feature="content" bump={usageBump} />
        {results && workspaceReady ? (
          <WorkspaceSessionBanner
            variant="dark"
            title="Latest generation saved for this workspace"
            hint="Persists in this browser until you start over—nothing is cleared automatically."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={startNewContentGeneration}
                className="h-10 shrink-0 gap-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]"
              >
                <RotateCcw className="h-4 w-4" />
                New generation
              </Button>
            }
          />
        ) : null}
        {results && workspaceReady ? (
          <ReviewWorkspaceStrip
            module="content"
            reviewItemId={reviewItemId}
            onReviewItemIdChange={setReviewItemId}
            hasOutput={Boolean(results)}
            variant="dark"
            title={`${selectedTemplate?.name ?? "Content"} · ${selectedPlatforms.join(", ") || "outputs"}`}
            summary={input.slice(0, 400)}
            buildPayload={() => ({
              templateId: selectedTemplate?.id,
              platforms: selectedPlatforms,
              lang,
              tone,
              inputPreview: input.slice(0, 8000),
              results,
            })}
          />
        ) : null}
        {unifiedBrand ? (
          <p className="text-xs font-semibold text-emerald-200/90">
            Using your saved brand profile
          </p>
        ) : null}

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className={`${sectionLabel} text-zinc-500`}>Content</p>
            <p className="mt-1 max-w-xl text-sm font-medium text-zinc-400">
              Generate multi-platform copy from one brief—fast, on-brand, and ready to ship.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/social-connections"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-[11px] font-black uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/[0.08]"
            >
              Connect social accounts
            </Link>
            <button
              type="button"
              onClick={() => setUseResearch(!useResearch)}
              className={`flex items-center gap-3 rounded-2xl border px-5 py-3 transition-all ${
                useResearch
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/[0.04] text-zinc-500"
              }`}
            >
              <Search className={`h-4 w-4 ${useResearch ? "animate-pulse" : ""}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                Deep research {useResearch ? "on" : "off"}
              </span>
              <div
                className={`relative h-4 w-8 rounded-full transition-colors ${
                  useResearch ? "bg-cyan-500" : "bg-zinc-700"
                }`}
              >
                <motion.div
                  animate={{ x: useResearch ? 16 : 2 }}
                  className="absolute top-1 h-2 w-2 rounded-full bg-white"
                />
              </div>
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${panel} p-6 sm:p-8`}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Type className="h-5 w-5 text-cyan-300/80" />
              <span className={sectionLabel}>Source</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {useResearch ? (
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-400/90 animate-pulse">
                  <Globe className="h-3 w-3" /> Web search on
                </span>
              ) : null}
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white outline-none"
              >
                {OUTPUT_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative">
            {loading ? (
              <motion.div
                initial={{ top: 0 }}
                animate={{ top: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 z-20 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.5)]"
              />
            ) : null}
            <Textarea
              className="min-h-[220px] resize-y rounded-2xl border-white/[0.08] bg-black/35 px-6 py-6 text-base leading-relaxed"
              placeholder={
                useResearch
                  ? "Enter a topic or URL for the model to research on the web…"
                  : "Paste a link, notes, or a rough idea…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div className="space-y-8">
              <div>
                <span className={`${sectionLabel} mb-4 block`}>Platforms</span>
                <div className="flex flex-wrap gap-2">
                  {allPlatforms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                        selectedPlatforms.includes(p.id)
                          ? "border-cyan-400/40 bg-cyan-500/15 text-white shadow-[0_0_20px_-8px_rgba(34,211,238,0.4)]"
                          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-8">
                <span className={`${sectionLabel} mb-4 block`}>Template</span>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
                        selectedTemplate.id === t.id
                          ? "border-cyan-400/40 bg-cyan-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <span className={`${sectionLabel} mb-3 block`}>Tone</span>
                <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={`flex-1 min-w-[5.5rem] rounded-xl py-3 text-[10px] font-black uppercase tracking-wide transition-all ${
                        tone === t.value
                          ? "bg-white/[0.08] text-white shadow-lg"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={`${sectionLabel} mb-2 block`}>Brand</span>
                {unifiedBrand ? (
                  <div className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm font-bold text-zinc-100">
                    {unifiedBrand.brand_name?.trim() || "Brand profile"}
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-widest text-emerald-400/85">
                      From Brand — shared profile
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedBrand?.id}
                    onChange={(e) =>
                      setSelectedBrand(brands.find((b) => b.id === e.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-white outline-none"
                  >
                    {brands.length === 0 && (
                      <option value="">No saved brands (add in Settings)</option>
                    )}
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <motion.button
                ref={btnRef}
                type="button"
                onMouseMove={handleButtonMove}
                onMouseLeave={() => setButtonPos({ x: 0, y: 0 })}
                animate={{ x: buttonPos.x, y: buttonPos.y }}
                onClick={generateAll}
                disabled={
                  loading ||
                  selectedPlatforms.length === 0 ||
                  (!unifiedBrand && !selectedBrand)
                }
                className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 p-[2px] shadow-[0_0_32px_-12px_rgba(34,211,238,0.35)] transition-transform active:scale-[0.99] disabled:opacity-45"
              >
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    loading ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="absolute left-1/2 top-1/2 h-[250%] w-[250%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,#22d3ee_360deg)] animate-spin" />
                </div>
                <div className="relative z-10 flex items-center justify-center gap-3 rounded-2xl bg-[#070b12] py-5 text-lg font-black text-white">
                  {loading ? (
                    <span className="animate-pulse text-sm uppercase tracking-[0.2em]">
                      {useResearch ? "Deep analysis…" : "Generating…"}
                    </span>
                  ) : (
                    <>
                      Generate <Zap className="h-5 w-5 text-cyan-400" />
                    </>
                  )}
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {results ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {Object.entries(results).map(([key, data]: [string, any]) => (
              <ResultCard
                key={key}
                title={key.replace(/_/g, " ")}
                data={data}
                brandName={unifiedBrand?.brand_name ?? selectedBrand?.brand_name}
                lang={lang}
                userId={user.id}
              />
            ))}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function ResultCard({ title, data, brandName, lang, userId }: any) {
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(data.text || data);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'image' | 'preview'>('edit');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<{ score: number, critique: string, suggestions: string[] } | null>(null);

  const initialContent = data.text || data;

  const saveToHistory = async (currentImageUrl: string) => {
    try {
      const { error } = await supabase
        .from('generated_posts')
        .insert([
          {
            user_id: userId,
            brand_name: brandName,
            platform: title,
            content: content,      // Az aktuálisan megszerkesztett szöveg
            image_url: currentImageUrl // A Supabase Storage-ból kapott végleges link
          }
        ]);

      if (error) throw error;
      console.log("✅ Sikeresen mentve az előzményekbe!");
    } catch (e) {
      console.error("❌ Hiba az előzmény mentésekor:", e);
    }
  };

  const handleAgentAnalysis = async () => {
    setAgentLoading(true);
    try {
      const res = await fetch('/api/agent-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          platform: title,
          brandName: brandName
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setAgentResult(data);
    } catch (error) {
      console.error(error);
      alert("Something went wrong during analysis. The post may be too short.");
    } finally {
      setAgentLoading(false);
    }
  };

  const handleAutoImprove = async () => {
    if (!agentResult) return;
    setAgentLoading(true);
    
    try {
      const res = await fetch('/api/improve-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          critique: agentResult.critique,
          suggestions: agentResult.suggestions,
          lang,
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setContent(data.updatedText); // Kicseréljük a szöveget a feljavítottra
      setAgentResult(null); // Eltüntetjük a kártyát, hogy újra lehessen elemezni
      alert("Post updated using the AI suggestions.");
      
    } catch (error) {
      console.error(error);
      alert("Something went wrong while improving the post.");
    } finally {
      setAgentLoading(false);
    }
  };

  const handleImmediatePost = async () => {
    const platform = (title || "").toString();
    const needsImage = platform === "Instagram";
    if (needsImage && !imageUrl) {
      alert("Generate an image first.");
      return;
    }

    setIsPosting(true);
    try {
      const publishPlatform =
        platform === "Instagram"
          ? "instagram"
          : platform === "Facebook"
            ? "facebook"
            : platform === "LinkedIn"
              ? "linkedin"
              : "";
      if (!publishPlatform) {
        alert("Publishing is only supported for Instagram, Facebook, and LinkedIn.");
        return;
      }

      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform: publishPlatform,
          imageUrl: needsImage ? imageUrl : null,
          text: content
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (resData?.code === "NOT_CONNECTED") {
          throw new Error(
            `${resData.error || "Not connected."}\n\nConnect accounts in: /dashboard/social-connections`
          );
        }
        throw new Error(resData.error || "Something went wrong on the server.");
      }

      alert(`Your post was published to ${platform}.`);
      setShowResultModal(false); 
      
    } catch (error: any) {
      console.error(error);
      alert("Publishing failed:\n" + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedulePost = async () => {
    const platform = (title || "").toString();
    const needsImage = platform === "Instagram";
    if (needsImage && !imageUrl) {
      alert("Finalize an image first.");
      return;
    }
    if (!scheduleDate) {
      alert("Pick a date and time.");
      return;
    }

    // Átalakítjuk a naptár dátumát Unix Timestamp-re (másodpercekre), amit az Upstash kér
    const scheduledTimeUnix = Math.floor(new Date(scheduleDate).getTime() / 1000);
    const currentTimeUnix = Math.floor(Date.now() / 1000);

    if (scheduledTimeUnix <= currentTimeUnix) {
      alert("Pick a time in the future.");
      return;
    }

    setIsScheduling(true);
    try {
      const publishPlatform =
        platform === "Instagram"
          ? "instagram"
          : platform === "Facebook"
            ? "facebook"
            : platform === "LinkedIn"
              ? "linkedin"
              : "";
      if (!publishPlatform) {
        alert("Scheduling is only supported for Instagram, Facebook, and LinkedIn.");
        return;
      }

      const res = await fetch('/api/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform: publishPlatform,
          imageUrl: needsImage ? imageUrl : null,
          caption: content,
          scheduledTime: scheduledTimeUnix
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        if (resData?.code === "NOT_CONNECTED") {
          throw new Error(
            `${resData.error || "Not connected."}\n\nConnect accounts in: /dashboard/social-connections`
          );
        }
        throw new Error(resData.error || "Scheduling failed.");
      }

      alert("Scheduled. Your post will go out at the selected time.");
      setShowScheduler(false);
      setShowResultModal(false); // Bezárjuk az egész ablakot
      
    } catch (error: any) {
      console.error(error);
      alert("Scheduling failed:\n" + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleMagicEdit = async (action: string) => {
    setLoading(true);
    const finalAction = action === 'custom' ? customPrompt : action;
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, action: finalAction, lang }),
      });
      const resData = await res.json();
      if (resData.updatedText) {
        setContent(resData.updatedText);
        setCustomPrompt('');
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleGenerateImage = async () => {
    if (availableImages.length >= 3) {
      alert("You can store up to 3 images. Remove or pick one.");
      return;
    }
    setLoadingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: data.image_prompt || content, platform: title, brandName: brandName }),
      });
      const resData = await res.json();
      if (resData.imageUrl) {
        setAvailableImages(prev => [...prev, resData.imageUrl]); // Hozzáadás a galériához
      }
    } catch (e) { console.error(e); }
    setLoadingImage(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (availableImages.length >= 3) {
      alert("You can add up to 3 images.");
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage.from('generated-images').upload(fileName, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('generated-images').getPublicUrl(fileName);
      setAvailableImages(prev => [...prev, publicUrlData.publicUrl]); // Hozzáadás a galériához
    } catch (error) {
      console.error(error);
      alert("Upload failed.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Input törlése
    }
  };

  const handleFinalizeImage = async () => {
    if (selectedImageIndex === null) return;
    const finalUrl = availableImages[selectedImageIndex];
    setImageUrl(finalUrl); // Beállítjuk véglegesnek (ez oldja fel a Live Preview-t és a posztolást)
    
    // Most mentjük az adatbázisba!
    await saveToHistory(finalUrl);
    alert("Image selected and saved.");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      {/* SUMMARY CARD ON DASHBOARD */}
      <motion.div 
        whileHover={{ y: -5 }}
        onClick={() => setShowResultModal(true)}
        className={`${panel} group relative flex h-full cursor-pointer flex-col overflow-hidden p-6 transition-all hover:border-cyan-500/25`}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200">
            {title}
          </span>
          <Layout className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>
        
        <div className="flex-grow">
          <p className="mb-4 line-clamp-4 text-xs font-medium leading-relaxed text-zinc-400">
            {content}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
           <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${imageUrl ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-600'}`} />
              <span className="text-[9px] font-bold uppercase text-zinc-500">{imageUrl ? 'Visual ready' : 'No image'}</span>
           </div>
           <span className="flex items-center gap-1 text-[9px] font-black uppercase text-cyan-400 transition-transform group-hover:translate-x-1">Open <Zap className="h-2 w-2" /></span>
        </div>
      </motion.div>

      {/* FULL SCREEN / WORKSPACE MODAL */}
      <AnimatePresence>
        {showResultModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowResultModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0f14] shadow-2xl"
            >
              {/* MODAL HEADER WITH TABS */}
              <div className="flex flex-col md:flex-row items-center justify-between p-6 md:px-10 border-b border-slate-100 dark:border-white/5 gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic text-white">
                      {title} <span className="text-cyan-400">Workspace</span>
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {brandName} · Campaign
                    </p>
                  </div>
                </div>

                {/* NAVIGATION TABS */}
                <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-[20px] border border-slate-200 dark:border-white/5">
                  <button onClick={() => setActiveTab('edit')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'edit' ? 'bg-white/[0.08] text-white shadow-xl' : 'text-zinc-500'}`}>
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button onClick={() => setActiveTab('image')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'image' ? 'bg-white/[0.08] text-white shadow-xl' : 'text-zinc-500'}`}>
                    <ImageIcon className="w-4 h-4" /> Image
                  </button>
                  <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'preview' ? 'bg-white/[0.08] text-white shadow-xl' : 'text-zinc-500'}`}>
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                </div>

                <button onClick={() => setShowResultModal(false)} className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 md:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  
                  {/* LEFT SIDE: ALWAYS VISIBLE TEXT (Except in preview) */}
                  <div className={`${activeTab === 'preview' ? 'hidden' : 'lg:col-span-7'} space-y-6`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Type className="w-4 h-4 text-cyan-400" /> Generated copy
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setContent(initialContent)} className="p-2 text-slate-400 hover:text-orange-500 transition-colors"><HistoryIcon className="w-4 h-4" /></button>
                        <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">{isCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                      </div>
                    </div>
                    <textarea 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full h-[400px] bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-[32px] p-8 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-200 font-medium"
                    />
                  </div>

                  {/* RIGHT SIDE: CONTEXTUAL TOOLS */}
                  <div className={`${activeTab === 'preview' ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
                    
                    {/* TAB: EDIT TOOLS */}
                    {activeTab === 'edit' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-4">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Quick edits</span>
                          <div className="grid grid-cols-1 gap-3">
                            <button onClick={() => handleMagicEdit('shorten')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Wand2 className="w-4 h-4" /> Shorter
                            </button>
                            <button onClick={() => handleMagicEdit('emoji')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Smile className="w-4 h-4" /> Add emojis
                            </button>
                            <button onClick={() => handleMagicEdit('professional')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Briefcase className="w-4 h-4" /> More professional
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Custom instruction</span>
                          <div className="flex gap-3">
                            <input 
                              type="text" value={customPrompt} onChange={(e)=>setCustomPrompt(e.target.value)} 
                              placeholder="e.g. “Make it more casual…”" 
                              className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-xs outline-none focus:ring-2 focus:ring-blue-500/50 text-white" 
                            />
                            <button onClick={() => handleMagicEdit('custom')} disabled={!customPrompt || loading} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block flex items-center gap-2">
                            <Globe className="w-3 h-3" /> Live web analysis
                          </span>
                          
                          {!agentResult ? (
                            <button 
                              onClick={handleAgentAnalysis} 
                              disabled={agentLoading} 
                              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-600/20"
                            >
                              {agentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-300" />}
                              {agentLoading ? "Analyzing…" : "Viral score (live data)"}
                            </button>
                          ) : (
                            <div className="bg-slate-100 dark:bg-[#151b2b] border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-5 relative overflow-hidden shadow-inner">
                               {/* Színes sáv a pontszám alapján */}
                               <div className={`absolute top-0 left-0 w-1.5 h-full ${agentResult.score >= 80 ? 'bg-green-500' : agentResult.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                               
                               <div className="flex items-center justify-between">
                                 <span className="font-black uppercase text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                   <Target className="w-4 h-4" /> Viral Score
                                 </span>
                                 <div className={`px-4 py-1.5 rounded-full font-black text-xl shadow-lg ${agentResult.score >= 80 ? 'bg-green-500/10 text-green-500' : agentResult.score >= 60 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {agentResult.score}/100
                                 </div>
                               </div>
                               
                               <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-300 dark:border-slate-700 pl-4">
                                 "{agentResult.critique}"
                               </p>
                               
                               <div className="space-y-3">
                                 <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Suggestions</span>
                                 {agentResult.suggestions.map((sugg: string, idx: number) => (
                                   <div key={idx} className="flex gap-3 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-black/40 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                                     <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                     <span className="leading-relaxed font-medium">{sugg}</span>
                                   </div>
                                 ))}
                               </div>
                               
                               <div className="flex flex-col gap-2 mt-6">
                                 <button 
                                   onClick={handleAutoImprove}
                                   disabled={agentLoading}
                                   className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-black text-xs uppercase transition-all shadow-lg shadow-green-500/30"
                                 >
                                   {agentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                   Apply suggestions
                                 </button>
                                 
                                 <button 
                                   onClick={() => setAgentResult(null)} 
                                   disabled={agentLoading}
                                   className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                 >
                                   Discard & re-analyze
                                 </button>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB: IMAGE GENERATION & UPLOAD */}
                    {activeTab === 'image' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        
                        {/* Felső gombok: Generálás vagy Feltöltés */}
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={handleGenerateImage} 
                            disabled={loadingImage || availableImages.length >= 3}
                            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black text-xs transition-all shadow-lg ${availableImages.length >= 3 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] text-white shadow-blue-500/20'}`}
                          >
                            {loadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            Generate image
                          </button>
                          
                          <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploadingImage || availableImages.length >= 3}
                            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black text-xs transition-all shadow-lg ${availableImages.length >= 3 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-white hover:text-blue-500'}`}
                          >
                            {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                            Upload image
                          </button>
                          {/* Rejtett fájlfeltöltő */}
                          <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleFileUpload} />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gallery (max 3)</span>
                          <span className="text-xs font-bold text-slate-400">{availableImages.length} / 3</span>
                        </div>

                        {/* Kép Galéria Rács (3 hely) */}
                        <div className="grid grid-cols-3 gap-4">
                          {[0, 1, 2].map((index) => {
                            const img = availableImages[index];
                            return img ? (
                              <div 
                                key={index} 
                                onClick={() => setSelectedImageIndex(index)}
                                className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${selectedImageIndex === index ? 'border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'border-transparent hover:border-slate-300'}`}
                              >
                                <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                                {selectedImageIndex === index && (
                                  <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div key={index} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center opacity-50">
                                <ImageIcon className="w-6 h-6 text-slate-300 mb-2" />
                                <span className="text-[9px] font-bold uppercase text-zinc-500">Empty</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Véglegesítés Gomb */}
                        <AnimatePresence>
                          {selectedImageIndex !== null && (
                            <motion.button
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                              onClick={handleFinalizeImage}
                              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-500/30 mt-6"
                            >
                              <CheckCircle2 className="w-5 h-5" /> Use this image
                            </motion.button>
                          )}
                        </AnimatePresence>

                        {/* Promt javaslat, ha még nincs kép */}
                        {availableImages.length === 0 && data.image_prompt && (
                          <div className="p-6 bg-purple-600/5 border border-purple-500/10 rounded-3xl flex items-start gap-4 mt-4">
                              <Sparkles className="w-6 h-6 text-purple-500 mt-1" />
                              <div>
                                <span className="text-[10px] font-black text-purple-400 uppercase block mb-1">Suggested concept</span>
                                <p className="text-xs text-slate-400 italic leading-relaxed">"{data.image_prompt}"</p>
                              </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: LIVE PREVIEW */}
                    {activeTab === 'preview' && (
                      <div className="flex justify-center animate-in zoom-in-95 duration-500">
                        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[3rem] h-[750px] w-[350px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden scale-90 md:scale-100">
                          <div className="w-[148px] h-[22px] bg-gray-800 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-[1.5rem] z-20"></div>
                          
                          <div className="h-full w-full bg-white dark:bg-[#12141a] overflow-y-auto pt-10 scrollbar-hide">
                            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 p-[2px]">
                                <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center text-xs font-black text-blue-500">
                                   {brandName?.charAt(0) || 'CF'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="h-3 w-28 bg-slate-200 dark:bg-white/10 rounded-full" />
                                <div className="h-2 w-20 bg-slate-100 dark:bg-white/5 rounded-full" />
                              </div>
                            </div>
                            
                            {imageUrl ? (
                              <div className="w-full aspect-square overflow-hidden">
                                 <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative">
                                  <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-800" />
                                  <span className="absolute bottom-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Image Placeholder</span>
                              </div>
                            )}

                            <div className="p-8">
                              <p className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                                {content}
                              </p>
                            </div>
                            
                            <div className="mt-4 px-8 flex justify-between opacity-30 pb-12">
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${imageUrl ? 'bg-green-500 animate-pulse shadow-[0_0_15px_#22c55e]' : 'bg-orange-500 shadow-[0_0_15px_#f97316]'}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Status: {imageUrl ? "Ready to publish" : "Image required"}
                  </span>
                </div>
                
                {/* Ha NEM mutatjuk a naptárat, akkor az alap gombok látszanak */}
                {!showScheduler ? (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => setShowResultModal(false)} className="flex-1 md:flex-none px-8 py-4 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white rounded-2xl font-black text-xs uppercase hover:bg-red-500/10 hover:text-red-500 transition-all">
                      Close
                    </button>

                    <button 
                      onClick={handleImmediatePost}
                      disabled={isPosting || !imageUrl}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${isPosting ? 'bg-indigo-600/50 text-white cursor-not-allowed' : !imageUrl ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`}
                    >
                      {isPosting ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</> : <>Publish now</>}
                    </button>

                    <button 
                      onClick={() => setShowScheduler(true)} 
                      disabled={!imageUrl}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${imageUrl ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'}`} 
                    >
                      Schedule
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto bg-white dark:bg-slate-800 p-3 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                    <input 
                      type="datetime-local" 
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-5 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <button 
                      onClick={handleSchedulePost}
                      disabled={isScheduling}
                      className={`flex items-center justify-center gap-2 px-8 py-3 text-xs font-black uppercase rounded-2xl transition-all text-white ${isScheduling ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}
                    >
                      {isScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                    </button>
                    
                    <button 
                      onClick={() => setShowScheduler(false)}
                      className="px-4 py-3 text-slate-400 hover:text-red-500 transition-colors font-bold text-xs uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}