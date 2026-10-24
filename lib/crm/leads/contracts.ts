import { z } from "zod";

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable();
const timestampSchema = z.string().datetime({ offset: true });

export const leadScopeSchema = z
  .object({
    id: uuidSchema,
    key: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    kind: z.string().min(1).max(80),
  })
  .strict();
export const leadScopesSchema = z.array(leadScopeSchema);

export const leadStatusSchema = z.enum(["open", "won", "lost"]);
export const leadPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const leadActivityTypeSchema = z.enum([
  "task",
  "call",
  "meeting",
  "visit",
  "follow_up",
  "note",
]);
export const leadMessageDirectionSchema = z.enum(["inbound", "outbound", "internal"]);

export const leadTagSchema = z
  .object({ id: uuidSchema, name: z.string().min(1).max(80), color: z.string() })
  .strict();

export const leadListItemSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    stageId: uuidSchema,
    sourceId: uuidSchema.nullable(),
    channelId: uuidSchema.nullable(),
    responsibleUserId: uuidSchema.nullable(),
    status: leadStatusSchema,
    priority: leadPrioritySchema,
    favorite: z.boolean(),
    archivedAt: timestampSchema.nullable(),
    closedAt: timestampSchema.nullable(),
    summary: nullableText(1000),
    version: z.coerce.number().int().positive(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    customer: z
      .object({
        id: uuidSchema,
        name: z.string().min(2).max(180),
        email: nullableText(320),
        phone: nullableText(32),
      })
      .strict(),
    interest: z
      .object({
        id: uuidSchema,
        title: nullableText(180),
        transactionKind: z.enum(["buy", "rent", "invest", "other"]).nullable(),
        propertyKind: nullableText(80),
        city: nullableText(120),
        neighborhood: nullableText(120),
      })
      .strict()
      .nullable(),
    tags: z.array(leadTagSchema),
  })
  .strict();

export const leadListResultSchema = z
  .object({
    items: z.array(leadListItemSchema),
    total: z.coerce.number().int().nonnegative(),
    limit: z.coerce.number().int().min(1).max(100),
    offset: z.coerce.number().int().nonnegative(),
  })
  .strict();

export const leadActivitiesResultSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: uuidSchema,
          leadId: uuidSchema,
          leadName: z.string().min(2).max(180),
          title: z.string().min(1).max(180),
          type: leadActivityTypeSchema,
          description: nullableText(4000),
          dueAt: timestampSchema.nullable(),
          completedAt: timestampSchema.nullable(),
          responsibleUserId: uuidSchema.nullable(),
          responsibleLabel: z.string().nullable(),
          isOverdue: z.boolean(),
          createdAt: timestampSchema,
        })
        .strict(),
    ),
    counts: z
      .object({
        all: z.coerce.number().int().nonnegative(),
        overdue: z.coerce.number().int().nonnegative(),
        today: z.coerce.number().int().nonnegative(),
        upcoming: z.coerce.number().int().nonnegative(),
        completed: z.coerce.number().int().nonnegative(),
      })
      .strict(),
    total: z.coerce.number().int().nonnegative(),
    limit: z.coerce.number().int().min(1).max(100),
    offset: z.coerce.number().int().nonnegative(),
  })
  .strict();

