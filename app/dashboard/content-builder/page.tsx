"use client";

import React, { useMemo, useState } from "react";

type ContentBuilderResponse = {
  url: string;
  language: string;
  tone: string;
  serviceFocus: string[];
  result: any;
  diagnostics?: any;
  error?: string;
};

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
    } catch {
      // ignore
    }
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

function SectionCard({ section }: { section: any }) {
  const id = String(section?.id ?? "section");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-white font-semibold">{id.toUpperCase()}</div>
        <CopyButton text={safeJsonStringify(section, 2)} />
      </div>

      {section?.headline && (
        <div className="mt-2 text-white/90 font-semibold text-sm">
          {String(section.headline)}
        </div>
      )}

      {section?.subheadline && (
        <div className="mt-1 text-white/70 text-sm">
          {String(section.subheadline)}
        </div>
      )}

      <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
        {safeJsonStringify(section, 2)}
      </pre>
    </div>
  );
}

export default function ContentBuilderPage() {
  const [url, setUrl] = useState("futuretechapps.ro");
  const [language, setLanguage] = useState("en");
  const [tone, setTone] = useState("modern, premium, direct");
  const [serviceFocusText, setServiceFocusText] = useState(
    "web development\ne-commerce\nmobile apps\nSEO"
  );

  const [maxPages, setMaxPages] = useState(7);
  const [timeoutMsPerPage, setTimeoutMsPerPage] = useState(7000);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ContentBuilderResponse | null>(null);

  const serviceFocus = useMemo(() => {
    return serviceFocusText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [serviceFocusText]);

  const canRun = useMemo(() => {
    if (loading) return false;
    return url.trim().length > 0;
  }, [url, loading]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/content-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          language: language.trim() || "en",
          tone: tone.trim() || "modern, premium, direct",
          serviceFocus,
          maxPages,
          timeoutMsPerPage,
          // companyFacts: {} // optional later
        }),
      });

      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      setData(json as ContentBuilderResponse);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const result = data?.result;
  const pages = isRecord(result?.pages) ? result.pages : null;
  const home = pages && isRecord(pages.home) ? pages.home : null;
  const homeSections = Array.isArray(home?.sections) ? home.sections : [];

  const schema = isRecord(result?.schema) ? result.schema : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Content Builder Agent</h1>
        <p className="text-white/60">
          Crawl → generate homepage + service pages + meta + schema (English default).
        </p>
      </div>

      <Card title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
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
            <label className="text-xs text-white/60">Tone</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              placeholder="modern, premium, direct"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Service focus (1 per line, max 8)</label>
            <textarea
              value={serviceFocusText}
              onChange={(e) => setServiceFocusText(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[110px]"
              placeholder={`web development\ne-commerce\nmobile apps\nSEO`}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60">Max pages (1..10)</label>
              <input
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Timeout per page (ms)</label>
              <input
                type="number"
                value={timeoutMsPerPage}
                onChange={(e) => setTimeoutMsPerPage(Number(e.target.value))}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
              />
            </div>
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
            {loading ? "Running..." : "Generate Content"}
          </button>

          {data?.diagnostics ? (
            <div className="text-xs text-white/60 flex items-center gap-2">
              <Badge>OpenAI key: {String(Boolean(data.diagnostics?.hasOpenAIKey))}</Badge>
              <Badge>Pages: {Number(data.diagnostics?.pagesCrawled ?? 0)}</Badge>
              <Badge>Services: {serviceFocus.length}</Badge>
            </div>
          ) : null}

          {data?.result ? <CopyButton text={safeJsonStringify(data.result, 2)} /> : null}
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data?.error && (
        <Card title="Error">
          <div className="text-red-300 text-sm">{data.error}</div>
        </Card>
      )}

      {data && (
        <>
          <Card title="Homepage (sections)" right={<CopyButton text={safeJsonStringify(home, 2)} />}>
            {homeSections.length === 0 ? (
              <div className="text-white/60 text-sm">
                No homepage sections returned. Check Debug below.
              </div>
            ) : (
              <div className="space-y-3">
                {homeSections.map((s: any, idx: number) => (
                  <SectionCard key={`${s?.id ?? "sec"}-${idx}`} section={s} />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Schema"
            right={<CopyButton text={safeJsonStringify(schema, 2)} />}
          >
            <pre className="text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(schema, 2)}
            </pre>
          </Card>

          <Card
            title="All generated pages (raw)"
            right={<CopyButton text={safeJsonStringify(pages, 2)} />}
          >
            <pre className="text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(pages, 2)}
            </pre>
          </Card>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-white/80 font-semibold">
              Debug: raw JSON
            </summary>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(data, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}