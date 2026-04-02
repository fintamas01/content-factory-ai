/**
 * Client-scoped workspace persistence for dashboard modules (localStorage).
 * Keys include user + active client so workspaces do not leak across accounts or workspaces.
 */

const PREFIX = "cf.workspace.v1";
const MAX_BYTES = 4_500_000;

export type WorkspaceEnvelope<T> = { v: 1; savedAt: number; data: T };

function key(userId: string, clientId: string, moduleKey: string): string {
  return `${PREFIX}:${userId}:${clientId}:${moduleKey}`;
}

export function saveWorkspace<T>(
  userId: string,
  clientId: string,
  moduleKey: string,
  data: T
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: WorkspaceEnvelope<T> = {
      v: 1,
      savedAt: Date.now(),
      data,
    };
    const raw = JSON.stringify(payload);
    if (raw.length > MAX_BYTES) return false;
    localStorage.setItem(key(userId, clientId, moduleKey), raw);
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspace<T>(
  userId: string,
  clientId: string,
  moduleKey: string
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId, clientId, moduleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceEnvelope<T>;
    if (!parsed || parsed.v !== 1 || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearWorkspace(
  userId: string,
  clientId: string,
  moduleKey: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(userId, clientId, moduleKey));
  } catch {
    /* ignore */
  }
}

export const WORKSPACE_MODULES = {
  content: "content",
  products: "products",
  siteAudit: "site-audit",
  playbooks: "playbooks",
  matrix: "matrix",
} as const;
