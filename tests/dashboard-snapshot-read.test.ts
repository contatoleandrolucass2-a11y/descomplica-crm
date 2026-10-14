import { beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_STAGES, type DashboardViewKey } from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

type Table =
  | "crm_dashboard_snapshots"
  | "crm_dashboard_views"
  | "crm_dashboard_metrics"
  | "crm_dashboard_top_developments";
type ChildTable = Exclude<Table, "crm_dashboard_snapshots">;
interface Response {
  data: unknown;
  error: unknown;
}

const baseHeader = {
  id: 10,
  snapshot_key: "global",
  reference_date: "2026-10-14",
  generated_at: "2026-10-14T15:00:00.123456Z",
  updated_at: "2026-10-14T15:01:00.000001Z",
  timezone: "America/Sao_Paulo",
  source: "synthetic-salesforce-fixture",
  goals_available: false,
};
const nextHeader = {
  ...baseHeader,
  generated_at: "2026-10-14T15:30:00.123456Z",
  updated_at: "2026-10-14T15:31:00.000001Z",
};

function query(table: Table, response: Response | Error) {
  const resolve = async () => {
    resolvedTables.push(table);
    if (response instanceof Error) throw response;
    return response;
  };
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(resolve),
    then: (fulfilled: (value: Response) => unknown, rejected: (reason: unknown) => unknown) =>
      resolve().then(fulfilled, rejected),
  };
}

let responses: Record<Table, Array<Response | Error>>;
let queries: Array<{ table: Table; builder: ReturnType<typeof query> }>;
let resolvedTables: Table[];

function headers(...values: unknown[]) {
  responses.crm_dashboard_snapshots = values.map((data) => ({ data, error: null }));
}

function children(counts = [1], views: readonly DashboardViewKey[] = ["all"]) {
  responses.crm_dashboard_views = counts.map((count) => ({
    data: views.map((view_key) => ({
      view_key,
      sales_value_month: count * 100,
      sales_value_week: count * 100,
      sales_value_today: count * 100,
    })),
    error: null,
  }));
  responses.crm_dashboard_metrics = counts.map((count) => ({
    data: views.flatMap((view_key) =>
      Object.keys(DASHBOARD_STAGES).map((stage_key) => ({
        view_key,
        stage_key,
        current_month: count,
        current_week: count,
        current_today: count,
        goal_month: 0,
        goal_week: 0,
        goal_today: 0,
        previous_month: null,
        year_closed_months_average: null,
        last_three_closed_months_average: null,
        previous_fourteen_days: null,
        last_fourteen_days: null,
        previous_seven_days: null,
        last_seven_days: null,
        previous_week: null,
        yesterday: 0,
      })),
    ),
    error: null,
  }));
  responses.crm_dashboard_top_developments = counts.map((count) => ({
    data: views.map((view_key) => ({ view_key, rank: 1, name: "Synthetic", total: count })),
    error: null,
  }));
}

function queriesFor(table: Table) {
  return queries.filter((entry) => entry.table === table).map((entry) => entry.builder);
}

beforeEach(() => {
  vi.resetAllMocks();
  queries = [];
  resolvedTables = [];
  responses = {
    crm_dashboard_snapshots: [],
    crm_dashboard_views: [],
    crm_dashboard_metrics: [],
    crm_dashboard_top_developments: [],
  };
  headers(baseHeader, baseHeader);
  children();
  mocks.from.mockImplementation((table: Table) => {
    const response = responses[table].shift();
    if (!response) throw new Error(`Unexpected query: ${table}`);
    const builder = query(table, response);
    queries.push({ table, builder });
    return builder;
  });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
});

