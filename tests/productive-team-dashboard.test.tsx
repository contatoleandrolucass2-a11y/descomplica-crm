import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";

import { ProductiveTeamDashboard } from "@/app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import { PRODUCTIVE_TEAM_STAGES } from "@/lib/crm/stages/productive-team";

const roster = [
  {
    key: "a",
    owner: "Corretor sintético A",
    manager: "Gerente sintético",
    regionalManager: "Regional Oficial Nacional",
  },
  {
    key: "b",
    owner: "Corretor sintético B",
    manager: "Gerente sintético",
    regionalManager: "Regional Oficial Nacional",
  },
];
type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const elements = (node: Node, tag: string): Element[] => [
  ...("tagName" in node && node.tagName === tag ? [node] : []),
  ...("childNodes" in node ? node.childNodes.flatMap((child) => elements(child, tag)) : []),
];
const textContent = (node: Node): string =>
  "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(textContent).join("")
      : "";
const summaryFrom = (markup: string) =>
  elements(parseFragment(markup), "table").find((table) =>
    elements(table, "caption").some(
      (caption) => textContent(caption) === "Resumo da Equipe Produtiva",
    ),
  );
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
    const summary = summaryFrom(markup);
    expect(summary).toBeDefined();
    expect(
      elements(summary!, "thead").flatMap((head) => elements(head, "th").map(textContent)),
    ).toEqual([
      "Gerente Regional",
      "Gerente de Vendas",
      "Qnt de corretores",
      "Equipe produtiva “Agendamentos”",
      "Equipe produtiva “Visitas”",
      "Equipe produtiva “Pastas”",
      "Equipe produtiva “Vendas”",
    ]);
    const rows = elements(elements(summary!, "tbody")[0]!, "tr");
    expect(rows).toHaveLength(1);
    expect(rows.map((row) => elements(row, "td").slice(-5).map(textContent))).toEqual([
      ["2", "50%", "50%", "0%", "50%"],
    ]);
    expect(
      elements(elements(summary!, "tfoot")[0]!, "tr").flatMap((row) =>
        elements(row, "td").map(textContent),
      ),
    ).toEqual(["2", "50%", "50%", "0%", "50%"]);
    expect(textContent(summary!)).toContain("Regional");
    expect(textContent(summary!)).not.toContain("Não informado");
    expect(markup).not.toContain("Cada corretor é contado uma única vez por etapa");
    expect(markup).not.toContain("Cobertura parcial: os indicadores consideram");
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
    const summary = summaryFrom(markup)!;
    const rows = elements(elements(summary, "tbody")[0]!, "tr");
    expect(rows.map((row) => textContent(elements(row, "td")[5]!))).toEqual(["—"]);
  });

  it("groups managers dynamically and weights percentages by their broker bases", () => {
    const expandedRoster = [
      ...roster,
      {
        key: "c",
        owner: "Corretor sintético C",
        manager: "Gerente Zebra",
        regionalManager: "Regional Oficial Nacional",
      },
    ];
    const expandedAnalysis: DashboardAnalysisSlice = {
      ...analysis,
      brokerCount: 3,
      brokerManagerCount: 2,
      dimensions: {
        ...analysis.dimensions,
        managers: ["Gerente sintético", "Gerente Zebra"],
        owners: expandedRoster.map((row) => row.owner),
      },
      facts: [...analysis.facts, [2, "2026-10-10", 1, 2, 0, 1, -1, 1, 0, 0, -1]],
    };
    const summary = summaryFrom(
      renderToStaticMarkup(
        <ProductiveTeamDashboard
          analysis={expandedAnalysis}
          brokerRoster={expandedRoster}
          availableStages={PRODUCTIVE_TEAM_STAGES}
          calendarDate="2026-10-31"
        />,
      ),
    )!;
    const rows = elements(elements(summary, "tbody")[0]!, "tr");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => elements(row, "td").slice(2, 5).map(textContent))).toEqual([
      ["2", "50%", "50%"],
      ["1", "0%", "100%"],
    ]);
    expect(elements(elements(summary, "tfoot")[0]!, "td").map(textContent)).toEqual([
      "3",
      "33,3%",
      "66,7%",
      "0%",
      "33,3%",
    ]);
  });

  it("shows each known regional separately and preserves partial and missing links", () => {
    const regionalRoster = [
      { ...roster[0]!, regionalManager: "Ana Maria Almeida" },
      { ...roster[1]!, regionalManager: "Bruno Carlos Barbosa" },
      {
        key: "c",
        owner: "Corretor sintético C",
        manager: "Gerente sintético",
        regionalManager: null,
      },
      { key: "d", owner: "Corretor sintético D", manager: "Gerente Zebra", regionalManager: null },
    ];
    const regionalAnalysis: DashboardAnalysisSlice = {
      ...analysis,
      brokerCount: 4,
      brokerManagerCount: 2,
      dimensions: {
        ...analysis.dimensions,
        managers: ["Gerente sintético", "Gerente Zebra"],
        owners: regionalRoster.map((row) => row.owner),
      },
    };
    const summary = summaryFrom(
      renderToStaticMarkup(
        <ProductiveTeamDashboard
          analysis={regionalAnalysis}
          brokerRoster={regionalRoster}
          availableStages={PRODUCTIVE_TEAM_STAGES}
          calendarDate="2026-10-31"
        />,
      ),
    )!;
    const rows = elements(elements(summary, "tbody")[0]!, "tr");
    expect(rows).toHaveLength(2);
    const knownCell = elements(rows[0]!, "td")[0]!;
    const namedElements = elements(knownCell, "span").filter((element) =>
      element.attrs.some((attr) => attr.name === "title"),
    );
    expect(namedElements.map(textContent)).toEqual(["Ana Almeida", " / Bruno Barbosa"]);
    expect(
      namedElements.flatMap((element) =>
        element.attrs.filter((attr) => attr.name === "title").map((attr) => attr.value),
      ),
    ).toEqual(["Ana Maria Almeida", "Bruno Carlos Barbosa"]);
    expect(textContent(knownCell)).toContain("1 sem vínculo");
    expect(textContent(elements(rows[1]!, "td")[0]!)).toBe("Vínculo pendente");
    expect(rows.map((row) => textContent(elements(row, "td")[2]!))).toEqual(["3", "1"]);
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
    const summary = summaryFrom(markup)!;
    expect(summary).toBeDefined();
    expect(textContent(elements(summary, "tbody")[0]!)).toMatch(/indisponível|aguardando/iu);
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
