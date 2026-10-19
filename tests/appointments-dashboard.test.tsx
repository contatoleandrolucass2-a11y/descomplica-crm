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

describe("appointment dashboard availability", () => {
  it("shows unavailable analysis instead of invented charts or zero", () => {
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={null} />);
    expect(markup).toContain("Dados analíticos indisponíveis");
    expect(markup).not.toContain("0 agendamentos");
    expect(markup).not.toContain("<ol");
    expect(markup).toContain(">Agendamentos</h1>");
  });

  it("renders all seven labeled charts, controls and explicit legacy development limitation", () => {
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={legacy} />);
    expect(markup.match(/<section/g)).toHaveLength(7);
    expect(markup).toContain("Período dos gráficos e rankings");
    expect(markup).toContain(">Ano</label>");
    expect(markup).toContain("Nome do empreendimento indisponível nesta atualização");
    expect(markup).toContain("Loja sintética");
    expect(markup).toContain("Mês selecionado com cobertura parcial");
    expect(markup).toContain("01/10/2026: 4 agendamentos");
  });

  it("explains restricted store and development rankings instead of rendering concealed dimensions", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={legacy} canViewDevelopmentRankings={false} />,
    );
    expect(markup).toContain("Ranking por loja indisponível para seu perfil de acesso");
    expect(markup).toContain("Ranking por empreendimento indisponível para seu perfil de acesso");
    expect(markup).not.toContain("Loja sintética");
  });
});
