/**
 * Internal admin detection (owner override).
 *
 * - NOT a billing/Stripe hack.
 * - Does not create or modify subscription rows.
 * - Only affects *effective* access checks for the signed-in user.
 *
 * Configure via env:
 *   ADMIN_EMAILS="owner@example.com,other-admin@example.com"
 */

function parseAdminEmails(envValue: string | undefined): Set<string> {
  const raw = typeof envValue === "string" ? envValue : "";
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

function adminAllowlist(): Set<string> {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e) return false;
  const allow = adminAllowlist();
  return allow.has(e);
}

export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  return isAdminEmail(user?.email ?? null);
}

