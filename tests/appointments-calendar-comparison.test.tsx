import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

const october: DashboardAnalysisSlice = {
  version: 2,
  viewKey: "all",
  coverageStart: "2026-01-01",
  referenceDate: "2026-10-31",
  dimensions: {
    managers: ["Gerente sintético"],
    owners: ["Corretor sintético"],
    companies: ["Empresa sintética"],
    developments: [],
    stores: [],
  },
  facts: [[1, "2026-10-31", 0, 0, 0, 1, -1, 22, 0, 0, -1]],
};

afterEach(() => vi.useRealTimers());

describe("appointments calendar server reference", () => {
  it("renders the civil current month even when the analytical snapshot ends in October", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={october} calendarDate="2026-11-01" />,
    );
    expect(markup).toContain(">Novembro de 2026</span>");
    expect(markup).toContain("Período sem cobertura disponível.");
    expect(markup).toContain('aria-label="Mês do calendário"');
    expect(markup).toMatch(/aria-label="1 de novembro de 2026"[^>]*aria-current="date"/u);
    expect(
      markup.match(
        /data-dashboard-card-id="appointments-today"[\s\S]*?<strong[^>]*>(.*?)<\/strong>/u,
      )?.[1],
    ).toBe("Indisponível");
    expect(
      markup.match(
        /data-dashboard-card-id="appointments-yesterday"[\s\S]*?<strong[^>]*>(.*?)<\/strong>/u,
      )?.[1],
    ).toBe("22");
  });

  it("renders January of the new year without clamping to the previous analytical year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={october} calendarDate="2027-01-01" />,
    );
    expect(markup).toContain(">Janeiro de 2027</span>");
    expect(markup).toContain('<option value="2027" selected="">2027</option>');
    expect(markup).toContain("Período sem cobertura disponível.");
    expect(markup).toMatch(/aria-label="1 de janeiro de 2027"[^>]*aria-current="date"/u);
  });
});
