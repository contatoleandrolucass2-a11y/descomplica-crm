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

import { loadUsersPageAction } from "@/app/(protected)/admin/usuarios/actions";
import { ROLE_INHERITED_PERMISSIONS } from "@/lib/authorization/access-presentation";

interface QueryResult {
  data: unknown;
  error: { code?: string } | null;
  count?: number | null;
}

interface QueryTrace {
  table: string;
  calls: Array<{ method: string; args: unknown[] }>;
}

const actor = {
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
  mocks.createClient.mockResolvedValue({ from });
  return { traces, from };
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

  it("não consulta dados quando users.view falha", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(loadUsersPageAction({ offset: 0 })).rejects.toThrow("FORBIDDEN");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
