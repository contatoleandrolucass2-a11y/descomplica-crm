import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductiveTeamDashboard } from "@/app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import { PRODUCTIVE_TEAM_STAGES } from "@/lib/crm/stages/productive-team";

const roster = [
  { key: "a", owner: "Corretor sintético A", manager: "Gerente sintético" },
  { key: "b", owner: "Corretor sintético B", manager: "Gerente sintético" },
];
const analysis: DashboardAnalysisSlice = {
  version: 4,
  viewKey: "all",
  brokerCount: 2,
  brokerManagerCount: 1,
  coverageStart: "2026-10-01",
  referenceDate: "2026-10-31",
  dimensions: {
    managers: ["Gerente sintético"],
    owners: roster.map((row) => row.owner),
    companies: ["Empresa sintética"],
    developments: [],
    stores: [],
  },
  facts: [
    [2, "2026-10-10", 0, 0, 0, 1, -1, 9, 0, 0, -1],
    [4, "2026-10-10", 0, 0, 0, 1, -1, 4, 0, 0, -1],
  ],
  appointments: [
    {
      createdAt: "2026-10-10T12:00:00Z",
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: "Regional sintético",
      salesManager: "Gerente sintético",
      owner: roster[0]!.owner,
      accountName: "",
      accountRanking: "",
      channel: 1,
      company: "Empresa sintética",
      registeredBroker: true,
    },
  ],
};

describe("Equipe Produtiva presentation", () => {
  it("renders the six filters and four distinct cards using broker counts", () => {
    const markup = renderToStaticMarkup(
      <ProductiveTeamDashboard
        analysis={analysis}
        brokerRoster={roster}
        availableStages={PRODUCTIVE_TEAM_STAGES}
        calendarDate="2026-10-31"
      />,
    );
    for (const label of [
      "Canal de vendas",
      "Gerente Regional",
      "Gerente de Vendas",
      "Responsável da conta",
      "Empresa",
      "Período",
    ])
      expect(markup).toContain(label);
    for (const label of ["Agendamentos", "Visitas", "Pastas", "Vendas"])
      expect(markup).toContain(`Equipe produtiva “${label}”`);
    expect(markup).toContain("1 de 2 corretores com visitas");
    expect(markup).toContain("1 de 2 corretores com vendas");
    expect(markup).toContain("0 de 2 corretores com pastas");
    expect(markup).toContain("50%");
    expect(markup).not.toContain("9 de 2");
  });

  it("distinguishes missing source from confirmed zero", () => {
    const markup = renderToStaticMarkup(
      <ProductiveTeamDashboard
        analysis={analysis}
        brokerRoster={roster}
        availableStages={["appointments", "visits", "sales"]}
        calendarDate="2026-10-31"
      />,
    );
    expect(markup).toContain("Relatório indisponível para esta etapa.");
    expect(markup).not.toContain("0 de 2 corretores com pastas");
  });

  it("keeps all cards unavailable when collection is absent", () => {
    const markup = renderToStaticMarkup(
      <ProductiveTeamDashboard
        analysis={null}
        brokerRoster={null}
        availableStages={[]}
        calendarDate="2026-10-31"
      />,
    );
    expect(markup).toContain("Aguardando coleta confirmada dos relatórios comerciais.");
    expect(markup).not.toContain("0%");
    expect(markup).not.toContain("0 de 0");
  });

  it("keeps the authorized Imob channel selected while collection is absent", () => {
    const markup = renderToStaticMarkup(
      <ProductiveTeamDashboard
        analysis={null}
        brokerRoster={null}
        availableStages={[]}
        initialChannel={0}
        calendarDate="2026-10-31"
      />,
    );
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Imob<\/button>/);
    expect(markup).toMatch(/aria-pressed="false"[^>]*>House<\/button>/);
    expect(markup).not.toContain("0%");
  });
});
