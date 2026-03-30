import type { AuditPageSignalsPayload } from "@/lib/site-audit/types";

export function parseAuditSignals(raw: unknown): AuditPageSignalsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const url = typeof s.url === "string" ? s.url : "";
  if (!url) return null;
  return {
    url,
    title: typeof s.title === "string" ? s.title : null,
    metaDescription:
      typeof s.metaDescription === "string" ? s.metaDescription : null,
    h1Count: typeof s.h1Count === "number" ? s.h1Count : 0,
    h2Count: typeof s.h2Count === "number" ? s.h2Count : 0,
  };
}
