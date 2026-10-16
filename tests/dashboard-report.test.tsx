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
import { buildOperationalComparisons } from "@/lib/crm/dashboard/presentation";
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

function diagnosis(root: Node, title: string) {
  const heading = only(
    elements(section(root, "report-diagnosis-title"), "h3").filter((node) => text(node) === title),
  );
  return text(only(elements(heading.parentNode!, "strong")));
}

function structuralContract(root: Node) {
  expect(elements(root, "h1").map(text)).toEqual(["Relat\u00f3rio completo da equipe."]);
  expect(elements(root, "h2").map(text)).toEqual(
    expect.arrayContaining([
      "Convers\u00e3o por etapa",
      "Comparativo mensal",
      "Efici\u00eancia do funil",
      "Realizado Funil",
      "Corretores por gerente",
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
  expect(blocks).toHaveLength(6);
  expect(
    elements(monthly, "h3")
      .filter((node) => !insideDialog(node))
      .map(text),
  ).toEqual([
    "M\u00e9dia do ano",
    "M\u00e9dia dos \u00faltimos 3 meses",
    "M\u00eas anterior",
    "Meta mês",
    "Meta esperada at\u00e9 hoje",
    "M\u00eas atual",
    "Ritmo de vendas",
  ]);
  for (const block of blocks) {
    const funnel = only(monthlyFigures(block));
    expect(attribute(funnel, "aria-label")).toBe(
      `Funil mensal: ${text(only(elements(block, "h3").filter((node) => !insideDialog(node))))}`,
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
  const tables = elements(section(root, "report-operational-title"), "table");
  expect(tables).toHaveLength(4);
  expect(tables.map((table) => text(only(elements(table, "caption"))).split(":")[0])).toEqual([
    "Agendamentos",
    "Visitas",
    "Pastas",
    "Vendas",
  ]);
  for (const table of tables) {
    expect(elements(only(elements(table, "thead")), "th").map(text)).toEqual([
      "Indicador",
      "Mês",
      "Últimos 14 dias",
      "Últimos 7 dias",
      "Esta Semana",
      "Hoje",
    ]);
    const rows = elements(only(elements(table, "tbody")), "tr");
    expect(rows).toHaveLength(1);
    expect(rows.map((row) => text(only(elements(row, "th"))))).toEqual(["Realizado"]);
    for (const row of rows) {
      expect(elements(row, "th")).toHaveLength(1);
      expect(elements(row, "td")).toHaveLength(5);
    }
  }
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
    const monthly = section(render(), "report-monthly-title");
    expect(elements(monthly, "figure")).toHaveLength(6);
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
    dashboard.metrics.all!.sales.currentMonth = 9876543.2;
    const current = card(section(render({ dashboard }), "report-monthly-title"), "Mês atual");
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
    for (const row of elements(section(root, "report-operational-title"), "tbody").flatMap((body) =>
      elements(body, "tr"),
    )) {
      expect(elements(row, "td").map(text)).toEqual(Array(5).fill("Indispon\u00edvel"));
    }
    expect(diagnosis(root, "VGV do per\u00edodo")).toBe("Indispon\u00edvel");
    expect(text(section(root, "report-team-title"))).toContain("Equipe sintetica indisponivel.");
  });

  it.each([
    ["month", "1.000", "50%", "370,4%", "R$ 42.000.000", "0"],
    ["week", "70", "35%", "25,9%", "R$ 2.940.000", "3"],
    ["today", "5", "25%", "1,9%", "R$ 0", "10"],
  ] as const)(
    "usa %s no pulso, VGV e gap; conversao difere do atingimento",
    (period, quantity, conversion, progress, vgv, gap) => {
      const root = render({ selectedPeriod: period, analysis: analysisFixture() });
      const appointments = pulseCard(root, "Agendamentos");
      expect(value(appointments, "Quantidade")).toBe(quantity);
      expect(text(only(elements(appointments, "strong")))).toBe(conversion);
      expect(text(only(elements(appointments, "figcaption")))).toBe("Da etapa anterior");
      expect(attribute(only(elements(appointments, "figure")), "aria-label")).toBe(
        `Oportunidades para agendamentos: ${conversion}`,
      );
      expect(value(appointments, "% realizado da meta")).toBe(progress);
      expect(diagnosis(root, "VGV do per\u00edodo")).toBe(vgv);
      expect(diagnosis(root, "Falta para a meta de vendas")).toBe(gap);
      expect(
        value(card(section(root, "report-monthly-title"), "M\u00eas atual"), "Agendamentos"),
      ).toBe("1.000");
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
      ["M\u00eas atual", "1.000"],
    ])
      expect(value(card(monthly, label!), "Agendamentos")).toBe(expected);
    const expected = card(monthly, "Meta esperada at\u00e9 hoje");
    expect(elements(expected, "dd").every((node) => text(node) === "Indispon\u00edvel")).toBe(true);
    expect(value(monthly, "Esperado at\u00e9 hoje")).toBe("Indispon\u00edvel");
    expect(value(monthly, "Parecer de ritmo")).toBe("Indispon\u00edvel");
    expect(diagnosis(root, "Plano de a\u00e7\u00e3o")).toBe("Indispon\u00edvel");
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

  it("mantem as cinco janelas operacionais sem inventar metas de 7 ou 14 dias", () => {
    const tables = elements(section(render(), "report-operational-title"), "table");
    const rows = elements(only(elements(tables[0]!, "tbody")), "tr");
    expect(rows.map((row) => elements(row, "td").map(text))).toEqual([
      ["1.000", "210", "70", "70", "5"],
    ]);
    const comparisons = buildOperationalComparisons(fixture().metrics.all!.appointments, true);
    expect(
      comparisons.map(({ previous, current, variation, goal, goalProgress }) => [
        previous,
        current,
        variation,
        goal,
        goalProgress,
      ]),
    ).toEqual([
      [800, 1000, 0.25, 1600, 0.625],
      [140, 210, 0.5, null, null],
      [56, 70, 0.25, null, null],
      [42, 70, 2 / 3, 400, 0.175],
      [10, 5, -0.5, 80, 0.0625],
    ]);
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

  it("nao usa equipe legada como fallback para cohort desconhecido", () => {
    const root = render({ analysis: { ...analysisFixture(), brokerCount: null } });
    expect(value(pulseCard(root, "Agendamentos"), "Meta")).toBe(pulseUnavailable.goal);
    expect(value(card(section(root, "report-monthly-title"), "Meta mês"), "Vendas")).toBe(
      "Indisponível",
    );
    expect(diagnosis(root, "Falta para a meta de vendas")).toBe("Indisponível");
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
    expect(diagnosis(root, "Falta para a meta de vendas")).toBe("Indispon\u00edvel");
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
    expect(diagnosis(root, "Convers\u00e3o total")).toBe("Indispon\u00edvel");
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

  it("preserva atingimento acima de 100% e limita o gap a zero", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.sales.currentMonth = 300;
    const root = render({ dashboard, analysis: analysisFixture(200) });
    expect(value(pulseCard(root, "Vendas"), "% realizado da meta")).toBe("150%");
    expect(diagnosis(root, "Falta para a meta de vendas")).toBe("0");
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
    expect(diagnosis(root, "VGV do per\u00edodo")).toBe("Indispon\u00edvel");
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
    expect(text(root)).toContain("Empreendimento sintetico Canal");
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

  it("mantem ranking autorizado dentro de details fechado", () => {
    const root = render();
    const details = only(
      elements(root, "details").filter((node) =>
        text(node).includes("Empreendimento sintetico Geral"),
      ),
    );
    expect(attribute(details, "open")).toBeUndefined();
    expect(text(only(elements(details, "summary")))).toBe("Outros indicadores");
    expect(text(details)).toContain("Ranking validado");
    expect(text(details)).toContain("Oportunidades por empreendimento");
    expect(elements(root, "button").map(text)).toContain("Atualizar Salesforce");
  });

  it("mantem equipe por gerente, zero real e ausencia distintos sem divulgar outra visao", () => {
    const team = section(render(), "report-team-title");
    expect(value(card(team, "Gerencia sintetica Alfa"), "Corretores")).toBe("7");
    expect(value(card(team, "Gerencia sintetica Alfa"), "Participa\u00e7\u00e3o na equipe")).toBe(
      "58,3%",
    );
    const empty = section(render({ team: { brokers: 0, managers: [] } }), "report-team-title");
    expect(value(empty, "Corretores")).toBe("0");
    const missing = section(
      render({ team: null, teamUnavailableReason: "Equipe sintetica indisponivel." }),
      "report-team-title",
    );
    expect(text(missing)).toContain("Equipe sintetica indisponivel.");
    expect(elements(missing, "dd")).toHaveLength(0);
    const restricted = section(render({ selectedView: "with_canal_imob" }), "report-team-title");
    expect(text(restricted)).not.toContain("Gerencia sintetica");
  });
});
