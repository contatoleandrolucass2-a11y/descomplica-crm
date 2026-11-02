import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createWhatsAppCloudClient,
  decryptWhatsAppCredential,
  encryptWhatsAppCredential,
  isWhatsAppServiceWindowOpen,
  normalizeWhatsAppOutbound,
  parseWhatsAppWebhook,
  validWhatsAppSignature,
  validateWhatsAppMedia,
  verifyWhatsAppChallenge,
  type WhatsAppAccount,
  type WhatsAppTemplate,
} from "../lib/crm/lead-plus/server/whatsapp-cloud.mjs";

const key = Buffer.alloc(32, 13).toString("base64");
const account: WhatsAppAccount = {
  id: "account-one",
  organization_id: "organization-one",
  waba_id: "100",
  phone_number_id: "200",
  enabled: true,
};
const message = {
  id: "wamid.TEST=",
  timestamp: "1793556000",
  from: "5511999999999",
  type: "text",
  text: { body: "Olá" },
};
const payload = (value: Record<string, unknown>, waba = "100", phoneId = "200") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: waba,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: phoneId },
            ...value,
          },
        },
      ],
    },
  ],
});
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const template: WhatsAppTemplate = {
  id: "300",
  name: "atendimento",
  language: "pt_BR",
  status: "APPROVED",
  category: "UTILITY",
  components: [{ type: "BODY", text: "Olá {{1}}, seu retorno é {{2}}." }],
};
const now = Date.parse("2026-11-01T18:00:00Z");
const recent = new Date(now - 1000).toISOString();

