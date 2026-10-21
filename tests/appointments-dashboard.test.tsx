import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

const legacy: DashboardAnalysisSlice = {
  version: 1,
  viewKey: "all",
  coverageStart: "2026-10-01",
  referenceDate: "2026-10-19",
  dimensions: {
    managers: ["Gerente sintético"],
    owners: ["Responsável sintético"],
    companies: [],
    developments: ["Loja sintética"],
  },
  facts: [[1, "2026-10-01", 0, 0, -1, 0, 0, 4, 0, 0]],
};

const current: DashboardAnalysisSlice = {
  ...legacy,
  version: 3,
  brokerCount: 8,
  dimensions: { ...legacy.dimensions, stores: ["Loja sintética"] },
  facts: [[1, "2026-10-19", 0, 0, -1, 0, 0, 4, 0, 0, 0]],
  appointments: [
    {
      createdAt: "2026-10-19T12:00:00Z",
      scheduledAt: "2026-10-19T15:00:00Z",
      attendedAt: "2026-10-19T16:00:00Z",
      visitPerformed: true,
      regionalManager: "Regional sintético",
      salesManager: "Gerente sintético",
      owner: "Responsável sintético",
      accountName: "Conta sintética",
      accountRanking: "Ouro",
    },
  ],
};

describe("appointment dashboard availability", () => {
  it("shows unavailable analysis instead of invented charts or zero", () => {
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={null} />);
    expect(markup).toContain("Dados analíticos indisponíveis");
    expect(markup).not.toContain("0 agendamentos");
    expect(markup).not.toContain("<ol");
    expect(markup).toContain(">Agendamentos</h1>");
  });

  it("renders six cards, ordered charts and the detailed table for v3", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={current} individualGoal={24} />,
    );
    expect(markup).toContain("Período dos gráficos, indicadores e tabela");
    expect(markup).toContain(">Ano</label>");
    expect(markup).toContain("Mês selecionado com cobertura parcial");
    expect(markup).toContain("Meta do mês");
    expect(markup).toContain("Corretores cadastrados");
    expect(markup).toContain("Previstos e realizados hoje");
    expect(markup).toContain("Ranking por gerente regional");
    expect(markup).toContain("Ranking Score");
    expect(markup).toContain("1 de 192");
    expect(markup).toContain("24 por corretor × 8 corretores");
    expect(markup).toContain("Detalhamento dos agendamentos");
    expect(markup).toContain("Conta: Ranking");
    expect(markup).toContain("Conta sintética");
  });

  it("redacts the account ranking chart for profiles without ranking permission", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={current} canViewDevelopmentRankings={false} />,
    );
    expect(markup).toContain("Ranking Score indisponível para seu perfil de acesso");
  });
});
