"use client";

import React, { useState } from "react";

type AnalyzeResponse = {
  tone: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  improvedText: string;
};

const PLATFORMS = [
  { label: "Instagram", value: "instagram" },
  { label: "TikTok", value: "tiktok" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Web", value: "web" },
];

export default function BrandVoiceAnalyzerPage() {
  const [text, setText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0].value);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/brand-voice-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, brandName, platform }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Hiba történt");
      }

      const data = await res.json();
      setResult(data as AnalyzeResponse);
    } catch (err: any) {
      setError(err.message || "Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result?.improvedText) {
      await navigator.clipboard.writeText(result.improvedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-3">Brand Voice Analyzer</h1>
      <form
        className="bg-white border rounded-lg p-6 shadow flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label htmlFor="text" className="block font-medium mb-1">
            Szöveg elemzéshez <span className="text-red-500">*</span>
          </label>
          <textarea
            id="text"
            className="w-full min-h-[120px] border rounded p-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            placeholder="Írd ide a poszt vagy szöveg szövegét…"
          />
        </div>

        <div>
          <label htmlFor="brandName" className="block font-medium mb-1">
            Márkanév (opcionális)
          </label>
          <input
            id="brandName"
            type="text"
            className="w-full border rounded p-2"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Pl. Content Factory"
          />
        </div>

        <div>
          <label htmlFor="platform" className="block font-medium mb-1">
            Platform
          </label>
          <select
            id="platform"
            className="w-full border rounded p-2"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map((p) => (
              <option value={p.value} key={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition disabled:bg-blue-300"
          disabled={loading || !text.trim()}
        >
          {loading ? "Elemzés folyamatban…" : "Elemzés indítása"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 mt-4 p-3 rounded">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center mt-6 justify-center text-blue-700 font-medium">
          Elemzés folyamatban, kérlek várj…
        </div>
      )}

      {result && (
        <div className="mt-8 bg-gray-50 rounded-lg border p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-blue-800 mb-2">
              {result.tone}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold mb-1 text-green-700">Erősségek</h3>
                <ul className="list-disc list-inside text-green-900">
                  {result.strengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-yellow-800">Rizikók</h3>
                <ul className="list-disc list-inside text-yellow-900">
                  {result.risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-blue-800">Javaslatok</h3>
                <ul className="list-disc list-inside text-blue-900">
                  {result.suggestions.map((sugg, idx) => (
                    <li key={idx}>{sugg}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4 shadow flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-semibold text-gray-900">Javított szöveg</h4>
              <button
                onClick={handleCopy}
                className="inline-flex items-center px-3 py-1.5 border rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium text-sm transition"
                aria-label="Másolás vágólapra"
              >
                {copied ? "Másolva!" : "Másolás"}
              </button>
            </div>
            <p className="whitespace-pre-line">{result.improvedText}</p>
          </div>
        </div>
      )}
    </div>
  );
}