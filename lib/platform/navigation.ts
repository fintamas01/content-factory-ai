import { MODULES } from "./config";

/**
 * Single source of truth for primary app navigation (sidebar).
 * Module hrefs come from MODULES so routes stay aligned with the registry.
 */
export const SIDEBAR_NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    exact: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/dashboard/notifications",
  },
  {
    id: "review",
    label: "Review",
    href: "/dashboard/review",
  },
  {
    id: "team",
    label: "Team",
    href: "/dashboard/team",
  },
  {
    id: "autopilot",
    label: "AutoPilot",
    href: "/dashboard/autopilot",
  },
  {
    id: "playbooks",
    label: "Playbooks",
    href: "/dashboard/playbooks",
  },
  {
    id: "brand",
    label: "Brand",
    href: MODULES.brand.href,
  },
  {
    id: "content",
    label: "Content",
    href: MODULES.content.href,
  },
  {
    id: "adCreativeStudio",
    label: "AI Ad Creative Studio",
    href: "/dashboard/ai-ad-creative-studio",
  },
  {
    id: "products",
    label: "Products",
    href: MODULES.products.href,
  },
  {
    id: "priceIntelligence",
    label: "Price Intelligence",
    href: "/dashboard/price-intelligence",
  },
  {
    id: "siteAudit",
    label: MODULES.siteAudit.label,
    href: MODULES.siteAudit.href,
  },
  {
    id: "history",
    label: "History",
    href: "/dashboard/history",
  },
  {
    id: "billing",
    label: "Billing",
    href: "/dashboard/billing",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
  },
] as const;

export type SidebarNavId = (typeof SIDEBAR_NAV_ITEMS)[number]["id"];
