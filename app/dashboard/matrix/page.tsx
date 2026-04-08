"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Lock,
  Sparkles,
  Loader2,
  Calendar,
  Copy,
  X,
  Check,
  Edit3,
  Image as ImageIcon,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Briefcase,
  History,
  RefreshCcw,
  FileText,
  Smartphone,
  ThumbsUp,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";
import { ModuleUsageBanner } from "@/app/components/platform/ModuleUsageBanner";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { OUTPUT_LANGUAGE_OPTIONS } from "@/lib/i18n/output-language";
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_MODULES,
} from "@/lib/persistence/workspace-storage";
import { WorkspaceSessionBanner } from "@/app/components/persistence/WorkspaceSessionBanner";
import { ReviewWorkspaceStrip } from "@/app/components/review/ReviewWorkspaceStrip";
import type { PlanTier } from "@/lib/plan-config";
import { canAccess } from "@/lib/entitlements/features";
import { LockedFeatureStateClient } from "@/app/components/entitlements/LockedFeatureStateClient";

const shell =
  "min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#080c14] via-[#070b12] to-[#05070c] text-zinc-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-100";

const panel =
  "rounded-2xl border border-white/[0.06] bg-[#0c1018]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm";

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500";

/** Map legacy Hungarian tone values from saved workspaces */
function normalizeMatrixTone(raw: string): string {
  const m: Record<string, string> = {
    Professzionális: "Professional",
    Humoros: "Funny",
    Provokatív: "Provocative",
    professional: "Professional",
    funny: "Funny",
    provocative: "Provocative",
  };
  return m[raw] ?? raw;
}

interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
  content: string;
  generatedImageUrl?: string | null;
  slides?: string[];
  isRegenerating?: boolean;
}

interface BrandProfile {
  id: string;
  brand_name: string;
  target_audience: string;
  description: string;
}

interface HistoryItem {
  id: string;
  created_at: string;
  brand_name: string;
  generation_data: {
    days: MatrixItem[];
  };
}

