"use client";

import React, { useMemo, useState } from "react";
import PosterCanvas from "@/app/components/poster/PosterCanvas";
import { IG_POST_1 } from "@/lib/poster/templates/ig-post-1";

export default function PosterStudioPage() {
  const [primary, setPrimary] = useState("#0B1220");
  const [secondary, setSecondary] = useState("#0F1B33");
  const [accent, setAccent] = useState("#7AA2FF");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ✅ új: AI mezők
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  // ✅ template state (copy-val frissül)
  const [template, setTemplate] = useState(IG_POST_1);

  const brandProfile = useMemo(
    () => ({
      name: "ContentFactory",
      desc: "AI alapú tartalomgyártó és marketing rendszer",
      audience: "Marketingesek, KKV-k, ügynökségek",
    }),
    []
  );

  const tone = "szakmai";
  const lang = "hu";

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
      <div>
        <h1 className="text-2xl font-semibold text-white">Poster Studio</h1>
        <p className="text-white/60">
          Template → színek → logo → AI autofill → (következő: export)
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
          <div className="text-white font-medium">Brand beállítások</div>

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
          </div>

          <div className="w-full overflow-auto">
            <div className="origin-top-left scale-[0.45] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.55] xl:scale-[0.65]">
              <PosterCanvas
                template={template}
                colors={{ primary, secondary, accent }}
                logoUrl={logoUrl}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}