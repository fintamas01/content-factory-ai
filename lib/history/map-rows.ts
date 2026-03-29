import type { HistoryKind, HistoryListItem } from "./types";

function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

export function mapContentRow(row: Record<string, unknown>): HistoryListItem {
  const original = String(row.original_content ?? "");
  return {
    id: String(row.id),
    kind: "content",
    title: clip(original, 80) || "Content generation",
    preview: clip(original, 160),
    created_at: String(row.created_at ?? ""),
    data: row,
  };
}

export function mapProductRow(row: Record<string, unknown>): HistoryListItem {
  const name = String(row.product_name ?? "Product");
  const out = row.output_data as Record<string, unknown> | undefined;
  const desc = typeof out?.description === "string" ? out.description : "";
  const titleStr = typeof out?.title === "string" ? out.title : name;
  return {
    id: String(row.id),
    kind: "product",
    title: titleStr || name,
    preview: clip(desc || titleStr, 160),
    created_at: String(row.created_at ?? ""),
    data: row,
  };
}

export function mapAuditRow(row: Record<string, unknown>): HistoryListItem {
  const url = String(row.page_url ?? "Audit");
  const report = row.report as Record<string, unknown> | undefined;
  const summary = typeof report?.summary === "string" ? report.summary : "";
  return {
    id: String(row.id),
    kind: "audit",
    title: url,
    preview: clip(summary, 160) || "Growth audit report",
    created_at: String(row.created_at ?? ""),
    data: row,
  };
}

export function mapMatrixRow(row: Record<string, unknown>): HistoryListItem {
  const brand = String(row.brand_name ?? "Brand");
  const gen = row.generation_data as Record<string, unknown> | undefined;
  const days = Array.isArray(gen?.days) ? gen.days : [];
  const first = days[0] as Record<string, unknown> | undefined;
  const dayTitle = typeof first?.title === "string" ? first.title : "";
  return {
    id: String(row.id),
    kind: "matrix",
    title: `${brand} · Content pack`,
    preview: dayTitle
      ? clip(dayTitle, 120)
      : `${days.length} day${days.length === 1 ? "" : "s"} · ${row.month_year ?? ""}`,
    created_at: String(row.created_at ?? ""),
    data: row,
  };
}

export function mergeAndSort(items: HistoryListItem[]): HistoryListItem[] {
  return [...items].sort((a, b) => {
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export const KIND_LABEL: Record<HistoryKind, string> = {
  content: "Content",
  product: "Products",
  audit: "Audit",
  matrix: "Matrix",
};
