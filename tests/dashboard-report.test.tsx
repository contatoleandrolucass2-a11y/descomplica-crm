import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DashboardMetric, DashboardReadModel } from "@/lib/crm/dashboard/data";
import type { DashboardPeriodKey, DashboardStageKey } from "@/lib/crm/dashboard/catalog";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    const anchor = { ...props };
    delete anchor.prefetch;
    return createElement("a", { ...anchor, href }, children);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DashboardReport } from "@/app/(protected)/app/_components/DashboardReport";

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
      "Realizado e meta lado a lado",
      "Efici\u00eancia do funil",
      "Realizado Funil",
      "Corretores por gerente",
    ]),
  );
  const pulse = section(root, "report-pulse-title");
  expect(elements(pulse, "article")).toHaveLength(5);
  expect(elements(pulse, "figure")).toHaveLength(5);
  expect(elements(pulse, "h3").map(text)).toEqual([
    "Oportunidades",
    "Agendamentos",
    "Visitas",
    "Pastas",
    "Vendas",
  ]);
  const monthly = section(root, "report-monthly-title");
  expect(elements(monthly, "article")).toHaveLength(6);
  expect(elements(monthly, "h3").map(text)).toEqual([
    "M\u00e9dia do ano",
    "M\u00e9dia dos \u00faltimos 3 meses",
    "M\u00eas anterior",
    "Meta atual",
    "Meta esperada at\u00e9 hoje",
    "M\u00eas atual",
    "Ritmo de vendas",
  ]);
  for (const block of elements(monthly, "article")) {
    const funnel = only(elements(block, "figure"));
    expect(attribute(funnel, "aria-label")).toBe(
      `Funil mensal: ${text(only(elements(block, "h3")))}`,
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
      "Intervalo",
      "Anterior",
      "Realizado",
      "Varia\u00e7\u00e3o",
      "Meta",
      "% realizado da meta",
    ]);
    const rows = elements(only(elements(table, "tbody")), "tr");
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => text(only(elements(row, "strong"))))).toEqual([
      "M\u00eas",
      "\u00daltimos 14 dias",
      "\u00daltimos 7 dias",
      "Semana",
      "Dia",
    ]);
    for (const row of rows) {
      expect(elements(row, "th")).toHaveLength(1);
      expect(elements(row, "td")).toHaveLength(5);
    }
  }
  expect(text(root)).not.toMatch(/NaN|Infinity|undefined/);
}

