import { describe, expect, it, vi } from "vitest";
import { leadPageRequest, nextLeadCursor } from "../lib/crm/lead-plus/server/lead-list-page.mjs";
import { postgresStore } from "../lib/crm/lead-plus/server/postgres.mjs";
import { handleLeadPlus } from "../lib/crm/lead-plus/server/runtime.mjs";

const scope = { ownerIds: ["broker-a"], actorId: "broker-a" };
const now = new Date("2026-11-02T12:00:00.000Z");
const parameters = (more: Record<string, string> = {}) =>
  new URLSearchParams({ limit: "2", category: "all", ...more });
const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

describe("lead cursor contract", () => {
  it("preserves microsecond ordering and binds the cursor to the actor, owners and filters", () => {
    const first = leadPageRequest(parameters(), scope, now);
    const cursor = nextLeadCursor(first, {
      id: id(2),
      cursor_created_at: "2026-11-01T12:00:00.123456Z",
    });
    const next = leadPageRequest(parameters({ cursor }), scope, new Date(+now + 10000));
    expect(next.after).toEqual({ id: id(2), created: "2026-11-01T12:00:00.123456Z" });
    expect(next.asOf).toBe(first.asOf);
    for (const different of [
      { ...scope, actorId: "other" },
      { ...scope, ownerIds: [] },
      { ...scope, ownerIds: null },
    ])
      expect(() => leadPageRequest(parameters({ cursor }), different, now)).toThrow(
        "recorte atual",
      );
    expect(() => leadPageRequest(parameters({ cursor, q: "changed" }), scope, now)).toThrow(
      "recorte atual",
    );
  });
  it("rejects invalid limits, malformed cursors and unsupported filters without widening scope", () => {
    for (const limit of ["0", "101", "1.5", "Infinity"])
      expect(() => leadPageRequest(parameters({ limit }), scope, now)).toThrow();
    for (const cursor of [
      "not-json",
      "!!",
      Buffer.from(JSON.stringify({ v: 1 })).toString("base64url"),
    ])
      expect(() => leadPageRequest(parameters({ cursor }), scope, now)).toThrow("recorte atual");
    expect(() => leadPageRequest(parameters({ category: "unknown" }), scope, now)).toThrow();
    expect(() => leadPageRequest(parameters({ arbitrary: "unexpected" }), scope, now)).toThrow();
  });
  it("returns one bounded page with complete counts and derives the cursor from the last visible row", async () => {
    const raw = [1, 2, 3].map((number) => ({
      id: id(number),
      owner_id: "broker-a",
      value: "100",
      created_at: "2026-11-01T12:00:00.123456Z",
      updated_at: "2026-11-01T12:00:00.123456Z",
      cursor_created_at: "2026-11-01T12:00:00.123456Z",
    }));
    const query = vi.fn().mockResolvedValue({
      rows: [{ data: raw, total: 120, counts: { Todos: 120 }, next_transition_at: null }],
    });
    const context = leadPageRequest(parameters({ q: "a%' OR true --" }), scope, now);
    const result = await postgresStore({ query }).leadPage(context);
    expect(result.data.map((row) => row.id)).toEqual([id(1), id(2)]);
    expect(result.total).toBe(120);
    expect(result.counts).toEqual({ Todos: 120 });
    expect(result.data[0]).not.toHaveProperty("cursor_created_at");
    expect(
      leadPageRequest(parameters({ q: context.filters.q, cursor: result.next_cursor! }), scope, now)
        .after?.id,
    ).toBe(id(2));
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, args] = query.mock.calls[0]!;
    expect(sql).not.toContain(context.filters.q);
    expect(args).toEqual([
      scope.ownerIds,
      scope.actorId,
      context.filters.q,
      "",
      "all",
      now.toISOString(),
      null,
      null,
      3,
      "all",
    ]);
    expect(sql).toContain("pg_input_is_valid");
    expect(sql).not.toContain(" OFFSET ");
  });
  it("keeps the endpoint optional and revalidates identity before accepting a cursor", async () => {
    const leadPage = vi
      .fn()
      .mockResolvedValue({ data: [], total: 0, counts: { Todos: 0 }, next_cursor: null });
    const user = {
      id: "broker-a",
      auth_user_id: "auth-a",
      role: "broker",
      active: true,
      team: "A",
      name: "Synthetic",
    };
    const store = { listResources: async () => [user], leadPage };
    const identity = {
      id: "auth-a",
      email: "synthetic@example.invalid",
      token: "fixture",
      authorizedPages: ["/app/leads", "/app/leads/lista"],
      canonicalPermissions: ["crm.leads.view", "crm.leads.list.view"],
    };
    const request = new Request(
      "https://crm.example.invalid/app/leads/backend/leads?limit=50&category=all",
    );
    const response = await handleLeadPlus(request, "/leads", identity, { store });
    expect(response.status).toBe(200);
    expect(leadPage.mock.calls[0]?.[0]).toMatchObject({
      actorId: "broker-a",
      ownerIds: ["broker-a"],
      limit: 50,
    });
    user.active = false;
    expect((await handleLeadPlus(request, "/leads", identity, { store })).status).toBe(403);
    expect(leadPage).toHaveBeenCalledTimes(1);
  });
  it("never applies the visual page limit to the authorized export", async () => {
    const leadPage = vi.fn();
    const leads = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 121 }, (_, index) => ({ id: id(index + 1), owner_id: "admin" })),
      );
    const user = {
      id: "admin",
      auth_user_id: "auth-admin",
      role: "admin",
      active: true,
      name: "Synthetic",
      team: "",
    };
    const response = await handleLeadPlus(
      new Request("https://crm.example.invalid/app/leads/backend/exports/leads?limit=50"),
      "/exports/leads",
      {
        id: "auth-admin",
        email: "fixture@example.invalid",
        token: "fixture",
        authorizedPages: ["/app/leads", "/app/leads/relatorios"],
        canonicalPermissions: [
          "crm.leads.view",
          "crm.leads.reports.view",
          "crm.leads.reports.export",
          "crm.leads.export",
        ],
      },
      { store: { listResources: async () => [user], leads, leadPage } },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toHaveLength(121);
    expect(leads).toHaveBeenCalledWith({ ownerIds: null });
    expect(leadPage).not.toHaveBeenCalled();
  });
});
