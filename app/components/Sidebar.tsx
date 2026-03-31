"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  History,
  CreditCard,
  Settings,
  LogOut,
  Megaphone,
  Package,
  Radar,
  Palette,
  Sparkles,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { SIDEBAR_NAV_ITEMS, type SidebarNavId } from "@/lib/platform/navigation";
import { SidebarPlanBadge } from "@/app/components/SidebarPlanBadge";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_ICONS: Record<
  SidebarNavId,
  ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  playbooks: Sparkles,
  brand: Palette,
  content: Megaphone,
  products: Package,
  siteAudit: Radar,
  history: History,
  billing: CreditCard,
  settings: Settings,
};

function NavRow({
  id,
  label,
  href,
  exact,
  pathname,
}: {
  id: SidebarNavId;
  label: string;
  href: string;
  exact?: boolean;
  pathname: string;
}) {
  const Icon = SIDEBAR_ICONS[id];
  const active = isNavActive(pathname, href, exact);
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer ${
          active
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span>{label}</span>
      </div>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (
    pathname === "/" ||
    pathname === "/maintenance" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  )
    return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#020617] border-r border-slate-200 dark:border-white/10 flex flex-col h-screen sticky top-0 z-50">
      <div className="flex flex-col gap-1 px-4 py-6">
        <Image
          src="/CF_logo.png"
          alt={`${PLATFORM_DISPLAY_NAME} logo`}
          width={100}
          height={100}
          className="object-contain"
        />
        <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {PLATFORM_DISPLAY_NAME}
        </span>
        <SidebarPlanBadge />
      </div>

      <nav
        className="flex-1 px-4 space-y-2 overflow-y-auto"
        aria-label="Main navigation"
      >
        {SIDEBAR_NAV_ITEMS.map((item) => (
          <NavRow
            key={item.id}
            id={item.id}
            label={item.label}
            href={item.href}
            exact={"exact" in item ? item.exact : undefined}
            pathname={pathname}
          />
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 font-bold text-sm hover:text-red-500 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </aside>
  );
}
