"use client";

import { useEffect } from "react";
import type { CopilotContext } from "@/lib/copilot/types";
import { useCopilotStore } from "@/app/components/copilot/CopilotProvider";

/**
 * Page-level opt-in context. Call once per page (or per major panel).
 * Keep `data` small; it will be trimmed again server-side.
 */
export function useCopilotPageContext(input: Pick<CopilotContext, "page" | "data">) {
  const { setPageContext } = useCopilotStore();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPageContext(input), [input.page, input.data]);
}

