import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import { buildAppointmentComparison } from "@/app/(protected)/app/etapas/_components/appointments-comparison";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

vi.mock("@/app/(protected)/app/etapas/_components/appointments-comparison", async (original) => {
  const actual =
    await original<
      typeof import("@/app/(protected)/app/etapas/_components/appointments-comparison")
    >();
  return { ...actual, buildAppointmentComparison: vi.fn(actual.buildAppointmentComparison) };
});

const analysis: DashboardAnalysisSlice = {
  version: 2,
  viewKey: "all",
  coverageStart: "2026-01-01",
  referenceDate: "2026-10-31",
  dimensions: {
    managers: ["Gerente sintético"],
    owners: ["Corretor sintético"],
    companies: [],
    developments: [],
    stores: [],
  },
  facts: [[1, "2026-10-31", 0, 0, -1, 1, -1, 12, 0, 0, -1]],
};

beforeEach(() => vi.clearAllMocks());

describe("appointment comparison lazy computation", () => {
  it("does not construct unused line comparisons while rendering the default bar dashboard on the server", () => {
    const html = renderToStaticMarkup(
      <AppointmentsDashboard analysis={analysis} calendarDate="2026-10-31" />,
    );
    expect(html).toContain("Evolução de agendamentos por dia");
    expect(buildAppointmentComparison).not.toHaveBeenCalled();
  });

  it("does not construct a comparison for an unavailable analytical snapshot", () => {
    const html = renderToStaticMarkup(
      <AppointmentsDashboard analysis={null} calendarDate="2026-10-31" />,
    );
    expect(html).toContain("Dados analíticos indisponíveis");
    expect(buildAppointmentComparison).not.toHaveBeenCalled();
  });
});
