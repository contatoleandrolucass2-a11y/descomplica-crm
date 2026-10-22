import type { ForecastDocument } from "./forecasts";

export const FORECAST_MAX_GROUPS = 14;
export const FORECAST_MAX_VALUE = 999_999_999.99;
export const FORECAST_ACTION_PLAN_ID = "action_plan";
export const FORECAST_ACTION_PLAN_LABEL = "Plano de ação";
const FORECAST_PROJECT_LABEL_LAYOUTS = [
  "Conquista\nItaim Paulista",
  "Conquista\nSão Miguel",
  "Terrasse\nVila Ema",
  "Conquista\nSacomã",
  "Alto\nLiviero",
  "Raiz\nhome Clube",
  "Conquista\nClube Butantã",
  "Mirante Jardim\ndas Esmeraldas",
  "Empreendimentos\nRiva",
] as const;
export type ForecastGroup = { id: string; label: string; forecastId: string; actualId: string };

const defaultLabelLayout = new Map(
  FORECAST_PROJECT_LABEL_LAYOUTS.map((label) => [label.replace(/\s+/g, " "), label]),
);

function layoutKnownGroupLabels(document: ForecastDocument): ForecastDocument {
  let changed = false;
  const columns = document.columns.map((column) => {
    if (column.id === "broker" || column.id === FORECAST_ACTION_PLAN_ID) return column;
    const label = defaultLabelLayout.get(column.label.replace(/\s+/g, " ").trim());
    if (!label || label === column.label) return column;
    changed = true;
    return { ...column, label };
  });
  return changed ? { ...document, columns } : document;
}

/** Integer hundredths keep all supported table totals exact (including 200 rows). */
export function forecastCellToCents(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (value === "") return 0;
  if (value.trim() !== value || !/^\d{1,9}(?:[.,]\d{0,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatForecastCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function getForecastGroups(document: ForecastDocument): ForecastGroup[] {
  const groups: ForecastGroup[] = [];
  const groupEnd =
    document.columns.at(-1)?.id === FORECAST_ACTION_PLAN_ID
      ? document.columns.length - 1
      : document.columns.length;
  for (let index = 1; index < groupEnd; index += 2) {
    const forecast = document.columns[index];
    const actual = document.columns[index + 1];
    if (forecast && actual)
      groups.push({
        id: forecast.id.slice(2),
        label: forecast.label,
        forecastId: forecast.id,
        actualId: actual.id,
      });
  }
  return groups;
}

function hasValidForecastGroups(document: ForecastDocument): boolean {
  return getForecastGroups(document).every(
    (group) =>
      /^[A-Za-z0-9_-]{1,62}$/.test(group.id) &&
      group.forecastId === `f_${group.id}` &&
      group.actualId === `a_${group.id}` &&
      document.columns.find((column) => column.id === group.actualId)?.label === group.label,
  );
}

function isLegacyGroupedForecastDocument(document: ForecastDocument): boolean {
  return (
    document.columns[0]?.id === "broker" &&
    document.columns.length >= 3 &&
    document.columns.length % 2 === 1 &&
    hasValidForecastGroups(document)
  );
}

export function isGroupedForecastDocument(document: ForecastDocument): boolean {
  return (
    document.columns[0]?.id === "broker" &&
    document.columns.length >= 4 &&
    document.columns.length % 2 === 0 &&
    document.columns.at(-1)?.id === FORECAST_ACTION_PLAN_ID &&
    document.columns.at(-1)?.label === FORECAST_ACTION_PLAN_LABEL &&
    hasValidForecastGroups(document)
  );
}

function appendGroup(
  document: ForecastDocument,
  label: string,
  stableId?: string,
): ForecastDocument {
  const id = stableId ?? crypto.randomUUID();
  const columns = [
    { id: `f_${id}`, label },
    { id: `a_${id}`, label },
  ] as const;
  return {
    ...document,
    columns: [
      ...document.columns.filter((column) => column.id !== FORECAST_ACTION_PLAN_ID),
      ...columns,
      ...document.columns.filter((column) => column.id === FORECAST_ACTION_PLAN_ID),
    ],
    rows: document.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [columns[0].id]: "", [columns[1].id]: "" },
    })),
  };
}

export function createForecastDocument(brokers: readonly string[] = []): ForecastDocument {
  let document: ForecastDocument = {
    title: "Equipe",
    columns: [
      { id: "broker", label: "Nome do corretor" },
      { id: FORECAST_ACTION_PLAN_ID, label: FORECAST_ACTION_PLAN_LABEL },
    ],
    rows: (brokers.length > 0
      ? brokers
      : Array.from({ length: 10 }, (_, index) => `Corretor ${index + 1}`)
    ).map((broker, index) => ({
      id: `broker_${index + 1}`,
      cells: { broker, [FORECAST_ACTION_PLAN_ID]: "" },
    })),
  };
  for (let index = 1; index <= 7; index++)
    document = appendGroup(document, `Empreendimento ${index}`, `group_${index}`);
  return document;
}

