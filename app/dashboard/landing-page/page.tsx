"use client";

import React, { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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

function SectionShell({
  title,
  children,
  copy,
}: {
  title: string;
  children: React.ReactNode;
  copy?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-white/80 text-xs font-bold tracking-widest uppercase">{title}</div>
        {copy ? <CopyButton text={copy} /> : null}
      </div>
      {children}
    </div>
  );
}

export default function LandingPageAgent() {
  const [url, setUrl] = useState("futuretechapps.ro");
  const [language, setLanguage] = useState("en");
  const [tone, setTone] = useState("modern, premium, direct");
  const [serviceFocusText, setServiceFocusText] = useState(
    "web development\ne-commerce\nmobile apps\nSEO"
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const serviceFocus = useMemo(() => {
    return serviceFocusText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [serviceFocusText]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/landing-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language, tone, serviceFocus }),
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

  const layout = data?.layout;
  const sections: any[] = Array.isArray(layout?.page?.sections) ? layout.page.sections : [];

  const hero = sections.find((s) => s?.type === "hero");
  const services = sections.find((s) => s?.type === "services");
  const process = sections.find((s) => s?.type === "process");
  const proof = sections.find((s) => s?.type === "proof");
  const faq = sections.find((s) => s?.type === "faq");
  const cta = sections.find((s) => s?.type === "cta");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Landing Page Agent</h1>
        <p className="text-white/60">Generate → preview a real landing page (no JSON reading).</p>
      </div>

      <Card title="Inputs" right={data ? <CopyButton text={JSON.stringify(data, null, 2)} /> : null}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-white/60">Website URL / domain</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
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
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-white/60">Service focus (1 per line, max 8)</label>
          <textarea
            value={serviceFocusText}
            onChange={(e) => setServiceFocusText(e.target.value)}
            className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white min-h-[100px]"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={run}
            disabled={loading || !url.trim()}
            className={clsx(
              "rounded-2xl px-4 py-2 text-sm font-semibold border transition",
              loading || !url.trim()
                ? "bg-white/5 text-white/40 border-white/10 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/20"
            )}
          >
            {loading ? "Generating..." : "Generate + Preview"}
          </button>

          {err && <div className="text-red-300 text-sm">{err}</div>}
        </div>
      </Card>

      {layout && (
        <div className="space-y-4">
          <SectionShell title="Hero" copy={JSON.stringify(hero ?? {}, null, 2)}>
            <div className="text-3xl md:text-5xl font-bold text-white leading-tight">
              {hero?.headline ?? "—"}
            </div>
            <div className="mt-3 text-white/70 text-lg max-w-3xl">{hero?.subheadline ?? ""}</div>

            {Array.isArray(hero?.bullets) && hero.bullets.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {hero.bullets.slice(0, 8).map((b: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button className="rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-5 py-2.5 text-sm font-semibold text-white border border-blue-400/20">
                {hero?.ctaPrimary ?? "Get started"}
              </button>
              <button className="rounded-2xl bg-white/5 hover:bg-white/10 transition px-5 py-2.5 text-sm font-semibold text-white/80 border border-white/10">
                {hero?.ctaSecondary ?? "See work"}
              </button>
            </div>
          </SectionShell>

          <SectionShell title="Services" copy={JSON.stringify(services ?? {}, null, 2)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(services?.items ?? []).map((it: any, i: number) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white font-semibold">{it?.title ?? "Service"}</div>
                  <div className="text-white/70 text-sm mt-1">{it?.desc ?? ""}</div>
                  {Array.isArray(it?.points) && it.points.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-white/70 text-sm space-y-1">
                      {it.points.slice(0, 6).map((p: string, idx: number) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell title="Process" copy={JSON.stringify(process ?? {}, null, 2)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(process?.steps ?? []).map((st: any, i: number) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white font-semibold">
                    {String(i + 1).padStart(2, "0")} — {st?.title ?? "Step"}
                  </div>
                  <div className="text-white/70 text-sm mt-1">{st?.desc ?? ""}</div>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell title="Proof" copy={JSON.stringify(proof ?? {}, null, 2)}>
            {Array.isArray(proof?.bullets) && proof.bullets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {proof.bullets.slice(0, 8).map((b: string, i: number) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                    {b}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">No proof bullets returned.</div>
            )}
          </SectionShell>

          <SectionShell title="FAQ" copy={JSON.stringify(faq ?? {}, null, 2)}>
            {Array.isArray(faq?.items) && faq.items.length > 0 ? (
              <div className="space-y-2">
                {faq.items.slice(0, 8).map((x: any, i: number) => (
                  <details key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <summary className="cursor-pointer text-white font-semibold">
                      {x?.q ?? "Question"}
                    </summary>
                    <div className="mt-2 text-white/70 text-sm">{x?.a ?? ""}</div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">No FAQ returned.</div>
            )}
          </SectionShell>

          <SectionShell title="CTA" copy={JSON.stringify(cta ?? {}, null, 2)}>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-blue-600/20 to-white/5 p-6">
              <div className="text-white text-2xl font-bold">{cta?.headline ?? "Ready?"}</div>
              <div className="text-white/70 mt-2 max-w-2xl">{cta?.desc ?? ""}</div>
              <div className="mt-5">
                <button className="rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-5 py-2.5 text-sm font-semibold text-white border border-blue-400/20">
                  {cta?.ctaPrimary ?? "Book a call"}
                </button>
              </div>
            </div>
          </SectionShell>
        </div>
      )}
    </div>
  );
}