"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

type Variant = "surface" | "plain";

export function Card({
  className,
  variant = "surface",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  const base =
    "relative overflow-hidden rounded-[24px] transition-[transform,border-color,box-shadow,background] duration-300";
  const v =
    variant === "plain"
      ? "cf-surface-plain shadow-[0_18px_60px_-48px_rgba(0,0,0,0.85)] hover:border-white/[0.12]"
      : "cf-surface hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_48px_110px_-74px_rgba(0,0,0,0.92)]";
  return <div {...props} className={cn(base, v, className)} />;
}