/** Converts only the in-memory draft. Never drops legacy cells, including invalid text. */
export function normalizeForecastDocument(source: ForecastDocument): ForecastDocument {
  if (isGroupedForecastDocument(source)) return layoutKnownGroupLabels(source);
  if (isLegacyGroupedForecastDocument(source))
    return layoutKnownGroupLabels({
      ...source,
      columns: [
        ...source.columns,
        { id: FORECAST_ACTION_PLAN_ID, label: FORECAST_ACTION_PLAN_LABEL },
      ],
      rows: source.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [FORECAST_ACTION_PLAN_ID]: "" },
      })),
    });
  const hasActionPlan = source.columns.at(-1)?.id === FORECAST_ACTION_PLAN_ID;
  const groupEnd = hasActionPlan ? source.columns.length - 1 : source.columns.length;
  const broker = source.columns[0]!;
  let document: ForecastDocument = {
    title: source.title,
    columns: [
      { id: "broker", label: broker.label },
      { id: FORECAST_ACTION_PLAN_ID, label: FORECAST_ACTION_PLAN_LABEL },
    ],
    rows: source.rows.map((row) => ({
      id: row.id,
      cells: {
        broker: row.cells[broker.id]!,
        [FORECAST_ACTION_PLAN_ID]: hasActionPlan ? row.cells[FORECAST_ACTION_PLAN_ID]! : "",
      },
    })),
  };
  for (let index = 1; index < groupEnd; index += 2) {
    const first = source.columns[index]!;
    const second = source.columns[index + 1];
    const classic = first.label === "Previsão" && (!second || second.label === "Realizado");
    const customTitle = source.title.trim() !== "Equipe" ? source.title.trim() : "";
    const label = classic ? customTitle || `Empreendimento ${Math.ceil(index / 2)}` : first.label;
    document = appendGroup(document, label);
    const group = getForecastGroups(document).at(-1)!;
    document.rows = document.rows.map((row, rowIndex) => ({
      ...row,
      cells: {
        ...row.cells,
        [group.forecastId]: source.rows[rowIndex]!.cells[first.id]!,
        [group.actualId]: second ? source.rows[rowIndex]!.cells[second.id]! : "",
      },
    }));
  }
  while (getForecastGroups(document).length < 7)
    document = appendGroup(document, `Empreendimento ${getForecastGroups(document).length + 1}`);
  return layoutKnownGroupLabels(document);
}

export function addForecastGroup(document: ForecastDocument): ForecastDocument {
  if (getForecastGroups(document).length >= FORECAST_MAX_GROUPS) return document;
  const labels = new Set(document.columns.map((column) => column.label));
  let number = 1;
  while (labels.has(`Empreendimento ${number}`)) number++;
  return appendGroup(document, `Empreendimento ${number}`);
}

export function removeForecastGroup(document: ForecastDocument, groupId: string): ForecastDocument {
  const groups = getForecastGroups(document);
  const group = groups.find((entry) => entry.id === groupId);
  if (!group || groups.length <= 1) return document;
  const removed = new Set([group.forecastId, group.actualId]);
  return {
    ...document,
    columns: document.columns.filter((column) => !removed.has(column.id)),
    rows: document.rows.map((row) => ({
      ...row,
      cells: Object.fromEntries(Object.entries(row.cells).filter(([id]) => !removed.has(id))),
    })),
  };
}

export function moveForecastGroup(
  document: ForecastDocument,
  groupId: string,
  targetIndex: number,
): ForecastDocument {
  const groups = getForecastGroups(document);
  const index = groups.findIndex((group) => group.id === groupId);
  if (
    index < 0 ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= groups.length
  )
    return document;
  const [group] = groups.splice(index, 1);
  groups.splice(targetIndex, 0, group!);
  const byId = new Map(document.columns.map((column) => [column.id, column]));
  return {
    ...document,
    columns: [
      document.columns[0]!,
      ...groups.flatMap((entry) => [byId.get(entry.forecastId)!, byId.get(entry.actualId)!]),
      byId.get(FORECAST_ACTION_PLAN_ID)!,
    ],
  };
}

export function renameForecastGroup(
  document: ForecastDocument,
  groupId: string,
  label: string,
): ForecastDocument {
  return {
    ...document,
    columns: document.columns.map((column) =>
      column.id === `f_${groupId}` || column.id === `a_${groupId}` ? { ...column, label } : column,
    ),
  };
}

export function getForecastInvalidCells(document: ForecastDocument) {
  return document.rows.flatMap((row) =>
    document.columns
      .filter((column) => column.id !== "broker" && column.id !== FORECAST_ACTION_PLAN_ID)
      .flatMap((column) =>
        forecastCellToCents(row.cells[column.id]) === null
          ? [{ rowId: row.id, columnId: column.id, value: row.cells[column.id] }]
          : [],
      ),
  );
}

