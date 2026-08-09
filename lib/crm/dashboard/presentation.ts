import {
  DASHBOARD_PERIODS,
  DASHBOARD_STAGES,
  type DashboardPeriodKey,
  type DashboardStageKey,
} from "./catalog";
import type { DashboardMetric } from "./data";

export function calculateConversion(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return current / previous;
}

export function calculateProgress(current: number, goal: number): number | null {
  if (goal <= 0) return null;
  return current / goal;
}

export function clampPercentage(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value * 100));
}

export type DashboardMetricMap = Record<DashboardStageKey, DashboardMetric>;

export interface FunnelReading {
  key: DashboardStageKey;
  label: string;
  value: number | null;
  conversion: number | null;
}

export function metricValueForPeriod(metric: DashboardMetric, period: DashboardPeriodKey) {
  const config = DASHBOARD_PERIODS[period];
  return {
    current: metric[config.currentField],
    goal: metric[config.goalField],
  };
}

export function buildFunnelReadings(
  metrics: DashboardMetricMap,
  valueForStage: (metric: DashboardMetric) => number | null,
): FunnelReading[] {
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;

  return stages.map(([key, stage], index) => {
    const value = valueForStage(metrics[key]);
    const previousKey = stages[index - 1]?.[0];
    const previous = previousKey ? valueForStage(metrics[previousKey]) : null;

    return {
      key,
      label: stage.label,
      value,
      conversion:
        index === 0 || value === null || previous === null
          ? null
          : calculateConversion(value, previous),
    };
  });
}

export function buildPeriodFunnelReadings(metrics: DashboardMetricMap, period: DashboardPeriodKey) {
  return buildFunnelReadings(metrics, (metric) => metricValueForPeriod(metric, period).current);
}

export const MONTHLY_FUNNEL_SNAPSHOTS = [
  { key: "current", label: "Mês atual", field: "currentMonth", requiresGoals: false },
  { key: "previous", label: "Mês anterior", field: "previousMonth", requiresGoals: false },
  {
    key: "year-average",
    label: "Média de meses encerrados no ano",
    field: "yearClosedMonthsAverage",
    requiresGoals: false,
  },
  {
    key: "three-month-average",
    label: "Média dos três meses encerrados",
    field: "lastThreeClosedMonthsAverage",
    requiresGoals: false,
  },
  { key: "goal", label: "Meta mensal", field: "goalMonth", requiresGoals: true },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  field: keyof DashboardMetric;
  requiresGoals: boolean;
}>;

export function buildMonthlyFunnelSnapshots(metrics: DashboardMetricMap, goalsAvailable: boolean) {
  return MONTHLY_FUNNEL_SNAPSHOTS.map((snapshot) => ({
    key: snapshot.key,
    label: snapshot.label,
    readings: buildFunnelReadings(metrics, (metric) => {
      const value = metric[snapshot.field];
      if (snapshot.requiresGoals && (!goalsAvailable || value === null || value <= 0)) {
        return null;
      }
      return value;
    }),
  }));
}
