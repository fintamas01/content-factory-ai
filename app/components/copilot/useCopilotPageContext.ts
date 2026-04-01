"use client";

import { useEffect, useMemo } from "react";
import type { CopilotContext } from "@/lib/copilot/types";
import { useCopilotStore } from "@/app/components/copilot/CopilotProvider";

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Page-level opt-in context. Call once per page (or per major panel).
 * Keep `data` small; it will be trimmed again server-side.
 */
export function useCopilotPageContext(input: Pick<CopilotContext, "page" | "data">) {
  const { setPageContext } = useCopilotStore();

  // Prevent update loops: many pages pass inline object literals.
  // We only push updates when the serialized payload changes.
  const serialized = useMemo(() => safeSerialize(input.data), [input.data]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPageContext(input), [input.page, serialized]);
}

