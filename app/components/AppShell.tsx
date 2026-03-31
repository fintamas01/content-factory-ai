"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

function shouldHideShell(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/maintenance" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = useMemo(() => shouldHideShell(pathname), [pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  if (hide) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#020617] overflow-x-hidden">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex w-64 h-screen sticky top-0 z-40" />

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b border-white/10 bg-[#020617]/85 backdrop-blur supports-[backdrop-filter]:bg-[#020617]/65">
        <div className="h-full px-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 active:scale-[0.98]"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{PLATFORM_DISPLAY_NAME}</p>
            <p className="truncate text-[11px] font-medium text-white/50">
              Command Center
            </p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/70 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute inset-y-0 left-0 w-[19rem] max-w-[86vw] transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full bg-white dark:bg-[#020617] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-slate-200 dark:border-white/10">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 active:scale-[0.98]"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Sidebar
              className="w-full h-full"
              onNavigate={() => setMobileOpen(false)}
              inDrawer
            />
          </div>
        </div>
      </div>

      <main className="flex-1 min-w-0 w-full overflow-y-auto">
        {/* Push content below fixed mobile header */}
        <div className="pt-14 md:pt-0">{children}</div>
      </main>
    </div>
  );
}

