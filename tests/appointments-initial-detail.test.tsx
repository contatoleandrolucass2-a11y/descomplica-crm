import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
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
    const page = await StagePage({
      params: Promise.resolve({ stage: "agendamentos" }),
      searchParams: Promise.resolve({ view: "all" }),
    });
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider
        value={{
          back: vi.fn(),
          forward: vi.fn(),
          refresh: vi.fn(),
          push: vi.fn(),
          replace: vi.fn(),
          prefetch: vi.fn(),
          bfcacheId: "appointments-ssr-fixture",
        }}
      >
        {page}
      </AppRouterContext.Provider>,
    );
    expect(html).toContain("Período fora da cobertura disponível");
    expect(html).toContain("Detalhamento indisponível");
    expect(html).not.toContain("0 registros no período");
    expect(html).not.toContain("Exibindo 0–0");
  } finally {
    vi.useRealTimers();
  }
});
