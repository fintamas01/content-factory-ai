export type ShopifyProduct = {
  id: number;
  title: string;
  body_html?: string;
  handle?: string;
  images?: Array<{ src?: string }>;
  variants?: Array<{ id: number; price?: string; sku?: string }>;
};

export type ShopifyConnection = {
  store_domain: string;
  access_token: string;
};

export type NormalizedStoreProduct = {
  id: number;
  title: string;
  description: string;
  handle: string | null;
  image: string | null;
  images: string[];
  variants: Array<{ id: number; price: string | null; sku: string | null }>;
  price: string | null;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function apiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || "2024-01";
}

export async function shopifyFetch<T>(
  conn: ShopifyConnection,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const url = `https://${conn.store_domain}/admin/api/${apiVersion()}${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": conn.access_token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await resp.text();
  if (!resp.ok) {
    return { ok: false, status: resp.status, error: text || `HTTP ${resp.status}` };
  }
  try {
    const json = JSON.parse(text);
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: resp.status, error: "Invalid JSON from Shopify." };
  }
}

export function normalizeShopifyProduct(p: ShopifyProduct): NormalizedStoreProduct {
  const images = Array.isArray(p.images) ? p.images.map((i) => String(i?.src ?? "")).filter(Boolean) : [];
  const variants = Array.isArray(p.variants)
    ? p.variants.map((v) => ({
        id: Number(v.id),
        price: typeof v.price === "string" ? v.price : null,
        sku: typeof v.sku === "string" ? v.sku : null,
      }))
    : [];
  const price = variants.find((v) => v.price)?.price ?? null;
  return {
    id: Number(p.id),
    title: String(p.title ?? ""),
    description: stripHtml(String(p.body_html ?? "")),
    handle: typeof p.handle === "string" ? p.handle : null,
    image: images[0] ?? null,
    images,
    variants,
    price,
  };
}

