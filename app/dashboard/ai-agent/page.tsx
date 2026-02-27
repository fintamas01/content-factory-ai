"use client";

import React, { useState } from "react";

type Goal = "geo_audit" | "content_plan" | "brand_voice";
type Platform = "web" | "instagram" | "tiktok" | "linkedin";

export default function AIAgentPage() {
  const [goal, setGoal] = useState<Goal>("geo_audit");
  const [platform, setPlatform] = useState<Platform>("web");
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          platform,
          url: goal === "geo_audit" ? url : undefined,
          brandName: brandName || undefined,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setData(json);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI Agent</h1>
        <p className="text-white/60">
          Cél-alapú futtatás (query → web context → elemzés → teendők).
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            >
              <option value="geo_audit">GEO audit</option>
              <option value="content_plan">Content plan</option>
              <option value="brand_voice">Brand voice</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            >
              <option value="web">web</option>
              <option value="instagram">instagram</option>
              <option value="tiktok">tiktok</option>
              <option value="linkedin">linkedin</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Brand name</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="FutureTech Applications / ApplePlug / ..."
            />
          </div>
        </div>

        {goal === "geo_audit" && (
          <div>
            <label className="text-xs text-white/60">Website URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="https://example.com"
            />
            <p className="text-xs text-white/40 mt-1">
              GEO auditnál kötelező.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-white/60">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[90px]"
            placeholder="Mit szeretnél kiemelten? (pl. célközönség, stílus, termékek)"
          />
        </div>

        <button
          onClick={run}
          disabled={loading || (goal === "geo_audit" && !url)}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold border transition
            ${
              loading || (goal === "geo_audit" && !url)
                ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
            }`}
        >
          {loading ? "Running..." : "Run Agent"}
        </button>

        {err && <div className="text-red-300 text-sm">{err}</div>}
      </div>

      {data && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-auto">
          <pre className="text-xs text-white/80 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}