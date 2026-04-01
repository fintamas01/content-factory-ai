"use client";

import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-white/[0.10] bg-black/30 px-4 py-3 text-sm font-medium text-white placeholder:text-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-[border-color,box-shadow,background] duration-200 hover:border-white/[0.14] focus:border-white/[0.18] focus:shadow-[0_0_0_3px_var(--ring)] disabled:opacity-60",
        className
      )}
    />
  );
}

