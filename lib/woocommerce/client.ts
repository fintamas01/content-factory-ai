export type WooConnection = {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
};

export type WooProductListItem = {
  id: number;
  name: string;
  slug?: string;
  permalink?: string;
  sku?: string;
  type?: string;
  status?: string;
  price?: string;
  images?: Array<{ src?: string }>;
};

export type WooProduct = WooProductListItem & {
  description?: string;
  short_description?: string;
};

function normalizeStoreUrl(raw: string): string {
  const t = raw.trim();
  const u = t.startsWith("http") ? t : `https://${t}`;
  // Drop trailing slash for consistent concatenation
  return u.replace(/\/+$/, "");
}

export function buildWooApiBase(storeUrl: string): string {
  return `${normalizeStoreUrl(storeUrl)}/wp-json/wc/v3`;
}

export async function wooFetch<T>(
  conn: WooConnection,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const base = buildWooApiBase(conn.store_url);
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("consumer_key", conn.consumer_key);
  url.searchParams.set("consumer_secret", conn.consumer_secret);

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: t || `WooCommerce request failed (${res.status}).`,
    };
  }

  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) {
    return { ok: false, status: 502, error: "Invalid WooCommerce JSON response." };
  }
  return { ok: true, data: json };
}

