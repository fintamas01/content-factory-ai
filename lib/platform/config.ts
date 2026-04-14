/**
 * Platform-wide display names and module registry.
 * Optional: set NEXT_PUBLIC_PLATFORM_DISPLAY_NAME on Vercel to rebrand the shell without code changes.
 * Env keys for Supabase/Stripe/OpenAI stay unchanged; this is UI/routing metadata only.
 */

export const PLATFORM_DISPLAY_NAME =
  typeof process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME === "string" &&
  process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME.trim().length > 0
    ? process.env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME.trim()
    : "Neural Workspace";

export const PLATFORM_DESCRIPTION =
  "Multi-module AI workspace: ContentFactory, ProductGenie, and Site Audit Pro in one place.";

export const MODULES = {
  brand: {
    id: "brand",
    productName: "Brand Profile",
    label: "Brand",
    description: "Shared brand voice and positioning for AI modules.",
    href: "/dashboard/brand",
  },
  adCreativeStudio: {
    id: "ai-ad-creative-studio",
    productName: "AI Ad Creative Studio",
    label: "Ad Creative Studio",
    description:
      "Generate static ad creative concepts and copy variants for multiple placements and languages.",
    href: "/dashboard/ai-ad-creative-studio",
  },
  content: {
    id: "content",
    productName: "ContentFactory",
    label: "Content",
    description: "Social and marketing content generation.",
    href: "/dashboard/content",
  },
  products: {
    id: "products",
    productName: "ProductGenie",
    label: "Products",
    description: "Product descriptions, SEO, bullets, and marketing copy.",
    href: "/dashboard/products",
  },
  siteAudit: {
    id: "site-audit",
    productName: "AI Growth Audit",
    label: "Growth Audit",
    description: "Page-level SEO, AI readiness, and conversion signals.",
    href: "/dashboard/site-audit",
  },
  review: {
    id: "review",
    productName: "Review queue",
    label: "Review",
    description: "Cross-module approvals before publish or apply.",
    href: "/dashboard/review",
  },
} as const;
