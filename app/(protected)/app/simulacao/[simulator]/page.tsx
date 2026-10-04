import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { SIMULATORS, isSimulatorSlug } from "@/lib/crm/simulators/catalog";
import { isOfficialSimulatorSlug } from "@/lib/crm/simulators/official/catalog";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorExecutionIsEnabled,
  officialSimulatorRuntimeIsEnabled,
} from "@/lib/crm/simulators/official/config";

import { SimulatorWorkspace } from "../_components/SimulatorWorkspace";
import { AssociativeTableArchive } from "../_components/AssociativeTableArchive";
import { DirectTableArchive } from "../_components/DirectTableArchive";
import { InvestorTableArchive } from "../_components/InvestorTableArchive";
import { DocumentationArchive } from "../_components/DocumentationArchive";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ simulator: string }>;
}): Promise<Metadata> {
  const { simulator } = await params;
  if (simulator === "tabela-direta") {
    return {
      title: "Simulador Tabela Direta",
      description:
        "Escolha uma das quatro opções da Tabela Direta, personalize o fluxo e valide pré-chaves, pós-chaves e análise de crédito.",
      alternates: { canonical: "/app/simulacao/tabela-direta" },
    };
  }
  if (simulator === "associativo-fluxo-linear") {
    return { title: "Simulador Tabela Associativo" };
  }
  if (simulator === "calcular-documentacao") {
    return { title: "Calcular documentação" };
  }
  return { title: "Simulação comercial" };
}

export default async function SimulatorPage({
  params,
}: {
  params: Promise<{ simulator: string }>;
}) {
  const authorization = await enforcePermission("crm.simulators.view");
  const { simulator } = await params;
  if (!isSimulatorSlug(simulator)) notFound();
  const pageGate = getProtectedPageGate(`/app/simulacao/${simulator}`);
  if (!pageGate?.releaseEnabled) forbidden();

  const configuration = getOfficialSimulatorRuntimeConfiguration();
  const officialSlug = isOfficialSimulatorSlug(simulator) ? simulator : null;
  const visualOnly = simulator === "caixa";
  const runtimeEnabled =
    !visualOnly &&
    officialSlug !== null &&
    officialSimulatorRuntimeIsEnabled(configuration, officialSlug);
  const executionEnabled =
    !visualOnly &&
    officialSlug !== null &&
    officialSimulatorExecutionIsEnabled(configuration, officialSlug, authorization);
  const executionReason = visualOnly
    ? "A jornada CAIXA foi liberada somente para revisão visual; motor e integração bancária permanecem indisponíveis"
    : runtimeEnabled
      ? "Disponível somente para o perfil Master nesta etapa de validação."
      : "Cálculo temporariamente indisponível — regra aguardando validação";

  if (simulator === "associativo-fluxo-linear") {
    return <AssociativeTableArchive />;
  }

  if (simulator === "tabela-direta") {
    return <DirectTableArchive />;
  }

  if (simulator === "tabela-investidor") {
    return <InvestorTableArchive />;
  }

  if (simulator === "calcular-documentacao") {
    return <DocumentationArchive />;
  }

  return (
    <SimulatorWorkspace
      definition={SIMULATORS[simulator]}
      executionEnabled={executionEnabled}
      executionReason={executionReason}
    />
  );
}
