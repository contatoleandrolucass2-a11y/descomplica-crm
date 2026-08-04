export const GOAL_PROFILES = {
  dv: {
    label: "Direcional Vendas",
    description: "Equipe interna",
    href: "/app/configuracoes/metas",
  },
  partnerships: {
    label: "Canal Parcerias",
    description: "Imobiliárias parceiras",
    href: "/app/configuracoes/metas/parcerias",
  },
} as const;

export type GoalProfileKey = keyof typeof GOAL_PROFILES;

export const GOAL_STAGES = [
  { key: "opportunities", label: "Oportunidades" },
  { key: "appointments", label: "Agendamentos" },
  { key: "visits", label: "Visitas" },
  { key: "folders", label: "Pastas" },
  { key: "approvedFolders", label: "Pastas aprovadas" },
  { key: "sales", label: "Vendas" },
] as const;

export const GOAL_RATE_FIELDS = [
  { key: "opportunitiesRate", label: "Oportunidades para 1 agendamento" },
  { key: "appointmentsRate", label: "Agendamentos para 1 visita" },
  { key: "visitsRate", label: "Visitas para 1 pasta" },
  { key: "foldersRate", label: "Pastas para 1 pasta aprovada" },
  { key: "approvedFoldersRate", label: "Pastas aprovadas para 1 venda" },
] as const;

export function getVisibleStageOffset(profile: GoalProfileKey) {
  return profile === "partnerships" ? 2 : 0;
}

export function getEffectiveMonth(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(reference);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) throw new Error("Não foi possível resolver o mês de referência.");
  return `${year}-${month}-01`;
}
