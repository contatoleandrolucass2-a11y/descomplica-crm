import { z } from "zod";

import {
  DASHBOARD_CARD_TYPES,
  DASHBOARD_GROUPS,
  DASHBOARD_PERIODS,
  DASHBOARD_TEXT_ALIGNMENTS,
  DASHBOARD_VERTICAL_ALIGNMENTS,
} from "@/lib/dashboard-canvas/types";
import { dashboardCardsMatchPageCatalog } from "./catalog";

export const DASHBOARD_PROFILE_MAX_BYTES = 524_288;
export const DASHBOARD_PROFILE_SCHEMA_VERSION = 2;
export const DASHBOARD_PROFILE_MAX_CARDS = 50;

const layoutLimits = {
  kpi: { minColumnSpan: 2, minHeight: 168, maxHeight: 480 },
  bars: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  "horizontal-bars": { minColumnSpan: 3, minHeight: 264, maxHeight: 816 },
  line: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  area: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  donut: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  radar: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  scatter: { minColumnSpan: 3, minHeight: 240, maxHeight: 816 },
  funnel: { minColumnSpan: 2, minHeight: 312, maxHeight: 888 },
  table: { minColumnSpan: 6, minHeight: 360, maxHeight: 1_080 },
} as const;

const forbiddenTextPattern = /[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const pageKeyPattern = /^[a-z0-9]+([._-][a-z0-9]+)*$/u;

function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

const safeText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !forbiddenTextPattern.test(value), "unsafe_text");
const optionalContentText = z
  .string()
  .trim()
  .max(240)
  .refine((value) => !forbiddenTextPattern.test(value), "unsafe_text");

export const dashboardPageKeySchema = z.string().max(160).regex(pageKeyPattern);
export const dashboardScopeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(identifierPattern)
  .nullable();
export const dashboardProfileIdSchema = z.string().uuid();
export const dashboardProfileVersionSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

const dashboardCardIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(identifierPattern)
  .refine((value) => !["__proto__", "prototype", "constructor"].includes(value));
