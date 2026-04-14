export type HistoryKind = "content" | "product" | "audit" | "matrix" | "adCreative";

/** Normalized row for list + detail (full payload in `data`). */
export type HistoryListItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  preview: string;
  created_at: string;
  /** Full row from source table for detail view */
  data: Record<string, unknown>;
};
