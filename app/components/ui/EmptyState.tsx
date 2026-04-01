"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

export function EmptyState({
  title,
  description,
  icon,
  className,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-dashed border-white/10 bg-black/15 px-6 py-16 text-center shadow-[0_32px_80px_-64px_rgba(0,0,0,0.95)]",
        className
      )}
    >
      {icon ? <div className="mx-auto mb-4 w-fit text-white/35">{icon}</div> : null}
      <p className="text-base font-semibold tracking-tight text-white/85">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-6 flex justify-center">{actions}</div> : null}
    </div>
  );
}

