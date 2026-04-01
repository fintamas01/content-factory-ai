import { Suspense } from "react";
import { Users } from "lucide-react";
import { TeamPageClient } from "./TeamPageClient";
import { PageHero } from "@/app/components/ui/Page";
import { Spinner } from "@/app/components/ui/Spinner";

function TeamFallback() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-6xl items-center justify-center p-8">
      <Spinner className="h-10 w-10" />
    </div>
  );
}

export default function DashboardTeamPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-24 p-4 sm:p-6 lg:p-8 text-white">
      <PageHero
        icon={<Users className="h-6 w-6" aria-hidden />}
        eyebrow="Workspace"
        title="Team"
        description="Who has access to this workspace. Switch clients in the sidebar to manage another team."
      />
      <Suspense fallback={<TeamFallback />}>
        <TeamPageClient />
      </Suspense>
    </div>
  );
}
