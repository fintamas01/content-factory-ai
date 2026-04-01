"use client";

import React, { useMemo, useState } from "react";
import HookPostPreview from "@/app/components/HookPostPreview";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Platform = "instagram" | "tiktok" | "facebook" | "linkedin" | "x";

type Hook = {
  type: string;
  headline: string;
  explanation: string;
  cta: string;
};

export default function HookOptimizerPage() {
  const [topic, setTopic] = useState("");
  const [platform] = useState<Platform>("instagram");

  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);

  // DEBUG: mutassunk egy kis visszajelzést kattintáskor
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1200);
  }

  const canRun = useMemo(() => {
    if (loading) return false;
    return topic.trim().length > 0;
  }, [topic, loading]);

  useCopilotPageContext({
    page: "hook-optimizer",
    data: {
      topic,
      platform,
      loading,
      error: err,
      hooksPreview: hooks.slice(0, 6).map((h) => ({
        type: h.type,
        headline: h.headline,
        cta: h.cta,
      })),
      selectedHook: selectedHook ? { type: selectedHook.type, headline: selectedHook.headline } : null,
    },
  });

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
          platform: "instagram",
          tone: "modern",
          goal: "engagement",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      setHooks(Array.isArray(json?.hooks) ? json.hooks : []);
      showToast("Hooks generated ✅");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* Toast */}
      {toast ? (
        <div className="fixed top-6 right-6 z-[9999] rounded-2xl border border-white/10 bg-black/70 backdrop-blur px-4 py-3 text-white text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      <h1 className="text-3xl font-semibold text-white">🔥 Hook Battle Mode</h1>

      <div className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter post topic..."
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white"
        />

        <button
          onClick={run}
          disabled={!canRun}
          className={clsx(
            "rounded-2xl px-6 py-3 font-semibold transition border",
            !canRun
              ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-500 text-white border-purple-400/20"
          )}
        >
          {loading ? "Generating..." : "Generate Hooks"}
        </button>

        {err && <div className="text-red-400">{err}</div>}
      </div>

      {/* Selected preview (inline, hogy biztosan lásd változik-e) */}
      {selectedHook ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="text-white font-semibold">Selected ✅</div>
          <div className="text-white text-xl font-bold">{selectedHook.headline}</div>
          <div className="text-white/70 text-sm">{selectedHook.explanation}</div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <HookPostPreview
              hook={selectedHook.headline}
              topic={topic}
              tone={"modern, premium, direct"}
              platform={platform}
            />
          </div>
        </div>
      ) : null}

      {hooks.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {hooks.map((hook, i) => {
            const isSelected = selectedHook?.headline === hook.headline;

            return (
              <div
                key={`${hook.type}-${hook.headline}-${i}`}
                // FONTOS: kattintás + debug
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedHook(hook);
                  showToast(`Clicked: ${hook.type} ✅`);
                  // extra biztosíték
                  // eslint-disable-next-line no-console
                  console.log("Hook card clicked:", hook);
                }}
                onMouseDown={() => {
                  // ha valami furcsán nyeli a click-et, ez is jelez
                  // eslint-disable-next-line no-console
                  console.log("mousedown on card");
                }}
                className={clsx(
                  // ✅ ezek oldják meg a 90%-os "semmi nem történik" eseteket
                  "relative z-10 pointer-events-auto",
                  "rounded-2xl border bg-gradient-to-br from-purple-900/30 to-black p-6 space-y-4 transition cursor-pointer select-none",
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
                  {isSelected ? "Selected ✅" : "Click to generate full post"}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}