export function getForecastTotals(document: ForecastDocument): {
  rows: Record<string, number | null>;
  rowMetrics: Record<string, { forecast: number | null; actual: number | null }>;
  columns: Record<string, number | null>;
  grandTotal: number | null;
  metricTotals: { forecast: number | null; actual: number | null };
} {
  const rows: Record<string, number | null> = {};
  const rowMetrics: Record<string, { forecast: number | null; actual: number | null }> = {};
  const columns: Record<string, number | null> = Object.fromEntries(
    document.columns
      .filter((column) => column.id !== "broker" && column.id !== FORECAST_ACTION_PLAN_ID)
      .map((column) => [column.id, 0]),
  );
  let grandTotal: number | null = 0;
  let forecastTotal: number | null = 0;
  let actualTotal: number | null = 0;
  const groups = getForecastGroups(document);
  for (const row of document.rows) {
    let total: number | null = 0;
    for (const column of document.columns.filter(
      (entry) => entry.id !== "broker" && entry.id !== FORECAST_ACTION_PLAN_ID,
    )) {
      const value = forecastCellToCents(row.cells[column.id]);
      total = total === null || value === null ? null : total + value;
      columns[column.id] =
        columns[column.id] === null || value === null ? null : columns[column.id]! + value;
    }
    rows[row.id] = total;
    const rowForecast = sumForecastColumns(
      row,
      groups.map((group) => group.forecastId),
    );
    const rowActual = sumForecastColumns(
      row,
      groups.map((group) => group.actualId),
    );
    rowMetrics[row.id] = { forecast: rowForecast, actual: rowActual };
    forecastTotal = addForecastTotals(forecastTotal, rowForecast);
    actualTotal = addForecastTotals(actualTotal, rowActual);
    grandTotal = grandTotal === null || total === null ? null : grandTotal + total;
  }
  return {
    rows,
    rowMetrics,
    columns,
    grandTotal,
    metricTotals: { forecast: forecastTotal, actual: actualTotal },
  };
}

function addForecastTotals(left: number | null, right: number | null) {
  return left === null || right === null ? null : left + right;
}

function sumForecastColumns(
  row: ForecastDocument["rows"][number],
  columnIds: readonly string[],
): number | null {
  let total: number | null = 0;
  for (const columnId of columnIds) {
    total = addForecastTotals(total, forecastCellToCents(row.cells[columnId]));
  }
  return total;
}

export type GeneralForecastAggregate = {
  groups: { key: string; label: string }[];
  rows: Record<
    "house" | "imob",
    {
      cells: Record<string, { forecast: number | null; actual: number | null }>;
      totals: { forecast: number | null; actual: number | null };
    }
  >;
  totals: {
    cells: Record<string, { forecast: number | null; actual: number | null }>;
    forecast: number | null;
    actual: number | null;
  };
};

/** Compiles manager documents into the read-only House/Imob comparison. */
export function aggregateGeneralForecast(
  sections: readonly {
    segment: "house" | "imob";
    forecast: ForecastDocument;
  }[],
): GeneralForecastAggregate {
  const groups: GeneralForecastAggregate["groups"] = [];
  const labels = new Map<string, string>();
  const createCells = () =>
    Object.create(null) as Record<string, { forecast: number | null; actual: number | null }>;
  const rows: GeneralForecastAggregate["rows"] = {
    house: { cells: createCells(), totals: { forecast: 0, actual: 0 } },
    imob: { cells: createCells(), totals: { forecast: 0, actual: 0 } },
  };

  for (const section of sections) {
    const document = normalizeForecastDocument(section.forecast);
    for (const group of getForecastGroups(document)) {
      const key = group.label
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("pt-BR");
      if (!labels.has(key)) {
        labels.set(key, group.label);
        groups.push({ key, label: group.label });
      }
      const current = rows[section.segment].cells[key] ?? { forecast: 0, actual: 0 };
      rows[section.segment].cells[key] = {
        forecast: addForecastTotals(
          current.forecast,
          sumDocumentColumn(document, group.forecastId),
        ),
        actual: addForecastTotals(current.actual, sumDocumentColumn(document, group.actualId)),
      };
    }
  }

  for (const segment of ["house", "imob"] as const) {
    for (const { key } of groups) rows[segment].cells[key] ??= { forecast: 0, actual: 0 };
    rows[segment].totals = groups.reduce(
      (totals, { key }) => ({
        forecast: addForecastTotals(totals.forecast, rows[segment].cells[key]!.forecast),
        actual: addForecastTotals(totals.actual, rows[segment].cells[key]!.actual),
      }),
      { forecast: 0 as number | null, actual: 0 as number | null },
    );
  }

  const cells: GeneralForecastAggregate["totals"]["cells"] = createCells();
  for (const { key } of groups) {
    cells[key] = {
      forecast: addForecastTotals(rows.house.cells[key]!.forecast, rows.imob.cells[key]!.forecast),
      actual: addForecastTotals(rows.house.cells[key]!.actual, rows.imob.cells[key]!.actual),
    };
  }
  return {
    groups,
    rows,
    totals: {
      cells,
      forecast: addForecastTotals(rows.house.totals.forecast, rows.imob.totals.forecast),
      actual: addForecastTotals(rows.house.totals.actual, rows.imob.totals.actual),
    },
  };
}

function sumDocumentColumn(document: ForecastDocument, columnId: string): number | null {
  let total: number | null = 0;
  for (const row of document.rows) {
    total = addForecastTotals(total, forecastCellToCents(row.cells[columnId]));
  }
  return total;
}