const dashboardMetricSchema = z.string().min(1).max(100).regex(identifierPattern);
const dashboardEntityIdSchema = z.string().min(1).max(128).regex(identifierPattern);
const dashboardDateSchema = z.string().refine(isCivilDate, "invalid_civil_date");
const dashboardColorSchema = z.string().regex(/^#[0-9a-f]{6}$/iu);

const dashboardCardDocumentSchema = z
  .object({
    id: dashboardCardIdSchema,
    type: z.enum(DASHBOARD_CARD_TYPES),
    metric: dashboardMetricSchema,
    title: safeText(120).optional(),
    period: z.enum(DASHBOARD_PERIODS),
    startDate: dashboardDateSchema.optional(),
    endDate: dashboardDateSchema.optional(),
    groupBy: z.enum(DASHBOARD_GROUPS),
    entityIds: z
      .array(dashboardEntityIdSchema)
      .max(200)
      .nullable()
      .superRefine((ids, context) => {
        if (ids && new Set(ids).size !== ids.length) {
          context.addIssue({ code: "custom", message: "duplicate_entity_id" });
        }
      }),
    layout: z
      .object({
        order: z
          .number()
          .int()
          .min(0)
          .max(DASHBOARD_PROFILE_MAX_CARDS - 1),
        columnSpan: z.number().int().min(1).max(12),
        height: z.number().int().min(1).max(16_384),
        width: z.number().int().min(128).max(16_384).optional(),
      })
      .strict(),
    options: z
      .object({
        showLegend: z.boolean().optional(),
        showGoal: z.boolean().optional(),
        showCeiling: z.boolean().optional(),
        sharedScale: z.boolean().optional(),
      })
      .strict()
      .optional(),
    presentation: z
      .object({
        content: optionalContentText.optional(),
        fontScale: z.number().min(0.75).max(1.5).optional(),
        textAlign: z.enum(DASHBOARD_TEXT_ALIGNMENTS).optional(),
        verticalAlign: z.enum(DASHBOARD_VERTICAL_ALIGNMENTS).optional(),
        textColor: dashboardColorSchema.optional(),
        accentColor: dashboardColorSchema.optional(),
        barScale: z.number().min(0.5).max(1.5).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((card, context) => {
    if (card.period === "custom") {
      if (!card.startDate || !card.endDate) {
        context.addIssue({ code: "custom", message: "missing_custom_period" });
      } else if (card.startDate > card.endDate) {
        context.addIssue({ code: "custom", message: "invalid_custom_period" });
      }
      return;
    }
    if (card.startDate || card.endDate) {
      context.addIssue({ code: "custom", message: "unexpected_period_dates" });
    }
  });

// Keep the generic legacy card validator strict. Relaxed dimensions are only
// accepted by profile envelopes after their authorized page is known.
export const dashboardCardSchema = dashboardCardDocumentSchema.superRefine((card, context) => {
  const limits = layoutLimits[card.type];
  if (card.layout.columnSpan < limits.minColumnSpan) {
    context.addIssue({
      code: "custom",
      message: "invalid_card_span",
      path: ["layout", "columnSpan"],
    });
  }
  if (card.layout.height < limits.minHeight) {
    context.addIssue({
      code: "custom",
      message: "invalid_card_height",
      path: ["layout", "height"],
    });
  }
  if (card.layout.width !== undefined) {
    context.addIssue({ code: "custom", message: "invalid_card_width", path: ["layout", "width"] });
  }
});

function cardSignature(card: z.infer<typeof dashboardCardSchema>): string {
  return [
    card.type,
    card.metric,
    card.groupBy,
    card.period,
    card.startDate ?? "",
    card.endDate ?? "",
    card.entityIds === null ? "*" : [...card.entityIds].sort().join(","),
  ].join("|");
}

export function dashboardCardsMatchPageLayout(
  pageKey: string,
  cards: readonly z.infer<typeof dashboardCardSchema>[],
): boolean {
  if (pageKey === "crm.stage.appointments") {
    return cards.every((card) => card.layout.height >= 72);
  }
  return cards.every((card) => {
    const limits = layoutLimits[card.type];
    return (
      card.layout.width === undefined &&
      card.layout.columnSpan >= limits.minColumnSpan &&
      card.layout.height >= limits.minHeight &&
      card.layout.height <= limits.maxHeight
    );
  });
}

function cardsSchema(cardSchema: typeof dashboardCardSchema | typeof dashboardCardDocumentSchema) {
  return z
    .array(cardSchema)
    .max(DASHBOARD_PROFILE_MAX_CARDS)
    .superRefine((cards, context) => {
      const ids = new Set<string>();
      const orders = new Set<number>();
      const signatures = new Set<string>();
      for (const [index, card] of cards.entries()) {
        const signature = cardSignature(card);
        if (ids.has(card.id)) {
          context.addIssue({ code: "custom", message: "duplicate_card_id", path: [index, "id"] });
        }
        if (orders.has(card.layout.order)) {
          context.addIssue({
            code: "custom",
            message: "duplicate_card_order",
            path: [index, "layout", "order"],
          });
        }
        if (signatures.has(signature)) {
          context.addIssue({ code: "custom", message: "duplicate_card_signature", path: [index] });
        }
        ids.add(card.id);
        orders.add(card.layout.order);
        signatures.add(signature);
      }
    });
}

export const dashboardCardsSchema = cardsSchema(dashboardCardSchema);
const dashboardPageCardsSchema = cardsSchema(dashboardCardDocumentSchema);

export const dashboardProfileNameSchema = safeText(80);

export const dashboardProfileQuerySchema = z
  .object({
    pageKey: dashboardPageKeySchema,
    scopeKey: dashboardScopeKeySchema,
  })
  .strict();

export const dashboardProfileCreateSchema = z
  .object({
    pageKey: dashboardPageKeySchema,
    scopeKey: dashboardScopeKeySchema.optional().default(null),
    name: dashboardProfileNameSchema,
    isDefault: z.boolean().optional().default(false),
    schemaVersion: z.literal(DASHBOARD_PROFILE_SCHEMA_VERSION).optional().default(2),
    cards: dashboardPageCardsSchema,
  })
  .strict()
  .superRefine((profile, context) => {
    if (!dashboardCardsMatchPageCatalog(profile.pageKey, profile.cards)) {
      context.addIssue({ code: "custom", message: "invalid_page_catalog", path: ["cards"] });
    }
    if (!dashboardCardsMatchPageLayout(profile.pageKey, profile.cards)) {
      context.addIssue({ code: "custom", message: "invalid_page_layout", path: ["cards"] });
    }
  });

export const dashboardProfilePatchSchema = z
  .object({
    name: dashboardProfileNameSchema.optional(),
    cards: dashboardPageCardsSchema.optional(),
    schemaVersion: z.literal(DASHBOARD_PROFILE_SCHEMA_VERSION).optional(),
    version: dashboardProfileVersionSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined || value.cards !== undefined || value.schemaVersion !== undefined,
    "empty_patch",
  );

export const dashboardProfileVersionBodySchema = z
  .object({ version: dashboardProfileVersionSchema })
  .strict();

export const dashboardProfileRecordSchema = z
  .object({
    id: dashboardProfileIdSchema,
    userId: z.string().uuid(),
    pageKey: dashboardPageKeySchema,
    scopeKey: dashboardScopeKeySchema,
    name: dashboardProfileNameSchema,
    isDefault: z.boolean(),
    schemaVersion: z.literal(DASHBOARD_PROFILE_SCHEMA_VERSION),
    version: dashboardProfileVersionSchema,
    cards: dashboardPageCardsSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((profile, context) => {
    if (!dashboardCardsMatchPageCatalog(profile.pageKey, profile.cards)) {
      context.addIssue({ code: "custom", message: "invalid_page_catalog", path: ["cards"] });
    }
    if (!dashboardCardsMatchPageLayout(profile.pageKey, profile.cards)) {
      context.addIssue({ code: "custom", message: "invalid_page_layout", path: ["cards"] });
    }
  });

export const dashboardProfilesRecordSchema = z.array(dashboardProfileRecordSchema);
export const dashboardProfileDeleteResultSchema = z
  .object({
    deletedId: dashboardProfileIdSchema,
    defaultProfile: dashboardProfileRecordSchema.nullable(),
    savedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type DashboardCard = z.infer<typeof dashboardCardSchema>;
export type DashboardProfile = z.infer<typeof dashboardProfileRecordSchema>;
export type DashboardProfileCreate = z.infer<typeof dashboardProfileCreateSchema>;
export type DashboardProfilePatch = z.infer<typeof dashboardProfilePatchSchema>;
