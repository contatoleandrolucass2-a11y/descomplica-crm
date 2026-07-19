import type { DashboardView } from "./types";

export type StageMetricKey = keyof DashboardView["metrics"];
export type StageSlug =
  | "oportunidades"
  | "agendamentos"
  | "visitas"
  | "pastas"
  | "vendas";

export type StageConfig = {
  slug: StageSlug;
  key: StageMetricKey;
  label: string;
  short: string;
  color: string;
  funnelColor: string;
  description: string;
};

export const STAGES: readonly StageConfig[] = [
  {
    slug: "oportunidades",
    key: "opportunities",
    label: "Oportunidades",
    short: "Oportunidades",
    color: "#2563eb",
    funnelColor: "#173b68",
    description: "Volume de entrada disponível para prospecção e atendimento.",
  },
  {
    slug: "agendamentos",
    key: "appointments",
    label: "Agendamentos",
    short: "Agendamentos",
    color: "#0891b2",
    funnelColor: "#155e75",
    description: "Oportunidades que avançaram para uma data de atendimento.",
  },
  {
    slug: "visitas",
    key: "visits",
    label: "Visitas",
    short: "Visitas",
    color: "#7c3aed",
    funnelColor: "#0e7490",
    description: "Agendamentos convertidos em visita efetivamente realizada.",
  },
  {
    slug: "pastas",
    key: "folders",
    label: "Pastas",
    short: "Pastas",
    color: "#d97706",
    funnelColor: "#0891b2",
    description: "Clientes com documentação em preparação ou análise.",
  },
  {
    slug: "vendas",
    key: "sales",
    label: "Vendas",
    short: "Vendas",
    color: "#059669",
    funnelColor: "#0f766e",
    description: "Negócios concluídos no período selecionado.",
  },
] as const;

export const ACTION_PLANS: Record<StageMetricKey, string> = {
  opportunities:
    "Reforçar captação e redistribuir oportunidades sem atendimento.",
  appointments:
    "Aumentar cadência de contato e confirmar interesse antes do agendamento.",
  visits:
    "Confirmar agenda com antecedência e remarcar faltas no mesmo dia.",
  folders: "Mapear pendências e fazer mutirão diário de documentos.",
  sales:
    "Priorizar propostas quentes, tratar objeções e fechar o próximo passo com prazo.",
};

export function getStageBySlug(slug: string) {
  return STAGES.find((stage) => stage.slug === slug);
}
