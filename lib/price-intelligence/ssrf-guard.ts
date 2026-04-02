/**
 * Block obvious SSRF targets for server-side URL fetch (MVP).
 */
export function assertPublicProductUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new Error("That host is not allowed.");
  }
  if (host.startsWith("10.")) throw new Error("That host is not allowed.");
  if (host.startsWith("192.168.")) throw new Error("That host is not allowed.");
  if (host.startsWith("169.254.")) throw new Error("That host is not allowed.");
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) throw new Error("That host is not allowed.");
  }
  return u;
}
