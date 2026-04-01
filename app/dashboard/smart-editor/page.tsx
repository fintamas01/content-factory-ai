"use client";

import React, { useMemo, useState } from "react";
import { useCopilotPageContext } from "@/app/components/copilot/useCopilotPageContext";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isRecord(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeJsonStringify(value: any, space = 2) {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-white font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/80">
      {children}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
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
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function VariantCard({ name, v }: { name: string; v: any }) {
  const headline = String(v?.headline ?? "");
  const subheadline = String(v?.subheadline ?? "");
  const bullets = Array.isArray(v?.bullets) ? v.bullets : [];
  const p = String(v?.shortParagraph ?? "");
  const c1 = String(v?.ctaPrimary ?? "");
  const c2 = String(v?.ctaSecondary ?? "");

  const block = [
    headline && `# ${headline}`,
    subheadline && subheadline,
    bullets.length ? `\n- ${bullets.join("\n- ")}` : "",
    p && `\n${p}`,
    (c1 || c2) && `\nCTA: ${c1}${c2 ? ` | ${c2}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-white font-semibold">{name.toUpperCase()}</div>
        <CopyButton text={block} />
      </div>

      <div className="mt-3">
        <div className="text-white text-lg font-bold">{headline}</div>
        {subheadline && <div className="text-white/70 mt-1">{subheadline}</div>}

        {bullets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {bullets.slice(0, 8).map((b: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {p && <div className="mt-3 text-white/70">{p}</div>}

        <div className="mt-4 flex gap-2">
          {c1 && (
            <button className="rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-2 text-sm font-semibold text-white border border-blue-400/20">
              {c1}
            </button>
          )}
          {c2 && (
            <button className="rounded-2xl bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold text-white/80 border border-white/10">
              {c2}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SmartEditorPage() {
  const [url, setUrl] = useState("futuretechapps.ro");
  const [language, setLanguage] = useState("en");
  const [tone, setTone] = useState("modern, premium, direct");
  const [focus, setFocus] = useState("homepage hero");
  const [timeoutMs, setTimeoutMs] = useState(9000);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useCopilotPageContext({
    page: "smart-editor",
    data: {
      url,
      language,
      tone,
      focus,
      timeoutMs,
      loading,
      error: err,
      outputPreview: data?.variants
        ? { hasVariants: true, keywordsCount: Array.isArray(data?.keywords) ? data.keywords.length : null }
        : null,
    },
  });

  const canRun = useMemo(() => !loading && url.trim().length > 0, [loading, url]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/smart-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          language,
          tone,
          focus,
          timeoutMs,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Request failed");
      setData(json);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const variants = isRecord(data?.variants) ? data.variants : {};
  const improvements = Array.isArray(data?.improvements) ? data.improvements : [];
  const keywords = Array.isArray(data?.keywords) ? data.keywords : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Smart Editor Agent</h1>
        <p className="text-white/60">
          Crawl → rewrite copy into 4 variants (direct / premium / friendly / SEO) + suggestions.
        </p>
      </div>

      <Card title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Website URL / domain</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="futuretechapps.ro"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            >
              <option value="en">English (en)</option>
              <option value="ro">Romanian (ro)</option>
              <option value="hu">Hungarian (hu)</option>
              <option value="de">German (de)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/60">Timeout (ms)</label>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs text-white/60">Tone</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Focus</label>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="homepage hero / services section / about section"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={!canRun}
            className={clsx(
              "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
              !canRun
                ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
            )}
          >
            {loading ? "Running..." : "Generate Rewrites"}
          </button>

          {data?.diagnostics ? (
            <div className="text-xs text-white/60 flex items-center gap-2">
              <Badge>OpenAI key: {String(Boolean(data.diagnostics?.hasOpenAIKey))}</Badge>
              <Badge>Chars: {String(data.diagnostics?.sourceChars ?? "—")}</Badge>
            </div>
          ) : null}

          {data ? <CopyButton text={safeJsonStringify(data, 2)} /> : null}
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data?.error && (
        <Card title="Error">
          <div className="text-red-300 text-sm">{String(data.error)}</div>
          {data?.details && <div className="text-white/60 text-xs mt-2">{String(data.details)}</div>}
        </Card>
      )}

      {data && (
        <>
          <Card title="Rewrite Variants">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {variants?.direct && <VariantCard name="direct" v={variants.direct} />}
              {variants?.premium && <VariantCard name="premium" v={variants.premium} />}
              {variants?.friendly && <VariantCard name="friendly" v={variants.friendly} />}
              {variants?.seo && <VariantCard name="seo" v={variants.seo} />}
            </div>
          </Card>

          <Card title="Improvements + keywords">
            <div className="flex flex-wrap gap-2">
              {keywords.slice(0, 20).map((k: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                >
                  {k}
                </span>
              ))}
            </div>

            {improvements.length > 0 ? (
              <ul className="list-disc pl-5 text-white/70 text-sm mt-3 space-y-1">
                {improvements.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60 text-sm mt-3">No improvements returned.</div>
            )}
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">Debug: raw JSON</summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(data, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}