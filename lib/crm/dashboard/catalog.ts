export const DASHBOARD_VIEWS = {
  all: {
    label: "Geral",
    description: "Visão consolidada com todas as informações disponíveis.",
  },
  with_canal_imob: {
    label: "Com Canal Imob",
    description: "Negócios associados ao canal de imobiliárias.",
  },
  without_canal_imob: {
    label: "Sem Canal Imob",
    description: "Resultado próprio, sem negócios do Canal Imob.",
  },
} as const;

export const DASHBOARD_STAGES = {
  opportunities: { label: "Oportunidades", shortLabel: "Oportunidades" },
  appointments: { label: "Agendamentos", shortLabel: "Agendamentos" },
  visits: { label: "Visitas", shortLabel: "Visitas" },
  folders: { label: "Pastas", shortLabel: "Pastas" },
  sales: { label: "Vendas", shortLabel: "Vendas" },
} as const;

export const DASHBOARD_PERIODS = {
  month: { label: "Mês", currentField: "currentMonth", goalField: "goalMonth" },
  week: { label: "Semana", currentField: "currentWeek", goalField: "goalWeek" },
  today: { label: "Hoje", currentField: "currentToday", goalField: "goalToday" },
} as const;

export type DashboardViewKey = keyof typeof DASHBOARD_VIEWS;
export type DashboardStageKey = keyof typeof DASHBOARD_STAGES;
export type DashboardPeriodKey = keyof typeof DASHBOARD_PERIODS;

export function isDashboardView(value: string | string[] | undefined): value is DashboardViewKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(DASHBOARD_VIEWS, value);
}

export function isDashboardPeriod(
  value: string | string[] | undefined,
): value is DashboardPeriodKey {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(DASHBOARD_PERIODS, value)
  );
}
