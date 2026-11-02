import { describe, expect, it, vi } from "vitest";
import { postgresStore } from "../lib/crm/lead-plus/server/postgres.mjs";
import { handleLeadPlus } from "../lib/crm/lead-plus/server/runtime.mjs";

describe("operational lead reads", () => {
  it.each([
    ["broker", ["broker"]],
    ["manager", ["broker", "manager"]],
    ["admin", null],
  ])("keeps %s scope and the separately authorized bucket in the list", async (role, owners) => {
    const users = ["broker", "manager", "admin"].map((id) => ({
      id,
      auth_user_id: `auth-${id}`,
      role: id,
      active: true,
      team: id === "admin" ? "B" : "A",
      name: id,
    }));
    const lead = (id: string, owner_id: string) => ({
      id,
      owner_id,
      created_at: "2026-11-01T12:00:00.000Z",
      stage: 0,
    });
    const leads = vi
      .fn()
      .mockResolvedValue([lead("own", role as string), lead("outside", "other")]);
    const response = await handleLeadPlus(
      new Request("https://crm.example.invalid/app/leads/backend/leads"),
      "/leads",
      {
        id: `auth-${role}`,
        email: `${role}@example.invalid`,
        token: "synthetic",
        authorizedPages: ["/app/leads", "/app/leads/lista"],
        canonicalPermissions: ["crm.leads.view", "crm.leads.list.view"],
      },
      {
        store: {
          listResources: async () => users,
          leads,
          bucketLeads: async () => ({
            data: [{ ...lead("bucket", "other"), bucket_available_at: "2026-11-01T12:00:00.000Z" }],
          }),
          bucketTimers: async () => [],
        },
      },
    );
    expect(response.status).toBe(200);
    expect(leads).toHaveBeenCalledWith({ ownerIds: owners });
    const result = await response.json();
    expect(result.data.map((row: { id: string }) => row.id)).toEqual(
      role === "admin" ? ["bucket", "outside", "own"] : ["bucket", "own"],
    );
  });
  it("pushes an empty or restricted validated owner scope into parameterized SQL", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const store = postgresStore({ query });
    await store.leads({ ownerIds: [] });
    expect(query.mock.calls[0]?.[1]).toEqual([[]]);
    expect(query.mock.calls[0]?.[0]).toContain("l.owner_id=ANY($1::text[])");
    await store.leads({ ownerIds: ["owner-a' OR true --"], summary: true });
    const [sql, args] = query.mock.calls[1]!;
    expect(sql).not.toContain("OR true");
    expect(args).toEqual([["owner-a' OR true --"]]);
    expect(sql).not.toContain("c.email");
    expect(sql).not.toContain("c.phone");
    expect(sql).not.toContain("l.*");
    await store.leads({ ownerIds: null });
    expect(query.mock.calls[2]?.[0]).not.toContain("WHERE");
  });

  it("reconciles complete scoped dashboard aggregates including archived closed leads", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { archived: false, stage: 0, source: "manual", count: 4, value: "100" },
        { archived: false, stage: 5, source: "manual", count: 2, value: "300" },
        { archived: true, stage: 5, source: "csv", count: 1, value: "150" },
      ],
    });
    const result = await postgresStore({ query }).dashboard({ ownerIds: ["team-a", "team-b"] });
    expect(query.mock.calls[0]?.[1]).toEqual([["team-a", "team-b"]]);
    expect(query.mock.calls[0]?.[0]).not.toContain("JOIN c2s_app.contacts");
    expect(result).toMatchObject({ total: 7, active: 6, archived: 1 });
    expect(result.stages[0]).toMatchObject({ count: 4, value: 100 });
    expect(result.stages[5]).toMatchObject({ count: 2, value: 300 });
    expect(result.sources).toEqual([
      { name: "csv", leads: 1, convertidos: 1 },
      { name: "manual", leads: 6, convertidos: 2 },
    ]);
  });

  it("keeps earliest contact across all history and all stage events rather than truncating history at the filter", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await postgresStore({ query }).analyticsHistory(["lead-id"]);
    const [activities, events] = query.mock.calls;
    expect(activities?.[0]).toContain("DISTINCT ON (lead_id)");
    expect(activities?.[0]).toContain("type IN ('call','whatsapp','visit')");
    expect(activities?.[0]).not.toContain("created_at >=");
    expect(events?.[0]).not.toContain("DISTINCT");
    expect(events?.[0]).not.toContain("created_at >=");
  });
});
