import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/)
  .max(100);
const externalId = z.string().trim().min(1).max(300);
const timestamp = z.string().datetime({ offset: true });
const calendarDate = z.string().date();
const uuid = z.string().uuid();
const currencyDecimal = z
  .string()
  .regex(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/, "currency values require an exact decimal string");
const aggregateCurrencyDecimal = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,19})(\.\d{1,2})?$/,
    "aggregated currency requires an exact bounded decimal string",
  );
const monthStart = calendarDate.refine((value) => value.endsWith("-01"), {
  message: "closed months must start on the first day",
});
const FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;
const SUPPORTED_TIME_ZONE_PATTERN =
  /^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Brazil|Canada|Chile|Etc|Europe|Indian|Mexico|Pacific|US)\/[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)?$/;

function isTimeZone(value: string) {
  if (value !== "UTC" && !SUPPORTED_TIME_ZONE_PATTERN.test(value)) return false;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function dateInTimeZone(value: string, timeZone: string) {
  const date = new Date(value);
  if (!isTimeZone(timeZone) || Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function monthEnd(value: string) {
  const match = /^(\d{4})-(\d{2})-01$/.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) {
    return null;
  }

  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
}

export const readModelV3DatasetSchema = z.enum(["funnel", "ranking", "partnerships", "stock"]);
export type ReadModelV3Dataset = z.infer<typeof readModelV3DatasetSchema>;

export const readModelV3PeriodSchema = z.enum(["month", "week", "today", "custom"]);
export type ReadModelV3Period = z.infer<typeof readModelV3PeriodSchema>;

const eventDimensionsSchema = z
  .object({
    reportingScopeExternalId: externalId,
    organizationExternalId: externalId,
    teamExternalId: externalId.optional(),
    portfolioExternalId: externalId.optional(),
    coordinatorExternalId: externalId.optional(),
    managerExternalId: externalId.optional(),
    brokerExternalId: externalId.optional(),
    originExternalId: externalId.optional(),
    developmentExternalId: externalId.optional(),
    locationExternalId: externalId.optional(),
  })
  .strict()
  .superRefine((dimensions, context) => {
    if (
      !dimensions.teamExternalId &&
      (dimensions.coordinatorExternalId ||
        dimensions.managerExternalId ||
        dimensions.brokerExternalId)
    ) {
      context.addIssue({
        code: "custom",
        message: "people dimensions require an official team identity",
      });
    }
  });

const readModelV3EventSchema = z
  .object({
    sourceRecordId: externalId,
    stageKey: z.enum(["opportunities", "appointments", "visits", "folders", "sales"]),
    occurredAt: timestamp,
    commercialDate: calendarDate,
    amount: currencyDecimal.nullable(),
    dimensions: eventDimensionsSchema,
  })
  .strict();

export function createReadModelV3IngestionSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      schemaVersion: z.literal(3),
      requestId: uuid,
      datasetKey: readModelV3DatasetSchema,
      sourceKey: slug,
      workflowKey: slug,
      producerKey: slug,
      sourceSnapshotId: externalId,
      referenceDate: calendarDate,
      timezone: z.string().min(1).max(100).refine(isTimeZone, "unsupported IANA timezone"),
      generatedAt: timestamp,
      sourceUpdatedAt: timestamp.nullable(),
      coverage: z
        .object({
          start: calendarDate.nullable(),
          end: calendarDate.nullable(),
          status: z.enum(["complete", "partial", "unknown"]),
        })
        .strict(),
      sourceStatus: z.enum(["ready", "stale", "unavailable", "error"]),
      statusReason: slug.nullable(),
      qualityStatus: z.enum(["verified", "warning", "blocked"]),
      qualityIssues: z.array(slug).max(100),
      availableMeasures: z.array(z.enum(["counts", "sales_amount"])).max(2),
      coveredReportingScopeExternalIds: z.array(externalId).max(1_000),
      closedMonths: z.array(monthStart).max(60),
      records: z.array(readModelV3EventSchema).max(10_000),
    })
    .strict()
    .superRefine((payload, context) => {
      const futureLimit = now().getTime() + FUTURE_TOLERANCE_MS;
      if (Date.parse(payload.generatedAt) > futureLimit) {
        context.addIssue({
          code: "custom",
          message: "generatedAt cannot be more than five minutes in the future",
          path: ["generatedAt"],
        });
      }
      if (
        payload.sourceUpdatedAt !== null &&
        Date.parse(payload.sourceUpdatedAt) > Date.parse(payload.generatedAt)
      ) {
        context.addIssue({
          code: "custom",
          message: "sourceUpdatedAt cannot be newer than generatedAt",
          path: ["sourceUpdatedAt"],
        });
      }

      const recordIds = new Set<string>();
      for (const [index, record] of payload.records.entries()) {
        const grain = `${record.stageKey}:${record.sourceRecordId}`;
        if (recordIds.has(grain)) {
          context.addIssue({
            code: "custom",
            message: "records must be unique by stage and official source identity",
            path: ["records", index, "sourceRecordId"],
          });
        }
        recordIds.add(grain);

        if (Date.parse(record.occurredAt) > Date.parse(payload.generatedAt)) {
          context.addIssue({
            code: "custom",
            message: "record cannot be newer than its snapshot",
            path: ["records", index, "occurredAt"],
          });
        }
        const expectedCommercialDate = dateInTimeZone(record.occurredAt, payload.timezone);
        if (expectedCommercialDate !== null && record.commercialDate !== expectedCommercialDate) {
          context.addIssue({
            code: "custom",
            message: "commercialDate must match occurredAt in the source timezone",
            path: ["records", index, "commercialDate"],
          });
        }
        if (payload.availableMeasures.includes("sales_amount")) {
          if (record.stageKey === "sales" && record.amount === null) {
            context.addIssue({
              code: "custom",
              message: "available sales amount requires values on sales records",
              path: ["records", index, "amount"],
            });
          }
        } else if (record.amount !== null) {
          context.addIssue({
            code: "custom",
            message: "unavailable sales amount cannot carry values",
            path: ["records", index, "amount"],
          });
        }
      }

      if (new Set(payload.qualityIssues).size !== payload.qualityIssues.length) {
        context.addIssue({ code: "custom", message: "quality issue codes must be unique" });
      }
      if (new Set(payload.availableMeasures).size !== payload.availableMeasures.length) {
        context.addIssue({ code: "custom", message: "available measures must be unique" });
      }
      if (
        new Set(payload.coveredReportingScopeExternalIds).size !==
        payload.coveredReportingScopeExternalIds.length
      ) {
        context.addIssue({ code: "custom", message: "covered reporting scopes must be unique" });
      }
      if (new Set(payload.closedMonths).size !== payload.closedMonths.length) {
        context.addIssue({ code: "custom", message: "closed months must be unique" });
      }
      if (payload.sourceStatus === "ready" && payload.statusReason !== null) {
        context.addIssue({ code: "custom", message: "ready sources cannot carry an error reason" });
      }
      if (payload.sourceStatus !== "ready" && payload.statusReason === null) {
        context.addIssue({ code: "custom", message: "non-ready sources require a reason code" });
      }
      if (
        ["ready", "stale"].includes(payload.sourceStatus) &&
        (!payload.sourceUpdatedAt ||
          !payload.availableMeasures.includes("counts") ||
          payload.coveredReportingScopeExternalIds.length === 0)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "readable sources require a watermark, the counts measure and explicit scope coverage",
        });
      }
      if (["unavailable", "error"].includes(payload.sourceStatus) && payload.records.length > 0) {
        context.addIssue({ code: "custom", message: "unavailable sources cannot carry records" });
      }
      if (payload.qualityStatus === "verified" && payload.qualityIssues.length > 0) {
        context.addIssue({ code: "custom", message: "verified quality cannot carry issues" });
      }
      if (payload.qualityStatus !== "verified" && payload.qualityIssues.length === 0) {
        context.addIssue({ code: "custom", message: "non-verified quality requires issue codes" });
      }
      if (payload.coverage.status === "unknown") {
        if (payload.coverage.start !== null || payload.coverage.end !== null) {
          context.addIssue({ code: "custom", message: "unknown coverage cannot claim bounds" });
        }
      } else if (!payload.coverage.start || !payload.coverage.end) {
        context.addIssue({ code: "custom", message: "known coverage requires both bounds" });
      } else {
        if (payload.coverage.end < payload.coverage.start) {
          context.addIssue({
            code: "custom",
            message: "coverage end cannot precede coverage start",
            path: ["coverage", "end"],
          });
        }
        if (
          payload.referenceDate < payload.coverage.start ||
          payload.referenceDate > payload.coverage.end
        ) {
          context.addIssue({
            code: "custom",
            message: "referenceDate must be contained by known coverage",
            path: ["referenceDate"],
          });
        }
      }

      if (payload.closedMonths.length > 0 && payload.coverage.status !== "complete") {
        context.addIssue({
          code: "custom",
          message: "closed-month averages require certified complete coverage",
        });
      }
      if (payload.closedMonths.length > 0 && payload.sourceUpdatedAt === null) {
        context.addIssue({
          code: "custom",
          message: "closed-month certification requires a source watermark",
        });
      }

      const referenceMonth = `${payload.referenceDate.slice(0, 7)}-01`;
      for (const [index, closedMonth] of payload.closedMonths.entries()) {
        if (closedMonth >= referenceMonth) {
          context.addIssue({
            code: "custom",
            message: "closed months must precede the reference month",
            path: ["closedMonths", index],
          });
        }
        if (payload.coverage.start !== null && closedMonth < payload.coverage.start) {
          context.addIssue({
            code: "custom",
            message: "closed months must start within coverage",
            path: ["closedMonths", index],
          });
        }
        const closedMonthEnd = monthEnd(closedMonth);
        if (
          payload.coverage.end !== null &&
          closedMonthEnd !== null &&
          closedMonthEnd > payload.coverage.end
        ) {
          context.addIssue({
            code: "custom",
            message: "closed months must be fully contained by coverage",
            path: ["closedMonths", index],
          });
        }
      }
    });
}

