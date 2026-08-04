import type { DashboardMetric } from "@/lib/crm/dashboard/data";

export type StageComparison = {
  label: string;
  previousLabel: string;
  previous: number | null;
  currentLabel: string;
  current: number;
  goal: number | null;
};

export function buildStageComparisons(metric: DashboardMetric): StageComparison[] {
  return [
    {
      label: "Mês",
      previousLabel: "Mês anterior",
      previous: metric.previousMonth,
      currentLabel: "Mês atual",
      current: metric.currentMonth,
      goal: metric.goalMonth,
    },
    {
      label: "14 dias",
      previousLabel: "14 dias anteriores",
      previous: metric.previousFourteenDays,
      currentLabel: "Últimos 14 dias",
      current: metric.lastFourteenDays ?? 0,
      goal: null,
    },
    {
      label: "7 dias",
      previousLabel: "7 dias anteriores",
      previous: metric.previousSevenDays,
      currentLabel: "Últimos 7 dias",
      current: metric.lastSevenDays ?? metric.currentWeek,
      goal: null,
    },
    {
      label: "Semana",
      previousLabel: "Semana passada",
      previous: metric.previousWeek,
      currentLabel: "Esta semana",
      current: metric.currentWeek,
      goal: metric.goalWeek,
    },
    {
      label: "Dia",
      previousLabel: "Ontem",
      previous: metric.yesterday,
      currentLabel: "Hoje",
      current: metric.currentToday,
      goal: metric.goalToday,
    },
  ];
}

export function stageAttainment(progress: number | null) {
  if (progress === null) return { label: "Sem meta definida", tone: "slate" } as const;
  if (progress >= 1) return { label: "Meta atingida", tone: "emerald" } as const;
  if (progress >= 0.8) return { label: "Próximo da meta", tone: "cyan" } as const;
  if (progress >= 0.5) return { label: "Atenção ao ritmo", tone: "amber" } as const;
  return { label: "Gap relevante", tone: "red" } as const;
}
