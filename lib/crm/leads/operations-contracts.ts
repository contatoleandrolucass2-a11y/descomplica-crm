import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const catalogToggle = z.object({ id: uuid, enabled: z.boolean() }).strict();
export const distributionDocumentSchema = z
  .object({
    queues: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
            name: z.string().trim().min(1).max(120),
            active: z.boolean().default(true),
            members: z
              .array(
                z
                  .object({
                    userId: uuid,
                    capacity: z.number().int().min(1).max(10_000),
                    weight: z.number().int().min(1).max(1000),
                    active: z.boolean().default(true),
                  })
                  .strict(),
              )
              .max(200),
          })
          .strict(),
      )
      .max(50),
    rules: z
      .array(
        z
          .object({
            queueKey: z.string(),
            fallbackQueueKey: z.string().nullable().default(null),
            name: z.string().trim().min(1).max(120),
            priority: z.number().int().min(0).max(10_000),
            criteria: z.record(z.string(), z.string()),
            active: z.boolean().default(true),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export const distributionSnapshotSchema = z
  .object({
    revision: z.coerce.number().int().nonnegative(),
    queues: z.array(z.record(z.string(), z.unknown())),
    rules: z.array(z.record(z.string(), z.unknown())),
    recentEvents: z.array(
      z
        .object({
          id: uuid,
          leadId: uuid,
          queueId: uuid.nullable(),
          ruleId: uuid.nullable(),
          assignedUserId: uuid.nullable(),
          outcome: z.enum(["assigned", "fallback", "unassigned"]),
          explanation: z.record(z.string(), z.unknown()),
          createdAt: timestamp,
        })
        .strict(),
    ),
  })
  .strict();
export const assignmentResultSchema = z
  .object({
    leadId: uuid,
    assignedUserId: uuid.nullable(),
    queueId: uuid.nullable(),
    outcome: z.enum(["assigned", "fallback", "unassigned"]),
    replayed: z.boolean(),
    explanation: z.record(z.string(), z.unknown()),
  })
  .strict();

export const reportKeySchema = z.enum([
  "general",
  "visits",
  "closed",
  "performance",
  "origin",
  "nature",
]);
export const leadReportSchema = z
  .object({
    available: z.boolean(),
    report: reportKeySchema,
    period: z.object({ from: z.string(), to: z.string() }),
    filters: z.record(z.string(), z.unknown()),
    summary: z.object({ total: z.coerce.number().nonnegative() }),
    items: z.array(z.record(z.string(), z.unknown())),
  })
  .strict();
export const exportResultSchema = z
  .object({
    rows: z.array(
      z
        .object({
          id: uuid,
          name: z.string(),
          email: z.string().nullable(),
          phone: z.string().nullable(),
          status: z.string(),
          priority: z.string(),
          stage: z.string(),
          source: z.string().nullable(),
          createdAt: timestamp,
        })
        .strict(),
    ),
    limit: z.number().int(),
    truncated: z.boolean(),
  })
  .strict();

export const leadOperationsSettingsDocumentSchema = z
  .object({
    sources: z.array(catalogToggle).max(200),
    channels: z.array(catalogToggle).max(200),
    stages: z.array(catalogToggle).max(200),
    lostReasons: z.array(catalogToggle).max(200),
    tags: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          })
          .strict(),
      )
      .max(200),
    alerts: z
      .object({
        enabled: z.boolean().optional(),
        staleLeadHours: z.number().int().min(1).max(8760).optional(),
        unassignedMinutes: z.number().int().min(1).max(10080).optional(),
        overCapacity: z.boolean().optional(),
      })
      .strict(),
    adjustments: z
      .object({
        defaultCapacity: z.number().int().min(1).max(10000).optional(),
        defaultWeight: z.number().int().min(1).max(1000).optional(),
        importRetentionHours: z.number().int().min(1).max(168).optional(),
        exportLimit: z.number().int().min(1).max(10000).optional(),
        duplicateWindowDays: z.number().int().min(0).max(3650).optional(),
        unattendedTimeoutMinutes: z.number().int().min(1).max(43200).optional(),
        assignmentPolicy: z.enum(["weighted_round_robin"]).optional(),
        publicLinkEnabled: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
export const leadOperationsSettingsSchema = z
  .object({
    revision: z.coerce.number().int().nonnegative(),
    document: leadOperationsSettingsDocumentSchema,
    updatedAt: timestamp.nullable(),
  })
  .strict();

export const importRowSchema = z
  .object({
    name: z.string().max(180).optional(),
    email: z.string().max(320).optional(),
    phone: z.string().max(64).optional(),
    interest: z.string().max(180).optional(),
    sourceKey: z.string().max(64).optional(),
    channelKey: z.string().max(64).optional(),
  })
  .strict();
const importCounts = z
  .object({
    total: z.number().int(),
    valid: z.number().int(),
    duplicate: z.number().int(),
    invalid: z.number().int(),
  })
  .strict();
export const importPreviewSchema = z
  .object({
    batchId: uuid,
    planHash: z.string().length(64),
    status: z.enum(["previewed", "applied", "expired"]),
    counts: importCounts,
    expiresAt: timestamp.optional(),
    replayed: z.boolean(),
  })
  .strict();
export const importApplySchema = z
  .object({
    batchId: uuid,
    status: z.enum(["applied", "expired"]),
    created: z.number().int(),
    skipped: z.number().int(),
    invalid: z.number().int().optional(),
    replayed: z.boolean(),
  })
  .strict();
export const importHistorySchema = z
  .object({
    items: z.array(
      z
        .object({
          id: uuid,
          fileHash: z.string().length(64),
          planHash: z.string().length(64),
          status: z.enum(["previewed", "applied", "expired"]),
          counts: importCounts,
          errors: z.record(z.string(), z.coerce.number().int()),
          createdBy: uuid,
          createdAt: timestamp,
          expiresAt: timestamp,
          appliedAt: timestamp.nullable(),
        })
        .strict(),
    ),
    total: z.coerce.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .strict();
export const operationsAuditSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: uuid,
          actorId: uuid,
          action: z.string(),
          entityType: z.string(),
          entityId: uuid.nullable(),
          revision: z.coerce.number().nullable(),
          reason: z.string().nullable(),
          metadata: z.record(z.string(), z.unknown()),
          createdAt: timestamp,
        })
        .strict(),
    ),
    total: z.coerce.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .strict();

export type DistributionDocument = z.input<typeof distributionDocumentSchema>;
export type DistributionSnapshot = z.infer<typeof distributionSnapshotSchema>;
export type LeadReport = z.infer<typeof leadReportSchema>;
export type LeadExportResult = z.infer<typeof exportResultSchema>;
export type LeadOperationsSettingsDocument = z.input<typeof leadOperationsSettingsDocumentSchema>;
export type ImportRow = z.input<typeof importRowSchema>;
