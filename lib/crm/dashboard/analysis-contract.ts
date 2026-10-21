import { z } from "zod";

export const DASHBOARD_CHANNELS = ["SPC - CANAL IMOB PJ", "DIRECIONAL VENDAS SPC"] as const;
export const ANALYSIS_STAGE_KEYS = [
  "opportunities",
  "appointments",
  "visits",
  "folders",
  "sales",
] as const;
const date = z.iso.date().refine((value) => value.slice(0, 4) !== "0000");
function validCoverage(start: string, reference: string) {
  const monthNumber = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  return (
    start <= reference &&
    start.slice(8) === "01" &&
    monthNumber(reference) - monthNumber(start) <= 15
  );
}
const labels = z
  .array(z.string().trim().min(1).max(200))
  .max(10_000)
  .refine((values) => new Set(values).size === values.length, "Dimension labels must be unique.");
const index = z.number().int().min(-1).max(9_999);

// Compact daily aggregates, never customer records. Indices address this view's
// dictionaries only: stage, date, manager, owner, company, channel, development,
// count, sales amount, approved folders.
const factFields = [
  z.number().int().min(0).max(4),
  date,
  index,
  index,
  index,
  z.number().int().min(0).max(1),
  index,
  z.number().int().min(1).max(1_000_000_000),
  z.number().finite().min(0).max(1_000_000_000_000_000),
  z.number().int().min(0).max(1_000_000_000),
] as const;
// Version 2 appends the store index; all existing metric positions stay fixed.
export const dashboardAnalysisFactSchema = z.union([
  z.tuple(factFields),
  z.tuple([...factFields, index]),
]);
const appointmentTimestamp = z.string().datetime({ offset: true });
const appointmentLabel = z.string().trim().max(200);
export const dashboardAppointmentDetailSchema = z
  .object({
    createdAt: appointmentTimestamp,
    scheduledAt: appointmentTimestamp.nullable(),
    attendedAt: appointmentTimestamp.nullable(),
    visitPerformed: z.boolean(),
    regionalManager: appointmentLabel,
    salesManager: appointmentLabel,
    owner: appointmentLabel,
    accountName: appointmentLabel,
    accountRanking: appointmentLabel,
  })
  .strict();
export type DashboardAppointmentDetail = z.infer<typeof dashboardAppointmentDetailSchema>;
export const dashboardAnalysisViewSchema = z
  .object({
    viewKey: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    dimensions: z
      .object({
        managers: labels,
        owners: labels,
        companies: labels,
        developments: labels,
        stores: labels.optional(),
      })
      .strict(),
    facts: z.array(dashboardAnalysisFactSchema).max(100_000),
    appointments: z.array(dashboardAppointmentDetailSchema).max(20_000).optional(),
  })
  .strict()
  .superRefine((view, context) => {
    const seen = new Set<string>();
    for (const fact of view.facts) {
      const lengths = [
        view.dimensions.managers.length,
        view.dimensions.owners.length,
        view.dimensions.companies.length,
        view.dimensions.developments.length,
      ];
      const indices = [fact[2], fact[3], fact[4], fact[6]];
      const key = JSON.stringify([...fact.slice(0, 7), fact[10] ?? -1]);
      if (
        (view.dimensions.stores !== undefined) !== (fact.length === 11) ||
        (fact[10] !== undefined && fact[10] >= (view.dimensions.stores?.length ?? 0)) ||
        (fact[0] !== 1 && fact[10] !== undefined && fact[10] !== -1) ||
        indices.some((value, position) => value >= lengths[position]!) ||
        seen.has(key) ||
        fact[9] > fact[7] ||
        (fact[0] !== 3 && fact[9] !== 0) ||
        (fact[0] !== 4 && fact[8] !== 0)
      ) {
        context.addIssue({ code: "custom", message: "Invalid or duplicate daily aggregate." });
        return;
      }
      seen.add(key);
    }
  });
export const dashboardAnalysisSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    coverageStart: date,
    referenceDate: date,
    brokerCount: z.number().int().min(0).max(1_000_000).optional(),
    views: z.array(dashboardAnalysisViewSchema).length(3),
  })
  .strict()
  .superRefine((analysis, context) => {
    if (
      new Set(analysis.views.map((view) => view.viewKey)).size !== 3 ||
      analysis.views.some(
        (view) => analysis.version >= 2 !== (view.dimensions.stores !== undefined),
      ) ||
      (analysis.version === 3) !== (analysis.brokerCount !== undefined) ||
      analysis.views.some(
        (view) => (analysis.version === 3) !== (view.appointments !== undefined),
      ) ||
      !validCoverage(analysis.coverageStart, analysis.referenceDate) ||
      analysis.views.some((view) =>
        view.facts.some(
          (fact) => fact[1] < analysis.coverageStart || fact[1] > analysis.referenceDate,
        ),
      )
    ) {
      context.addIssue({ code: "custom", message: "Invalid analysis coverage or views." });
    }
  });

export type DashboardAnalysis = z.infer<typeof dashboardAnalysisSchema>;
export type DashboardAnalysisView = z.infer<typeof dashboardAnalysisViewSchema>;
export type DashboardAnalysisFact = z.infer<typeof dashboardAnalysisFactSchema>;
export const dashboardAnalysisSliceSchema = dashboardAnalysisViewSchema
  .safeExtend({
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    coverageStart: date,
    referenceDate: date,
    brokerCount: z.number().int().min(0).max(1_000_000).optional(),
  })
  .superRefine((slice, context) => {
    if (
      !validCoverage(slice.coverageStart, slice.referenceDate) ||
      slice.version >= 2 !== (slice.dimensions.stores !== undefined) ||
      (slice.version === 3) !==
        (slice.brokerCount !== undefined && slice.appointments !== undefined) ||
      slice.facts.some((fact) => fact[1] < slice.coverageStart || fact[1] > slice.referenceDate)
    ) {
      context.addIssue({ code: "custom", message: "Invalid analysis coverage." });
    }
  });
export type DashboardAnalysisSlice = DashboardAnalysisView &
  Pick<DashboardAnalysis, "version" | "coverageStart" | "referenceDate" | "brokerCount">;
