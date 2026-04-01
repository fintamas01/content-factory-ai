"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-[12px] font-semibold tracking-wide transition-[transform,background,border-color,box-shadow,color] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

  const sizes: Record<Size, string> = {
    sm: "h-9 px-3",
    md: "h-10 px-4",
    lg: "h-11 px-5",
  };

  const variants: Record<Variant, string> = {
    primary:
      "border-cyan-400/25 bg-gradient-to-r from-cyan-500/20 via-violet-500/15 to-transparent text-white shadow-[0_0_32px_-18px_rgba(34,211,238,0.55)] hover:border-cyan-300/35 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring),0_0_32px_-18px_rgba(34,211,238,0.55)]",
    secondary:
      "border-white/10 bg-white/[0.04] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]",
    ghost:
      "border-transparent bg-transparent text-white/70 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]",
    danger:
      "border-red-500/25 bg-red-500/[0.08] text-red-200 hover:border-red-400/35 hover:bg-red-500/[0.12] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.18)]",
  };

  return (
    <button
      {...props}
      className={cn(base, sizes[size], variants[variant], className)}
    />
  );
}

