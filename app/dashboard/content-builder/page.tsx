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

type ViewMode = "preview" | "copy";

type NormalizedService = {
  title: string;
  desc: string;
  outcomes: string[];
};

type NormalizedProcessStep = {
  title: string;
  desc: string;
};

type NormalizedFaqItem = {
  q: string;
  a: string;
};

type NormalizedHero = {
  headline: string;
  subheadline: string;
  ctaPrimary: string;
  ctaSecondary: string;
  bullets: string[];
};

type NormalizedCta = {
  headline: string;
  desc: string;
  cta: string;
};

type NormalizedProof = {
  bullets: string[];
};

type NormalizedHomepage = {
  hero: NormalizedHero;
  services: NormalizedService[];
  process: NormalizedProcessStep[];
  proof: NormalizedProof;
  faq: NormalizedFaqItem[];
  cta: NormalizedCta;
  rawSections: any[];
};

type NormalizedSchema = {
  // keep as unknown object(s); we’ll show prettified + script tag export
  raw: any;
};

type NormalizedContent = {
  url: string;
  language: string;
  tone: string;
  serviceFocus: string[];
  pages: any;
  homepage: NormalizedHomepage;
  schema: NormalizedSchema;
  rawResult: any;
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

function clampStr(s: any, fallback = "") {
  const v = typeof s === "string" ? s.trim() : "";
  return v || fallback;
}

function asStringArray(v: any, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeContent(data: ContentBuilderResponse | null): NormalizedContent | null {
  if (!data) return null;

  const result = data.result;
  const pages = isRecord(result?.pages) ? result.pages : {};
  const home = isRecord(pages?.home) ? pages.home : {};
  const rawSections = Array.isArray(home?.sections) ? home.sections : [];

  const byId = (id: string) =>
    rawSections.find((s: any) => String(s?.id ?? "").toLowerCase() === id.toLowerCase());

  const heroRaw = byId("hero") ?? {};
  const servicesRaw = byId("services") ?? {};
  const processRaw = byId("process") ?? {};
  const proofRaw = byId("proof") ?? {};
  const faqRaw = byId("faq") ?? {};
  const ctaRaw = byId("cta") ?? {};

  const hero: NormalizedHero = {
    headline: clampStr(heroRaw?.headline, "Your headline here"),
    subheadline: clampStr(heroRaw?.subheadline, "Your subheadline here"),
    ctaPrimary: clampStr(heroRaw?.ctaPrimary, clampStr(heroRaw?.cta, "Get started")),
    ctaSecondary: clampStr(heroRaw?.ctaSecondary, "See work"),
    bullets: asStringArray(heroRaw?.bullets, 8),
  };

  const services: NormalizedService[] = Array.isArray(servicesRaw?.items)
    ? servicesRaw.items
        .map((it: any) => ({
          title: clampStr(it?.title, "Service"),
          desc: clampStr(it?.desc, ""),
          outcomes: asStringArray(it?.outcomes, 6),
        }))
        .filter((x: NormalizedService) => x.title)
        .slice(0, 12)
    : [];

  const process: NormalizedProcessStep[] = Array.isArray(processRaw?.items)
    ? processRaw.items
        .map((it: any) => ({
          title: clampStr(it?.title, "Step"),
          desc: clampStr(it?.desc, ""),
        }))
        .filter((x: NormalizedProcessStep) => x.title)
        .slice(0, 8)
    : [];

  const proof: NormalizedProof = {
    bullets: asStringArray(proofRaw?.bullets, 10),
  };

  const faq: NormalizedFaqItem[] = Array.isArray(faqRaw?.items)
    ? faqRaw.items
        .map((it: any) => ({
          q: clampStr(it?.q, ""),
          a: clampStr(it?.a, ""),
        }))
        .filter((x: NormalizedFaqItem) => x.q && x.a)
        .slice(0, 12)
    : [];

  const cta: NormalizedCta = {
    headline: clampStr(ctaRaw?.headline, "Ready to get started?"),
    desc: clampStr(ctaRaw?.desc, ""),
    cta: clampStr(ctaRaw?.cta, "Start now"),
  };

  const schemaRaw = isRecord(result?.schema) ? result.schema : result?.schema ?? null;

  return {
    url: clampStr(data.url, ""),
    language: clampStr(data.language, "en"),
    tone: clampStr(data.tone, ""),
    serviceFocus: Array.isArray(data.serviceFocus) ? data.serviceFocus : [],
    pages,
    homepage: {
      hero,
      services,
      process,
      proof,
      faq,
      cta,
      rawSections,
    },
    schema: { raw: schemaRaw },
    rawResult: result,
    diagnostics: data.diagnostics,
    error: data.error,
  };
}

function Card({
  title,
  children,
  right,
  subtle,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-white/10 p-4",
        subtle ? "bg-white/[0.03]" : "bg-white/5"
      )}
    >
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

function TogglePill({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
      {(["preview", "copy"] as ViewMode[]).map((v) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={clsx(
              "px-3 py-1.5 text-xs font-semibold rounded-xl transition",
              active ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
            )}
          >
            {v === "preview" ? "Website Preview" : "Copy Mode"}
          </button>
        );
      })}
    </div>
  );
}

