// app/api/ai-agent/action-plan/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toUrl(input: string) {
  const s = (input ?? "").trim();
  if (!s) throw new Error("Empty url");
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function toHostname(inputUrl: string) {
  try {
    const u = new URL(toUrl(inputUrl));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return (inputUrl ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function isSameDomain(url: string, domain: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === domain || h.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function normalizeWhitespace(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 4000) {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function extractEmails(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((m ?? []).map((x) => x.toLowerCase()))).slice(0, 10);
}

function extractPhones(text: string) {
  const m = text.match(
    /(\+\d{1,3}\s?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g
  );
  const cleaned = (m ?? [])
    .map((x) => normalizeWhitespace(x))
    .filter((x) => x.replace(/\D/g, "").length >= 8)
    .slice(0, 12);
  return Array.from(new Set(cleaned));
}

function extractSocialLinks($: cheerio.CheerioAPI, baseUrl: string) {
  const socials: string[] = [];
  const socialHosts = [
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "linkedin.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "threads.net",
  ];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;

    let abs = href;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    try {
      const h = new URL(abs).hostname.replace(/^www\./, "");
      if (socialHosts.some((sh) => h === sh || h.endsWith(`.${sh}`))) socials.push(abs);
    } catch {
      // ignore
    }
  });

  return Array.from(new Set(socials)).slice(0, 12);
}

function pickInternalLinks($: cheerio.CheerioAPI, baseUrl: string, targetDomain: string) {
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;

    if (href.startsWith("#")) return;
    if (href.startsWith("mailto:")) return;
    if (href.startsWith("tel:")) return;
    if (href.startsWith("javascript:")) return;

    let abs = "";
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (!isSameDomain(abs, targetDomain)) return;
    if (/\.(jpg|jpeg|png|webp|svg|pdf|zip|rar|mp4|mp3)$/i.test(abs)) return;

    abs = abs.replace(/\/$/, "");
    links.push(abs);
  });

  return Array.from(new Set(links));
}

type OnDomainPage = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  hasJsonLd: boolean;
  hasSchemaOrgMicrodata: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  extractedText: string;
  rawTextLength: number;
  foundEmails: string[];
  foundPhones: string[];
  foundAddressesLike: string[];
  foundCityOrRegionLike: string[];
  socialLinks: string[];
};

type CrawlContext = {
  targetDomain: string;
  seedUrl: string;
  pages: OnDomainPage[];
  pageCount: number;
};

type ScorePartKey =
  | "meta"
  | "structuredData"
  | "headings"
  | "contact"
  | "geo"
  | "social"
  | "textVolume";

type ScorePart = { score: number; max: number; notes: string[] };
type ScoreParts = Record<ScorePartKey, ScorePart>;

const SCORE_KEYS: ScorePartKey[] = [
  "meta",
  "structuredData",
  "headings",
  "contact",
  "geo",
  "social",
  "textVolume",
];

function emptyPart(max = 0): ScorePart {
  return { score: 0, max, notes: [] };
}

/**
 * IMPORTANT: even if crawl fails, we want max values set so UI won't show weird 0/0.
 */
function initScoreParts(): ScoreParts {
  return {
    meta: emptyPart(20),
    structuredData: emptyPart(20),
    headings: emptyPart(15),
    contact: emptyPart(15),
    geo: emptyPart(10),
    social: emptyPart(10),
    textVolume: emptyPart(10),
  };
}

function sumScore(parts: ScoreParts) {
  const total = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.score ?? 0), 0);
  const max = SCORE_KEYS.reduce((acc, k) => acc + (parts[k]?.max ?? 0), 0);
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return { total, max, pct };
}

