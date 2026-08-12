import { z } from "zod";

import { salesforceIngestionSchema } from "../ingestion/schema";

const sourceText = z.string().trim().max(300);
const requiredSourceText = sourceText.min(1);
const salesforceId = z.string().regex(/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/);

function isCalendarDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  );
}

function isSupportedSourceDate(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return isCalendarDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return !Number.isNaN(Date.parse(value));

  const local = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!local) return false;

  const [, day, month, year, hour = "00", minute = "00", second = "00"] = local;
  return (
    isCalendarDate(Number(year), Number(month), Number(day)) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59
  );
}

const sourceDate = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isSupportedSourceDate, "unsupported source date");
const sourceAmount = z.union([
  z.number().finite().min(0).max(1_000_000_000_000_000),
  z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/)
    .max(32),
]);

const activityDimensions = {
  brokerName: sourceText,
  managerName: sourceText,
  realEstateName: sourceText,
  development: sourceText,
} as const;

export const salesforceOpportunitySourceRowSchema = z
  .object({
    recordId: z.union([salesforceId, z.literal("")]),
    name: sourceText,
    createdAt: sourceDate,
    ...activityDimensions,
    businessUnit: sourceText,
  })
  .strict()
  .refine(
    (row) => row.recordId.length > 0 || row.name.length > 0,
    "opportunity requires an identity",
  );

export const salesforceAppointmentSourceRowSchema = z
  .object({
    appointmentCode: requiredSourceText,
    createdAt: sourceDate,
    ...activityDimensions,
    accountSource: sourceText,
    campaignName: sourceText,
  })
  .strict();

export const salesforceVisitSourceRowSchema = z
  .object({
    appointmentCode: requiredSourceText,
    attendedAt: sourceDate,
    ...activityDimensions,
    accountSource: sourceText,
    campaignName: sourceText,
  })
  .strict();

export const salesforceFolderSourceRowSchema = z
  .object({
    recordId: z.union([salesforceId, z.literal("")]),
    opportunityRecordId: z.union([salesforceId, z.literal("")]),
    opportunityName: sourceText,
    creditName: sourceText,
    createdAt: sourceDate,
    ...activityDimensions,
    businessUnit: sourceText,
    status: sourceText,
  })
  .strict()
  .refine(
    (row) => row.recordId.length > 0 || row.creditName.length > 0,
    "folder requires an identity",
  );

export const salesforceSaleSourceRowSchema = z
  .object({
    opportunityRecordId: z.union([salesforceId, z.literal("")]),
    opportunityName: sourceText,
    saleDate: sourceDate,
    ...activityDimensions,
    businessUnit: sourceText,
    amount: sourceAmount,
  })
  .strict()
  .refine(
    (row) => row.opportunityRecordId.length > 0 || row.opportunityName.length > 0,
    "sale requires an opportunity identity",
  );

export const salesforceBrokerSourceRowSchema = z
  .object({
    contactId: salesforceId,
    name: requiredSourceText,
    status: requiredSourceText,
  })
  .strict();

export const salesforceImobAccountSourceRowSchema = z
  .object({
    accountId: salesforceId,
    name: requiredSourceText,
  })
  .strict();

export const salesforceSourceReportsSchema = z
  .object({
    opportunities: z.array(salesforceOpportunitySourceRowSchema),
    appointments: z.array(salesforceAppointmentSourceRowSchema),
    visits: z.array(salesforceVisitSourceRowSchema),
    folders: z.array(salesforceFolderSourceRowSchema),
    sales: z.array(salesforceSaleSourceRowSchema),
    brokers: z.array(salesforceBrokerSourceRowSchema),
    imobAccounts: z.array(salesforceImobAccountSourceRowSchema),
  })
  .strict();

export const n8nSalesforceEnvelopeSchema = z.union([
  salesforceIngestionSchema,
  z.object({ body: salesforceIngestionSchema }).strict(),
]);

const qlikKey = z
  .string()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/)
  .max(100);
const qlikAmount = z.number().finite().min(0).max(1_000_000_000_000_000);
const qlikCount = z.number().int().min(0).max(1_000_000_000);
const qlikRank = z.number().int().min(1).max(1_000_000).nullable().optional();

export const qlikRankingEntrySchema = z
  .object({
    periodMonth: z.string().regex(/^\d{4}-\d{2}-01$/),
    imobKey: qlikKey,
    imobName: z.string().trim().min(1).max(200),
    vgv: qlikAmount,
    contracts: qlikCount,
    sourceRankVgv: qlikRank,
    sourceRankContracts: qlikRank,
  })
  .strict();

export function createQlikRankingIngestionSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      schemaVersion: z.literal(1),
      requestId: z.string().uuid(),
      referenceYear: z.number().int().min(2020).max(2100),
      generatedAt: z.string().datetime({ offset: true }),
      sourceUpdatedAt: z.string().datetime({ offset: true }).optional(),
      entries: z.array(qlikRankingEntrySchema).min(1).max(5_000),
    })
    .strict()
    .superRefine((payload, context) => {
      const futureLimit = now().getTime() + 5 * 60 * 1_000;
      if (Date.parse(payload.generatedAt) > futureLimit) {
        context.addIssue({
          code: "custom",
          message: "generatedAt cannot be more than five minutes in the future",
          path: ["generatedAt"],
        });
      }
      if (payload.sourceUpdatedAt && Date.parse(payload.sourceUpdatedAt) > futureLimit) {
        context.addIssue({
          code: "custom",
          message: "sourceUpdatedAt cannot be more than five minutes in the future",
          path: ["sourceUpdatedAt"],
        });
      }

      const identities = new Set<string>();
      for (const [index, entry] of payload.entries.entries()) {
        if (Number(entry.periodMonth.slice(0, 4)) !== payload.referenceYear) {
          context.addIssue({
            code: "custom",
            message: "entry year must match referenceYear",
            path: ["entries", index, "periodMonth"],
          });
        }

        const identity = `${entry.periodMonth}:${entry.imobKey}`;
        if (identities.has(identity)) {
          context.addIssue({
            code: "custom",
            message: "Qlik entries must be unique by month and real estate key",
            path: ["entries", index],
          });
        }
        identities.add(identity);
      }
    });
}

export const qlikRankingIngestionSchema = createQlikRankingIngestionSchema();

export const unavailableStockContractSchema = z
  .object({
    availability: z.literal("unavailable"),
    reason: z.literal("official_contract_missing"),
  })
  .strict();

export type SalesforceSourceReports = z.infer<typeof salesforceSourceReportsSchema>;
export type N8nSalesforceEnvelope = z.infer<typeof n8nSalesforceEnvelopeSchema>;
export type QlikRankingIngestion = z.infer<typeof qlikRankingIngestionSchema>;
export type UnavailableStockContract = z.infer<typeof unavailableStockContractSchema>;
