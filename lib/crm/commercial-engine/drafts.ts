import { z } from "zod";

import type { FunnelGoals } from "@/lib/crm/goals/data";
import { POINT_METRICS, type PointMetricValues } from "@/lib/crm/points/catalog";

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const boundedDecimal = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,4})?$/);
const boundedInteger = z.string().regex(/^(0|[1-9]\d{0,5})$/);

const funnelValueKeys = [
  "sales",
  "opportunitiesRate",
  "appointmentsRate",
  "visitsRate",
  "foldersRate",
  "approvedFoldersRate",
  "brokerMinimumMonth1",
  "brokerMinimumMonth2",
  "brokerMinimumMonth3",
  "brokerMinimumMonth4Plus",
  "brokerWeeklyAppointments",
  "brokerWeeklyVisits",
  "brokerWeeklyFolders",
  "productiveTeamAppointments",
  "productiveTeamVisits",
  "productiveTeamFolders",
  "productiveTeamSales",
] as const;

const funnelValuesSchema = z
  .object(
    Object.fromEntries(funnelValueKeys.map((key) => [key, boundedDecimal])) as Record<
      (typeof funnelValueKeys)[number],
      typeof boundedDecimal
    >,
  )
  .strict();

export const funnelGoalsDraftPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("funnel-goals"),
    profile: z.enum(["dv", "partnerships"]),
    effectiveMonth: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-01$/),
    values: funnelValuesSchema,
  })
  .strict();

const pointValuesSchema = z
  .object(
    Object.fromEntries(POINT_METRICS.map((metric) => [metric.key, boundedInteger])) as Record<
      (typeof POINT_METRICS)[number]["key"],
      typeof boundedInteger
    >,
  )
  .strict();

export const pointSettingsDraftPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("point-settings"),
    weights: pointValuesSchema,
    targets: pointValuesSchema,
  })
  .strict();

export const commercialConfigurationDraftPlanSchema = z
  .object({
    ok: z.literal(true),
    mode: z.enum(["preview", "save"]),
    valid: z.boolean(),
    activationReady: z.literal(false),
    reasonCode: z.string().nullable(),
    engineKey: z.string(),
    payloadHash: hashSchema,
    planHash: hashSchema,
    currentRevision: z.number().int().nonnegative(),
    nextRevision: z.number().int().positive(),
    revision: z.number().int().positive().optional(),
    blockers: z.array(z.string()).min(1),
  })
  .strict();

export const commercialConfigurationDraftSchema = z
  .object({
    engineKey: z.string(),
    revision: z.number().int().positive(),
    payload: z.unknown(),
    payloadHash: hashSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CommercialConfigurationDraftPlan = z.infer<
  typeof commercialConfigurationDraftPlanSchema
>;

export type CommercialDraftActionState = {
  status: "idle" | "previewed" | "saved" | "validation_error" | "conflict" | "error";
  message: string;
  planFingerprint?: string;
  revision?: number;
  blockers?: string[];
};

export const initialCommercialDraftActionState: CommercialDraftActionState = {
  status: "idle",
  message: "",
};

export function funnelDraftValuesToGoals(
  payload: z.infer<typeof funnelGoalsDraftPayloadSchema>,
  updatedAt: string,
): FunnelGoals {
  const values = Object.fromEntries(
    Object.entries(payload.values).map(([key, value]) => [key, Number(value)]),
  ) as unknown as Omit<
    FunnelGoals,
    | "profileKey"
    | "effectiveMonth"
    | "opportunities"
    | "appointments"
    | "visits"
    | "folders"
    | "approvedFolders"
    | "updatedAt"
  >;
  return {
    profileKey: payload.profile,
    effectiveMonth: payload.effectiveMonth,
    opportunities: 0,
    appointments: 0,
    visits: 0,
    folders: 0,
    approvedFolders: 0,
    ...values,
    updatedAt,
  };
}

export function pointDraftValues(payload: z.infer<typeof pointSettingsDraftPayloadSchema>): {
  weights: PointMetricValues;
  targets: PointMetricValues;
} {
  const convert = (values: z.infer<typeof pointValuesSchema>) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Number(value)]),
    ) as PointMetricValues;
  return { weights: convert(payload.weights), targets: convert(payload.targets) };
}
