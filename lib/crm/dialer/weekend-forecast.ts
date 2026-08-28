import { z } from "zod";

const safeCount = z.number().int().min(0).max(10_000);

export const weekendForecastCellSchema = z
  .object({
    brokerKey: z.string().trim().min(1).max(80),
    developmentKey: z.string().trim().min(1).max(80),
    forecast: safeCount,
    realized: safeCount,
  })
  .strict();

export const weekendForecastWriteSchema = z
  .object({
    schemaVersion: z.literal(1),
    week: z.iso.date(),
    category: z.enum(["visits", "sales"]),
    cells: z.array(weekendForecastCellSchema).max(2_000),
  })
  .strict();

export function isMonday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1
  );
}
