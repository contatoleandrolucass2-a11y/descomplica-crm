import { z } from "zod";

import { DASHBOARD_STAGES, DASHBOARD_VIEWS } from "../dashboard/catalog";
import { RANKING_PERIODS } from "../ranking/catalog";

const count = z.number().int().min(0).max(1_000_000_000);
const amount = z.number().finite().min(0).max(1_000_000_000_000_000);
const nullableCount = count.nullable();
const nullableAmount = amount.nullable();
const timestamp = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const key = z
  .string()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/)
  .max(100);
const label = z.string().trim().min(1).max(200);

const dashboardViewKeys = Object.keys(DASHBOARD_VIEWS);
const dashboardStageKeys = Object.keys(DASHBOARD_STAGES);
const rankingPeriodKeys = Object.keys(RANKING_PERIODS);

const dashboardViewSchema = z
  .object({
    viewKey: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    salesValueMonth: amount,
    salesValueWeek: amount,
    salesValueToday: amount,
  })
  .strict();

const dashboardMetricSchema = z
  .object({
    viewKey: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    stageKey: z.enum(["opportunities", "appointments", "visits", "folders", "sales"]),
    currentMonth: count,
    currentWeek: count,
    currentToday: count,
    goalMonth: amount,
    goalWeek: amount,
    goalToday: amount,
    previousMonth: nullableCount,
    yearClosedMonthsAverage: nullableAmount,
    lastThreeClosedMonthsAverage: nullableAmount,
    previousFourteenDays: nullableCount,
    lastFourteenDays: nullableCount,
    previousSevenDays: nullableCount,
    lastSevenDays: nullableCount,
    previousWeek: nullableCount,
    yesterday: nullableCount,
  })
  .strict();

const topDevelopmentSchema = z
  .object({
    viewKey: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    rank: z.number().int().min(1).max(5),
    name: label,
    total: count.min(1),
  })
  .strict();

const dashboardSchema = z
  .object({
    snapshotKey: key,
    referenceDate: date,
    generatedAt: timestamp,
    timezone: label.max(100),
    source: label,
    goalsAvailable: z.boolean(),
    views: z.array(dashboardViewSchema).length(3),
    metrics: z.array(dashboardMetricSchema).length(15),
    topDevelopments: z.array(topDevelopmentSchema).max(15),
  })
  .strict()
  .superRefine((dashboard, context) => {
    const receivedViews = new Set(dashboard.views.map((view) => view.viewKey));
    if (receivedViews.size !== dashboardViewKeys.length) {
      context.addIssue({ code: "custom", message: "dashboard views must be unique" });
    }

    const receivedMetrics = new Set(
      dashboard.metrics.map((metric) => `${metric.viewKey}:${metric.stageKey}`),
    );
    if (receivedMetrics.size !== dashboardViewKeys.length * dashboardStageKeys.length) {
      context.addIssue({
        code: "custom",
        message: "dashboard metrics must be complete and unique",
      });
    }

    const developmentRanks = new Set<string>();
    const developmentNames = new Set<string>();
    const countsByView = new Map<string, number>();
    for (const development of dashboard.topDevelopments) {
      const rankKey = `${development.viewKey}:${development.rank}`;
      const nameKey = `${development.viewKey}:${development.name.toLocaleLowerCase("pt-BR")}`;
      if (developmentRanks.has(rankKey) || developmentNames.has(nameKey)) {
        context.addIssue({ code: "custom", message: "top developments must be unique" });
      }
      developmentRanks.add(rankKey);
      developmentNames.add(nameKey);
      countsByView.set(development.viewKey, (countsByView.get(development.viewKey) ?? 0) + 1);
    }
    if ([...countsByView.values()].some((value) => value > 5)) {
      context.addIssue({ code: "custom", message: "each view accepts at most five developments" });
    }
  });

const rankingParticipantSchema = z
  .object({
    periodKey: z.enum(["month", "last_week", "week", "today"]),
    brokerKey: key,
    brokerName: label,
    managerName: label,
    roulette: count,
    rouletteSaturday: count,
    rouletteSunday: count,
    schedule: count,
    visit: count,
    approvedFolder: count,
    sale: count,
  })
  .strict();

const rankingSchema = z
  .object({
    snapshotKey: key,
    referenceDate: date,
    generatedAt: timestamp,
    timezone: label.max(100),
    source: label,
    rouletteAvailable: z.boolean(),
    participants: z.array(rankingParticipantSchema).max(2_000),
  })
  .strict()
  .superRefine((ranking, context) => {
    const identities = new Set(
      ranking.participants.map(
        (participant) => `${participant.periodKey}:${participant.brokerKey}`,
      ),
    );
    if (identities.size !== ranking.participants.length) {
      context.addIssue({ code: "custom", message: "ranking participants must be unique" });
    }
    if (
      ranking.participants.some((participant) => !rankingPeriodKeys.includes(participant.periodKey))
    ) {
      context.addIssue({ code: "custom", message: "unknown ranking period" });
    }
  });

export const salesforceIngestionSchema = z
  .object({
    schemaVersion: z.literal(2),
    requestId: z.string().uuid(),
    workflow: key,
    dashboard: dashboardSchema,
    ranking: rankingSchema.optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (
      !payload.dashboard.goalsAvailable &&
      payload.dashboard.metrics.some(
        (metric) => metric.goalMonth !== 0 || metric.goalWeek !== 0 || metric.goalToday !== 0,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "unavailable goals must use zero as technical storage only",
      });
    }
    if (
      payload.ranking &&
      !payload.ranking.rouletteAvailable &&
      payload.ranking.participants.some(
        (participant) =>
          participant.roulette !== 0 ||
          participant.rouletteSaturday !== 0 ||
          participant.rouletteSunday !== 0,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "unavailable roulette data must use zero as technical storage only",
      });
    }
    if (
      payload.ranking &&
      (payload.ranking.generatedAt !== payload.dashboard.generatedAt ||
        payload.ranking.referenceDate !== payload.dashboard.referenceDate)
    ) {
      context.addIssue({
        code: "custom",
        message: "dashboard and ranking must belong to the same snapshot",
      });
    }
  });

export type SalesforceIngestionPayload = z.infer<typeof salesforceIngestionSchema>;

export const syncStatusRowSchema = z.object({
  generated_at: timestamp.nullable(),
  last_ingest_at: timestamp.nullable(),
  last_ingest_status: z.enum(["running", "succeeded", "failed"]).nullable(),
  refresh_status: z.enum(["running", "succeeded", "failed"]).nullable(),
  refresh_requested_at: timestamp.nullable(),
});
