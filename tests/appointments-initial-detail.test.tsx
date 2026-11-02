import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { appointmentModel } from "./fixtures/appointments-summary";
vi.mock("@/lib/authorization/enforce", () => ({
  enforcePageAccess: async () => ({
    userId: "synthetic-user",
    roleKey: "admin",
    permissions: ["crm.dashboard.view"],
  }),
}));
vi.mock("@/lib/authorization/dashboard-views", () => ({
  getAuthorizedDashboardViews: () => ["all"],
}));
vi.mock("@/lib/crm/stages/data", () => ({
  loadAppointmentsReadModel: async () => appointmentModel(),
}));
vi.mock("@/lib/dashboard-canvas/persistence/server", () => ({
  listDashboardProfiles: async () => ({ data: [], error: null }),
}));
import StagePage from "@/app/(protected)/app/etapas/[stage]/page";

it("renders an uncovered current month as unavailable without an SSR failure or invented zero detail count", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  try {
    const html = renderToStaticMarkup(
      await StagePage({
        params: Promise.resolve({ stage: "agendamentos" }),
        searchParams: Promise.resolve({ view: "all" }),
      }),
    );
    expect(html).toContain("Período fora da cobertura disponível");
    expect(html).toContain("Detalhamento indisponível");
    expect(html).not.toContain("0 registros no período");
    expect(html).not.toContain("Exibindo 0–0");
  } finally {
    vi.useRealTimers();
  }
});
