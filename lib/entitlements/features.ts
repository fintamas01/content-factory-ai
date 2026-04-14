import type { PlanTier } from "@/lib/plan-config";

export type FeatureKey =
  | "adCreativeStudio"
  | "posterStudio"
  | "posterTemplates"
  | "socialConnections"
  | "socialPublish"
  | "contentMatrix"
  | "playbooks"
  | "autopilot"
  | "team"
  | "priceIntelligence";

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  /** Short user-facing value prop (used in locked modal/state). */
  description: string;
  /** Minimum plan required to access. */
  minPlan: PlanTier;
  /** Optional canonical href for UI routing. */
  href?: string;
};

const ORDER: Record<PlanTier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  elite: 3,
};

export function isPlanAtLeast(plan: PlanTier, minPlan: PlanTier): boolean {
  return (ORDER[plan] ?? 0) >= (ORDER[minPlan] ?? 0);
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  adCreativeStudio: {
    key: "adCreativeStudio",
    label: "AI Ad Creative Studio",
    description:
      "Generate static ad creative concepts and high-converting copy variants for multiple placements.",
    // V1 recommendation: Basic+ (fits the new pricing tiers and keeps value clear).
    // Change this later in one place to adjust access.
    minPlan: "basic",
    href: "/dashboard/ai-ad-creative-studio",
  },
  posterStudio: {
    key: "posterStudio",
    label: "Poster Studio",
    description: "Design scroll-stopping creatives with templates, brand styling, and AI copy.",
    minPlan: "basic",
    href: "/dashboard/poster",
  },
  posterTemplates: {
    key: "posterTemplates",
    label: "Poster templates",
    description: "Browse premium templates and launch into Poster Studio in one click.",
    minPlan: "basic",
    href: "/dashboard/poster/templates",
  },
  socialConnections: {
    key: "socialConnections",
    label: "Social connections",
    description: "Connect Facebook/Instagram accounts to publish generated content directly.",
    minPlan: "basic",
    href: "/dashboard/social-connections",
  },
  socialPublish: {
    key: "socialPublish",
    label: "Social publishing",
    description: "Publish and schedule posts to connected social accounts from Content.",
    minPlan: "basic",
  },
  contentMatrix: {
    key: "contentMatrix",
    label: "Content Matrix",
    description: "Generate a structured weekly content plan and iterate post-by-post.",
    minPlan: "pro",
    href: "/dashboard/matrix",
  },
  playbooks: {
    key: "playbooks",
    label: "Playbooks",
    description: "Run repeatable workflows that produce high-quality outputs in minutes.",
    minPlan: "pro",
    href: "/dashboard/playbooks",
  },
  autopilot: {
    key: "autopilot",
    label: "AutoPilot",
    description: "Continuous monitoring that finds opportunities and delivers actionable insights.",
    minPlan: "pro",
    href: "/dashboard/autopilot",
  },
  team: {
    key: "team",
    label: "Team",
    description: "Invite teammates and collaborate across your workspace.",
    minPlan: "pro",
    href: "/dashboard/team",
  },
  priceIntelligence: {
    key: "priceIntelligence",
    label: "Price Intelligence",
    description: "Track competitor pricing and generate AI pricing briefs tailored to your listings.",
    minPlan: "elite",
    href: "/dashboard/price-intelligence",
  },
};

export function requiredPlan(feature: FeatureKey): PlanTier {
  return FEATURES[feature].minPlan;
}

export function canAccess(plan: PlanTier, feature: FeatureKey): boolean {
  return isPlanAtLeast(plan, requiredPlan(feature));
}

