import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { dashboardAnalysisSliceSchema, type DashboardAnalysisSlice } from "./analysis-contract";

import {
  DASHBOARD_STAGES,
  DASHBOARD_VIEWS,
  type DashboardStageKey,
  type DashboardViewKey,
} from "./catalog";

const nonnegativeNumber = z.number().finite().nonnegative();
const nullableNonnegativeNumber = nonnegativeNumber.nullable();
const timestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)));

const snapshotRowSchema = z.object({
  id: z.number().int().positive(),
  snapshot_key: z.string(),
  reference_date: z.string(),
  generated_at: timestamp,
  updated_at: timestamp,
  timezone: z.string(),
  source: z.string(),
  goals_available: z.boolean(),
});

const viewRowSchema = z.object({
  view_key: z.string(),
  sales_value_month: nonnegativeNumber,
  sales_value_week: nonnegativeNumber,
  sales_value_today: nonnegativeNumber,
});

const metricRowSchema = z.object({
  view_key: z.string(),
  stage_key: z.string(),
  current_month: nonnegativeNumber,
  current_week: nonnegativeNumber,
  current_today: nonnegativeNumber,
  goal_month: nonnegativeNumber,
  goal_week: nonnegativeNumber,
  goal_today: nonnegativeNumber,
  previous_month: nullableNonnegativeNumber,
  year_closed_months_average: nullableNonnegativeNumber,
  last_three_closed_months_average: nullableNonnegativeNumber,
  previous_fourteen_days: nullableNonnegativeNumber,
  last_fourteen_days: nullableNonnegativeNumber,
  previous_seven_days: nullableNonnegativeNumber,
  last_seven_days: nullableNonnegativeNumber,
  previous_week: nullableNonnegativeNumber,
  yesterday: nullableNonnegativeNumber,
});

const developmentRowSchema = z.object({
  view_key: z.string(),
  rank: z.number().int().min(1).max(5),
  name: z.string().min(1),
  total: z.number().int().positive(),
});

export interface DashboardMetric {
  currentMonth: number | null;
  currentWeek: number | null;
  currentToday: number | null;
  goalMonth: number;
  goalWeek: number;
  goalToday: number;
  previousMonth: number | null;
  yearClosedMonthsAverage: number | null;
  lastThreeClosedMonthsAverage: number | null;
  previousFourteenDays: number | null;
  lastFourteenDays: number | null;
  previousSevenDays: number | null;
  lastSevenDays: number | null;
  previousWeek: number | null;
  yesterday: number | null;
}

export interface DashboardReadModel {
  analysis?: Partial<Record<DashboardViewKey, DashboardAnalysisSlice>>;
  id: number;
  snapshotKey: string;
  referenceDate: string;
  generatedAt: string;
  updatedAt: string;
  timezone: string;
  source: string;
  goalsAvailable: boolean;
  salesValue: Partial<
    Record<DashboardViewKey, { month: number | null; week: number | null; today: number | null }>
  >;
  metrics: Partial<Record<DashboardViewKey, Record<DashboardStageKey, DashboardMetric>>>;
  topDevelopments: Partial<
    Record<DashboardViewKey, Array<{ rank: number; name: string; total: number }>>
  >;
}

export type DashboardLoadResult =
  | { status: "empty" }
  | { status: "ready"; dashboard: DashboardReadModel };

function isDashboardViewKey(value: string): value is DashboardViewKey {
  return Object.prototype.hasOwnProperty.call(DASHBOARD_VIEWS, value);
}

function isDashboardStageKey(value: string): value is DashboardStageKey {
  return Object.prototype.hasOwnProperty.call(DASHBOARD_STAGES, value);
}

function timestampVersion(value: string): string {
  // Normalize offsets without losing PostgreSQL's sub-millisecond precision.
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "";
  return `${Date.parse(value)}:${fraction.slice(3).replace(/0+$/, "")}`;
}

function sameSnapshot(
  before: z.infer<typeof snapshotRowSchema>,
  after: z.infer<typeof snapshotRowSchema>,
): boolean {
  return (
    before.id === after.id &&
    before.snapshot_key === after.snapshot_key &&
    before.reference_date === after.reference_date &&
    timestampVersion(before.generated_at) === timestampVersion(after.generated_at) &&
    timestampVersion(before.updated_at) === timestampVersion(after.updated_at) &&
    before.timezone === after.timezone &&
    before.source === after.source &&
    before.goals_available === after.goals_available
  );
}

