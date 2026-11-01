import { describe, expect, it } from "vitest";
import { membershipSession, handleLeadPlus } from "../lib/crm/lead-plus/server/runtime.mjs";
// @ts-expect-error Operational server ESM.
import { canViewMember, viewableMembers } from "../lib/crm/lead-plus/server/view-as.mjs";
// @ts-expect-error Operational server ESM.
import * as auditContext from "../lib/crm/lead-plus/server/request-audit-context.mjs";
const { leadRequestAuditDetail, runLeadRequestAuditContext } = auditContext;

const pages = [
  "/app/leads",
  "/app/leads/lista",
  "/app/leads/funil",
  "/app/leads/configuracoes",
  "/app/leads/relatorios",
  "/app/leads/importacao",
  "/app/leads/auditoria",
  "/app/leads/distribuicao",
  "/app/leads/atividades",
];
const grants = [
  "crm.leads.view",
  "crm.leads.create",
  "crm.leads.assign",
  "crm.leads.edit",
  "users.view",
  "users.manage",
  "crm.leads.settings.manage",
];
const identity = {
  id: "auth-admin",
  email: "admin@example.test",
  token: "real-private-session",
  authorizedPages: pages,
  canonicalPermissions: grants,
};
const users = [
  { id: "admin", auth_user_id: identity.id, role: "admin", name: "Admin", active: true, team: "" },
  {
    id: "super",
    auth_user_id: "auth-super",
    role: "superintendent",
    name: "Super",
    active: true,
    team: "",
  },
  {
    id: "manager",
    auth_user_id: "auth-manager",
    role: "manager",
    name: "Manager",
    active: true,
    team: "A",
  },
  {
    id: "broker-a",
    auth_user_id: "auth-broker-a",
    role: "broker",
    name: "Broker A",
    active: true,
    team: "A",
  },
  {
    id: "broker-b",
    auth_user_id: "auth-broker-b",
    role: "broker",
    name: "Broker B",
    active: true,
    team: "B",
  },
  {
    id: "inactive",
    auth_user_id: "auth-inactive",
    role: "broker",
    name: "Inactive",
    active: false,
    team: "A",
  },
];
const resolver = async (id: string) => ({ ...identity, id, email: `${id}@example.test` });
const request = (target?: string) =>
  new Request("https://crm.example.test/app/leads/backend/session", {
    headers: target ? { "X-Lead-View-As": target } : {},
  });

