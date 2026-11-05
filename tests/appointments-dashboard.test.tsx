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
    [3, "2026-10-19", 0, 0, 0, 1, 0, 1, 0, 1, -1],
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

const conversionGoals = {
  dv: {
    opportunityAppointment: 9,
    appointmentVisit: 3,
    appointmentFolder: 4,
    appointmentApprovedFolder: 12,
    appointmentSale: 12,
    monthlyFunnel: {
      opportunities: 216,
      appointments: 24,
      visits: 8,
      folders: 6,
      approvedFolders: 2,
      sales: 2,
    },
  },
  partnerships: {
    opportunityAppointment: null,
    appointmentVisit: null,
    appointmentFolder: null,
    appointmentApprovedFolder: null,
    appointmentSale: null,
    monthlyFunnel: {
      opportunities: 0,
      appointments: 0,
      visits: 4,
      folders: 2,
      approvedFolders: 1,
      sales: 1,
    },
  },
};

describe("appointment dashboard availability", () => {
  it("marks a regional result below a proven minimum red without promoting an incomplete target to exact", () => {
    const source = { ...current, viewKey: "without_canal_imob" as const };
    const brokerRoster = [
      { key: "known", owner: "Responsável sintético", manager: "Gerente sintético" },
      { key: "unknown", owner: "Sem vínculo", manager: "Gerente desconhecido" },
    ];
    const markupFor = (count: number) =>
      renderToStaticMarkup(
        <AppointmentsDashboard
          analysis={{
            ...source,
            appointments: Array.from({ length: count }, () => ({
              ...source.appointments![0]!,
              createdAt: "2026-10-01T12:00:00Z",
            })),
          }}
          brokerRoster={brokerRoster}
          calendarDate="2026-10-19"
        />,
      ).match(/<section[^>]*aria-label="Ranking por gerente regional"[^]*?<\/section>/u)?.[0] ?? "";
    const below = markupFor(1);
    expect(below).toContain('data-goal-status="negative"');
    expect(below).toContain("Meta mínima comprovada: 26; meta total indisponível");
    expect(below).not.toContain("Meta de agendamentos: 26");
    const aboveMinimum = markupFor(30);
    expect(aboveMinimum).toContain('data-goal-status="unavailable"');
    expect(aboveMinimum).not.toContain('data-goal-status="positive"');
  });
  it("opens the civil current month even when the validated snapshot is from last month", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={current}
        calendarDate="2026-11-01"
        generatedAt="2026-10-31T12:00:00Z"
      />,
    );
    expect(markup).toContain("Novembro de 2026");
    expect(markup).toContain("Período fora da cobertura disponível.");
    expect(markup).toContain("Atualizado em");
    expect(markup).toContain('<time dateTime="2026-10-31T12:00:00Z">');
  });

  it("shows real sale amount next to the sale count without replacing either measure", () => {
    const facts = current.facts.map((fact) =>
      fact[0] === 4 ? ([...fact.slice(0, 8), 123456.78, ...fact.slice(9)] as typeof fact) : fact,
    );
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={{ ...current, facts }} />);
    expect(markup).toContain("Vendas no período");
    expect(markup).toContain("Valor Real de Venda");
    expect(markup).toContain("123.456,78");
  });
  it("uses the doubled Thursday goal in today's KPI and preserves a configured zero monthly goal", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={{ ...current, viewKey: "without_canal_imob", referenceDate: "2026-10-22" }}
        individualGoal={0}
      />,
    );
    expect(markup).toContain("Meta cadastrada: 0 · meta atingida");
    expect(markup).not.toContain("Aguardando a meta individual vigente");
    expect(markup).toContain("Abaixo da meta: 0 para meta 16");
  });

  it("shows unavailable analysis instead of invented charts or zero", () => {
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={null} />);
    expect(markup).toContain("Dados analíticos indisponíveis");
    expect(markup).not.toContain("0 agendamentos");
    expect(markup).not.toContain("<ol");
    expect(markup).toContain(">Agendamentos</h1>");
  });

  it("renders dimension and calendar filters, cards, recency panels and details for v4", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={{ ...current, viewKey: "without_canal_imob" }}
        individualGoal={24}
        conversionGoals={conversionGoals}
      />,
    );
    expect(markup).not.toContain("Período dos gráficos, indicadores e tabela");
    expect(markup).not.toContain("Cobertura da fonte");
    expect(markup).toContain("Cobertura parcial entre 01/10/2026 e 19/10/2026");
    expect(markup).toContain(">Ano</label>");
    expect(markup).toContain("Meta do mês");
    expect(markup).toContain("Filtros do painel de agendamentos");
    expect(markup).toContain("Canal de vendas");
    expect(markup).toContain("Gerente Regional");
    expect(markup).toMatch(
      /id="appointment-filter-regionalManager"[^]*?<option value="" selected="">Todos<\/option>/u,
    );
    expect(markup).toMatch(
      /id="appointment-filter-company"[^]*?<option value="" selected="">Todas<\/option>/u,
    );
    expect(markup).not.toContain("Todos os gerentes regionais");
    expect(markup).toContain("Gerente de Vendas");
    expect(markup).toContain("Responsável da conta");
    expect(markup).toContain(">Empresa</span>");
    expect(markup).toContain(">Período</span>");
    expect(markup).toContain("Outubro de 2026");
    expect(markup).toContain("Selecione o período");
    expect(markup).toContain(
      "Use um atalho, escolha o mês inteiro ou selecione um ou vários dias.",
    );
    expect(markup).toContain("Hoje");
    expect(markup).toContain("Semana passada");
    expect(markup).toContain("4º Trimestre");
    expect(markup).toContain('aria-label="Dias do mês"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Limpar 1 filtro");
    expect(markup).toContain('aria-pressed="true">House</button>');
    expect(markup).toContain("Equipe Produtiva");
    expect(markup).toContain("1 de 8 corretores, 12,5 por cento da equipe");
    expect(markup).toContain("Corretores cadastrados");
    expect(markup).toContain("Oportunidade x Agendamento");
    expect(markup).toContain("Agendamento x Visita");
    expect(markup).toContain("Agendamento x Venda");
    expect(markup).toContain("Funil esperado no período");
    expect(markup).toContain("Realizado até o momento");
    expect(markup).toContain("Agendamento x Pasta");
    expect(markup).toContain("Agendamento x Pasta Aprovada");
    expect(markup).toContain("Pastas aprovadas");
    expect(markup).toContain("Gerentes cadastrados");
    expect(markup).toContain("Visitas realizadas");
    expect(markup).toContain("Vendas no período");
    expect(markup).toContain("Qnt. de dias");
    expect(markup).toContain("Desenvolvido e gerenciado por Leandro Lucas");
    expect(markup).toContain("9 oportunidades para 1 agendamento");
    expect(markup).not.toContain("9 → 1");
    expect(markup).toContain("11,1%<");
    expect(markup).toContain('data-goal-status="negative"');
    expect(markup).toContain('data-goal-status="positive"');
    expect(markup).toContain("Dentro da meta: 9 para 1; limite 9 para 1");
    expect(markup).toContain("Previstos e realizados hoje");
    expect(markup).toContain("Ranking por gerente regional");
    expect(markup).toContain("Melhor responsável: Agendamento x Visita");
    expect(markup).toContain("Melhor gerente: Agendamento x Visita");
    expect(markup).toContain("Melhor gerente regional: Agendamento x Visita");
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
    expect(markup.indexOf("Evolução de agendamentos por dia")).toBeLessThan(
      markup.indexOf("Previstos e realizados hoje"),
    );
    expect(markup.indexOf("Ranking por responsável")).toBeLessThan(
      markup.indexOf("Ranking por gerente regional"),
    );
    expect(markup.indexOf("Último agendamento: até 7 dias")).toBeLessThan(
      markup.indexOf("Agendamentos por mês"),
    );
  });

  it("renders zero conversions without Infinity or NaN", () => {
    const empty: DashboardAnalysisSlice = { ...current, facts: [], appointments: [] };
    const markup = renderToStaticMarkup(<AppointmentsDashboard analysis={empty} />);
    expect(markup).toContain("Sem conversão no período selecionado");
    expect(markup).toContain("Aproveitamento indisponível no período selecionado");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("NaN");
  });

  it("redacts the account ranking chart for profiles without ranking permission", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard analysis={current} canViewDevelopmentRankings={false} />,
    );
    expect(markup).toContain("Ranking Score indisponível para seu perfil de acesso");
  });

  it("uses the selected month's conversion policy instead of the current fallback", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={{ ...current, viewKey: "without_canal_imob" }}
        conversionGoals={{
          ...conversionGoals,
          dv: {
            ...conversionGoals.dv,
            monthlyFunnel: { ...conversionGoals.dv.monthlyFunnel, opportunities: 24 },
          },
        }}
        conversionGoalsByMonth={{ "2026-10": conversionGoals }}
      />,
    );
    expect(markup.includes("Dentro da meta: 9 para 1; limite 9 para 1")).toBe(true);
  });

  it("does not substitute the current policy when the historical map lacks the month", () => {
    const markup = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={{ ...current, viewKey: "without_canal_imob" }}
        conversionGoals={conversionGoals}
        conversionGoalsByMonth={{ "2026-09": conversionGoals }}
      />,
    );
    expect(markup.includes("Meta de conversão não configurada para House")).toBe(true);
    expect(markup.includes("Dentro da meta: 9 para 1; limite 9 para 1")).toBe(false);
  });
});
