import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import type { DashboardCard } from "@/lib/dashboard-canvas";
import {
  ConfigurableDashboardCanvas,
  buildDashboardPdfDocument,
  cardMinimumHeight,
  createCatalogCard,
  moveSelectedCards,
  reconcileDefaultProfileChange,
  reconcileCardCompatibility,
  type ConfigurableDashboardCanvasProps,
  type ConfigurableDashboardCatalog,
  type JsPdfConstructor,
} from "@/lib/dashboard-canvas/ui/configurable";

const catalog: ConfigurableDashboardCatalog = {
  metrics: [
    { key: "sales.total", label: "Vendas", defaultType: "kpi" },
    { key: "visits.total", label: "Visitas", defaultType: "bars" },
  ],
  entities: [
    { id: "team-a", label: "Equipe A" },
    { id: "team-b", label: "Equipe B" },
  ],
};

function card(id: string, order: number): DashboardCard {
  return {
    id,
    type: "kpi",
    metric: `metric.${id}`,
    period: "month",
    groupBy: "entity",
    entityIds: null,
    layout: { order, columnSpan: 2, height: 168 },
  };
}

function loadVendoredJsPdf() {
  const context: Record<string, unknown> & { jspdf?: { jsPDF?: JsPdfConstructor } } = {
    console,
    Blob,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    navigator: { userAgent: "" },
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  const source = readFileSync(
    new URL("../public/descomplica-ads-compact/assets/jspdf/jspdf.umd.min.js", import.meta.url),
    "utf8",
  );
  runInNewContext(source, context);
  if (!context.jspdf?.jsPDF) throw new Error("Vendored jsPDF did not expose jsPDF.");
  return context.jspdf.jsPDF;
}

describe("configurable dashboard canvas", () => {
  it("exports the reusable props contract with renderer and metric/type content", () => {
    const props: ConfigurableDashboardCanvasProps = {
      initialCards: [],
      catalog,
      compatibility: { typesByMetric: { "sales.total": ["kpi", "bars"] } },
      contentByMetricAndType: { "sales.total": { kpi: "Conteúdo" } },
      renderCard: () => "Renderizado",
      pageKey: "crm.dashboard",
      scopeKey: "house",
      exportContext: {
        title: "Dashboard comercial",
        context: "House",
        filters: "Mês atual",
        source: "Qlik",
        generatedAt: "2026-10-26 17:30 BRT",
      },
      onCardsChange: () => undefined,
    };
    expect(typeof ConfigurableDashboardCanvas).toBe("function");
    expect(props.contentByMetricAndType?.["sales.total"]?.kpi).toBe("Conteúdo");
  });

  it("creates schema-compatible cards at the required 168px minimum", () => {
    const created = createCatalogCard({ catalog, id: "card-1", order: 0 });
    expect(created).toMatchObject({
      id: "card-1",
      metric: "sales.total",
      type: "kpi",
      layout: { order: 0 },
    });
    expect(created?.layout.height).toBeGreaterThanOrEqual(168);
    expect(cardMinimumHeight("kpi")).toBe(168);
  });

  it("reconciles incompatible editor values with the supplied catalog contract", () => {
    const reconciled = reconcileCardCompatibility(
      {
        ...card("sales", 0),
        metric: "sales.total",
        type: "table",
        groupBy: "hour",
        period: "custom",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        options: { showGoal: true, showLegend: true },
      },
      catalog,
      {
        typesByMetric: { "sales.total": ["kpi"] },
        groupsByMetric: { "sales.total": ["entity"] },
        periodsByMetric: { "sales.total": ["month"] },
        optionsByMetric: { "sales.total": ["showGoal"] },
      },
    );
    expect(reconciled).toMatchObject({
      type: "kpi",
      groupBy: "entity",
      period: "month",
      options: { showGoal: true },
      layout: { height: 168 },
    });
    expect(reconciled).not.toHaveProperty("startDate");
    expect(reconciled).not.toHaveProperty("endDate");
    expect(reconciled.options).not.toHaveProperty("showLegend");
  });

  it("moves a multi-selection as one ordered group", () => {
    const moved = moveSelectedCards(
      [card("a", 0), card("b", 1), card("c", 2), card("d", 3)],
      new Set(["b", "d"]),
      -1,
    );
    expect(moved.map(({ id }) => id)).toEqual(["b", "d", "a", "c"]);
    expect(moved.map(({ layout }) => layout.order)).toEqual([0, 1, 2, 3]);
  });

  it("reconciles every profile version changed while switching the default", () => {
    const profile = (id: string, isDefault: boolean, version: number) => ({
      id,
      userId: "user-1",
      pageKey: "crm.dashboard",
      scopeKey: "house",
      name: id,
      isDefault,
      version,
      schemaVersion: 2 as const,
      cards: [card(id, 0)],
      createdAt: "2026-10-26T20:00:00.000Z",
      updatedAt: "2026-10-26T20:00:00.000Z",
    });
    const updated = {
      ...profile("second", true, 4),
      updatedAt: "2026-10-26T21:00:00.000Z",
    };

    expect(
      reconcileDefaultProfileChange(
        [profile("first", true, 7), profile("second", false, 3)],
        updated,
      ).map(({ id, isDefault, version }) => ({ id, isDefault, version })),
    ).toEqual([
      { id: "first", isDefault: false, version: 8 },
      { id: "second", isDefault: true, version: 4 },
    ]);
  });

  it("generates a real vector PDF with the vendored jsPDF bundle", () => {
    const JsPdf = loadVendoredJsPdf();
    const document = buildDashboardPdfDocument(JsPdf, {
      cards: [{ ...card("sales", 0), metric: "sales.total", title: "Vendas do mês" }],
      catalog,
      exportContext: {
        title: "Dashboard comercial",
        context: "House",
        filters: "Mês atual",
        source: "Qlik",
        generatedAt: "2026-10-26 17:30 BRT",
      },
    });
    const bytes = Buffer.from(document.output("arraybuffer"));
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(1_000);
  });

  it("keeps the toolbar, dialogs and profile states explicit in the client source", () => {
    const source = readFileSync(
      new URL(
        "../lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const modal = readFileSync(
      new URL("../lib/dashboard-canvas/ui/configurable/modal.tsx", import.meta.url),
      "utf8",
    );
    const canvas = readFileSync(
      new URL("../lib/dashboard-canvas/ui/dashboard-canvas.tsx", import.meta.url),
      "utf8",
    );
    const pdf = readFileSync(
      new URL("../lib/dashboard-canvas/ui/configurable/pdf.ts", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL(
        "../lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas.module.css",
        import.meta.url,
      ),
      "utf8",
    );
    for (const label of ["Adicionar", "Organizar", "Desfazer", "Refazer", "Perfis", "Baixar PDF"]) {
      expect(source).toContain(label);
    }
    for (const state of ["Salvando", "Salvo", "Falha", "Conflito"]) expect(source).toContain(state);
    expect(source).toContain("/api/dashboard-profiles");
    expect(source).toContain("700");
    expect(source).toContain("data-dashboard-export-ignore");
    expect(source).toContain("{card.presentation ? (");
    expect(source).toContain(
      "<div className={styles.cardContent}>{renderDashboardContent(card, size)}</div>",
    );
    expect(styles.match(/\.cardContent\s*\{[^}]*display:\s*flex/su)).toBeNull();
    expect(styles).toMatch(/\.cardContentPresentation\s*\{[^}]*display:\s*flex/su);
    expect(canvas).toContain("captureTarget.setPointerCapture(event.pointerId)");
    expect(canvas).not.toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(pdf).not.toContain('querySelectorAll("button, input, select, textarea")');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
  });
});
