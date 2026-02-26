import PosterStudioClient from "@/app/dashboard/poster/poster-studio-client";

export default function PosterPage({
  searchParams,
}: {
  searchParams?: { template?: string };
}) {
  const templateId = searchParams?.template ?? null;

  return <PosterStudioClient initialTemplateId={templateId} />;
}