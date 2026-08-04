import { notFound } from "next/navigation";

import { RoutePlaceholder } from "@/app/(protected)/app/_components/RoutePlaceholder";
import { enforcePermission } from "@/lib/authorization/enforce";

const STAGES = {
  oportunidades: "Oportunidades",
  agendamentos: "Agendamentos",
  visitas: "Visitas",
  pastas: "Pastas",
  vendas: "Vendas",
} as const;

type Stage = keyof typeof STAGES;

function isStage(value: string): value is Stage {
  return Object.prototype.hasOwnProperty.call(STAGES, value);
}

export function generateStaticParams() {
  return Object.keys(STAGES).map((stage) => ({ stage }));
}

export default async function StagePage({ params }: { params: Promise<{ stage: string }> }) {
  await enforcePermission("crm.stages.view");
  const { stage } = await params;

  if (!isStage(stage)) notFound();

  return (
    <RoutePlaceholder
      eyebrow="Etapa do funil"
      title={STAGES[stage]}
      description={`Visão detalhada da etapa ${STAGES[stage].toLocaleLowerCase("pt-BR")} do CRM.`}
    />
  );
}
