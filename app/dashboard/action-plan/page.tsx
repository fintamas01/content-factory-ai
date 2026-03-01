// app/dashboard/action-plan/page.tsx
"use client";

import React, { useMemo, useState } from "react";

type ActionPlanResponse = {
  url: string;
  domain?: string;
  crawlSummary?: {
    seedUrl?: string;
    targetDomain?: string;
    pageCount?: number;
    maxPages?: number;
    timeoutMsPerPage?: number;
  };
  scoreBefore: number;
  estimatedScoreAfter: number;
  scoreParts: any;
  tasks: any[];
  schemaSnippets: any[];
  copyBlocks: any[];
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

function normalizeResponse(raw: any): ActionPlanResponse | null {
  if (!raw) return null;

  if (!isRecord(raw)) {
    return {
      url: "",
      scoreBefore: 0,
      estimatedScoreAfter: 0,
      scoreParts: {},
      tasks: [],
      schemaSnippets: [],
      copyBlocks: [],
      diagnostics: { raw },
      error: "Invalid response shape (not an object).",
    };
  }

  return {
    url: typeof raw.url === "string" ? raw.url : "",
    domain: typeof raw.domain === "string" ? raw.domain : undefined,
    crawlSummary: isRecord(raw.crawlSummary) ? raw.crawlSummary : undefined,
    scoreBefore: typeof raw.scoreBefore === "number" ? raw.scoreBefore : Number(raw.scoreBefore ?? 0),
    estimatedScoreAfter:
      typeof raw.estimatedScoreAfter === "number"
        ? raw.estimatedScoreAfter
        : Number(raw.estimatedScoreAfter ?? 0),
    scoreParts: raw.scoreParts ?? {},
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    schemaSnippets: Array.isArray(raw.schemaSnippets) ? raw.schemaSnippets : [],
    copyBlocks: Array.isArray(raw.copyBlocks) ? raw.copyBlocks : [],
    diagnostics: raw.diagnostics ?? undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
  };
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

export default function ActionPlanPage() {
  const [url, setUrl] = useState("futuretechapps.ro");
  const [maxPages, setMaxPages] = useState(7);
  const [timeoutMsPerPage, setTimeoutMsPerPage] = useState(7000);

  // Company facts (optional) to avoid hallucinated snippets
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [streetAddress, setStreetAddress] = useState("");
  const [addressLocality, setAddressLocality] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressCountry, setAddressCountry] = useState("RO");

  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [x, setX] = useState("");
  const [threads, setThreads] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ActionPlanResponse | null>(null);

  const canRun = useMemo(() => {
    if (loading) return false;
    return url.trim().length > 0;
  }, [url, loading]);

  const companyFacts = useMemo(() => {
    // Only send if any field filled
    const any =
      companyName.trim() ||
      legalName.trim() ||
      logoUrl.trim() ||
      email.trim() ||
      phone.trim() ||
      streetAddress.trim() ||
      addressLocality.trim() ||
      addressRegion.trim() ||
      postalCode.trim() ||
      addressCountry.trim() ||
      facebook.trim() ||
      instagram.trim() ||
      linkedin.trim() ||
      tiktok.trim() ||
      youtube.trim() ||
      x.trim() ||
      threads.trim();

    if (!any) return null;

    return {
      name: companyName.trim() || undefined,
      legalName: legalName.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: {
        streetAddress: streetAddress.trim() || undefined,
        addressLocality: addressLocality.trim() || undefined,
        addressRegion: addressRegion.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        addressCountry: addressCountry.trim() || undefined,
      },
      socials: {
        facebook: facebook.trim() || undefined,
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        youtube: youtube.trim() || undefined,
        x: x.trim() || undefined,
        threads: threads.trim() || undefined,
      },
    };
  }, [
    companyName,
    legalName,
    logoUrl,
    email,
    phone,
    streetAddress,
    addressLocality,
    addressRegion,
    postalCode,
    addressCountry,
    facebook,
    instagram,
    linkedin,
    tiktok,
    youtube,
    x,
    threads,
  ]);

  async function run() {
    setErr(null);
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          maxPages,
          timeoutMsPerPage,
          companyFacts: companyFacts ?? undefined,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          (isRecord(json) && (json.error || json.message || json.details)) || "Request failed";
        throw new Error(String(message));
      }

      const normalized = normalizeResponse(json);
      setData(normalized);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const tasks = data?.tasks ?? [];
  const schemaSnippets = data?.schemaSnippets ?? [];
  const crawlPages = Number(data?.diagnostics?.pagesCrawled ?? data?.crawlSummary?.pageCount ?? 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Action Plan Agent</h1>
        <p className="text-white/60">
          Multi-page crawl → determinisztikus GEO score → priorizált teendők + JSON-LD snippetek.
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

        <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-white/80 font-semibold">
            Company facts (optional) — to avoid placeholders in snippets
          </summary>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/60">Company name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="FutureTech Apps"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Legal name</label>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="FutureTech Applications Î.I."
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Logo URL</label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="+40 ..."
              />
            </div>
          </div>

          <div className="mt-4 text-white/60 text-xs font-semibold">Address (optional)</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/60">Street</label>
              <input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="Strada ..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">City</label>
              <input
                value={addressLocality}
                onChange={(e) => setAddressLocality(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="Târgu Mureș"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Region</label>
              <input
                value={addressRegion}
                onChange={(e) => setAddressRegion(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="Mureș"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Postal code</label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="000000"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Country</label>
              <input
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="RO"
              />
            </div>
          </div>

          <div className="mt-4 text-white/60 text-xs font-semibold">Social links (optional)</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-white/60">Facebook</label>
              <input
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Instagram</label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">LinkedIn</label>
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://linkedin.com/company/..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">TikTok</label>
              <input
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://tiktok.com/@..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">YouTube</label>
              <input
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://youtube.com/..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">X / Twitter</label>
              <input
                value={x}
                onChange={(e) => setX(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://x.com/..."
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Threads</label>
              <input
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white"
                placeholder="https://threads.net/@..."
              />
            </div>
          </div>
        </details>

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
            {loading ? "Running..." : "Generate Action Plan"}
          </button>

          {data?.diagnostics ? (
            <div className="text-xs text-white/60 flex items-center gap-2 flex-wrap">
              <Badge>OpenAI key: {String(Boolean(data.diagnostics?.hasOpenAIKey))}</Badge>
              <Badge>Pages: {crawlPages}</Badge>
              {data?.crawlSummary?.targetDomain ? <Badge>Domain: {String(data.crawlSummary.targetDomain)}</Badge> : null}
            </div>
          ) : null}
        </div>

        {err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </Card>

      {data && (
        <>
          {data.error && (
            <Card title="Info / Error">
              <div className="text-red-300 text-sm whitespace-pre-wrap">{data.error}</div>

              {Array.isArray(data?.diagnostics?.crawlErrors) && data.diagnostics.crawlErrors.length > 0 ? (
                <div className="mt-3">
                  <div className="text-white/70 text-xs font-semibold mb-2">Crawl errors</div>
                  <pre className="text-xs text-white/70 whitespace-pre-wrap overflow-auto">
                    {safeJsonStringify(data.diagnostics.crawlErrors, 2)}
                  </pre>
                </div>
              ) : null}
            </Card>
          )}

          <Card
            title="Scores"
            right={<CopyButton text={safeJsonStringify({ scoreParts: data.scoreParts }, 2)} />}
          >
            <div className="flex flex-wrap gap-2">
              <Badge>Before: {data.scoreBefore}/100</Badge>
              <Badge>After (est.): {data.estimatedScoreAfter}/100</Badge>
              <Badge>Pages crawled: {crawlPages}</Badge>
            </div>
            <pre className="mt-3 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
              {safeJsonStringify(data.scoreParts, 2)}
            </pre>
          </Card>

          <Card
            title={`Tasks (${tasks.length})`}
            right={<CopyButton text={safeJsonStringify(tasks, 2)} />}
          >
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((t: any, idx: number) => (
                  <div key={t?.id ?? idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">
                          {String(t?.priority ?? "P?")} — {String(t?.title ?? `Task ${idx + 1}`)}
                        </div>
                        <div className="text-white/60 text-xs mt-1">
                          impact: {String(t?.impact ?? "?")}/10 • effort: {String(t?.effort ?? "?")}/10
                        </div>
                      </div>
                      <CopyButton text={safeJsonStringify(t, 2)} />
                    </div>

                    {Array.isArray(t?.steps) && t.steps.length > 0 && (
                      <ul className="list-disc pl-5 text-white/70 text-sm mt-3 space-y-1">
                        {t.steps.map((s: any, i: number) => (
                          <li key={i}>{String(s)}</li>
                        ))}
                      </ul>
                    )}

                    {Array.isArray(t?.codeSnippets) && t.codeSnippets.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {t.codeSnippets.map((sn: any, i: number) => (
                          <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-white/80 text-xs font-semibold">
                                {String(sn?.label ?? "Snippet")}
                              </div>
                              <CopyButton text={String(sn?.code ?? "")} />
                            </div>
                            <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                              {String(sn?.code ?? "")}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(t?.evidence) && t.evidence.length > 0 && (
                      <details className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
                        <summary className="cursor-pointer text-white/70 text-xs font-semibold">
                          Evidence
                        </summary>
                        <pre className="mt-2 text-xs text-white/70 whitespace-pre-wrap overflow-auto">
                          {safeJsonStringify(t.evidence, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">Nincs task.</div>
            )}
          </Card>

          <Card title={`Schema snippets (${schemaSnippets.length})`}>
            {schemaSnippets.length > 0 ? (
              <div className="space-y-3">
                {schemaSnippets.map((s: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white font-semibold">{String(s?.type ?? "Schema")}</div>
                      <CopyButton text={safeJsonStringify(s?.jsonLd ?? {}, 2)} />
                    </div>
                    <div className="text-white/60 text-xs mt-1">{String(s?.whereToPlace ?? "")}</div>
                    <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap overflow-auto">
                      {safeJsonStringify(s?.jsonLd ?? {}, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60 text-sm">Nincs schema snippet.</div>
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