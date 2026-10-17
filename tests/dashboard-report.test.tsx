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

const pulseUnavailable = {
  quantity: "N/DQuantidade indisponível para este intervalo.",
  goal: "N/DMeta indisponível para o período.",
  progress: "N/DSem base suficiente para calcular o realizado da meta.",
};

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

function pulseCard(root: Node, title: string) {
  return only(
    elements(section(root, "report-pulse-title"), "li").filter((node) =>
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
  expect(elements(root, "h1").map(text)).toEqual(["Relat\u00f3rio completo da equipe."]);
  expect(elements(root, "h2").map(text)).toEqual(
    expect.arrayContaining([
      "Convers\u00e3o por etapa",
      "Funis comerciais",
      "Metas",
      "Períodos do mês",
      "Histórico e média por venda",
    ]),
  );
  const pulse = section(root, "report-pulse-title");
  expect(elements(pulse, "article")).toHaveLength(0);
  expect(elements(pulse, "li")).toHaveLength(5);
  expect(elements(pulse, "figure")).toHaveLength(5);
  expect(elements(pulse, "h3").map(text)).toEqual([
    "Oportunidades",
    "Agendamentos",
    "Visitas",
    "Pastas",
    "Vendas",
  ]);
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
    "Ritmo de vendas",
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
    expect(value(funnel, "Pastas aprovadas")).toBe("Indisponível");
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
  it("preserva os blocos completos com snapshot disponivel", () => structuralContract(render()));

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
      reading.value = fixture().metrics.all![reading.key].currentMonth;
    });
    const monthly = section(render({ analysis }), "report-monthly-title");
    expect(monthlyFigures(monthly)).toHaveLength(13);
    const current = only(elements(card(monthly, "Mês atual"), "figure"));
    expect(elements(current, "dd").map(text)).toEqual([
      "2.000",
      "1.000",
      "500",
      "250",
      "Indisponível",
      "100",
    ]);
    const missing = only(elements(current, "span"));
    expect(attribute(missing, "title")).toContain("série mensal separada");
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
    expect(text(only(elements(sales, "dd")))).toBe("9.876.543,2");
    expect(attribute(only(elements(sales, "dd")), "data-long")).toBe("true");
  });

  it("preserva a estrutura inteira sem snapshot e nunca apresenta ausencia como zero", () => {
    const root = render({
      dashboard: null,
      team: null,
      teamUnavailableReason: "Equipe sintetica indisponivel.",
    });
    structuralContract(root);
    for (const block of elements(section(root, "report-pulse-title"), "li")) {
      expect(elements(block, "dd").map(text)).toEqual([
        pulseUnavailable.quantity,
        pulseUnavailable.goal,
        pulseUnavailable.progress,
      ]);
    }
    expect(
      elements(section(root, "report-monthly-title"), "dd").every(
        (node) => text(node) === "Indispon\u00edvel",
      ),
    ).toBe(true);
  });

  it.each([
    ["month", "1.000", "50%", "370,4%"],
    ["week", "70", "35%", "25,9%"],
    ["today", "5", "25%", "1,9%"],
  ] as const)(
    "usa %s no pulso; conversao difere do atingimento e nao muda o funil mensal",
    (period, quantity, conversion, progress) => {
      const root = render({ selectedPeriod: period, analysis: analysisFixture() });
      const appointments = pulseCard(root, "Agendamentos");
      expect(value(appointments, "Quantidade")).toBe(quantity);
      expect(text(only(elements(appointments, "strong")))).toBe(conversion);
      expect(text(only(elements(appointments, "figcaption")))).toBe("Da etapa anterior");
      expect(attribute(only(elements(appointments, "figure")), "aria-label")).toBe(
        `Oportunidades para agendamentos: ${conversion}`,
      );
      expect(value(appointments, "% realizado da meta")).toBe(progress);
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
    expect(value(monthly, "Esperado at\u00e9 hoje")).toBe("Indispon\u00edvel");
    expect(value(monthly, "Parecer de ritmo")).toBe("Indispon\u00edvel");
    expect(elements(root, "fieldset").map((node) => attribute(node, "aria-label"))).toEqual([
      "Canal de vendas",
      "Gerente de Vendas",
      "Responsável da conta",
      "Empresa",
    ]);
    for (const fieldset of elements(root, "fieldset"))
      expect(attribute(fieldset, "disabled")).toBe("");
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
    expect(value(goals, "Oportunidades")).toBe("Indisponível");
    expect(value(goals, "Agendamentos")).toBe("270");
    expect(value(goals, "Visitas")).toBe("80");
    expect(value(goals, "Pastas")).toBe("40");
    expect(value(goals, "Pastas aprovadas")).toBe("Indisponível");
    expect(value(goals, "Vendas")).toBe("10");
    expect(value(card(monthly, "Meta esperada até hoje"), "Agendamentos")).toBe("113,2");
    expect(value(monthly, "Esperado até hoje")).toBe("4,2");
    expect(value(monthly, "Parecer de ritmo")).toBe("Dentro do esperado");
    expect(value(pulseCard(root, "Agendamentos"), "Meta")).toBe("270");
  });

  it("nao emite parecer de hoje com coleta de outro dia", () => {
    const dashboard = fixture();
    const root = render({ dashboard, analysis: analysisFixture(), today: "2026-10-14" });
    expect(value(section(root, "report-monthly-title"), "Parecer de ritmo")).toBe("Indisponível");
  });

  it("oculta realizado e historico vencidos mantendo metas do mes vigente", () => {
    const root = render({ analysis: analysisFixture(), today: "2026-11-02" });
    expect(text(root)).toContain("Aguardando a coleta do mês vigente.");
    expect(value(pulseCard(root, "Agendamentos"), "Quantidade")).toBe(pulseUnavailable.quantity);
    for (const id of ["report-periods-title", "report-history-title"]) {
      for (const funnel of monthlyFigures(section(root, id))) {
        expect(elements(funnel, "dd").map(text)).toEqual(Array(6).fill("Indisponível"));
      }
    }
    const goals = section(root, "report-goals-title");
    expect(value(card(goals, "Meta mês"), "Vendas")).toBe("10");
    expect(value(card(goals, "Meta esperada até hoje"), "Vendas")).toBe("0,7");
    expect(value(card(goals, "Mês atual"), "Vendas")).toBe("Indisponível");
    expect(value(section(root, "report-monthly-title"), "Parecer de ritmo")).toBe("Indisponível");
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
    expect(elements(annual, "dd").map(text)).toEqual([
      "11,2",
      "4,4",
      "1,4",
      "0,8",
      "Indisponível",
      "0,3",
    ]);
    const average = card(history, "Média venda");
    expect(elements(only(monthlyFigures(average)), "dd").map(text)).toEqual([
      "33,7",
      "13,3",
      "4,3",
      "2,3",
      "Indisponível",
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
      Array(4).fill("Indisponível"),
    );
    expect(text(root)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("nao usa equipe legada como fallback para cohort desconhecido", () => {
    const root = render({ analysis: { ...analysisFixture(), brokerCount: null } });
    expect(value(pulseCard(root, "Agendamentos"), "Meta")).toBe(pulseUnavailable.goal);
    expect(value(card(section(root, "report-monthly-title"), "Meta mês"), "Vendas")).toBe(
      "Indisponível",
    );
    expect(value(section(root, "report-monthly-title"), "Esperado até hoje")).toBe("Indisponível");
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
    expect(elements(dialog, "figure")).toHaveLength(5);
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
    const fieldsets = elements(root, "fieldset");
    expect(fieldsets).toHaveLength(4);
    for (const fieldset of fieldsets) expect(attribute(fieldset, "disabled")).toBeUndefined();
    const channels = only(
      fieldsets.filter((fieldset) => attribute(fieldset, "aria-label") === "Canal de vendas"),
    );
    expect(elements(channels, "label")).toHaveLength(2);
    expect(new Set(elements(channels, "label").map(text))).toEqual(new Set(DASHBOARD_CHANNELS));
    expect(
      elements(root, "input").filter((input) => attribute(input, "checked") !== undefined),
    ).toHaveLength(2);
    expect(elements(root, "input").every((input) => attribute(input, "type") === "checkbox")).toBe(
      true,
    );
  });

  it("substitui a URL ao selecionar, remover e limpar filtros sem perder view ou parametros externos", () => {
    navigation.query = "view=all&period=week&owner=Corretor+sintético+1&extra=keep";
    const options = analysisFixture().options;
    function changeOwner(values: ReturnType<typeof emptyDashboardFilters>, owner: string) {
      const tree = DashboardFilters({ values, options, available: true });
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
    const tree = DashboardFilters({ values, options, available: true });
    interactiveElements(tree, "button")[0]!.props.onClick!();
    url = new URL(navigation.replace.mock.lastCall![0], "http://127.0.0.1");
    expect([...url.searchParams.entries()]).toEqual([
      ["view", "all"],
      ["extra", "keep"],
    ]);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("mantem metas indisponiveis quando goalsAvailable=false mesmo com numeros no snapshot", () => {
    const dashboard = fixture();
    dashboard.goalsAvailable = false;
    const root = render({ dashboard });
    for (const block of elements(section(root, "report-pulse-title"), "li")) {
      expect(value(block, "Meta")).toBe(pulseUnavailable.goal);
      expect(value(block, "% realizado da meta")).toBe(pulseUnavailable.progress);
      expect(text(block)).toContain("Meta indispon\u00edvel");
    }
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
    const appointments = pulseCard(root, "Agendamentos");
    expect(value(appointments, "Quantidade")).toBe("0");
    expect(value(appointments, "Meta")).toBe("0");
    expect(value(appointments, "% realizado da meta")).toBe(pulseUnavailable.progress);
    const zeroGoals = card(section(root, "report-monthly-title"), "Meta mês");
    expect(value(zeroGoals, "Agendamentos")).toBe("0");
    expect(value(zeroGoals, "Vendas")).toBe("0");
    expect(value(zeroGoals, "Oportunidades")).toBe("Indisponível");
    expect(text(only(elements(appointments, "strong")))).toBe("N/D");
    expect(attribute(only(elements(appointments, "figure")), "aria-label")).toBe(
      "Oportunidades para agendamentos: Sem base suficiente para calcular a relação.",
    );
    const previous = card(section(root, "report-monthly-title"), "M\u00eas anterior");
    expect(value(previous, "Agendamentos")).toBe("Indispon\u00edvel");
    expect(value(previous, "Visitas")).toBe("0");
    expect(value(zeroGoals, "Conversão total Vendas / oportunidades")).toBe("Indisponível");
    expect(text(root)).not.toMatch(/NaN|Infinity/);
  });

  it("mostra conversao zero com base positiva sem transforma-la em ausencia", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.appointments.currentMonth = 0;
    const appointments = pulseCard(
      render({ dashboard, analysis: analysisFixture() }),
      "Agendamentos",
    );
    expect(text(only(elements(appointments, "strong")))).toBe("0%");
    expect(attribute(only(elements(appointments, "figure")), "aria-label")).toBe(
      "Oportunidades para agendamentos: 0%",
    );
    expect(value(appointments, "% realizado da meta")).toBe("0%");
  });

  it("preserva atingimento acima de 100% e parecer de ritmo", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.sales.currentMonth = 300;
    const root = render({ dashboard, analysis: analysisFixture(200) });
    expect(value(pulseCard(root, "Vendas"), "% realizado da meta")).toBe("150%");
    expect(value(section(root, "report-monthly-title"), "Parecer de ritmo")).toBe(
      "Dentro do esperado",
    );
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
    expect(value(pulseCard(root, "Agendamentos"), "Quantidade")).toBe(pulseUnavailable.quantity);
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
    expect(value(pulseCard(root, "Agendamentos"), "Quantidade")).toBe("70");
  });

  it("remove links de etapas, controle de refresh e ranking sem permissao", () => {
    const root = render({ canViewStages: false, canViewRanking: false, canRefresh: false });
    expect(elements(root, "a").some((node) => attribute(node, "href")?.includes("/etapas/"))).toBe(
      false,
    );
    expect(elements(root, "button").map(text)).not.toContain("Atualizar Salesforce");
    expect(
      elements(root, "button").some((node) => attribute(node, "aria-label") === "Limpar filtros"),
    ).toBe(true);
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
