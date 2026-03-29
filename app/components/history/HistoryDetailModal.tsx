"use client";

import type { LucideIcon } from "lucide-react";
import { X, Copy, Check, FileText, ListTree, Radar, LayoutGrid } from "lucide-react";
import { useState } from "react";
import type { HistoryListItem } from "@/lib/history/types";
import { KIND_LABEL } from "@/lib/history/map-rows";
import {
  KIND_VISUAL,
  formatHistoryDate,
} from "@/lib/history/kind-styles";

export function HistoryDetailModal({
  item,
  onClose,
}: {
  item: HistoryListItem;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const d = item.data;
  const vis = KIND_VISUAL[item.kind];
  const dateFmt = item.created_at
    ? formatHistoryDate(item.created_at)
    : { primary: "—", sub: "" };

  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(d, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#0a0f18] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)]"
        role="dialog"
        aria-modal
        aria-labelledby="history-detail-title"
      >
        <div
          className={`h-1.5 w-full shrink-0 bg-gradient-to-r ${vis.headerGradient}`}
          aria-hidden
        />

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b12] px-5 py-4 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] ${vis.badge}`}
              >
                {KIND_LABEL[item.kind]}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {dateFmt.primary}
                {dateFmt.sub ? (
                  <span className="ml-1.5 text-slate-600">{dateFmt.sub}</span>
                ) : null}
              </span>
            </div>
            <h2
              id="history-detail-title"
              className="mt-2 break-words text-lg font-black leading-snug tracking-tight text-white md:text-xl"
            >
              {item.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {item.kind === "content" && <ContentBody data={d} />}
          {item.kind === "product" && <ProductBody data={d} />}
          {item.kind === "audit" && <AuditBody data={d} />}
          {item.kind === "matrix" && <MatrixBody data={d} />}
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
  accentClass,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  accentClass: string;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${accentClass}`}
        >
          <Icon className="h-4 w-4 text-white/90" />
        </span>
        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ContentBody({ data }: { data: Record<string, unknown> }) {
  const results = data.results as Record<string, unknown> | undefined;
  const tone = String(data.tone ?? "");
  const original = String(data.original_content ?? "");
  return (
    <div className="space-y-4">
      {tone ? (
        <span className="inline-flex rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-200">
          Tone · {tone}
        </span>
      ) : null}
      <DetailSection
        icon={FileText}
        title="Source"
        accentClass="from-blue-600/50 to-cyan-700/30"
      >
        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-300">
          {original || "—"}
        </p>
      </DetailSection>
      {results && typeof results === "object" ? (
        <DetailSection
          icon={LayoutGrid}
          title="Platform outputs"
          accentClass="from-cyan-600/40 to-blue-800/30"
        >
          <div className="space-y-3">
            {Object.entries(results).map(([platform, val]) => {
              if (platform.startsWith("__")) return null;
              const post = val as Record<string, unknown>;
              const text =
                typeof post?.text === "string"
                  ? post.text
                  : typeof post?.content === "string"
                    ? post.content
                    : String(post ?? "");
              const img =
                typeof post?.image_prompt === "string" ? post.image_prompt : "";
              return (
                <div
                  key={platform}
                  className="rounded-xl border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.07] to-transparent p-4"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/90">
                    {platform.replace(/_/g, " ")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                    {text}
                  </p>
                  {img ? (
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Image prompt
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        {img}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}

function ProductBody({ data }: { data: Record<string, unknown> }) {
  const out = data.output_data as Record<string, unknown> | undefined;
  const inp = data.input_data as Record<string, unknown> | undefined;
  const bullets = Array.isArray(out?.bullets)
    ? (out.bullets as string[])
    : [];
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.12] via-[#0f172a] to-[#070d18] p-5 md:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300/80">
          Listing copy
        </p>
        <p className="mt-2 text-2xl font-black leading-tight text-white">
          {String(out?.title ?? data.product_name ?? "")}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.7] text-slate-300">
          {String(out?.description ?? "")}
        </p>
      </div>

      {bullets.length > 0 ? (
        <DetailSection
          icon={ListTree}
          title="Bullet points"
          accentClass="from-violet-600/50 to-fuchsia-800/30"
        >
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-violet-500/10 bg-violet-500/[0.04] px-3 py-2.5 text-sm text-slate-200"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/25 text-[10px] font-black text-fuchsia-200">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}

      <DetailSection
        icon={FileText}
        title="SEO"
        accentClass="from-fuchsia-700/30 to-violet-900/30"
      >
        <p className="text-sm font-semibold text-slate-200">
          {String(out?.seo_title ?? "")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {String(out?.seo_description ?? "")}
        </p>
      </DetailSection>

      {inp && Object.keys(inp).length > 0 ? (
        <DetailSection
          icon={FileText}
          title="Generation input"
          accentClass="from-slate-600/40 to-slate-900/40"
        >
          <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-500">
            {JSON.stringify(inp, null, 2)}
          </pre>
        </DetailSection>
      ) : null}
    </div>
  );
}

function AuditBody({ data }: { data: Record<string, unknown> }) {
  const report = data.report as Record<string, unknown> | undefined;
  const summary = typeof report?.summary === "string" ? report.summary : "";
  const scores = report?.scores as Record<string, unknown> | undefined;
  const url = String(data.page_url ?? "");
  const scoreLabels: Record<string, string> = {
    seo: "SEO",
    ai_discoverability: "AI visibility",
    conversion: "Conversion",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/80">
          Audited URL
        </p>
        <p className="mt-2 break-all font-mono text-sm font-medium text-emerald-100/95">
          {url || "—"}
        </p>
      </div>

      {scores && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(["seo", "ai_discoverability", "conversion"] as const).map((k) => (
            <div
              key={k}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/10 to-[#0b1220] px-3 py-4 text-center"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-teal-500/5 to-transparent" />
              <p className="relative text-[9px] font-black uppercase tracking-widest text-emerald-400/70">
                {scoreLabels[k] ?? k}
              </p>
              <p className="relative mt-2 text-3xl font-black tabular-nums text-white">
                {Number(scores[k] ?? 0)}
              </p>
              <p className="relative mt-1 text-[10px] font-medium text-slate-500">
                / 100
              </p>
            </div>
          ))}
        </div>
      )}

      <DetailSection
        icon={Radar}
        title="Executive summary"
        accentClass="from-emerald-600/45 to-teal-900/35"
      >
        <p className="whitespace-pre-wrap text-sm leading-[1.75] text-slate-300">
          {summary}
        </p>
      </DetailSection>

      <DetailSection
        icon={FileText}
        title="Full report (JSON)"
        accentClass="from-slate-600/40 to-slate-900/40"
      >
        <pre className="max-h-56 overflow-auto rounded-xl border border-white/[0.06] bg-black/45 p-3 font-mono text-[11px] leading-relaxed text-slate-500">
          {JSON.stringify(report, null, 2)}
        </pre>
      </DetailSection>
    </div>
  );
}

function MatrixBody({ data }: { data: Record<string, unknown> }) {
  const gen = data.generation_data as { days?: unknown[] } | undefined;
  const days = Array.isArray(gen?.days) ? gen.days : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3">
        <span className="text-sm font-black text-amber-100">
          {String(data.brand_name ?? "Brand")}
        </span>
        {data.month_year ? (
          <span className="font-mono text-xs text-amber-200/60">
            {String(data.month_year)}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {days.map((day, idx) => {
          const dayObj = day as Record<string, unknown>;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-4"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/90">
                {String(dayObj.day ?? `Day ${idx + 1}`)}
              </p>
              <p className="mt-2 font-bold text-white">{String(dayObj.title ?? "")}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {String(dayObj.platform ?? "")}
              </p>
              <p className="mt-3 line-clamp-8 text-xs leading-relaxed text-slate-400">
                {String(dayObj.content ?? dayObj.outline ?? "")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
