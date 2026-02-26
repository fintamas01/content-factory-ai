"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import PosterCanvas from "@/app/components/poster/PosterCanvas";
import { POSTER_TEMPLATES } from "@/lib/poster/templates/registry";
import { Lock, Search, Sparkles } from "lucide-react";

type Plan = "free" | "basic" | "pro";

function getUnlockedCount(plan: Plan) {
  if (plan === "pro") return 999;
  if (plan === "basic") return 6;
  return 2; // free
}

export default function PosterTemplatesPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
      ),
    []
  );

  const [plan, setPlan] = useState<Plan>("free");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadPlan = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const subRes = await supabase
        .from("subscriptions")
        .select("price_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const priceId = subRes.data?.price_id ?? null;

      if (priceId && priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) {
        setPlan("pro");
      } else if (
        priceId &&
        priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC
      ) {
        setPlan("basic");
      } else {
        setPlan("free");
      }
    };

    loadPlan();
  }, [supabase]);

  const unlockedCount = getUnlockedCount(plan);

  const filtered = POSTER_TEMPLATES.filter((t) => {
    const hay = `${t.name} ${t.id} ${t.platform}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Template Gallery</h1>
          <p className="text-white/60">
            Válassz egy sablont → automatikusan betöltődik a Poster Studio-ba.
          </p>
        </div>

        <div className="text-xs font-bold uppercase tracking-widest text-white/60 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Plan: <span className="text-white">{plan.toUpperCase()}</span> • Unlocked:{" "}
          <span className="text-white">
            {Math.min(unlockedCount, POSTER_TEMPLATES.length)}/{POSTER_TEMPLATES.length}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <Search className="w-4 h-4 text-white/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés sablonok között…"
          className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/30"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((t, idx) => {
          const locked = idx >= unlockedCount;

          return (
            <div
              key={t.id}
              className="relative rounded-3xl border border-white/10 bg-white/5 overflow-hidden hover:border-blue-500/40 transition-all"
            >
              {/* Preview */}
              <div className="p-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                  <div className="origin-top-left scale-[0.22] sm:scale-[0.25] md:scale-[0.28]">
                    <PosterCanvas
                      template={t}
                      colors={{
                        primary: "#0B1220",
                        secondary: "#0F1B33",
                        accent: "#7AA2FF",
                      }}
                      logoUrl={null}
                    />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold">{t.name}</div>
                    <div className="text-white/50 text-xs">{t.platform}</div>
                  </div>

                  <button
                    onClick={() => {
                      if (locked) return;
                      router.push(`/dashboard/poster?template=${encodeURIComponent(t.id)}`);
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold border transition
                      ${
                        locked
                          ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
                      }`}
                  >
                    {locked ? "Locked" : "Use"}
                  </button>
                </div>
              </div>

              {/* Lock overlay */}
              {locked && (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3 text-white flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <div className="text-sm font-semibold">
                      Upgrade szükséges (Basic/Pro)
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-white/60">Nincs találat.</div>
      )}
    </div>
  );
}