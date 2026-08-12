import { notFound } from "next/navigation";

import { ReadModelV3Page } from "@/app/(protected)/app/_components/ReadModelV3Page";
import { isReadModelV3ShadowEnabled } from "@/lib/crm/read-model-v3/config";
import type { SearchParameterRecord } from "@/lib/crm/read-model-v3/filters";
import { CRM_STAGES, getCrmStage } from "@/lib/crm/stages/catalog";

export const metadata = {
  title: "Etapa comercial v3 — shadow",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return CRM_STAGES.map((stage) => ({ stage: stage.slug }));
}

export default async function ReadModelV3StagePage({
  params,
  searchParams = Promise.resolve({}),
}: {
  params: Promise<{ stage: string }>;
  searchParams?: Promise<SearchParameterRecord>;
}) {
  if (!isReadModelV3ShadowEnabled()) notFound();
  const { stage: stageSlug } = await params;
  const stage = getCrmStage(stageSlug);
  if (!stage) notFound();

  return (
    <ReadModelV3Page
      action={`/app/read-model-v3/etapas/${stage.slug}`}
      backHref="/app/read-model-v3"
      eyebrow="Etapa v3 em shadow"
      title={stage.label}
      description={stage.description}
      dataset="funnel"
      searchParams={searchParams}
      focusStage={stage.key}
      breakdown="brokers"
    />
  );
}
