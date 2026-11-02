import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createWhatsAppCloudClient,
  encryptWhatsAppCredential,
  decryptWhatsAppCredential,
  validWhatsAppSignature,
  parseWhatsAppWebhook,
  normalizeWhatsAppOutbound,
} from "./whatsapp-cloud.mjs";
const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (value, status = 200) => Response.json(value, { status, headers });
const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
const metaId = /^\d{5,30}$/;
const safeEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const grants = (identity, names) =>
  names.every((name) => identity.canonicalPermissions?.includes(name));
const dateString = (date) => (date instanceof Date ? date.toISOString() : date);
export function whatsappCapabilities(session, identity, viewedIdentity = identity) {
  const allowed = (names) => grants(identity, names) && grants(viewedIdentity, names);
  const global = ["admin", "superintendent"].includes(session.user.role);
  return {
    can_configure:
      !session.view_as?.active &&
      session.actor.role === "admin" &&
      allowed(["crm.leads.settings.manage"]),
    can_supervise:
      (global || (session.user.role === "manager" && !!session.user.team)) &&
      allowed(["crm.leads.assign", "crm.leads.distribution.assign"]),
    can_claim: allowed([
      "crm.leads.assign",
      "crm.leads.distribution.assign",
      "crm.leads.messages.manage",
    ]),
    can_send: allowed(["crm.leads.messages.manage"]),
    can_edit: allowed(["crm.leads.edit"]),
    can_move_stage: allowed(["crm.leads.edit", "crm.leads.stage.move"]),
    can_close: allowed(["crm.leads.close"]),
    can_report: allowed(["crm.leads.reports.view"]),
  };
}
export function whatsappScope(session, users, env = process.env) {
  const organization = env.WHATSAPP_ORGANIZATION_ID;
  if (!organization || !idPattern.test(organization))
    throw fail("Organização do WhatsApp não configurada no servidor.", 503);
  const member = users.find((user) => user.id === session.user.id && user.active === true);
  if (!member || (member.organization_id && member.organization_id !== organization))
    throw fail("Acesso ao atendimento não autorizado.", 403);
  const role = member.role,
    all = ["admin", "superintendent"].includes(role),
    sameTeam = role === "manager" && !!member.team;
  const members = users.filter(
    (user) =>
      user.active === true &&
      (!user.organization_id || user.organization_id === organization) &&
      (all || user.id === member.id || (sameTeam && user.team === member.team)),
  );
  return {
    organization_id: organization,
    user_id: member.id,
    role,
    team: member.team || "",
    all,
    can_manage: all || sameTeam,
    allowed_user_ids: members.map((user) => user.id),
    single_organization: true,
  };
}
async function readBody(request, maxBytes = 65536) {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw fail("Conteúdo excede o limite permitido.", 413);
  if (!request.body) throw fail("Conteúdo obrigatório.");
  const reader = request.body.getReader(),
    parts = [];
  let size = 0;
  for (;;) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw fail("Conteúdo excede o limite permitido.", 413);
    }
    parts.push(Buffer.from(item.value));
  }
  return Buffer.concat(parts);
}
const inputJSON = async (request, limit) => {
  let input;
  try {
    input = JSON.parse((await readBody(request, limit)).toString("utf8"));
  } catch (error) {
    if (error?.status) throw error;
    throw fail("JSON inválido.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw fail("Objeto obrigatório.");
  return input;
};
const allowKeys = (input, keys) => {
  if (Object.keys(input).some((key) => !keys.includes(key))) throw fail("Campo não permitido.");
};
const requireCapability = (value) => {
  if (!value) throw fail("Permissão de atendimento não concedida.", 403);
};
const accountAAD = (account) => account.organization_id + ":" + account.id;
function credential(account, env) {
  let value;
  try {
    value = JSON.parse(
      decryptWhatsAppCredential(
        account.secret_ciphertext,
        env.WHATSAPP_CREDENTIAL_KEY,
        accountAAD(account),
      ),
    );
  } catch {
    throw fail("Credencial do WhatsApp indisponível.", 503);
  }
  if (!value.access_token) throw fail("Token do WhatsApp ausente.", 503);
  return value;
}
const defaultCloud = (account, env) =>
  createWhatsAppCloudClient({
    token: credential(account, env).access_token,
    graphVersion: account.graph_version,
  });
const safeAccount = (account) =>
  Object.fromEntries(
    [
      "id",
      "organization_id",
      "app_id",
      "waba_id",
      "phone_number_id",
      "display_phone_number",
      "business_name",
      "graph_version",
      "enabled",
      "connection_status",
      "team",
      "distribution_mode",
      "max_conversations",
      "retention_days",
      "version",
      "created_at",
      "updated_at",
      "has_credentials",
    ]
      .filter((key) => account[key] !== undefined)
      .map((key) => [key, account[key]]),
  );
/** Existing CRM guards, canonical permissions and the real audit actor remain authoritative. */
export async function handleWhatsAppRequest(request, path, context) {
  const { session, identity, users, store, env = process.env, viewedIdentity = identity } = context;
  const cloud = context.cloud || ((account) => defaultCloud(account, env));
  try {
    if (!session?.user || !session.actor) throw fail("Sessão de atendimento inválida.", 401);
    const caps = whatsappCapabilities(session, identity, viewedIdentity);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      !safeEqual(request.headers.get("x-c2s-csrf"), session.csrf)
    )
      throw fail("Sessão atualizada. Recarregue a página e tente novamente.", 403);
    if (path === "/whatsapp/session" && request.method === "GET")
      return json({ ...caps, user_id: session.user.id, impersonating: !!session.view_as?.active });
    const configured = !!env.WHATSAPP_ORGANIZATION_ID && !!env.WHATSAPP_CREDENTIAL_KEY;
    if (path === "/whatsapp/accounts" && request.method === "GET" && !configured)
      return json({ data: [], configuration_available: false });
    const scope = {
      ...whatsappScope(session, users, env),
      can_configure: caps.can_configure,
      queue_visible: caps.can_claim,
    };
    scope.can_manage = scope.can_manage && caps.can_supervise;
    const query = new URL(request.url).searchParams;
    if (path === "/whatsapp/accounts") {
      if (request.method === "GET")
        return json({
          data: (await store.accounts(scope.organization_id)).map(safeAccount),
          configuration_available: configured && caps.can_configure,
        });
      if (request.method === "POST") {
        requireCapability(caps.can_configure);
        const input = await inputJSON(request);
        allowKeys(input, [
          "id",
          "app_id",
          "waba_id",
          "phone_number_id",
          "display_phone_number",
          "business_name",
          "access_token",
          "verify_token",
          "graph_version",
          "version",
        ]);
        if (
          ![input.app_id, input.waba_id, input.phone_number_id].every(
            (value) => typeof value === "string" && metaId.test(value),
          ) ||
          input.app_id !== (env.WHATSAPP_APP_ID || env.META_APP_ID) ||
          !/^v\d{1,3}\.\d{1,2}$/.test(input.graph_version || "")
        )
          throw fail("IDs ou versão da Meta inválidos. Use o aplicativo configurado no servidor.");
        if (input.id && !idPattern.test(input.id)) throw fail("Conta inválida.");
        const existing = input.id ? await store.account(scope.organization_id, input.id) : null,
          previous = existing ? credential(existing, env) : {};
        if (
          existing &&
          ["app_id", "waba_id", "phone_number_id"].some((key) => existing[key] !== input[key])
        )
          throw fail(
            "Cadastre uma nova conta para trocar aplicativo, WABA ou número. O histórico existente será preservado.",
            409,
          );
        const token = input.access_token || previous.access_token,
          verify = input.verify_token || previous.verify_token;
        if (
          typeof token !== "string" ||
          !/^[^\s\x00-\x1f]{20,16384}$/.test(token) ||
          typeof verify !== "string" ||
          !/^[^\s\x00-\x1f]{32,256}$/.test(verify)
        )
          throw fail(
            "Token e Verify Token válidos são obrigatórios. O Verify Token deve ter ao menos 32 caracteres.",
          );
        const id = input.id || randomUUID();
        const saved = await store.saveAccount(
          scope.organization_id,
          {
            id,
            app_id: input.app_id,
            waba_id: input.waba_id,
            phone_number_id: input.phone_number_id,
            display_phone_number: String(input.display_phone_number || "").slice(0, 40),
            business_name: String(input.business_name || "").slice(0, 160),
            graph_version: input.graph_version,
            secret_ciphertext: encryptWhatsAppCredential(
              JSON.stringify({ access_token: token, verify_token: verify }),
              env.WHATSAPP_CREDENTIAL_KEY,
              scope.organization_id + ":" + id,
            ),
            enabled: false,
            connection_status: "pending_validation",
            version: input.version,
          },
          scope,
        );
        return json(safeAccount(saved), 201);
      }
    }
    const accountAction = path.match(/^\/whatsapp\/accounts\/([a-zA-Z0-9-]+)\/(validate|disable)$/);
    if (accountAction && request.method === "POST") {
      requireCapability(caps.can_configure);
      const account = await store.account(scope.organization_id, accountAction[1]);
      if (!account) throw fail("Conta não encontrada.", 404);
      const input = await inputJSON(request);
      allowKeys(input, ["version"]);
      if (input.version !== account.version) throw fail("A conta foi atualizada. Recarregue.", 409);
      if (accountAction[2] === "validate") {
        const status = await cloud(account).numberStatus(account.phone_number_id, account.waba_id);
        return json(
          safeAccount(
            await store.saveAccount(
              scope.organization_id,
              {
                ...account,
                display_phone_number: status.display_phone_number || account.display_phone_number,
                enabled: true,
                connection_status: "number_validated",
                version: input.version,
              },
              scope,
            ),
          ),
        );
      }
      return json(
        safeAccount(
          await store.saveAccount(
            scope.organization_id,
            { ...account, enabled: false, connection_status: "disabled", version: input.version },
            scope,
          ),
        ),
      );
    }
    if (path === "/whatsapp/settings") {
      requireCapability(caps.can_configure);
      if (request.method === "GET") {
        const settings = await store.settings(scope.organization_id, query.get("account_id"));
        return json({
          ...settings,
          distribution_mode:
            settings.distribution_mode === "automatic" ? "round_robin" : settings.distribution_mode,
        });
      }
      if (request.method === "PUT") {
        const input = await inputJSON(request);
        allowKeys(input, ["account_id", "mode", "max_concurrent", "retention_days", "version"]);
        if (
          !["shared", "round_robin", "manual"].includes(input.mode) ||
          !Number.isInteger(input.max_concurrent) ||
          input.max_concurrent < 1 ||
          input.max_concurrent > 100 ||
          !Number.isInteger(input.retention_days) ||
          input.retention_days < 1 ||
          input.retention_days > 3650
        )
          throw fail("Regras de distribuição ou retenção inválidas.");
        const current = await store.account(scope.organization_id, input.account_id);
        if (!current) throw fail("Conta não encontrada.", 404);
        return json(
          await store.saveSettings(scope, input.account_id, {
            distribution_mode: input.mode === "round_robin" ? "automatic" : input.mode,
            max_conversations: input.max_concurrent,
            retention_days: input.retention_days,
            team: current.team || "",
            version: input.version,
          }),
        );
      }
    }
    if (path === "/whatsapp/templates" && request.method === "GET") {
      requireCapability(caps.can_send || caps.can_configure);
      const account = await store.account(scope.organization_id, query.get("account_id"));
      if (!account?.enabled) throw fail("Conta não conectada.", 409);
      return json({ data: await cloud(account).templates(account.waba_id) });
    }
    if (path === "/whatsapp/availability" && request.method === "GET")
      return json(await store.availability(scope));
    if (path === "/whatsapp/availability" && request.method === "PUT") {
      requireCapability(caps.can_claim && caps.can_send);
      const input = await inputJSON(request);
      allowKeys(input, ["available"]);
      if (typeof input.available !== "boolean") throw fail("Disponibilidade inválida.");
      return json(await store.setAvailability(scope, input.available));
    }
    if (path === "/whatsapp/events" && request.method === "GET") {
      const result = await store.events(scope, { after: query.get("after"), limit: 100 });
      return json({ ...result, next_cursor: result.next_cursor ?? result.cursor });
    }
    if (path === "/whatsapp/diagnostics" && request.method === "GET") {
      requireCapability(caps.can_configure);
      return json(await store.webhookEvents(scope, { limit: 50 }));
    }
    if (path === "/whatsapp/metrics" && request.method === "GET") {
      requireCapability(caps.can_report);
      return json(await store.metrics(scope, Object.fromEntries(query)));
    }
    if (path === "/whatsapp/conversations" && request.method === "GET") {
      const filters = Object.fromEntries(query);
      if (filters.cursor) filters.before = filters.cursor;
      if (["mine", "unanswered", "transferred"].includes(filters.status)) {
        filters.filter = filters.status;
        delete filters.status;
      }
      if (filters.status === "all") delete filters.status;
      return json(await store.conversations(scope, filters));
    }
    const route = path.match(
      /^\/whatsapp\/conversations\/([a-zA-Z0-9-]+)(?:\/(messages|claim|transfer|requeue|close|notes|media|read|export|redact)(?:\/([a-zA-Z0-9-]+))?)?$/,
    );
    if (!route) throw fail("Rota não encontrada.", 404);
    const [, id, action, messageId] = route,
      conversation = await store.conversation(scope, id);
    if (!conversation) throw fail("Conversa não encontrada.", 404);
    if (!action && request.method === "PATCH") {
      requireCapability(caps.can_edit && caps.can_move_stage);
      const input = await inputJSON(request);
      allowKeys(input, ["version", "tags", "interest", "stage", "confirm_sale"]);
      return json(await store.updateConversation(scope, id, input));
    }
    if (!action && request.method === "GET")
      return json({
        conversation: {
          ...conversation,
          distribution_mode:
            (await store.account(scope.organization_id, conversation.account_id))
              ?.distribution_mode || "shared",
        },
        messages: (await store.messages(scope, id, { limit: 50 })).data,
        notes: await store.notes(scope, id),
        history: await store.assignmentHistory(scope, id),
        eligible_users: users
          .filter((member) => scope.allowed_user_ids.includes(member.id))
          .map(({ id, name, role, team }) => ({ id, name, role, team })),
      });
    if (action === "export" && request.method === "GET") {
      requireCapability(
        caps.can_configure && grants(identity, ["crm.leads.export", "crm.leads.reports.export"]),
      );
      return json(await store.exportConversation(scope, id));
    }
    if (action === "messages" && request.method === "GET")
      return json(await store.messages(scope, id, { before: query.get("before"), limit: 50 }));
    if (action === "media" && messageId && request.method === "GET") {
      const message = await store.message(scope, id, messageId);
      const mediaId = message?.media_id || message?.media_reference?.id;
      if (!mediaId) throw fail("Mídia não encontrada.", 404);
      const account = await store.account(scope.organization_id, conversation.account_id);
      if (!account?.enabled) throw fail("Conta não conectada.", 409);
      const media = await cloud(account).downloadMedia(mediaId);
      return json({
        mime_type: media.mime_type,
        data_base64: Buffer.from(media.bytes).toString("base64"),
        filename: message.content?.filename || "arquivo",
      });
    }
    if (request.method !== "POST") throw fail("Método não permitido.", 405);
    const input = await inputJSON(request, action === "media" ? 15 * 1024 * 1024 : 65536);
    if (action === "redact") {
      requireCapability(caps.can_configure);
      allowKeys(input, ["version", "confirmation"]);
      if (input.confirmation !== "APAGAR CONTEUDO")
        throw fail("Confirmação explícita necessária. A remoção não pode ser desfeita.");
      return json(await store.eraseConversation(scope, id, input.version));
    }
    if (["claim", "transfer", "requeue", "close"].includes(action)) {
      allowKeys(input, ["version", "target_user_id"]);
      if (!Number.isInteger(input.version) || input.version < 1) throw fail("Versão inválida.");
      if (action === "claim") {
        requireCapability(caps.can_claim && caps.can_send);
        return json(await store.claim(scope, id, input.version));
      }
      if (action === "close") requireCapability(caps.can_close);
      else
        requireCapability(
          caps.can_supervise ||
            (action === "requeue" &&
              conversation.assigned_user_id === scope.user_id &&
              caps.can_claim),
        );
      if (action === "transfer" && !scope.allowed_user_ids.includes(input.target_user_id))
        throw fail("Destinatário fora do escopo permitido.", 403);
      if (action === "transfer") {
        const targetMember = users.find((member) => member.id === input.target_user_id);
        const canonicalTarget =
          typeof context.resolveRecipient === "function" && targetMember?.auth_user_id
            ? await context.resolveRecipient(targetMember.auth_user_id)
            : null;
        if (
          !canonicalTarget ||
          canonicalTarget.id !== targetMember.auth_user_id ||
          !grants(canonicalTarget, [
            "crm.leads.messages.manage",
            "crm.leads.assign",
            "crm.leads.distribution.assign",
          ]) ||
          !canonicalTarget.authorizedPages?.includes("/app/leads/lista")
        )
          throw fail("O destinatário não possui acesso vigente ao atendimento no CRM.", 403);
      }
      return json(await store.move(scope, id, { ...input, action }));
    }
    if (action === "read") {
      allowKeys(input, []);
      return json(await store.markRead(scope, id));
    }
    if (action === "notes") {
      requireCapability(caps.can_edit);
      allowKeys(input, ["text"]);
      if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 10000)
        throw fail("Observação inválida.");
      return json(await store.addNote(scope, id, input.text.trim()), 201);
    }
    if (!["messages", "media"].includes(action)) throw fail("Rota não encontrada.", 404);
    requireCapability(caps.can_send);
    if (conversation.assigned_user_id !== scope.user_id || conversation.status !== "active")
      throw fail("Assuma este atendimento antes de responder.", 403);
    const account = await store.account(scope.organization_id, conversation.account_id);
    if (!account?.enabled) throw fail("Conta não conectada.", 409);
    const client = cloud(account);
    let outbound = input;
    if (action === "media") {
      allowKeys(input, [
        "client_message_id",
        "type",
        "filename",
        "mime_type",
        "data_base64",
        "caption",
      ]);
      if (
        typeof input.data_base64 !== "string" ||
        !/^[a-zA-Z0-9+/]*={0,2}$/.test(input.data_base64) ||
        input.data_base64.length > 14 * 1024 * 1024
      )
        throw fail("Arquivo inválido ou muito grande.");
      normalizeWhatsAppOutbound(
        { type: "text", text: "validation" },
        { lastCustomerMessageAt: dateString(conversation.last_customer_message_at) },
      );
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          input.client_message_id || "",
        )
      )
        throw fail("Identificador de mensagem inválido.");
      const uploaded = await client.uploadMedia(account.phone_number_id, {
        bytes: Buffer.from(input.data_base64, "base64"),
        mimeType: input.mime_type,
        filename: input.filename,
      });
      if (uploaded.type !== input.type) throw fail("Tipo de arquivo incompatível.");
      outbound = {
        client_message_id: input.client_message_id,
        type: input.type,
        media_id: uploaded.media_id,
        filename: uploaded.filename,
        caption: input.caption,
        media_sha256: createHash("sha256")
          .update(Buffer.from(input.data_base64, "base64"))
          .digest("hex"),
      };
    } else allowKeys(input, ["client_message_id", "type", "text", "template"]);
    const templates = outbound.type === "template" ? await client.templates(account.waba_id) : [];
    normalizeWhatsAppOutbound(outbound, {
      lastCustomerMessageAt: dateString(conversation.last_customer_message_at),
      templates,
    });
    const { client_message_id: clientMessageId, ...content } = outbound;
    const message = await store.queueMessage(scope, id, {
      client_message_id: clientMessageId,
      type: outbound.type,
      content,
      media_reference: outbound.media_id
        ? { id: outbound.media_id, sha256: outbound.media_sha256 }
        : null,
    });
    if (!["queued", "pending", "failed"].includes(message.delivery_status)) return json(message);
    const leased = await store.beginSend(scope, id, message.id);
    if (!leased?.send_allowed) return json(message);
    let submitted = false;
    try {
      const latest = leased.conversation || conversation;
      const persistedContent = Object.fromEntries(
        Object.entries(leased.content || {}).filter(([key]) => key !== "_request_hash"),
      );
      const latestAccount = leased.account || account;
      const sender = leased.account ? cloud(latestAccount) : client;
      const latestTemplates =
        persistedContent.type === "template" ? await sender.templates(latestAccount.waba_id) : [];
      const normalized = normalizeWhatsAppOutbound(persistedContent, {
        lastCustomerMessageAt: dateString(latest.last_customer_message_at),
        templates: latestTemplates,
      });
      submitted = true;
      const result = await sender.send(
        latestAccount.phone_number_id,
        leased.wa_id || latest.whatsapp_contact_id || latest.phone?.replace(/\D/g, ""),
        normalized,
      );
      return json(await store.finishSend(leased, { provider_id: result.whatsapp_message_id }));
    } catch (error) {
      const ambiguous = submitted && error?.ambiguous !== false;
      await store.finishSend(leased, {
        error_code: String(error?.code || "WHATSAPP_SEND_FAILED").slice(0, 100),
        ambiguous,
      });
      throw fail(
        ambiguous
          ? "Envio sem confirmação. Aguarde o status; não repita para evitar duplicidade."
          : "A Meta recusou o envio. Revise a configuração antes de tentar novamente.",
        502,
      );
    }
  } catch (error) {
    const status = [400, 401, 403, 404, 405, 409, 413, 422, 429, 502, 503].includes(error?.status)
      ? error.status
      : 503;
    return json(
      {
        error:
          status === 503
            ? "Atendimento WhatsApp não configurado ou temporariamente indisponível."
            : error.message || "Operação indisponível.",
      },
      status,
    );
  }
}
export async function receiveWhatsAppWebhook(request, { store, env = process.env }) {
  try {
    if (
      !env.WHATSAPP_ORGANIZATION_ID ||
      !env.WHATSAPP_CREDENTIAL_KEY ||
      !(env.WHATSAPP_APP_SECRET || env.META_APP_SECRET)
    )
      return json({ error: "WhatsApp não configurado." }, 503);
    if (request.method === "GET") {
      const query = new URL(request.url).searchParams,
        token = query.get("hub.verify_token");
      const accounts = await store.accountsForWebhook(env.WHATSAPP_ORGANIZATION_ID);
      const matched = accounts.some((account) =>
          safeEqual(token, credential(account, env).verify_token),
        ),
        challenge = query.get("hub.challenge");
      if (query.get("hub.mode") !== "subscribe" || !matched || !challenge || challenge.length > 200)
        return json({ error: "Verificação inválida." }, 403);
      return new Response(challenge, {
        headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers });
    const raw = await readBody(request, 1024 * 1024);
    if (
      !validWhatsAppSignature(
        raw,
        request.headers.get("x-hub-signature-256"),
        env.WHATSAPP_APP_SECRET || env.META_APP_SECRET,
      )
    )
      return json({ error: "Assinatura inválida." }, 401);
    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      throw fail("JSON inválido.");
    }
    const accounts = await store.accounts(env.WHATSAPP_ORGANIZATION_ID),
      events = parseWhatsAppWebhook(payload, accounts);
    let accepted = 0;
    for (const account of accounts.filter((account) => account.enabled)) {
      const matched = events.filter(
        (event) =>
          event.account_id === account.id && event.organization_id === account.organization_id,
      );
      if (matched.length) accepted += (await store.enqueueEvents(account, matched)).accepted;
    }
    return json({ accepted });
  } catch (error) {
    return json(
      { error: "Evento WhatsApp não confirmado. Tente novamente." },
      error?.status === 413 ? 413 : 503,
    );
  }
}
/** Inbound work survives restarts. Outbound work always requires a freshly authorized operator. */
let lastRetentionSweep = 0;
export async function tickWhatsApp(store) {
  const jobs = await store.leaseEvents(25);
  for (const job of jobs) {
    try {
      await store.processEvent(job);
    } catch (error) {
      await store.failEvent(job, String(error?.code || "WHATSAPP_PROCESSING_FAILED").slice(0, 100));
    }
  }
  if (store.recoverOutbox) await store.recoverOutbox();
  if (store.expireContent && Date.now() - lastRetentionSweep >= 60000) {
    await store.expireContent(25);
    lastRetentionSweep = Date.now();
  }
}
