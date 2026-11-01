import { expect, it } from "vitest";
import { handleLeadPlus, membershipSession } from "../lib/crm/lead-plus/server/runtime.mjs";

const identity = {
  id: "auth-admin",
  email: "admin@example.invalid",
  token: "synthetic-session",
  authorizedPages: ["/app/leads", "/app/leads/configuracoes"],
  canonicalPermissions: ["users.view", "users.manage", "crm.leads.settings.manage"],
};
const member = {
  id: "admin",
  auth_user_id: identity.id,
  name: "Synthetic admin",
  email: identity.email,
  role: "admin",
  active: true,
  team: "",
};
function fixture(role = "admin", team = "") {
  const users = [{ ...member, role, team }];
  const writes: unknown[][] = [];
  const session = membershipSession(users, identity) as { csrf: string };
  const store = {
    listResources: async (kind: string) => (kind === "users" ? users : []),
    saveCampaignSelectionCAS: async (ids: string[], version: number) => {
      if (version !== 0) throw Object.assign(Error("Stale selection"), { status: 409 });
      writes.push([ids, version]);
      return { campaign_ids: ids, version: 1 };
    },
    saveResource: async (...args: unknown[]) => writes.push(args),
  };
  const run = (path: string, input: unknown) =>
    handleLeadPlus(
      new Request("https://crm.example.invalid" + path, {
        method: "PUT",
        headers: { "x-c2s-csrf": session.csrf },
        body: JSON.stringify(input),
      }),
      path,
      identity,
      { store },
    );
  return { run, writes };
}

it("allows authorized Admin and Superintendent to pause intake without a Meta catalog or token", async () => {
  for (const role of ["admin", "superintendent"]) {
    const f = fixture(role);
    const response = await f.run("/integrations/facebook/campaigns", {
      campaign_ids: [],
      version: 0,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ selection: { campaign_ids: [], version: 1 } });
    expect(f.writes).toEqual([[[], 0]]);
  }
});

it("denies global campaign edits to managers with or without teams and brokers", async () => {
  for (const [role, team] of [
    ["manager", "A"],
    ["manager", ""],
    ["broker", "A"],
  ]) {
    const f = fixture(role, team);
    expect(
      (await f.run("/integrations/facebook/campaigns", { campaign_ids: [], version: 0 })).status,
    ).toBe(403);
    expect(f.writes).toEqual([]);
  }
});

it("preserves selection CAS and rejects forged selection data", async () => {
  const f = fixture();
  expect(
    (await f.run("/integrations/facebook/campaigns", { campaign_ids: [], version: 2 })).status,
  ).toBe(409);
  for (const input of [
    { campaign_ids: [], version: 0, account_id: "untrusted" },
    { campaign_ids: ["not-numeric"], version: 0 },
  ])
    expect((await f.run("/integrations/facebook/campaigns", input)).status).toBe(422);
  expect(f.writes).toEqual([]);
});

it("prevents bypass through generic settings and creation of an unlinked user", async () => {
  const f = fixture();
  expect(
    (await f.run("/resources/settings/meta-campaign-selection", { campaign_ids: ["10"] })).status,
  ).toBe(403);
  expect(
    (
      await f.run("/resources/users/new-user", {
        name: "Unlinked",
        email: "nobody@example.invalid",
        phone: "",
        team: "",
        active: true,
      })
    ).status,
  ).toBe(422);
  expect(f.writes).toEqual([]);
});