function SectionShell({
  label,
  children,
  right,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="text-white/90 font-semibold tracking-wide">{label}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DividerGlow() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent my-3" />
  );
}

function PreviewHero({ hero }: { hero: NormalizedHero }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative">
        <div className="text-xs text-white/60 font-semibold tracking-widest uppercase">
          HERO
        </div>
        <h2 className="mt-2 text-2xl md:text-3xl font-bold text-white leading-tight">
          {hero.headline}
        </h2>
        <p className="mt-2 text-white/70 max-w-2xl">{hero.subheadline}</p>

        {hero.bullets.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hero.bullets.slice(0, 6).map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-2 text-sm font-semibold text-white border border-blue-400/20"
          >
            {hero.ctaPrimary}
          </button>
          <button
            type="button"
            className="rounded-2xl bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold text-white/80 border border-white/10"
          >
            {hero.ctaSecondary}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewServices({ services }: { services: NormalizedService[] }) {
  return (
    <SectionShell
      label="SERVICES"
      right={<Badge>{services.length || 0} items</Badge>}
    >
      {services.length === 0 ? (
        <div className="text-white/60 text-sm">No services found in output.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map((s, idx) => (
            <div
              key={`${s.title}-${idx}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition"
            >
              <div className="text-white font-semibold">{s.title}</div>
              {s.desc && <div className="mt-1 text-white/70 text-sm">{s.desc}</div>}
              {s.outcomes.length > 0 && (
                <>
                  <DividerGlow />
                  <ul className="space-y-1 text-sm text-white/75">
                    {s.outcomes.slice(0, 4).map((o, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-white/30" />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function PreviewProcess({ steps }: { steps: NormalizedProcessStep[] }) {
  return (
    <SectionShell label="PROCESS" right={<Badge>{steps.length || 0} steps</Badge>}>
      {steps.length === 0 ? (
        <div className="text-white/60 text-sm">No process steps found in output.</div>
      ) : (
        <div className="space-y-3">
          {steps.map((s, idx) => (
            <div
              key={`${s.title}-${idx}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">
                  <span className="text-white/50 mr-2">#{idx + 1}</span>
                  {s.title}
                </div>
              </div>
              {s.desc && <div className="mt-1 text-white/70 text-sm">{s.desc}</div>}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function PreviewProof({ bullets }: { bullets: string[] }) {
  return (
    <SectionShell label="PROOF" right={<Badge>{bullets.length || 0} bullets</Badge>}>
      {bullets.length === 0 ? (
        <div className="text-white/60 text-sm">No proof bullets found in output.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bullets.slice(0, 12).map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80"
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function PreviewFaq({ items }: { items: NormalizedFaqItem[] }) {
  return (
    <SectionShell label="FAQ" right={<Badge>{items.length || 0} Q&As</Badge>}>
      {items.length === 0 ? (
        <div className="text-white/60 text-sm">No FAQ items found in output.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <details
              key={`${it.q}-${idx}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <summary className="cursor-pointer text-white font-semibold">
                {it.q}
              </summary>
              <div className="mt-2 text-white/70 text-sm">{it.a}</div>
            </details>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function PreviewCta({ cta }: { cta: NormalizedCta }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-blue-600/15 via-white/[0.03] to-emerald-600/10 p-6">
      <div className="text-white font-bold text-xl">{cta.headline}</div>
      {cta.desc && <div className="mt-2 text-white/70">{cta.desc}</div>}
      <div className="mt-4">
        <button
          type="button"
          className="rounded-2xl bg-white/10 hover:bg-white/15 transition px-4 py-2 text-sm font-semibold text-white border border-white/10"
        >
          {cta.cta}
        </button>
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
      />
    </div>
  );
}

function toMarkdown(normalized: NormalizedContent) {
  const h = normalized.homepage.hero;
  const services = normalized.homepage.services;
  const process = normalized.homepage.process;
  const proof = normalized.homepage.proof.bullets;
  const faq = normalized.homepage.faq;
  const cta = normalized.homepage.cta;

  const md: string[] = [];
  md.push(`# ${h.headline}`);
  if (h.subheadline) md.push(`\n${h.subheadline}\n`);
  if (h.bullets.length) {
    md.push(`\n**Highlights**\n`);
    md.push(h.bullets.map((b) => `- ${b}`).join("\n"));
    md.push("");
  }

  if (services.length) {
    md.push(`\n## Services\n`);
    for (const s of services) {
      md.push(`### ${s.title}`);
      if (s.desc) md.push(s.desc);
      if (s.outcomes.length) md.push(s.outcomes.map((o) => `- ${o}`).join("\n"));
      md.push("");
    }
  }

  if (process.length) {
    md.push(`\n## Process\n`);
    process.forEach((p, i) => {
      md.push(`- **${i + 1}. ${p.title}** — ${p.desc}`.trim());
    });
    md.push("");
  }

  if (proof.length) {
    md.push(`\n## Proof\n`);
    md.push(proof.map((b) => `- ${b}`).join("\n"));
    md.push("");
  }

  if (faq.length) {
    md.push(`\n## FAQ\n`);
    for (const f of faq) {
      md.push(`**Q:** ${f.q}\n\n**A:** ${f.a}\n`);
    }
  }

  md.push(`\n## ${cta.headline}\n`);
  if (cta.desc) md.push(cta.desc);
  md.push(`\n**CTA:** ${cta.cta}\n`);

  return md.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toHtml(normalized: NormalizedContent) {
  const h = normalized.homepage.hero;
  const services = normalized.homepage.services;
  const process = normalized.homepage.process;
  const proof = normalized.homepage.proof.bullets;
  const faq = normalized.homepage.faq;
  const cta = normalized.homepage.cta;

  const schemaScript = schemaToScriptTag(normalized.schema.raw);

  const html = `<!doctype html>
<html lang="${escapeHtml(normalized.language || "en")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(h.headline)}</title>
  ${schemaScript ? schemaScript : ""}
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:0; background:#0b1020; color:#fff}
    .wrap{max-width:1100px; margin:0 auto; padding:48px 20px}
    .card{border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); border-radius:18px; padding:22px}
    .muted{color:rgba(255,255,255,.72)}
    .grid{display:grid; gap:14px}
    @media(min-width:900px){ .grid-3{grid-template-columns:repeat(3,1fr)} .grid-2{grid-template-columns:repeat(2,1fr)} }
    .btn{display:inline-block; padding:10px 14px; border-radius:14px; background:#2563eb; color:#fff; text-decoration:none; font-weight:700}
    .btn2{display:inline-block; padding:10px 14px; border-radius:14px; background:rgba(255,255,255,.06); color:#fff; text-decoration:none; font-weight:700; border:1px solid rgba(255,255,255,.1)}
    .pill{display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); font-size:12px; margin:0 8px 8px 0}
    .hr{height:1px; background:linear-gradient(to right, transparent, rgba(255,255,255,.18), transparent); margin:18px 0}
    details{border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); border-radius:16px; padding:14px}
    summary{cursor:pointer; font-weight:800}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card">
      <div style="letter-spacing:.18em; text-transform:uppercase; font-size:12px; opacity:.7">Hero</div>
      <h1 style="margin:10px 0 6px; font-size:40px; line-height:1.1">${escapeHtml(h.headline)}</h1>
      <p class="muted" style="max-width:70ch; font-size:16px">${escapeHtml(h.subheadline)}</p>
      <div style="margin-top:14px">
        <a class="btn" href="#contact">${escapeHtml(h.ctaPrimary)}</a>
        <span style="display:inline-block; width:10px"></span>
        <a class="btn2" href="#services">${escapeHtml(h.ctaSecondary)}</a>
      </div>
      ${h.bullets.length ? `<div class="hr"></div><div>${h.bullets
        .slice(0, 8)
        .map((b) => `<span class="pill">${escapeHtml(b)}</span>`)
        .join("")}</div>` : ""}
    </section>

    <div style="height:14px"></div>

    <section id="services" class="card">
      <h2 style="margin:0 0 14px">Services</h2>
      <div class="grid grid-3">
        ${services
          .map(
            (s) => `<div class="card" style="padding:16px">
              <div style="font-weight:800">${escapeHtml(s.title)}</div>
              ${s.desc ? `<div class="muted" style="margin-top:6px">${escapeHtml(s.desc)}</div>` : ""}
              ${s.outcomes.length ? `<div class="hr"></div><ul style="margin:0; padding-left:18px" class="muted">
                ${s.outcomes.slice(0, 6).map((o) => `<li>${escapeHtml(o)}</li>`).join("")}
              </ul>` : ""}
            </div>`
          )
          .join("")}
      </div>
    </section>

    <div style="height:14px"></div>

    <section class="card">
      <h2 style="margin:0 0 14px">Process</h2>
      <div class="grid grid-2">
        ${process
          .map(
            (p, i) => `<div class="card" style="padding:16px">
              <div style="font-weight:800"><span style="opacity:.6">#${i + 1}</span> ${escapeHtml(p.title)}</div>
              ${p.desc ? `<div class="muted" style="margin-top:6px">${escapeHtml(p.desc)}</div>` : ""}
            </div>`
          )
          .join("")}
      </div>
    </section>

    <div style="height:14px"></div>

    <section class="card">
      <h2 style="margin:0 0 14px">Proof</h2>
      ${proof.length ? `<div>${proof.map((b) => `<span class="pill">${escapeHtml(b)}</span>`).join("")}</div>` : `<div class="muted">No proof items</div>`}
    </section>

    <div style="height:14px"></div>

    <section class="card">
      <h2 style="margin:0 0 14px">FAQ</h2>
      <div class="grid">
        ${faq
          .map(
            (f) => `<details>
              <summary>${escapeHtml(f.q)}</summary>
              <div class="muted" style="margin-top:8px">${escapeHtml(f.a)}</div>
            </details>`
          )
          .join("")}
      </div>
    </section>

    <div style="height:14px"></div>

    <section id="contact" class="card" style="background:linear-gradient(90deg, rgba(37,99,235,.18), rgba(255,255,255,.03), rgba(16,185,129,.12))">
      <h2 style="margin:0 0 8px">${escapeHtml(cta.headline)}</h2>
      ${cta.desc ? `<p class="muted" style="margin:0 0 14px">${escapeHtml(cta.desc)}</p>` : ""}
      <a class="btn2" href="#">${escapeHtml(cta.cta)}</a>
    </section>
  </div>
</body>
</html>`;

  return html;
}

function schemaToScriptTag(schemaRaw: any) {
  if (!schemaRaw) return "";
  const json = safeJsonStringify(schemaRaw, 2);
  if (!json || json === "null") return "";
  return `<script type="application/ld+json">\n${json}\n</script>`;
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

  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Copy-mode editable draft (client only)
  const [draft, setDraft] = useState<NormalizedHomepage | null>(null);

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

  const normalized = useMemo(() => normalizeContent(data), [data]);

  // When new data arrives, initialize draft
  React.useEffect(() => {
    if (normalized?.homepage) setDraft(normalized.homepage);
    else setDraft(null);
  }, [normalized?.homepage]);

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

  const homepage = viewMode === "copy" ? draft : normalized?.homepage;

  // Export helpers
  const exportMarkdown = normalized ? toMarkdown({ ...normalized, homepage: homepage ?? normalized.homepage }) : "";
  const exportHtml = normalized ? toHtml({ ...normalized, homepage: homepage ?? normalized.homepage }) : "";
  const exportSchemaScript = normalized ? schemaToScriptTag(normalized.schema.raw) : "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Content Builder Agent</h1>
          <p className="text-white/60">
            Crawl → generate homepage + service pages + meta + schema (English default).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TogglePill value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <Card
        title="Inputs"
        right={
          <div className="flex items-center gap-2">
            {normalized?.rawResult ? (
              <CopyButton text={safeJsonStringify(normalized.rawResult, 2)} />
            ) : null}
          </div>
        }
      >
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
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
            <div className="text-xs text-white/60 flex flex-wrap items-center gap-2">
              <Badge>OpenAI key: {String(Boolean(data.diagnostics?.hasOpenAIKey))}</Badge>
              <Badge>Pages: {Number(data.diagnostics?.pagesCrawled ?? 0)}</Badge>
              <Badge>Services: {serviceFocus.length}</Badge>
              <Badge>Mode: {viewMode === "preview" ? "Preview" : "Copy"}</Badge>
            </div>
          ) : null}

          {normalized ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <CopyButton text={exportMarkdown} />
              <CopyButton text={exportHtml} />
              <CopyButton text={exportSchemaScript || safeJsonStringify(normalized.schema.raw, 2)} />
              <div className="text-xs text-white/40">
                Copy: Markdown • HTML • Schema
              </div>
            </div>
          ) : null}
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data?.error && (
        <Card title="Error">
          <div className="text-red-300 text-sm">{data.error}</div>
        </Card>
      )}

      {normalized && homepage && (
        <>
          <Card
            title="Generated Website Preview"
            right={
              <div className="flex items-center gap-2">
                <Badge>Language: {normalized.language}</Badge>
                <Badge>Tone: {normalized.tone || "—"}</Badge>
              </div>
            }
          >
            {viewMode === "preview" ? (
              <div className="space-y-4">
                <PreviewHero hero={homepage.hero} />
                <PreviewServices services={homepage.services} />
                <PreviewProcess steps={homepage.process} />
                <PreviewProof bullets={homepage.proof.bullets} />
                <PreviewFaq items={homepage.faq} />
                <PreviewCta cta={homepage.cta} />
              </div>
            ) : (
              <div className="space-y-4">
                <SectionShell
                  label="Edit HERO"
                  right={<CopyButton text={safeJsonStringify(homepage.hero, 2)} />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InputField
                      label="Headline"
                      value={homepage.hero.headline}
                      onChange={(v) =>
                        setDraft((d) =>
                          d
                            ? { ...d, hero: { ...d.hero, headline: v } }
                            : null
                        )
                      }
                    />
                    <InputField
                      label="Primary CTA"
                      value={homepage.hero.ctaPrimary}
                      onChange={(v) =>
                        setDraft((d) =>
                          d
                            ? { ...d, hero: { ...d.hero, ctaPrimary: v } }
                            : null
                        )
                      }
                    />
                    <TextAreaField
                      label="Subheadline"
                      value={homepage.hero.subheadline}
                      onChange={(v) =>
                        setDraft((d) =>
                          d
                            ? { ...d, hero: { ...d.hero, subheadline: v } }
                            : null
                        )
                      }
                      rows={3}
                    />
                    <div className="space-y-2">
                      <InputField
                        label="Secondary CTA"
                        value={homepage.hero.ctaSecondary}
                        onChange={(v) =>
                          setDraft((d) =>
                            d
                              ? { ...d, hero: { ...d.hero, ctaSecondary: v } }
                              : null
                          )
                        }
                      />
                      <TextAreaField
                        label="Bullets (one per line)"
                        value={homepage.hero.bullets.join("\n")}
                        onChange={(v) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  hero: {
                                    ...d.hero,
                                    bullets: v
                                      .split("\n")
                                      .map((x) => x.trim())
                                      .filter(Boolean)
                                      .slice(0, 10),
                                  },
                                }
                              : null
                          )
                        }
                        rows={4}
                      />
                    </div>
                  </div>
                </SectionShell>

                <SectionShell
                  label="Edit SERVICES"
                  right={<CopyButton text={safeJsonStringify(homepage.services, 2)} />}
                >
                  {homepage.services.length === 0 ? (
                    <div className="text-white/60 text-sm">No services to edit.</div>
                  ) : (
                    <div className="space-y-3">
                      {homepage.services.map((s, idx) => (
                        <div
                          key={`${s.title}-${idx}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white font-semibold">Service #{idx + 1}</div>
                            <CopyButton text={safeJsonStringify(s, 2)} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <InputField
                              label="Title"
                              value={s.title}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.services];
                                  next[idx] = { ...next[idx], title: v };
                                  return { ...d, services: next };
                                })
                              }
                            />
                            <TextAreaField
                              label="Description"
                              value={s.desc}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.services];
                                  next[idx] = { ...next[idx], desc: v };
                                  return { ...d, services: next };
                                })
                              }
                              rows={3}
                            />
                            <div className="md:col-span-2">
                              <TextAreaField
                                label="Outcomes (one per line)"
                                value={s.outcomes.join("\n")}
                                onChange={(v) =>
                                  setDraft((d) => {
                                    if (!d) return null;
                                    const next = [...d.services];
                                    next[idx] = {
                                      ...next[idx],
                                      outcomes: v
                                        .split("\n")
                                        .map((x) => x.trim())
                                        .filter(Boolean)
                                        .slice(0, 10),
                                    };
                                    return { ...d, services: next };
                                  })
                                }
                                rows={4}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionShell>

                <SectionShell
                  label="Edit PROCESS"
                  right={<CopyButton text={safeJsonStringify(homepage.process, 2)} />}
                >
                  {homepage.process.length === 0 ? (
                    <div className="text-white/60 text-sm">No process steps to edit.</div>
                  ) : (
                    <div className="space-y-3">
                      {homepage.process.map((p, idx) => (
                        <div
                          key={`${p.title}-${idx}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white font-semibold">Step #{idx + 1}</div>
                            <CopyButton text={safeJsonStringify(p, 2)} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <InputField
                              label="Title"
                              value={p.title}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.process];
                                  next[idx] = { ...next[idx], title: v };
                                  return { ...d, process: next };
                                })
                              }
                            />
                            <TextAreaField
                              label="Description"
                              value={p.desc}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.process];
                                  next[idx] = { ...next[idx], desc: v };
                                  return { ...d, process: next };
                                })
                              }
                              rows={3}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionShell>

                <SectionShell
                  label="Edit PROOF"
                  right={<CopyButton text={safeJsonStringify(homepage.proof, 2)} />}
                >
                  <TextAreaField
                    label="Proof bullets (one per line)"
                    value={homepage.proof.bullets.join("\n")}
                    onChange={(v) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              proof: {
                                bullets: v
                                  .split("\n")
                                  .map((x) => x.trim())
                                  .filter(Boolean)
                                  .slice(0, 16),
                              },
                            }
                          : null
                      )
                    }
                    rows={6}
                  />
                </SectionShell>

                <SectionShell
                  label="Edit FAQ"
                  right={<CopyButton text={safeJsonStringify(homepage.faq, 2)} />}
                >
                  {homepage.faq.length === 0 ? (
                    <div className="text-white/60 text-sm">No FAQ items to edit.</div>
                  ) : (
                    <div className="space-y-3">
                      {homepage.faq.map((f, idx) => (
                        <div
                          key={`${f.q}-${idx}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white font-semibold">FAQ #{idx + 1}</div>
                            <CopyButton text={safeJsonStringify(f, 2)} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <TextAreaField
                              label="Question"
                              value={f.q}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.faq];
                                  next[idx] = { ...next[idx], q: v };
                                  return { ...d, faq: next };
                                })
                              }
                              rows={2}
                            />
                            <TextAreaField
                              label="Answer"
                              value={f.a}
                              onChange={(v) =>
                                setDraft((d) => {
                                  if (!d) return null;
                                  const next = [...d.faq];
                                  next[idx] = { ...next[idx], a: v };
                                  return { ...d, faq: next };
                                })
                              }
                              rows={4}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionShell>

                <SectionShell
                  label="Edit CTA"
                  right={<CopyButton text={safeJsonStringify(homepage.cta, 2)} />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InputField
                      label="CTA Headline"
                      value={homepage.cta.headline}
                      onChange={(v) =>
                        setDraft((d) =>
                          d ? { ...d, cta: { ...d.cta, headline: v } } : null
                        )
                      }
                    />
                    <InputField
                      label="CTA Button"
                      value={homepage.cta.cta}
                      onChange={(v) =>
                        setDraft((d) =>
                          d ? { ...d, cta: { ...d.cta, cta: v } } : null
                        )
                      }
                    />
                    <div className="md:col-span-2">
                      <TextAreaField
                        label="CTA Description"
                        value={homepage.cta.desc}
                        onChange={(v) =>
                          setDraft((d) =>
                            d ? { ...d, cta: { ...d.cta, desc: v } } : null
                          )
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                </SectionShell>

                <Card
                  title="Export (from your current edits)"
                  right={
                    <div className="flex items-center gap-2">
                      <CopyButton text={exportMarkdown} />
                      <CopyButton text={exportHtml} />
                      <CopyButton text={exportSchemaScript || safeJsonStringify(normalized.schema.raw, 2)} />
                    </div>
                  }
                  subtle
                >
                  <div className="text-white/60 text-sm">
                    Use the buttons to copy Markdown, HTML, or Schema (JSON-LD script tag). Your edits are included.
                  </div>
                </Card>
              </div>
            )}
          </Card>

          <Card
            title="Schema (pretty)"
            right={
              <div className="flex items-center gap-2">
                <CopyButton text={exportSchemaScript || safeJsonStringify(normalized.schema.raw, 2)} />
              </div>
            }
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-white/80 text-xs font-semibold mb-2">
                JSON-LD script tag (ready to paste into &lt;head&gt;)
              </div>
              <pre className="text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                {exportSchemaScript || "// No schema returned"}
              </pre>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-white/80 text-xs font-semibold mb-2">Raw schema object</div>
              <pre className="text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                {safeJsonStringify(normalized.schema.raw, 2)}
              </pre>
            </div>
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