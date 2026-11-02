import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  handleWhatsAppRequest,
  receiveWhatsAppWebhook,
  tickWhatsApp,
  whatsappCapabilities,
  whatsappScope,
} from "../lib/crm/lead-plus/server/whatsapp-runtime.mjs";
import {
  decryptWhatsAppCredential,
  encryptWhatsAppCredential,
} from "../lib/crm/lead-plus/server/whatsapp-cloud.mjs";

const organization = "descomplica";
const accountId = "account-one";
const userId = "member-one";
const conversationId = "conversation-one";
const messageId = "message-one";
const clientId = "00000000-0000-4000-8000-000000000001";
const grants = [
  "crm.leads.settings.manage",
  "crm.leads.assign",
  "crm.leads.distribution.assign",
  "crm.leads.messages.manage",
  "crm.leads.edit",
  "crm.leads.close",
  "crm.leads.reports.view",
];
const env = {
  NODE_ENV: "test" as const,
  WHATSAPP_ORGANIZATION_ID: organization,
  WHATSAPP_CREDENTIAL_KEY: Buffer.alloc(32, 23).toString("base64"),
  WHATSAPP_APP_ID: "123456",
  WHATSAPP_APP_SECRET: "synthetic-webhook-secret",
};
const credentials = {
  access_token: "synthetic-dedicated-token-never-echo",
  verify_token: "synthetic-verify-token-at-least-32-characters",
};
const account = () => ({
  id: accountId,
  organization_id: organization,
  app_id: "123456",
  waba_id: "234567",
  phone_number_id: "345678",
  enabled: true,
  graph_version: "v26.0",
  version: 1,
  secret_ciphertext: encryptWhatsAppCredential(
    JSON.stringify(credentials),
    env.WHATSAPP_CREDENTIAL_KEY,
    organization + ":" + accountId,
  ),
});
const conversation = () => ({
  id: conversationId,
  organization_id: organization,
  account_id: accountId,
  assigned_user_id: userId,
  status: "active",
  version: 1,
  last_customer_message_at: new Date(Date.now() - 1000).toISOString(),
  phone: "+5511999999999",
});
function harness(overrides: Record<string, unknown> = {}) {
  const currentAccount = account();
  const currentConversation = conversation();
  const cloudClient = {
    numberStatus: vi
      .fn()
      .mockResolvedValue({ id: "345678", display_phone_number: "+5511888888888" }),
    templates: vi.fn().mockResolvedValue([]),
    send: vi.fn().mockResolvedValue({ whatsapp_message_id: "wamid.OUTBOUND" }),
    uploadMedia: vi.fn(),
    downloadMedia: vi.fn(),
  };
  const store = {
    accounts: vi.fn().mockResolvedValue([currentAccount]),
    account: vi.fn().mockResolvedValue(currentAccount),
    accountsForWebhook: vi.fn().mockResolvedValue([currentAccount]),
    saveAccount: vi
      .fn()
      .mockImplementation(async (_organization, input) => ({ ...input, version: 2 })),
    conversation: vi.fn().mockResolvedValue(currentConversation),
    conversations: vi.fn().mockResolvedValue({ data: [] }),
    queueMessage: vi.fn().mockResolvedValue({ id: messageId, delivery_status: "queued" }),
    beginSend: vi.fn().mockResolvedValue({
      id: messageId,
      delivery_status: "sending",
      send_allowed: true,
      organization_id: organization,
      lease_token: "lease",
      account: currentAccount,
      conversation: currentConversation,
      wa_id: "5511999999999",
      type: "text",
      content: { type: "text", text: "Persisted message" },
    }),
    finishSend: vi.fn().mockResolvedValue({ updated: true, delivery_status: "sent" }),
    claim: vi.fn().mockResolvedValue({ id: conversationId, status: "active" }),
    move: vi.fn(),
    enqueueEvents: vi
      .fn()
      .mockImplementation(async (_account, events) => ({ accepted: events.length })),
    events: vi.fn().mockResolvedValue({ data: [], cursor: "42" }),
    leaseEvents: vi.fn().mockResolvedValue([]),
    processEvent: vi.fn(),
    failEvent: vi.fn(),
    recoverOutbox: vi.fn(),
    ...overrides,
  };
  const session = {
    user: { id: userId, role: "admin", team: "" },
    actor: { id: userId, role: "admin" },
    csrf: "synthetic-csrf",
    view_as: { active: false },
  };
  const identity = { canonicalPermissions: [...grants] };
  const users = [
    { id: userId, role: "admin", active: true, organization_id: organization, name: "Admin" },
  ];
  const context = {
    session,
    identity,
    users,
    store,
    env,
    cloud: vi.fn().mockReturnValue(cloudClient),
  };
  return { context, store, cloudClient, currentAccount, currentConversation };
}
function request(path: string, method = "GET", body?: unknown, csrf = "synthetic-csrf") {
  return new Request("https://crm.descomplicapro.com.br/app/leads/backend" + path, {
    method,
    headers: { "content-type": "application/json", "x-c2s-csrf": csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function result(response: Promise<Response>) {
  const value = await response;
  return { status: value.status, body: await value.json() };
}

describe("WhatsApp runtime authorization", () => {
  it("rejects a missing session and checks CSRF before any mutation reads or writes", async () => {
    const { context, store } = harness();
    const invalid = await result(
      handleWhatsAppRequest(
        request("/whatsapp/accounts", "POST", {}, "wrong"),
        "/whatsapp/accounts",
        context,
      ),
    );
    expect(invalid.status).toBe(403);
    expect(store.account).not.toHaveBeenCalled();
    expect(store.saveAccount).not.toHaveBeenCalled();
    expect(
      (
        await result(
          handleWhatsAppRequest(request("/whatsapp/session"), "/whatsapp/session", {
            ...context,
            session: null,
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("intersects original and viewed canonical rights and never allows configuration while viewing another user", () => {
    const { context } = harness();
    const viewed = { canonicalPermissions: ["crm.leads.assign"] };
    const caps = whatsappCapabilities(
      { ...context.session, view_as: { active: true } },
      context.identity,
      viewed,
    );
    expect(caps).toMatchObject({
      can_configure: false,
      can_claim: false,
      can_send: false,
      can_edit: false,
      can_supervise: false,
    });
    expect(
      whatsappCapabilities(context.session, context.identity, { canonicalPermissions: grants }),
    ).toMatchObject({ can_configure: true, can_claim: true, can_send: true });
  });

  it("binds organization to server configuration and scopes a manager only to its actual team", () => {
    const { context } = harness();
    const users = [
      { id: userId, role: "manager", active: true, team: "A", organization_id: organization },
      { id: "broker-A", role: "broker", active: true, team: "A", organization_id: organization },
      { id: "broker-B", role: "broker", active: true, team: "B", organization_id: organization },
      { id: "other-org", role: "broker", active: true, team: "A", organization_id: "other" },
    ];
    const scope = whatsappScope(context.session, users, env);
    expect(scope).toMatchObject({
      organization_id: organization,
      all: false,
      allowed_user_ids: [userId, "broker-A"],
    });
    expect(() =>
      whatsappScope(context.session, [{ ...users[0], organization_id: "other" }], env),
    ).toThrow("não autorizado");
    expect(() => whatsappScope(context.session, users, { NODE_ENV: "test" })).toThrow(
      "não configurada",
    );
  });

  it("reports no configuration without server prerequisites and never accesses the database", async () => {
    const { context, store, cloudClient } = harness();
    const output = await result(
      handleWhatsAppRequest(request("/whatsapp/accounts"), "/whatsapp/accounts", {
        ...context,
        env: {},
      }),
    );
    expect(output).toEqual({ status: 200, body: { data: [], configuration_available: false } });
    expect(store.accounts).not.toHaveBeenCalled();
    expect(cloudClient.numberStatus).not.toHaveBeenCalled();
  });

  it("does not echo encrypted or plaintext credentials when listing accounts", async () => {
    const { context, currentAccount } = harness();
    const output = await result(
      handleWhatsAppRequest(request("/whatsapp/accounts"), "/whatsapp/accounts", context),
    );
    expect(output.status).toBe(200);
    expect(JSON.stringify(output.body)).not.toContain(currentAccount.secret_ciphertext);
    expect(JSON.stringify(output.body)).not.toContain(credentials.access_token);
    expect(JSON.stringify(output.body)).not.toContain(credentials.verify_token);
  });

  it("encrypts credentials at rest and saves a new number disabled until validation", async () => {
    const { context, store, cloudClient } = harness();
    const input = {
      app_id: "123456",
      waba_id: "234567",
      phone_number_id: "345678",
      graph_version: "v26.0",
      ...credentials,
    };
    const output = await result(
      handleWhatsAppRequest(
        request("/whatsapp/accounts", "POST", input),
        "/whatsapp/accounts",
        context,
      ),
    );
    expect(output.status).toBe(201);
    const saved = store.saveAccount.mock.calls[0]![1];
    expect(saved).toMatchObject({ enabled: false, connection_status: "pending_validation" });
    expect(
      JSON.parse(
        decryptWhatsAppCredential(
          saved.secret_ciphertext,
          env.WHATSAPP_CREDENTIAL_KEY,
          organization + ":" + saved.id,
        ),
      ),
    ).toEqual(credentials);
    expect(JSON.stringify(output.body)).not.toContain(credentials.access_token);
    expect(cloudClient.numberStatus).not.toHaveBeenCalled();
  });

  it.each(["waba_id", "phone_number_id"])(
    "preserves existing account identity when an edit attempts to change %s",
    async (field) => {
      const { context, store } = harness();
      const input = {
        id: accountId,
        app_id: "123456",
        waba_id: "234567",
        phone_number_id: "345678",
        graph_version: "v26.0",
        version: 1,
        [field]: "999999",
      };
      const output = await result(
        handleWhatsAppRequest(
          request("/whatsapp/accounts", "POST", input),
          "/whatsapp/accounts",
          context,
        ),
      );
      expect(output.status).toBe(409);
      expect(output.body.error).toContain("nova conta");
      expect(store.saveAccount).not.toHaveBeenCalled();
    },
  );

  it("validates exact phone/WABA through the cloud service before enabling and honors version conflicts", async () => {
    const { context, store, cloudClient } = harness();
    const path = "/whatsapp/accounts/account-one/validate";
    const conflict = await result(
      handleWhatsAppRequest(request(path, "POST", { version: 99 }), path, context),
    );
    expect(conflict.status).toBe(409);
    expect(cloudClient.numberStatus).not.toHaveBeenCalled();
    const good = await result(
      handleWhatsAppRequest(request(path, "POST", { version: 1 }), path, context),
    );
    expect(good.status).toBe(200);
    expect(cloudClient.numberStatus).toHaveBeenCalledWith("345678", "234567");
    expect(store.saveAccount.mock.calls[0]![1]).toMatchObject({
      enabled: true,
      connection_status: "number_validated",
    });
  });

  it("rejects claim and transfer beyond the original/viewed grants or eligible users", async () => {
    const { context, store } = harness();
    const claim = "/whatsapp/conversations/conversation-one/claim";
    const denied = await result(
      handleWhatsAppRequest(request(claim, "POST", { version: 1 }), claim, {
        ...context,
        identity: { canonicalPermissions: ["crm.leads.assign"] },
      }),
    );
    expect(denied.status).toBe(403);
    expect(store.claim).not.toHaveBeenCalled();
    const transfer = "/whatsapp/conversations/conversation-one/transfer";
    expect(
      (
        await result(
          handleWhatsAppRequest(
            request(transfer, "POST", { version: 1, target_user_id: "other-org" }),
            transfer,
            context,
          ),
        )
      ).status,
    ).toBe(403);
    expect(store.move).not.toHaveBeenCalled();
  });

  it("normalizes the durable event cursor without widening the storage scope", async () => {
    const { context, store } = harness();
    const output = await result(
      handleWhatsAppRequest(request("/whatsapp/events?after=10"), "/whatsapp/events", context),
    );
    expect(output.body).toMatchObject({ cursor: "42", next_cursor: "42" });
    expect(store.events.mock.calls[0]![0]).toMatchObject({
      organization_id: organization,
      user_id: userId,
    });
    expect(store.events.mock.calls[0]![1]).toEqual({ after: "10", limit: 100 });
  });
});

describe("WhatsApp runtime durable outbound dispatch", () => {
  const path = "/whatsapp/conversations/conversation-one/messages";
  it("requires the currently assigned user before persisting or sending", async () => {
    const { context, store, cloudClient } = harness({
      conversation: vi.fn().mockResolvedValue({ ...conversation(), assigned_user_id: "other" }),
    });
    expect(
      (
        await result(
          handleWhatsAppRequest(
            request(path, "POST", { client_message_id: clientId, type: "text", text: "Hello" }),
            path,
            context,
          ),
        )
      ).status,
    ).toBe(403);
    expect(store.queueMessage).not.toHaveBeenCalled();
    expect(cloudClient.send).not.toHaveBeenCalled();
  });

  it("persists the request body for content-bound idempotency and dispatches only the leased persisted payload", async () => {
    const { context, store, cloudClient } = harness();
    const output = await result(
      handleWhatsAppRequest(
        request(path, "POST", {
          client_message_id: clientId,
          type: "text",
          text: "Persisted message",
        }),
        path,
        context,
      ),
    );
    expect(output.status).toBe(200);
    expect(store.queueMessage.mock.calls[0]![2]).toMatchObject({
      client_message_id: clientId,
      type: "text",
      content: { type: "text", text: "Persisted message" },
    });
    expect(cloudClient.send).toHaveBeenCalledWith("345678", "5511999999999", {
      type: "text",
      text: { body: "Persisted message", preview_url: false },
    });
    expect(store.queueMessage.mock.invocationCallOrder[0]).toBeLessThan(
      store.beginSend.mock.invocationCallOrder[0]!,
    );
    expect(store.beginSend.mock.invocationCallOrder[0]).toBeLessThan(
      cloudClient.send.mock.invocationCallOrder[0]!,
    );
  });

  it("does not use a changed incoming body when the durable lease has the original body", async () => {
    const { context, cloudClient } = harness();
    await result(
      handleWhatsAppRequest(
        request(path, "POST", {
          client_message_id: clientId,
          type: "text",
          text: "Changed incoming message",
        }),
        path,
        context,
      ),
    );
    expect(cloudClient.send.mock.calls[0]![2]).toMatchObject({
      text: { body: "Persisted message" },
    });
  });

  it.each(["sent", "delivered", "read", "uncertain", "sending"])(
    "does not resend a persisted %s message",
    async (delivery_status) => {
      const { context, store, cloudClient } = harness({
        queueMessage: vi.fn().mockResolvedValue({ id: messageId, delivery_status }),
      });
      expect(
        (
          await result(
            handleWhatsAppRequest(
              request(path, "POST", {
                client_message_id: clientId,
                type: "text",
                text: "Persisted message",
              }),
              path,
              context,
            ),
          )
        ).status,
      ).toBe(200);
      expect(store.beginSend).not.toHaveBeenCalled();
      expect(cloudClient.send).not.toHaveBeenCalled();
    },
  );

  it("honors a storage conflict for an idempotency key reused with different contents", async () => {
    const { context, cloudClient, store } = harness({
      queueMessage: vi.fn().mockRejectedValue(
        Object.assign(Error("Identificador de mensagem já utilizado com outro conteúdo."), {
          status: 409,
        }),
      ),
    });
    expect(
      (
        await result(
          handleWhatsAppRequest(
            request(path, "POST", { client_message_id: clientId, type: "text", text: "Changed" }),
            path,
            context,
          ),
        )
      ).status,
    ).toBe(409);
    expect(store.beginSend).not.toHaveBeenCalled();
    expect(cloudClient.send).not.toHaveBeenCalled();
  });

  it("does not send when another concurrent request has already leased the outbox row", async () => {
    const { context, cloudClient } = harness({
      beginSend: vi.fn().mockResolvedValue({ send_allowed: false, delivery_status: "sending" }),
    });
    await result(
      handleWhatsAppRequest(
        request(path, "POST", {
          client_message_id: clientId,
          type: "text",
          text: "Persisted message",
        }),
        path,
        context,
      ),
    );
    expect(cloudClient.send).not.toHaveBeenCalled();
  });

  it("checks the latest leased inbound window before making any Meta send", async () => {
    const { context, store, cloudClient } = harness({
      beginSend: vi.fn().mockResolvedValue({
        id: messageId,
        send_allowed: true,
        organization_id: organization,
        lease_token: "lease",
        account: account(),
        conversation: {
          ...conversation(),
          last_customer_message_at: new Date(Date.now() - 86400001).toISOString(),
        },
        wa_id: "5511999999999",
        type: "text",
        content: { type: "text", text: "Persisted message" },
      }),
    });
    expect(
      (
        await result(
          handleWhatsAppRequest(
            request(path, "POST", {
              client_message_id: clientId,
              type: "text",
              text: "Persisted message",
            }),
            path,
            context,
          ),
        )
      ).status,
    ).toBe(502);
    expect(cloudClient.send).not.toHaveBeenCalled();
    expect(store.finishSend.mock.calls[0]![1]).toMatchObject({
      ambiguous: false,
      error_code: "WHATSAPP_WINDOW_CLOSED",
    });
  });

  it("uses the freshly leased account rather than a stale pre-queue credential", async () => {
    const { context, cloudClient } = harness({
      beginSend: vi.fn().mockResolvedValue({
        id: messageId,
        send_allowed: true,
        organization_id: organization,
        lease_token: "lease",
        account: { ...account(), version: 9 },
        conversation: conversation(),
        wa_id: "5511999999999",
        type: "text",
        content: { type: "text", text: "Persisted message" },
      }),
    });
    await result(
      handleWhatsAppRequest(
        request(path, "POST", {
          client_message_id: clientId,
          type: "text",
          text: "Persisted message",
        }),
        path,
        context,
      ),
    );
    expect(context.cloud.mock.calls.at(-1)![0]).toMatchObject({ version: 9 });
    expect(cloudClient.send).toHaveBeenCalledTimes(1);
  });

  it("marks uncertain network results without retrying the Meta send", async () => {
    const { context, cloudClient, store } = harness();
    cloudClient.send.mockRejectedValueOnce(
      Object.assign(Error("sanitized upstream error"), {
        code: "WHATSAPP_NETWORK_UNCERTAIN",
        ambiguous: true,
      }),
    );
    const output = await result(
      handleWhatsAppRequest(
        request(path, "POST", {
          client_message_id: clientId,
          type: "text",
          text: "Persisted message",
        }),
        path,
        context,
      ),
    );
    expect(output.status).toBe(502);
    expect(cloudClient.send).toHaveBeenCalledTimes(1);
    expect(store.finishSend.mock.calls[0]![1]).toMatchObject({
      ambiguous: true,
      error_code: "WHATSAPP_NETWORK_UNCERTAIN",
    });
  });
});

describe("WhatsApp runtime public webhook and durable inbound work", () => {
  const webhook = (body: unknown, signature?: string) => {
    const raw = JSON.stringify(body);
    return new Request("https://crm.descomplicapro.com.br/api/integrations/whatsapp/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "x-hub-signature-256":
          signature ??
          "sha256=" + createHmac("sha256", env.WHATSAPP_APP_SECRET).update(raw).digest("hex"),
      },
    });
  };
  const body = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "234567",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "345678" },
              messages: [
                {
                  id: "wamid.INBOUND",
                  from: "5511999999999",
                  type: "text",
                  text: { body: "Olá" },
                  timestamp: "1793556000",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it("rejects an invalid signature before any database access", async () => {
    const { store } = harness();
    const output = await result(
      receiveWhatsAppWebhook(webhook(body, "sha256=" + "0".repeat(64)), { store, env }),
    );
    expect(output.status).toBe(401);
    expect(store.accounts).not.toHaveBeenCalled();
    expect(store.enqueueEvents).not.toHaveBeenCalled();
  });

  it("persists provider events before acknowledging and lets durable deduplication handle redelivery", async () => {
    const seen = new Set<string>();
    const { store } = harness({
      enqueueEvents: vi.fn().mockImplementation(async (_account, events) => {
        let accepted = 0;
        for (const event of events)
          if (!seen.has(event.provider_event_key)) {
            seen.add(event.provider_event_key);
            accepted++;
          }
        return { accepted };
      }),
    });
    expect(await result(receiveWhatsAppWebhook(webhook(body), { store, env }))).toEqual({
      status: 200,
      body: { accepted: 1 },
    });
    expect(await result(receiveWhatsAppWebhook(webhook(body), { store, env }))).toEqual({
      status: 200,
      body: { accepted: 0 },
    });
    expect(store.enqueueEvents.mock.calls[0]![1][0]).toMatchObject({
      kind: "message",
      account_id: accountId,
      organization_id: organization,
    });
    expect(store.processEvent).not.toHaveBeenCalled();
  });

  it("does not acknowledge a persistence failure and ignores another WABA", async () => {
    const { store } = harness({
      enqueueEvents: vi.fn().mockRejectedValue(Error("database unavailable")),
    });
    expect((await result(receiveWhatsAppWebhook(webhook(body), { store, env }))).status).toBe(503);
    const other = structuredClone(body);
    other.entry[0]!.id = "999999";
    expect(await result(receiveWhatsAppWebhook(webhook(other), { store, env }))).toEqual({
      status: 200,
      body: { accepted: 0 },
    });
  });

  it("verifies the callback against decrypted server credentials without returning them", async () => {
    const { store } = harness();
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": credentials.verify_token,
      "hub.challenge": "12345",
    });
    const response = await receiveWhatsAppWebhook(
      new Request("https://crm.descomplicapro.com.br/api/integrations/whatsapp/webhook?" + params),
      { store, env },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("drains only leased durable jobs, retains failures, and recovers uncertain outbox without sending", async () => {
    const jobs = [{ id: "event-one" }, { id: "event-two" }];
    const { store } = harness({
      leaseEvents: vi.fn().mockResolvedValue(jobs),
      processEvent: vi
        .fn()
        .mockResolvedValueOnce({ processed: true })
        .mockRejectedValueOnce(
          Object.assign(Error("sanitized failure"), { code: "WHATSAPP_TEST_FAILURE" }),
        ),
    });
    await tickWhatsApp(store);
    expect(store.leaseEvents).toHaveBeenCalledWith(25);
    expect(store.processEvent).toHaveBeenCalledTimes(2);
    expect(store.failEvent).toHaveBeenCalledWith(jobs[1], "WHATSAPP_TEST_FAILURE");
    expect(store.recoverOutbox).toHaveBeenCalledTimes(1);
    expect(store.queueMessage).not.toHaveBeenCalled();
  });
});

it("revalidates the recipient's current CRM access before a supervisor transfer", async () => {
  const { context, store } = harness();
  const target = {
    ...context.users[0]!,
    id: "member-two",
    auth_user_id: "auth-two",
    role: "broker",
  };
  context.users.push(target);
  const resolveRecipient = vi
    .fn()
    .mockResolvedValue({
      id: "auth-two",
      canonicalPermissions: [],
      authorizedPages: ["/app/leads/lista"],
    });
  const route = "/whatsapp/conversations/conversation-one/transfer";
  const body = { version: 1, target_user_id: "member-two" };
  const transferred = {
    id: conversationId,
    assigned_user_id: target.id,
    status: "active",
    version: 2,
  };
  store.move.mockResolvedValue(transferred);
  const currentContext = { ...context, resolveRecipient };
  expect(
    (await handleWhatsAppRequest(request(route, "POST", body), route, currentContext)).status,
  ).toBe(403);
  expect(store.move).not.toHaveBeenCalled();
  resolveRecipient.mockResolvedValue({
    id: "auth-two",
    canonicalPermissions: grants,
    authorizedPages: ["/app/leads/lista"],
  });
  expect(
    (await handleWhatsAppRequest(request(route, "POST", body), route, currentContext)).status,
  ).toBe(200);
  expect(resolveRecipient).toHaveBeenCalledWith("auth-two");
});
