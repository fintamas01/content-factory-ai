/**
 * Platform-wide display names and module registry.
 * Env keys and deployment targets stay unchanged; this is UI/routing metadata only.
 */

export const PLATFORM_DISPLAY_NAME = "ContentFactory Platform";
export const PLATFORM_DESCRIPTION =
  "Multi-module AI workspace for social content, product copy, and site intelligence.";

export const MODULES = {
  content: {
    id: "content",
    label: "Content",
    description:
      "Social and marketing content generation (ContentFactory).",
    href: "/dashboard/content",
  },
  products: {
    id: "products",
    label: "Products",
    description:
      "Product descriptions, SEO, bullets, and marketing copy (ProductGenie).",
    href: "/dashboard/products",
  },
  siteAudit: {
    id: "site-audit",
    label: "Site Audit",
    description:
      "Website audit, AI-readiness, and SEO / conversion suggestions (Site Audit Pro).",
    href: "/dashboard/site-audit",
  },
} as const;
