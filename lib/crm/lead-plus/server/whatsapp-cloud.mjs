import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const GRAPH = "https://graph.facebook.com";
const MAX_JSON_BYTES = 1024 * 1024;
export const WHATSAPP_MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const MAX_MEDIA_BYTES = WHATSAPP_MAX_MEDIA_BYTES;
const PHONE = /^[1-9]\d{7,14}$/;
const META_ID = /^\d{1,40}$/;
const MESSAGE_ID = /^[A-Za-z0-9_.:=+/-]{1,512}$/;
const fail = (code, message, status = 422, extra = {}) =>
  Object.assign(new Error(message), { code, status, ...extra });
const invalid = () => fail("WHATSAPP_INVALID_INPUT", "Conteúdo do WhatsApp inválido.");
const text = (value, max) =>
  typeof value === "string" && value.length <= max ? value.replace(/\u0000/g, "") : null;
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const identifier = (value) => typeof value === "string" && META_ID.test(value);
const phone = (value) => typeof value === "string" && PHONE.test(value);
const secretEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
};

/** Validate the untouched request body before parsing or persisting any webhook event. */
export function validWhatsAppSignature(raw, signature, secret) {
  if (!secret || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  if (!(typeof raw === "string" || Buffer.isBuffer(raw) || raw instanceof Uint8Array)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export function verifyWhatsAppChallenge(params, verifyToken) {
  const get = (name) => (typeof params?.get === "function" ? params.get(name) : params?.[name]);
  const challenge = get("hub.challenge");
  if (
    get("hub.mode") !== "subscribe" ||
    !secretEqual(get("hub.verify_token"), verifyToken) ||
    typeof challenge !== "string" ||
    !/^[A-Za-z0-9_-]{1,512}$/.test(challenge)
  )
    throw fail("WHATSAPP_VERIFY_FAILED", "Verificação do webhook recusada.", 403);
  return challenge;
}

function credentialKey(key) {
  if (
    typeof key !== "string" ||
    !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
    Buffer.from(key, "base64").length !== 32
  )
    throw fail(
      "WHATSAPP_KEY_UNAVAILABLE",
      "Armazenamento seguro do WhatsApp não configurado.",
      503,
    );
  return Buffer.from(key, "base64");
}

/** The private key is supplied by server runtime; use organization/account IDs as context. */
export function encryptWhatsAppCredential(value, key, context = "") {
  if (typeof value !== "string" || !value || value.length > 16384 || typeof context !== "string")
    throw invalid();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(key), iv);
  cipher.setAAD(Buffer.from("descomplica-whatsapp:v1:" + context));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptWhatsAppCredential(envelope, key, context = "") {
  const bytes = credentialKey(key);
  try {
    if (typeof envelope !== "string" || envelope.length > 24000) throw Error();
    const [version, iv, tag, encrypted, extra] = envelope.split(".");
    if (version !== "v1" || extra !== undefined || !iv || !tag || !encrypted) throw Error();
    const ivBytes = Buffer.from(iv, "base64url");
    const tagBytes = Buffer.from(tag, "base64url");
    if (ivBytes.length !== 12 || tagBytes.length !== 16) throw Error();
    const decipher = createDecipheriv("aes-256-gcm", bytes, ivBytes);
    decipher.setAAD(Buffer.from("descomplica-whatsapp:v1:" + context));
    decipher.setAuthTag(tagBytes);
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw fail("WHATSAPP_CREDENTIAL_UNAVAILABLE", "Credencial do WhatsApp indisponível.", 503);
  }
}

function eventTime(value) {
  if (typeof value !== "string" || !/^\d{1,12}$/.test(value)) return null;
  const milliseconds = Number(value) * 1000;
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || milliseconds > 8640000000000000)
    return null;
  return new Date(milliseconds).toISOString();
}

function referralData(value) {
  if (!record(value)) return null;
  const result = {};
  for (const field of ["source_id", "source_type", "source_url", "headline", "body", "ctwa_clid"])
    if (text(value[field], field === "body" ? 4096 : 2048) !== null) result[field] = value[field];
  // source_id may be an advertisement, not a campaign. Never infer campaign attribution.
  return Object.keys(result).length ? result : null;
}

/** Normalize bounded signed provider events; account membership is server-controlled. */
export function parseWhatsAppWebhook(payload, accounts) {
  if (
    !record(payload) ||
    payload.object !== "whatsapp_business_account" ||
    !Array.isArray(payload.entry) ||
    payload.entry.length > 100
  )
    throw invalid();
  if (!Array.isArray(accounts) || accounts.length > 1000) throw invalid();
  const configured = accounts.filter((account) => account.enabled === true);
  const result = [];
  for (const entry of payload.entry) {
    if (
      !record(entry) ||
      !identifier(entry.id) ||
      !Array.isArray(entry.changes) ||
      entry.changes.length > 100
    )
      throw invalid();
    for (const change of entry.changes) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      if (
        !record(value) ||
        value.messaging_product !== "whatsapp" ||
        !identifier(value.metadata?.phone_number_id)
      )
        throw invalid();
      const matches = configured.filter(
        (account) =>
          account.waba_id === entry.id &&
          account.phone_number_id === value.metadata.phone_number_id,
      );
      if (matches.length === 0) continue;
      if (matches.length !== 1 || !matches[0].organization_id || !matches[0].id) throw invalid();
      const account = matches[0];
      const base = {
        organization_id: account.organization_id,
        account_id: account.id,
        waba_id: entry.id,
        phone_number_id: account.phone_number_id,
      };
      for (const field of ["messages", "statuses", "contacts"])
        if (
          value[field] !== undefined &&
          (!Array.isArray(value[field]) || value[field].length > 500)
        )
          throw invalid();
      for (const message of value.messages || []) {
        const timestamp = eventTime(message?.timestamp);
        if (
          !record(message) ||
          !MESSAGE_ID.test(message.id || "") ||
          !phone(message.from) ||
          !timestamp
        )
          throw invalid();
        const contact = (value.contacts || []).find((item) => item?.wa_id === message.from);
        const type = [
          "text",
          "image",
          "document",
          "audio",
          "video",
          "sticker",
          "interactive",
          "button",
          "location",
          "contacts",
          "reaction",
        ].includes(message.type)
          ? message.type
          : "unsupported";
        const content = {};
        let mediaId = null;
        if (type === "text") {
          if (text(message.text?.body, 16384) === null) throw invalid();
          content.text = message.text.body;
        } else if (["image", "document", "audio", "video", "sticker"].includes(type)) {
          const media = message[type];
          if (!identifier(media?.id)) throw invalid();
          mediaId = media.id;
          for (const field of ["caption", "filename", "mime_type"])
            if (text(media[field], field === "caption" ? 4096 : 256) !== null)
              content[field] = media[field];
        } else if (type === "button") {
          if (text(message.button?.text, 1024) !== null) content.text = message.button.text;
        } else if (type === "interactive") {
          const response = message.interactive?.button_reply || message.interactive?.list_reply;
          if (text(response?.title, 1024) !== null) content.text = response.title;
        } else if (type === "reaction") {
          if (text(message.reaction?.emoji, 32) !== null) content.text = message.reaction.emoji;
        }
        result.push({
          ...base,
          provider_event_key: "message:" + message.id,
          kind: "message",
          timestamp,
          whatsapp_message_id: message.id,
          from: message.from,
          contact_name: text(contact?.profile?.name, 256) || message.from,
          type,
          content,
          media_id: mediaId,
          referral: referralData(message.referral),
        });
      }
      for (const status of value.statuses || []) {
        const timestamp = eventTime(status?.timestamp);
        if (
          !record(status) ||
          !MESSAGE_ID.test(status.id || "") ||
          !timestamp ||
          !phone(status.recipient_id)
        )
          throw invalid();
        if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
        result.push({
          ...base,
          provider_event_key: `status:${status.id}:${status.status}:${status.timestamp}`,
          kind: "status",
          timestamp,
          whatsapp_message_id: status.id,
          status: status.status,
          recipient_id: status.recipient_id,
          error_code: Number.isSafeInteger(status.errors?.[0]?.code) ? status.errors[0].code : null,
        });
      }
      if (result.length > 2000) throw invalid();
    }
  }
  return result;
}

export function isWhatsAppServiceWindowOpen(lastCustomerMessageAt, now = Date.now()) {
  const sent = typeof lastCustomerMessageAt === "string" ? Date.parse(lastCustomerMessageAt) : NaN;
  const current = now instanceof Date ? now.getTime() : Number(now);
  return (
    Number.isFinite(sent) &&
    Number.isFinite(current) &&
    sent <= current &&
    current - sent < 24 * 60 * 60 * 1000
  );
}

export function normalizeWhatsAppOutbound(
  input,
  { lastCustomerMessageAt, now = Date.now(), templates = [] } = {},
) {
  if (!record(input)) throw invalid();
  if (input.type === "template") {
    const requested = input.template;
    if (
      !record(requested) ||
      !/^[a-z0-9_]{1,512}$/.test(requested.name || "") ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(requested.language || "")
    )
      throw invalid();
    const matches = templates.filter(
      (template) =>
        template.name === requested.name &&
        template.language === requested.language &&
        template.status === "APPROVED",
    );
    if (matches.length !== 1)
      throw fail(
        "WHATSAPP_TEMPLATE_NOT_APPROVED",
        "O modelo não está aprovado ou não está disponível.",
      );
    const template = matches[0];
    const components = template.components || [];
    if (components.some((component) => component.type === "HEADER" || component.type === "BUTTONS"))
      throw fail(
        "WHATSAPP_TEMPLATE_UNSUPPORTED",
        "Este modelo requer componentes ainda não suportados. Use um modelo apenas com corpo de texto.",
      );
    const body = components.find((component) => component.type === "BODY");
    const bodyText = typeof body?.text === "string" ? body.text : "";
    const placeholders = [...bodyText.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1]);
    const unique = [...new Set(placeholders)];
    if (unique.some((item, index) => item !== String(index + 1)))
      throw fail(
        "WHATSAPP_TEMPLATE_UNSUPPORTED",
        "Este modelo usa variáveis ainda não suportadas.",
      );
    const parameters = requested.parameters || [];
    if (
      !Array.isArray(parameters) ||
      parameters.length !== unique.length ||
      parameters.length > 30 ||
      parameters.some((value) => typeof value !== "string" || !value.trim() || value.length > 1024)
    )
      throw invalid();
    return {
      type: "template",
      template: {
        name: requested.name,
        language: { code: requested.language },
        ...(parameters.length
          ? {
              components: [
                {
                  type: "body",
                  parameters: parameters.map((value) => ({ type: "text", text: value })),
                },
              ],
            }
          : {}),
      },
    };
  }
  if (!isWhatsAppServiceWindowOpen(lastCustomerMessageAt, now))
    throw fail(
      "WHATSAPP_WINDOW_CLOSED",
      "A janela de 24 horas expirou. Utilize um modelo aprovado.",
      409,
    );
  if (input.type === "text") {
    if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 4096)
      throw invalid();
    return { type: "text", text: { body: input.text, preview_url: false } };
  }
  if (["image", "document", "audio"].includes(input.type)) {
    if (!identifier(input.media_id)) throw invalid();
    const media = { id: input.media_id };
    if (input.type !== "audio" && input.caption !== undefined) {
      if (text(input.caption, 1024) === null) throw invalid();
      media.caption = input.caption;
    }
    if (input.type === "document" && input.filename !== undefined) {
      if (text(input.filename, 128) === null || /[\r\n/\\]/.test(input.filename)) throw invalid();
      media.filename = input.filename;
    }
    return { type: input.type, [input.type]: media };
  }
  throw invalid();
}

