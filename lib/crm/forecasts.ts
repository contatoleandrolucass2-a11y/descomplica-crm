import { z } from "zod";
import { getForecastInvalidCells, isGroupedForecastDocument } from "./forecast-grid";

export const FORECAST_MAX_COLUMNS = 30;
export const FORECAST_MAX_ROWS = 200;
export const FORECAST_MAX_CELL_LENGTH = 4000;
export const FORECAST_MANAGERS = {
  house: ["amanda", "cleber", "messias", "sidnei", "stephanie"],
  imob: ["alvaro", "fabricio", "gustavo", "jonathan", "richard", "thiago", "thiago-tg"],
} as const;
export const FORECAST_MANAGER_LABELS = {
  amanda: "Amanda",
  cleber: "Cleber",
  messias: "Messias",
  sidnei: "Sidnei",
  stephanie: "Stephanie",
  alvaro: "Álvaro",
  fabricio: "Fabricio",
  gustavo: "Gustavo",
  jonathan: "Jonathan",
  richard: "Richard",
  thiago: "Thiago",
  "thiago-tg": "Thiago TG",
} as const;
export const forecastSegmentSchema = z.enum(["general", "house", "imob"]);
export const forecastManagerSchema = z.enum([
  "amanda",
  "cleber",
  "messias",
  "sidnei",
  "stephanie",
  "alvaro",
  "fabricio",
  "gustavo",
  "jonathan",
  "richard",
  "thiago",
  "thiago-tg",
]);
const forecastDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine((value) => !["__proto__", "prototype", "constructor"].includes(value));
const column = z.object({ id, label: z.string().trim().min(1).max(120) }).strict();
const row = z
  .object({
    id,
    cells: z.record(
      id,
      z
        .string()
        .max(FORECAST_MAX_CELL_LENGTH)
        .refine((value) => value.length <= FORECAST_MAX_CELL_LENGTH),
    ),
  })
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
export const forecastPeriodRecordSchema = forecastRecordSchema
  .refine(
    isGroupedForecastDocument,
    "A previsão salva deve conter pares completos e o plano de ação.",
  )
  .refine(
    (value) => validGrid(value) && getForecastInvalidCells(value).length === 0,
    "A previsão salva contém valores comparativos inválidos.",
  );
export const forecastSourceSchema = z
  .object({
    segment: z.enum(["house", "imob"]),
    manager: forecastManagerSchema,
    forecast: forecastPeriodRecordSchema,
  })
  .strict()
  .refine(
    ({ segment, manager }) => (FORECAST_MANAGERS[segment] as readonly string[]).includes(manager),
    "A seção não pertence ao segmento informado.",
  );
export const forecastBrokerListSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(FORECAST_MAX_ROWS)
  .refine((names) => new Set(names).size === names.length, "Os corretores devem ser únicos.");
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
  .refine(
    isGroupedForecastDocument,
    "A previsão deve conter o corretor, pares de empreendimento e o plano de ação.",
  )
  .refine(
    (value) => validGrid(value) && getForecastInvalidCells(value).length === 0,
    "Previsão e realizado aceitam somente números não negativos com até duas casas decimais.",
  );
export const forecastPeriodSaveSchema = z
  .object({
    ...shape,
    expected_revision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    date: forecastDateSchema,
    segment: z.enum(["house", "imob"]),
    manager: forecastManagerSchema,
  })
  .strict()
  .refine(validGrid)
  .refine(
    isGroupedForecastDocument,
    "A previsão deve conter o corretor, pares de empreendimento e o plano de ação.",
  )
  .refine(
    (value) => validGrid(value) && getForecastInvalidCells(value).length === 0,
    "Previsão e realizado aceitam somente números não negativos com até duas casas decimais.",
  )
  .refine(
    ({ segment, manager }) => (FORECAST_MANAGERS[segment] as readonly string[]).includes(manager),
    "O gerente não pertence ao segmento selecionado.",
  );
export const forecastSnapshotSchema = z
  .object({
    forecast: forecastPeriodRecordSchema.nullable(),
    sections: z.array(forecastSourceSchema).max(12),
    template: forecastDocumentSchema.nullable(),
    brokers: forecastBrokerListSchema.default([]),
    can_edit: z.boolean(),
    can_manage_structure: z.boolean(),
    period: z.object({ start: forecastDateSchema, end: forecastDateSchema }).strict(),
    selection: z
      .object({ segment: forecastSegmentSchema, manager: forecastManagerSchema.nullable() })
      .strict(),
  })
  .strict();

export const forecastPeriodQuerySchema = z
  .object({
    date: forecastDateSchema,
    segment: forecastSegmentSchema,
    manager: forecastManagerSchema.nullable(),
  })
  .strict()
  .refine(
    ({ segment, manager }) =>
      segment === "general"
        ? manager === null
        : manager !== null && (FORECAST_MANAGERS[segment] as readonly string[]).includes(manager),
    "Seleção de previsão inválida.",
  );

export const forecastPeriodRpcSchema = z
  .object({
    forecasts: z.array(forecastSourceSchema).max(12),
    template: forecastDocumentSchema.nullable(),
    can_edit: z.boolean(),
    can_manage_structure: z.boolean(),
  })
  .strict();

export type ForecastPeriod = { start: string; end: string };

/** Valid forecast dates are Friday, Saturday and Sunday of one Friday-Sunday period. */
export function getForecastPeriod(date: string): ForecastPeriod | null {
  if (!forecastDateSchema.safeParse(date).success) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const day = parsed.getUTCDay();
  if (day !== 5 && day !== 6 && day !== 0) return null;
  const fridayOffset = day === 0 ? -2 : 5 - day;
  parsed.setUTCDate(parsed.getUTCDate() + fridayOffset);
  const start = parsed.toISOString().slice(0, 10);
  parsed.setUTCDate(parsed.getUTCDate() + 2);
  return { start, end: parsed.toISOString().slice(0, 10) };
}

export function createForecastTemplate(
  source: ForecastDocument | null,
  brokers: readonly string[] = [],
): ForecastDocument | null {
  if (!source) return null;
  const first = source.rows[0];
  const brokerId = source.columns[0]?.id;
  const brokerNames = brokers.length > 0 ? brokers : [first?.cells[brokerId ?? ""] || "Corretor 1"];
  return {
    ...source,
    columns: source.columns.map((column) => ({ ...column })),
    rows: brokerNames.map((broker, index) => ({
      id: brokers.length > 0 ? `broker_${index + 1}` : (first?.id ?? "template_row"),
      cells: Object.fromEntries(
        source.columns.map((column) => [column.id, column.id === brokerId ? broker : ""]),
      ),
    })),
  };
}

export type ForecastSource = z.infer<typeof forecastSourceSchema>;

/** General keeps every manager document intact and orders the read-only sections deterministically. */
export function orderForecastSources(sources: ForecastSource[]): ForecastSource[] {
  return [...sources].sort(
    (left, right) =>
      ["house", "imob"].indexOf(left.segment) - ["house", "imob"].indexOf(right.segment) ||
      FORECAST_MANAGERS[left.segment].indexOf(left.manager as never) -
        FORECAST_MANAGERS[right.segment].indexOf(right.manager as never),
  );
}

export type ForecastDocument = z.infer<typeof forecastDocumentSchema>;
export type ForecastRecord = z.infer<typeof forecastRecordSchema>;
export type ForecastSnapshot = z.infer<typeof forecastSnapshotSchema>;
export type ForecastSegment = z.infer<typeof forecastSegmentSchema>;
export type ForecastManager = z.infer<typeof forecastManagerSchema>;
