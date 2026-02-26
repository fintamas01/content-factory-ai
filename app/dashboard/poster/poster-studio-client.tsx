"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import PosterCanvas from "@/app/components/poster/PosterCanvas";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { getTemplateById } from "@/lib/poster/templates/registry";

type BrandProfileRow = {
  id: string;
  user_id: string;
  brand_name: string | null;
  description: string | null;
  target_audience: string | null;
  website?: string | null;
  palette?: any; // { primary, secondary, accent }
  fonts?: any; // { headline, body }
  logo_url?: string | null;
};

export default function PosterStudioClient({
  initialTemplateId,
}: {
  initialTemplateId: string | null;
}) {
  const router = useRouter();

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!;
    return createBrowserClient(url, anon);
  }, []);

  // --- Brand state ---
  const [brands, setBrands] = useState<BrandProfileRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const selectedBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId) ?? null;
  }, [brands, selectedBrandId]);

  // --- Colors (defaults) ---
  const [primary, setPrimary] = useState("#0B1220");
  const [secondary, setSecondary] = useState("#0F1B33");
  const [accent, setAccent] = useState("#7AA2FF");

  // --- Brand fonts coming from DB ---
  const brandFonts = useMemo(() => {
    const f = (selectedBrand?.fonts ?? null) as any;
    if (!f) return null;
    return {
      headline: f.headline ?? null,
      body: f.body ?? null,
    };
  }, [selectedBrand]);

  // --- Logo upload ---
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- AI fields ---
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  // --- Template state (URL param prop alapján) ---
  const [template, setTemplate] = useState(() =>
    getTemplateById(initialTemplateId)
  );

  const stageRef = useRef<any>(null);

  // ✅ ha a prop változik (pl. /dashboard/poster?template=xxx), frissítjük
  useEffect(() => {
    setTemplate(getTemplateById(initialTemplateId));
  }, [initialTemplateId]);

  // ✅ brandProfile az AI-hoz: mindig a kiválasztott brandből, fallback: ContentFactory
  const brandProfile = useMemo(() => {
    if (selectedBrand) {
      return {
        name: selectedBrand.brand_name ?? "Brand",
        desc: selectedBrand.description ?? "",
        audience: selectedBrand.target_audience ?? "",
      };
    }
    return {
      name: "ContentFactory",
      desc: "AI alapú tartalomgyártó és marketing rendszer",
      audience: "Marketingesek, KKV-k, ügynökségek",
    };
  }, [selectedBrand]);

  const tone = "szakmai";
  const lang = "hu";

  // --- 1) Load brands ---
  useEffect(() => {
    const loadBrands = async () => {
      try {
        setBrandsLoading(true);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) console.error("auth.getUser error:", userErr);
        if (!user) {
          setBrands([]);
          setSelectedBrandId("");
          return;
        }

        const { data, error } = await supabase
          .from("brand_profiles")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("brand_profiles select error:", error);
          setBrands([]);
          setSelectedBrandId("");
          return;
        }

        const rows = (data ?? []) as BrandProfileRow[];
        setBrands(rows);

        if (!selectedBrandId && rows.length > 0) {
          setSelectedBrandId(rows[0].id);
        }
      } finally {
        setBrandsLoading(false);
      }
    };

    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2) When brand changes -> apply palette ---
  useEffect(() => {
    if (!selectedBrand) return;

    const p = selectedBrand.palette ?? {};
    if (p.primary) setPrimary(p.primary);
    if (p.secondary) setSecondary(p.secondary);
    if (p.accent) setAccent(p.accent);

    // Logo defaultot most nem állítunk be (csak upload)
  }, [selectedBrand?.id]);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/poster/upload-logo", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Upload hiba");
        return;
      }

      setLogoUrl(data.url);
    } catch (e) {
      console.error(e);
      alert("Upload hiba");
    } finally {
      setUploading(false);
    }
  };

  const handleExportPng = () => {
    const stage = stageRef.current;
    if (!stage) {
      alert("Stage még nem elérhető.");
      return;
    }

    const dataUrl = stage.toDataURL({ pixelRatio: 2 });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `poster-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const applyCopyToTemplate = (headline: string, sub: string, cta: string) => {
    setTemplate((prev: any) => ({
      ...prev,
      layers: prev.layers.map((l: any) => {
        if (l.type !== "text") return l;
        if (l.id === "headline") return { ...l, text: headline || l.text };
        if (l.id === "sub") return { ...l, text: sub || l.text };
        if (l.id === "cta") return { ...l, text: cta || l.text };
        return l;
      }),
    }));
  };

  const handleAICopy = async () => {
    if (!description.trim()) {
      alert("Írj be egy leírást!");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/poster/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          url: linkUrl || null,
          platform: "instagram_post",
          lang,
          tone,
          brandProfile,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "AI hiba");
        return;
      }

      applyCopyToTemplate(data.headline, data.sub, data.cta);
    } catch (e) {
      console.error(e);
      alert("AI hiba");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Poster Studio</h1>
          <p className="text-white/60">
            Template → brand (színek + fontok) → logo → AI autofill → export
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard/poster/templates")}
          className="rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 border border-white/10"
        >
          Templates
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
          <div className="text-white font-medium">Brand beállítások</div>

          {/* Brand selector */}
          <div className="space-y-2">
            <div className="text-white/80 text-sm">Márka kiválasztása</div>

            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full rounded-2xl bg-black/30 border border-white/10 p-3 text-white/90 focus:outline-none"
              disabled={brandsLoading}
            >
              {brandsLoading ? (
                <option value="">Betöltés…</option>
              ) : brands.length === 0 ? (
                <option value="">Nincs márka (Settings-ben adj hozzá)</option>
              ) : (
                brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.brand_name ?? "Névtelen márka"}
                    {b.website ? ` — ${b.website}` : ""}
                  </option>
                ))
              )}
            </select>

            {selectedBrand && (
              <div className="text-white/40 text-xs leading-5">
                <div>
                  <span className="text-white/60">Leírás:</span>{" "}
                  {selectedBrand.description ? selectedBrand.description : "—"}
                </div>
                <div>
                  <span className="text-white/60">Célközönség:</span>{" "}
                  {selectedBrand.target_audience
                    ? selectedBrand.target_audience
                    : "—"}
                </div>
                <div>
                  <span className="text-white/60">Fontok:</span>{" "}
                  {brandFonts?.headline || "—"} / {brandFonts?.body || "—"}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10" />

          {/* Logo */}
          <div className="space-y-2">
            <div className="text-white/80 text-sm">Logo</div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
              }}
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-blue-500"
              disabled={uploading}
            />
            {uploading && <div className="text-white/50 text-sm">Feltöltés…</div>}
            {logoUrl && (
              <div className="text-white/40 text-xs break-all">
                Feltöltött logo URL: {logoUrl}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10" />

          {/* AI COPY */}
          <div className="text-white font-medium">AI szöveg a plakátra</div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Írd le röviden, miről szól a plakát (szolgáltatás, ajánlat, esemény, stb.)…"
            className="w-full min-h-[120px] rounded-2xl bg-black/30 border border-white/10 p-3 text-white/90 placeholder:text-white/30 focus:outline-none"
          />

          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link (opcionális) – pl. landing page"
            className="w-full rounded-2xl bg-black/30 border border-white/10 p-3 text-white/90 placeholder:text-white/30 focus:outline-none"
          />

          <button
            onClick={handleAICopy}
            disabled={generating}
            className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:hover:bg-blue-600 text-white font-semibold py-3 transition"
          >
            {generating ? "Generálás…" : "AI szöveg generálása"}
          </button>

          <div className="pt-3 border-t border-white/10" />

          {/* Colors */}
          <div className="text-white font-medium">Színek</div>

          <label className="flex items-center justify-between text-white/80">
            Primary
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-10 w-14 rounded-md border border-white/10 bg-transparent"
            />
          </label>

          <label className="flex items-center justify-between text-white/80">
            Secondary
            <input
              type="color"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              className="h-10 w-14 rounded-md border border-white/10 bg-transparent"
            />
          </label>

          <label className="flex items-center justify-between text-white/80">
            Accent
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-14 rounded-md border border-white/10 bg-transparent"
            />
          </label>
        </div>

        {/* Preview */}
        <div className="col-span-12 lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-medium">
              Preview (Instagram Post 1080×1080)
            </div>

            <button
              onClick={handleExportPng}
              className="rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 border border-white/10"
            >
              Letöltés PNG
            </button>
          </div>

          <div className="w-full overflow-auto">
            <div className="origin-top-left scale-[0.45] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.55] xl:scale-[0.65]">
              <PosterCanvas
                ref={stageRef}
                template={template}
                colors={{ primary, secondary, accent }}
                logoUrl={logoUrl}
                brandFonts={brandFonts}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}