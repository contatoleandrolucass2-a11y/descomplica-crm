import { describe, expect, it, vi } from "vitest";
import { operationPage, operationPermissions } from "../lib/crm/lead-plus/server/access.mjs";
import { postgresStore } from "../lib/crm/lead-plus/server/postgres.mjs";

describe("WhatsApp reuses granular CRM authorization without widening existing operations", () => {
  it("keeps connection configuration on the canonical settings page", () => {
    expect(operationPage("/whatsapp/accounts", "GET")).toBe("/app/leads/configuracoes");
    expect(operationPermissions("/whatsapp/accounts", "POST")).toEqual([
      "crm.leads.settings.manage",
    ]);
  });
  it("requires message permission independently from access to the lead list", () => {
    expect(operationPage("/whatsapp/conversations/example/messages", "POST")).toBe(
      "/app/leads/lista",
    );
    expect(operationPermissions("/whatsapp/conversations/example/messages", "POST")).toEqual([
      "crm.leads.messages.manage",
    ]);
    expect(operationPermissions("/whatsapp/conversations/example/media", "POST")).toEqual([
      "crm.leads.messages.manage",
    ]);
  });
  it("requires assignment rights for claim and transfer and commercial rights for stage updates", () => {
    expect(operationPermissions("/whatsapp/conversations/example/claim", "POST")).toEqual([
      "crm.leads.assign",
      "crm.leads.distribution.assign",
    ]);
    expect(operationPermissions("/whatsapp/conversations/example/transfer", "POST")).toEqual([
      "crm.leads.assign",
      "crm.leads.distribution.assign",
    ]);
    expect(operationPermissions("/whatsapp/conversations/example", "PATCH")).toEqual([
      "crm.leads.edit",
      "crm.leads.stage.move",
    ]);
  });
  it("fails closed for unknown operations and does not repurpose Facebook campaign permissions", () => {
    expect(operationPage("/whatsapp/secrets", "GET")).toBeNull();
    expect(operationPermissions("/whatsapp/conversations/example/delete", "POST")).toBeNull();
    expect(operationPermissions("/integrations/facebook/campaigns", "PUT")).toEqual([
      "crm.leads.settings.manage",
    ]);
  });
  it("keeps WhatsApp assignment inside its atomic conversation workflow", async () => {
    const existing = {
      id: "lead-one",
      source: "whatsapp",
      owner_id: "broker-one",
      stage: 0,
      version: 1,
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT * FROM c2s_app.leads")) return { rows: [existing] };
      if (sql.includes("FROM c2s_app.resources"))
        return { rows: [{ id: "broker-two", data: { active: true }, version: 1 }] };
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const store = postgresStore({
      query,
      connect: vi.fn().mockResolvedValue(client),
    }) as unknown as {
      updateLead(id: string, input: object, actor: object): Promise<unknown>;
      claimBucketLead(id: string, input: object): Promise<unknown>;
    };
    await expect(
      store.updateLead(
        "lead-one",
        { owner_id: "broker-two", version: 1 },
        { id: "admin", canManage: true },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.claimBucketLead("lead-one", { owner_id: "broker-two", version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE c2s_app.leads"))).toBe(false);
  });
});
