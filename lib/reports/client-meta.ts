export type ActiveClientSummary = { id: string; name: string } | null;

export async function fetchActiveClientSummary(): Promise<ActiveClientSummary> {
  const res = await fetch("/api/clients");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const activeId = typeof json.activeClientId === "string" ? json.activeClientId : "";
  const clients = Array.isArray(json.clients) ? json.clients : [];
  const match = clients.find((c: any) => c && typeof c.id === "string" && c.id === activeId);
  if (!match) return null;
  return { id: match.id, name: String(match.name ?? "Workspace") };
}

export function safeFilenamePart(s: string): string {
  return (
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-]+/g, "")
      .slice(0, 64) || "export"
  );
}