async function fetchHtml(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentFactoryBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        url,
        html: "",
        error: `Fetch failed: ${res.status}`,
      };
    }

    const html = await res.text();
    return { ok: true as const, status: 200, url, html, error: null as string | null };
  } catch (e: any) {
    return {
      ok: false as const,
      status: 0,
      url,
      html: "",
      error: `Fetch error: ${String(e?.message ?? e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseOnDomainPage(url: string, html: string): OnDomainPage {
  const $ = cheerio.load(html);

  const title = normalizeWhitespace($("title").first().text() || "") || null;
  const metaDescription =
    normalizeWhitespace($('meta[name="description"]').attr("content") || "") || null;

  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;

  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasSchemaOrgMicrodata =
    $('[itemscope]').length > 0 || /https?:\/\/schema\.org/i.test(html);

  const h1 = $("h1")
    .slice(0, 6)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h2 = $("h2")
    .slice(0, 10)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const h3 = $("h3")
    .slice(0, 10)
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  $("script,noscript,style,svg").remove();

  const mainCandidates = ["main", "#content", ".site-content", ".entry-content", ".elementor", "body"];
  let bestText = "";
  for (const sel of mainCandidates) {
    const t = normalizeWhitespace($(sel).text());
    if (t && t.length > bestText.length) bestText = t;
  }

  const extractedText = truncate(
    [
      title ? `TITLE: ${title}` : "",
      metaDescription ? `META_DESCRIPTION: ${metaDescription}` : "",
      h1.length ? `H1: ${h1.join(" | ")}` : "",
      h2.length ? `H2: ${h2.join(" | ")}` : "",
      h3.length ? `H3: ${h3.join(" | ")}` : "",
      bestText ? `BODY_TEXT: ${bestText}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    5000
  );

  const foundEmails = extractEmails(bestText);
  const foundPhones = extractPhones(bestText);

  const addressLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) =>
      /utca|strada|street|nr\.|no\.|bl\.|ap\.|jud|county|romania|magyarország|ország/i.test(s)
    )
    .slice(0, 6);

  const cityRegionLike = bestText
    .split(".")
    .map((s) => normalizeWhitespace(s))
    .filter((s) =>
      /sepsi|târgu|maros|kolozsvár|cluj|bucharest|budapest|szatmár|românia|romania/i.test(s)
    )
    .slice(0, 6);

  const socialLinks = extractSocialLinks($, url);

  return {
    url,
    title,
    metaDescription,
    headings: { h1, h2, h3 },
    hasJsonLd,
    hasSchemaOrgMicrodata,
    hasOpenGraph,
    hasTwitterCard,
    extractedText,
    rawTextLength: bestText.length,
    foundEmails,
    foundPhones,
    foundAddressesLike: addressLike,
    foundCityOrRegionLike: cityRegionLike,
    socialLinks,
  };
}

async function crawlOnDomain(args: {
  seedUrl: string;
  targetDomain: string;
  maxPages: number;
  timeoutMsPerPage: number;
}): Promise<{ crawl: CrawlContext; errors: Array<{ url: string; error: string }> }> {
  const seed = toUrl(args.seedUrl).replace(/\/$/, "");
  const seen = new Set<string>();
  const queue: string[] = [seed];
  const pages: OnDomainPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  while (queue.length && pages.length < args.maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const fetched = await fetchHtml(url, args.timeoutMsPerPage);
    if (!fetched.ok) {
      errors.push({ url, error: fetched.error ?? "Unknown fetch error" });
      continue;
    }

    const page = parseOnDomainPage(url, fetched.html);
    pages.push(page);

    try {
      const $ = cheerio.load(fetched.html);
      const links = pickInternalLinks($, url, args.targetDomain);
      for (const l of links.slice(0, 25)) {
        if (!seen.has(l)) queue.push(l);
      }
    } catch {
      // ignore
    }
  }

  return {
    crawl: {
      targetDomain: args.targetDomain,
      seedUrl: seed,
      pages,
      pageCount: pages.length,
    },
    errors,
  };
}

