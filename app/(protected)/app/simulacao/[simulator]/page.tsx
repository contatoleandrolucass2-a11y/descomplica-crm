import { notFound } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { SIMULATORS, SIMULATOR_LIST, isSimulatorSlug } from "@/lib/crm/simulators/catalog";
import {
  OFFICIAL_SIMULATOR_SLUGS,
  officialSimulatorIsImplemented,
} from "@/lib/crm/simulators/official/catalog";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorIsEnabled,
} from "@/lib/crm/simulators/official/config";

import { SimulatorWorkspace } from "../_components/SimulatorWorkspace";

export const metadata = { title: "Simulação comercial" };

export function generateStaticParams() {
  return SIMULATOR_LIST.map((simulator) => ({ simulator: simulator.slug }));
}

export default async function SimulatorPage({
  params,
}: {
  params: Promise<{ simulator: string }>;
}) {
  const authorization = await enforcePermission("crm.simulators.view");
  const { simulator } = await params;
  if (!isSimulatorSlug(simulator)) notFound();

  const configuration = getOfficialSimulatorRuntimeConfiguration();
  const engineKey = OFFICIAL_SIMULATOR_SLUGS[simulator];
  const runtimeEnabled =
    officialSimulatorIsImplemented(simulator) &&
    officialSimulatorIsEnabled(configuration, engineKey);
  const executionEnabled =
    runtimeEnabled &&
    authorization.roleKey === "master" &&
    authorization.permissions.includes("crm.simulators.execute");
  const executionReason = runtimeEnabled
    ? "Disponível somente para o perfil Master nesta etapa de validação."
    : "Cálculo temporariamente indisponível — regra aguardando validação";

  return (
    <SimulatorWorkspace
      definition={SIMULATORS[simulator]}
      executionEnabled={executionEnabled}
      executionReason={executionReason}
    />
  );
}
