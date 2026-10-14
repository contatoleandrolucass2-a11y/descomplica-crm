import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/authorization/guards", () => ({
  requirePermission: mocks.requirePermission,
}));

import type { AuthorizationContext } from "@/lib/authorization/types";
import { loadUserDirectoryPage } from "@/app/(protected)/admin/usuarios/user-directory";
import { loadUsersPageAction } from "@/app/(protected)/admin/usuarios/actions";
import { ROLE_INHERITED_PERMISSIONS } from "@/lib/authorization/access-presentation";
import { PERMISSIONS } from "@/lib/authorization/permissions";

interface QueryResult {
  data: unknown;
  error: { code?: string } | null;
  count?: number | null;
}

interface QueryTrace {
  table: string;
  calls: Array<{ method: string; args: unknown[] }>;
}

const actor: AuthorizationContext = {
  userId: "a5000000-0000-4000-8000-000000000001",
  roleKey: "master",
  level: 100,
  permissions: ["users.view", "permissions.view"],
};

function profile(index: number, extra: Record<string, unknown> = {}) {
  return {
    user_id: `81000000-0000-4000-8000-00000000000${index}`,
    email: `usuario-${index}@example.test`,
    is_active: true,
    created_at: `2026-10-${String(index).padStart(2, "0")}T12:00:00.000Z`,
    access_status: "approved",
    ...extra,
  };
}

function queryBuilder(table: string, result: QueryResult, traces: QueryTrace[]) {
  const trace: QueryTrace = { table, calls: [] };
  traces.push(trace);
  const builder = {
    select(...args: unknown[]) {
      trace.calls.push({ method: "select", args });
      return builder;
    },
    order(...args: unknown[]) {
      trace.calls.push({ method: "order", args });
      return builder;
    },
    range(...args: unknown[]) {
      trace.calls.push({ method: "range", args });
      return builder;
    },
    in(...args: unknown[]) {
      trace.calls.push({ method: "in", args });
      return builder;
    },
    eq(...args: unknown[]) {
      trace.calls.push({ method: "eq", args });
      return builder;
    },
    neq(...args: unknown[]) {
      trace.calls.push({ method: "neq", args });
      return builder;
    },
    or(...args: unknown[]) {
      trace.calls.push({ method: "or", args });
      return builder;
    },
    ilike(...args: unknown[]) {
      trace.calls.push({ method: "ilike", args });
      return builder;
    },
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };
  return builder;
}

function setupClient(results: Record<string, QueryResult[]>) {
  const traces: QueryTrace[] = [];
  const queues = new Map(Object.entries(results).map(([table, entries]) => [table, [...entries]]));
  const from = vi.fn((table: string) => {
    const result = queues.get(table)?.shift();
    if (!result) throw new Error(`Unexpected query for ${table}`);
    return queryBuilder(table, result, traces);
  });
  const rpc = vi.fn().mockResolvedValue({
    data: Object.entries(ROLE_INHERITED_PERMISSIONS).flatMap(([role_key, permissions]) =>
      permissions.map((permission_key) => ({ role_key, permission_key })),
    ),
    error: null,
  });
  mocks.createClient.mockResolvedValue({ from, rpc });
  return { traces, from, rpc };
}

function currentSchemaResults(profiles: ReturnType<typeof profile>[], count: number) {
  const userIds = profiles.map((row) => row.user_id);
  return {
    profiles: [{ data: profiles, error: null, count }],
    user_roles: [
      {
        data: userIds.map((userId) => ({ user_id: userId, role_key: "broker_house" })),
        error: null,
      },
    ],
    user_permission_overrides: [
      {
        data: [
          {
            user_id: userIds[0],
            permission_key: "crm.dashboard.view",
            effect: "deny",
            reason: "Restrição sintética",
          },
        ],
        error: null,
      },
    ],
  } satisfies Record<string, QueryResult[]>;
}

