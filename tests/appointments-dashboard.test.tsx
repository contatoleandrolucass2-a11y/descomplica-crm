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
  version: 4,
  brokerCount: 8,
  brokerManagerCount: 1,
  dimensions: {
    ...legacy.dimensions,
    companies: ["Empresa sintética"],
    stores: ["Loja sintética"],
  },
  facts: [
    [0, "2026-10-19", 0, 0, 0, 1, 0, 9, 0, 0, -1],
    [1, "2026-10-19", 0, 0, 0, 1, 0, 1, 0, 0, 0],
    [2, "2026-10-19", 0, 0, 0, 1, 0, 1, 0, 0, -1],
    [4, "2026-10-19", 0, 0, 0, 1, 0, 1, 0, 0, -1],
  ],
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
      channel: 1,
      company: "Empresa sintética",
      registeredBroker: true,
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

  it("renders dimension and calendar filters, cards, recency panels and details for v4", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={current} individualGoal={24} />,
    );
    expect(markup).not.toContain("Período dos gráficos, indicadores e tabela");
    expect(markup).not.toContain("Cobertura da fonte");
    expect(markup).toContain(">Ano</label>");
    expect(markup).toContain("Meta do mês");
    expect(markup).toContain("Filtros do painel de agendamentos");
    expect(markup).toContain("Canal de vendas");
    expect(markup).toContain("Gerente de Vendas");
    expect(markup).toContain("Responsável da conta");
    expect(markup).toContain(">Empresa</span>");
    expect(markup).toContain(">Período</span>");
    expect(markup).toContain("Outubro de 2026");
    expect(markup).toContain("Selecione o período");
    expect(markup).toContain("Escolha o mês inteiro ou selecione um ou vários dias.");
    expect(markup).toContain('aria-label="Dias do mês"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Limpar filtros");
    expect(markup).toContain("Equipe Produtiva");
    expect(markup).toContain("1 de 8 corretores, 12,5 por cento da equipe");
    expect(markup).toContain("Corretores cadastrados");
    expect(markup).toContain("Oportunidade x Agendamento");
    expect(markup).toContain("Agendamento x Visita");
    expect(markup).toContain("Agendamento x Venda");
    expect(markup).toContain("Gerentes cadastrados");
    expect(markup).toContain("Visitas realizadas");
    expect(markup).toContain("Vendas no período");
    expect(markup).toContain("9 oportunidades para 1 agendamento");
    expect(markup).not.toContain("9 → 1");
    expect(markup).toContain("11,1%<");
    expect(markup).toContain("Previstos e realizados hoje");
    expect(markup).toContain("Ranking por gerente regional");
    expect(markup).toContain("Ranking Score");
    expect(markup).toContain("Último agendamento: até 7 dias");
    expect(markup).toContain("Último agendamento: de 8 a 14 dias");
    expect(markup).toContain("Último agendamento: 15 dias ou mais");
    expect(markup).toContain("Responsável sintético");
    expect(markup).toContain("Hoje");
    expect(markup).toContain("1 de 192");
    expect(markup).toContain("24 por corretor × 8 corretores");
    expect(markup).toContain("Detalhamento dos agendamentos");
    expect(markup).toContain("Conta: Ranking");
    expect(markup).toContain("Conta sintética");
  });

  it("renders zero conversions without Infinity or NaN", () => {
    const empty: DashboardAnalysisSlice = { ...current, facts: [], appointments: [] };
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={empty} />);
    expect(markup).toContain("Sem conversão no período selecionado");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("NaN");
  });

  it("redacts the account ranking chart for profiles without ranking permission", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={current} canViewDevelopmentRankings={false} />,
    );
    expect(markup).toContain("Ranking Score indisponível para seu perfil de acesso");
  });
});
