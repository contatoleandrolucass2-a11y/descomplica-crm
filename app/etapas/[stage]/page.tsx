import { notFound } from "next/navigation";
import { loadDashboardPageData } from "../../dashboard-data";
import { getStageBySlug } from "../../stage-config";
import { StageDetailClient } from "../../StageDetailClient";

export const dynamic = "force-dynamic";

export default async function StagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: slug } = await params;
  const stage = getStageBySlug(slug);
  if (!stage) notFound();

  const props = await loadDashboardPageData(`/etapas/${slug}`);
  return <StageDetailClient {...props} stage={stage} />;
}