describe("LEAD+ effective user without session replacement", () => {
  it("does not expose or activate other users after canonical users.view is revoked", async () => {
    const restricted = {
      ...identity,
      canonicalPermissions: grants.filter((grant) => grant !== "users.view"),
    };
    const dependencies = {
      store: { listResources: async () => users },
      resolveViewTarget: resolver,
    };
    const own = await handleLeadPlus(request(), "/session", restricted, dependencies);
    expect((await own.json()).viewable_users.map((user: { id: string }) => user.id)).toEqual([
      "admin",
    ]);
    expect(
      (await handleLeadPlus(request("broker-a"), "/session", restricted, dependencies)).status,
    ).toBe(403);
  });
  it("restricts the hierarchy and includes only active targets", () => {
    expect(viewableMembers(users, users[0]).map((user: { id: string }) => user.id)).toEqual([
      "admin",
      "super",
      "manager",
      "broker-a",
      "broker-b",
    ]);
    expect(viewableMembers(users, users[1]).map((user: { id: string }) => user.id)).toEqual([
      "super",
      "manager",
      "broker-a",
      "broker-b",
    ]);
    expect(viewableMembers(users, users[2]).map((user: { id: string }) => user.id)).toEqual([
      "manager",
      "broker-a",
    ]);
    expect(viewableMembers(users, users[3]).map((user: { id: string }) => user.id)).toEqual([
      "broker-a",
    ]);
    expect(canViewMember({ ...users[2], team: "" }, users[3])).toBe(false);
    expect(canViewMember(users[3], users[2])).toBe(false);
  });

  it("keeps the real actor and real token while limiting effective permissions to both users", async () => {
    const store = { listResources: async () => users };
    const response = await handleLeadPlus(request("broker-a"), "/session", identity, {
      store,
      resolveViewTarget: resolver,
    });
    expect(response.status).toBe(200);
    const session = await response.json();
    expect(session.actor).toMatchObject({ id: "admin", auth_id: identity.id, role: "admin" });
    expect(session.user).toMatchObject({
      id: "broker-a",
      auth_id: identity.id,
      viewed_auth_id: "auth-broker-a",
      scope: "self",
      role: "broker",
    });
    expect(session.user.permissions).not.toContain("users.manage");
    expect(session.view_as).toEqual({
      active: true,
      target_id: "broker-a",
      target_name: "Broker A",
    });
    expect(session.viewable_users.map((user: { id: string }) => user.id)).toContain("super");
    expect(JSON.stringify(session)).not.toContain(identity.token);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(membershipSession(users, identity)).toMatchObject({
      user: { id: "admin", auth_id: identity.id },
    });
  });

  it("rejects suspended canonical targets, unknown targets and absent target resolvers", async () => {
    for (const dependencies of [
      { store: { listResources: async () => users } },
      {
        store: { listResources: async () => users },
        resolveViewTarget: async () => {
          throw Error("suspended");
        },
      },
    ]) {
      const response = await handleLeadPlus(
        request("broker-a"),
        "/session",
        identity,
        dependencies,
      );
      expect([403, 503]).toContain(response.status);
    }
    expect(
      (
        await handleLeadPlus(request("inactive"), "/session", identity, {
          store: { listResources: async () => users },
          resolveViewTarget: resolver,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await handleLeadPlus(request("missing"), "/session", identity, {
          store: { listResources: async () => users },
          resolveViewTarget: resolver,
        })
      ).status,
    ).toBe(403);
  });

  it("rechecks canonical target pages and granular grants before executing a mutation", async () => {
    const store = {
      listResources: async () => users,
      createLead: () => {
        throw Error("Must not mutate");
      },
    };
    const noGrants = async (id: string) => ({ ...(await resolver(id)), canonicalPermissions: [] });
    const mutation = new Request("https://crm.example.test/app/leads/backend/leads", {
      method: "POST",
      headers: { "x-lead-view-as": "broker-a" },
      body: "{}",
    });
    expect(
      (await handleLeadPlus(mutation, "/leads", identity, { store, resolveViewTarget: noGrants }))
        .status,
    ).toBe(403);
    const noPages = async (id: string) => ({ ...(await resolver(id)), authorizedPages: [] });
    expect(
      (
        await handleLeadPlus(request("broker-a"), "/session", identity, {
          store,
          resolveViewTarget: noPages,
        })
      ).status,
    ).toBe(403);
  });

  it("binds private resources to the effective user rather than the administrator", async () => {
    const response = await handleLeadPlus(
      request("broker-a"),
      "/resources/profile/admin",
      identity,
      { store: { listResources: async () => users }, resolveViewTarget: resolver },
    );
    expect(response.status).toBe(403);
  });

  it("isolates audit actors across concurrent requests and overwrites forged details", async () => {
    const run = (id: string, target: string, delay: number) =>
      runLeadRequestAuditContext(
        { id, auth_id: `auth-${id}`, name: `Actor ${id}` },
        { id: target, name: `Target ${target}` },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return leadRequestAuditDetail({
            auth_user_id: "forged",
            actor_user_id: "forged",
            actor_name: "forged",
            viewed_user_id: "forged",
            impersonating: false,
            action: "saved",
          });
        },
      );
    const [a, b] = await Promise.all([run("a", "x", 20), run("b", "y", 1)]);
    expect(a).toMatchObject({
      auth_user_id: "auth-a",
      actor_user_id: "a",
      actor_name: "Actor a",
      viewed_user_id: "x",
      viewed_user_name: "Target x",
      impersonating: true,
      action: "saved",
    });
    expect(b).toMatchObject({ auth_user_id: "auth-b", actor_user_id: "b", viewed_user_id: "y" });
    expect(leadRequestAuditDetail({ system: true })).toEqual({ system: true });
  });
});

describe("LEAD+ explicit links to existing CRM users", () => {
  const targetId = "20000000-0000-4000-8000-000000000001";
  function linkRequest(input: unknown, viewAs?: string) {
    const session = membershipSession(users, identity) as { csrf: string };
    return new Request("https://crm.example.test/app/leads/backend/crm-users/link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-c2s-csrf": session.csrf,
        ...(viewAs ? { "x-lead-view-as": viewAs } : {}),
      },
      body: JSON.stringify(input),
    });
  }
  it("takes canonical email, keeps the explicit role and audits the real administrator", async () => {
    const writes: unknown[][] = [];
    const store = {
      listResources: async () => users,
      saveResource: async (...args: unknown[]) => {
        writes.push([...args, leadRequestAuditDetail({ actor_user_id: "forged" })]);
        return { id: targetId, version: 1 };
      },
    };
    const response = await handleLeadPlus(
      linkRequest({ auth_user_id: targetId, role: "manager" }),
      "/crm-users/link",
      identity,
      { store, resolveViewTarget: resolver },
    );
    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual([
      "users",
      targetId,
      {
        auth_user_id: targetId,
        email: `${targetId}@example.test`,
        name: `${targetId}@example.test`,
        phone: "",
        team: "",
        active: true,
        role: "manager",
      },
      undefined,
      expect.objectContaining({
        auth_user_id: identity.id,
        actor_user_id: "admin",
        viewed_user_id: "admin",
        impersonating: false,
      }),
    ]);
  });
  it("denies linking under view-as or with missing canonical management grants", async () => {
    let writes = 0;
    const store = {
      listResources: async () => users,
      saveResource: async () => {
        writes++;
      },
    };
    expect(
      (
        await handleLeadPlus(
          linkRequest({ auth_user_id: targetId, role: "broker" }, "broker-a"),
          "/crm-users/link",
          identity,
          { store, resolveViewTarget: resolver },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleLeadPlus(
          linkRequest({ auth_user_id: targetId, role: "broker" }),
          "/crm-users/link",
          { ...identity, canonicalPermissions: ["crm.leads.settings.manage"] },
          { store, resolveViewTarget: resolver },
        )
      ).status,
    ).toBe(403);
    expect(writes).toBe(0);
  });
  it("rejects forged names, invalid roles and stale membership versions without mutations", async () => {
    let writes = 0;
    const existing = { ...users[3], id: targetId, auth_user_id: targetId, version: 2 };
    const store = {
      listResources: async () => [...users, existing],
      saveResource: async () => {
        writes++;
      },
    };
    for (const input of [
      { auth_user_id: targetId, role: "broker", name: "client supplied" },
      { auth_user_id: targetId, role: "master" },
      { auth_user_id: targetId, role: "broker", version: 1 },
    ]) {
      const response = await handleLeadPlus(linkRequest(input), "/crm-users/link", identity, {
        store,
        resolveViewTarget: resolver,
      });
      expect([409, 422]).toContain(response.status);
    }
    expect(writes).toBe(0);
  });
});