describe("loadDashboardReadModel snapshot consistency", () => {
  it.each([0, 1])(
    "retorna lote estavel com contagem %s, preservando ausencia e zero",
    async (count) => {
      children([count]);
      const result = await loadDashboardReadModel(["all"]);
      expect(result).toMatchObject({
        status: "ready",
        dashboard: {
          id: baseHeader.id,
          generatedAt: baseHeader.generated_at,
          updatedAt: baseHeader.updated_at,
          goalsAvailable: false,
          salesValue: { all: { month: count * 100, week: count * 100, today: count * 100 } },
          metrics: { all: { sales: { currentToday: count, previousMonth: null, yesterday: 0 } } },
          topDevelopments: { all: [] },
        },
      });
      expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith();
      expect(resolvedTables).toEqual([
        "crm_dashboard_snapshots",
        "crm_dashboard_views",
        "crm_dashboard_metrics",
        "crm_dashboard_snapshots",
      ]);
      expect(mocks.from).not.toHaveBeenCalledWith("crm_dashboard_top_developments");
      for (const builder of queriesFor("crm_dashboard_snapshots")) {
        expect(builder.select).toHaveBeenCalledExactlyOnceWith(
          "id,snapshot_key,reference_date,generated_at,updated_at,timezone,source,goals_available",
        );
        expect(builder.eq).toHaveBeenCalledExactlyOnceWith("snapshot_key", "global");
      }
    },
  );

  it("recusa lista de visoes vazia antes de criar cliente", async () => {
    await expect(loadDashboardReadModel([])).rejects.toThrow("autorizada");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("retorna empty somente para cabecalho ausente no inicio da tentativa", async () => {
    headers(null);
    await expect(loadDashboardReadModel(["all"])).resolves.toEqual({ status: "empty" });
    expect(queries).toHaveLength(1);
  });

  it("descarta lote misto e recarrega todos os filhos uma unica vez", async () => {
    headers(baseHeader, nextHeader, nextHeader, nextHeader);
    children([1, 2]);
    responses.crm_dashboard_metrics[0] = responses.crm_dashboard_metrics[1]!;
    const result = await loadDashboardReadModel(["all"], { includeTopDevelopments: true });
    expect(result).toMatchObject({
      status: "ready",
      dashboard: {
        generatedAt: nextHeader.generated_at,
        updatedAt: nextHeader.updated_at,
        salesValue: { all: { today: 200 } },
        metrics: { all: { sales: { currentToday: 2 } } },
        topDevelopments: { all: [{ rank: 1, name: "Synthetic", total: 2 }] },
      },
    });
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
    for (const table of [
      "crm_dashboard_views",
      "crm_dashboard_metrics",
      "crm_dashboard_top_developments",
    ] as const) {
      expect(queriesFor(table)).toHaveLength(2);
    }
  });

  it.each([false, true])(
    "preserva visoes e includeTopDevelopments=%s no retry",
    async (include) => {
      const views = ["with_canal_imob", "without_canal_imob"] as const;
      headers(baseHeader, nextHeader, nextHeader, nextHeader);
      children([1, 2], views);
      const result = await loadDashboardReadModel([...views, views[0]], {
        includeTopDevelopments: include,
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected ready");
      expect(Object.keys(result.dashboard.metrics)).toEqual(views);
      expect(Object.keys(result.dashboard.salesValue)).toEqual(views);
      expect(Object.keys(result.dashboard.topDevelopments)).toEqual(views);
      for (const { table, builder } of queries) {
        if (table === "crm_dashboard_snapshots") continue;
        expect(builder.eq).toHaveBeenCalledExactlyOnceWith("snapshot_id", baseHeader.id);
        expect(builder.in).toHaveBeenCalledExactlyOnceWith("view_key", views);
        if (table === "crm_dashboard_top_developments") {
          expect(builder.order).toHaveBeenCalledExactlyOnceWith("rank");
        }
      }
      expect(queriesFor("crm_dashboard_top_developments")).toHaveLength(include ? 2 : 0);
    },
  );

  it.each([
    { id: 11 },
    { snapshot_key: "changed" },
    { reference_date: "2026-10-13" },
    { generated_at: "2026-10-14T15:00:00.123457Z" },
    { timezone: "UTC" },
    { source: "changed-source" },
    { goals_available: true },
  ])("detecta mudanca de identidade/metadata: %j", async (changes) => {
    headers(baseHeader, { ...baseHeader, ...changes }, nextHeader, nextHeader);
    children([1, 2]);
    await expect(loadDashboardReadModel(["all"])).resolves.toMatchObject({
      status: "ready",
      dashboard: { generatedAt: nextHeader.generated_at, salesValue: { all: { today: 200 } } },
    });
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
  });

  it.each(["2026-10-14T15:01:00.000002Z", "2026-10-14T15:32:00.000001Z"])(
    "detecta reimportacao com mesmo generatedAt e novo updatedAt: %s",
    async (updated_at) => {
      const reimported = { ...baseHeader, updated_at };
      headers(baseHeader, reimported, reimported, reimported);
      children([1, 2]);
      await expect(loadDashboardReadModel(["all"])).resolves.toMatchObject({
        status: "ready",
        dashboard: {
          generatedAt: baseHeader.generated_at,
          updatedAt: updated_at,
          metrics: { all: { sales: { currentToday: 2 } } },
        },
      });
      expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
    },
  );

  it("aceita offsets e precisao textual equivalentes sem perder microssegundos", async () => {
    headers(baseHeader, {
      ...baseHeader,
      generated_at: "2026-10-14T12:00:00.1234560-03:00",
      updated_at: "2026-10-14T15:01:00.0000010+00:00",
    });
    await expect(loadDashboardReadModel(["all"])).resolves.toMatchObject({
      status: "ready",
      dashboard: { generatedAt: baseHeader.generated_at, updatedAt: baseHeader.updated_at },
    });
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(2);
  });

  it.each([
    ["crm_dashboard_views", []],
    ["crm_dashboard_metrics", []],
    ["crm_dashboard_metrics", null],
    ["crm_dashboard_views", [{ view_key: "all", sales_value_today: "invalid" }]],
    ["crm_dashboard_metrics", [{ view_key: "all", current_today: "invalid" }]],
    ["crm_dashboard_top_developments", [{ rank: "invalid" }]],
  ] satisfies Array<[ChildTable, unknown]>)(
    "reconfere cabecalho antes de validar filhos transitorios de %s: %j",
    async (table, data) => {
      headers(baseHeader, nextHeader, nextHeader, nextHeader);
      children([1, 2]);
      responses[table][0] = { data, error: null };
      await expect(
        loadDashboardReadModel(["all"], { includeTopDevelopments: true }),
      ).resolves.toMatchObject({
        status: "ready",
        dashboard: {
          generatedAt: nextHeader.generated_at,
          metrics: { all: { sales: { currentToday: 2 } } },
        },
      });
      expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
    },
  );

  it.each(["crm_dashboard_views", "crm_dashboard_metrics"] as const)(
    "recusa filhos ausentes em lote estavel: %s",
    async (table) => {
      responses[table][0] = { data: [], error: null };
      await expect(loadDashboardReadModel(["all"])).rejects.toThrow("incompleto");
      expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(2);
      expect(queriesFor(table)).toHaveLength(1);
    },
  );

  it("falha fechada no segundo conflito sem terceira tentativa", async () => {
    headers(baseHeader, nextHeader, nextHeader, {
      ...nextHeader,
      updated_at: "2026-10-14T15:31:00.000002Z",
    });
    children([1, 2]);
    await expect(loadDashboardReadModel(["all"])).rejects.toThrow("mudou durante a leitura");
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
    expect(queriesFor("crm_dashboard_metrics")).toHaveLength(2);
  });

  it("retorna empty quando a remocao permanece na nova tentativa", async () => {
    headers(baseHeader, null, null);
    await expect(loadDashboardReadModel(["all"])).resolves.toEqual({ status: "empty" });
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(3);
    expect(queriesFor("crm_dashboard_metrics")).toHaveLength(1);
  });

  it.each([false, true])(
    "recarrega filhos do novo ID apos substituicao, com remocao=%s",
    async (removed) => {
      const replacement = { ...nextHeader, id: 20 };
      headers(baseHeader, removed ? null : replacement, replacement, replacement);
      children([1, 2]);
      await expect(loadDashboardReadModel(["all"])).resolves.toMatchObject({
        status: "ready",
        dashboard: { id: 20, generatedAt: replacement.generated_at },
      });
      for (const table of ["crm_dashboard_views", "crm_dashboard_metrics"] as const) {
        expect(queriesFor(table)[0]!.eq).toHaveBeenCalledExactlyOnceWith("snapshot_id", 10);
        expect(queriesFor(table)[1]!.eq).toHaveBeenCalledExactlyOnceWith("snapshot_id", 20);
      }
    },
  );

  it("falha fechada se o cabecalho desaparecer ao final da segunda tentativa", async () => {
    headers(baseHeader, nextHeader, nextHeader, null);
    children([1, 2]);
    await expect(loadDashboardReadModel(["all"])).rejects.toThrow("mudou durante a leitura");
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(4);
  });

  it.each([0, 1, 2, 3])("recusa erro na leitura %s do cabecalho", async (index) => {
    headers(baseHeader, nextHeader, nextHeader, nextHeader);
    children([1, 2]);
    responses.crm_dashboard_snapshots[index] = {
      data: null,
      error: { message: "private-db-error" },
    };
    await expect(loadDashboardReadModel(["all"])).rejects.toThrow("carregar o dashboard");
    expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(index + 1);
  });

  it.each([{ generated_at: "invalid" }, { updated_at: null }, { updated_at: "invalid" }])(
    "recusa versao invalida na reconferencia: %j",
    async (changes) => {
      headers(baseHeader, { ...baseHeader, ...changes });
      await expect(loadDashboardReadModel(["all"])).rejects.toThrow();
      expect(queriesFor("crm_dashboard_snapshots")).toHaveLength(2);
    },
  );

  it.each([
    "crm_dashboard_views",
    "crm_dashboard_metrics",
    "crm_dashboard_top_developments",
  ] as const)("recusa erro em %s sem retornar dados parciais", async (table) => {
    responses[table][0] = { data: [], error: { message: "private-db-error" } };
    await expect(loadDashboardReadModel(["all"], { includeTopDevelopments: true })).rejects.toThrow(
      "carregar os indicadores",
    );
    expect(queriesFor(table)).toHaveLength(1);
  });

  it("propaga rejeicao da consulta sem retornar o lote anterior", async () => {
    headers(baseHeader, nextHeader, nextHeader, nextHeader);
    children([1, 2]);
    responses.crm_dashboard_metrics[1] = new Error("synthetic-network-failure");
    await expect(loadDashboardReadModel(["all"])).rejects.toThrow("synthetic-network-failure");
    expect(queriesFor("crm_dashboard_metrics")).toHaveLength(2);
  });

  it("recusa falha ao criar sessao SSR", async () => {
    mocks.createClient.mockRejectedValue(new Error("synthetic-session-failure"));
    await expect(loadDashboardReadModel(["all"])).rejects.toThrow("synthetic-session-failure");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