function buildScorePartsFromCrawl(crawl: CrawlContext): ScoreParts {
  const parts = initScoreParts();
  const pages = crawl.pages;

  const anyTitle = pages.some((p) => (p.title ?? "").length > 0);
  const anyMetaDesc = pages.some((p) => (p.metaDescription ?? "").length > 0);
  const anyOg = pages.some((p) => p.hasOpenGraph);
  const anyTw = pages.some((p) => p.hasTwitterCard);

  let metaScore = 0;
  if (anyTitle) metaScore += 8;
  else parts.meta.notes.push("Missing <title> on sampled pages.");

  if (anyMetaDesc) metaScore += 8;
  else parts.meta.notes.push("Missing meta description on sampled pages.");

  if (anyOg) metaScore += 2;
  else parts.meta.notes.push("No Open Graph meta tags detected.");

  if (anyTw) metaScore += 2;
  else parts.meta.notes.push("No Twitter Card meta tags detected.");

  parts.meta.score = metaScore;

  const anyJsonLd = pages.some((p) => p.hasJsonLd);
  const anyMicrodata = pages.some((p) => p.hasSchemaOrgMicrodata);

  let sdScore = 0;
  if (anyJsonLd) sdScore += 12;
  else parts.structuredData.notes.push("No JSON-LD (application/ld+json) detected.");

  if (anyMicrodata) sdScore += 8;
  else parts.structuredData.notes.push("No schema.org microdata/itemscope detected.");

  parts.structuredData.score = sdScore;

  const anyH1 = pages.some((p) => p.headings.h1.length > 0);
  const anyH2 = pages.some((p) => p.headings.h2.length > 0);

  let headingScore = 0;
  if (anyH1) headingScore += 8;
  else parts.headings.notes.push("No H1 detected on sampled pages.");

  if (anyH2) headingScore += 7;
  else parts.headings.notes.push("No H2 headings detected (weak content structure).");

  parts.headings.score = headingScore;

  const emails = Array.from(new Set(pages.flatMap((p) => p.foundEmails)));
  const phones = Array.from(new Set(pages.flatMap((p) => p.foundPhones)));

  let contactScore = 0;
  if (emails.length > 0) contactScore += 7;
  else parts.contact.notes.push("No email detected on sampled pages.");

  if (phones.length > 0) contactScore += 6;
  else parts.contact.notes.push("No phone number detected on sampled pages.");

  const hasContactPage = pages.some((p) => /kapcsolat|contact|impressum|about/i.test(p.url));
  if (hasContactPage) contactScore += 2;
  else parts.contact.notes.push("No obvious contact/about page found in sampled URLs.");

  parts.contact.score = Math.min(parts.contact.max, contactScore);

  const addressLike = Array.from(new Set(pages.flatMap((p) => p.foundAddressesLike))).filter(Boolean);
  const cityLike = Array.from(new Set(pages.flatMap((p) => p.foundCityOrRegionLike))).filter(Boolean);

  let geoScore = 0;
  if (addressLike.length > 0) geoScore += 6;
  else parts.geo.notes.push("No address-like text detected (street/number/county).");

  if (cityLike.length > 0) geoScore += 4;
  else parts.geo.notes.push("No city/region hints detected in text.");

  parts.geo.score = geoScore;

  const socialLinks = Array.from(new Set(pages.flatMap((p) => p.socialLinks)));

  let socialScore = 0;
  if (socialLinks.length >= 1) socialScore += 6;
  else parts.social.notes.push("No social profile links detected.");

  if (socialLinks.length >= 3) socialScore += 4;
  else parts.social.notes.push("Add more official social links (FB/IG/LinkedIn) in footer/header.");

  parts.social.score = Math.min(parts.social.max, socialScore);

  const totalText = pages.reduce((acc, p) => acc + (p.rawTextLength || 0), 0);
  const avgText = pages.length ? Math.round(totalText / pages.length) : 0;

  let tvScore = 0;
  if (avgText >= 2500) tvScore = 10;
  else if (avgText >= 1500) tvScore = 7;
  else if (avgText >= 800) tvScore = 4;
  else {
    tvScore = 1;
    parts.textVolume.notes.push("Very low on-page text volume; add clearer service descriptions & sections.");
  }
  parts.textVolume.score = tvScore;

  return parts;
}

function buildEvidence(crawl: CrawlContext) {
  return crawl.pages.slice(0, 6).map((p) => ({
    url: p.url,
    quote: truncate(p.extractedText.replace(/^BODY_TEXT:\s*/i, ""), 500),
  }));
}

