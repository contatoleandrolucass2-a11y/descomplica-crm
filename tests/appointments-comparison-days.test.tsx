import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  appointmentComparisonPath,
  AppointmentsComparison,
} from "@/app/(protected)/app/etapas/_components/AppointmentsComparison";
import { buildAppointmentComparison } from "@/app/(protected)/app/etapas/_components/appointments-comparison";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

const slice: DashboardAnalysisSlice = {
  version: 2,
  viewKey: "all",
  coverageStart: "2024-01-01",
  referenceDate: "2026-10-31",
  dimensions: {
    managers: ["Gerente"],
    owners: ["Corretor"],
    companies: [],
    stores: [],
    developments: [],
  },
  facts: [
    [1, "2026-10-03", 0, 0, -1, 1, -1, 22, 0, 0, -1],
    [1, "2026-09-03", 0, 0, -1, 1, -1, 11, 0, 0, -1],
  ],
};

describe("comparison calendar day axis", () => {
  it.each([
    ["2024-02", 29],
    ["2025-02", 28],
    ["2026-04", 30],
    ["2026-10", 31],
  ] as const)(
    "uses the real number of days in %s, preserving equally sized series",
    (month, count) => {
      const result = buildAppointmentComparison(slice, { month });
      expect(result.days).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      for (const series of result.series) expect(series.values).toHaveLength(count);
    },
  );

  it("compares the same selected day numbers instead of reapplying full reference dates", () => {
    const result = buildAppointmentComparison(slice, {
      month: "2026-10",
      filters: { createdDates: ["2026-10-03", "2026-10-04", "2026-09-03"] },
    });
    expect(result.days).toEqual([3, 4]);
    expect(result.series[0].values).toEqual([22, 0]);
    expect(result.series[1].values).toEqual([11, 0]);
  });

  it("intersects a date range with the selected Monday–Sunday week", () => {
    const result = buildAppointmentComparison(slice, {
      month: "2026-10",
      filters: { periodStart: "2026-10-03", periodEnd: "2026-10-08", week: 1 },
    });
    expect(result.days).toEqual([3, 4]);
  });

  it("does not invent dates when an explicit period misses the reference month", () => {
    const result = buildAppointmentComparison(slice, {
      month: "2026-10",
      filters: { periodStart: "2026-11-01", periodEnd: "2026-11-02" },
    });
    expect(result.days).toEqual([]);
    expect(result.series.every((series) => series.values.length === 0)).toBe(true);
  });

  it("renders every valid day aligned with its point and marks reference-month weekends", () => {
    const result = buildAppointmentComparison(slice, { month: "2026-10" });
    const html = renderToStaticMarkup(<AppointmentsComparison getComparison={() => result} />);
    expect(html.match(/data-comparison-day=/g)).toHaveLength(31);
    expect(html.match(/data-comparison-weekend="true"/g)).toHaveLength(9);
    expect(html).toContain('data-comparison-day="3" data-comparison-weekend="true"');
    expect(html).toContain('data-comparison-day="31" data-comparison-weekend="true"');
    expect(html).toContain('aria-label="Mês de referência · outubro de 2026, dia 3: 22"');
    expect(result.series[2].values[2]).toBe(4);
    expect(html).toContain('aria-label="Média de 2026, dia 3: 4"');
    expect(html).not.toContain("Ver valores e cobertura");
    expect(html).not.toContain("<table");
    expect(html.match(/<option /g)).toHaveLength(5);
    expect(html).toContain('data-comparison-series="quarter-average"');
    expect(html).toContain('title="Sáb" aria-label="3: Sáb"');
    expect(html).toContain('title="Qui" aria-label="1: Qui"');
    expect(html).toContain('title="Seg — Nossa Senhora Aparecida');
    // Points identify the series/date accessibly without a verbose native popup.
    expect(html).not.toContain("<title>Mês de referência");
  });

  it("keeps unavailable dates disconnected in straight, smooth and step layouts", () => {
    const x = (index: number) => index * 10;
    const y = (value: number) => 100 - value;
    const values = [2, 4, null, 8, 6];
    expect(appointmentComparisonPath(values, "straight", x, y)).toBe("M0,98 L10,96 M30,92 L40,94");
    expect(appointmentComparisonPath(values, "steps", x, y)).toBe("M0,98 H10 V96 M30,92 H40 V94");
    expect(appointmentComparisonPath(values, "smooth", x, y)).toBe(
      "M0,98 C5,98 5,96 10,96 M30,92 C35,92 35,94 40,94",
    );
  });

  it.each(["straight", "smooth", "steps", "points", "area"] as const)(
    "renders all four comparison series immediately in the %s layout",
    (layout) => {
      const result = buildAppointmentComparison(slice, { month: "2026-10" });
      const html = renderToStaticMarkup(
        <AppointmentsComparison getComparison={() => result} initialLayout={layout} />,
      );
      expect(html.match(/data-comparison-series=/g)).toHaveLength(4);
      expect(html).toContain(`data-line-layout="${layout}"`);
      expect(html.includes('fill-opacity="0.12"')).toBe(layout === "area");
      expect(html).not.toContain("<table");
    },
  );
});
