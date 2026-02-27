"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PosterCanvas from "@/app/components/poster/PosterCanvas";
import { getTemplateById } from "@/lib/poster/templates/registry";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

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

function PosterStudioContent() {
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
  }, [selectedBrand?.id]);

  // --- Logo upload ---
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ✅ ÚJ: background image upload
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);

  // --- AI fields ---
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  // --- Template: from URL ?template= or default ---
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const [template, setTemplate] = useState(() => getTemplateById(templateId));
  useEffect(() => {
    setTemplate(getTemplateById(templateId));
  }, [templateId]);

  // Event / career-fair: 3 circular photo slots
  const [photo1Url, setPhoto1Url] = useState<string | null>(null);
  const [photo2Url, setPhoto2Url] = useState<string | null>(null);
  const [photo3Url, setPhoto3Url] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null); // "photo1" | "photo2" | "photo3"

  const hasPhotoSlots = useMemo(
    () =>
      template.layers?.some(
        (l: any) => l.type === "image" && ["photo1", "photo2", "photo3"].includes(l.srcKey)
      ),
    [template]
  );

  const stageRef = useRef<any>(null);

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
  }, [selectedBrand?.id]);

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

        // auto-select first if none selected
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

  // --- 2) When brand changes -> apply palette + (optional) brand logo_url as default ---
  useEffect(() => {
    if (!selectedBrand) return;

    const p = selectedBrand.palette ?? {};
    if (p.primary) setPrimary(p.primary);
    if (p.secondary) setSecondary(p.secondary);
    if (p.accent) setAccent(p.accent);

    // Logo/Background auto-betöltést most szándékosan NEM csinálunk (ahogy kérted)
    // if (selectedBrand.logo_url) setLogoUrl(selectedBrand.logo_url);

    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Háttérkép upload
  const handleBgUpload = async (file: File) => {
    setBgUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/poster/upload-image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Upload hiba");
        return;
      }
      setBgImageUrl(data.url);
    } catch (e) {
      console.error(e);
      alert("Upload hiba");
    } finally {
      setBgUploading(false);
    }
  };

  // Event template: 3 kör alakú fotó slot feltöltése
  const handlePhotoUpload = async (slot: "photo1" | "photo2" | "photo3", file: File) => {
    setPhotoUploading(slot);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/poster/upload-image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Upload hiba");
        return;
      }
      if (slot === "photo1") setPhoto1Url(data.url);
      if (slot === "photo2") setPhoto2Url(data.url);
      if (slot === "photo3") setPhoto3Url(data.url);
    } catch (e) {
      console.error(e);
      alert("Upload hiba");
    } finally {
      setPhotoUploading(null);
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
    setTemplate((prev) => ({
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
            Template → brand (színek + fontok) → képek (bg + logo) → AI autofill → export
          </p>
        </div>
        <Link
          href="/dashboard/poster/templates"
          className="rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 border border-white/10"
        >
          Templates
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
          <div className="text-white font-medium">Brand beállítások</div>

          {/* ✅ Brand selector */}
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
                  {selectedBrand.target_audience ? selectedBrand.target_audience : "—"}
                </div>
                <div>
                  <span className="text-white/60">Fontok:</span>{" "}
                  {brandFonts?.headline || "—"} / {brandFonts?.body || "—"}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10" />

          {/* ✅ ÚJ: Background image */}
          <div className="space-y-2">
            <div className="text-white/80 text-sm">Háttérkép (opcionális)</div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBgUpload(f);
              }}
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-white/15"
              disabled={bgUploading}
            />
            {bgUploading && <div className="text-white/50 text-sm">Feltöltés…</div>}
            {bgImageUrl && (
              <div className="flex items-center justify-between gap-2">
                <div className="text-white/40 text-xs break-all">
                  BG URL: {bgImageUrl}
                </div>
                <button
                  onClick={() => setBgImageUrl(null)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1 text-xs font-semibold"
                >
                  Törlés
                </button>
              </div>
            )}
          </div>

          {/* Event / career-fair: 3 kör alakú fotó */}
          {hasPhotoSlots && (
            <>
              <div className="pt-3 border-t border-white/10" />
              <div className="text-white/80 text-sm font-medium">Kör alakú fotók (event sablon)</div>
              {(["photo1", "photo2", "photo3"] as const).map((slot) => (
                <div key={slot} className="space-y-1">
                  <div className="text-white/60 text-xs">
                    {slot === "photo1" ? "Fotó 1" : slot === "photo2" ? "Fotó 2" : "Fotó 3"}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoUpload(slot, f);
                    }}
                    className="block w-full text-sm text-white/70 file:mr-2 file:rounded-xl file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-white file:font-semibold hover:file:bg-teal-500"
                    disabled={photoUploading !== null}
                  />
                  {photoUploading === slot && (
                    <div className="text-white/50 text-xs">Feltöltés…</div>
                  )}
                  {(slot === "photo1" ? photo1Url : slot === "photo2" ? photo2Url : photo3Url) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (slot === "photo1") setPhoto1Url(null);
                        if (slot === "photo2") setPhoto2Url(null);
                        if (slot === "photo3") setPhoto3Url(null);
                      }}
                      className="text-xs text-white/60 hover:text-white/90"
                    >
                      Törlés
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

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
              <div className="flex items-center justify-between gap-2">
                <div className="text-white/40 text-xs break-all">
                  Logo URL: {logoUrl}
                </div>
                <button
                  onClick={() => setLogoUrl(null)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1 text-xs font-semibold"
                >
                  Törlés
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10" />

          {/* ✅ AI COPY */}
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
                bgImageUrl={bgImageUrl}
                photo1Url={photo1Url}
                photo2Url={photo2Url}
                photo3Url={photo3Url}
                brandFonts={brandFonts}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PosterStudioFallback() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[200px]">
      <div className="text-white/60">Loading Poster Studio…</div>
    </div>
  );
}

export default function PosterStudioPage() {
  return (
    <Suspense fallback={<PosterStudioFallback />}>
      <PosterStudioContent />
    </Suspense>
  );
}