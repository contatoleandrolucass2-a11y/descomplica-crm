import { describe, expect, it } from "vitest";
import {
  addForecastGroup,
  createForecastDocument,
  getForecastGroups,
} from "@/lib/crm/forecast-grid";
import {
  createForecastTemplate,
  forecastPeriodQuerySchema,
  forecastPeriodSaveSchema,
  forecastDocumentSchema,
  forecastSaveSchema,
  forecastSnapshotSchema,
  getForecastPeriod,
  orderForecastSources,
} from "@/lib/crm/forecasts";

const document = {
  title: "Equipe",
  columns: [
    { id: "broker", label: "Nome do corretor" },
    { id: "forecast", label: "Previsão" },
  ],
  rows: [{ id: "r1", cells: { broker: "Pessoa sintética", forecast: "Texto manual" } }],
};
describe("manual forecast contract", () => {
  it("keeps text values, empty rows, and stable IDs", () => {
    expect(forecastDocumentSchema.parse(document)).toEqual(document);
    expect(forecastDocumentSchema.parse({ ...document, title: "", rows: [] }).rows).toEqual([]);
  });
  it.each([
    { ...document, columns: [document.columns[0], document.columns[0]] },
    { ...document, rows: [document.rows[0], document.rows[0]] },
    { ...document, rows: [{ id: "r1", cells: { broker: "" } }] },
    { ...document, rows: [{ id: "r1", cells: { broker: "", forecast: "", extra: "" } }] },
    { ...document, columns: [{ id: "invalid.id", label: "Coluna" }] },
    { ...document, columns: [{ id: "__proto__", label: "Coluna" }] },
    { ...document, columns: [{ id: "valid", label: "  " }] },
    { ...document, rows: [{ id: "r1", cells: { broker: "", forecast: 10 } }] },
    { ...document, title: "x".repeat(121) },
    { ...document, extra: true },
    { ...document, rows: [{ id: "r1", cells: { broker: "", forecast: "😀".repeat(2001) } }] },
  ])("rejects ambiguous, malformed or oversized grids %#", (value) => {
    expect(forecastDocumentSchema.safeParse(value).success).toBe(false);
  });
  it("accepts maximum dimensions and rejects overflow", () => {
    const columns = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, label: `Coluna ${i}` }));
    const cells = Object.fromEntries(columns.map(({ id }) => [id, ""]));
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, cells }));
    expect(forecastDocumentSchema.safeParse({ title: "", columns, rows }).success).toBe(true);
    expect(
      forecastDocumentSchema.safeParse({
        title: "",
        columns: [...columns, { id: "last", label: "Extra" }],
        rows: [],
      }).success,
    ).toBe(false);
    expect(
      forecastDocumentSchema.safeParse({
        title: "",
        columns,
        rows: [...rows, { id: "last", cells }],
      }).success,
    ).toBe(false);
  });
  it("requires a safe compare-and-swap revision and explicit capability", () => {
    expect(
      forecastSaveSchema.safeParse({ ...createForecastDocument(), expected_revision: 0 }).success,
    ).toBe(true);
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 0 }).success).toBe(false);
    expect(
      forecastSaveSchema.safeParse({ ...document, expected_revision: Number.MAX_SAFE_INTEGER })
        .success,
    ).toBe(false);
    expect(
      forecastSnapshotSchema.parse({
        forecast: null,
        sections: [],
        template: null,
        can_edit: false,
        can_manage_structure: false,
        period: { start: "2026-10-16", end: "2026-10-18" },
        selection: { segment: "general", manager: null },
      }).forecast,
    ).toBeNull();
    expect(forecastSnapshotSchema.safeParse({ forecast: null }).success).toBe(false);
  });
  it("requires action_plan as the final stored column", () => {
    const current = createForecastDocument();
    expect(current.columns).toHaveLength(16);
    expect(current.columns.at(-1)).toEqual({ id: "action_plan", label: "Plano de ação" });
    expect(
      forecastSaveSchema.safeParse({
        ...current,
        columns: [current.columns.at(-1)!, ...current.columns.slice(0, -1)],
        expected_revision: 0,
      }).success,
    ).toBe(false);
  });
  it("normalizes Friday through Sunday to one period, including a year boundary", () => {
    expect(getForecastPeriod("2026-10-16")).toEqual({ start: "2026-10-16", end: "2026-10-18" });
    expect(getForecastPeriod("2026-10-17")).toEqual({ start: "2026-10-16", end: "2026-10-18" });
    expect(getForecastPeriod("2026-10-18")).toEqual({ start: "2026-10-16", end: "2026-10-18" });
    expect(getForecastPeriod("2027-01-01")).toEqual({ start: "2027-01-01", end: "2027-01-03" });
    expect(getForecastPeriod("2026-10-15")).toBeNull();
    expect(getForecastPeriod("2026-02-30")).toBeNull();
  });
  it("enforces strict segment-manager pairs and period save metadata", () => {
    expect(
      forecastPeriodQuerySchema.safeParse({ date: "2026-10-18", segment: "general", manager: null })
        .success,
    ).toBe(true);
    expect(
      forecastPeriodQuerySchema.safeParse({
        date: "2026-10-18",
        segment: "house",
        manager: "alvaro",
      }).success,
    ).toBe(false);
    expect(
      forecastPeriodSaveSchema.safeParse({
        ...createForecastDocument(),
        expected_revision: 0,
        date: "2026-10-18",
        segment: "imob",
        manager: "alvaro",
      }).success,
    ).toBe(true);
  });
  it("creates a clean one-row template and orders complete general sections", () => {
    const source = createForecastDocument();
    source.rows[0]!.cells.action_plan = "Não copiar";
    source.rows[0]!.cells[source.columns[1]!.id] = "42";
    const template = createForecastTemplate(source)!;
    expect(template.columns).toEqual(source.columns);
    expect(template.rows).toHaveLength(1);
    expect(template.rows[0]!.cells.broker).toBe("Corretor 1");
    expect(
      Object.entries(template.rows[0]!.cells).every(
        ([key, value]) => key === "broker" || value === "",
      ),
    ).toBe(true);
    const forecast = { ...source, revision: 1, updated_at: "2026-10-18T12:00:00Z" };
    expect(
      orderForecastSources([
        { segment: "imob", manager: "thiago-tg", forecast },
        { segment: "house", manager: "amanda", forecast },
      ]).map(({ segment, manager }) => `${segment}:${manager}`),
    ).toEqual(["house:amanda", "imob:thiago-tg"]);
    const rosterTemplate = createForecastTemplate(source, ["Ana Corretora", "Zélia Corretora"])!;
    expect(rosterTemplate.rows.map((row) => row.cells.broker)).toEqual([
      "Ana Corretora",
      "Zélia Corretora",
    ]);
    expect(rosterTemplate.rows.map((row) => row.id)).toEqual(["broker_1", "broker_2"]);
    expect(
      rosterTemplate.rows.every((row) =>
        Object.entries(row.cells).every(([key, value]) => key === "broker" || value === ""),
      ),
    ).toBe(true);
    expect(
      forecastSnapshotSchema.safeParse({
        forecast: null,
        sections: [{ segment: "house", manager: "alvaro", forecast }],
        template: null,
        can_edit: false,
        can_manage_structure: false,
        period: { start: "2026-10-16", end: "2026-10-18" },
        selection: { segment: "general", manager: null },
      }).success,
    ).toBe(false);
    const legacyTemplate = createForecastTemplate({
      title: "Legado",
      columns: [
        { id: "name", label: "Nome" },
        { id: "forecast", label: "Previsão" },
      ],
      rows: [{ id: "legacy", cells: { name: "Corretor legado", forecast: "99" } }],
    })!;
    expect(legacyTemplate.rows[0]!.cells).toEqual({ name: "Corretor legado", forecast: "" });
    const emptyTemplate = createForecastTemplate({ ...source, rows: [] })!;
    expect(emptyTemplate.rows).toEqual([
      {
        id: "template_row",
        cells: Object.fromEntries(
          source.columns.map((column) => [column.id, column.id === "broker" ? "Corretor 1" : ""]),
        ),
      },
    ]);
  });
  it("keeps twelve maximum-sized, structurally different General sections without flattening", () => {
    let source = createForecastDocument();
    while (getForecastGroups(source).length < 14) source = addForecastGroup(source);
    source = {
      ...source,
      rows: Array.from({ length: 200 }, (_, index) => ({
        id: String(index).padStart(64, "r"),
        cells: Object.fromEntries(
          source.columns.map((column) => [
            column.id,
            column.id === "broker" ? `Corretor ${index + 1}` : "",
          ]),
        ),
      })),
    };
    const managers = [
      ["house", "amanda"],
      ["house", "cleber"],
      ["house", "messias"],
      ["house", "sidnei"],
      ["house", "stephanie"],
      ["imob", "alvaro"],
      ["imob", "fabricio"],
      ["imob", "gustavo"],
      ["imob", "jonathan"],
      ["imob", "richard"],
      ["imob", "thiago"],
      ["imob", "thiago-tg"],
    ] as const;
    const sections = managers.map(([segment, manager], index) => ({
      segment,
      manager,
      forecast: {
        ...source,
        title: `Estrutura ${index + 1}`,
        columns: source.columns.map((column) =>
          column.id === "broker" || column.id === "action_plan"
            ? column
            : { ...column, label: `${column.label} ${index + 1}` },
        ),
        revision: 1,
        updated_at: "2026-10-18T12:00:00Z",
      },
    }));
    const payload = {
      forecast: null,
      sections,
      template: null,
      brokers: [],
      can_edit: false,
      can_manage_structure: false,
      period: { start: "2026-10-16", end: "2026-10-18" },
      selection: { segment: "general", manager: null },
    };
    expect(forecastSnapshotSchema.safeParse(payload).success).toBe(true);
    expect(
      forecastSnapshotSchema.safeParse({ ...payload, sections: [...sections, sections[0]!] })
        .success,
    ).toBe(false);
  });
});
