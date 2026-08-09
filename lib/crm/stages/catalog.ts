import type { DashboardStageKey } from "@/lib/crm/dashboard/catalog";

export const CRM_STAGES = [
  {
    slug: "oportunidades",
    key: "opportunities",
    label: "Oportunidades",
    description: "Entrada do funil e volume disponível para contato comercial.",
    accent: "cyan",
  },
  {
    slug: "agendamentos",
    key: "appointments",
    label: "Agendamentos",
    description: "Compromissos comerciais confirmados com os clientes.",
    accent: "blue",
  },
  {
    slug: "visitas",
    key: "visits",
    label: "Visitas",
    description: "Clientes que avançaram para conhecer os empreendimentos.",
    accent: "violet",
  },
  {
    slug: "pastas",
    key: "folders",
    label: "Pastas",
    description: "Propostas e documentos encaminhados para análise.",
    accent: "teal",
  },
  {
    slug: "vendas",
    key: "sales",
    label: "Vendas",
    description: "Conversões concluídas no fim do funil comercial.",
    accent: "emerald",
  },
] as const satisfies ReadonlyArray<{
  slug: string;
  key: DashboardStageKey;
  label: string;
  description: string;
  accent: string;
}>;

export type CrmStage = (typeof CRM_STAGES)[number];
export type CrmStageSlug = CrmStage["slug"];

export function getCrmStage(slug: string): CrmStage | null {
  return CRM_STAGES.find((stage) => stage.slug === slug) ?? null;
}
