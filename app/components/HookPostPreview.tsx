"use client";

import React, { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/80">
      {children}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={clsx(
        "rounded-xl px-3 py-2 text-xs font-semibold border transition",
        copied
          ? "bg-emerald-600/20 text-emerald-200 border-emerald-400/20"
          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
      )}
    >
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}

type ApiResult = {
  hook: string;
  platform: string;
  tone: string;
  topic: string;
  output: {
    title: string;
    caption: string;
    cta: string;
    hashtags: string[];
    altCaptions: string[];
    postingTips: string[];
    predictedEngagement: { score10: number; reasoning: string };
  };
};

export default function HookPostPreview({
  topic,
  tone,
  platform,
  hook,
}: {
  topic: string;
  tone: string;
  platform: "instagram" | "linkedin" | "tiktok" | "facebook" | "x";
  hook: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  const hashtagsText = useMemo(() => {
    if (!data?.output?.hashtags?.length) return "";
    return data.output.hashtags.join(" ");
  }, [data]);

  async function generate() {
    setErr(null);
    setLoading(true);
    setData(null);

    try {
      const res = await fetch("/api/ai-agent/caption-from-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook, topic, tone, platform }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      setData(json?.result ?? null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white font-semibold">Post Builder</div>
          <div className="text-white/60 text-xs mt-1">
            Turns a hook into a ready-to-post caption + CTA + hashtags.
          </div>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={clsx(
            "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
            loading
              ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
          )}
        >
          {loading ? "Generating..." : "Generate full post"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>Platform: {platform}</Badge>
        <Badge>Tone: {tone}</Badge>
        <Badge>Topic: {topic}</Badge>
      </div>

      {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}

      {!data ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60 text-sm">
          Click <span className="text-white font-semibold">Generate full post</span> to get a polished caption.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main card */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white/70 text-xs uppercase tracking-widest">Hook</div>
                <div className="text-white font-semibold mt-1">{data.hook}</div>
              </div>

              <div className="flex items-center gap-2">
                <CopyButton label="Copy caption" text={data.output.caption} />
                <CopyButton label="Copy hashtags" text={hashtagsText} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-xs uppercase tracking-widest">Caption</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4 text-white/90 whitespace-pre-wrap text-sm leading-relaxed">
                {data.output.caption}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Engagement: {Math.max(1, Math.min(10, Number(data.output.predictedEngagement?.score10 ?? 7)))}/10</Badge>
              {!!data.output.predictedEngagement?.reasoning && (
                <span className="text-white/50 text-xs">
                  • {data.output.predictedEngagement.reasoning}
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-xs uppercase tracking-widest">CTA</div>
              <div className="mt-2 text-white/85 text-sm">{data.output.cta}</div>
            </div>

            <div className="mt-4">
              <div className="text-white/70 text-xs uppercase tracking-widest">Hashtags</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-white/80 text-sm break-words">
                {hashtagsText || "—"}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
            <div>
              <div className="text-white/70 text-xs uppercase tracking-widest">A/B alternatives</div>
              <div className="mt-2 space-y-2">
                {(data.output.altCaptions ?? []).map((c, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white/60 text-xs font-semibold">Variant {i + 1}</div>
                      <CopyButton label="Copy" text={c} />
                    </div>
                    <div className="mt-2 text-white/85 text-sm whitespace-pre-wrap">{c}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-white/70 text-xs uppercase tracking-widest">Posting tips</div>
              <ul className="mt-2 list-disc pl-5 text-white/75 text-sm space-y-1">
                {(data.output.postingTips ?? []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-white/10">
              <CopyButton
                label="Copy ALL (caption + hashtags)"
                text={`${data.output.caption}\n\n${hashtagsText}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}