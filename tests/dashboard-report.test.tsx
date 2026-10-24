import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import {
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardMetric, DashboardReadModel } from "@/lib/crm/dashboard/data";
import type { DashboardStageKey } from "@/lib/crm/dashboard/catalog";
import {
  analyzeDashboard,
  applyDashboardAnalysis,
  emptyDashboardFilters,
  parseDashboardFilters,
} from "@/lib/crm/dashboard/analysis";
import {
  DASHBOARD_CHANNELS,
  type DashboardAnalysisFact,
} from "@/lib/crm/dashboard/analysis-contract";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useTransition: () => [false, (callback: () => void) => callback()],
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => undefined,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    const anchor = { ...props };
    delete anchor.prefetch;
    return createElement("a", { ...anchor, href }, children);
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

import { DashboardReport } from "@/app/(protected)/app/_components/DashboardReport";
import { DashboardFilters } from "@/app/(protected)/app/_components/DashboardFilters";

beforeEach(() => {
  vi.clearAllMocks();
  navigation.query = "";
});

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type Props = ComponentProps<typeof DashboardReport>;

function metric(overrides: Partial<DashboardMetric> = {}): DashboardMetric {
  return {
    currentMonth: 2000,
    currentWeek: 200,
    currentToday: 20,
    goalMonth: 2400,
    goalWeek: 600,
    goalToday: 120,
    previousMonth: 1600,
    yearClosedMonthsAverage: 1200,
    lastThreeClosedMonthsAverage: 1400,
    previousFourteenDays: 400,
    lastFourteenDays: 600,
    previousSevenDays: 160,
    lastSevenDays: 200,
    previousWeek: 120,
    yesterday: 40,
    ...overrides,
  };
}

function fixture(): DashboardReadModel {
  const metrics: Record<DashboardStageKey, DashboardMetric> = {
    opportunities: metric(),
    appointments: metric({
      currentMonth: 1000,
      currentWeek: 70,
      currentToday: 5,
      goalMonth: 1600,
      goalWeek: 400,
      goalToday: 80,
      previousMonth: 800,
      yearClosedMonthsAverage: 600,
      lastThreeClosedMonthsAverage: 700,
      previousFourteenDays: 140,
      lastFourteenDays: 210,
      previousSevenDays: 56,
      lastSevenDays: 70,
      previousWeek: 42,
      yesterday: 10,
    }),
    visits: metric({ currentMonth: 500, currentWeek: 35, currentToday: 2, goalMonth: 800 }),
    folders: metric({ currentMonth: 250, currentWeek: 14, currentToday: 1, goalMonth: 500 }),
    sales: metric({
      currentMonth: 100,
      currentWeek: 7,
      currentToday: 0,
      goalMonth: 200,
      goalWeek: 50,
      goalToday: 10,
    }),
  };
  return {
    id: 1,
    snapshotKey: "qa-synthetic-dashboard-report",
    referenceDate: "2026-10-13",
    generatedAt: "2026-10-13T15:00:00.000Z",
    updatedAt: "2026-10-13T15:00:00.000Z",
    timezone: "America/Sao_Paulo",
    source: "QA SYNTHETIC ONLY",
    goalsAvailable: true,
    metrics: {
      all: metrics,
      with_canal_imob: structuredClone(metrics),
      without_canal_imob: structuredClone(metrics),
    },
    salesValue: {
      all: { month: 42000000, week: 2940000, today: 0 },
      with_canal_imob: { month: 20000000, week: 840000, today: 0 },
      without_canal_imob: { month: 22000000, week: 2100000, today: 0 },
    },
    topDevelopments: {
      all: [{ rank: 1, name: "Empreendimento sintetico Geral", total: 17 }],
      with_canal_imob: [{ rank: 1, name: "Empreendimento sintetico Canal", total: 7 }],
      without_canal_imob: [{ rank: 1, name: "Empreendimento sintetico House", total: 10 }],
    },
  };
}

