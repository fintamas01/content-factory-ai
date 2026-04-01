import { ACTIVE_CLIENT_COOKIE } from "./constants";

export function getActiveClientIdFromBrowser(): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(`${ACTIVE_CLIENT_COOKIE}=`)) continue;
    const raw = p.slice(`${ACTIVE_CLIENT_COOKIE}=`.length);
    return raw ? decodeURIComponent(raw) : null;
  }
  return null;
}

