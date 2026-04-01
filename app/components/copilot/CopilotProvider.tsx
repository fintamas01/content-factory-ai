"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { CopilotContext } from "@/lib/copilot/types";
import { trimCopilotContext } from "@/lib/copilot/trim";

type CopilotStore = {
  context: CopilotContext;
  setPageContext: (patch: Pick<CopilotContext, "page" | "data">) => void;
  clearPageData: () => void;
};

const Ctx = createContext<CopilotStore | null>(null);

function derivePageKey(pathname: string) {
  return pathname.replace(/^\//, "") || "root";
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [page, setPage] = useState<string | undefined>(undefined);
  const [data, setData] = useState<unknown>(undefined);

  const setPageContext = useCallback((patch: Pick<CopilotContext, "page" | "data">) => {
    if (typeof patch.page === "string") setPage(patch.page);
    if (patch.data !== undefined) setData(trimCopilotContext(patch.data));
  }, []);

  const clearPageData = useCallback(() => {
    setData(undefined);
  }, []);

  const value = useMemo<CopilotStore>(() => {
    return {
      context: {
        pathname,
        pageKey: derivePageKey(pathname),
        page,
        data,
      },
      setPageContext,
      clearPageData,
    };
  }, [pathname, page, data, setPageContext, clearPageData]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopilotStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCopilotStore must be used within CopilotProvider.");
  return v;
}