function analysisFixture(brokers = 10) {
  return analyzeDashboard(
    {
      version: 1,
      viewKey: "all",
      coverageStart: "2026-01-01",
      referenceDate: "2026-10-13",
      dimensions: {
        managers: ["Gerente sintético"],
        owners: Array.from({ length: brokers }, (_, index) => `Corretor sintético ${index + 1}`),
        companies: ["Empresa sintética"],
        developments: ["Empreendimento sintético"],
      },
      facts: Array.from(
        { length: brokers },
        (_, owner): DashboardAnalysisFact => [0, "2026-10-13", 0, owner, 0, owner % 2, 0, 1, 0, 0],
      ),
    },
    emptyDashboardFilters(),
  );
}

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    dashboard: fixture(),
    selectedView: "all",
    selectedPeriod: "month",
    authorizedViews: ["all", "with_canal_imob", "without_canal_imob"] as const,
    canViewStages: true,
    canViewRanking: true,
    canRefresh: true,
    team: {
      brokers: 12,
      managers: [
        { name: "Gerencia sintetica Alfa", total: 7 },
        { name: "Gerencia sintetica Beta", total: 5 },
      ],
    },
    ...overrides,
  };
  if ("analysis" in overrides && !("goalBrokerCount" in overrides)) {
    props.goalBrokerCount = overrides.analysis?.brokerCount ?? null;
  }
  return parseFragment(renderToStaticMarkup(createElement(DashboardReport, props)));
}

function elements(node: Node, tag: string): Element[] {
  const found: Element[] = "tagName" in node && node.tagName === tag ? [node] : [];
  if ("childNodes" in node)
    for (const child of node.childNodes) found.push(...elements(child, tag));
  return found;
}

function text(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("").replace(/\s+/g, " ").trim() : "";
}

