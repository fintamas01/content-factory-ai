"use client";

import React, { useEffect, useMemo, useState } from "react";
import HookPostPreview from "@/app/components/HookPostPreview";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Platform = "instagram" | "tiktok" | "facebook" | "linkedin" | "x";
type Tone = "modern" | "premium" | "direct" | "fun" | "bold";
type Goal = "engagement" | "sales" | "followers" | "leads";

type Hook = {
  type: string;
  headline: string;
  explanation: string;
  cta: string;
};

/**
 * Prevents the whole page from "doing nothing" if HookPostPreview throws.
 * Instead, we show a fallback UI so you can still verify clicks work.
 */
class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any) {
    // eslint-disable-next-line no-console
    console.error("HookPostPreview crashed:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200 text-sm">
            Preview crashed. Check console for details.
          </div>
        )
      );
    }
    return this.props.children as any;
  }
}

export default function HookOptimizerPage() {
  const [topic, setTopic] = useState("");

  // ✅ typed states (no more plain string)
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [tone, setTone] = useState<Tone>("modern");
  const [goal, setGoal] = useState<Goal>("engagement");

  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // store the full Hook object (not just a string)
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);

  const canGenerate = useMemo(() => {
    return !loading && topic.trim().length > 0;
  }, [loading, topic]);

  async function run() {
    setErr(null);
    setHooks([]);
    setSelectedHook(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/hook-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          platform, // ✅ already union typed
          tone, // ✅ already union typed
          goal, // ✅ already union typed
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      setHooks(Array.isArray(json?.hooks) ? json.hooks : []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  // ESC to close the preview modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedHook(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">🔥 Hook Battle Mode</h1>
          <p className="text-white/60 mt-1">
            Click a hook to open a “full post” preview panel.
          </p>
        </div>

        {/* Optional quick controls */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <span className="text-white/50">Platform</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
          </select>

          <span className="text-white/50 ml-2">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
          >
            <option value="modern">Modern</option>
            <option value="premium">Premium</option>
            <option value="direct">Direct</option>
            <option value="fun">Fun</option>
            <option value="bold">Bold</option>
          </select>

          <span className="text-white/50 ml-2">Goal</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal)}
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
          >
            <option value="engagement">Engagement</option>
            <option value="sales">Sales</option>
            <option value="followers">Followers</option>
            <option value="leads">Leads</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter post topic..."
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white"
        />

        <button
          onClick={run}
          disabled={!canGenerate}
          className={clsx(
            "rounded-2xl px-6 py-3 font-semibold transition border",
            !canGenerate
              ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-500 text-white border-purple-400/20"
          )}
        >
          {loading ? "Generating..." : "Generate Hooks"}
        </button>

        {err && <div className="text-red-400">{err}</div>}
      </div>

      {/* Cards grid */}
      {hooks.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {hooks.map((hook, i) => {
            const isSelected = selectedHook?.headline === hook.headline;

            return (
              <div
                key={`${hook.type}-${hook.headline}-${i}`}
                onClick={() => setSelectedHook(hook)}
                className={clsx(
                  "relative rounded-2xl border bg-gradient-to-br from-purple-900/30 to-black p-6 space-y-4 transition cursor-pointer",
                  "hover:scale-[1.02]",
                  isSelected
                    ? "border-purple-400/50 ring-1 ring-purple-400/30"
                    : "border-white/10"
                )}
              >
                <div className="text-xs uppercase text-purple-400 tracking-widest">
                  {hook.type}
                </div>

                <div className="text-xl font-bold text-white">{hook.headline}</div>

                <div className="text-white/70 text-sm">{hook.explanation}</div>

                <div className="text-purple-300 text-sm font-semibold">
                  CTA: {hook.cta}
                </div>

                <div className="text-white/50 text-xs">
                  {isSelected ? "Selected ✅" : "Click to open full post preview →"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview overlay (modal) */}
      {selectedHook ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedHook(null)}
          />

          <div className="relative w-full max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-black shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
              <div>
                <div className="text-white font-semibold text-lg">Full Post Preview</div>
                <div className="text-white/60 text-xs mt-1">
                  {selectedHook.type.toUpperCase()} • {platform} • {goal}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHook(null)}
                className="rounded-xl px-3 py-2 text-xs font-semibold border transition bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
              >
                Close (Esc)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
              <div className="lg:col-span-2 p-5 border-b lg:border-b-0 lg:border-r border-white/10">
                <div className="text-xs uppercase text-purple-300 tracking-widest">
                  Selected Hook
                </div>

                <div className="mt-2 text-2xl font-bold text-white">
                  {selectedHook.headline}
                </div>

                <div className="mt-3 text-white/70 text-sm">{selectedHook.explanation}</div>

                <div className="mt-4 text-purple-200 text-sm font-semibold">
                  CTA: {selectedHook.cta}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-white/80 text-xs font-semibold">Debug</div>
                  <div className="mt-2 text-white/70 text-xs whitespace-pre-wrap">
                    {JSON.stringify({ topic, platform, tone, goal, selectedHook }, null, 2)}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 p-5">
                <PreviewErrorBoundary
                  fallback={
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-white font-semibold">Preview temporarily unavailable</div>
                      <div className="text-white/60 text-sm mt-2">
                        Your click works (hook selected). The preview component likely expects different props.
                        If you paste <span className="text-white">HookPostPreview.tsx</span> here, I’ll align the interface.
                      </div>
                    </div>
                  }
                >
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <HookPostPreview
                      hook={selectedHook.headline}
                      topic={topic}
                      tone={"modern, premium, direct"}
                      platform={platform} // ✅ now correct union type
                    />
                  </div>
                </PreviewErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}