export const leadActivitiesFiltersSchema = z
  .object({
    organizationId: uuidSchema,
    bucket: z.enum(["all", "overdue", "today", "upcoming", "completed"]).default("all"),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict();

export const leadFunnelResultSchema = z
  .object({
    stages: z.array(
      z
        .object({
          id: uuidSchema,
          key: z.string(),
          name: z.string(),
          position: z.number().int(),
          color: z.string(),
          terminal: z.boolean(),
          won: z.boolean(),
          count: z.coerce.number().int().nonnegative(),
          cards: z.array(
            z
              .object({
                id: uuidSchema,
                name: z.string().min(2).max(180),
                responsibleUserId: uuidSchema.nullable(),
                responsibleLabel: z.string().nullable(),
                priority: leadPrioritySchema,
                favorite: z.boolean(),
                updatedAt: timestampSchema,
                version: z.coerce.number().int().positive(),
                interestTitle: nullableText(180),
                tags: z.array(leadTagSchema),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    metrics: z
      .object({
        total: z.coerce.number().int().nonnegative(),
        favorites: z.coerce.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const leadFunnelFiltersSchema = z
  .object({
    organizationId: uuidSchema,
    query: z.string().trim().max(200).optional(),
    responsibleUserId: uuidSchema.optional(),
  })
  .strict();

const catalogEntrySchema = z.object({ id: uuidSchema, key: z.string(), name: z.string() }).strict();
const stageCatalogEntrySchema = catalogEntrySchema
  .extend({
    position: z.number().int(),
    color: z.string(),
    terminal: z.boolean(),
    won: z.boolean(),
  })
  .strict();
export const leadCatalogsSchema = z
  .object({
    stages: z.array(stageCatalogEntrySchema),
    sources: z.array(catalogEntrySchema),
    channels: z.array(catalogEntrySchema),
    lostReasons: z.array(catalogEntrySchema),
    responsibles: z
      .array(z.object({ id: uuidSchema, label: z.string().min(1) }).strict())
      .default([]),
  })
  .strict();

export const leadDetailSchema = z
  .object({
    lead: z
      .object({
        id: uuidSchema,
        organizationId: uuidSchema,
        stageId: uuidSchema,
        sourceId: uuidSchema.nullable(),
        channelId: uuidSchema.nullable(),
        lostReasonId: uuidSchema.nullable(),
        responsibleUserId: uuidSchema.nullable(),
        status: leadStatusSchema,
        priority: leadPrioritySchema,
        favorite: z.boolean(),
        archivedAt: timestampSchema.nullable(),
        closedAt: timestampSchema.nullable(),
        summary: nullableText(1000),
        version: z.coerce.number().int().positive(),
        createdAt: timestampSchema,
        updatedAt: timestampSchema,
      })
      .strict(),
    customer: z
      .object({
        id: uuidSchema,
        name: z.string().min(2).max(180),
        email: nullableText(320),
        phone: nullableText(32),
        secondaryPhone: nullableText(32),
        city: nullableText(120),
        stateCode: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .nullable(),
      })
      .strict(),
    interest: z
      .object({
        id: uuidSchema,
        title: nullableText(180),
        referenceCode: nullableText(100),
        transactionKind: z.enum(["buy", "rent", "invest", "other"]).nullable(),
        propertyKind: nullableText(80),
        city: nullableText(120),
        neighborhood: nullableText(120),
        budgetMin: z.coerce.number().nonnegative().nullable(),
        budgetMax: z.coerce.number().nonnegative().nullable(),
        notes: nullableText(4000),
      })
      .strict()
      .nullable(),
    activities: z.array(
      z
        .object({
          id: uuidSchema,
          type: leadActivityTypeSchema,
          title: z.string().min(1).max(180),
          description: nullableText(4000),
          dueAt: timestampSchema.nullable(),
          completedAt: timestampSchema.nullable(),
          createdBy: uuidSchema,
          createdAt: timestampSchema,
        })
        .strict(),
    ),
    messages: z.array(
      z
        .object({
          id: uuidSchema,
          direction: leadMessageDirectionSchema,
          channelId: uuidSchema.nullable(),
          body: z.string().min(1).max(8000),
          occurredAt: timestampSchema,
          createdBy: uuidSchema,
        })
        .strict(),
    ),
    tags: z.array(leadTagSchema),
    stageHistory: z.array(
      z
        .object({
          id: uuidSchema,
          fromStageId: uuidSchema.nullable(),
          toStageId: uuidSchema,
          changedBy: uuidSchema,
          reason: nullableText(500),
          createdAt: timestampSchema,
        })
        .strict(),
    ),
    catalogs: leadCatalogsSchema.omit({ responsibles: true }),
  })
  .strict();

export const leadFiltersSchema = z
  .object({
    organizationId: uuidSchema,
    query: z.string().trim().max(200).optional(),
    stageId: uuidSchema.optional(),
    responsibleUserId: uuidSchema.optional(),
    sourceId: uuidSchema.optional(),
    channelId: uuidSchema.optional(),
    status: leadStatusSchema.optional(),
    favorite: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict();

const customerInputSchema = z
  .object({
    name: z.string().trim().min(2).max(180),
    email: z.string().trim().email().max(320).nullable().default(null),
    phone: nullableText(32).default(null),
    secondaryPhone: nullableText(32).default(null),
    city: nullableText(120).default(null),
    stateCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .default(null),
  })
  .strict();
const interestInputSchema = z
  .object({
    title: nullableText(180).default(null),
    referenceCode: nullableText(100).default(null),
    transactionKind: z.enum(["buy", "rent", "invest", "other"]).nullable().default(null),
    propertyKind: nullableText(80).default(null),
    city: nullableText(120).default(null),
    neighborhood: nullableText(120).default(null),
    budgetMin: z.number().nonnegative().nullable().default(null),
    budgetMax: z.number().nonnegative().nullable().default(null),
    notes: nullableText(4000).default(null),
  })
  .strict()
  .refine(
    ({ budgetMin, budgetMax }) =>
      budgetMin === null || budgetMax === null || budgetMin <= budgetMax,
    "A faixa de orçamento é inválida.",
  );

export const leadInputSchema = z
  .object({
    organizationId: uuidSchema,
    stageId: uuidSchema,
    sourceId: uuidSchema.nullable().default(null),
    channelId: uuidSchema.nullable().default(null),
    responsibleUserId: uuidSchema.nullable().default(null),
    priority: leadPrioritySchema.default("normal"),
    favorite: z.boolean().default(false),
    summary: nullableText(1000).default(null),
    sourceSystem: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
      .default("native"),
    sourceRecordId: nullableText(200).default(null),
    customer: customerInputSchema,
    interest: interestInputSchema.nullable().default(null),
  })
  .strict();

export const leadSaveCommandSchema = z
  .object({
    leadId: uuidSchema.nullable(),
    expectedVersion: z.number().int().positive().nullable(),
    idempotencyKey: z.string().min(8).max(200),
    input: leadInputSchema,
  })
  .strict()
  .refine(
    ({ leadId, expectedVersion }) => (leadId === null) === (expectedVersion === null),
    "A versão é obrigatória para editar um lead.",
  );

export const leadMutationOperationSchema = z.enum([
  "assign",
  "move_stage",
  "set_favorite",
  "archive",
  "rescue",
  "close",
  "add_activity",
  "update_activity",
  "delete_activity",
  "add_message",
  "delete_message",
  "set_tags",
]);
const versionedMutation = {
  leadId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(200),
};
const interactionMutation = {
  leadId: uuidSchema,
  expectedVersion: z.null(),
  idempotencyKey: z.string().min(8).max(200),
};
const emptyPayloadSchema = z.object({}).strict();
export const leadMutationCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      ...versionedMutation,
      operation: z.literal("assign"),
      payload: z.object({ responsibleUserId: uuidSchema.nullable() }).strict(),
    })
    .strict(),
  z
    .object({
      ...versionedMutation,
      operation: z.literal("move_stage"),
      payload: z.object({ stageId: uuidSchema, reason: nullableText(500).default(null) }).strict(),
    })
    .strict(),
  z
    .object({
      ...versionedMutation,
      operation: z.literal("set_favorite"),
      payload: z.object({ favorite: z.boolean() }).strict(),
    })
    .strict(),
  z
    .object({ ...versionedMutation, operation: z.literal("archive"), payload: emptyPayloadSchema })
    .strict(),
  z
    .object({ ...versionedMutation, operation: z.literal("rescue"), payload: emptyPayloadSchema })
    .strict(),
  z
    .object({
      ...versionedMutation,
      operation: z.literal("close"),
      payload: z
        .object({
          stageId: uuidSchema,
          lostReasonId: uuidSchema.nullable(),
          reason: nullableText(500).default(null),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...interactionMutation,
      operation: z.literal("add_activity"),
      payload: z
        .object({
          type: leadActivityTypeSchema,
          title: z.string().trim().min(1).max(180),
          description: nullableText(4000).default(null),
          dueAt: timestampSchema.nullable().default(null),
          completedAt: timestampSchema.nullable().default(null),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...interactionMutation,
      operation: z.literal("update_activity"),
      payload: z
        .object({
          activityId: uuidSchema,
          type: leadActivityTypeSchema.optional(),
          title: z.string().trim().min(1).max(180).optional(),
          description: nullableText(4000).optional(),
          dueAt: timestampSchema.nullable().optional(),
          completedAt: timestampSchema.nullable().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...interactionMutation,
      operation: z.literal("delete_activity"),
      payload: z.object({ activityId: uuidSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...interactionMutation,
      operation: z.literal("add_message"),
      payload: z
        .object({
          direction: leadMessageDirectionSchema,
          channelId: uuidSchema.nullable().default(null),
          body: z.string().trim().min(1).max(8000),
          occurredAt: timestampSchema.nullable().default(null),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...interactionMutation,
      operation: z.literal("delete_message"),
      payload: z.object({ messageId: uuidSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...versionedMutation,
      operation: z.literal("set_tags"),
      payload: z
        .object({
          tagIds: z.array(uuidSchema).max(50).default([]),
          newTags: z
            .array(
              z
                .object({
                  name: z.string().trim().min(1).max(80),
                  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
                })
                .strict(),
            )
            .max(50)
            .default([]),
        })
        .strict(),
    })
    .strict(),
]);

export const leadMutationResultSchema = z
  .object({
    id: uuidSchema,
    version: z.coerce.number().int().positive(),
    created: z.boolean().optional(),
    replayed: z.boolean().optional(),
    resultId: uuidSchema.nullable().optional(),
  })
  .strict();

export type LeadFilters = z.input<typeof leadFiltersSchema>;
export type LeadScope = z.infer<typeof leadScopeSchema>;
export type LeadCatalogs = z.infer<typeof leadCatalogsSchema>;
export type LeadListResult = z.infer<typeof leadListResultSchema>;
export type LeadActivitiesFilters = z.input<typeof leadActivitiesFiltersSchema>;
export type LeadActivitiesResult = z.infer<typeof leadActivitiesResultSchema>;
export type LeadFunnelFilters = z.input<typeof leadFunnelFiltersSchema>;
export type LeadFunnelResult = z.infer<typeof leadFunnelResultSchema>;
export type LeadListItem = z.infer<typeof leadListItemSchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export type LeadInput = z.input<typeof leadInputSchema>;
export type LeadSaveCommand = z.input<typeof leadSaveCommandSchema>;
export type LeadMutationOperation = z.infer<typeof leadMutationOperationSchema>;
export type LeadMutationCommand = z.input<typeof leadMutationCommandSchema>;
export type LeadMutationResult = z.infer<typeof leadMutationResultSchema>;
