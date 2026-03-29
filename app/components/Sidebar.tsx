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
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { MODULES, PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", exact: true },
  { icon: Megaphone, label: "Content", href: MODULES.content.href },
  { icon: Package, label: "Products", href: MODULES.products.href },
  { icon: Radar, label: "Site Audit", href: MODULES.siteAudit.href },
  { icon: History, label: "History", href: "/history" },
  { icon: CreditCard, label: "Billing", href: "/billing" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

function NavRow({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isNavActive(pathname, item.href, item.exact);
  return (
    <Link href={item.href}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer ${
          active
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
        }`}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        <span>{item.label}</span>
      </div>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/" || pathname === "/maintenance") return null;

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
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} />
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