const mediaTypes = new Map([
  ["image/jpeg", { type: "image", limit: 5 * 1024 * 1024 }],
  ["image/png", { type: "image", limit: 5 * 1024 * 1024 }],
  ["application/pdf", { type: "document", limit: MAX_MEDIA_BYTES }],
  ["text/plain", { type: "document", limit: MAX_MEDIA_BYTES }],
  ["application/msword", { type: "document", limit: MAX_MEDIA_BYTES }],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    { type: "document", limit: MAX_MEDIA_BYTES },
  ],
  ["application/vnd.ms-excel", { type: "document", limit: MAX_MEDIA_BYTES }],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    { type: "document", limit: MAX_MEDIA_BYTES },
  ],
  ["audio/aac", { type: "audio", limit: MAX_MEDIA_BYTES }],
  ["audio/amr", { type: "audio", limit: MAX_MEDIA_BYTES }],
  ["audio/mpeg", { type: "audio", limit: MAX_MEDIA_BYTES }],
  ["audio/mp4", { type: "audio", limit: MAX_MEDIA_BYTES }],
  ["audio/ogg", { type: "audio", limit: MAX_MEDIA_BYTES }],
]);
export function validateWhatsAppMedia({ bytes, mimeType, filename = "arquivo" }) {
  if (
    !(bytes instanceof Uint8Array) ||
    typeof mimeType !== "string" ||
    typeof filename !== "string" ||
    !filename ||
    filename.length > 128 ||
    /[\r\n/\\]/.test(filename)
  )
    throw invalid();
  const baseMime = mimeType.split(";")[0].trim().toLowerCase();
  const definition = mediaTypes.get(baseMime);
  if (!definition || bytes.byteLength === 0 || bytes.byteLength > definition.limit)
    throw fail("WHATSAPP_MEDIA_UNSUPPORTED", "Tipo ou tamanho de arquivo não suportado.");
  if (baseMime === "audio/ogg" && !/codecs=opus/i.test(mimeType))
    throw fail("WHATSAPP_MEDIA_UNSUPPORTED", "Áudio OGG deve usar o codec Opus.");
  return { ...definition, mimeType: baseMime, filename };
}

