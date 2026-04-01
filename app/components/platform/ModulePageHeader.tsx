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
      className={`flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45 ${className}`}
      aria-label="Module breadcrumb"
    >
      <Link
        href="/dashboard"
        className="text-white/40 hover:text-white/70 transition-colors"
      >
        {PLATFORM_DISPLAY_NAME}
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden />
      <span className="text-cyan-200/90">{m.productName}</span>
    </nav>
  );
}
