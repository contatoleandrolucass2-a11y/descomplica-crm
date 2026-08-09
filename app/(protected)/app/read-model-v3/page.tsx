import { notFound } from "next/navigation";

import { ReadModelV3Page } from "@/app/(protected)/app/_components/ReadModelV3Page";
import { isReadModelV3ShadowEnabled } from "@/lib/crm/read-model-v3/config";
import type { SearchParameterRecord } from "@/lib/crm/read-model-v3/filters";

export const metadata = {
  title: "Dashboard comercial v3 — shadow",
  robots: { index: false, follow: false },
};

export default function ReadModelV3DashboardPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<SearchParameterRecord>;
}) {
  if (!isReadModelV3ShadowEnabled()) notFound();

  return (
    <ReadModelV3Page
      action="/app/read-model-v3"
      eyebrow="Shadow autenticado"
      title="Dashboard do funil v3"
      description="Fonte única, IDs canônicos e filtros aplicados no servidor e no banco. Nenhum filtro amplia o escopo concedido."
      dataset="funnel"
      searchParams={searchParams}
      breakdown="developments"
    />
  );
}