type CompanyFacts = {
  name?: string;
  legalName?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  socials?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    tiktok?: string;
    youtube?: string;
    x?: string;
    threads?: string;
  };
};

function cleanStr(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : undefined;
}

function parseCompanyFacts(input: any): CompanyFacts | null {
  if (!input || typeof input !== "object") return null;

  const addressIn = (input.address && typeof input.address === "object") ? input.address : {};
  const socialsIn = (input.socials && typeof input.socials === "object") ? input.socials : {};

  const facts: CompanyFacts = {
    name: cleanStr(input.name),
    legalName: cleanStr(input.legalName),
    logoUrl: cleanStr(input.logoUrl),
    email: cleanStr(input.email),
    phone: cleanStr(input.phone),
    address: {
      streetAddress: cleanStr(addressIn.streetAddress),
      addressLocality: cleanStr(addressIn.addressLocality),
      addressRegion: cleanStr(addressIn.addressRegion),
      postalCode: cleanStr(addressIn.postalCode),
      addressCountry: cleanStr(addressIn.addressCountry),
    },
    socials: {
      facebook: cleanStr(socialsIn.facebook),
      instagram: cleanStr(socialsIn.instagram),
      linkedin: cleanStr(socialsIn.linkedin),
      tiktok: cleanStr(socialsIn.tiktok),
      youtube: cleanStr(socialsIn.youtube),
      x: cleanStr(socialsIn.x),
      threads: cleanStr(socialsIn.threads),
    },
  };

  // If everything empty, treat as null
  const any =
    facts.name ||
    facts.legalName ||
    facts.logoUrl ||
    facts.email ||
    facts.phone ||
    Object.values(facts.address ?? {}).some(Boolean) ||
    Object.values(facts.socials ?? {}).some(Boolean);

  return any ? facts : null;
}

type ActionTask = {
  id: string;
  priority: "P0" | "P1" | "P2";
  title: string;
  impact: number; // 1..10
  effort: number; // 1..10
  steps: string[];
  acceptanceCriteria: string[];
  filesToChange: string[];
  codeSnippets: Array<{ label: string; code: string }>;
  evidence?: Array<{ url: string; quote: string }>;
};

function jsonLdScriptTag(obj: any) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

