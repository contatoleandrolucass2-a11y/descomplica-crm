import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardCanvas } from "@/lib/dashboard-canvas/ui/dashboard-canvas";
import { canvasReducer, createCanvasHistoryState } from "@/lib/dashboard-canvas/state/reducer";
import { APPOINTMENTS_CARD_LAYOUT_POLICY } from "@/lib/dashboard-canvas/layout/limits";

import {
  APPOINTMENTS_CANVAS_CATALOG,
  APPOINTMENTS_CANVAS_COMPATIBILITY,
  APPOINTMENTS_CANVAS_DEFAULT_CARDS,
  APPOINTMENTS_CANVAS_PAGE_KEY,
  fitAppointmentsCharts,
} from "@/app/(protected)/app/etapas/_components/appointments-canvas-config";

describe("appointments configurable dashboard", () => {
  it("removes only the duplicate title while preserving named keyboard controls", () => {
    const props = {
      cards: [APPOINTMENTS_CANVAS_DEFAULT_CARDS[4]!],
      renderCard: () => "Visitas realizadas",
      onCommit: () => undefined,
    };
    const compact = renderToStaticMarkup(
      createElement(DashboardCanvas, { ...props, compactControls: true }),
    );
    expect(compact).not.toContain("<strong");
    expect(compact).toContain('aria-label="Mover Visitas realizadas"');
    expect(compact).toContain('aria-label="Redimensionar Visitas realizadas"');
    expect(renderToStaticMarkup(createElement(DashboardCanvas, props))).toContain("<strong");
  });
  it("registers the 31 requested blocks with stable unique metrics and layout order", () => {
    expect(APPOINTMENTS_CANVAS_PAGE_KEY).toBe("crm.stage.appointments");
    expect(APPOINTMENTS_CANVAS_DEFAULT_CARDS).toHaveLength(31);
    expect(new Set(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ id }) => id)).size).toBe(31);
    expect(new Set(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ metric }) => metric)).size).toBe(31);
    expect(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ layout }) => layout.order)).toEqual(
      Array.from({ length: 31 }, (_, index) => index),
    );
  });

  it("keeps catalog and compatibility aligned with real renderers", () => {
    const cardsByMetric = new Map(
      APPOINTMENTS_CANVAS_DEFAULT_CARDS.map((card) => [card.metric, card]),
    );
    expect(APPOINTMENTS_CANVAS_CATALOG.metrics).toHaveLength(31);
    for (const metric of APPOINTMENTS_CANVAS_CATALOG.metrics) {
      const card = cardsByMetric.get(metric.key);
      expect(card, metric.key).toBeDefined();
      expect(metric.defaultType).toBe(card?.type);
      expect(APPOINTMENTS_CANVAS_COMPATIBILITY.typesByMetric?.[metric.key]).toContain(card?.type);
      expect(APPOINTMENTS_CANVAS_COMPATIBILITY.groupsByMetric?.[metric.key]).toEqual([
        card?.groupBy,
      ]);
      expect(APPOINTMENTS_CANVAS_COMPATIBILITY.periodsByMetric?.[metric.key]).toEqual([
        card?.period,
      ]);
    }

    const alternatives = Object.entries(
      APPOINTMENTS_CANVAS_COMPATIBILITY.typesByMetric ?? {},
    ).filter(([, types]) => types.length > 1);
    expect(alternatives).toEqual([
      ["team.productive", ["donut", "kpi"]],
      ["appointments.daily", ["bars", "line"]],
    ]);
  });

  it("applies the 500px automatic preset without changing user widths, order or indicators", () => {
    const source = APPOINTMENTS_CANVAS_DEFAULT_CARDS.map((card) => ({
      ...card,
      layout: { ...card.layout, height: 321, width: 315 },
      presentation: { fontScale: 0.75, barMaxHeight: 96, barScale: 0.8 },
    }));
    const before = structuredClone(source);
    const fitted = fitAppointmentsCharts(source);
    expect(source).toEqual(before);
    fitted.forEach((card, index) => {
      expect(card.layout.width).toBe(315);
      expect(card.layout.order).toBe(source[index]!.layout.order);
      if (index > 12 && !["appointments.details", "appointments.overdue"].includes(card.metric)) {
        expect(card.layout.height).toBe(500);
        expect(card.presentation).toEqual({ fontScale: 0.75 });
      } else {
        expect(card).toEqual(source[index]);
      }
    });
    const initial = createCanvasHistoryState(source, undefined, APPOINTMENTS_CARD_LAYOUT_POLICY);
    const applied = canvasReducer(initial, { type: "replace", cards: fitted });
    const undone = canvasReducer(applied, { type: "undo" });
    expect(undone.present).toEqual(initial.present);
  });

  it("uses the shared controller with an administrator-only appointments editor", () => {
    const source = readFileSync(
      new URL(
        "../app/(protected)/app/etapas/_components/AppointmentsDashboard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("<ConfigurableDashboardCanvas");
    expect(source).toContain("contentByMetricAndType={contentByMetricAndType}");
    expect(source).toContain("editable={canEditDashboard}");
    expect(source).toContain("profileControls={false}");
    expect(source).toContain("hideCardActionsByDefault");
    expect(source).toContain("layoutPolicy={APPOINTMENTS_CARD_LAYOUT_POLICY}");
    expect(source).toContain("compactCardControls");
    expect(source).toContain("hideCardOverflow");
    expect(source).toContain('addButtonLabel="Adicionar card"');
    expect(source).toContain('automaticProfileName="Layout de Agendamentos"');
    for (const metric of APPOINTMENTS_CANVAS_CATALOG.metrics) {
      expect(source, metric.key).toContain(`"${metric.key}": {`);
    }
    expect(source).toContain('"channel.house"');
    expect(source).toContain('"channel.partnerships"');
    expect(source).not.toContain("ChartBoard");
    expect(source).not.toContain("localStorage");
  });

  it("shows internal overflow scrollbars and keeps the resize control on the corner", () => {
    const appointmentsStyles = readFileSync(
      new URL(
        "../app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css",
        import.meta.url,
      ),
      "utf8",
    );
    const canvasStyles = readFileSync(
      new URL("../lib/dashboard-canvas/ui/dashboard-canvas.module.css", import.meta.url),
      "utf8",
    );
    expect(appointmentsStyles).toContain(
      ".configurableCanvas :is(.canvasChart .cardBody, .recencyPanel .recencyList, .tableViewport)",
    );
    expect(appointmentsStyles).toContain("scrollbar-width: thin");
    expect(appointmentsStyles).not.toContain("scrollbar-width: none");
    expect(canvasStyles).toContain('.shell[data-corner-resize="true"] .resizeHandle');
    expect(canvasStyles).toContain("right: -1px");
    expect(canvasStyles).toContain("bottom: -1px");
  });
});
