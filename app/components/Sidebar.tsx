"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Bell,
  History,
  CreditCard,
  Settings,
  LogOut,
  Megaphone,
  Package,
  Radar,
  Palette,
  Sparkles,
  Orbit,
  Users,
  ClipboardCheck,
  BarChart3,
  Lock,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";
import { SIDEBAR_NAV_ITEMS, type SidebarNavId } from "@/lib/platform/navigation";
import { SidebarPlanBadge } from "@/app/components/SidebarPlanBadge";
import { ClientSwitcher } from "@/app/components/ClientSwitcher";
import type { PlanTier } from "@/lib/plan-config";
import { canAccess, type FeatureKey } from "@/lib/entitlements/features";
import { UpgradeAccessModal } from "@/app/components/entitlements/UpgradeAccessModal";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const NAV_FEATURE_KEY: Partial<Record<SidebarNavId, FeatureKey>> = {
  autopilot: "autopilot",
  playbooks: "playbooks",
  team: "team",
  priceIntelligence: "priceIntelligence",
} as const;

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_ICONS: Record<
  SidebarNavId,
  ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  review: ClipboardCheck,
  team: Users,
  autopilot: Orbit,
  playbooks: Sparkles,
  brand: Palette,
  content: Megaphone,
  products: Package,
  priceIntelligence: BarChart3,
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
  onNavigate,
  locked,
  onLockedClick,
}: {
  id: SidebarNavId;
  label: string;
  href: string;
  exact?: boolean;
  pathname: string;
  onNavigate?: () => void;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  const Icon = SIDEBAR_ICONS[id];
  const active = isNavActive(pathname, href, exact);
  return (
    <Link
      href={href}
      aria-disabled={locked ? true : undefined}
      onClick={(e) => {
        if (locked) {
          e.preventDefault();
          onLockedClick?.();
          return;
        }
        onNavigate?.();
      }}
    >
      <div className="relative">
        {active ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/12 via-violet-500/[0.08] to-transparent shadow-[0_0_32px_-18px_rgba(34,211,238,0.55)]"
            aria-hidden
          />
        ) : null}
        <div
          className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${
            active
              ? "text-white"
              : locked
                ? "text-white/45 hover:text-white/70 hover:bg-white/[0.03]"
                : "text-white/70 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-inner transition-colors ${
              active
                ? "border-white/10 bg-white/[0.06] text-cyan-200"
                : locked
                  ? "border-white/5 bg-black/20 text-white/45"
                  : "border-white/5 bg-black/20 text-white/65"
            }`}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              {label}
            </p>
          </div>
          {locked ? (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60"
              aria-hidden
            >
              <Lock className="h-4 w-4" />
            </span>
          ) : null}
          {active ? (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function Sidebar({
  className,
  onNavigate,
  inDrawer,
}: {
  className?: string;
  onNavigate?: () => void;
  inDrawer?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanTier>("free");
  const [planReady, setPlanReady] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing");
        const j = await res.json().catch(() => ({}));
        const p = (j?.plan ?? "free") as PlanTier;
        if (!cancelled) {
          setPlan(p);
          setPlanReady(true);
        }
      } catch {
        if (!cancelled) setPlanReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    router.push("/");
    router.refresh();
  };

  return (
    <aside
      className={`relative flex flex-col ${
        inDrawer ? "h-full min-h-0" : "h-screen"
      } ${inDrawer ? "" : "border-r border-white/[0.08]"} ${
        className ?? ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/35 backdrop-blur-xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(1200px 420px at 20% -10%, rgba(167,139,250,0.16), transparent 55%), radial-gradient(1000px 520px at 120% 10%, rgba(34,211,238,0.10), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col gap-2 px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Image
                src="/CF_logo.png"
                alt={`${PLATFORM_DISPLAY_NAME} logo`}
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold tracking-tight text-white">
                {PLATFORM_DISPLAY_NAME}
              </p>
              <p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-white/40">
                Command Center
              </p>
            </div>
          </div>
        </div>
        <div className="pt-2">
          <SidebarPlanBadge />
        </div>
        <div className="pt-3">
          <ClientSwitcher />
        </div>
      </div>

      <nav
        className="relative flex-1 min-h-0 px-4 pb-5 space-y-1.5 overflow-y-auto"
        aria-label="Main navigation"
      >
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const fk = NAV_FEATURE_KEY[item.id];
          const locked = planReady && fk ? !canAccess(plan, fk) : false;
          return (
            <NavRow
              key={item.id}
              id={item.id}
              label={item.label}
              href={item.href}
              exact={"exact" in item ? item.exact : undefined}
              pathname={pathname}
              onNavigate={onNavigate}
              locked={locked}
              onLockedClick={fk ? () => setLockedFeature(fk) : undefined}
            />
          );
        })}
      </nav>

      {lockedFeature ? (
        <UpgradeAccessModal
          featureKey={lockedFeature}
          open={Boolean(lockedFeature)}
          onClose={() => setLockedFeature(null)}
          currentPlan={plan}
        />
      ) : null}

      <div className="relative p-4 mt-auto border-t border-white/[0.08]">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-red-500/25 hover:bg-red-500/[0.06] hover:text-red-200 active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/60 transition group-hover:border-red-500/20 group-hover:text-red-200">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          Logout
        </button>
      </div>
    </aside>
  );
}
