import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  APPOINTMENTS_CANVAS_CATALOG,
  APPOINTMENTS_CANVAS_COMPATIBILITY,
  APPOINTMENTS_CANVAS_DEFAULT_CARDS,
  APPOINTMENTS_CANVAS_PAGE_KEY,
} from "@/app/(protected)/app/etapas/_components/appointments-canvas-config";

describe("appointments configurable dashboard", () => {
  it("registers the 28 requested blocks with stable unique metrics and layout order", () => {
    expect(APPOINTMENTS_CANVAS_PAGE_KEY).toBe("crm.stage.appointments");
    expect(APPOINTMENTS_CANVAS_DEFAULT_CARDS).toHaveLength(28);
    expect(new Set(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ id }) => id)).size).toBe(28);
    expect(new Set(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ metric }) => metric)).size).toBe(28);
    expect(APPOINTMENTS_CANVAS_DEFAULT_CARDS.map(({ layout }) => layout.order)).toEqual(
      Array.from({ length: 28 }, (_, index) => index),
    );
  });

  it("keeps catalog and compatibility aligned with real renderers", () => {
    const cardsByMetric = new Map(
      APPOINTMENTS_CANVAS_DEFAULT_CARDS.map((card) => [card.metric, card]),
    );
    expect(APPOINTMENTS_CANVAS_CATALOG.metrics).toHaveLength(28);
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
    expect(alternatives).toEqual([["team.productive", ["donut", "kpi"]]]);
  });

  it("uses the controller for profiles, toolbar and card persistence per channel", () => {
    const source = readFileSync(
      new URL(
        "../app/(protected)/app/etapas/_components/AppointmentsDashboard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("<ConfigurableDashboardCanvas");
    expect(source).toContain("contentByMetricAndType={contentByMetricAndType}");
    for (const metric of APPOINTMENTS_CANVAS_CATALOG.metrics) {
      expect(source, metric.key).toContain(`"${metric.key}": {`);
    }
    expect(source).toContain('"channel.house"');
    expect(source).toContain('"channel.partnerships"');
    expect(source).not.toContain("ChartBoard");
    expect(source).not.toContain("localStorage");
  });
});
