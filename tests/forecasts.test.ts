import { describe, expect, it } from "vitest";
import {
  forecastDocumentSchema,
  forecastSaveSchema,
  forecastSnapshotSchema,
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
    expect(forecastSaveSchema.safeParse({ ...document, expected_revision: 0 }).success).toBe(true);
    expect(
      forecastSaveSchema.safeParse({ ...document, expected_revision: Number.MAX_SAFE_INTEGER })
        .success,
    ).toBe(false);
    expect(forecastSnapshotSchema.parse({ forecast: null, can_edit: false }).forecast).toBeNull();
    expect(forecastSnapshotSchema.safeParse({ forecast: null }).success).toBe(false);
  });
});
