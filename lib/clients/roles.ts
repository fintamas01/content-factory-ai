export type ClientRole = "owner" | "admin" | "member";

export function parseClientRole(raw: string | null | undefined): ClientRole | null {
  if (raw === "owner" || raw === "admin" || raw === "member") return raw;
  return null;
}

/** Invite / remove members (API + UI guard; RLS also enforces). */
export function canManageMembers(role: ClientRole): boolean {
  return role === "owner" || role === "admin";
}

export function canInvite(role: ClientRole): boolean {
  return canManageMembers(role);
}

/** Rename workspace, integrations, etc. */
export function canManageClientSettings(role: ClientRole): boolean {
  return role === "owner" || role === "admin";
}

/** Delete workspace — owner only at DB + API. */
export function canDeleteClient(role: ClientRole): boolean {
  return role === "owner";
}

/**
 * Whether actor may remove target from workspace (mirrors RLS intent).
 * Owner: admin/member only. Admin: member only.
 */
export function canRemoveMember(actor: ClientRole, target: ClientRole): boolean {
  if (actor === "owner") return target === "admin" || target === "member";
  if (actor === "admin") return target === "member";
  return false;
}
