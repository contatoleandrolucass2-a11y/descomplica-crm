import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/lib/authorization/types";
import type { DashboardReadModel } from "@/lib/crm/dashboard/data";
import { loadDashboardTeam } from "@/lib/crm/dashboard/team";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

type Table = "crm_ranking_snapshots" | "crm_dashboard_snapshots" | "crm_ranking_participants";
interface Response {
  data: unknown;
  error: unknown;
  count?: unknown;
}

const dashboard: DashboardReadModel = {
  id: 10,
  snapshotKey: "global",
  referenceDate: "2026-10-13",
  generatedAt: "2026-10-13T15:00:00.123456Z",
  updatedAt: "2026-10-13T15:01:00.000001Z",
  timezone: "America/Sao_Paulo",
  source: "synthetic-salesforce-fixture",
  goalsAvailable: false,
  salesValue: {},
  metrics: {},
  topDevelopments: {},
};
const authorization: AuthorizationContext = {
  userId: "a4000000-0000-4000-8000-000000000001",
  roleKey: "admin",
  level: 90,
  permissions: ["crm.dashboard.view", "crm.dashboard.all.view", "crm.ranking.view"],
};

function header(id: number) {
  return {
    id,
    snapshot_key: "global",
    reference_date: dashboard.referenceDate,
    generated_at: dashboard.generatedAt,
    timezone: dashboard.timezone,
    source: dashboard.source,
    updated_at: dashboard.updatedAt,
  };
}

function query(response: Response) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    range: vi.fn().mockResolvedValue(response),
  };
}

let responses: Record<Table, Response[]>;
let queries: Array<{ table: Table; builder: ReturnType<typeof query> }>;

function participants(data: unknown[], count: unknown = data.length) {
  responses.crm_ranking_participants = [{ data, count, error: null }];
}

function changeHeader(table: Table, index: number, changes: Record<string, unknown>) {
  const response = responses[table][index]!;
  response.data = { ...(response.data as Record<string, unknown>), ...changes };
}

function load() {
  return loadDashboardTeam(dashboard, authorization, "all");
}

beforeEach(() => {
  vi.resetAllMocks();
  queries = [];
  responses = {
    crm_ranking_snapshots: [
      { data: header(20), error: null },
      { data: header(20), error: null },
    ],
    crm_dashboard_snapshots: [
      { data: header(10), error: null },
      { data: header(10), error: null },
    ],
    crm_ranking_participants: [],
  };
  participants([
    { broker_key: "sf-contact-1", manager_name: "Gerente B" },
    { broker_key: "sf-contact-2", manager_name: "Gerente A" },
  ]);
  mocks.from.mockImplementation((table: Table) => {
    const response = responses[table].shift();
    if (!response) throw new Error(`Unexpected query: ${table}`);
    const builder = query(response);
    queries.push({ table, builder });
    return builder;
  });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
});

