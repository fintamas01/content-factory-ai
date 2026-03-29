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
    id: "content",
    label: "Content",
    href: MODULES.content.href,
  },
  {
    id: "products",
    label: "Products",
    href: MODULES.products.href,
  },
  {
    id: "siteAudit",
    label: MODULES.siteAudit.label,
    href: MODULES.siteAudit.href,
  },
  {
    id: "history",
    label: "History",
    href: "/history",
  },
  {
    id: "billing",
    label: "Billing",
    href: "/billing",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
  },
] as const;

export type SidebarNavId = (typeof SIDEBAR_NAV_ITEMS)[number]["id"];
