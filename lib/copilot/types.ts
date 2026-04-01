export type CopilotPageKey = string;

export type CopilotContext = {
  /** e.g. "/dashboard/products" */
  pathname: string;
  /** e.g. "dashboard/products" */
  pageKey: CopilotPageKey;
  /** Human-friendly label like "products" | "audit" | "sprint" */
  page?: string;
  /** Page-specific data (must be serializable) */
  data?: unknown;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

