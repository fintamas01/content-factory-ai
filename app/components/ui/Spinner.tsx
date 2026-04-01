"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/app/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-cyan-300", className)} aria-hidden />;
}

