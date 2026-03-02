"use client";

import React, { useState } from "react";
import HookPostPreview from "@/app/components/HookPostPreview";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Hook = {
  type: string;
  headline: string;
  explanation: string;
  cta: string;
};

export default function HookOptimizerPage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("modern");
  const [goal, setGoal] = useState("engagement");
  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selectedHook, setSelectedHook] = useState<string>("");

  async function run() {
    setErr(null);
    setHooks([]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/hook-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, tone, goal }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      setHooks(json.hooks ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-semibold text-white">
        🔥 Hook Battle Mode
      </h1>

      <div className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter post topic..."
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white"
        />

        <button
          onClick={run}
          disabled={loading || !topic}
          className={clsx(
            "rounded-2xl px-6 py-3 font-semibold transition",
            loading
              ? "bg-white/10 text-white/40"
              : "bg-purple-600 hover:bg-purple-500 text-white"
          )}
        >
          {loading ? "Generating..." : "Generate Hooks"}
        </button>

        {err && <div className="text-red-400">{err}</div>}
      </div>

      {selectedHook ? (
        <HookPostPreview
            hook={selectedHook}
            topic={topic}       // ami nálad a “sales” input
            tone={"modern, premium, direct"}
            platform="instagram"
        />
        ) : null}

      {hooks.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {hooks.map((hook, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/30 to-black p-6 space-y-4 hover:scale-[1.02] transition"
            >
              <div className="text-xs uppercase text-purple-400 tracking-widest">
                {hook.type}
              </div>

              <div className="text-xl font-bold text-white">
                {hook.headline}
              </div>

              <div className="text-white/70 text-sm">
                {hook.explanation}
              </div>

              <div className="text-purple-300 text-sm font-semibold">
                CTA: {hook.cta}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}