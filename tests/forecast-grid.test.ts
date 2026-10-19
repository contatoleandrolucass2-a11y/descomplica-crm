import { describe, expect, it } from "vitest";
import {
  FORECAST_ACTION_PLAN_ID,
  addForecastGroup,
  createForecastDocument,
  forecastCellToCents,
  formatForecastCents,
  getForecastGroups,
  getForecastInvalidCells,
  getForecastTotals,
  moveForecastGroup,
  normalizeForecastDocument,
  removeForecastGroup,
  renameForecastGroup,
} from "@/lib/crm/forecast-grid";
import { forecastSaveSchema } from "@/lib/crm/forecasts";

describe("grouped forecast grid", () => {
  it("starts with seven complete groups, two rows and valid save payload", () => {
    const document = createForecastDocument();
    expect(getForecastGroups(document)).toHaveLength(7);
    expect(document.rows).toHaveLength(2);
    expect(document.columns.at(-1)).toEqual({ id: "action_plan", label: "Plano de ação" });
    expect(document.rows.every((row) => Object.keys(row.cells).length === 16)).toBe(true);
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 0 }).success).toBe(true);
    expect(normalizeForecastDocument(document)).toBe(document);
  });
  it("adds, reorders, renames and removes whole pairs without separating row values", () => {
    let document = createForecastDocument();
    const group = getForecastGroups(document)[0]!;
    document.rows[0]!.cells[group.forecastId] = "12.34";
    document.rows[0]!.cells[group.actualId] = "56";
    document = addForecastGroup(document);
    expect(document.rows.every((row) => Object.keys(row.cells).length === 18)).toBe(true);
    document = renameForecastGroup(document, group.id, "Residencial");
    document = moveForecastGroup(document, group.id, 7);
    expect(getForecastGroups(document)[7]!.label).toBe("Residencial");
    expect(document.rows[0]!.cells[group.forecastId]).toBe("12.34");
    expect(document.rows[0]!.cells[group.actualId]).toBe("56");
    expect(document.columns.at(-1)?.id).toBe(FORECAST_ACTION_PLAN_ID);
    document = removeForecastGroup(document, group.id);
    expect(document.rows[0]!.cells[group.forecastId]).toBeUndefined();
    expect(document.rows[0]!.cells[group.actualId]).toBeUndefined();
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 0 }).success).toBe(true);
  });
  it("enforces group boundaries and avoids duplicate default titles", () => {
    let document = createForecastDocument();
    document = removeForecastGroup(document, getForecastGroups(document)[1]!.id);
    document = addForecastGroup(document);
    expect(new Set(getForecastGroups(document).map((group) => group.label)).size).toBe(7);
    for (let i = 0; i < 20; i++) document = addForecastGroup(document);
    expect(getForecastGroups(document)).toHaveLength(14);
    expect(moveForecastGroup(document, "missing", 0)).toBe(document);
    expect(moveForecastGroup(document, getForecastGroups(document)[0]!.id, -1)).toBe(document);
    for (let i = 0; i < 20; i++)
      document = removeForecastGroup(document, getForecastGroups(document)[0]!.id);
    expect(getForecastGroups(document)).toHaveLength(1);
  });
  it.each([
    "12\n",
    "12\t",
    "\n12",
    "text",
    "-1",
    "+1",
    "1e3",
    "1.234",
    "1,234",
    "1 000",
    " 1",
    "1 ",
    "Infinity",
    "NaN",
    "1000000000",
    ".5",
    ",5",
  ])("rejects invalid numeric input %s", (value) => {
    expect(forecastCellToCents(value)).toBeNull();
    const document = createForecastDocument();
    document.rows[0]!.cells[getForecastGroups(document)[0]!.forecastId] = value;
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 0 }).success).toBe(false);
  });
  it.each([
    ["", 0],
    ["0", 0],
    ["0.1", 10],
    ["0,20", 20],
    ["1,", 100],
    ["999999999.99", 99999999999],
  ])("parses decimal %s exactly", (value, expected) => {
    expect(forecastCellToCents(String(value))).toBe(expected);
  });
  it("sums all values by row and column exactly and marks invalid totals unknown", () => {
    const document = createForecastDocument();
    const group = getForecastGroups(document)[0]!;
    document.rows[0]!.cells[group.forecastId] = "0.1";
    document.rows[0]!.cells[group.actualId] = "0,2";
    document.rows[1]!.cells[group.forecastId] = "1.23";
    document.rows[0]!.cells[FORECAST_ACTION_PLAN_ID] = "Revisar carteira e fazer contato diário.";
    const totals = getForecastTotals(document);
    expect(totals.rows[document.rows[0]!.id]).toBe(30);
    expect(totals.columns[group.forecastId]).toBe(133);
    expect(totals.grandTotal).toBe(153);
    expect(totals.columns).not.toHaveProperty(FORECAST_ACTION_PLAN_ID);
    expect(getForecastInvalidCells(document)).toEqual([]);
    expect(formatForecastCents(153)).toBe("1,53");
    document.rows[1]!.cells[group.actualId] = "legacy text";
    expect(getForecastInvalidCells(document)).toEqual([
      { rowId: document.rows[1]!.id, columnId: group.actualId, value: "legacy text" },
    ]);
    expect(getForecastTotals(document).grandTotal).toBeNull();
    expect(getForecastTotals(document).rows[document.rows[0]!.id]).toBe(30);
    expect(getForecastTotals(document).columns[group.actualId]).toBeNull();
  });
  it("keeps maximum permitted totals within safe integer range", () => {
    let document = createForecastDocument();
    for (let i = 0; i < 7; i++) document = addForecastGroup(document);
    document.rows = Array.from({ length: 200 }, (_, index) => ({
      id: `r${index}`,
      cells: Object.fromEntries(
        document.columns.map((column) => [
          column.id,
          column.id === "broker"
            ? "Pessoa"
            : column.id === FORECAST_ACTION_PLAN_ID
              ? "Plano detalhado"
              : "999999999.99",
        ]),
      ),
    }));
    expect(getForecastTotals(document).grandTotal).toBe(559999999994400);
    expect(Number.isSafeInteger(getForecastTotals(document).grandTotal)).toBe(true);
  });
  it("normalizes legacy rows and every cell without discarding invalid text", () => {
    const legacy = {
      title: "Equipe",
      columns: [
        { id: "name", label: "Nome do corretor" },
        { id: "forecast", label: "Previsão" },
        { id: "actual", label: "Realizado" },
      ],
      rows: [{ id: "r1", cells: { name: "Pessoa", forecast: "12", actual: "texto antigo" } }],
    };
    const document = normalizeForecastDocument(legacy);
    const first = getForecastGroups(document)[0]!;
    expect(first.label).toBe("Empreendimento 1");
    expect(document.rows[0]!.cells).toMatchObject({
      broker: "Pessoa",
      [first.forecastId]: "12",
      [first.actualId]: "texto antigo",
    });
    expect(getForecastInvalidCells(document)).toHaveLength(1);
    expect(legacy.rows[0]!.cells.actual).toBe("texto antigo");
    expect(document.columns.at(-1)).toEqual({ id: "action_plan", label: "Plano de ação" });
    expect(document.rows[0]!.cells.action_plan).toBe("");
  });
  it("adapts an old grouped document with an empty action plan without changing group IDs", () => {
    const current = createForecastDocument();
    const oldGrouped = {
      ...current,
      columns: current.columns.slice(0, -1),
      rows: current.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).filter(([id]) => id !== FORECAST_ACTION_PLAN_ID),
        ),
      })),
    };
    const normalized = normalizeForecastDocument(oldGrouped);
    expect(getForecastGroups(normalized).map((group) => group.id)).toEqual(
      getForecastGroups(current).map((group) => group.id),
    );
    expect(normalized.rows.every((row) => row.cells.action_plan === "")).toBe(true);
    expect(forecastSaveSchema.safeParse({ ...normalized, expected_revision: 1 }).success).toBe(
      true,
    );
  });
  it("preserves the requested two-line layout for the known development names", () => {
    let document = createForecastDocument();
    const [first, second] = getForecastGroups(document);
    document = renameForecastGroup(document, first!.id, "Conquista Itaim Paulista");
    document = renameForecastGroup(document, second!.id, "Mirante Jardim das Esmeraldas");
    const normalized = normalizeForecastDocument(document);
    expect(
      getForecastGroups(normalized)
        .slice(0, 2)
        .map((group) => group.label),
    ).toEqual(["Conquista\nItaim Paulista", "Mirante Jardim\ndas Esmeraldas"]);
  });
  it("accepts free action text up to 4000 characters and excludes it from numeric checks", () => {
    const document = createForecastDocument();
    document.rows[0]!.cells.action_plan = "A".repeat(4000);
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 1 }).success).toBe(true);
    document.rows[0]!.cells.action_plan = "A".repeat(4001);
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 1 }).success).toBe(false);
  });
  it("preserves all legacy cells even when pairing requires an explicit limit correction", () => {
    const columns = Array.from({ length: 30 }, (_, index) => ({
      id: `c${index}`,
      label: `C${index}`,
    }));
    const document = normalizeForecastDocument({
      title: "",
      columns,
      rows: [
        {
          id: "r",
          cells: Object.fromEntries(columns.map((column, index) => [column.id, String(index)])),
        },
      ],
    });
    expect(document.columns).toHaveLength(32);
    expect(Object.values(document.rows[0]!.cells).filter(Boolean)).toHaveLength(30);
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 1 }).success).toBe(false);
  });
  it("fails malformed and split groups without throwing", () => {
    const document = createForecastDocument();
    for (const value of [
      { ...document, columns: [] },
      { ...document, columns: [document.columns[0]] },
      { ...document, columns: document.columns.slice(0, -1) },
      {
        ...document,
        columns: document.columns.map((column) =>
          column.id === FORECAST_ACTION_PLAN_ID ? { ...column, label: "Outro" } : column,
        ),
      },
      { ...document, rows: [{ id: "r", cells: {} }] },
      {
        ...document,
        columns: document.columns.map((column, index) =>
          index === 2 ? { ...column, label: "Other" } : column,
        ),
      },
    ]) {
      expect(() => forecastSaveSchema.safeParse({ ...value, expected_revision: 0 })).not.toThrow();
      expect(forecastSaveSchema.safeParse({ ...value, expected_revision: 0 }).success).toBe(false);
    }
  });
});
