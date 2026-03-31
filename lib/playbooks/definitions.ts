import {
  Sparkles,
  Target,
  Swords,
  CalendarDays,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";

export type PlaybookId =
  | "launch_new_product"
  | "improve_homepage_conversion"
  | "outrank_competitor"
  | "build_14_day_content_plan"
  | "improve_ai_visibility";

export type PlaybookParamSpec = {
  key: "url" | "product_name" | "competitor_url";
  label: string;
  placeholder: string;
  required: boolean;
  help?: string;
};

export type PlaybookStepId =
  | "audit"
  | "competitor_intelligence"
  | "content_gap_list"
  | "seo_content"
  | "positioning_strategy"
  | "conversion_quick_wins"
  | "ai_visibility_actions"
  | "plan_14_days"
  | "product_copy";

export type PlaybookStepDefinition = {
  id: PlaybookStepId;
  title: string;
  description?: string;
};

export type PlaybookDefinition = {
  id: PlaybookId;
  title: string;
  description: string;
  icon: LucideIcon;
  params: PlaybookParamSpec[];
  steps: PlaybookStepDefinition[];
  usageFeature: "audit" | "product";
};

export const PLAYBOOKS: PlaybookDefinition[] = [
  {
    id: "launch_new_product",
    title: "Launch a New Product",
    description:
      "Generate launch-ready product messaging: title, bullets, SEO snippets—on-brand, shippable, and conversion-minded.",
    icon: Sparkles,
    usageFeature: "product",
    params: [
      {
        key: "product_name",
        label: "Product name",
        placeholder: "e.g. Nimbus CRM",
        required: true,
      },
    ],
    steps: [
      { id: "product_copy", title: "Generate product copy" },
      { id: "seo_content", title: "Draft launch SEO content" },
      { id: "positioning_strategy", title: "Positioning strategy" },
    ],
  },
  {
    id: "improve_homepage_conversion",
    title: "Improve Homepage Conversion",
    description:
      "Run a focused conversion audit and generate a prioritized set of quick wins you can ship this week.",
    icon: Target,
    usageFeature: "audit",
    params: [
      {
        key: "url",
        label: "Homepage URL",
        placeholder: "https://yourdomain.com",
        required: true,
      },
    ],
    steps: [
      { id: "audit", title: "Run homepage audit" },
      { id: "conversion_quick_wins", title: "Conversion quick wins" },
      { id: "seo_content", title: "Rewrite suggestions (hero + sections)" },
    ],
  },
  {
    id: "outrank_competitor",
    title: "Outrank a Competitor",
    description:
      "Audit your site, analyze competitors, identify content gaps, then generate SEO content and positioning you can execute.",
    icon: Swords,
    usageFeature: "audit",
    params: [
      {
        key: "url",
        label: "Your URL",
        placeholder: "https://yourdomain.com",
        required: true,
      },
      {
        key: "competitor_url",
        label: "Competitor URL",
        placeholder: "https://competitor.com",
        required: true,
      },
    ],
    steps: [
      { id: "audit", title: "Run audit" },
      { id: "competitor_intelligence", title: "Run competitor intelligence" },
      { id: "content_gap_list", title: "Generate content gap list" },
      { id: "seo_content", title: "Generate SEO content" },
      { id: "positioning_strategy", title: "Generate positioning strategy" },
    ],
  },
  {
    id: "build_14_day_content_plan",
    title: "Build 14-Day Content Plan",
    description:
      "Generate a two-week content plan grounded in your site’s audit: topics, angles, and execution details.",
    icon: CalendarDays,
    usageFeature: "audit",
    params: [
      {
        key: "url",
        label: "URL",
        placeholder: "https://yourdomain.com",
        required: true,
      },
    ],
    steps: [
      { id: "audit", title: "Run audit" },
      { id: "plan_14_days", title: "Generate 14-day plan" },
    ],
  },
  {
    id: "improve_ai_visibility",
    title: "Improve AI Visibility",
    description:
      "Audit how AI systems interpret your site, then produce a precise, prioritized action plan for better AI discoverability.",
    icon: MessageCircleQuestion,
    usageFeature: "audit",
    params: [
      {
        key: "url",
        label: "URL",
        placeholder: "https://yourdomain.com",
        required: true,
      },
    ],
    steps: [
      { id: "audit", title: "Run audit" },
      { id: "ai_visibility_actions", title: "AI visibility actions" },
      { id: "seo_content", title: "AI-first FAQ + snippet drafts" },
    ],
  },
];

export function getPlaybookDefinition(id: string): PlaybookDefinition | null {
  return PLAYBOOKS.find((p) => p.id === id) ?? null;
}