export const readModelV3IngestionSchema = createReadModelV3IngestionSchema();

const filterOptionSchema = z.object({ id: uuid, label: z.string().min(1) }).strict();
const optionListSchema = z.array(filterOptionSchema).max(100);
const truncatedOptionSchema = z.enum([
  "organizations",
  "teams",
  "portfolios",
  "coordinators",
  "managers",
  "brokers",
  "origins",
  "developments",
  "locations",
]);
const truncatedOptionsSchema = z
  .array(truncatedOptionSchema)
  .max(9)
  .refine(
    (values) => values.join("\u0000") === [...new Set(values)].sort().join("\u0000"),
    "truncated option keys must be unique and sorted",
  );

export const readModelV3ScopeSchema = z
  .object({
    scope_id: uuid,
    scope_key: slug,
    scope_type: z.enum(["global", "organization", "team", "portfolio", "person"]),
    scope_label: z.string().min(1),
  })
  .strict();

const sourceSchema = z
  .object({
    sourceKey: slug,
    workflowKey: slug,
    producerKey: slug,
    referenceDate: calendarDate,
    generatedAt: timestamp,
    sourceUpdatedAt: timestamp.nullable(),
    timezone: z.string().min(1).max(100).refine(isTimeZone, "unsupported IANA timezone"),
    coverageStart: calendarDate.nullable(),
    coverageEnd: calendarDate.nullable(),
    coverageStatus: z.enum(["complete", "partial", "unknown"]),
    sourceStatus: z.enum(["ready", "stale", "unavailable", "error"]),
    qualityStatus: z.enum(["verified", "warning", "blocked"]),
    qualityIssues: z.array(slug),
  })
  .strict();

