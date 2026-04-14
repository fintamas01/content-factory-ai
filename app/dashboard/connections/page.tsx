import { Link2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Page, PageHero } from "@/app/components/ui/Page";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import { fetchStoreConnectionsSnapshot } from "@/lib/store-connections/server";
import { ConnectionsClient } from "@/app/dashboard/connections/ConnectionsClient";

export default async function ConnectionsPage() {
  const gate = await requireAuthenticatedClient();
  if (!gate.ok) {
    // Dashboard routes are typically protected by middleware; fallback safely.
    redirect("/");
  }

  const snapshot = await fetchStoreConnectionsSnapshot({
    supabase: gate.supabase,
    clientId: gate.clientId,
  });

  return (
    <Page>
      <PageHero
        icon={<Link2 className="h-6 w-6" />}
        eyebrow="Integrations"
        title="Store connections"
        description="Connect your store once, then keep Products focused on product operations. Credentials are stored server-side and scoped to your current workspace."
      />

      <ConnectionsClient initial={snapshot} />
    </Page>
  );
}