async function readBounded(response, limit) {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body?.cancel().catch(() => {});
    throw fail("WHATSAPP_RESPONSE_INVALID", "Resposta do WhatsApp excedeu o limite.", 502);
  }
  const chunks = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (!reader) throw fail("WHATSAPP_RESPONSE_INVALID", "Resposta do WhatsApp inválida.", 502);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw fail("WHATSAPP_RESPONSE_INVALID", "Resposta do WhatsApp excedeu o limite.", 502);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function mediaDownloadUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !(url.hostname === "lookaside.fbsbx.com" || url.hostname.endsWith(".fbcdn.net"))
  )
    throw fail("WHATSAPP_MEDIA_URL_INVALID", "Origem da mídia do WhatsApp não permitida.", 502);
  return url;
}

/** Only fixed Graph paths are accepted; credentials are never included in public URLs/errors. */
export function createWhatsAppCloudClient({
  token,
  graphVersion = "v26.0",
  fetchImpl = fetch,
} = {}) {
  if (
    typeof token !== "string" ||
    !token ||
    token.length > 16384 ||
    /[\r\n]/.test(token) ||
    !/^v\d{1,3}\.\d{1,2}$/.test(graphVersion)
  )
    throw fail("WHATSAPP_NOT_CONFIGURED", "Integração oficial do WhatsApp não configurada.", 503);
  const request = async (path, { method = "GET", query = {}, body, form } = {}) => {
    if (!/^\d{1,40}(?:\/(?:messages|media|phone_numbers|message_templates))?$/.test(path))
      throw invalid();
    const url = new URL(`${GRAPH}/${graphVersion}/${path}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    let response;
    let data;
    try {
      response = await fetchImpl(url.toString(), {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : form ? { body: form } : {}),
      });
      const bytes = await readBounded(response, MAX_JSON_BYTES);
      data = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw fail(
        "WHATSAPP_NETWORK_UNCERTAIN",
        "Não foi possível confirmar a resposta do WhatsApp. Verifique o histórico antes de tentar novamente.",
        503,
        { ambiguous: method !== "GET", retryable: method === "GET" },
      );
    }
    if (!response.ok || data.error) {
      const code = Number.isSafeInteger(data?.error?.code) ? data.error.code : null;
      const subcode = Number.isSafeInteger(data?.error?.error_subcode)
        ? data.error.error_subcode
        : null;
      throw fail(
        "WHATSAPP_GRAPH_ERROR",
        "A Meta recusou a operação do WhatsApp.",
        response.status === 429 ? 429 : 502,
        {
          providerCode: code,
          providerSubcode: subcode,
          retryable: response.status === 429 || response.status >= 500,
          ambiguous: method !== "GET" && response.status >= 500,
        },
      );
    }
    if (!record(data))
      throw fail("WHATSAPP_RESPONSE_INVALID", "Resposta do WhatsApp inválida.", 502, {
        ambiguous: method !== "GET",
      });
    return data;
  };
  return {
    async numberStatus(phoneId, wabaId) {
      if (!identifier(phoneId) || (wabaId !== undefined && !identifier(wabaId))) throw invalid();
      const info = await request(phoneId, {
        query: {
          fields:
            "id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type",
        },
      });
      if (info.id !== phoneId || typeof info.display_phone_number !== "string")
        throw fail("WHATSAPP_RESPONSE_INVALID", "Número do WhatsApp não confirmado.", 502);
      if (wabaId) {
        let after;
        let found = false;
        for (let page = 0; page < 20; page++) {
          const result = await request(wabaId + "/phone_numbers", {
            query: { fields: "id", limit: "100", ...(after ? { after } : {}) },
          });
          if (!Array.isArray(result.data))
            throw fail("WHATSAPP_RESPONSE_INVALID", "Conta do WhatsApp não confirmada.", 502);
          found ||= result.data.some((item) => item.id === phoneId);
          if (!result.paging?.next) break;
          after = text(result.paging?.cursors?.after, 2048);
          if (!after || page === 19)
            throw fail("WHATSAPP_RESPONSE_INVALID", "Lista de números incompleta.", 502);
        }
        if (!found)
          throw fail(
            "WHATSAPP_ACCOUNT_MISMATCH",
            "O número não pertence à conta WABA configurada.",
            422,
          );
      }
      return Object.fromEntries(
        [
          "id",
          "display_phone_number",
          "verified_name",
          "quality_rating",
          "code_verification_status",
          "platform_type",
        ]
          .filter((field) => typeof info[field] === "string")
          .map((field) => [field, info[field]]),
      );
    },
    async templates(wabaId) {
      if (!identifier(wabaId)) throw invalid();
      const rows = [];
      let after;
      for (let page = 0; page < 20; page++) {
        const result = await request(wabaId + "/message_templates", {
          query: {
            fields: "id,name,language,status,category,components",
            limit: "100",
            ...(after ? { after } : {}),
          },
        });
        if (!Array.isArray(result.data) || result.data.length > 100)
          throw fail("WHATSAPP_RESPONSE_INVALID", "Catálogo de modelos inválido.", 502);
        for (const template of result.data) {
          if (
            !identifier(template?.id) ||
            !text(template.name, 512) ||
            !text(template.language, 32) ||
            !text(template.status, 64) ||
            !Array.isArray(template.components)
          )
            throw fail("WHATSAPP_RESPONSE_INVALID", "Catálogo de modelos inválido.", 502);
          rows.push({
            id: template.id,
            name: template.name,
            language: template.language,
            status: template.status,
            category: text(template.category, 64) || "UNKNOWN",
            components: template.components
              .filter((component) => record(component))
              .map((component) => ({
                type: text(component.type, 32),
                ...(text(component.text, 16384) !== null ? { text: component.text } : {}),
                ...(text(component.format, 32) !== null ? { format: component.format } : {}),
              })),
          });
        }
        if (!result.paging?.next) return rows;
        after = text(result.paging?.cursors?.after, 2048);
        if (!after) throw fail("WHATSAPP_RESPONSE_INVALID", "Catálogo de modelos incompleto.", 502);
      }
      throw fail("WHATSAPP_RESPONSE_INVALID", "Catálogo de modelos excedeu o limite.", 502);
    },
    async send(phoneId, to, message) {
      if (
        !identifier(phoneId) ||
        !phone(to) ||
        !record(message) ||
        !["text", "image", "document", "audio", "template"].includes(message.type)
      )
        throw invalid();
      const result = await request(phoneId + "/messages", {
        method: "POST",
        body: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: message.type,
          [message.type]: message[message.type],
        },
      });
      const id = result.messages?.[0]?.id;
      if (!MESSAGE_ID.test(id || ""))
        throw fail("WHATSAPP_RESPONSE_INVALID", "Envio não confirmado pelo WhatsApp.", 502, {
          ambiguous: true,
        });
      return { whatsapp_message_id: id };
    },
    async uploadMedia(phoneId, media) {
      if (!identifier(phoneId)) throw invalid();
      const definition = validateWhatsAppMedia(media);
      const form = new FormData();
      form.set("messaging_product", "whatsapp");
      form.set("type", definition.mimeType);
      form.set(
        "file",
        new Blob([new Uint8Array(media.bytes)], { type: definition.mimeType }),
        definition.filename,
      );
      const result = await request(phoneId + "/media", { method: "POST", form });
      if (!identifier(result.id))
        throw fail("WHATSAPP_RESPONSE_INVALID", "Upload não confirmado pelo WhatsApp.", 502);
      return {
        media_id: result.id,
        type: definition.type,
        mime_type: definition.mimeType,
        filename: definition.filename,
        size: media.bytes.byteLength,
      };
    },
    async downloadMedia(mediaId) {
      if (!identifier(mediaId)) throw invalid();
      const metadata = await request(mediaId);
      if (
        metadata.id !== mediaId ||
        typeof metadata.url !== "string" ||
        !mediaTypes.has(String(metadata.mime_type).split(";")[0]) ||
        !Number.isSafeInteger(metadata.file_size) ||
        metadata.file_size <= 0 ||
        metadata.file_size > MAX_MEDIA_BYTES
      )
        throw fail("WHATSAPP_MEDIA_UNSUPPORTED", "Mídia indisponível ou não suportada.", 422);
      const url = mediaDownloadUrl(metadata.url);
      try {
        const response = await fetchImpl(url.toString(), {
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw Error();
        const bytes = await readBounded(response, MAX_MEDIA_BYTES);
        if (bytes.length !== metadata.file_size) throw Error();
        if (metadata.sha256) {
          const digest = createHash("sha256").update(bytes).digest();
          const expected =
            typeof metadata.sha256 === "string" && /^[a-f0-9]{64}$/i.test(metadata.sha256)
              ? Buffer.from(metadata.sha256, "hex")
              : Buffer.from(String(metadata.sha256), "base64");
          if (expected.length !== digest.length || !timingSafeEqual(expected, digest))
            throw Error();
        }
        return { bytes, mime_type: metadata.mime_type, size: bytes.byteLength };
      } catch {
        throw fail(
          "WHATSAPP_MEDIA_UNAVAILABLE",
          "Não foi possível obter a mídia do WhatsApp.",
          503,
        );
      }
    },
  };
}
