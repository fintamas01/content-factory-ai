/**
 * Derives a stable token from MAINTENANCE_SESSION_SECRET for cookie verification.
 * Uses Web Crypto (Edge + Node compatible).
 */
const SALT = "cf-maintenance-bypass-v1";

export async function computeMaintenanceToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`${secret}:${SALT}`)
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
