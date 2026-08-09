import type { DashboardMetric } from "@/lib/crm/dashboard/data";

export type StageComparison = {
  label: string;
  previousLabel: string;
  previous: number | null;
  currentLabel: string;
  current: number | null;
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
      current: metric.lastFourteenDays,
      goal: null,
    },
    {
      label: "7 dias",
      previousLabel: "7 dias anteriores",
      previous: metric.previousSevenDays,
      currentLabel: "Últimos 7 dias",
      current: metric.lastSevenDays,
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
