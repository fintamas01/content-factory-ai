/**
 * Canonical public site origin (https://your-domain.com), no trailing slash.
 *
 * Set **NEXT_PUBLIC_SITE_URL** in production (e.g. `https://example.com`).
 * **NEXT_PUBLIC_APP_URL** is accepted as an alias for older deployments.
 * On Vercel preview deployments, **VERCEL_URL** is used when the above are unset
 * (HTTPS assumed). Local dev: set NEXT_PUBLIC_SITE_URL in `.env.local`.
 */
export function getPublicSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";

  if (raw) {
    try {
      const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
      return `${u.protocol}//${u.host}`;
    } catch {
      return raw.replace(/\/$/, "");
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "";
}

/**
 * Joins the public origin with a path that must start with `/`.
 */
export function publicAbsoluteUrl(path: string): string {
  const base = getPublicSiteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
