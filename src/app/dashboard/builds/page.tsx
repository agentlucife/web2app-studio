import { BuildsClient } from "./builds-client";

export const dynamic = "force-dynamic";

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; project?: string }>;
}) {
  const params = await searchParams;
  return <BuildsClient initialStatus={params.status ?? ""} projectId={params.project ?? ""} />;
}
