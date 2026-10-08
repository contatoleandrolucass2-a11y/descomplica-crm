import { z } from "zod";

export const SALESFORCE_STATUS_TTL_MS = 120_000;
export const salesforceReportKeys = [
  "opportunities",
  "appointments",
  "visits",
  "folders",
  "sales",
  "brokers",
  "imobAccounts",
] as const;

const timestamp = z.iso.datetime();
const reportCounts = z
  .array(
    z
      .object({
        key: z.enum(salesforceReportKeys),
        rows: z.number().int().min(0).max(10_000_000),
      })
      .strict(),
  )
  .length(7)
  .refine((rows) => new Set(rows.map((row) => row.key)).size === 7);

export const salesforceStatusErrorSchema = z.enum([
  "session_expired",
  "browser_unavailable",
  "salesforce_unavailable",
  "export_failed",
  "publication_failed",
  "collector_stopped",
  "collector_unreachable",
]);

const observationFields = {
  checkedAt: timestamp,
  nextRunAt: timestamp.nullable(),
  cycle: z.enum(["idle", "running", "succeeded", "failed"]),
  lastExportAt: timestamp.nullable(),
  lastPublishedAt: timestamp.nullable(),
  reports: reportCounts.nullable(),
  errorCode: salesforceStatusErrorSchema.nullable(),
};

export const salesforceObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    organization: z.literal("direcional"),
    observedAt: timestamp,
    state: z.enum(["connected", "reauth_required", "unavailable"]),
    ...observationFields,
  })
  .strict()
  .superRefine((value, context) => {
    const observedAt = Date.parse(value.observedAt);
    for (const field of ["checkedAt", "lastExportAt", "lastPublishedAt"] as const) {
      if (value[field] && Date.parse(value[field]) > observedAt) {
        context.addIssue({ code: "custom", path: [field], message: "Future observation" });
      }
    }
    if (value.reports !== null && value.lastExportAt === null) {
      context.addIssue({ code: "custom", path: ["reports"], message: "Export evidence required" });
    }
    if (value.lastPublishedAt !== null && value.lastExportAt === null) {
      context.addIssue({
        code: "custom",
        path: ["lastPublishedAt"],
        message: "Export evidence required",
      });
    }
  });

export const salesforceConnectionSnapshotSchema = z
  .object({
    state: z.enum([
      "unconfigured",
      "waiting",
      "connected",
      "reauth_required",
      "unavailable",
      "stale",
    ]),
    ...observationFields,
    checkedAt: timestamp.nullable(),
    receivedAt: timestamp.nullable(),
  })
  .strict();

export type SalesforceObservation = z.infer<typeof salesforceObservationSchema>;
export type SalesforceConnectionSnapshot = z.infer<typeof salesforceConnectionSnapshotSchema>;

export function emptySalesforceConnectionSnapshot(
  state: SalesforceConnectionSnapshot["state"] = "waiting",
): SalesforceConnectionSnapshot {
  return {
    state,
    checkedAt: null,
    receivedAt: null,
    nextRunAt: null,
    cycle: "idle",
    lastExportAt: null,
    lastPublishedAt: null,
    reports: null,
    errorCode: null,
  };
}