function buildDeterministicTasks(args: {
  seedUrl: string;
  domain: string;
  scoreParts: ScoreParts;
  evidence: Array<{ url: string; quote: string }>;
  pagesCrawled: number;
  crawlErrors: Array<{ url: string; error: string }>;
  companyFacts: CompanyFacts | null;
}): { tasks: ActionTask[]; schemaSnippets: any[]; copyBlocks: any[]; estimatedScoreAfter: number } {
  const { seedUrl, domain, scoreParts, evidence, pagesCrawled, crawlErrors, companyFacts } = args;

  // If crawl failed: return only diagnostic task
  if (pagesCrawled === 0) {
    const task: ActionTask = {
      id: "crawl-failed",
      priority: "P0",
      title: "Crawl failed — fix fetch/timeout/WAF so analysis can run",
      impact: 10,
      effort: 3,
      steps: [
        "Try full URL format: https://example.com (not only domain).",
        "Increase timeout per page to 12000–15000ms.",
        "Set maxPages = 1 to test basic fetch first, then increase.",
        "If site is protected (Cloudflare/WAF), allowlist server IP or create a public endpoint.",
        "Check robots.txt / geo-blocking / hosting firewall rules.",
        "Inspect crawlErrors below to see which URLs failed and why.",
      ],
      acceptanceCriteria: [
        "pagesCrawled becomes > 0",
        "scoreParts are non-zero and tasks can be generated from real page evidence",
      ],
      filesToChange: [],
      codeSnippets: [],
      evidence: crawlErrors.slice(0, 6).map((e) => ({ url: e.url, quote: e.error })),
    };

    return {
      tasks: [task],
      schemaSnippets: [],
      copyBlocks: [],
      estimatedScoreAfter: sumScore(scoreParts).pct,
    };
  }

  const tasks: ActionTask[] = [];

  const orgName = companyFacts?.name ?? "REPLACE_WITH_COMPANY_NAME";
  const orgUrl = seedUrl;
  const logoUrl = companyFacts?.logoUrl ?? "REPLACE_WITH_LOGO_URL";
  const email = companyFacts?.email ?? "REPLACE_WITH_EMAIL";
  const phone = companyFacts?.phone ?? "REPLACE_WITH_PHONE";
  const socials = companyFacts?.socials ?? {};

  const sameAs = [
    socials.facebook ?? "REPLACE_WITH_FACEBOOK_URL",
    socials.instagram ?? "REPLACE_WITH_INSTAGRAM_URL",
    socials.linkedin ?? "REPLACE_WITH_LINKEDIN_URL",
  ];

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: orgName,
    url: orgUrl,
    logo: logoUrl,
    email,
    telephone: phone,
    sameAs,
  };

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: orgName,
    url: orgUrl,
    telephone: phone,
    email,
    address: {
      "@type": "PostalAddress",
      streetAddress: companyFacts?.address?.streetAddress ?? "REPLACE_WITH_STREET_ADDRESS",
      addressLocality: companyFacts?.address?.addressLocality ?? "REPLACE_WITH_CITY",
      addressRegion: companyFacts?.address?.addressRegion ?? "REPLACE_WITH_REGION",
      postalCode: companyFacts?.address?.postalCode ?? "REPLACE_WITH_POSTAL_CODE",
      addressCountry: companyFacts?.address?.addressCountry ?? "RO",
    },
    sameAs,
  };

  // Task: Structured Data
  if (scoreParts.structuredData.score < scoreParts.structuredData.max) {
    tasks.push({
      id: "add-jsonld",
      priority: "P0",
      title: "Add JSON-LD structured data (Organization / LocalBusiness)",
      impact: 10,
      effort: 2,
      steps: [
        "Decide which schema to use: Organization (general) and/or LocalBusiness (if you have a physical address).",
        "Fill in real company facts OR keep placeholders and replace them later.",
        "Insert JSON-LD script into <head> on homepage (and optionally on all pages via layout).",
        "Validate in Google Rich Results Test / Schema Markup Validator.",
      ],
      acceptanceCriteria: [
        "At least one application/ld+json script is present",
        "Validator reports no critical errors",
      ],
      filesToChange: ["app/layout.tsx (or homepage head)"],
      codeSnippets: [
        { label: "Organization JSON-LD (script tag)", code: jsonLdScriptTag(orgJsonLd) },
        { label: "LocalBusiness JSON-LD (script tag)", code: jsonLdScriptTag(localBusinessJsonLd) },
      ],
      evidence,
    });
  }

  // Task: Meta basics
  if (scoreParts.meta.score < scoreParts.meta.max) {
    tasks.push({
      id: "meta-basics",
      priority: "P1",
      title: "Improve meta tags: title, description, Open Graph, Twitter Card",
      impact: 8,
      effort: 3,
      steps: [
        "Ensure every page has a unique <title> and meta description.",
        "Add Open Graph tags: og:title, og:description, og:url, og:image.",
        "Add Twitter Card tags: twitter:card, twitter:title, twitter:description, twitter:image.",
        "If using Next.js app router, set metadata in layout/page files.",
      ],
      acceptanceCriteria: [
        "Meta title & description exist on sampled pages",
        "OG and Twitter meta tags present on homepage",
      ],
      filesToChange: ["app/layout.tsx", "app/(public)/page.tsx (or relevant pages)"],
      codeSnippets: [
        {
          label: "Example Next.js metadata (app router)",
          code: `export const metadata = {
  title: "${orgName} — REPLACE_WITH_VALUE_PROPOSITION",
  description: "REPLACE_WITH_META_DESCRIPTION",
  openGraph: {
    title: "${orgName} — REPLACE_WITH_VALUE_PROPOSITION",
    description: "REPLACE_WITH_META_DESCRIPTION",
    url: "${orgUrl}",
    images: ["REPLACE_WITH_OG_IMAGE_URL"],
  },
  twitter: {
    card: "summary_large_image",
    title: "${orgName} — REPLACE_WITH_VALUE_PROPOSITION",
    description: "REPLACE_WITH_META_DESCRIPTION",
    images: ["REPLACE_WITH_OG_IMAGE_URL"],
  },
};`,
        },
      ],
      evidence,
    });
  }

  // Task: Headings
  if (scoreParts.headings.score < scoreParts.headings.max) {
    tasks.push({
      id: "headings-structure",
      priority: "P0",
      title: "Fix heading structure (H1 + logical H2/H3 sections)",
      impact: 9,
      effort: 2,
      steps: [
        "Ensure exactly one clear H1 per page (especially homepage).",
        "Use H2 for major sections (Services, Process, Case Studies, Contact).",
        "Use H3 for items within sections (Service cards, FAQ items).",
      ],
      acceptanceCriteria: ["Homepage has one meaningful H1", "H2 sections exist for core content"],
      filesToChange: ["Homepage/landing component", "Service sections components"],
      codeSnippets: [
        {
          label: "Example heading skeleton",
          code: `<h1>REPLACE_WITH_MAIN_SERVICE + LOCATION</h1>
<h2>Services</h2>
  <h3>Web Development</h3>
  <h3>E-commerce Development</h3>
  <h3>Mobile Apps</h3>
<h2>Why ${orgName}?</h2>
<h2>Case Studies</h2>
<h2>Contact</h2>`,
        },
      ],
      evidence,
    });
  }

  // Task: Contact
  if (scoreParts.contact.score < scoreParts.contact.max) {
    tasks.push({
      id: "contact-footer",
      priority: "P0",
      title: "Add consistent contact info (header/footer + Contact page)",
      impact: 9,
      effort: 2,
      steps: [
        "Add email + phone in footer (and ideally in header).",
        "Create/verify /contact page and link it in navigation.",
        "Make email clickable (mailto) and phone clickable (tel).",
      ],
      acceptanceCriteria: ["Email and phone are visible on all pages", "Contact page exists and is linked"],
      filesToChange: ["Footer component", "Contact page"],
      codeSnippets: [
        {
          label: "Footer contact block (HTML example)",
          code: `<div class="footer-contact">
  <strong>${orgName}</strong><br/>
  Email: <a href="mailto:${email}">${email}</a><br/>
  Phone: <a href="tel:${phone}">${phone}</a><br/>
  <span>Address: REPLACE_WITH_ADDRESS</span>
</div>`,
        },
      ],
      evidence,
    });
  }

  // Task: Social
  if (scoreParts.social.score < scoreParts.social.max) {
    tasks.push({
      id: "social-links",
      priority: "P1",
      title: "Add official social links (footer/header) with icons",
      impact: 6,
      effort: 1,
      steps: [
        "Add Facebook/Instagram/LinkedIn icons with external links.",
        "Open in new tab and set rel='noopener noreferrer'.",
        "Use real URLs from Company facts OR keep placeholders and replace later.",
      ],
      acceptanceCriteria: ["At least 1–3 social links present on homepage/footer"],
      filesToChange: ["Footer component", "Header component"],
      codeSnippets: [
        {
          label: "Social links snippet",
          code: `<a href="${sameAs[0]}" target="_blank" rel="noopener noreferrer">Facebook</a>
<a href="${sameAs[1]}" target="_blank" rel="noopener noreferrer">Instagram</a>
<a href="${sameAs[2]}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`,
        },
      ],
      evidence,
    });
  }

  // Task: Text volume / service content
  if (scoreParts.textVolume.score < scoreParts.textVolume.max) {
    tasks.push({
      id: "service-content",
      priority: "P1",
      title: "Increase on-page service content (clear sections, FAQs, trust signals)",
      impact: 7,
      effort: 4,
      steps: [
        "Add a dedicated 'Services' section with 4–8 bullets per service.",
        "Add process steps: Discovery → Design → Build → Launch → Support.",
        "Add 3–6 FAQs and 2–3 case studies or examples.",
        "Add trust elements: testimonials, logos, certifications, locations served.",
      ],
      acceptanceCriteria: ["Homepage has meaningful service copy", "At least one content-rich section added"],
      filesToChange: ["Homepage sections", "Services page"],
      codeSnippets: [],
      evidence,
    });
  }

  // Task: Geo hints (if missing)
  if (scoreParts.geo.score < scoreParts.geo.max) {
    tasks.push({
      id: "geo-hints",
      priority: "P2",
      title: "Add clear GEO signals (location served, address, region keywords)",
      impact: 5,
      effort: 2,
      steps: [
        "Add 'Location served' text in hero/footer (e.g., Romania + main cities).",
        "Add address (if applicable) and embed map on Contact page.",
        "Use consistent NAP (Name/Address/Phone) formatting.",
      ],
      acceptanceCriteria: ["Site mentions location/region consistently", "Contact page includes address/map"],
      filesToChange: ["Homepage hero", "Footer", "Contact page"],
      codeSnippets: [],
      evidence,
    });
  }

  // Estimate after score (deterministic, conservative)
  const before = sumScore(scoreParts).pct;
  // naive uplift: each missing part adds up to its max difference proportionally, but keep cap 100
  const maxTotal = sumScore(scoreParts).max; // should be 100
  const missingTotal = SCORE_KEYS.reduce((acc, k) => acc + Math.max(0, (scoreParts[k].max ?? 0) - (scoreParts[k].score ?? 0)), 0);
  const potentialPct = maxTotal > 0 ? Math.round((missingTotal / maxTotal) * 100) : 0;
  const estimatedScoreAfter = Math.min(100, before + Math.round(potentialPct * 0.6)); // conservative 60% of potential

  const schemaSnippets = [
    { type: "Organization", whereToPlace: "Place in <head> of homepage (or global layout)", jsonLd: orgJsonLd },
    { type: "LocalBusiness", whereToPlace: "Place in <head> of homepage (if you have physical address)", jsonLd: localBusinessJsonLd },
  ];

  const copyBlocks = [
    {
      id: "hero-value-prop",
      label: "Hero value proposition (placeholder)",
      content:
        "REPLACE_WITH_VALUE_PROPOSITION. Example: 'Modern Web & Mobile Development in Romania — Fast delivery, clear communication, measurable results.'",
    },
  ];

  // Ensure at least 8 tasks by adding “nice to have” items (deterministic)
  while (tasks.length < 8) {
    const idx = tasks.length + 1;
    tasks.push({
      id: `nice-to-have-${idx}`,
      priority: "P2",
      title: "Add trust/UX improvements (testimonials, case studies, CTA clarity)",
      impact: 4,
      effort: 3,
      steps: [
        "Add 2–3 testimonials with name/company (or anonymized).",
        "Add a strong CTA button ('Request a quote') in hero and after services.",
        "Add a short portfolio/case studies section.",
      ],
      acceptanceCriteria: ["CTA is visible", "At least one trust section added"],
      filesToChange: ["Homepage sections"],
      codeSnippets: [],
      evidence,
    });
  }

  return { tasks, schemaSnippets, copyBlocks, estimatedScoreAfter };
}

