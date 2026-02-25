"use client";

import React, { useState } from "react";
import PosterCanvas from "@/app/components/poster/PosterCanvas";
import { IG_POST_1 } from "@/lib/poster/templates/ig-post-1";

export default function PosterStudioPage() {
  const [primary, setPrimary] = useState("#0B1220");
  const [secondary, setSecondary] = useState("#0F1B33");
  const [accent, setAccent] = useState("#7AA2FF");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Poster Studio</h1>
        <p className="text-white/60">
          Template → színek → (következő: logo + AI autofill + export)
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
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

          <div className="pt-2 border-t border-white/10 text-white/60 text-sm">
            Következő lépés: logo feltöltés + AI “Generate text”.
          </div>
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
                template={IG_POST_1}
                colors={{ primary, secondary, accent }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}