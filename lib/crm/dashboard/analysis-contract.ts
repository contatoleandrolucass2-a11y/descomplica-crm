import { z } from "zod";

export const DASHBOARD_CHANNELS = ["SPC - CANAL IMOB PJ", "DIRECIONAL VENDAS SPC"] as const;
export const ANALYSIS_STAGE_KEYS = [
  "opportunities",
  "appointments",
  "visits",
  "folders",
  "sales",
] as const;
const date = z.iso.date().refine(value => value.slice(0, 4) !== "0000");
function validCoverage(start: string, reference: string) {
  const monthNumber = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  return start <= reference && start.slice(8) === "01" && monthNumber(reference) - monthNumber(start) <= 15;
}
const labels = z
  .array(z.string().trim().min(1).max(200))
  .max(10_000)
  .refine((values) => new Set(values).size === values.length, "Dimension labels must be unique.");
const index = z.number().int().min(-1).max(9_999);

// Compact daily aggregates, never customer records. Indices address this view's
// dictionaries only: stage, date, manager, owner, company, channel, development,
// count, sales amount, approved folders.
export const dashboardAnalysisFactSchema = z.tuple([
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
]);
export const dashboardAnalysisViewSchema = z
  .object({
    viewKey: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    dimensions: z
      .object({ managers: labels, owners: labels, companies: labels, developments: labels })
      .strict(),
    facts: z.array(dashboardAnalysisFactSchema).max(100_000),
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
      const key = JSON.stringify(fact.slice(0, 7));
      if (
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
    version: z.literal(1),
    coverageStart: date,
    referenceDate: date,
    views: z.array(dashboardAnalysisViewSchema).length(3),
  })
  .strict()
  .superRefine((analysis, context) => {
    if (
      new Set(analysis.views.map((view) => view.viewKey)).size !== 3 ||
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
    version: z.literal(1),
    coverageStart: date,
    referenceDate: date,
  })
  .superRefine((slice, context) => {
    if (
      !validCoverage(slice.coverageStart, slice.referenceDate) ||
      slice.facts.some((fact) => fact[1] < slice.coverageStart || fact[1] > slice.referenceDate)
    ) {
      context.addIssue({ code: "custom", message: "Invalid analysis coverage." });
    }
  });
export type DashboardAnalysisSlice = DashboardAnalysisView &
  Pick<DashboardAnalysis, "version" | "coverageStart" | "referenceDate">;