async function buildActionPlanLLM(args: {
  url: string;
  scoreBefore: number;
  scoreParts: ScoreParts;
  evidence: Array<{ url: string; quote: string }>;
  deterministic: { tasks: ActionTask[]; schemaSnippets: any[]; copyBlocks: any[]; estimatedScoreAfter: number };
  companyFacts: CompanyFacts | null;
}) {
  // If no key, we won't call LLM (handled by caller)
  const system = `
You output STRICT JSON only. No markdown.

CRITICAL RULES:
- Do NOT invent company facts (phone/address/social/logo/email). If missing, keep placeholders like REPLACE_WITH_PHONE.
- Only mention concrete findings if supported by evidence quotes.
- You are allowed to refine titles/steps, add acceptance criteria, improve snippets formatting, and add copy suggestions.

Return JSON keys:
- estimatedScoreAfter (number)
- tasks (array)
- schemaSnippets (array)
- copyBlocks (array)

Keep existing deterministic tasks but you may reorder priorities (P0/P1/P2) and enhance.
Each task must follow:
{id,priority,title,impact,effort,steps[],acceptanceCriteria[],filesToChange[],codeSnippets[]}

schemaSnippets items must have jsonLd as an object (not a string).
`.trim();

  const user = {
    url: args.url,
    scoreBefore: args.scoreBefore,
    scoreParts: args.scoreParts,
    evidence: args.evidence,
    companyFacts: args.companyFacts, // may be null
    deterministic: args.deterministic,
  };

  const r = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    temperature: 0.2,
  });

  const raw = (r.choices[0]?.message?.content ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return badRequest("Missing 'url'.");

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, clientId } = gate;

    const maxPages = typeof body.maxPages === "number" ? body.maxPages : 7;
    const timeoutMsPerPage = typeof body.timeoutMsPerPage === "number" ? body.timeoutMsPerPage : 7000;

    const clampedPages = Math.max(1, Math.min(10, maxPages));
    const clampedTimeout = Math.max(1500, Math.min(15000, timeoutMsPerPage));

    const seed = toUrl(url);
    const domain = toHostname(seed);

    const companyFacts = parseCompanyFacts(body.companyFacts);

    const { crawl, errors } = await crawlOnDomain({
      seedUrl: seed,
      targetDomain: domain,
      maxPages: clampedPages,
      timeoutMsPerPage: clampedTimeout,
    });

    const ok = crawl.pageCount > 0;
    const scoreParts = ok ? buildScorePartsFromCrawl(crawl) : initScoreParts();
    const scoreSummary = sumScore(scoreParts);
    const evidence = ok ? buildEvidence(crawl) : [];

    const deterministic = buildDeterministicTasks({
      seedUrl: seed,
      domain,
      scoreParts,
      evidence,
      pagesCrawled: crawl.pageCount,
      crawlErrors: errors.slice(0, 10),
      companyFacts,
    });

    const basePayload = {
      url: seed,
      domain,
      crawlSummary: {
        seedUrl: crawl.seedUrl,
        targetDomain: crawl.targetDomain,
        pageCount: crawl.pageCount,
        maxPages: clampedPages,
        timeoutMsPerPage: clampedTimeout,
      },
      scoreBefore: scoreSummary.pct,
      estimatedScoreAfter: deterministic.estimatedScoreAfter,
      scoreParts,
      tasks: deterministic.tasks,
      schemaSnippets: deterministic.schemaSnippets,
      copyBlocks: deterministic.copyBlocks,
      diagnostics: {
        hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
        hasTavilyKey: Boolean(process.env.TAVILY_API_KEY),
        pagesCrawled: crawl.pageCount,
        crawlErrors: errors.slice(0, 10),
      },
    };

    // If crawl failed OR no OpenAI key -> return deterministic only (no hallucinations)
    if (!ok || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ...basePayload,
          error: !ok
            ? "No pages crawled (fetch blocked or timed out). See diagnostics.crawlErrors."
            : "Missing OPENAI_API_KEY (server env). Returned deterministic plan only.",
        },
        { status: 200 }
      );
    }

    // LLM refinement (optional)
    const llm = await buildActionPlanLLM({
      url: seed,
      scoreBefore: scoreSummary.pct,
      scoreParts,
      evidence,
      deterministic,
      companyFacts,
    });

    const llmOk =
      llm &&
      typeof llm === "object" &&
      Array.isArray((llm as { tasks?: unknown }).tasks) &&
      !(llm as { raw?: unknown }).raw;

    if (llmOk) {
      await incrementUsage(supabase, "content", clientId);
    }

    return NextResponse.json(
      {
        ...basePayload,
        estimatedScoreAfter:
          typeof llm?.estimatedScoreAfter === "number" ? llm.estimatedScoreAfter : basePayload.estimatedScoreAfter,
        tasks: Array.isArray(llm?.tasks) ? llm.tasks : basePayload.tasks,
        schemaSnippets: Array.isArray(llm?.schemaSnippets) ? llm.schemaSnippets : basePayload.schemaSnippets,
        copyBlocks: Array.isArray(llm?.copyBlocks) ? llm.copyBlocks : basePayload.copyBlocks,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Action plan error:", e);
    return NextResponse.json(
      { error: "Action plan failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}