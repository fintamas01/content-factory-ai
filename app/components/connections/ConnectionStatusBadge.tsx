"use client";

import { CheckCircle2, Link2, XCircle } from "lucide-react";
import { cn } from "@/app/lib/cn";

export function ConnectionStatusBadge({
  status,
  label,
}: {
  status: "connected" | "not_connected" | "coming_soon";
  label?: string | null;
}) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Connected{label ? ` · ${label}` : ""}
      </span>
    );
  }
  if (status === "coming_soon") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
        <XCircle className="h-4 w-4" aria-hidden />
        Coming soon
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70"
      )}
    >
      <Link2 className="h-4 w-4" aria-hidden />
      Not connected
    </span>
  );
}

