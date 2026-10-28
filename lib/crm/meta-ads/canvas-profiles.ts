import { z } from "zod";

const canvasMetricSchema = z.enum(["spend", "results", "cpl", "ctr", "cpc", "cpm"]);
const canvasTypeSchema = z.enum([
  "table",
  "kpi",
  "funnel",
  "scatter",
  "bars",
  "horizontal",
  "line",
  "area",
  "donut",
  "radar",
]);
const canvasPeriodSchema = z.enum(["global", "today", "week", "month", "custom"]);
const canvasGroupSchema = z.enum(["campaign", "day", "hour"]);
const canvasCampaignModeSchema = z.enum(["global", "all", "custom"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const metaAdsCanvasScopeSchema = z.enum(["macro", "micro-sets", "micro-ads"]);

export const metaAdsCanvasCardSchema = z
  .object({
    id: z.string().uuid(),
    metric: canvasMetricSchema,
    type: canvasTypeSchema,
    period: canvasPeriodSchema,
    span: z.number().min(2).max(12),
    height: z.number().int().min(140).max(724),
    group: canvasGroupSchema,
    start: dateSchema.optional(),
    end: dateSchema.optional(),
    campaignMode: canvasCampaignModeSchema.optional(),
    campaignEntityIds: z.array(z.string().trim().min(1).max(100)).max(100).nullable().optional(),
    // Compatibilidade temporária com perfis anteriores, que salvavam a
    // posição da campanha na resposta em vez do ID estável devolvido pela Meta.
    campaignIds: z.array(z.number().int().nonnegative()).max(100).nullable().optional(),
  })
  .strict()
  .superRefine((card, context) => {
    if (card.period === "custom" && (!card.start || !card.end)) {
      context.addIssue({ code: "custom", message: "missing_custom_period" });
    }
    if (card.start && card.end && card.start > card.end) {
      context.addIssue({ code: "custom", message: "invalid_custom_period" });
    }
  });

const metaAdsCanvasProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(40),
    cards: z.array(metaAdsCanvasCardSchema).max(60),
  })
  .strict();

export const metaAdsCanvasStateSchema = z
  .object({
    activeId: z.string().uuid(),
    defaultId: z.string().uuid(),
    items: z.array(metaAdsCanvasProfileSchema).min(1).max(20),
  })
  .strict()
  .superRefine((state, context) => {
    const ids = new Set(state.items.map((item) => item.id));
    if (ids.size !== state.items.length) {
      context.addIssue({ code: "custom", message: "duplicate_profile_id" });
    }
    if (!ids.has(state.activeId) || !ids.has(state.defaultId)) {
      context.addIssue({ code: "custom", message: "missing_profile_reference" });
    }
  });

export const metaAdsCanvasSaveSchema = z
  .object({
    scope: metaAdsCanvasScopeSchema,
    state: metaAdsCanvasStateSchema,
  })
  .strict();

export const metaAdsCanvasRecordSchema = z
  .object({
    scope: metaAdsCanvasScopeSchema,
    state: metaAdsCanvasStateSchema,
    revision: z.number().int().positive(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();