export default function ContentMatrix() {
  const [userPlan, setUserPlan] = useState('free');
  const [gateReady, setGateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [selectedPost, setSelectedPost] = useState<MatrixItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'visual' | 'image'>('text');
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [slideImages, setSlideImages] = useState<(string | null)[]>([]);
  const [imageGenerating, setImageGenerating] = useState(false);

  const [savedBrands, setSavedBrands] = useState<BrandProfile[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const [matrixData, setMatrixData] = useState<MatrixItem[]>([]);
  const [formData, setFormData] = useState({
    brand: "",
    audience: "",
    topic: "",
    tone: "Professional",
  });
  const [usageBump, setUsageBump] = useState(0);

  // History states
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isPreview, setIsPreview] = useState(false);

  const [useResearch, setUseResearch] = useState(false);

  const [workspaceScope, setWorkspaceScope] = useState<{
    userId: string;
    clientId: string;
  } | null>(null);
  const matrixWorkspaceHydrated = useRef(false);
  const [matrixWorkspaceReady, setMatrixWorkspaceReady] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [outputLang, setOutputLang] = useState("en");

  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const billingRes = await fetch("/api/billing").catch(() => null);
        if (billingRes && billingRes.ok) {
          const j = (await billingRes.json().catch(() => ({}))) as { plan?: PlanTier };
          setUserPlan((j.plan ?? "free") as any);
        } else {
          setUserPlan("free");
        }
        setGateReady(true);

        const { data: brands } = await supabase
          .from('brand_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (brands) setSavedBrands(brands as BrandProfile[]);
      }
      setLoading(false);
    }
    loadInitialData();
  }, [supabase]);

  if (gateReady && !canAccess((userPlan as PlanTier) ?? "free", "contentMatrix")) {
    return (
      <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
        <LockedFeatureStateClient
          featureKey="contentMatrix"
          currentPlan={((userPlan as PlanTier) ?? "free")}
        />
      </div>
    );
  }

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

  type MatrixWorkspaceSnapshot = {
    matrixData: MatrixItem[];
    formData: { brand: string; audience: string; topic: string; tone: string };
    selectedBrandId: string;
    viewMode: "text" | "visual" | "image";
    useResearch: boolean;
    isPreview: boolean;
    reviewItemId: string | null;
    outputLang: string;
  };

  useEffect(() => {
    if (!workspaceScope || loading || matrixWorkspaceHydrated.current) return;
    const w = loadWorkspace<MatrixWorkspaceSnapshot>(
      workspaceScope.userId,
      workspaceScope.clientId,
      WORKSPACE_MODULES.matrix
    );
    if (w) {
      if (Array.isArray(w.matrixData) && w.matrixData.length > 0) setMatrixData(w.matrixData);
      if (w.formData) {
        setFormData((prev) => ({
          ...prev,
          ...w.formData,
          tone: normalizeMatrixTone(w.formData.tone ?? prev.tone),
        }));
      }
      if (typeof w.selectedBrandId === "string") setSelectedBrandId(w.selectedBrandId);
      if (w.viewMode === "text" || w.viewMode === "visual" || w.viewMode === "image") {
        setViewMode(w.viewMode);
      }
      if (typeof w.useResearch === "boolean") setUseResearch(w.useResearch);
      if (typeof w.isPreview === "boolean") setIsPreview(w.isPreview);
      if (typeof w.reviewItemId === "string") setReviewItemId(w.reviewItemId);
      if (typeof w.outputLang === "string" && w.outputLang.trim()) setOutputLang(w.outputLang);
    }
    matrixWorkspaceHydrated.current = true;
    setMatrixWorkspaceReady(true);
  }, [workspaceScope, loading]);

  useEffect(() => {
    if (!workspaceScope || !matrixWorkspaceHydrated.current) return;
    const t = window.setTimeout(() => {
      saveWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.matrix, {
        matrixData,
        formData,
        selectedBrandId,
        viewMode,
        useResearch,
        isPreview,
        reviewItemId,
        outputLang,
      } satisfies MatrixWorkspaceSnapshot);
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    workspaceScope,
    matrixData,
    formData,
    selectedBrandId,
    viewMode,
    useResearch,
    isPreview,
    reviewItemId,
    outputLang,
  ]);

  const startNewMatrix = () => {
    if (workspaceScope) {
      clearWorkspace(workspaceScope.userId, workspaceScope.clientId, WORKSPACE_MODULES.matrix);
    }
    setMatrixData([]);
    setFormData({ brand: "", audience: "", topic: "", tone: "Professional" });
    setSelectedBrandId("");
    setSelectedPost(null);
    setIsPreview(false);
    setViewMode("text");
    setSlides([]);
    setSlideImages([]);
    setCurrentSlide(0);
    setReviewItemId(null);
    setOutputLang("en");
  };

  useCopilotPageContext({
    page: "matrix",
    data: {
      plan: userPlan,
      generating,
      useResearch,
      formData,
      outputLang,
      matrixCount: matrixData.length,
      matrixPreview: matrixData.slice(0, 6).map((it) => ({
        day: it.day,
        platform: it.platform,
        title: it.title,
        outline: it.outline?.slice(0, 240),
      })),
      selectedPost: selectedPost
        ? {
            day: selectedPost.day,
            platform: selectedPost.platform,
            title: selectedPost.title,
            viewMode,
          }
        : null,
      showHistory,
    },
  });

  const handleExportPDF = async () => {
    if (matrixData.length === 0) return alert("Nothing to export yet.");

    // Loading cursor
    const originalText = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
        const doc = new jsPDF({ unit: "pt", format: "a4" });

        // Roboto supports extended Latin
        const fontResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        const fontBlob = await fontResponse.blob();
        
        const reader = new FileReader();
        reader.readAsDataURL(fontBlob);
        
        reader.onloadend = () => {
            const base64data = reader.result?.toString().split(',')[1];
            
            if (base64data) {
                doc.addFileToVFS("Roboto-Regular.ttf", base64data);
                doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
                doc.setFont("Roboto");
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const marginX = 54;
                const contentW = pageW - marginX * 2;

                const brand = (formData.brand || "Brand").trim();
                const topic = (formData.topic || "").trim();
                const audience = (formData.audience || "").trim();
                const tone = (formData.tone || "").trim();
                const generatedAt = new Date().toLocaleDateString("en-US");

                const safeFile = (s: string) =>
                  (s || "export")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                    .replace(/[^a-z0-9_\-]+/g, "")
                    .slice(0, 60) || "export";

                // ----------------
                // COVER (premium)
                // ----------------
                doc.setFillColor(7, 10, 16);
                doc.rect(0, 0, pageW, pageH, "F");
                doc.setFillColor(139, 92, 246);
                doc.rect(0, 0, pageW, 6, "F");

                doc.setTextColor(165, 176, 196);
                doc.setFontSize(10);
                doc.text("CONTENT MATRIX · CLIENT EXPORT", marginX, 64);

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(30);
                doc.text(brand, marginX, 110, { maxWidth: contentW });

                doc.setFontSize(14);
                doc.setTextColor(216, 225, 238);
                if (topic) doc.text(topic, marginX, 140, { maxWidth: contentW });

                doc.setFontSize(11);
                doc.setTextColor(150, 160, 180);
                const metaLine = [
                  `Generated: ${generatedAt}`,
                  matrixData.length ? `Posts: ${matrixData.length}` : null,
                  tone ? `Tone: ${tone}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                doc.text(metaLine, marginX, 166, { maxWidth: contentW });

                // Two info tiles
                const tileY = 220;
                const tileH = 86;
                const tileGap = 12;
                const tileW = (contentW - tileGap) / 2;

                const tile = (x: number, label: string, value: string) => {
                  doc.setFillColor(12, 16, 24);
                  doc.roundedRect(x, tileY, tileW, tileH, 14, 14, "F");
                  doc.setTextColor(165, 176, 196);
                  doc.setFontSize(10);
                  doc.text(label.toUpperCase(), x + 18, tileY + 28);
                  doc.setTextColor(255, 255, 255);
                  doc.setFontSize(14);
                  doc.text(value || "—", x + 18, tileY + 54, { maxWidth: tileW - 36 });
                };

                tile(marginX, "Audience", audience);
                tile(marginX + tileW + tileGap, "Focus", topic || "Content plan");

                doc.setTextColor(120, 130, 155);
                doc.setFontSize(10);
                doc.text(
                  "Note: This document was generated automatically. Verify details before publishing.",
                  marginX,
                  pageH - 56,
                  { maxWidth: contentW }
                );

                // ----------------
                // TABLE PAGES
                // ----------------
                doc.addPage();
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, pageW, pageH, "F");
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(18);
                doc.text("Content plan", marginX, 56);

                doc.setFontSize(11);
                doc.setTextColor(71, 85, 105);
                doc.text(`${brand} · ${generatedAt}`, marginX, 74);

                const tableRows = matrixData.map((post) => [
                    post.day,
                    post.platform,
                    post.title,
                    post.content,
                ]);

                autoTable(doc, {
                    head: [["Day", "Platform", "Title", "Content"]],
                    body: tableRows,
                    startY: 92,
                    theme: "grid",
                    styles: {
                        font: "Roboto",
                        fontSize: 9.5,
                        cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
                        overflow: 'linebreak',
                        textColor: [15, 23, 42],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.5,
                        valign: "top",
                    },
                    headStyles: {
                        fillColor: [15, 23, 42],
                        textColor: [241, 245, 249],
                        fontStyle: "bold",
                        halign: "left",
                        lineColor: [15, 23, 42],
                    },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        0: { cellWidth: 44 },
                        1: { cellWidth: 72 },
                        2: { cellWidth: 150 },
                        3: { cellWidth: "auto" },
                    },
                    didDrawPage: (data) => {
                      // Footer
                      const pageNumber = doc.getNumberOfPages();
                      doc.setFont("Roboto", "normal");
                      doc.setFontSize(9);
                      doc.setTextColor(148, 163, 184);
                      doc.text(`${brand} · Content Matrix`, marginX, pageH - 22);
                      doc.text(`Page ${pageNumber - 1}`, pageW - marginX, pageH - 22, { align: "right" });
                    },
                });

                doc.save(`${safeFile(brand)}_content_matrix_${generatedAt.replace(/\//g, "-")}.pdf`);
            }
            document.body.style.cursor = originalText;
        };

    } catch (error) {
        console.error("PDF export error:", error);
        alert("Could not generate PDF.");
        document.body.style.cursor = originalText;
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data } = await supabase
            .from('matrix_generations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (data) setHistoryItems(data);
    }
    setLoadingHistory(false);
  };

  const loadFromHistory = (item: HistoryItem) => {
    if (confirm("This will replace the current matrix. Continue?")) {
        setMatrixData(item.generation_data.days || []);
        setFormData(prev => ({ ...prev, brand: item.brand_name }));
        setShowHistory(false);
    }
  };

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrandId(brandId);
    if (brandId === "") return; 
    const brand = savedBrands.find(b => b.id === brandId);
    if (brand) {
        setFormData(prev => ({
            ...prev,
            brand: brand.brand_name,
            audience: brand.target_audience
        }));
    }
  };

  // Carousel & Image Logic
  useEffect(() => {
    if (selectedPost && viewMode === 'visual') {
      let generatedSlides: string[] = [];
      if (selectedPost.slides && selectedPost.slides.length > 0) {
        generatedSlides = selectedPost.slides;
      } else {
        generatedSlides = [selectedPost.title, "Details in the caption…"];
      }
      const lastSlide = generatedSlides[generatedSlides.length - 1];
      if (!lastSlide.includes("@")) {
         generatedSlides.push(`Follow us!\n@${formData.brand || "Brand"}`);
      }
      setSlides(generatedSlides);
      setCurrentSlide(0);
      setSlideImages(new Array(generatedSlides.length).fill(null));
    }
  }, [selectedPost, viewMode, formData.brand]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...slideImages];
        newImages[currentSlide] = reader.result as string;
        setSlideImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    const newImages = [...slideImages];
    newImages[currentSlide] = null;
    setSlideImages(newImages);
  };

  const handleDownloadSlide = async () => {
    if (!carouselRef.current) return;
    setDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const canvas = await html2canvas(carouselRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `${formData.brand}_slide_${currentSlide + 1}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedPost) return;
    setImageGenerating(true);
    try {
      const promptBase = selectedPost.content || selectedPost.outline;
      const res = await fetch('/api/matrix/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptBase }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.imageUrl) {
        setSelectedPost({ ...selectedPost, generatedImageUrl: data.imageUrl });
      }
    } catch (error) {
      console.error(error);
      alert("Could not generate image.");
    } finally {
      setImageGenerating(false);
    }
  };

  const handleDownloadAIImage = async () => {
    if (!selectedPost?.generatedImageUrl) return;
    try {
      const imageBlob = await fetch(selectedPost.generatedImageUrl).then(r => r.blob());
      const imageURL = URL.createObjectURL(imageBlob);
      const link = document.createElement("a");
      link.href = imageURL;
      link.download = `ai_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Try right-click → Save image as…");
    }
  };

  const handleRegenerateSingle = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const postToRegenerate = matrixData[index];
    if (!postToRegenerate) return;

    const newData = [...matrixData];
    newData[index] = { ...postToRegenerate, isRegenerating: true };
    setMatrixData(newData);

    try {
        const res = await fetch('/api/matrix/regenerate-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand: formData.brand,
                audience: formData.audience,
                topic: formData.topic,
                tone: formData.tone,
                day: postToRegenerate.day,
                platform: postToRegenerate.platform,
                currentPost: postToRegenerate,
                lang: outputLang,
            }),
        });
        const newPost = await res.json();
        const updatedData = [...matrixData];
        updatedData[index] = { ...newPost, isRegenerating: false };
        setMatrixData(updatedData);
        setUsageBump((n) => n + 1);
    } catch (error) {
        console.error(error);
        alert("Could not refresh this post.");
        const errorData = [...matrixData];
        errorData[index] = { ...postToRegenerate, isRegenerating: false };
        setMatrixData(errorData);
    }
  };

  const handleCopy = () => {
    if (selectedPost) {
      navigator.clipboard.writeText(selectedPost.content || selectedPost.outline);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const isPro = userPlan !== 'free';
  const mockDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const tones = [
    { id: "professional", label: "Professional", value: "Professional" },
    { id: "funny", label: "Funny", value: "Funny" },
    { id: "provocative", label: "Bold", value: "Provocative" },
  ];

  const handleGenerate = async () => {
    if (!formData.brand || !formData.topic) {
      alert("Please enter a brand name and topic.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/matrix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          useResearch,
          lang: outputLang,
        }),
      });
      const data = await res.json();
      setMatrixData(data.days || []);
      setUsageBump((n) => n + 1);
    } catch (error) {
      console.error(error);
      alert("Something went wrong while generating.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className={`${shell} flex min-h-[50vh] items-center justify-center`}>
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400/90" aria-hidden />
      </div>
    );
  }

  return (
    <div className={`${shell} relative font-sans`}>
      <div className="mx-auto max-w-6xl space-y-8 pb-24 p-4 sm:p-6 lg:p-8">
        <nav
          className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45"
          aria-label="Module breadcrumb"
        >
          <Link href="/dashboard" className="text-white/40 hover:text-white/70 transition-colors">
            {PLATFORM_DISPLAY_NAME}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden />
          <span className="text-cyan-200/90">Content Matrix</span>
        </nav>

        <ModuleUsageBanner feature="content" bump={usageBump} />

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className={`${sectionLabel} text-zinc-500`}>Content Matrix</p>
            <div className="mt-2 flex items-start gap-4">
              <div className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent" />
                <Calendar className="relative h-6 w-6 text-cyan-200" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[34px]">
                  Weekly content plan
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Five days of platform-specific posts in one run—edit, export, and ship.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {matrixData.length > 0 ? (
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.1]"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Export PDF
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowHistory(true);
                void fetchHistory();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <History className="h-4 w-4 text-zinc-400" aria-hidden />
              History
            </button>

            {isPro ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-2">
                <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200/90">
                  Pro active
                </span>
              </div>
            ) : null}
          </div>
        </div>

      {matrixData.length > 0 && matrixWorkspaceReady ? (
        <div className="mb-8">
        <WorkspaceSessionBanner
          variant="dark"
          title="Latest matrix saved for this workspace"
          hint="Persists in this browser until you start a new matrix—nothing is cleared when you leave the page."
          actions={
            <button
              type="button"
              onClick={startNewMatrix}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              <RefreshCcw className="h-4 w-4 text-slate-400" />
              New matrix
            </button>
          }
        />
        </div>
      ) : null}

      {matrixData.length > 0 && matrixWorkspaceReady ? (
        <div className="mb-8">
          <ReviewWorkspaceStrip
            module="matrix"
            variant="dark"
            reviewItemId={reviewItemId}
            onReviewItemIdChange={setReviewItemId}
            hasOutput={matrixData.length > 0}
            title={formData.topic.trim() ? `${formData.topic.trim()} · Matrix` : "Content matrix"}
            summary={`${formData.brand} · ${matrixData.length} posts`}
            buildPayload={() => ({
              formData,
              postCount: matrixData.length,
              preview: matrixData.slice(0, 5),
            })}
          />
        </div>
      ) : null}

      <div className={`${panel} mb-10 space-y-4 p-6 sm:p-8`}>
        
        {savedBrands.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl animate-in fade-in">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <select 
                    className="bg-transparent text-white outline-none w-full cursor-pointer text-sm font-medium"
                    value={selectedBrandId}
                    onChange={(e) => handleBrandSelect(e.target.value)}
                >
                    <option value="" className="bg-slate-900">
                      — Select a saved brand —
                    </option>
                    {savedBrands.map(b => (
                        <option key={b.id} value={b.id} className="bg-slate-900">
                            {b.brand_name}
                        </option>
                    ))}
                </select>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            placeholder="Brand name" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
          />
          <input 
            placeholder="Target audience" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.audience}
            onChange={(e) => setFormData({...formData, audience: e.target.value})}
          />
          <input 
            placeholder="Topic" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.topic}
            onChange={(e) => setFormData({...formData, topic: e.target.value})}
          />
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white cursor-pointer transition-all"
              value={formData.tone}
              onChange={(e) => setFormData({...formData, tone: e.target.value})}
            >
              {tones.map((t) => <option key={t.id} value={t.value} className="bg-slate-900">{t.label}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className={`${sectionLabel} text-zinc-500`}>Output language</span>
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white outline-none"
          >
            {OUTPUT_LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
          <div className="flex items-center gap-3">
             <Globe className={`w-5 h-5 ${useResearch ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
             <div>
               <p className="text-xs font-bold uppercase tracking-widest text-white">Deep research</p>
               <p className="text-[10px] text-slate-400">
                 Pull current trends and sources from the web for this weekly plan (uses more capable models when on).
               </p>
             </div>
          </div>
          <button 
            type="button"
            onClick={() => setUseResearch(!useResearch)}
            className={`w-12 h-6 rounded-full relative transition-colors ${useResearch ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <motion.div 
              animate={{ x: useResearch ? 26 : 2 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
            />
          </button>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={generating || !isPro}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          {generating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Generate week
            </>
          )}
        </button>
      </div>
      
      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative min-h-[300px]">
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl text-center max-w-sm">
              <Lock className="w-12 h-12 text-blue-500 mb-4 mx-auto" />
              <h2 className="text-2xl font-bold mb-2">Pro plan</h2>
              <p className="text-sm text-slate-400 mb-4">
                Content Matrix uses your content generation quota. Upgrade to generate full weekly plans.
              </p>
              <button
                type="button"
                onClick={() => router.push("/dashboard/billing")}
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold mt-2"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}

        {matrixData.length > 0 ? (
          matrixData.map((item, index) => (
            <div 
              key={index} 
              onClick={() => { setSelectedPost(item); setViewMode('text'); }}
              className="group cursor-pointer p-5 rounded-2xl border border-white/5 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex flex-col h-full relative overflow-hidden"
            >
              <button 
                onClick={(e) => handleRegenerateSingle(index, e)}
                disabled={item.isRegenerating}
                className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Regenerate (remix)"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${item.isRegenerating ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-bold uppercase text-[10px] tracking-widest">{item.day}</span>
                <span className="bg-white/5 text-[10px] px-2 py-1 rounded text-slate-300 font-medium">{item.platform}</span>
              </div>
              <h3 className="text-sm font-bold mb-3 leading-tight text-white group-hover:text-blue-200">
                 {item.isRegenerating ? <span className="animate-pulse">Writing new version…</span> : item.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-4 mb-4">
                 {item.isRegenerating ? "Regenerating this post…" : item.outline}
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                <Edit3 className="w-3 h-3" /> Edit
              </div>
            </div>
          ))
        ) : (
          mockDays.map((day) => (
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/30 ${!isPro ? 'blur-sm select-none' : ''}`}><span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">{day}</span></div>
          ))
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="flex flex-col md:flex-row items-center justify-between p-6 border-b border-white/5 bg-slate-900 z-10 gap-4">
              <div className="flex-1 min-w-0">
                  <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{selectedPost.day}</span>
                  <h3 className="text-xl font-bold text-white truncate">{selectedPost.title}</h3>
              </div>
               
               <div className="flex bg-slate-800 p-1 rounded-lg shrink-0">
                  <button onClick={() => setViewMode('text')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'text' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                    <Edit3 className="w-4 h-4" /> Text
                  </button>
                  <button onClick={() => setViewMode('visual')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'visual' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                    <ImageIcon className="w-4 h-4" /> Slide design
                  </button>
                  <button onClick={() => setViewMode('image')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'image' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Sparkles className="w-4 h-4" /> AI image
                  </button>
               </div>
               
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative">
              
              {viewMode === 'text' && (
                <div className="p-8">
                   
                   {/* Editor vs preview */}
                   <div className="flex items-center justify-between mb-6">
                      <div className="bg-slate-900 border border-white/10 p-1 rounded-lg inline-flex">
                         <button 
                           onClick={() => setIsPreview(false)} 
                           className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${!isPreview ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                         >
                            <Edit3 className="w-3 h-3" /> Editor
                         </button>
                         <button 
                           onClick={() => setIsPreview(true)} 
                           className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${isPreview ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                         >
                            <Smartphone className="w-3 h-3" /> Live preview
                         </button>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                         {selectedPost.platform === 'Insta' ? 'Instagram' : 'LinkedIn'} preview
                      </span>
                   </div>

                   {!isPreview ? (
                     // --- EDITOR VIEW (A régi szerkesztő felület) ---
                     <>
                        <div className="mb-6 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Strategy</label>
                            <p className="text-sm text-slate-300 italic">{selectedPost.outline}</p>
                        </div>
                        <textarea 
                            className="w-full h-96 bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed font-mono text-sm shadow-inner"
                            value={selectedPost.content}
                            onChange={(e) => setSelectedPost({...selectedPost, content: e.target.value})}
                        />
                     </>
                   ) : (
                     // --- PREVIEW VIEW (Az új Mockupok) ---
                     <div className="flex justify-center py-4 bg-slate-900/50 rounded-2xl border border-white/5 min-h-[500px] items-center">
                        
                        {/* 1. INSTAGRAM MOCKUP */}
                        {selectedPost.platform === 'Insta' && (
                            <div className="w-[375px] bg-white text-black rounded-[30px] overflow-hidden border-8 border-slate-900 shadow-2xl relative">
                                {/* Header */}
                                <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-white">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                                            <div className="w-full h-full bg-white rounded-full p-[2px]">
                                                <div className="w-full h-full bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    {formData.brand?.charAt(0).toUpperCase() || 'B'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold">{formData.brand?.toLowerCase().replace(/\s/g, '') || 'brandname'}</span>
                                    </div>
                                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                                </div>
                                
                                {/* Image Placeholder VAGY 1. Dia Dizájn */}
                                <div className="w-full aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden">
                                    {selectedPost.generatedImageUrl ? (
                                        <img src={selectedPost.generatedImageUrl} className="w-full h-full object-cover" alt="Post" />
                                    ) : (
                                        // --- HA NINCS KÉP, AKKOR AZ 1. DIA DIZÁJNJA JELENIK MEG ---
                                        <div className="w-full h-full bg-[#0f172a] relative overflow-hidden flex flex-col p-6 text-left">
                                            {/* Háttér effektek */}
                                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl bg-blue-900/60 -mr-10 -mt-10"></div>
                                            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl bg-indigo-900/60 -ml-10 -mb-10"></div>

                                            {/* Brand Header */}
                                            <div className="relative z-10 flex items-center gap-2 mb-auto">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-sm">
                                                    <Sparkles className="w-3 h-3 text-blue-400" />
                                                </div>
                                                <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                                                    {formData.brand || 'BRAND'}
                                                </span>
                                            </div>

                                            {/* CÍM (1. Dia tartalom vagy a Cím) */}
                                            <div className="relative z-10 my-auto">
                                                <h1 className="text-2xl font-black leading-tight text-white drop-shadow-md">
                                                    {slides[0] || selectedPost.title}
                                                </h1>
                                            </div>

                                            {/* Footer indikátor */}
                                            <div className="relative z-10 mt-auto pt-4 border-t border-white/10 flex justify-between items-center">
                                                <span className="text-[8px] text-slate-400">Swipe for more →</span>
                                                <div className="flex gap-1">
                                                    <div className="w-4 h-1 bg-blue-500 rounded-full"></div>
                                                    <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                                                    <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Lábléc ikonok & Szöveg */}
                                <div className="p-3 bg-white">
                                    <div className="flex justify-between mb-3">
                                        <div className="flex gap-4 text-black">
                                            <ThumbsUp className="w-6 h-6 rotate-[-10deg]" />
                                            <MessageCircle className="w-6 h-6" />
                                            <Send className="w-6 h-6" />
                                        </div>
                                        <Bookmark className="w-6 h-6 text-black" />
                                    </div>
                                    <div className="text-xs font-bold mb-1">1,234 likes</div>
                                    <div className="text-sm">
                                        <span className="font-bold mr-1">{formData.brand?.toLowerCase().replace(/\s/g, '') || 'brand'}</span>
                                        {selectedPost.content.slice(0, 120)}... <span className="text-gray-500 cursor-pointer">more</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-2 uppercase">2h ago</div>
                                </div>
                            </div>
                        )}

                        {/* 2. LINKEDIN MOCKUP */}
                        {selectedPost.platform === 'LinkedIn' && (
                            <div className="w-[375px] bg-[#f3f2ef] text-black rounded-[20px] overflow-hidden border-8 border-slate-900 shadow-2xl font-sans relative">
                                <div className="bg-white m-2 mt-4 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    {/* Header */}
                                    <div className="p-3 flex gap-3">
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                                            {formData.brand?.charAt(0).toUpperCase() || 'B'}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold flex items-center gap-1">
                                                {formData.brand || "Company"} <span className="text-gray-400 font-normal text-xs">• 1st</span>
                                            </div>
                                            <div className="text-xs text-gray-500">Marketing & Strategy • 2h • <Globe className="w-3 h-3 inline" /></div>
                                        </div>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="px-3 pb-2 text-sm text-gray-800 whitespace-pre-wrap">
                                        {selectedPost.content.slice(0, 150)}... <span className="text-blue-600 font-bold cursor-pointer">see more</span>
                                    </div>
                                    
                                    {/* Image VAGY 1. Dia Dizájn */}
                                    <div className="w-full h-64 bg-slate-100 flex items-center justify-center overflow-hidden border-t border-b border-gray-100">
                                         {selectedPost.generatedImageUrl ? (
                                            <img src={selectedPost.generatedImageUrl} className="w-full h-full object-cover" alt="Post" />
                                        ) : (
                                            // --- HA NINCS KÉP, AKKOR AZ 1. DIA DIZÁJNJA ---
                                            <div className="w-full h-full bg-[#0f172a] relative overflow-hidden flex flex-col p-5 text-left">
                                                {/* Háttér */}
                                                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-blue-900/50 -mr-5 -mt-5"></div>
                                                <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl bg-indigo-900/50 -ml-5 -mb-5"></div>

                                                {/* Brand */}
                                                <div className="relative z-10 flex items-center gap-2 mb-auto">
                                                    <Sparkles className="w-3 h-3 text-blue-400" />
                                                    <span className="text-[9px] font-bold tracking-widest text-slate-300 uppercase">
                                                        {formData.brand || 'BRAND'}
                                                    </span>
                                                </div>

                                                {/* Cím */}
                                                <div className="relative z-10 my-auto">
                                                    <h1 className="text-xl font-black leading-tight text-white">
                                                        {slides[0] || selectedPost.title}
                                                    </h1>
                                                </div>

                                                {/* Footer */}
                                                <div className="relative z-10 mt-auto w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="w-1/4 h-full bg-blue-500"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Footer Actions */}
                                    <div className="flex justify-around py-2 border-t border-gray-100 mt-1">
                                        <div className="flex flex-col items-center gap-1 text-gray-500 cursor-pointer hover:bg-gray-100 p-1 rounded flex-1">
                                            <ThumbsUp className="w-4 h-4" />
                                            <span className="text-xs font-bold">Like</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 text-gray-500 cursor-pointer hover:bg-gray-100 p-1 rounded flex-1">
                                            <MessageCircle className="w-4 h-4" />
                                            <span className="text-xs font-bold">Comment</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 text-gray-500 cursor-pointer hover:bg-gray-100 p-1 rounded flex-1">
                                            <RefreshCcw className="w-4 h-4" />
                                            <span className="text-xs font-bold">Repost</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 text-gray-500 cursor-pointer hover:bg-gray-100 p-1 rounded flex-1">
                                            <Send className="w-4 h-4" />
                                            <span className="text-xs font-bold">Send</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                     </div>
                   )}
                </div>
              )}

              {viewMode === 'visual' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  
                  <div className="mb-6 flex gap-4">
                     <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-white/10">
                        <Upload className="w-4 h-4" /> 
                        Upload image for slide {currentSlide + 1}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                     </label>
                     {slideImages[currentSlide] && (
                        <button onClick={handleRemoveImage} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                           <Trash2 className="w-4 h-4" /> Remove
                        </button>
                     )}
                  </div>

                  <div className="relative shadow-2xl shadow-blue-900/20 mb-8">
                    <div 
                      ref={carouselRef}
                      className="w-[400px] h-[500px] flex flex-col p-8 relative overflow-hidden"
                      style={{ 
                        backgroundColor: '#0f172a', 
                        backgroundImage: slideImages[currentSlide] ? `url(${slideImages[currentSlide]})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        fontFamily: 'sans-serif',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {slideImages[currentSlide] && (
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
                      )}

                      {!slideImages[currentSlide] && (
                        <>
                          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10" style={{ background: '#1e3a8a' }}/>
                          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mb-10" style={{ background: '#312e81' }}/>
                        </>
                      )}

                      <div className="relative z-10 flex items-center gap-2 mb-6">
                         <div className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            <Sparkles className="w-4 h-4" style={{ color: '#60a5fa' }} />
                         </div>
                         <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#e2e8f0' }}>
                            {formData.brand || 'BRAND'}
                         </span>
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col justify-center">
                        {currentSlide === 0 ? (
                           <h1 className="text-3xl font-black leading-tight drop-shadow-lg" style={{ color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                             {slides[0]}
                           </h1>
                        ) : (
                           <p className="text-lg font-medium leading-relaxed whitespace-pre-wrap drop-shadow-md" style={{ color: '#f8fafc', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                             {slides[currentSlide]}
                           </p>
                        )}
                      </div>

                      <div className="relative z-10 mt-6 flex justify-between items-center pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>Swipe →</span>
                        <div className="flex gap-1">
                          {slides.map((_, idx) => (
                            <div 
                              key={idx} 
                              className="h-1 rounded-full transition-all"
                              style={{ 
                                width: idx === currentSlide ? '24px' : '4px',
                                background: idx === currentSlide ? '#60a5fa' : '#475569'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="font-mono font-bold text-slate-400">{currentSlide + 1} / {slides.length}</span>
                    <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'image' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  {!selectedPost.generatedImageUrl && !imageGenerating && (
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-10 h-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">AI image</h3>
                      <p className="text-slate-400 mb-8">Generate a unique image with DALL·E 3 (usage applies).</p>
                      <button onClick={handleGenerateImage} className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-bold flex items-center gap-3">
                        <ImageIcon className="w-5 h-5" /> Generate image
                      </button>
                    </div>
                  )}
                  {imageGenerating && (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                      <p className="text-slate-300">Generating… (~15s)</p>
                    </div>
                  )}
                  {selectedPost.generatedImageUrl && !imageGenerating && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in">
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-6 max-h-[450px]">
                        <img src={selectedPost.generatedImageUrl} alt="AI Generated" className="h-full w-auto object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3 z-10">
               {viewMode === 'text' && (
                 <button onClick={handleCopy} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                   {isCopied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy text</>}
                 </button>
               )}
               {viewMode === 'visual' && (
                 <button onClick={handleDownloadSlide} disabled={downloading} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg">
                   {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Download
                 </button>
               )}
               {viewMode === 'image' && (
                 <button onClick={handleDownloadAIImage} disabled={!selectedPost.generatedImageUrl} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center gap-2">
                   <Download className="w-4 h-4" /> Download image
                 </button>
               )}
            </div>

          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
            
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in">
                <div className="p-5 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-500" /> History (Content Matrix)
                    </h2>
                    <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loadingHistory ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin text-blue-500 mx-auto" /></div>
                    ) : historyItems.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">No saved matrices yet.</div>
                    ) : (
                        historyItems.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => loadFromHistory(item)}
                                className="bg-slate-950 border border-white/5 p-4 rounded-xl hover:border-blue-500/40 cursor-pointer transition-all flex justify-between items-center group"
                            >
                                <div>
                                    <div className="font-bold text-white mb-1">{item.brand_name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(item.created_at).toLocaleString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                    </div>
                                </div>
                                <button className="bg-slate-800 text-xs px-3 py-1.5 rounded-lg text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    Load
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      </div>
    </div>
  );
}