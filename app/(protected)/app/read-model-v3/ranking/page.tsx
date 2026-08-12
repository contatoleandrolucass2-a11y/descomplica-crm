import { notFound } from "next/navigation";

import { ReadModelV3Page } from "@/app/(protected)/app/_components/ReadModelV3Page";
import { isReadModelV3ShadowEnabled } from "@/lib/crm/read-model-v3/config";
import type { SearchParameterRecord } from "@/lib/crm/read-model-v3/filters";

export const metadata = {
  title: "Ranking v3 — shadow",
  robots: { index: false, follow: false },
};

export default function ReadModelV3RankingPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<SearchParameterRecord>;
}) {
  if (!isReadModelV3ShadowEnabled()) notFound();

  return (
    <ReadModelV3Page
      action="/app/read-model-v3/ranking"
      eyebrow="Shadow autenticado"
      title="Ranking v3"
      description="A camada v3 entrega apenas fatos oficiais e agrupamentos por IDs estáveis."
      dataset="ranking"
      searchParams={searchParams}
      breakdown="brokers"
      policyNotice="Ranking avançado, pesos, bônus, roleta e prêmios permanecem bloqueados até existir política comercial oficial versionada."
    />
  );
}