describe("DashboardReport: regressao com dados sinteticos", () => {
  it("preserva os blocos completos com snapshot disponivel", () => structuralContract(render()));

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
    for (const id of ["report-pulse-title", "report-monthly-title"]) {
      expect(
        elements(section(root, id), "dd").every((node) => text(node) === "Indispon\u00edvel"),
      ).toBe(true);
    }
    for (const row of elements(section(root, "report-operational-title"), "tbody").flatMap((body) =>
      elements(body, "tr"),
    )) {
      expect(elements(row, "td").map(text)).toEqual(Array(5).fill("Indispon\u00edvel"));
    }
    expect(diagnosis(root, "VGV do per\u00edodo")).toBe("Indispon\u00edvel");
    expect(text(section(root, "report-team-title"))).toContain("Equipe sintetica indisponivel.");
  });

  it.each([
    ["month", "1.000", "50%", "62,5%", "R$ 42.000.000", "100"],
    ["week", "70", "35%", "17,5%", "R$ 2.940.000", "43"],
    ["today", "5", "25%", "6,3%", "R$ 0", "10"],
  ] as const)(
    "usa %s no pulso, VGV e gap; conversao difere do atingimento",
    (period, quantity, conversion, progress, vgv, gap) => {
      const root = render({ selectedPeriod: period });
      const appointments = card(section(root, "report-pulse-title"), "Agendamentos");
      expect(value(appointments, "Quantidade")).toBe(quantity);
      expect(text(only(elements(appointments, "figcaption")))).toBe(conversion);
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

  it("usa os campos mensais reais sem derivar uma meta esperada", () => {
    const root = render();
    const monthly = section(root, "report-monthly-title");
    for (const [label, expected] of [
      ["M\u00e9dia do ano", "600"],
      ["M\u00e9dia dos \u00faltimos 3 meses", "700"],
      ["M\u00eas anterior", "800"],
      ["Meta atual", "1.600"],
      ["M\u00eas atual", "1.000"],
    ])
      expect(value(card(monthly, label!), "Agendamentos")).toBe(expected);
    const expected = card(monthly, "Meta esperada at\u00e9 hoje");
    expect(elements(expected, "dd").every((node) => text(node) === "Indispon\u00edvel")).toBe(true);
    expect(value(monthly, "Esperado at\u00e9 hoje")).toBe("Indispon\u00edvel");
    expect(value(monthly, "Parecer de ritmo")).toBe("Indispon\u00edvel");
    expect(diagnosis(root, "Plano de a\u00e7\u00e3o")).toBe("Indispon\u00edvel");
    for (const label of [
      "Canal de vendas",
      "Gerente de Vendas",
      "Respons\u00e1vel da conta",
      "Empresa",
    ]) {
      expect(value(root, label)).toBe("Indispon\u00edvel");
    }
  });

  it("mantem as cinco janelas operacionais sem inventar metas de 7 ou 14 dias", () => {
    const tables = elements(section(render(), "report-operational-title"), "table");
    const rows = elements(only(elements(tables[0]!, "tbody")), "tr");
    expect(rows.map((row) => elements(row, "td").map(text))).toEqual([
      ["800", "1.000", "+25%", "1.600", "62,5%"],
      ["140", "210", "+50%", "Indispon\u00edvel", "Indispon\u00edvel"],
      ["56", "70", "+25%", "Indispon\u00edvel", "Indispon\u00edvel"],
      ["42", "70", "+66,7%", "400", "17,5%"],
      ["10", "5", "-50%", "80", "6,3%"],
    ]);
  });

  it("mantem metas indisponiveis quando goalsAvailable=false mesmo com numeros no snapshot", () => {
    const dashboard = fixture();
    dashboard.goalsAvailable = false;
    const root = render({ dashboard });
    for (const block of elements(section(root, "report-pulse-title"), "article")) {
      expect(value(block, "Meta")).toBe("Indispon\u00edvel");
      expect(value(block, "% realizado da meta")).toBe("Indispon\u00edvel");
      expect(text(block)).toContain("Meta indispon\u00edvel");
    }
    expect(
      elements(card(section(root, "report-monthly-title"), "Meta atual"), "dd").every(
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
    const root = render({ dashboard });
    const appointments = card(section(root, "report-pulse-title"), "Agendamentos");
    expect(value(appointments, "Quantidade")).toBe("0");
    expect(value(appointments, "Meta")).toBe("Indispon\u00edvel");
    expect(value(appointments, "% realizado da meta")).toBe("Indispon\u00edvel");
    expect(text(only(elements(appointments, "figcaption")))).toBe("N/D");
    const previous = card(section(root, "report-monthly-title"), "M\u00eas anterior");
    expect(value(previous, "Agendamentos")).toBe("Indispon\u00edvel");
    expect(value(previous, "Visitas")).toBe("0");
    expect(diagnosis(root, "Convers\u00e3o total")).toBe("Indispon\u00edvel");
    expect(text(root)).not.toMatch(/NaN|Infinity/);
  });

  it("mostra conversao zero com base positiva sem transforma-la em ausencia", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.appointments.currentMonth = 0;
    const appointments = card(section(render({ dashboard }), "report-pulse-title"), "Agendamentos");
    expect(text(only(elements(appointments, "figcaption")))).toBe("0%");
    expect(value(appointments, "% realizado da meta")).toBe("0%");
  });

  it("preserva atingimento acima de 100% e limita o gap a zero", () => {
    const dashboard = fixture();
    dashboard.metrics.all!.sales.currentMonth = 300;
    const root = render({ dashboard });
    expect(value(card(section(root, "report-pulse-title"), "Vendas"), "% realizado da meta")).toBe(
      "150%",
    );
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
    expect(value(card(section(root, "report-pulse-title"), "Agendamentos"), "Quantidade")).toBe(
      "Indispon\u00edvel",
    );
    expect(diagnosis(root, "VGV do per\u00edodo")).toBe("Indispon\u00edvel");
    structuralContract(root);
  });

  it("preserva view e period nas etapas e limita links as visoes autorizadas", () => {
    const root = render({
      selectedView: "with_canal_imob",
      selectedPeriod: "week",
      authorizedViews: ["with_canal_imob"] as const,
    });
    const links = elements(root, "a").map(
      (node) => new URL(attribute(node, "href")!, "http://127.0.0.1"),
    );
    const stageLinks = links.filter((url) => url.pathname.startsWith("/app/etapas/"));
    expect(stageLinks).toHaveLength(5);
    expect(new Set(stageLinks.map((url) => url.searchParams.get("period")))).toEqual(
      new Set(["week"]),
    );
    expect(new Set(links.map((url) => url.searchParams.get("view")))).toEqual(
      new Set(["with_canal_imob"]),
    );
    expect(
      new Set(
        links.filter((url) => url.pathname === "/app").map((url) => url.searchParams.get("period")),
      ),
    ).toEqual(new Set<DashboardPeriodKey>(["month", "week", "today"]));
    expect(text(root)).not.toContain("Empreendimento sintetico Geral");
    expect(text(root)).toContain("Empreendimento sintetico Canal");
  });

  it("remove links de etapas, controle de refresh e ranking sem permissao", () => {
    const root = render({ canViewStages: false, canViewRanking: false, canRefresh: false });
    expect(elements(root, "a").some((node) => attribute(node, "href")?.includes("/etapas/"))).toBe(
      false,
    );
    expect(elements(root, "button")).toHaveLength(0);
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
