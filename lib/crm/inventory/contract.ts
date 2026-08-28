import { z } from "zod";

const shortText = z.string().trim().min(1).max(160);

export const inventorySourceItemSchema = z
  .object({
    businessUnit: shortText,
    development: shortText,
    floorPlan: shortText,
    region: shortText,
    priceCents: z.number().int().safe().nonnegative(),
    updatedAt: z.iso.datetime({ offset: true }),
    source: shortText,
  })
  .strict();

export const inventorySourceEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    items: z.array(inventorySourceItemSchema).max(20_000),
  })
  .strict();

export type InventoryItem = z.infer<typeof inventorySourceItemSchema>;

function normalizedKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function reconcileInventoryItems(items: readonly InventoryItem[]): InventoryItem[] {
  const minimumByCombination = new Map<string, InventoryItem>();
  for (const item of items) {
    const key = `${normalizedKey(item.development)}\u0000${normalizedKey(item.floorPlan)}`;
    const current = minimumByCombination.get(key);
    if (
      !current ||
      item.priceCents < current.priceCents ||
      (item.priceCents === current.priceCents && item.updatedAt > current.updatedAt)
    ) {
      minimumByCombination.set(key, item);
    }
  }

  return [...minimumByCombination.values()].sort(
    (left, right) =>
      left.priceCents - right.priceCents ||
      left.development.localeCompare(right.development, "pt-BR") ||
      left.floorPlan.localeCompare(right.floorPlan, "pt-BR"),
  );
}
