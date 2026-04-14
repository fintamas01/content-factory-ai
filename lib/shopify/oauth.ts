import crypto from "node:crypto";

export function normalizeShopDomain(raw: string): string {
  const s = raw.trim().toLowerCase();
  const noProto = s.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // Shopify OAuth requires the *.myshopify.com domain.
  if (noProto.endsWith(".myshopify.com")) return noProto;
  // Allow entering just the shop subdomain.
  if (/^[a-z0-9][a-z0-9-]*$/.test(noProto)) return `${noProto}.myshopify.com`;
  return noProto;
}

export function isValidShopDomain(shop: string): boolean {
  if (!shop) return false;
  if (!shop.endsWith(".myshopify.com")) return false;
  // basic label validation
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

export function buildShopifyAuthorizeUrl(params: {
  shop: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const qs = new URLSearchParams();
  qs.set("client_id", params.clientId);
  qs.set("scope", params.scopes.join(","));
  qs.set("redirect_uri", params.redirectUri);
  qs.set("state", params.state);
  // Offline access token for server-side MVP.
  qs.set("grant_options[]", "per-user");
  return `https://${params.shop}/admin/oauth/authorize?${qs.toString()}`;
}

export function verifyShopifyHmac(params: {
  query: Record<string, string>;
  secret: string;
}): boolean {
  const { query, secret } = params;
  const hmac = query.hmac;
  if (!hmac) return false;

  const pairs: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const message = pairs.join("&");
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export function randomState(): string {
  return crypto.randomBytes(24).toString("hex");
}

