import type { ForecastDocument } from "./forecasts";

export const FORECAST_MAX_GROUPS = 14;
export const FORECAST_MAX_VALUE = 999_999_999.99;
export type ForecastGroup = { id: string; label: string; forecastId: string; actualId: string };

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
  for (let index = 1; index < document.columns.length; index += 2) {
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

export function isGroupedForecastDocument(document: ForecastDocument): boolean {
  if (
    document.columns[0]?.id !== "broker" ||
    document.columns.length < 3 ||
    document.columns.length % 2 !== 1
  )
    return false;
  return getForecastGroups(document).every(
    (group) =>
      /^[A-Za-z0-9_-]{1,62}$/.test(group.id) &&
      group.forecastId === `f_${group.id}` &&
      group.actualId === `a_${group.id}` &&
      document.columns.find((column) => column.id === group.actualId)?.label === group.label,
  );
}

function appendGroup(document: ForecastDocument, label: string): ForecastDocument {
  const id = crypto.randomUUID();
  const columns = [
    { id: `f_${id}`, label },
    { id: `a_${id}`, label },
  ] as const;
  return {
    ...document,
    columns: [...document.columns, ...columns],
    rows: document.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [columns[0].id]: "", [columns[1].id]: "" },
    })),
  };
}

export function createForecastDocument(): ForecastDocument {
  let document: ForecastDocument = {
    title: "Equipe",
    columns: [{ id: "broker", label: "Nome do corretor" }],
    rows: [1, 2].map((number) => ({
      id: crypto.randomUUID(),
      cells: { broker: `Corretor ${number}` },
    })),
  };
  for (let index = 1; index <= 7; index++)
    document = appendGroup(document, `Empreendimento ${index}`);
  return document;
}

/** Converts only the in-memory draft. Never drops legacy cells, including invalid text. */
export function normalizeForecastDocument(source: ForecastDocument): ForecastDocument {
  if (isGroupedForecastDocument(source)) return source;
  const broker = source.columns[0]!;
  let document: ForecastDocument = {
    title: source.title,
    columns: [{ id: "broker", label: broker.label }],
    rows: source.rows.map((row) => ({ id: row.id, cells: { broker: row.cells[broker.id]! } })),
  };
  for (let index = 1; index < source.columns.length; index += 2) {
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
  return document;
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
      .slice(1)
      .flatMap((column) =>
        forecastCellToCents(row.cells[column.id]) === null
          ? [{ rowId: row.id, columnId: column.id, value: row.cells[column.id] }]
          : [],
      ),
  );
}

export function getForecastTotals(document: ForecastDocument): {
  rows: Record<string, number | null>;
  columns: Record<string, number | null>;
  grandTotal: number | null;
} {
  const rows: Record<string, number | null> = {};
  const columns: Record<string, number | null> = Object.fromEntries(
    document.columns.slice(1).map((column) => [column.id, 0]),
  );
  let grandTotal: number | null = 0;
  for (const row of document.rows) {
    let total: number | null = 0;
    for (const column of document.columns.slice(1)) {
      const value = forecastCellToCents(row.cells[column.id]);
      total = total === null || value === null ? null : total + value;
      columns[column.id] =
        columns[column.id] === null || value === null ? null : columns[column.id]! + value;
    }
    rows[row.id] = total;
    grandTotal = grandTotal === null || total === null ? null : grandTotal + total;
  }
  return { rows, columns, grandTotal };
}
