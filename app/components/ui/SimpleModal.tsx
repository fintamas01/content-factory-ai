"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

export function SimpleModal({
  title,
  open,
  onClose,
  children,
  maxWidthClass = "max-w-2xl",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[min(92vh,900px)] w-full ${maxWidthClass} flex-col overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#0a0f18] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)]`}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] bg-[#070b12] px-5 py-4 md:px-6">
          <h2
            id={titleId}
            className="min-w-0 flex-1 break-words text-lg font-black leading-snug tracking-tight text-white md:text-xl"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-slate-300 md:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

