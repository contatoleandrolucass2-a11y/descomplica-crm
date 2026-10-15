import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { hasPersistedPageAccess } from "@/lib/navigation/page-access";

const row = {
  key: "crm.management.routine",
  path: "/app/gestao/rotina",
  permission_key: "crm.management.routine.view",
  is_active: true,
};

function client(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  return { from: vi.fn(() => query) } as unknown as Pick<SupabaseClient, "from">;
}

describe("persisted page authorization", () => {
  it("allows only the independently selected page after activation", async () => {
    expect(
      await hasPersistedPageAccess(client(row), row.path, "broker_house", [row.permission_key]),
    ).toBe(true);
    expect(
      await hasPersistedPageAccess(client(row), row.path, "broker_house", ["crm.dashboard.view"]),
    ).toBe(false);
    expect(
      await hasPersistedPageAccess(client(row), row.path, "broker_house", ["crm.management.view"]),
    ).toBe(false);
  });
  it("supports the recorded legacy gate only before the database changes the row", async () => {
    const legacy = { ...row, permission_key: "crm.dashboard.view" };
    expect(
      await hasPersistedPageAccess(client(legacy), row.path, "broker_house", [
        "crm.dashboard.view",
      ]),
    ).toBe(true);
    expect(
      await hasPersistedPageAccess(client(legacy), row.path, "broker_house", [row.permission_key]),
    ).toBe(false);
  });
  it.each([
    null,
    { ...row, is_active: false },
    { ...row, path: "/app/gestao" },
    { ...row, key: "crm.management" },
    { ...row, permission_key: "pages.view" },
  ])("rejects missing, inactive or mismatched catalog rows: %j", async (data) => {
    expect(
      await hasPersistedPageAccess(client(data), row.path, "master", [
        row.permission_key,
        "crm.dashboard.view",
        "pages.view",
      ]),
    ).toBe(false);
  });
  it("never grants access when the catalog read fails", async () => {
    expect(
      await hasPersistedPageAccess(client(row, { code: "42501" }), row.path, "master", [
        row.permission_key,
      ]),
    ).toBe(false);
  });
  it("keeps the Repasse role boundary even with an explicit page grant", async () => {
    const repasse = {
      key: "crm.repasse",
      path: "/app/repasse",
      permission_key: "crm.repasse.view",
      is_active: true,
    };
    expect(
      await hasPersistedPageAccess(client(repasse), repasse.path, "coordinator", [
        repasse.permission_key,
      ]),
    ).toBe(false);
    expect(
      await hasPersistedPageAccess(client(repasse), repasse.path, "admin", [
        repasse.permission_key,
      ]),
    ).toBe(true);
  });
});
