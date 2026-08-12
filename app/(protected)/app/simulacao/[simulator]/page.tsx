import { notFound } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { SIMULATORS, SIMULATOR_LIST, isSimulatorSlug } from "@/lib/crm/simulators/catalog";

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
  await enforcePermission("crm.simulators.view");
  const { simulator } = await params;
  if (!isSimulatorSlug(simulator)) notFound();

  return <SimulatorWorkspace definition={SIMULATORS[simulator]} />;
}