describe("WhatsApp signed provider protocol", () => {
  it("accepts only a matching raw-body HMAC and rejects altered or malformed signatures", () => {
    const raw = JSON.stringify(payload({ messages: [message] }));
    const signature =
      "sha256=" + createHmac("sha256", "private-app-secret").update(raw).digest("hex");
    expect(validWhatsAppSignature(raw, signature, "private-app-secret")).toBe(true);
    expect(validWhatsAppSignature(raw + " ", signature, "private-app-secret")).toBe(false);
    for (const invalid of [
      null,
      "",
      "sha256=short",
      "sha1=" + "a".repeat(64),
      "sha256=" + "A".repeat(64),
    ])
      expect(validWhatsAppSignature(raw, invalid, "private-app-secret")).toBe(false);
    expect(validWhatsAppSignature(raw, signature, "")).toBe(false);
  });

  it("returns only a verified challenge with a bounded value", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "private",
      "hub.challenge": "12345",
    });
    expect(verifyWhatsAppChallenge(params, "private")).toBe("12345");
    expect(() => verifyWhatsAppChallenge(params, "other")).toThrow("recusada");
    params.set("hub.challenge", "<script>");
    expect(() => verifyWhatsAppChallenge(params, "private")).toThrow("recusada");
  });

  it("normalizes an inbound message without inventing attribution or persisting an entire payload", () => {
    const [event] = parseWhatsAppWebhook(
      payload({
        messages: [
          {
            ...message,
            referral: {
              source_id: "567",
              source_type: "ad",
              ctwa_clid: "click-id",
              extra_private: "discarded",
            },
          },
        ],
        contacts: [{ wa_id: message.from, profile: { name: "Cliente" } }],
      }),
      [account],
    );
    expect(event).toEqual({
      provider_event_key: "message:wamid.TEST=",
      organization_id: "organization-one",
      account_id: "account-one",
      waba_id: "100",
      phone_number_id: "200",
      kind: "message",
      timestamp: "2026-11-01T18:00:00.000Z",
      whatsapp_message_id: message.id,
      from: message.from,
      contact_name: "Cliente",
      type: "text",
      content: { text: "Olá" },
      media_id: null,
      referral: { source_id: "567", source_type: "ad", ctwa_clid: "click-id" },
    });
    expect(event).not.toHaveProperty("campaign_id");
    expect(JSON.stringify(event)).not.toContain("extra_private");
  });

  it("produces identical idempotency keys for provider redelivery", () => {
    const data = payload({ messages: [message, message] });
    const events = parseWhatsAppWebhook(data, [account]);
    expect(events[0]!.provider_event_key).toBe(events[1]!.provider_event_key);
    expect(parseWhatsAppWebhook(data, [account])).toEqual(events);
  });

  it("isolates exact WABA and phone IDs and ignores disabled accounts", () => {
    expect(parseWhatsAppWebhook(payload({ messages: [message] }, "999"), [account])).toEqual([]);
    expect(parseWhatsAppWebhook(payload({ messages: [message] }, "100", "999"), [account])).toEqual(
      [],
    );
    expect(
      parseWhatsAppWebhook(payload({ messages: [message] }), [{ ...account, enabled: false }]),
    ).toEqual([]);
    expect(() =>
      parseWhatsAppWebhook(payload({ messages: [message] }), [
        account,
        { ...account, organization_id: "other" },
      ]),
    ).toThrow("inválido");
  });

  it("keeps delivery statuses and provider timestamps so storage can reconcile out-of-order events", () => {
    const events = parseWhatsAppWebhook(
      payload({
        statuses: [
          { id: message.id, status: "read", timestamp: "1793556002", recipient_id: message.from },
          { id: message.id, status: "sent", timestamp: "1793556001", recipient_id: message.from },
          {
            id: message.id,
            status: "failed",
            timestamp: "1793556003",
            recipient_id: message.from,
            errors: [{ code: 131026, message: "private provider text" }],
          },
        ],
      }),
      [account],
    );
    expect(events.map((event) => event.status)).toEqual(["read", "sent", "failed"]);
    expect(events[0]!.provider_event_key).not.toBe(events[1]!.provider_event_key);
    expect(events[2]!.error_code).toBe(131026);
    expect(JSON.stringify(events)).not.toContain("private provider text");
  });

  it("extracts only media references and bounded content", () => {
    const [event] = parseWhatsAppWebhook(
      payload({
        messages: [
          {
            ...message,
            type: "document",
            document: {
              id: "812",
              caption: "Documento",
              filename: "arquivo.pdf",
              mime_type: "application/pdf",
              url: "https://evil.invalid",
            },
          },
        ],
      }),
      [account],
    );
    expect(event).toMatchObject({
      type: "document",
      media_id: "812",
      content: { filename: "arquivo.pdf" },
    });
    expect(event!.content).not.toHaveProperty("url");
  });

  it.each([
    {},
    { object: "page", entry: [] },
    payload({ messages: [{ ...message, from: "+5511999999999" }] }),
    payload({ messages: [{ ...message, timestamp: "not-a-time" }] }),
    payload({ messages: [{ ...message, text: { body: "x".repeat(16385) } }] }),
    payload({ messages: Array(501).fill(message) }),
  ])("rejects malformed and oversized event structures %#", (input) => {
    expect(() => parseWhatsAppWebhook(input, [account])).toThrow();
  });
});

describe("WhatsApp server credentials", () => {
  it("encrypts with randomized authenticated envelopes and binds to account/organization", () => {
    const first = encryptWhatsAppCredential("private-token", key, "org/account");
    const second = encryptWhatsAppCredential("private-token", key, "org/account");
    expect(first).not.toBe(second);
    expect(first).not.toContain("private-token");
    expect(decryptWhatsAppCredential(first, key, "org/account")).toBe("private-token");
    expect(() => decryptWhatsAppCredential(first, key, "other/account")).toThrow("indisponível");
    expect(() =>
      decryptWhatsAppCredential(first, randomBytes(32).toString("base64"), "org/account"),
    ).toThrow("indisponível");
    const pieces = first.split(".");
    pieces[2] = Buffer.alloc(16).toString("base64url");
    expect(() => decryptWhatsAppCredential(pieces.join("."), key, "org/account")).toThrow(
      "indisponível",
    );
  });

  it("rejects absent, short, hexadecimal and malformed server keys", () => {
    for (const wrong of ["", "secret", Buffer.alloc(16).toString("base64"), "a".repeat(64)])
      expect(() => encryptWhatsAppCredential("private", wrong)).toThrow("não configurado");
    expect(() => decryptWhatsAppCredential("invalid-envelope", key)).toThrow("indisponível");
  });
});

