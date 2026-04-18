import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import {
  SocialPostHistoryClient,
  type SocialPostHistoryItem,
} from "@/app/dashboard/social-posts/history/SocialPostHistoryClient";

export default async function SocialPostHistoryPage() {
  const gate = await requireAuthenticatedClient();
  if (!gate.ok) {
    redirect("/");
  }

  const { data: rows, error } = await gate.supabase
    .from("social_post_generations")
    .select("id, template_id, template_name, values, output_url, created_at, headline")
    .eq("client_id", gate.clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("social_post_generations history:", error);
  }

  const items: SocialPostHistoryItem[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    template_id:
      typeof r.template_id === "string" && r.template_id.trim() ? r.template_id.trim() : null,
    template_name: String(r.template_name ?? ""),
    values:
      r.values && typeof r.values === "object" && !Array.isArray(r.values)
        ? (r.values as Record<string, unknown>)
        : null,
    output_url: String(r.output_url ?? ""),
    created_at: typeof r.created_at === "string" ? r.created_at : String(r.created_at ?? ""),
    headline: r.headline != null ? String(r.headline) : null,
  }));

  return (
    <Page>
      <div className="mb-4">
        <Link
          href="/dashboard/social-posts"
          className="text-sm font-medium text-white/60 transition hover:text-white"
        >
          ← Templates
        </Link>
      </div>

      <PageHero
        icon={<History className="h-5 w-5" aria-hidden />}
        eyebrow="Creatomate"
        title="Social post history"
        description="Previously generated images for your workspace. Reuse saved inputs or open the file."
      />

      <SocialPostHistoryClient items={items} />
    </Page>
  );
}
