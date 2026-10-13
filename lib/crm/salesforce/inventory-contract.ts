import { z } from "zod";

const text = z.string().max(20_000).nullable();
const amount = z.number().finite().nonnegative().nullable();
const integer = z.number().int().nonnegative().nullable();
const itemSchema = z
  .object({
    id: z.string().regex(/^a0Q[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/u),
    businessUnit: z.string().min(1),
    project: z.string().min(1),
    product: z.string().min(1),
    description: text,
    identifier: text,
    plant: text,
    classification: text,
    unitType: text,
    building: text,
    constructionStatus: text,
    completionDate: z.iso.date().nullable(),
    postalCode: text,
    city: text,
    street: text,
    streetNumber: text,
    neighborhood: text,
    district: text,
    state: text,
    status: z.string().min(1).max(200),
    launchPrice: amount,
    appraisal: amount,
    finalWithKit: amount,
    unitBonus: amount,
    tableSlack: amount,
    cashBackSlack: amount,
    minimumSignal: amount,
    finalPrice: amount,
    privateArea: amount,
    rooms: integer,
    parkingSpaces: integer,
    floor: integer,
    finalUnit: integer,
    progress: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const salesforceInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal("Salesforce · ESTOQUE SPC"),
    sourceKind: z.literal("live"),
    reportId: z.literal("00OU6000007yRpKMAU"),
    generatedAt: z.iso.datetime(),
    sourceRows: z.number().int().positive().max(100_000),
    duplicateRows: z.number().int().nonnegative(),
    projectCount: z.number().int().positive(),
    count: z.number().int().positive().max(100_000),
    items: z.array(itemSchema).max(100_000),
  })
  .strict()
  .refine(
    (value) =>
      value.items.length === value.count &&
      value.sourceRows === value.count + value.duplicateRows &&
      new Set(value.items.map((item) => item.id)).size === value.count &&
      new Set(value.items.map((item) => item.project)).size === value.projectCount,
  );
