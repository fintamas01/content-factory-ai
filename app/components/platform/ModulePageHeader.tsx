"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MODULES, PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

export type ModuleId = keyof typeof MODULES;

export function ModulePageHeader({
  moduleId,
  className = "",
}: {
  moduleId: ModuleId;
  className?: string;
}) {
  const m = MODULES[moduleId];
  return (
    <nav
      className={`flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ${className}`}
      aria-label="Module breadcrumb"
    >
      <Link
        href="/dashboard"
        className="text-slate-500 hover:text-blue-600 transition-colors"
      >
        {PLATFORM_DISPLAY_NAME}
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden />
      <span className="text-blue-600 dark:text-blue-400">{m.productName}</span>
    </nav>
  );
}
