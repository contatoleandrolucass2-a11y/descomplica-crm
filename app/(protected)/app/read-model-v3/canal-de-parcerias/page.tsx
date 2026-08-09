import { notFound } from "next/navigation";

import { ReadModelV3Page } from "@/app/(protected)/app/_components/ReadModelV3Page";
import { isReadModelV3ShadowEnabled } from "@/lib/crm/read-model-v3/config";
import type { SearchParameterRecord } from "@/lib/crm/read-model-v3/filters";

export const metadata = {
  title: "Canal de Parcerias v3 — shadow",
  robots: { index: false, follow: false },
};

export default function ReadModelV3PartnershipsPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<SearchParameterRecord>;
}) {
  if (!isReadModelV3ShadowEnabled()) notFound();

  return (
    <ReadModelV3Page
      action="/app/read-model-v3/canal-de-parcerias"
      eyebrow="Shadow autenticado"
      title="Performance das parcerias v3"
      description="Leitura preparada para o contrato oficial Qlik, sem acesso direto às tabelas protegidas."
      dataset="partnerships"
      searchParams={searchParams}
      breakdown="organizations"
      policyNotice="O caller Qlik ativo ainda não foi identificado nominalmente e o cutover permanece bloqueado. Nenhum grant remoto foi alterado."
    />
  );
}