describe("loadDashboardTeam", () => {
  it.each(["crm.ranking.view", "crm.dashboard.all.view"] as const)(
    "recusa ausencia de %s antes de criar cliente ou consultar",
    async (permission) => {
      const result = await loadDashboardTeam(
        dashboard,
        {
          ...authorization,
          permissions: authorization.permissions.filter((key) => key !== permission),
        },
        "all",
      );
      expect(result).toEqual({ status: "unavailable", reason: "Sem acesso aos dados da equipe." });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it.each(["with_canal_imob", "without_canal_imob"] as const)(
    "recusa roster global na visao %s mesmo com todas as permissoes",
    async (view) => {
      expect(await loadDashboardTeam(dashboard, authorization, view)).toEqual({
        status: "unavailable",
        reason: "Equipe indisponivel nesta visao.",
      });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("usa apenas identidade e gerente, mes fixo, contagem exata e faixa limitada", async () => {
    expect(await load()).toEqual({
      status: "ready",
      team: {
        brokers: 2,
        managers: [
          { name: "Gerente A", total: 1 },
          { name: "Gerente B", total: 1 },
        ],
      },
    });
    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith();
    expect(queries.map(({ table }) => table)).toEqual([
      "crm_ranking_snapshots",
      "crm_dashboard_snapshots",
      "crm_ranking_participants",
      "crm_ranking_snapshots",
      "crm_dashboard_snapshots",
    ]);
    const participantQuery = queries[2]!.builder;
    expect(participantQuery.select).toHaveBeenCalledExactlyOnceWith("broker_key,manager_name", {
      count: "exact",
    });
    expect(participantQuery.eq.mock.calls).toEqual([
      ["snapshot_id", 20],
      ["period_key", "month"],
    ]);
    expect(participantQuery.range).toHaveBeenCalledExactlyOnceWith(0, 999);
    for (const { builder } of queries.filter(({ table }) => table !== "crm_ranking_participants")) {
      expect(builder.select).toHaveBeenCalledExactlyOnceWith(
        "id,snapshot_key,reference_date,generated_at,timezone,source,updated_at",
      );
      expect(builder.eq).toHaveBeenCalledExactlyOnceWith("snapshot_key", "global");
    }
  });

  it("deduplica broker_key e preserva gerentes distintos e ausentes", async () => {
    participants([
      { broker_key: "broker-1", manager_name: " Gerente A " },
      { broker_key: "broker-1", manager_name: "Gerente A" },
      { broker_key: "broker-2", manager_name: "Gerente A" },
      { broker_key: "broker-3", manager_name: null },
      { broker_key: "broker-4", manager_name: "   " },
      { broker_key: "broker-5" },
    ]);
    expect(await load()).toEqual({
      status: "ready",
      team: {
        brokers: 5,
        managers: [
          { name: "Gerente A", total: 2 },
          { name: "Sem gerente informado", total: 3 },
        ],
      },
    });
  });

  it.each(["Gerente B", null])("recusa duplicata com gerente conflitante: %s", async (manager) => {
    participants([
      { broker_key: "broker-1", manager_name: "Gerente A" },
      { broker_key: "broker-1", manager_name: manager },
    ]);
    expect(await load()).toEqual({
      status: "unavailable",
      reason: "Equipe com dados inconsistentes.",
    });
  });

  it.each([
    { snapshot_key: "other" },
    { reference_date: "2026-10-12" },
    { generated_at: "2026-10-13T15:00:00.123457Z" },
    { timezone: "UTC" },
    { source: "different-source" },
  ])("recusa metadata ranking divergente: %j", async (changes) => {
    changeHeader("crm_ranking_snapshots", 0, changes);
    expect(await load()).toMatchObject({ status: "unavailable" });
    expect(mocks.from).not.toHaveBeenCalledWith("crm_ranking_participants");
  });

  it.each([{ id: 99 }, { generated_at: "2026-10-13T16:00:00Z" }])(
    "recusa dashboard passado que ja mudou: %j",
    async (changes) => {
      changeHeader("crm_dashboard_snapshots", 0, changes);
      expect(await load()).toMatchObject({ status: "unavailable" });
      expect(mocks.from).not.toHaveBeenCalledWith("crm_ranking_participants");
    },
  );

  it.each(["2026-10-13T15:00:59.999999Z", "2026-10-13T15:01:00.000000Z"])(
    "recusa ranking antigo apos ingestao somente do dashboard: %s",
    async (updatedAt) => {
      for (const index of [0, 1]) {
        changeHeader("crm_ranking_snapshots", index, { updated_at: updatedAt });
      }
      expect(await load()).toEqual({ status: "unavailable", reason: "Snapshots divergentes." });
      expect(mocks.from).not.toHaveBeenCalledWith("crm_ranking_participants");
    },
  );

  it.each(["2026-10-13T15:02:00.000001Z", "2026-10-13T15:01:00.000002Z"])(
    "recusa regravacao anterior a leitura com mesmo generatedAt e novo updatedAt: %s",
    async (updatedAt) => {
      for (const table of ["crm_ranking_snapshots", "crm_dashboard_snapshots"] as const) {
        changeHeader(table, 0, { updated_at: updatedAt });
        changeHeader(table, 1, { updated_at: updatedAt });
      }
      expect(await load()).toEqual({ status: "unavailable", reason: "Snapshots divergentes." });
      expect(mocks.from).not.toHaveBeenCalledWith("crm_ranking_participants");
    },
  );

  it("aceita timestamps equivalentes com offsets e precisao textual diferentes", async () => {
    for (const table of ["crm_ranking_snapshots", "crm_dashboard_snapshots"] as const) {
      changeHeader(table, 0, {
        generated_at: "2026-10-13T12:00:00.123456-03:00",
        updated_at: "2026-10-13T12:01:00.000001-03:00",
      });
      changeHeader(table, 1, {
        generated_at: "2026-10-13T15:00:00.1234560+00:00",
        updated_at: "2026-10-13T12:01:00.0000010-03:00",
      });
    }
    expect(await load()).toMatchObject({ status: "ready" });
  });

  it("normaliza tambem o updatedAt original recebido do dashboard", async () => {
    expect(
      await loadDashboardTeam(
        { ...dashboard, updatedAt: "2026-10-13T12:01:00.0000010-03:00" },
        authorization,
        "all",
      ),
    ).toMatchObject({ status: "ready" });
  });

  describe.each(["crm_ranking_snapshots", "crm_dashboard_snapshots"] as const)(
    "releitura de %s",
    (table) => {
      it.each([
        { id: 99 },
        { reference_date: "2026-10-14" },
        { generated_at: "2026-10-13T15:00:00.123457Z" },
        { updated_at: "2026-10-13T15:01:00.000002Z" },
        { source: "changed-source" },
        { timezone: "UTC" },
      ])("recusa alteracao concorrente: %j", async (changes) => {
        changeHeader(table, 1, changes);
        expect(await load()).toEqual({
          status: "unavailable",
          reason: "Snapshot alterado durante a leitura.",
        });
      });

      it.each([0, 1])("recusa header ausente na leitura %s", async (index) => {
        responses[table][index] = { data: null, error: null };
        expect(await load()).toMatchObject({ status: "unavailable" });
      });

      it.each([0, 1])("sanitiza erro do banco na leitura %s", async (index) => {
        responses[table][index] = { data: header(20), error: { message: "private-db-error" } };
        const result = await load();
        expect(result.status).toBe("unavailable");
        expect(JSON.stringify(result)).not.toContain("private-db-error");
      });
    },
  );

  it.each([null, undefined, -1, 0, 1, 3, 1.5, "2", 1_001])(
    "recusa contagem ausente, invalida ou diferente das linhas: %s",
    async (count) => {
      responses.crm_ranking_participants[0]!.count = count;
      expect(await load()).toMatchObject({ status: "unavailable" });
    },
  );

  it.each([1_000, 1_001])("verifica limite e truncamento com contagem %s", async (count) => {
    participants(
      Array.from({ length: 1_000 }, (_, index) => ({
        broker_key: `broker-${index}`,
        manager_name: "Gerente A",
      })),
      count,
    );
    const result = await load();
    if (count === 1_000) {
      expect(result).toEqual({
        status: "ready",
        team: { brokers: 1_000, managers: [{ name: "Gerente A", total: 1_000 }] },
      });
    } else {
      expect(result).toMatchObject({ status: "unavailable" });
    }
  });

  it("nao transforma zero linhas sem prova em equipe vazia", async () => {
    participants([]);
    expect(await load()).toMatchObject({ status: "unavailable" });
  });

  it.each([null, {}, [{ broker_key: "" }], [{ broker_key: "broker-1", manager_name: 123 }]])(
    "recusa participantes ausentes ou invalidos: %j",
    async (data) => {
      responses.crm_ranking_participants = [{ data, count: 1, error: null }];
      expect(await load()).toMatchObject({ status: "unavailable" });
    },
  );

  it.each([{ generated_at: "invalid" }, { updated_at: null }, { reference_date: "2026-02-30" }])(
    "recusa header inconsistente: %j",
    async (changes) => {
      changeHeader("crm_ranking_snapshots", 0, changes);
      expect(await load()).toMatchObject({ status: "unavailable" });
    },
  );

  it("recusa dashboard invalido antes de consultar", async () => {
    expect(
      await loadDashboardTeam({ ...dashboard, generatedAt: "invalid" }, authorization, "all"),
    ).toMatchObject({ status: "unavailable" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "invalid"])(
    "recusa updatedAt original ausente ou invalido antes de consultar: %s",
    async (updatedAt) => {
      expect(
        await loadDashboardTeam(
          { ...dashboard, updatedAt: updatedAt as unknown as string },
          authorization,
          "all",
        ),
      ).toEqual({ status: "unavailable", reason: "Snapshot do dashboard inconsistente." });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("sanitiza erro na consulta dos participantes", async () => {
    responses.crm_ranking_participants[0]!.error = { message: "private-db-error" };
    expect(await load()).toEqual({
      status: "unavailable",
      reason: "Nao foi possivel consultar a equipe.",
    });
  });

  it("sanitiza rejeicao da sessao SSR", async () => {
    mocks.createClient.mockRejectedValue(new Error("private-session-error"));
    expect(await load()).toEqual({
      status: "unavailable",
      reason: "Nao foi possivel consultar a equipe.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
