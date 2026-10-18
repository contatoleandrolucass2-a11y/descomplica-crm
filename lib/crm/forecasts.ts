import { z } from "zod";
import { getForecastInvalidCells, isGroupedForecastDocument } from "./forecast-grid";

export const FORECAST_MAX_COLUMNS = 30;
export const FORECAST_MAX_ROWS = 200;
export const FORECAST_MAX_CELL_LENGTH = 4000;
const id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine((value) => !["__proto__", "prototype", "constructor"].includes(value));
const column = z.object({ id, label: z.string().trim().min(1).max(120) }).strict();
const row = z
  .object({ id, cells: z.record(id, z.string().max(FORECAST_MAX_CELL_LENGTH)) })
  .strict();
const shape = {
  title: z.string().max(120),
  columns: z.array(column).min(1).max(FORECAST_MAX_COLUMNS),
  rows: z.array(row).max(FORECAST_MAX_ROWS),
};
function validGrid(value: {
  columns: { id: string }[];
  rows: { id: string; cells: Record<string, string> }[];
}) {
  const columns = new Set(value.columns.map((entry) => entry.id));
  return (
    columns.size === value.columns.length &&
    new Set(value.rows.map((entry) => entry.id)).size === value.rows.length &&
    value.rows.every(
      (entry) =>
        Object.keys(entry.cells).length === columns.size &&
        Object.keys(entry.cells).every((key) => columns.has(key)),
    )
  );
}

export const forecastDocumentSchema = z.object(shape).strict().refine(validGrid);
export const forecastRecordSchema = z
  .object({
    ...shape,
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(validGrid);
export const forecastSaveSchema = z
  .object({
    ...shape,
    expected_revision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict()
  .refine(validGrid)
  .refine(isGroupedForecastDocument, "A previsão deve conter pares de empreendimento.")
  .refine(
    (value) => validGrid(value) && getForecastInvalidCells(value).length === 0,
    "Previsão e realizado aceitam somente números não negativos com até duas casas decimais.",
  );
export const forecastSnapshotSchema = z
  .object({
    forecast: forecastRecordSchema.nullable(),
    can_edit: z.boolean(),
  })
  .strict();

export type ForecastDocument = z.infer<typeof forecastDocumentSchema>;
export type ForecastRecord = z.infer<typeof forecastRecordSchema>;
export type ForecastSnapshot = z.infer<typeof forecastSnapshotSchema>;