describe("WhatsApp outbound window and templates", () => {
  it("opens the customer window only for a valid past inbound message, strictly less than 24 hours", () => {
    expect(isWhatsAppServiceWindowOpen(recent, now)).toBe(true);
    expect(isWhatsAppServiceWindowOpen(new Date(now - 86400000).toISOString(), now)).toBe(false);
    expect(isWhatsAppServiceWindowOpen(new Date(now + 1).toISOString(), now)).toBe(false);
    expect(isWhatsAppServiceWindowOpen(undefined, now)).toBe(false);
    expect(isWhatsAppServiceWindowOpen("invalid", now)).toBe(false);
  });

  it("allows text only inside the customer window and disables link previews", () => {
    expect(
      normalizeWhatsAppOutbound(
        { type: "text", text: "Olá" },
        { lastCustomerMessageAt: recent, now },
      ),
    ).toEqual({ type: "text", text: { body: "Olá", preview_url: false } });
    expect(() => normalizeWhatsAppOutbound({ type: "text", text: "Olá" }, { now })).toThrow(
      "24 horas",
    );
    expect(() =>
      normalizeWhatsAppOutbound(
        { type: "text", text: " " },
        { lastCustomerMessageAt: recent, now },
      ),
    ).toThrow("inválido");
  });

  it("allows only approved exact-language templates and correctly fills body variables outside the window", () => {
    expect(
      normalizeWhatsAppOutbound(
        {
          type: "template",
          template: { name: template.name, language: "pt_BR", parameters: ["Ana", "amanhã"] },
        },
        { templates: [template], now },
      ),
    ).toEqual({
      type: "template",
      template: {
        name: "atendimento",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana" },
              { type: "text", text: "amanhã" },
            ],
          },
        ],
      },
    });
    for (const status of ["PENDING", "REJECTED", "PAUSED", "DISABLED"])
      expect(() =>
        normalizeWhatsAppOutbound(
          {
            type: "template",
            template: { name: template.name, language: "pt_BR", parameters: ["A", "B"] },
          },
          { templates: [{ ...template, status }] },
        ),
      ).toThrow("não está aprovado");
    expect(() =>
      normalizeWhatsAppOutbound(
        {
          type: "template",
          template: { name: template.name, language: "en_US", parameters: ["A", "B"] },
        },
        { templates: [template] },
      ),
    ).toThrow("não está aprovado");
  });

  it("rejects missing variables and unsupported dynamic headers/buttons/named variables", () => {
    expect(() =>
      normalizeWhatsAppOutbound(
        { type: "template", template: { name: template.name, language: "pt_BR", parameters: [] } },
        { templates: [template] },
      ),
    ).toThrow("inválido");
    for (const components of [
      [{ type: "HEADER", text: "Cabeçalho" }],
      [{ type: "BUTTONS" }],
      [{ type: "BODY", text: "Olá {{nome}}" }],
    ])
      expect(() =>
        normalizeWhatsAppOutbound(
          { type: "template", template: { name: template.name, language: "pt_BR" } },
          { templates: [{ ...template, components }] },
        ),
      ).toThrow("ainda não suportad");
  });

  it("accepts uploaded media IDs but never arbitrary remote URLs", () => {
    const options = { lastCustomerMessageAt: recent, now };
    expect(
      normalizeWhatsAppOutbound(
        { type: "document", media_id: "456", filename: "proposta.pdf", caption: "Sua proposta" },
        options,
      ),
    ).toEqual({
      type: "document",
      document: { id: "456", filename: "proposta.pdf", caption: "Sua proposta" },
    });
    expect(() =>
      normalizeWhatsAppOutbound({ type: "image", media_id: "https://evil.invalid" }, options),
    ).toThrow("inválido");
    expect(() =>
      normalizeWhatsAppOutbound(
        { type: "document", media_id: "456", filename: "../secret" },
        options,
      ),
    ).toThrow("inválido");
  });
});