describe("paginação server-side da administração de usuários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(actor);
  });

  it("limita profiles e busca roles e overrides somente para os IDs da página", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => profile(index + 1));
    const { traces } = setupClient(currentSchemaResults(rows, 8));

    const result = await loadUsersPageAction({ offset: 0, status: "all" });

    expect(mocks.requirePermission).toHaveBeenCalledOnce();
    expect(mocks.requirePermission).toHaveBeenCalledWith("users.view");
    expect(result).toMatchObject({
      status: "success",
      page: { hasMore: true, nextOffset: 6, totalCount: 8 },
    });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.page.users).toHaveLength(6);
    expect(result.page.users[0]).toMatchObject({
      inheritedPermissions: ROLE_INHERITED_PERMISSIONS.broker_house,
      overrides: [{ permissionKey: "crm.dashboard.view", effect: "deny" }],
      permissionDetailsAvailable: true,
    });

    expect(traces.find((trace) => trace.table === "profiles")?.calls).toContainEqual({
      method: "range",
      args: [0, 5],
    });
    for (const table of ["user_roles", "user_permission_overrides"]) {
      expect(traces.find((trace) => trace.table === table)?.calls).toContainEqual({
        method: "in",
        args: ["user_id", rows.map((row) => row.user_id)],
      });
    }
    expect(traces.some((trace) => ["roles", "role_permissions"].includes(trace.table))).toBe(false);
  });

  it("aplica o offset no backend e encerra a lista na última página", async () => {
    const rows = [profile(7), profile(8)];
    const { traces } = setupClient(currentSchemaResults(rows, 8));

    const result = await loadUsersPageAction({ offset: 6, search: "usuario" });

    expect(result).toMatchObject({
      status: "success",
      page: { hasMore: false, nextOffset: null, totalCount: 8 },
    });
    expect(traces.find((trace) => trace.table === "profiles")?.calls).toEqual(
      expect.arrayContaining([
        { method: "ilike", args: ["email", "%usuario%"] },
        { method: "range", args: [6, 11] },
      ]),
    );
  });

  it("mantém o fallback legado em revisão e sem presumir acesso aprovado", async () => {
    const row = profile(1);
    const results: Record<string, QueryResult[]> = currentSchemaResults([row], 1);
    results.profiles = [
      { data: null, error: { code: "42703" }, count: null },
      {
        data: [
          {
            user_id: row.user_id,
            email: row.email,
            is_active: row.is_active,
            created_at: row.created_at,
          },
        ],
        error: null,
        count: 1,
      },
    ];
    setupClient(results);

    const result = await loadUsersPageAction({ offset: 0 });

    expect(result).toMatchObject({
      status: "success",
      page: {
        onboardingFoundationAvailable: false,
        users: [{ accessStatus: "legacy_review" }],
      },
    });
  });

  it("não torna outro Administrador gerenciável por Admin com nível numérico maior", async () => {
    const row = profile(1);
    const results = currentSchemaResults([row], 1);
    results.user_roles = [{ data: [{ user_id: row.user_id, role_key: "admin" }], error: null }];
    setupClient(results);
    mocks.requirePermission.mockResolvedValue({
      ...actor,
      roleKey: "admin",
      level: 999,
    });

    const result = await loadUsersPageAction({ offset: 0 });

    expect(result).toMatchObject({
      status: "success",
      page: { users: [{ roleKey: "admin", isManageable: false }] },
    });
  });

  it("torna outro Administrador gerenciável para o Master", async () => {
    const row = profile(1);
    const results = currentSchemaResults([row], 1);
    results.user_roles = [{ data: [{ user_id: row.user_id, role_key: "admin" }], error: null }];
    setupClient(results);

    const result = await loadUsersPageAction({ offset: 0 });

    expect(result).toMatchObject({
      status: "success",
      page: { users: [{ roleKey: "admin", isManageable: true }] },
    });
  });

  it("não consulta dados quando users.view falha", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(loadUsersPageAction({ offset: 0 })).rejects.toThrow("FORBIDDEN");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("usa os padrões retornados pelo banco mesmo quando diferem do catálogo estático", async () => {
    const { rpc } = setupClient(currentSchemaResults([profile(1)], 1));
    rpc.mockResolvedValueOnce({
      data: [{ role_key: "broker_house", permission_key: "crm.inventory.riva.view" }],
      error: null,
    });
    const result = await loadUsersPageAction({ offset: 0 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_user_role_permission_defaults");
    expect(result).toMatchObject({
      status: "success",
      page: { users: [{ inheritedPermissions: ["crm.inventory.riva.view"] }] },
    });
  });

  it.each([
    { data: null, error: { code: "42501" } },
    { data: [{ role_key: "broker_house", permission_key: "unknown.permission" }], error: null },
  ])("não presume padrões quando a RPC falha ou o catálogo diverge", async (response) => {
    const { rpc } = setupClient(currentSchemaResults([profile(1)], 1));
    rpc.mockResolvedValueOnce(response);
    expect(await loadUsersPageAction({ offset: 0 })).toMatchObject({ status: "error" });
  });

  it("limita os detalhes de terceiros sem permissions.view, preservando os próprios", async () => {
    const own = profile(1, { user_id: actor.userId });
    const results = currentSchemaResults([own, profile(2)], 2);
    results.user_permission_overrides = [{ data: [], error: null }];
    setupClient(results);
    mocks.requirePermission.mockResolvedValue({ ...actor, permissions: ["users.view"] });
    const result = await loadUsersPageAction({ offset: 0 });
    expect(result).toMatchObject({
      status: "success",
      page: {
        users: [
          { userId: actor.userId, permissionDetailsAvailable: true },
          { userId: profile(2).user_id, permissionDetailsAvailable: false },
        ],
      },
    });
  });

  it("mantém contagens globais da RLS, sem reduzi-las às seis pessoas carregadas", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => profile(index + 1));
    const results = currentSchemaResults(rows, 40);
    results.profiles.push(
      { data: [], error: null, count: 32 },
      { data: [], error: null, count: 5 },
      { data: [], error: null, count: 3 },
    );
    const { traces } = setupClient(results);
    const page = await loadUserDirectoryPage(actor, { offset: 0 }, { includeSummary: true });
    expect(page.summary).toEqual({ total: 40, active: 32, pending: 5, revoked: 3 });
    expect(page.users).toHaveLength(6);
    expect(
      traces.filter(
        (trace) =>
          trace.table === "profiles" &&
          trace.calls.some(
            (call) => call.method === "select" && (call.args[1] as { head?: boolean })?.head,
          ),
      ),
    ).toHaveLength(3);
  });

  it("não consulta detalhes nem padrões quando a página está vazia", async () => {
    const { from, rpc } = setupClient({ profiles: [{ data: [], error: null, count: 0 }] });
    expect(await loadUsersPageAction({ offset: 0 })).toMatchObject({
      status: "success",
      page: { users: [], hasMore: false, totalCount: 0 },
    });
    expect(from).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([25, 31])(
    "aceita catálogo com %i chaves e herança Admin integral do banco",
    async (size) => {
      const excluded = new Set([
        "crm.read_model_v3.view",
        "crm.read_model_v3.ranking.view",
        "crm.read_model_v3.partnerships.view",
        "crm.read_model_v3.stock.view",
        "crm.commercial_engine.execute",
        "crm.commercial_policy.manage",
      ]);
      const keys = Object.keys(PERMISSIONS).filter((key) => size === 31 || !excluded.has(key));
      const row = profile(1);
      const results = currentSchemaResults([row], 1);
      results.user_roles = [{ data: [{ user_id: row.user_id, role_key: "admin" }], error: null }];
      const { rpc } = setupClient(results);
      rpc.mockResolvedValueOnce({
        data: keys.map((permission_key) => ({ role_key: "admin", permission_key })),
        error: null,
      });
      const result = await loadUsersPageAction({ offset: 0 });
      expect(result).toMatchObject({
        status: "success",
        page: { roleDefaults: { admin: keys }, users: [{ inheritedPermissions: keys }] },
      });
      expect(keys).toHaveLength(size);
    },
  );
});