const stageMetricSchema = z
  .object({
    stageKey: z.enum(["opportunities", "appointments", "visits", "folders", "sales"]),
    value: z.number().int().nonnegative().nullable(),
    conversion: z.number().finite().nonnegative().nullable(),
    closedMonthsAverage: z.number().finite().nonnegative().nullable(),
  })
  .strict();

const breakdownSchema = z
  .object({ id: uuid, label: z.string().min(1), total: z.number().int().nonnegative() })
  .strict();

export const readModelV3ResponseSchema = z
  .object({
    schemaVersion: z.literal(3),
    dataStatus: z.enum(["ready", "empty", "stale", "unavailable", "error"]),
    reasonCode: slug.nullable(),
    scopeId: uuid,
    datasetKey: readModelV3DatasetSchema,
    source: sourceSchema.nullable(),
    filters: z.record(z.string(), z.unknown()),
    options: z
      .object({
        organizations: optionListSchema,
        teams: optionListSchema,
        portfolios: optionListSchema,
        coordinators: optionListSchema,
        managers: optionListSchema,
        brokers: optionListSchema,
        origins: optionListSchema,
        developments: optionListSchema,
        locations: optionListSchema,
      })
      .strict(),
    truncatedOptions: truncatedOptionsSchema,
    metrics: z
      .object({
        stageTotals: z.array(stageMetricSchema).length(5),
        salesAmount: aggregateCurrencyDecimal.nullable(),
        goalsAvailable: z.literal(false),
        goal: z.null(),
        planningAvailable: z.literal(false),
        monthlySeries: z.array(
          z
            .object({
              monthStart: calendarDate,
              stages: z
                .object({
                  opportunities: z.number().int().nonnegative(),
                  appointments: z.number().int().nonnegative(),
                  visits: z.number().int().nonnegative(),
                  folders: z.number().int().nonnegative(),
                  sales: z.number().int().nonnegative(),
                })
                .strict(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    breakdowns: z
      .object({
        organizations: z.array(breakdownSchema),
        brokers: z.array(breakdownSchema),
        managers: z.array(breakdownSchema),
        developments: z.array(breakdownSchema),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type ReadModelV3Ingestion = z.infer<typeof readModelV3IngestionSchema>;
export type ReadModelV3Scope = z.infer<typeof readModelV3ScopeSchema>;
export type ReadModelV3Response = z.infer<typeof readModelV3ResponseSchema>;
