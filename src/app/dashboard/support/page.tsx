import { SupportClient } from "./support-client";

export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const params = await searchParams;
  return <SupportClient initialSubject={params.subject ?? ""} />;
}