export async function loadDashboardReadModel(
  viewKeys: readonly DashboardViewKey[],
  options: { includeTopDevelopments?: boolean; includeAnalysis?: boolean } = {},
): Promise<DashboardLoadResult> {
  const requestedViews = [...new Set(viewKeys)];
  if (requestedViews.length === 0) {
    throw new Error("Nenhuma visão autorizada foi informada para o dashboard.");
  }

  const supabase = await createClient();
  async function readSnapshot() {
    const result = await supabase
      .from("crm_dashboard_snapshots")
      .select(
        "id,snapshot_key,reference_date,generated_at,updated_at,timezone,source,goals_available",
      )
      .eq("snapshot_key", "global")
      .maybeSingle();

    if (result.error) throw new Error("Não foi possível carregar o dashboard.");
    return result.data ? snapshotRowSchema.parse(result.data) : null;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = await readSnapshot();
    if (!snapshot) return { status: "empty" };
    const developmentsRequest = options.includeTopDevelopments
      ? supabase
          .from("crm_dashboard_top_developments")
          .select("view_key,rank,name,total")
          .eq("snapshot_id", snapshot.id)
          .in("view_key", requestedViews)
          .order("rank")
      : Promise.resolve({ data: [], error: null });
    const analysisRequest = options.includeAnalysis
      ? supabase
          .from("crm_dashboard_analysis")
          .select("view_key,payload")
          .eq("snapshot_id", snapshot.id)
          .in("view_key", requestedViews)
      : Promise.resolve({ data: [], error: null });
    const [viewsResult, metricsResult, developmentsResult, analysisResult] = await Promise.all([
      supabase
        .from("crm_dashboard_views")
        .select("view_key,sales_value_month,sales_value_week,sales_value_today")
        .eq("snapshot_id", snapshot.id)
        .in("view_key", requestedViews),
      supabase
        .from("crm_dashboard_metrics")
        .select(
          "view_key,stage_key,current_month,current_week,current_today,goal_month,goal_week,goal_today,previous_month,year_closed_months_average,last_three_closed_months_average,previous_fourteen_days,last_fourteen_days,previous_seven_days,last_seven_days,previous_week,yesterday",
        )
        .eq("snapshot_id", snapshot.id)
        .in("view_key", requestedViews),
      developmentsRequest,
      analysisRequest,
    ]);

    const latestSnapshot = await readSnapshot();
    if (viewsResult.error || metricsResult.error || developmentsResult.error) {
      throw new Error("Não foi possível carregar os indicadores do dashboard.");
    }

    // A replaced snapshot can leave obsolete/incomplete child results in this read.
    if (!latestSnapshot || !sameSnapshot(snapshot, latestSnapshot)) continue;
    // An additive rollout may precede the migration; other database errors fail closed.
    if (analysisResult.error && !["42P01", "PGRST205"].includes(analysisResult.error.code)) {
      throw new Error("Não foi possível carregar os filtros do dashboard.");
    }
    const analysis: NonNullable<DashboardReadModel["analysis"]> = {};
    for (const row of analysisResult.data ?? []) {
      const slice = dashboardAnalysisSliceSchema.parse(row.payload);
      if (
        !requestedViews.includes(slice.viewKey) ||
        row.view_key !== slice.viewKey ||
        slice.referenceDate !== snapshot.reference_date
      ) {
        throw new Error("A análise do dashboard não corresponde ao snapshot.");
      }
      analysis[slice.viewKey] = slice;
    }

    const viewRows = z.array(viewRowSchema).parse(viewsResult.data ?? []);
    const metricRows = z.array(metricRowSchema).parse(metricsResult.data ?? []);
    const developmentRows = z.array(developmentRowSchema).parse(developmentsResult.data ?? []);
    const metrics = {} as DashboardReadModel["metrics"];
    const salesValue = {} as DashboardReadModel["salesValue"];
    const topDevelopments = {} as DashboardReadModel["topDevelopments"];

    for (const viewKey of requestedViews) {
      const viewRow = viewRows.find((row) => row.view_key === viewKey);
      if (!viewRow || !isDashboardViewKey(viewRow.view_key)) {
        throw new Error("O resumo por visão do dashboard está incompleto.");
      }

      salesValue[viewKey] = {
        month: viewRow.sales_value_month,
        week: viewRow.sales_value_week,
        today: viewRow.sales_value_today,
      };

      const viewMetrics = {} as Record<DashboardStageKey, DashboardMetric>;

      for (const stageKey of Object.keys(DASHBOARD_STAGES) as DashboardStageKey[]) {
        const row = metricRows.find(
          (item) => item.view_key === viewKey && item.stage_key === stageKey,
        );

        if (!row || !isDashboardViewKey(row.view_key) || !isDashboardStageKey(row.stage_key)) {
          throw new Error("O snapshot do dashboard está incompleto.");
        }

        viewMetrics[stageKey] = {
          currentMonth: row.current_month,
          currentWeek: row.current_week,
          currentToday: row.current_today,
          goalMonth: row.goal_month,
          goalWeek: row.goal_week,
          goalToday: row.goal_today,
          previousMonth: row.previous_month,
          yearClosedMonthsAverage: row.year_closed_months_average,
          lastThreeClosedMonthsAverage: row.last_three_closed_months_average,
          previousFourteenDays: row.previous_fourteen_days,
          lastFourteenDays: row.last_fourteen_days,
          previousSevenDays: row.previous_seven_days,
          lastSevenDays: row.last_seven_days,
          previousWeek: row.previous_week,
          yesterday: row.yesterday,
        };
      }

      metrics[viewKey] = viewMetrics;
      topDevelopments[viewKey] = developmentRows
        .filter((row) => row.view_key === viewKey)
        .map((row) => ({ rank: row.rank, name: row.name, total: row.total }));
    }

    return {
      status: "ready",
      dashboard: {
        id: snapshot.id,
        snapshotKey: snapshot.snapshot_key,
        referenceDate: snapshot.reference_date,
        generatedAt: snapshot.generated_at,
        updatedAt: snapshot.updated_at,
        timezone: snapshot.timezone,
        source: snapshot.source,
        goalsAvailable: snapshot.goals_available,
        ...(options.includeAnalysis ? { analysis } : {}),
        salesValue,
        metrics,
        topDevelopments,
      },
    };
  }

  throw new Error("O snapshot do dashboard mudou durante a leitura.");
}