describe("WhatsApp fixed-origin Cloud API transport", () => {
  it("validates number ownership and does not follow provider next URLs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          id: "200",
          display_phone_number: "+55 11 99999-9999",
          verified_name: "Negócio",
          access_token: "must-discard",
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: [{ id: "999" }],
          paging: { next: "https://evil.invalid", cursors: { after: "cursor/+" } },
        }),
      )
      .mockResolvedValueOnce(response({ data: [{ id: "200" }] }));
    const client = createWhatsAppCloudClient({ token: "private-token", fetchImpl: fetcher });
    expect(await client.numberStatus("200", "100")).toEqual({
      id: "200",
      display_phone_number: "+55 11 99999-9999",
      verified_name: "Negócio",
    });
    expect(new URL(fetcher.mock.calls[2]![0] as string).searchParams.get("after")).toBe("cursor/+");
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(url as string).origin).toBe("https://graph.facebook.com");
      expect(url).not.toContain("private-token");
      expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-token");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("rejects a number that belongs to another WABA", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ id: "200", display_phone_number: "number" }))
      .mockResolvedValueOnce(response({ data: [{ id: "999" }] }));
    await expect(
      createWhatsAppCloudClient({ token: "private-token", fetchImpl: fetcher }).numberStatus(
        "200",
        "100",
      ),
    ).rejects.toMatchObject({ code: "WHATSAPP_ACCOUNT_MISMATCH" });
  });

  it("retrieves sanitized templates including their approval state", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [{ ...template, private_field: "discard" }] }));
    expect(
      await createWhatsAppCloudClient({ token: "private", fetchImpl: fetcher }).templates("100"),
    ).toEqual([template]);
  });

  it("sends an explicit normalized message and returns only the provider ID", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          messaging_product: "whatsapp",
          messages: [{ id: message.id }],
          contacts: [{ wa_id: "private" }],
        }),
      );
    const client = createWhatsAppCloudClient({ token: "private", fetchImpl: fetcher });
    const result = await client.send(
      "200",
      message.from,
      normalizeWhatsAppOutbound(
        { type: "text", text: "Olá" },
        { lastCustomerMessageAt: recent, now },
      ),
    );
    expect(result).toEqual({ whatsapp_message_id: message.id });
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.from,
      type: "text",
      text: { body: "Olá", preview_url: false },
    });
  });

  it("flags an uncertain POST as ambiguous and never retries it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(Error("private token detail"));
    const client = createWhatsAppCloudClient({ token: "private-token", fetchImpl: fetcher });
    await expect(
      client.send("200", message.from, { type: "text", text: { body: "hello" } }),
    ).rejects.toMatchObject({
      code: "WHATSAPP_NETWORK_UNCERTAIN",
      ambiguous: true,
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sanitizes provider failures while retaining numeric diagnostics and rate-limit classification", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ error: { code: 190, error_subcode: 463, message: "private-token" } }, 401),
      )
      .mockResolvedValueOnce(response({ error: { code: 4, message: "private-token" } }, 429));
    const client = createWhatsAppCloudClient({ token: "private-token", fetchImpl: fetcher });
    await expect(client.numberStatus("200")).rejects.toMatchObject({
      providerCode: 190,
      providerSubcode: 463,
      message: "A Meta recusou a operação do WhatsApp.",
    });
    await expect(client.numberStatus("200")).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
  });

  it("rejects bad versions/IDs and oversized responses without leaking configuration", async () => {
    expect(() =>
      createWhatsAppCloudClient({ token: "private", graphVersion: "../../evil" }),
    ).toThrow("não configurada");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { headers: { "content-length": "2000000" } }));
    const client = createWhatsAppCloudClient({ token: "private", fetchImpl: fetcher });
    await expect(client.numberStatus("https://evil.invalid")).rejects.toThrow("inválido");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.numberStatus("200")).rejects.toMatchObject({
      code: "WHATSAPP_NETWORK_UNCERTAIN",
    });
  });
});

