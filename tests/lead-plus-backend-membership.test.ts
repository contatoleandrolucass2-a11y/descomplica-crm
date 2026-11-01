import { describe, it, expect } from "vitest";
import { membershipSession, handleLeadPlus } from "../lib/crm/lead-plus/server/runtime.mjs";
const identity = { id: "auth-1", email: "synthetic@example.invalid", token: "synthetic-session" };
const membership = {
  id: "operational-1",
  auth_user_id: "auth-1",
  role: "admin",
  active: true,
  name: "Synthetic",
};
describe("LEAD+ host membership", () => {
  it("requires an explicit unique active membership instead of inferring the CRM role", () => {
    for (const users of [
      [],
      [{ ...membership, role: "master" }],
      [{ ...membership, active: false }],
      [{ ...membership, auth_user_id: undefined, email: identity.email }],
      [membership, membership],
    ]) {
      expect(() => membershipSession(users, identity)).toThrow();
    }
    const result = membershipSession([membership], identity) as {
      preview: boolean;
      user: { id: string; scope: string; role: string };
      csrf: string;
    };
    expect(result.preview).toBe(false);
    expect(result.user).toMatchObject({ id: "operational-1", role: "admin", scope: "all" });
    expect(result.csrf).not.toContain(identity.token);
  });
  it("bounds managers to configured teams and brokers to themselves", () => {
    expect(membershipSession([{ ...membership, role: "manager" }], identity)).toMatchObject({
      user: { scope: "self", c2s_flags: { is_master: false } },
    });
    const manager = membershipSession(
      [{ ...membership, role: "manager", team: "Synthetic team" }],
      identity,
    ) as { user: { scope: string } };
    expect(manager.user.scope).toBe("team");
    const broker = membershipSession([{ ...membership, role: "broker" }], identity) as {
      user: { scope: string };
    };
    expect(broker.user.scope).toBe("self");
  });
  it("serves session from host context and never exposes local preview or user switching", async () => {
    const store = { listResources: async () => [membership] };
    const response = await handleLeadPlus(
      new Request("https://crm.example.invalid/app/leads/backend/session"),
      "/session",
      identity,
      { store },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preview: false,
      mode: "supabase-auth",
      user: { id: "operational-1" },
    });
    const unavailable = await handleLeadPlus(
      new Request("https://crm.example.invalid"),
      "/demo/user",
      identity,
      { store },
    );
    expect(unavailable.status).toBe(404);
    const denied = await handleLeadPlus(
      new Request("https://crm.example.invalid"),
      "/session",
      identity,
      { store: { listResources: async () => [] } },
    );
    expect(denied.status).toBe(403);
  });
});

it("removes revoked canonical mutation capabilities from the actual session", () => {
  const result = membershipSession([membership], {
    ...identity,
    authorizedPages: ["/app/leads/lista", "/app/leads/configuracoes", "/app/leads/relatorios"],
    canonicalPermissions: ["crm.leads.list.view"],
  }) as { user: { permissions: string[] } };
  expect(result.user.permissions).toContain("leads.view");
  expect(result.user.permissions).not.toContain("leads.create");
  expect(result.user.permissions).not.toContain("users.manage");
  expect(result.user.permissions).not.toContain("reports.export");
});

it("denies other users' private resources before a write or delete reaches the store", async () => {
  let mutations = 0;
  const store = {
    listResources: async () => [membership],
    saveResource: async () => {
      mutations++;
    },
    deleteResource: async () => {
      mutations++;
    },
  };
  for (const kind of ["profile", "templates", "training", "exports", "lead-preferences"]) {
    for (const method of ["PUT", "DELETE"]) {
      const path = "/resources/" + kind + "/other-user";
      const response = await handleLeadPlus(
        new Request("https://crm.example.invalid" + path, {
          method,
          ...(method === "PUT" ? { body: "{}" } : {}),
        }),
        path,
        identity,
        { store },
      );
      expect(response.status).toBe(403);
    }
  }
  expect(mutations).toBe(0);
});

it("persists the current user's export history and training completion after canonical authorization", async () => {
  const allowedIdentity = {
    ...identity,
    authorizedPages: ["/app/leads/lista", "/app/leads/relatorios"],
    canonicalPermissions: ["crm.leads.edit", "crm.leads.export", "crm.leads.reports.export"],
  };
  const session = membershipSession([membership], allowedIdentity) as { csrf: string };
  const saved: string[] = [];
  const store = {
    listResources: async () => [membership],
    saveResource: async (kind: string, id: string) => {
      saved.push(kind + ":" + id);
      return { version: 1 };
    },
  };
  for (const kind of ["exports", "training"]) {
    const path = "/resources/" + kind + "/" + membership.id;
    const response = await handleLeadPlus(
      new Request("https://crm.example.invalid" + path, {
        method: "PUT",
        headers: { "x-c2s-csrf": session.csrf },
        body: JSON.stringify(
          kind === "exports" ? { items: [] } : { completed: ["Synthetic lesson"] },
        ),
      }),
      path,
      allowedIdentity,
      { store },
    );
    expect(response.status).toBe(200);
  }
  expect(saved).toEqual(["exports:" + membership.id, "training:" + membership.id]);
});
