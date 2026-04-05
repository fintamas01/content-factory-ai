import { load } from "cheerio";
import { getPublicSiteUrl } from "@/lib/env/public-site-url";

/**
 * Fetch HTML and extract a single product price (MVP heuristics).
 *
 * Limitations: JS-only prices, bot blocking, regional stores, VAT-inclusive text,
 * multi-SKU pages, and aggressive anti-scraping will often fail or return wrong values.
 * Treat output as directional; users should verify critical prices manually.
 */
function priceIntelUserAgent(): string {
  const site = getPublicSiteUrl();
  const ref = site ? ` +${site}` : "";
  return `Mozilla/5.0 (compatible; ContentFactoryPriceIntel/1.0${ref})`;
}

export async function fetchHtmlForPrice(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": priceIntelUserAgent(),
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new Error("Response is not HTML.");
  }
  return res.text();
}

function parseMoneyToNumber(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim();
  const m = s.match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000_000 ? n : null;
}

function tryJsonLdProductPrice(html: string): number | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of scripts) {
    try {
      const j = JSON.parse(m[1]) as unknown;
      const stack: unknown[] = Array.isArray(j) ? [...j] : [j];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        const o = cur as Record<string, unknown>;
        if (o["@type"] === "Product" || (Array.isArray(o["@type"]) && o["@type"]?.includes?.("Product"))) {
          const offers = o.offers;
          const off = Array.isArray(offers) ? offers[0] : offers;
          if (off && typeof off === "object") {
            const price = (off as Record<string, unknown>).price;
            if (typeof price === "string" || typeof price === "number") {
              const n = parseMoneyToNumber(String(price));
              if (n !== null) return n;
            }
          }
        }
        for (const v of Object.values(o)) {
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function extractPriceFromHtml(html: string): number | null {
  const $ = load(html);

  const metaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="twitter:data1"]',
  ];
  for (const sel of metaSelectors) {
    const content = $(sel).attr("content")?.trim();
    if (content) {
      const n = parseMoneyToNumber(content);
      if (n !== null) return n;
    }
  }

  const attrSelectors = [
    "[itemprop=price]",
    ".price .woocommerce-Price-amount",
    ".woocommerce-Price-amount",
    "[data-price]",
    ".product-price",
    ".price",
  ];
  for (const sel of attrSelectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const dataPrice = el.attr("content") ?? el.attr("data-price");
    if (dataPrice) {
      const n = parseMoneyToNumber(dataPrice);
      if (n !== null) return n;
    }
    const text = el.text();
    const n = parseMoneyToNumber(text);
    if (n !== null) return n;
  }

  const fromLd = tryJsonLdProductPrice(html);
  if (fromLd !== null) return fromLd;

  const bodyText = $.root().text().replace(/\s+/g, " ");
  const dollar = bodyText.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  if (dollar) {
    const n = parseMoneyToNumber(dollar[1]);
    if (n !== null) return n;
  }
  const eur = bodyText.match(/€\s*([\d,]+(?:\.\d{2})?)/);
  if (eur) {
    const n = parseMoneyToNumber(eur[1]);
    if (n !== null) return n;
  }

  return null;
}

export async function scrapeCompetitorPrice(pageUrl: string): Promise<number | null> {
  const html = await fetchHtmlForPrice(pageUrl);
  return extractPriceFromHtml(html);
}