describe("WhatsApp controlled media", () => {
  it("accepts supported formats with size limits and rejects ambiguous OGG codecs", () => {
    expect(
      validateWhatsAppMedia({
        bytes: new Uint8Array(10),
        mimeType: "application/pdf",
        filename: "documento.pdf",
      }),
    ).toMatchObject({ type: "document" });
    expect(
      validateWhatsAppMedia({ bytes: new Uint8Array(10), mimeType: "audio/ogg; codecs=opus" }),
    ).toMatchObject({ type: "audio" });
    expect(() =>
      validateWhatsAppMedia({ bytes: new Uint8Array(10), mimeType: "audio/ogg" }),
    ).toThrow("Opus");
    expect(() =>
      validateWhatsAppMedia({ bytes: new Uint8Array(5 * 1024 * 1024 + 1), mimeType: "image/jpeg" }),
    ).toThrow("não suportado");
    expect(() =>
      validateWhatsAppMedia({ bytes: new Uint8Array(10), mimeType: "text/html" }),
    ).toThrow("não suportado");
  });

  it("uploads only multipart media to the fixed number endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ id: "456" }));
    const result = await createWhatsAppCloudClient({
      token: "private",
      fetchImpl: fetcher,
    }).uploadMedia("200", {
      bytes: new Uint8Array([1, 2]),
      mimeType: "application/pdf",
      filename: "arquivo.pdf",
    });
    expect(result).toEqual({
      media_id: "456",
      type: "document",
      mime_type: "application/pdf",
      filename: "arquivo.pdf",
      size: 2,
    });
    expect(fetcher.mock.calls[0]![0]).toBe("https://graph.facebook.com/v26.0/200/media");
    expect(fetcher.mock.calls[0]![1]!.body).toBeInstanceOf(FormData);
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).has("content-type")).toBe(false);
  });

  it.each([
    "http://lookaside.fbsbx.com/media",
    "https://evil.invalid/media",
    "https://fbcdn.net.evil.invalid/media",
    "https://lookaside.fbsbx.com@evil.invalid/media",
    "https://lookaside.fbsbx.com:8443/media",
    "https://127.0.0.1/media",
  ])("does not send a credential to an untrusted media origin %s", async (url) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ id: "456", url, mime_type: "application/pdf", file_size: 3 }),
      );
    await expect(
      createWhatsAppCloudClient({ token: "private-token", fetchImpl: fetcher }).downloadMedia(
        "456",
      ),
    ).rejects.toMatchObject({ code: "WHATSAPP_MEDIA_URL_INVALID" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("downloads authenticated Meta media without exposing its temporary URL and verifies digest", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          id: "456",
          url: "https://lookaside.fbsbx.com/whatsapp_business/attachments?mid=456",
          mime_type: "application/pdf",
          file_size: 3,
          sha256: createHash("sha256").update(bytes).digest("base64"),
        }),
      )
      .mockResolvedValueOnce(new Response(bytes));
    const result = await createWhatsAppCloudClient({
      token: "private-token",
      fetchImpl: fetcher,
    }).downloadMedia("456");
    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(result).not.toHaveProperty("url");
    expect(fetcher.mock.calls[1]![1]!.redirect).toBe("error");
  });

  it("rejects media whose bytes do not match the provider metadata", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          id: "456",
          url: "https://lookaside.fbsbx.com/media",
          mime_type: "application/pdf",
          file_size: 3,
          sha256: "0".repeat(64),
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    await expect(
      createWhatsAppCloudClient({ token: "private", fetchImpl: fetcher }).downloadMedia("456"),
    ).rejects.toMatchObject({ code: "WHATSAPP_MEDIA_UNAVAILABLE" });
  });
});
