import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { postgresStore } from "../lib/crm/lead-plus/server/postgres.mjs";
// @ts-expect-error Operational server ESM.
import { runLeadRequestAuditContext } from "../lib/crm/lead-plus/server/request-audit-context.mjs";
function fixture(
  options: {
    ids?: string[];
    version?: number;
    masters?: boolean;
    previousInput?: Record<string, unknown>;
  } = {},
) {
  const calls: string[] = [];
  let version = options.version ?? 1,
    ids = options.ids ?? ["10"];
  const query = async (sql: string, args?: unknown[]) => {
    calls.push(sql);
    if (sql.includes("SELECT version FROM c2s_app.resources"))
      return { rows: version ? [{ version }] : [] };
    if (sql.startsWith("SELECT data FROM c2s_app.resources"))
      return { rows: [{ data: { campaign_ids: ids } }] };
    if (sql.startsWith("SELECT id,data,version FROM c2s_app.resources"))
      return {
        rows:
          options.masters === false
            ? []
            : [{ id: "master", data: { active: true, role: "admin" }, version: 1 }],
      };
    if (sql.startsWith("INSERT INTO c2s_app.resources")) {
      ids = JSON.parse(String(args?.[0])).campaign_ids;
      version++;
      return { rows: [{ data: { campaign_ids: ids }, version }] };
    }
    if (sql.startsWith("SELECT * FROM c2s_app.requests"))
      return {
        rows: options.previousInput
          ? [
              {
                hash: createHash("sha256")
                  .update(JSON.stringify(options.previousInput))
                  .digest("hex"),
                lead_id: "saved",
              },
            ]
          : [],
      };
    if (sql.startsWith("SELECT l.*"))
      return {
        rows: [{ id: "saved", created_at: new Date(0), updated_at: new Date(0), value: 0 }],
      };
    return { rows: [], rowCount: 0 };
  };
  const pool = { query, connect: async () => ({ query, release: () => {} }), end: async () => {} };
  return { calls, store: postgresStore(pool) };
}
it("campaign policy writes use a version CAS and roll back stale selections", async () => {
  const f = fixture();
  await expect(f.store.saveCampaignSelectionCAS(["11"], 0)).rejects.toThrow("outra tela");
  expect(f.calls.some((sql) => sql.startsWith("INSERT INTO c2s_app.resources"))).toBe(false);
  expect(f.calls.at(-1)).toBe("ROLLBACK");
  const next = await f.store.saveCampaignSelectionCAS([], 1);
  expect(next).toEqual({ campaign_ids: [], version: 2 });
  expect(f.calls).toContain("SELECT pg_advisory_xact_lock(730102)");
  expect(f.calls.at(-1)).toBe("COMMIT");
});
it("the commit transaction rejects a revoked campaign or absent master before contact/lead persistence", async () => {
  for (const options of [{ ids: [] }, { masters: false }]) {
    const f = fixture(options);
    await expect(
      f.store.createMetaLead(
        { attribution: { campaign_id: "10" } },
        "meta:1000",
        new Set(["master"]),
      ),
    ).rejects.toThrow();
    expect(f.calls.some((sql) => /^INSERT INTO c2s_app\.(contacts|leads)/.test(sql))).toBe(false);
    expect(f.calls.at(-1)).toBe("ROLLBACK");
  }
});
it("selected retries reuse idempotent leads after the campaign lock and never create a second contact", async () => {
  const input = { external_id: "1000", source: "facebook", attribution: { campaign_id: "10" } };
  const f = fixture({ previousInput: input });
  for (let count = 0; count < 2; count++)
    expect(await f.store.createMetaLead(input, "meta:1000", new Set(["master"]))).toMatchObject({
      duplicate: true,
      lead: { id: "saved" },
    });
  expect(f.calls.indexOf("SELECT pg_advisory_xact_lock(730102)")).toBeLessThan(
    f.calls.indexOf("SELECT pg_advisory_xact_lock(730101)"),
  );
  expect(f.calls.some((sql) => /^INSERT INTO c2s_app\.(contacts|leads)/.test(sql))).toBe(false);
});
it("ignored campaigns finish without retry or overwriting a completed lead linkage", async () => {
  const f = fixture();
  await f.store.ignoreMeta("job");
  expect(f.calls[0]).toContain("status='completed',lead_id=NULL");
  expect(f.calls[0]).toContain("AND lead_id IS NULL AND status='processing'");
});

it("persists the real request actor and viewed user in the SQL audit record", async () => {
  const records: unknown[][] = [];
  const query = async (sql: string, args?: unknown[]) => {
    if (sql.startsWith("INSERT INTO c2s_app.audit")) records.push(args || []);
    if (sql.startsWith("SELECT version")) return { rows: [{ version: 1 }] };
    if (sql.startsWith("INSERT INTO c2s_app.resources"))
      return { rows: [{ data: { campaign_ids: [] }, version: 2 }] };
    return { rows: [], rowCount: 0 };
  };
  const store = postgresStore({
    query,
    connect: async () => ({ query, release() {} }),
    end: async () => {},
  });
  await runLeadRequestAuditContext(
    { id: "original", auth_id: "real-auth", name: "Original administrator" },
    { id: "viewed", name: "Viewed user" },
    () => store.saveCampaignSelectionCAS([], 1),
  );
  expect(records).toHaveLength(1);
  expect(JSON.parse(String(records[0]?.[3]))).toMatchObject({
    actor_user_id: "original",
    auth_user_id: "real-auth",
    viewed_user_id: "viewed",
    impersonating: true,
  });
});