function attribute(node: Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function insideDialog(node: Node): boolean {
  if (!("parentNode" in node) || !node.parentNode) return false;
  return (
    ("tagName" in node.parentNode && node.parentNode.tagName === "dialog") ||
    insideDialog(node.parentNode)
  );
}

function monthlyFigures(root: Node) {
  return elements(root, "figure").filter((node) =>
    attribute(node, "aria-label")?.startsWith("Funil mensal:"),
  );
}

type InteractiveProps = {
  type?: string;
  children?: ReactNode;
  onChange?: () => void;
  onClick?: () => void;
  checked?: boolean;
};
function interactiveElements(node: ReactNode, tag: string): Array<ReactElement<InteractiveProps>> {
  if (Array.isArray(node)) return node.flatMap((child) => interactiveElements(child, tag));
  if (!isValidElement<InteractiveProps>(node)) return [];
  return [...(node.type === tag ? [node] : []), ...interactiveElements(node.props.children, tag)];
}

function only(nodes: Element[]): Element {
  expect(nodes).toHaveLength(1);
  return nodes[0]!;
}

function section(root: Node, id: string) {
  return only(
    elements(root, "section").filter((node) => attribute(node, "aria-labelledby") === id),
  );
}

function card(root: Node, title: string) {
  return only(
    elements(root, "article").filter((node) =>
      elements(node, "h3").some((heading) => text(heading) === title),
    ),
  );
}

function value(root: Node, label: string) {
  const term = only(elements(root, "dt").filter((node) => text(node) === label));
  expect(term.parentNode).not.toBeNull();
  return text(only(elements(term.parentNode!, "dd")));
}

function structuralContract(root: Node) {
  expect(elements(root, "h1").map(text)).toEqual(["Dashboard | Resumo Geral"]);
  expect(elements(root, "h2").map(text)).toEqual(
    expect.arrayContaining([
      "Funis comerciais",
      "Metas",
      "Períodos do mês",
      "Histórico e média por venda",
    ]),
  );
  expect(
    elements(root, "section").some(
      (node) => attribute(node, "aria-labelledby") === "report-pulse-title",
    ),
  ).toBe(false);
  expect(elements(root, "figure").flatMap((figure) => elements(figure, "circle"))).toHaveLength(0);
  expect(text(root)).not.toMatch(/Conversão por etapa|Ritmo de vendas|Parecer de ritmo/);
  const monthly = section(root, "report-monthly-title");
  const blocks = elements(monthly, "article").filter((node) => !insideDialog(node));
  expect(blocks).toHaveLength(13);
  expect(monthlyFigures(monthly)).toHaveLength(13);
  expect(
    elements(monthly, "h3")
      .filter((node) => !insideDialog(node))
      .map(text),
  ).toEqual([
    "Meta mês",
    "Meta esperada at\u00e9 hoje",
    "M\u00eas atual",
    "Mês",
    "Semana anterior",
    "Esta semana",
    "Ontem",
    "Hoje",
    "Média do ano",
    "Média dos últimos 3 meses",
    "Mês anterior",
    "Mês",
    "Média venda",
  ]);
  for (const block of blocks) {
    const funnel = only(monthlyFigures(block));
    const title = text(only(elements(block, "h3").filter((node) => !insideDialog(node))));
    expect(attribute(funnel, "aria-label")).toMatch(
      title === "Mês"
        ? /^Funil mensal: Mês \((Períodos do mês|Histórico)\)$/
        : new RegExp(`^Funil mensal: ${title}$`),
    );
    expect(elements(funnel, "dt").map(text)).toEqual([
      "Oportunidades",
      "Agendamentos",
      "Visitas",
      "Pastas",
      "Pastas aprovadas",
      "Vendas",
    ]);
    expect(elements(funnel, "div").map((step) => attribute(step, "data-stage"))).toEqual([
      "opportunities",
      "appointments",
      "visits",
      "folders",
      "approved-folders",
      "sales",
    ]);
    for (const quantity of elements(funnel, "dd")) {
      expect(text(quantity)).toMatch(/^(?:\d{1,3}(?:\.\d{3})*|\d+|Indisponível)$/);
    }
  }
  for (const [id, count] of [
    ["report-goals-title", 3],
    ["report-periods-title", 5],
    ["report-history-title", 5],
  ] as const) {
    expect(monthlyFigures(section(root, id))).toHaveLength(count);
  }
  expect(elements(root, "section").map((node) => attribute(node, "aria-labelledby"))).not.toEqual(
    expect.arrayContaining(["report-diagnosis-title"]),
  );
  expect(text(root)).not.toMatch(
    /Corretores por gerente|Realizado Funil|Ranking validado|Outros indicadores/,
  );
  expect(text(root)).not.toMatch(/NaN|Infinity|undefined/);
}

describe("DashboardReport: regressao com dados sinteticos", () => {
  it.each([0.6, 2.9, null])(
    "exibe floor de %s em todos os periodos e historicos sem substituir nulo por zero",
    (quantity) => {
      const dashboard = fixture();
      const analysis = analysisFixture();
      for (const readings of Object.values(analysis.periodReadings)) {
        for (const reading of readings) reading.value = quantity;
      }
      for (const stage of stagesForTest()) {
        dashboard.metrics.all![stage].yearClosedMonthsAverage = quantity;
        dashboard.metrics.all![stage].lastThreeClosedMonthsAverage = quantity;
        dashboard.metrics.all![stage].previousMonth = quantity;
      }
      const root = render({ dashboard, analysis });
      const expected = quantity === null ? "Indisponível" : String(Math.floor(quantity));
      for (const group of ["report-periods-title", "report-history-title"]) {
        for (const funnel of monthlyFigures(section(root, group))) {
          const saleAverage = attribute(funnel, "aria-label") === "Funil mensal: Média venda";
          for (const stage of elements(funnel, "div")) {
            if (attribute(stage, "data-stage") === "approved-folders") continue;
            expect(text(only(elements(stage, "dd")))).toBe(
              saleAverage && quantity !== null ? "1" : expected,
            );
          }
        }
      }
      expect(value(card(section(root, "report-goals-title"), "Mês atual"), "Vendas")).toBe(
        expected,
      );
    },
  );

  it("calcula percentuais sobre valores fracionarios originais antes do floor visual", () => {
    const dashboard = fixture();
    for (const stage of stagesForTest()) dashboard.metrics.all![stage].previousMonth = 0.6;
    dashboard.metrics.all!.opportunities.previousMonth = 2.9;
    const root = render({ dashboard, analysis: analysisFixture() });
    const previous = card(section(root, "report-history-title"), "Mês anterior");
    expect(value(previous, "Oportunidades")).toBe("2");
    expect(value(previous, "Agendamentos")).toBe("0");
    expect(value(previous, "Oportunidades para agendamentos")).toBe("20,7%");
    expect(value(previous, "Conversão total Vendas / oportunidades")).toBe("20,7%");
    const expected = card(section(root, "report-goals-title"), "Meta esperada até hoje");
    expect(value(expected, "Agendamentos para visitas")).toBe("50%");
  });

  it("preserva os blocos completos com snapshot disponivel", () => structuralContract(render()));

  it("offers one authorized dialog trigger per funnel stage and hides unauthorized stages", () => {
    const root = render({
      authorizedStagePaths: ["/app/etapas/vendas"],
      stageDetails: [
        {
          stage: "sales",
          date: "2026-10-13",
          channel: DASHBOARD_CHANNELS[1],
          manager: "Gerente sintético",
          owner: "Corretor sintético",
          company: "Empresa sintética",
          development: "Empreendimento sintético",
          quantity: 1,
        },
      ],
    });
    const triggers = elements(root, "button").filter((button) =>
      attribute(button, "aria-label")?.startsWith("Abrir detalhes de "),
    );
    expect(triggers).toHaveLength(13);
    expect(triggers.every((button) => attribute(button, "aria-label")?.includes("Vendas"))).toBe(
      true,
    );
    expect(elements(root, "dialog")).toHaveLength(4);
  });

  it("renders every Imob funnel with four stages and the active goal multiplied by seven", () => {
    const root = render({
      analysis: analysisFixture(),
      filters: parseDashboardFilters({ channel: DASHBOARD_CHANNELS[0] }),
      partnershipGoals: {
        visits: 12,
        folders: 64,
        "approved-folders": 32,
        sales: 20,
      },
      today: "2026-10-20",
    });
    const monthly = section(root, "report-monthly-title");
    const figures = monthlyFigures(monthly);
    expect(figures).toHaveLength(13);
    for (const funnel of figures) {
      expect(attribute(funnel, "data-stage-count")).toBe("4");
      expect(elements(funnel, "dt").map(text)).toEqual([
        "Visitas",
        "Pastas",
        "Pastas aprovadas",
        "Vendas",
      ]);
      expect(elements(funnel, "div").map((step) => attribute(step, "data-stage"))).toEqual([
        "visits",
        "folders",
        "approved-folders",
        "sales",
      ]);
    }
    const goals = card(section(root, "report-goals-title"), "Meta mês");
    expect(text(goals)).toContain("7 gerentes de vendas no grupo");
    expect(value(goals, "Visitas")).toBe("84");
    expect(value(goals, "Pastas")).toBe("448");
    expect(value(goals, "Pastas aprovadas")).toBe("224");
    expect(value(goals, "Vendas")).toBe("140");
    expect(value(goals, "Conversão total Vendas / visitas")).toBe("166,7%");
    const expected = card(section(root, "report-goals-title"), "Meta esperada até hoje");
    expect(value(expected, "Visitas")).toBe("54");
    expect(value(expected, "Pastas")).toBe("289");
    expect(value(expected, "Pastas aprovadas")).toBe("144");
    expect(value(expected, "Vendas")).toBe("90");
    const historyDialog = only(elements(card(monthly, "Média do ano"), "dialog"));
    expect(text(historyDialog)).not.toMatch(/Oportunidades|Agendamentos/);
    expect(elements(historyDialog, "figure")).toHaveLength(4);
  });

  it("preserva a fonte no atributo sem Fonte, API ou contexto repetido no header", () => {
    const dashboard = fixture();
    dashboard.source = "API";
    const root = render({ dashboard });
    const report = only(
      elements(root, "div").filter((node) => attribute(node, "data-dashboard-source") === "API"),
    );
    const heading = only(elements(report, "h1"));
    const headingContainer = heading.parentNode;
    if (!headingContainer || !("tagName" in headingContainer)) {
      throw new Error("Expected an element containing the dashboard heading.");
    }
    const header = headingContainer.parentNode;
    if (!header || !("tagName" in header)) {
      throw new Error("Expected a dashboard header element.");
    }
    expect(text(header)).not.toMatch(/Fonte|API|Geral\s*·\s*Mês/);
    expect(elements(header, "dt").map(text)).toEqual(["Atualizado em"]);
    expect(value(header, "Atualizado em")).not.toBe("Indisponível");
  });

  it("desenha os funis com valores atuais, sem copiar numeros do print ou estimar aprovadas", () => {
    const analysis = analysisFixture();
    analysis.periodReadings.month.forEach((reading) => {
      reading.value =
        reading.key === "approved-folders" ? 125 : fixture().metrics.all![reading.key].currentMonth;
    });
    const monthly = section(render({ analysis }), "report-monthly-title");
    expect(monthlyFigures(monthly)).toHaveLength(13);
    const current = only(elements(card(monthly, "Mês atual"), "figure"));
    expect(elements(current, "dd").map(text)).toEqual([
      "2.000",
      "1.000",
      "500",
      "250",
      "125",
      "100",
    ]);
  });

  it("preserva numeros longos no funil sem abreviar o indicador", () => {
    const dashboard = fixture();
    const analysis = analysisFixture();
    analysis.periodReadings.month.find((reading) => reading.key === "sales")!.value = 9876543.2;
    const current = card(
      section(render({ dashboard, analysis }), "report-monthly-title"),
      "Mês atual",
    );
    const sales = only(
      elements(current, "div").filter((step) => attribute(step, "data-stage") === "sales"),
    );
    expect(text(only(elements(sales, "dd")))).toBe("9.876.543");
    expect(attribute(only(elements(sales, "dd")), "data-long")).toBe("true");
  });

  it("preserva a estrutura inteira sem snapshot e nunca apresenta ausencia como zero", () => {
    const root = render({
      dashboard: null,
      team: null,
      teamUnavailableReason: "Equipe sintetica indisponivel.",
    });
    structuralContract(root);
    expect(
      elements(section(root, "report-monthly-title"), "dd").every(
        (node) => text(node) === "Indispon\u00edvel",
      ),
    ).toBe(true);
  });

  it.each([["month"], ["week"], ["today"]] as const)(
    "preserva os funis mensais independentemente do periodo legado %s",
    (period) => {
      const root = render({ selectedPeriod: period, analysis: analysisFixture() });
      structuralContract(root);
      expect(
        value(card(section(root, "report-monthly-title"), "M\u00eas atual"), "Agendamentos"),
      ).toBe("0");
    },
  );

  it("mantem historico e metas indisponiveis sem analysis mesmo com agregados legados", () => {
    const root = render();
    const monthly = section(root, "report-monthly-title");
    for (const [label, expected] of [
      ["M\u00e9dia do ano", "Indisponível"],
      ["M\u00e9dia dos \u00faltimos 3 meses", "Indisponível"],
      ["M\u00eas anterior", "Indisponível"],
      ["Meta mês", "Indisponível"],
      ["M\u00eas atual", "Indisponível"],
    ])
      expect(value(card(monthly, label!), "Agendamentos")).toBe(expected);
    const expected = card(monthly, "Meta esperada at\u00e9 hoje");
    expect(elements(expected, "dd").every((node) => text(node) === "Indispon\u00edvel")).toBe(true);
    const groups = elements(root, "div").filter((node) => attribute(node, "role") === "group");
    expect(groups.map((node) => attribute(node, "aria-label"))).toEqual([
      "Gerente de Vendas",
      "Responsável da conta",
      "Empresa",
    ]);
    for (const input of elements(root, "input")) expect(attribute(input, "disabled")).toBe("");
    for (const dialog of elements(root, "dialog")) expect(elements(dialog, "time")).toHaveLength(0);
  });

  it("renderiza cada janela a partir das leituras certificadas do periodo", () => {
    const analysis = analysisFixture();
    const keys = ["month", "previous-week", "current-week", "yesterday", "today"] as const;
    keys.forEach((key, index) => {
      analysis.periodReadings[key].forEach((reading, stage) => {
        reading.value = (index + 1) * (stage + 1);
      });
    });
    const root = render({ analysis });
    expect(
      monthlyFigures(section(root, "report-periods-title")).map((funnel) =>
        value(funnel, "Agendamentos"),
      ),
    ).toEqual(["2", "4", "6", "8", "10"]);
    expect(value(card(section(root, "report-goals-title"), "Mês atual"), "Agendamentos")).toBe("2");
    expect(value(card(section(root, "report-history-title"), "Mês"), "Agendamentos")).toBe("2");
  });

  it("calcula metas mensais pelo cohort filtrado sem reutilizar metas ou equipe legados", () => {
    const dashboard = fixture();
    dashboard.goalsAvailable = false;
    const root = render({
      dashboard,
      analysis: analysisFixture(),
      team: { brokers: 999, managers: [] },
    });
    const monthly = section(root, "report-monthly-title");
    const goals = card(monthly, "Meta mês");
    expect(text(goals)).toContain("10 corretores no grupo");
    expect(value(goals, "Oportunidades")).toBe("1.430");
    expect(value(goals, "Agendamentos")).toBe("240");
    expect(value(goals, "Visitas")).toBe("120");
    expect(value(goals, "Pastas")).toBe("80");
    expect(value(goals, "Pastas aprovadas")).toBe("20");
    expect(value(goals, "Vendas")).toBe("10");
    expect(value(card(monthly, "Meta esperada até hoje"), "Agendamentos")).toBe("100");
    expect(value(card(monthly, "Meta esperada até hoje"), "Vendas")).toBe("4");
  });

  it("preserva o realizado no mesmo mes com coleta de outro dia", () => {
    const dashboard = fixture();
    const root = render({ dashboard, analysis: analysisFixture(), today: "2026-10-14" });
    expect(value(card(section(root, "report-goals-title"), "Mês atual"), "Oportunidades")).toBe(
      "10",
    );
    expect(text(root)).not.toContain("Parecer de ritmo");
  });

  it("oculta realizado e historico vencidos mantendo metas do mes vigente", () => {
    const root = render({ analysis: analysisFixture(), today: "2026-11-02" });
    expect(text(root)).toContain("Aguardando a coleta do mês vigente.");
    for (const id of ["report-periods-title", "report-history-title"]) {
      for (const funnel of monthlyFigures(section(root, id))) {
        expect(elements(funnel, "dd").map(text)).toEqual(Array(6).fill("Indisponível"));
      }
    }
    const goals = section(root, "report-goals-title");
    expect(value(card(goals, "Meta mês"), "Vendas")).toBe("10");
    expect(value(card(goals, "Meta esperada até hoje"), "Vendas")).toBe("0");
    expect(value(card(goals, "Mês atual"), "Vendas")).toBe("Indisponível");
  });

  it("normaliza a media anual por uma venda antes de arredondar a exibicao", () => {
    const analysis = analysisFixture();
    const dashboard = fixture();
    const totals = { opportunities: 101, appointments: 40, visits: 13, folders: 7, sales: 3 };
    for (const stage of Object.keys(totals) as DashboardStageKey[]) {
      dashboard.metrics.all![stage].yearClosedMonthsAverage = totals[stage] / 9;
    }
    const history = section(render({ dashboard, analysis }), "report-history-title");
    const annual = only(monthlyFigures(card(history, "Média do ano")));
    expect(elements(annual, "dd").map(text)).toEqual(["11", "4", "1", "0", "0", "0"]);
    const average = card(history, "Média venda");
    expect(elements(only(monthlyFigures(average)), "dd").map(text)).toEqual([
      "33",
      "13",
      "4",
      "2",
      "0",
      "1",
    ]);
    expect(value(average, "Conversão total Vendas / oportunidades")).toBe("3%");
  });

  it.each([0, null])("mantem media por venda indisponivel com denominador anual %s", (sales) => {
    const dashboard = fixture();
    dashboard.metrics.all!.sales.yearClosedMonthsAverage = sales;
    const root = render({ dashboard, analysis: analysisFixture() });
    const average = card(section(root, "report-history-title"), "Média venda");
    expect(elements(only(monthlyFigures(average)), "dd").map(text)).toEqual(
      Array(6).fill("Indisponível"),
    );
    expect(value(average, "Conversão total Vendas / oportunidades")).toBe("Indisponível");
    expect(elements(only(elements(average, "details")), "dd").map(text)).toEqual(
      Array(5).fill("Indisponível"),
    );
    expect(text(root)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("nao usa equipe legada como fallback para cohort desconhecido", () => {
    const root = render({ analysis: { ...analysisFixture(), brokerCount: null } });
    expect(value(card(section(root, "report-goals-title"), "Meta mês"), "Agendamentos")).toBe(
      "Indisponível",
    );
    expect(value(card(section(root, "report-monthly-title"), "Meta mês"), "Vendas")).toBe(
      "Indisponível",
    );
    expect(
      value(card(section(root, "report-goals-title"), "Meta esperada até hoje"), "Vendas"),
    ).toBe("Indisponível");
  });

  it("exibe somente meses certificados de analysis e preserva historico zero", () => {
    const analysis = analysisFixture();
    const dashboard = applyDashboardAnalysis(fixture(), analysis, "all");
    const root = render({ dashboard, analysis });
    const monthly = section(root, "report-monthly-title");
    const yearly = card(monthly, "Média do ano");
    expect(value(yearly, "Oportunidades")).toBe("0");
    expect(value(card(monthly, "Mês atual"), "Oportunidades")).toBe("10");
    const dialog = only(elements(yearly, "dialog"));
    expect(text(dialog)).not.toContain("Aguardando a coleta detalhada");
    expect(elements(dialog, "figure")).toHaveLength(6);
    expect(
      elements(only(elements(dialog, "ul")), "time").map((node) => attribute(node, "datetime")),
    ).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(elements(dialog, "time").some((node) => attribute(node, "datetime") === "2026-10")).toBe(
      false,
    );
  });

  it("renderiza os filtros reais com duas opcoes de canal e selecoes preservadas", () => {
    const analysis = analysisFixture();
    const filters = parseDashboardFilters({
      channel: DASHBOARD_CHANNELS[0],
      owner: "Corretor sintético 1",
    });
    const root = render({ analysis, filters });
    const fieldsets = elements(root, "div").filter((node) => attribute(node, "role") === "group");
    expect(fieldsets).toHaveLength(3);
    for (const fieldset of fieldsets) expect(attribute(fieldset, "hidden")).toBe("");
    const channelButtons = elements(root, "button").filter((button) =>
      ["House", "Imob"].includes(text(button)),
    );
    expect(channelButtons.map(text)).toEqual(["House", "Imob"]);
    expect(channelButtons.map((button) => attribute(button, "aria-pressed"))).toEqual([
      "false",
      "true",
    ]);
    expect(
      elements(root, "input").filter((input) => attribute(input, "checked") !== undefined),
    ).toHaveLength(1);
    expect(elements(root, "input").every((input) => attribute(input, "type") === "checkbox")).toBe(
      true,
    );
  });

  it("substitui a URL ao selecionar e remover filtros sem perder view ou parametros externos e nao exibe reset", () => {
    navigation.query = "view=all&period=week&owner=Corretor+sintético+1&extra=keep";
    const options = analysisFixture().options;
    function changeOwner(values: ReturnType<typeof emptyDashboardFilters>, owner: string) {
      const tree = DashboardFilters({
        values,
        options,
        available: true,
        authorizedViews: ["all", "with_canal_imob", "without_canal_imob"],
      });
      const labels = interactiveElements(tree, "label").filter((label) =>
        interactiveElements(label, "span").some((span) => span.props.children === owner),
      );
      expect(labels).toHaveLength(1);
      interactiveElements(labels[0], "input")[0]!.props.onChange!();
    }
    changeOwner(parseDashboardFilters({ owner: "Corretor sintético 1" }), "Corretor sintético 2");
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    let url = new URL(navigation.replace.mock.lastCall![0], "http://127.0.0.1");
    expect(url.searchParams.getAll("owner")).toEqual([
      "Corretor sintético 1",
      "Corretor sintético 2",
    ]);
    expect(url.searchParams.get("view")).toBe("all");
    expect(url.searchParams.get("extra")).toBe("keep");
    expect(url.searchParams.has("period")).toBe(false);
    expect(navigation.replace.mock.lastCall![1]).toEqual({ scroll: false });
    navigation.query = url.searchParams.toString();
    changeOwner(
      parseDashboardFilters({ owner: url.searchParams.getAll("owner") }),
      "Corretor sintético 1",
    );
    url = new URL(navigation.replace.mock.lastCall![0], "http://127.0.0.1");
    expect(url.searchParams.getAll("owner")).toEqual(["Corretor sintético 2"]);
    navigation.query = `${url.searchParams}&manager=Gerente+sintético&company=Empresa+sintética&channel=${encodeURIComponent(DASHBOARD_CHANNELS[0])}`;
    const values = parseDashboardFilters({
      owner: "Corretor sintético 2",
      manager: "Gerente sintético",
      company: "Empresa sintética",
      channel: DASHBOARD_CHANNELS[0],
    });
    const tree = DashboardFilters({
      values,
      options,
      available: true,
      authorizedViews: ["all", "with_canal_imob", "without_canal_imob"],
    });
    expect(interactiveElements(tree, "button")).toHaveLength(5);
    expect(
      interactiveElements(tree, "button").every((button) => button.props.type === "button"),
    ).toBe(true);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("troca House e Imob como seleção exclusiva e ajusta a visão autorizada", () => {
    navigation.query = `view=without_canal_imob&channel=${encodeURIComponent(DASHBOARD_CHANNELS[1])}`;
    const tree = DashboardFilters({
      values: parseDashboardFilters({ channel: DASHBOARD_CHANNELS[1] }),
      options: analysisFixture().options,
      available: true,
      authorizedViews: ["all", "with_canal_imob", "without_canal_imob"],
    });
    const imob = interactiveElements(tree, "button").find(
      (button) => button.props.children === "Imob",
    );
    expect(imob).toBeDefined();
    imob!.props.onClick!();
    const url = new URL(navigation.replace.mock.lastCall![0], "http://127.0.0.1");
    expect(url.searchParams.getAll("channel")).toEqual([DASHBOARD_CHANNELS[0]]);
    expect(url.searchParams.get("view")).toBe("with_canal_imob");
  });

  it("mantem metas indisponiveis quando goalsAvailable=false mesmo com numeros no snapshot", () => {
    const dashboard = fixture();
    dashboard.goalsAvailable = false;
    const root = render({ dashboard });
    expect(
      value(card(section(root, "report-goals-title"), "Meta esperada até hoje"), "Vendas"),
    ).toBe("Indisponível");
    expect(
      elements(card(section(root, "report-monthly-title"), "Meta mês"), "dd").every(
        (node) => text(node) === "Indispon\u00edvel",
      ),
    ).toBe(true);
  });

  it("distingue zero realizado, historico ausente, denominador zero e meta zero", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.opportunities.currentMonth = 0;
    dashboard.metrics.all!.appointments = metric({
      currentMonth: 0,
      previousMonth: null,
      goalMonth: 0,
    });
    dashboard.metrics.all!.visits.previousMonth = 0;
    const root = render({ dashboard, analysis: analysisFixture(0) });
    const current = card(section(root, "report-goals-title"), "Mês atual");
    expect(value(current, "Agendamentos")).toBe("0");
    expect(value(current, "Oportunidades para agendamentos")).toBe("Indisponível");
    const zeroGoals = card(section(root, "report-monthly-title"), "Meta mês");
    expect(value(zeroGoals, "Agendamentos")).toBe("0");
    expect(value(zeroGoals, "Vendas")).toBe("0");
    expect(value(zeroGoals, "Oportunidades")).toBe("0");
    const previous = card(section(root, "report-monthly-title"), "M\u00eas anterior");
    expect(value(previous, "Agendamentos")).toBe("Indispon\u00edvel");
    expect(value(previous, "Visitas")).toBe("0");
    expect(value(zeroGoals, "Conversão total Vendas / oportunidades")).toBe("Indisponível");
    expect(text(root)).not.toMatch(/NaN|Infinity/);
  });

  it("mostra conversao zero com base positiva sem transforma-la em ausencia", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.appointments.currentMonth = 0;
    const current = card(
      section(render({ dashboard, analysis: analysisFixture() }), "report-goals-title"),
      "Mês atual",
    );
    expect(value(current, "Oportunidades para agendamentos")).toBe("0%");
    expect(value(current, "Conversão total Vendas / oportunidades")).toBe("0%");
  });

  it("preserva conversao acima de 100% nos funis historicos", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.sales.previousMonth = 300;
    dashboard.metrics.all!.folders.previousMonth = 200;
    const analysis = analysisFixture(200);
    analysis.history.previous[0]!.readings.find(
      (reading) => reading.key === "approved-folders",
    )!.value = 200;
    const root = render({ dashboard, analysis });
    expect(
      value(
        card(section(root, "report-history-title"), "Mês anterior"),
        "Pastas aprovadas para vendas",
      ),
    ).toBe("150%");
  });

  it("nao usa outra visao como fallback quando o snapshot selecionado esta ausente", () => {
    const dashboard = fixture();
    delete dashboard.metrics.with_canal_imob;
    delete dashboard.salesValue.with_canal_imob;
    const root = render({
      dashboard,
      selectedView: "with_canal_imob",
      authorizedViews: ["with_canal_imob"],
    });
    expect(value(card(section(root, "report-goals-title"), "Mês atual"), "Agendamentos")).toBe(
      "Indisponível",
    );
    structuralContract(root);
  });

  it("remove navegacao de etapas e periodos preservando o recorte autorizado", () => {
    const root = render({
      selectedView: "with_canal_imob",
      selectedPeriod: "week",
      authorizedViews: ["with_canal_imob"] as const,
    });
    const links = elements(root, "a").map(
      (node) => new URL(attribute(node, "href")!, "http://127.0.0.1"),
    );
    const stageLinks = links.filter((url) => url.pathname.startsWith("/app/etapas/"));
    expect(stageLinks).toHaveLength(0);
    expect(links.filter((url) => url.pathname === "/app")).toHaveLength(0);
    expect(text(root)).not.toContain("Empreendimento sintetico Geral");
    expect(text(root)).not.toContain("Empreendimento sintetico Canal");
    expect(value(card(section(root, "report-goals-title"), "Mês atual"), "Agendamentos")).toBe(
      "Indisponível",
    );
  });

  it("remove links de etapas, controle de refresh e ranking sem permissao", () => {
    const root = render({ canViewStages: false, canViewRanking: false, canRefresh: false });
    expect(elements(root, "a").some((node) => attribute(node, "href")?.includes("/etapas/"))).toBe(
      false,
    );
    expect(elements(root, "button").map(text)).not.toContain("Atualizar Salesforce");
    expect(
      elements(root, "button").some((node) => attribute(node, "aria-label") === "Limpar filtros"),
    ).toBe(false);
    expect(text(root)).not.toMatch(
      /Empreendimento sintetico|Ranking validado|Oportunidades por empreendimento|Outros indicadores|Gerencia sintetica/,
    );
  });

  it("remove ranking e equipe mesmo autorizados, preservando refresh autorizado", () => {
    const root = render();
    expect(text(root)).not.toMatch(
      /Empreendimento sintetico|Gerencia sintetica|Ranking validado|Outros indicadores/,
    );
    expect(elements(root, "button").map(text)).toContain("Atualizar Salesforce");
  });
});

function stagesForTest(): DashboardStageKey[] {
  return ["opportunities", "appointments", "visits", "folders", "sales"];
}
