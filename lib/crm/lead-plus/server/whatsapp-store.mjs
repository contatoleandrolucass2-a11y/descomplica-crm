import { randomUUID, createHash } from "node:crypto";
import { leadRequestAuditDetail } from "./request-audit-context.mjs";

const failure = (message, status = 409) => Object.assign(new Error(message), { status });
const json = (value) => JSON.stringify(value);
const pageSize = (value = 40) => Math.min(100, Math.max(1, Number(value) || 40));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const publicAccount = (row) => {
  if (!row) return null;
  const safe = { ...row };
  delete safe.secret_ciphertext;
  delete safe.next_index;
  return { ...safe, has_credentials: Boolean(row.secret_ciphertext) };
};
const rank = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
export function nextDeliveryStatus(current, incoming) {
  if (!(incoming in rank) && incoming !== "failed") return current;
  if (incoming === "failed") return ["delivered", "read"].includes(current) ? current : "failed";
  return (rank[incoming] ?? -1) > (rank[current] ?? -1) ? incoming : current;
}
const publicMessage = (row) => {
  if (!row) return null;
  const rest = { ...row },
    content = { ...(row.content || {}) };
  delete rest.lease_token;
  delete rest.lease_until;
  delete content._request_hash;
  return { ...rest, content, whatsapp_message_id: row.provider_id };
};
const conversationSelect = `SELECT v.*,p.name,p.phone,l.stage,l.value,
 COALESCE(u.data->>'name','Não atribuído') assigned_user_name,
 (SELECT count(*)::int FROM c2s_app.wa_messages m WHERE m.organization_id=v.organization_id AND m.conversation_id=v.id
 AND m.direction='inbound' AND m.created_at>COALESCE((SELECT last_read_at FROM c2s_app.wa_reads r
 WHERE r.organization_id=v.organization_id AND r.conversation_id=v.id AND r.user_id=$2),'-infinity')) unread_count
 FROM c2s_app.wa_conversations v JOIN c2s_app.contacts p ON p.id=v.contact_id
 JOIN c2s_app.leads l ON l.id=v.lead_id LEFT JOIN c2s_app.resources u ON u.kind='users' AND u.id=v.assigned_user_id`;

/** The installation binds one organization on the server. No organization identifier from the browser is trusted. */
export function whatsappStore(pool) {
  const transaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  const validateOrganization = (organization) => {
    if (typeof organization !== "string" || !organization || organization.length > 120)
      throw failure("Organização de atendimento não configurada.", 503);
    return organization;
  };
  const member = async (client, scope, id = scope.user_id) => {
    validateOrganization(scope.organization_id);
    const row = (
      await client.query(
        "SELECT data FROM c2s_app.resources WHERE kind='users' AND id=$1 FOR SHARE",
        [id],
      )
    ).rows[0];
    if (
      !row ||
      row.data.active !== true ||
      !["admin", "superintendent", "manager", "broker"].includes(row.data.role) ||
      (row.data.organization_id
        ? row.data.organization_id !== scope.organization_id
        : scope.single_organization !== true) ||
      (id === scope.user_id &&
        (row.data.role !== scope.role || (row.data.team || "") !== (scope.team || "")))
    )
      throw failure("Usuário sem acesso ativo à organização.", 403);
    return { ...row.data, id };
  };
  const permittedTeam = (scope, team) => scope.all === true || !team || team === scope.team;
  const canRead = (scope, conversation) =>
    conversation.organization_id === scope.organization_id &&
    (conversation.assigned_user_id === scope.user_id ||
      (scope.can_manage === true &&
        (scope.all === true ||
          (scope.allowed_user_ids || []).includes(conversation.assigned_user_id))) ||
      (scope.queue_visible === true &&
        conversation.status === "waiting" &&
        permittedTeam(scope, conversation.team)));
  const assertConversation = async (client, scope, id, lock = false) => {
    await member(client, scope);
    const row = (
      await client.query(
        "SELECT * FROM c2s_app.wa_conversations WHERE organization_id=$1 AND id=$2" +
          (lock ? " FOR UPDATE" : ""),
        [scope.organization_id, id],
      )
    ).rows[0];
    if (!row || !canRead(scope, row))
      throw failure("Atendimento não encontrado no seu escopo.", 404);
    return row;
  };
  const assertOwned = (scope, row) => {
    if (row.status !== "active" || row.assigned_user_id !== scope.user_id)
      throw failure("Assuma o atendimento antes de responder.", 403);
  };
  const assertVersion = (row, version) => {
    if (!Number.isInteger(version) || row.version !== version)
      throw failure("Atendimento alterado por outro usuário. Atualize a conversa.");
  };
  const change = async (client, organization, conversationId, event) => {
    await client.query(
      "INSERT INTO c2s_app.wa_changes(organization_id,conversation_id,event) VALUES($1,$2,$3)",
      [organization, conversationId, event],
    );
  };
  const audit = async (client, scope, id, action, detail = {}) => {
    await client.query(
      "INSERT INTO c2s_app.audit(entity,entity_id,action,detail) VALUES('whatsapp',$1,$2,$3)",
      [
        id,
        action,
        json(
          leadRequestAuditDetail({
            organization_id: scope.organization_id,
            actor_user_id: scope.user_id,
            ...detail,
          }),
        ),
      ],
    );
  };
  const history = async (client, scope, row, target, action) => {
    await client.query(
      "INSERT INTO c2s_app.wa_assignment_history(id,organization_id,conversation_id,previous_user_id,new_user_id,action,performed_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        scope.organization_id,
        row.id,
        row.assigned_user_id,
        target,
        action,
        scope.user_id || null,
      ],
    );
    await audit(client, scope, row.id, action, {
      previous_user_id: row.assigned_user_id,
      new_user_id: target,
    });
    await change(
      client,
      scope.organization_id,
      row.id,
      action === "closed"
        ? "conversation.closed"
        : action === "assigned"
          ? "conversation.assigned"
          : "conversation.transferred",
    );
  };
  const readPredicate = `v.organization_id=$1 AND (v.assigned_user_id=$2 OR ($3::boolean AND ($4::boolean OR v.assigned_user_id=ANY($5::text[]))) OR ($6::boolean AND v.status='waiting' AND ($4::boolean OR v.team='' OR v.team=$7)))`;
  const scopeArgs = (scope) => [
    scope.organization_id,
    scope.user_id,
    scope.can_manage === true,
    scope.all === true,
    scope.allowed_user_ids || [],
    scope.queue_visible === true,
    scope.team || "",
  ];
  const accountInternal = async (client, organization, id, lock = false) =>
    (
      await client.query(
        "SELECT * FROM c2s_app.wa_accounts WHERE organization_id=$1 AND id=$2" +
          (lock ? " FOR UPDATE" : ""),
        [validateOrganization(organization), id],
      )
    ).rows[0] || null;
  const accounts = async (organization) =>
    (
      await pool.query(
        "SELECT * FROM c2s_app.wa_accounts WHERE organization_id=$1 ORDER BY created_at,id",
        [validateOrganization(organization)],
      )
    ).rows.map(publicAccount);
  const account = (organization, id) => accountInternal(pool, organization, id);
  const accountsForWebhook = async (organization) =>
    (
      await pool.query(
        "SELECT * FROM c2s_app.wa_accounts WHERE organization_id=$1 ORDER BY created_at,id",
        [validateOrganization(organization)],
      )
    ).rows;
  const settings = async (organization, accountId) => {
    const list = await accounts(organization);
    const row = accountId ? list.find((item) => item.id === accountId) : list[0];
    return row
      ? {
          account_id: row.id,
          distribution_mode: row.distribution_mode,
          mode: row.distribution_mode === "automatic" ? "round_robin" : row.distribution_mode,
          max_conversations: row.max_conversations,
          max_concurrent: row.max_conversations,
          retention_days: row.retention_days,
          team: row.team,
          version: row.version,
        }
      : {
          account_id: null,
          distribution_mode: "shared",
          mode: "shared",
          max_conversations: 10,
          max_concurrent: 10,
          retention_days: 365,
          team: "",
          version: 0,
        };
  };
  const findWebhookAccount = async (phoneNumberId, wabaId) =>
    (
      await pool.query(
        "SELECT * FROM c2s_app.wa_accounts WHERE phone_number_id=$1 AND waba_id=$2 AND enabled=true",
        [phoneNumberId, wabaId],
      )
    ).rows[0] || null;
  const saveAccount = (organization, input, scope) =>
    transaction(async (client) => {
      validateOrganization(organization);
      if (scope) {
        if (scope.organization_id !== organization || !scope.can_configure)
          throw failure("Sem permissão para configurar números.", 403);
        const actor = await member(client, scope);
        if (actor.role !== "admin") throw failure("Somente Admin configura a integração.", 403);
      }
      const id = input.id || randomUUID();
      const previous = await accountInternal(client, organization, id, true);
      if (previous) assertVersion(previous, input.version);
      const ciphertext = input.secret_ciphertext || previous?.secret_ciphertext;
      if (!ciphertext) throw failure("Credencial criptografada necessária.", 422);
      let row;
      if (previous) {
        row = (
          await client.query(
            "UPDATE c2s_app.wa_accounts SET app_id=$3,waba_id=$4,phone_number_id=$5,display_phone_number=$6,business_name=$7,graph_version=$8,secret_ciphertext=$9,enabled=$10,connection_status=$11,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
            [
              organization,
              id,
              input.app_id,
              input.waba_id,
              input.phone_number_id,
              input.display_phone_number || "",
              input.business_name || "",
              input.graph_version,
              ciphertext,
              input.enabled === true,
              input.connection_status || "unverified",
            ],
          )
        ).rows[0];
      } else {
        row = (
          await client.query(
            "INSERT INTO c2s_app.wa_accounts(id,organization_id,app_id,waba_id,phone_number_id,display_phone_number,business_name,graph_version,secret_ciphertext,enabled,connection_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
            [
              id,
              organization,
              input.app_id,
              input.waba_id,
              input.phone_number_id,
              input.display_phone_number || "",
              input.business_name || "",
              input.graph_version,
              ciphertext,
              input.enabled === true,
              input.connection_status || "unverified",
            ],
          )
        ).rows[0];
      }
      await audit(
        client,
        scope || { organization_id: organization, user_id: null },
        id,
        previous ? "account.updated" : "account.created",
      );
      return publicAccount(row);
    });
  const saveSettings = (scope, accountId, input) =>
    transaction(async (client) => {
      const actor = await member(client, scope);
      if (!scope.can_configure || actor.role !== "admin")
        throw failure("Somente Admin configura a distribuição.", 403);
      const row = await accountInternal(client, scope.organization_id, accountId, true);
      if (!row) throw failure("Número não encontrado.", 404);
      assertVersion(row, input.version);
      if (
        !["shared", "automatic", "manual"].includes(input.distribution_mode) ||
        !Number.isInteger(input.max_conversations) ||
        input.max_conversations < 1 ||
        input.max_conversations > 1000 ||
        !Number.isInteger(input.retention_days) ||
        input.retention_days < 1 ||
        input.retention_days > 3650 ||
        typeof input.team !== "string" ||
        input.team.length > 120
      )
        throw failure("Configuração de atendimento inválida.", 422);
      const result = (
        await client.query(
          "UPDATE c2s_app.wa_accounts SET distribution_mode=$3,max_conversations=$4,retention_days=$5,team=$6,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
          [
            scope.organization_id,
            accountId,
            input.distribution_mode,
            input.max_conversations,
            input.retention_days,
            input.team,
          ],
        )
      ).rows[0];
      await audit(client, scope, accountId, "settings.updated", {
        distribution_mode: input.distribution_mode,
      });
      return publicAccount(result);
    });
  const setAvailability = (scope, available) =>
    transaction(async (client) => {
      await member(client, scope);
      if (typeof available !== "boolean") throw failure("Disponibilidade inválida.", 422);
      await client.query(
        "INSERT INTO c2s_app.wa_availability(organization_id,user_id,available) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET available=excluded.available,updated_at=now()",
        [scope.organization_id, scope.user_id, available],
      );
      return { available };
    });
  const availability = async (scope) => {
    await member(pool, scope);
    return {
      available:
        (
          await pool.query(
            "SELECT available FROM c2s_app.wa_availability WHERE organization_id=$1 AND user_id=$2",
            [scope.organization_id, scope.user_id],
          )
        ).rows[0]?.available === true,
    };
  };
  const enqueueEvents = (accountRow, incoming) =>
    transaction(async (client) => {
      const active = await accountInternal(client, accountRow.organization_id, accountRow.id, true);
      if (
        !active?.enabled ||
        active.phone_number_id !== accountRow.phone_number_id ||
        active.waba_id !== accountRow.waba_id
      )
        throw failure("Número não está ativo.", 503);
      let accepted = 0;
      for (const event of incoming) {
        if (
          !event.provider_event_key ||
          event.provider_event_key.length > 600 ||
          !["message", "status"].includes(event.kind)
        )
          throw failure("Evento inválido.", 422);
        const result = await client.query(
          "INSERT INTO c2s_app.wa_webhook_events(id,organization_id,account_id,provider_event_key,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,account_id,provider_event_key) DO NOTHING",
          [randomUUID(), active.organization_id, active.id, event.provider_event_key, json(event)],
        );
        accepted += result.rowCount;
      }
      return { accepted, duplicate: incoming.length - accepted };
    });
  const leaseEvents = (limit = 25) =>
    transaction(async (client) => {
      const token = randomUUID();
      const result = await client.query(
        "WITH ready AS (SELECT e.id FROM c2s_app.wa_webhook_events e JOIN c2s_app.wa_accounts a ON a.organization_id=e.organization_id AND a.id=e.account_id WHERE a.enabled AND e.attempts<8 AND e.next_at<=now() AND (e.status IN ('pending','retry') OR (e.status='processing' AND e.lease_until<now())) ORDER BY e.next_at,e.id LIMIT $1 FOR UPDATE OF e SKIP LOCKED) UPDATE c2s_app.wa_webhook_events e SET status='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '60 seconds' FROM ready WHERE e.id=ready.id RETURNING e.*",
        [pageSize(limit), token],
      );
      return result.rows;
    });
  const applyStatus = async (client, accountRow, event) => {
    const message = (
      await client.query(
        "SELECT * FROM c2s_app.wa_messages WHERE organization_id=$1 AND account_id=$2 AND provider_id=$3 FOR UPDATE",
        [accountRow.organization_id, accountRow.id, event.whatsapp_message_id],
      )
    ).rows[0];
    // A status can arrive before the send response commits. Retrying the persisted event reconciles it later.
    if (!message) throw failure("Status aguardando a confirmação do envio.", 425);
    const olderFailure =
      event.status === "failed" &&
      message.status_at &&
      new Date(event.timestamp) < new Date(message.status_at);
    const status = olderFailure
      ? message.delivery_status
      : nextDeliveryStatus(message.delivery_status, event.status);
    if (status !== message.delivery_status) {
      await client.query(
        "UPDATE c2s_app.wa_messages SET delivery_status=$3,status_at=GREATEST(COALESCE(status_at,'-infinity'),$4::timestamptz),error_code=$5 WHERE organization_id=$1 AND id=$2",
        [
          accountRow.organization_id,
          message.id,
          status,
          event.timestamp,
          status === "failed" ? String(event.error_code || "META_REJECTED").slice(0, 120) : null,
        ],
      );
      await change(
        client,
        accountRow.organization_id,
        message.conversation_id,
        "message.status.updated",
      );
    }
  };
  const processEvent = (job) =>
    transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,730201))", [
        job.organization_id,
      ]);
      const current = (
        await client.query(
          "SELECT * FROM c2s_app.wa_webhook_events WHERE id=$1 AND status='processing' AND lease_token=$2 AND lease_until>now() FOR UPDATE",
          [job.id, job.lease_token],
        )
      ).rows[0];
      if (!current) return { skipped: true };
      const accountRow = await accountInternal(
        client,
        current.organization_id,
        current.account_id,
        true,
      );
      if (!accountRow?.enabled) throw failure("Número desativado.", 503);
      const event = current.payload;
      if (event.kind === "status") {
        await applyStatus(client, accountRow, event);
      } else {
        if (
          !/^[1-9]\d{6,19}$/.test(event.from || "") ||
          !event.whatsapp_message_id ||
          !Number.isFinite(Date.parse(event.timestamp))
        )
          throw failure("Mensagem inválida.", 422);
        const duplicate = await client.query(
          "SELECT id FROM c2s_app.wa_messages WHERE organization_id=$1 AND account_id=$2 AND provider_id=$3",
          [current.organization_id, current.account_id, event.whatsapp_message_id],
        );
        if (!duplicate.rowCount) {
          // Account row lock serializes active-conversation creation for this number; the unique partial index is a second guard.
          let mapping = (
            await client.query(
              "SELECT contact_id FROM c2s_app.wa_contacts WHERE organization_id=$1 AND account_id=$2 AND wa_id=$3",
              [current.organization_id, current.account_id, event.from],
            )
          ).rows[0];
          if (!mapping) {
            const existing = (
              await client.query(
                "SELECT p.id FROM c2s_app.contacts p WHERE p.phone=$1 AND (EXISTS(SELECT 1 FROM c2s_app.wa_contacts w WHERE w.contact_id=p.id AND w.organization_id=$2) OR EXISTS(SELECT 1 FROM c2s_app.leads l WHERE l.contact_id=p.id AND l.attribution->>'organization_id'=$2)) AND NOT EXISTS(SELECT 1 FROM c2s_app.wa_contacts w WHERE w.contact_id=p.id AND w.organization_id<>$2) AND NOT EXISTS(SELECT 1 FROM c2s_app.leads l WHERE l.contact_id=p.id AND NULLIF(l.attribution->>'organization_id','') IS NOT NULL AND l.attribution->>'organization_id'<>$2) ORDER BY p.created_at,p.id LIMIT 1",
                ["+" + event.from, current.organization_id],
              )
            ).rows[0];
            mapping = { contact_id: existing?.id || randomUUID() };
            if (!existing)
              await client.query("INSERT INTO c2s_app.contacts(id,name,phone) VALUES($1,$2,$3)", [
                mapping.contact_id,
                String(event.contact_name || event.from).slice(0, 160),
                "+" + event.from,
              ]);
            await client.query(
              "INSERT INTO c2s_app.wa_contacts(organization_id,account_id,wa_id,contact_id) VALUES($1,$2,$3,$4)",
              [current.organization_id, current.account_id, event.from, mapping.contact_id],
            );
          }
          let conversation = (
            await client.query(
              "SELECT * FROM c2s_app.wa_conversations WHERE organization_id=$1 AND account_id=$2 AND wa_id=$3 AND status<>'closed' FOR UPDATE",
              [current.organization_id, current.account_id, event.from],
            )
          ).rows[0];
          if (!conversation) {
            conversation = { id: randomUUID(), lead_id: randomUUID() };
            const referral = event.referral || {};
            await client.query(
              "INSERT INTO c2s_app.leads(id,contact_id,product,source,external_id,attribution) VALUES($1,$2,$3,'whatsapp',$4,$5)",
              [
                conversation.lead_id,
                mapping.contact_id,
                "WhatsApp",
                conversation.id,
                json({
                  organization_id: current.organization_id,
                  whatsapp_account_id: current.account_id,
                  whatsapp_conversation_id: conversation.id,
                  referral,
                }),
              ],
            );
            await client.query(
              "INSERT INTO c2s_app.wa_conversations(id,organization_id,account_id,wa_id,contact_id,lead_id,team,referral,source_campaign_id,source_campaign_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
              [
                conversation.id,
                current.organization_id,
                current.account_id,
                event.from,
                mapping.contact_id,
                conversation.lead_id,
                accountRow.team,
                json(referral),
                referral.campaign_id || null,
                referral.campaign_name || null,
              ],
            );
            await change(client, current.organization_id, conversation.id, "lead.received");
            await change(client, current.organization_id, conversation.id, "conversation.created");
            if (accountRow.distribution_mode === "automatic")
              await autoAssign(client, accountRow, conversation.id);
          }
          const text = String(
            event.content?.text || event.content?.caption || "[" + event.type + "]",
          ).slice(0, 250);
          await client.query(
            "INSERT INTO c2s_app.wa_messages(id,organization_id,account_id,conversation_id,provider_id,direction,type,content,media_reference,delivery_status,received_at,created_at) VALUES($1,$2,$3,$4,$5,'inbound',$6,$7,$8,'received',$9,$9)",
            [
              randomUUID(),
              current.organization_id,
              current.account_id,
              conversation.id,
              event.whatsapp_message_id,
              event.type || "unsupported",
              json(event.content || {}),
              event.media_id
                ? json({ id: event.media_id, mime_type: event.content?.mime_type || null })
                : null,
              event.timestamp,
            ],
          );
          await client.query(
            "UPDATE c2s_app.wa_conversations SET last_customer_message_at=GREATEST(COALESCE(last_customer_message_at,'-infinity'),$3::timestamptz),last_message_preview=CASE WHEN last_message_at IS NULL OR last_message_at<=$3::timestamptz THEN $4 ELSE last_message_preview END,last_message_at=GREATEST(COALESCE(last_message_at,'-infinity'),$3::timestamptz),version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
            [current.organization_id, conversation.id, event.timestamp, text],
          );
          await change(client, current.organization_id, conversation.id, "message.received");
        }
      }
      await client.query(
        "UPDATE c2s_app.wa_webhook_events SET status='completed',processed_at=now(),lease_token=NULL,lease_until=NULL,payload='{}'::jsonb,error_code=NULL WHERE id=$1",
        [job.id],
      );
      return { processed: true };
    });
  const failEvent = async (job, errorCode = "PROCESSING_FAILED") => {
    const code = /^[A-Z0-9_]{1,120}$/.test(errorCode) ? errorCode : "PROCESSING_FAILED";
    await pool.query(
      "UPDATE c2s_app.wa_webhook_events SET status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'retry' END,next_at=now()+LEAST(3600,power(2,attempts)::int)*interval '1 second',error_code=$3,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND status='processing'",
      [job.id, job.lease_token, code],
    );
  };
  const checkTarget = async (client, scope, accountRow, targetId, ownClaim = false) => {
    const target = await member(client, scope, targetId);
    if (
      targetId !== scope.user_id &&
      !(scope.can_manage && (scope.all || (scope.allowed_user_ids || []).includes(targetId)))
    )
      throw failure("Responsável fora do seu escopo.", 403);
    if (accountRow.team && target.team !== accountRow.team)
      throw failure("Responsável fora da equipe do número.", 403);
    const available = (
      await client.query(
        "SELECT available FROM c2s_app.wa_availability WHERE organization_id=$1 AND user_id=$2",
        [scope.organization_id, targetId],
      )
    ).rows[0]?.available;
    if (available !== true && !ownClaim) throw failure("Corretor não está disponível.", 422);
    if (available === false)
      throw failure("Ative sua disponibilidade para assumir atendimentos.", 422);
    const count = (
      await client.query(
        "SELECT count(*)::int total FROM c2s_app.wa_conversations WHERE organization_id=$1 AND assigned_user_id=$2 AND status='active'",
        [scope.organization_id, targetId],
      )
    ).rows[0].total;
    if (count >= accountRow.max_conversations)
      throw failure("Limite de atendimentos simultâneos atingido.", 422);
    return target;
  };
  const autoAssign = async (client, accountRow, conversationId) => {
    const users = (
      await client.query(
        "SELECT r.id FROM c2s_app.resources r JOIN c2s_app.wa_availability a ON a.organization_id=$1 AND a.user_id=r.id WHERE r.kind='users' AND r.data->>'active'='true' AND r.data->>'role' IN ('admin','superintendent','manager','broker') AND (NULLIF(r.data->>'organization_id','') IS NULL OR r.data->>'organization_id'=$1) AND ($2='' OR r.data->>'team'=$2) AND a.available AND a.updated_at>now()-interval '5 minutes' AND (SELECT count(*) FROM c2s_app.wa_conversations v WHERE v.organization_id=$1 AND v.assigned_user_id=r.id AND v.status='active')<$3 ORDER BY r.id FOR SHARE OF r",
        [accountRow.organization_id, accountRow.team, accountRow.max_conversations],
      )
    ).rows;
    if (!users.length) return;
    const chosen = users[Number(BigInt(accountRow.next_index) % BigInt(users.length))].id;
    await client.query("UPDATE c2s_app.wa_accounts SET next_index=next_index+1 WHERE id=$1", [
      accountRow.id,
    ]);
    await client.query(
      "UPDATE c2s_app.wa_conversations SET assigned_user_id=$2,status='active',assigned_at=now(),version=version+1 WHERE id=$1",
      [conversationId, chosen],
    );
    const row = (
      await client.query("SELECT lead_id FROM c2s_app.wa_conversations WHERE id=$1", [
        conversationId,
      ])
    ).rows[0];
    await client.query(
      "UPDATE c2s_app.leads SET owner_id=$2,stage=CASE WHEN stage=0 THEN 1 ELSE stage END,version=version+1,updated_at=now() WHERE id=$1",
      [row.lead_id, chosen],
    );
    await history(
      client,
      { organization_id: accountRow.organization_id, user_id: null },
      { id: conversationId, assigned_user_id: null },
      chosen,
      "assigned",
    );
  };
  const conversations = async (scope, filters = {}) => {
    await member(pool, scope);
    const args = scopeArgs(scope),
      conditions = [readPredicate];
    if (filters.status && ["waiting", "active", "closed"].includes(filters.status)) {
      args.push(filters.status);
      conditions.push(`v.status=$${args.length}`);
    }
    if (filters.filter === "mine") conditions.push("v.assigned_user_id=$2");
    if (filters.filter === "unanswered")
      conditions.push(
        "v.last_customer_message_at IS NOT NULL AND v.last_customer_message_at>COALESCE((SELECT max(m.sent_at) FROM c2s_app.wa_messages m WHERE m.organization_id=v.organization_id AND m.conversation_id=v.id AND m.direction='outbound' AND m.sent_at IS NOT NULL),'-infinity')",
      );
    if (filters.filter === "transferred")
      conditions.push(
        "EXISTS(SELECT 1 FROM c2s_app.wa_assignment_history h WHERE h.organization_id=v.organization_id AND h.conversation_id=v.id AND h.action='transferred')",
      );
    if (filters.search) {
      args.push(
        "%" +
          String(filters.search)
            .replace(/[\\%_]/g, "\\$&")
            .slice(0, 160) +
          "%",
      );
      conditions.push(`(p.name ILIKE $${args.length} OR p.phone ILIKE $${args.length})`);
    }
    if (filters.before) {
      args.push(filters.before);
      conditions.push(
        `(COALESCE(v.last_message_at,v.created_at),v.id)<(SELECT COALESCE(last_message_at,created_at),id FROM c2s_app.wa_conversations WHERE organization_id=$1 AND id=$${args.length}::uuid)`,
      );
    }
    args.push(pageSize(filters.limit));
    const result = await pool.query(
      conversationSelect +
        " WHERE " +
        conditions.join(" AND ") +
        ` ORDER BY COALESCE(v.last_message_at,v.created_at) DESC,v.id DESC LIMIT $${args.length}`,
      args,
    );
    return {
      data: result.rows,
      next_cursor: result.rows.length === pageSize(filters.limit) ? result.rows.at(-1).id : null,
    };
  };
  const conversation = async (scope, id) => {
    await assertConversation(pool, scope, id);
    return (
      await pool.query(conversationSelect + " WHERE v.organization_id=$1 AND v.id=$3", [
        scope.organization_id,
        scope.user_id,
        id,
      ])
    ).rows[0];
  };
  const messages = async (scope, id, options = {}) => {
    await assertConversation(pool, scope, id);
    const args = [scope.organization_id, id];
    let cursor = "";
    if (options.before) {
      args.push(options.before);
      cursor =
        " AND (created_at,id)<(SELECT created_at,id FROM c2s_app.wa_messages WHERE organization_id=$1 AND conversation_id=$2 AND id=$3::uuid)";
    }
    args.push(pageSize(options.limit));
    const result = await pool.query(
      "SELECT * FROM c2s_app.wa_messages WHERE organization_id=$1 AND conversation_id=$2" +
        cursor +
        ` ORDER BY created_at DESC,id DESC LIMIT $${args.length}`,
      args,
    );
    return {
      data: result.rows.map(publicMessage).reverse(),
      next_cursor: result.rows.length === pageSize(options.limit) ? result.rows.at(-1).id : null,
    };
  };
  const notes = async (scope, id) => {
    await assertConversation(pool, scope, id);
    return (
      await pool.query(
        "SELECT id,user_id,body,created_at FROM c2s_app.wa_internal_notes WHERE organization_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100",
        [scope.organization_id, id],
      )
    ).rows;
  };
  const assignmentHistory = async (scope, id) => {
    await assertConversation(pool, scope, id);
    return (
      await pool.query(
        "SELECT id,previous_user_id,new_user_id,action,performed_by,created_at FROM c2s_app.wa_assignment_history WHERE organization_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100",
        [scope.organization_id, id],
      )
    ).rows;
  };
  const addNote = (scope, id, body) =>
    transaction(async (client) => {
      await assertConversation(client, scope, id, true);
      if (typeof body !== "string" || !body.trim() || body.length > 10000)
        throw failure("Observação inválida.", 422);
      const row = (
        await client.query(
          "INSERT INTO c2s_app.wa_internal_notes(id,organization_id,conversation_id,user_id,body) VALUES($1,$2,$3,$4,$5) RETURNING id,user_id,body,created_at",
          [randomUUID(), scope.organization_id, id, scope.user_id, body.trim()],
        )
      ).rows[0];
      await audit(client, scope, id, "note.created");
      await change(client, scope.organization_id, id, "lead.updated");
      return row;
    });
  const markRead = (scope, id) =>
    transaction(async (client) => {
      await assertConversation(client, scope, id);
      await client.query(
        "INSERT INTO c2s_app.wa_reads(organization_id,conversation_id,user_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,conversation_id,user_id) DO UPDATE SET last_read_at=now()",
        [scope.organization_id, id, scope.user_id],
      );
      return { read: true };
    });
  const claim = (scope, id, version) =>
    transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,730201))", [
        scope.organization_id,
      ]);
      const row = await assertConversation(client, scope, id, true);
      if (row.status !== "waiting" || row.assigned_user_id)
        throw failure("Atendimento já assumido por outro usuário.");
      assertVersion(row, version);
      const accountRow = await accountInternal(client, scope.organization_id, row.account_id, true);
      if (!accountRow?.enabled || accountRow.distribution_mode === "manual")
        throw failure("Este atendimento depende de distribuição pelo supervisor.", 403);
      await checkTarget(client, scope, accountRow, scope.user_id, true);
      await client.query(
        "UPDATE c2s_app.wa_conversations SET assigned_user_id=$3,status='active',assigned_at=now(),version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [scope.organization_id, id, scope.user_id],
      );
      await client.query(
        "UPDATE c2s_app.leads SET owner_id=$2,stage=CASE WHEN stage=0 THEN 1 ELSE stage END,version=version+1,updated_at=now() WHERE id=$1",
        [row.lead_id, scope.user_id],
      );
      await history(client, scope, row, scope.user_id, "assigned");
      return { id, assigned_user_id: scope.user_id, status: "active", version: row.version + 1 };
    });
  const move = (scope, id, input) =>
    transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,730201))", [
        scope.organization_id,
      ]);
      const row = await assertConversation(client, scope, id, true);
      assertVersion(row, input.version);
      if (row.status === "closed") throw failure("Atendimento já finalizado.");
      const accountRow = await accountInternal(client, scope.organization_id, row.account_id, true);
      if (!scope.can_manage && row.assigned_user_id !== scope.user_id)
        throw failure("Sem permissão para alterar este atendimento.", 403);
      if (!["transfer", "requeue", "close"].includes(input.action))
        throw failure("Movimentação inválida.", 422);
      if (input.action === "transfer" && !scope.can_manage)
        throw failure("Somente supervisão pode transferir.", 403);
      let target = null,
        status = "waiting",
        action = "requeued";
      if (input.action === "transfer") {
        target = input.target_user_id;
        await checkTarget(client, scope, accountRow, target);
        status = "active";
        action = "transferred";
      }
      if (input.action === "close") {
        target = row.assigned_user_id;
        status = "closed";
        action = "closed";
      }
      await client.query(
        "UPDATE c2s_app.wa_conversations SET assigned_user_id=$3,status=$4,assigned_at=CASE WHEN $4='active' THEN now() ELSE assigned_at END,closed_at=CASE WHEN $4='closed' THEN now() ELSE NULL END,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [scope.organization_id, id, target, status],
      );
      await client.query(
        "UPDATE c2s_app.leads SET owner_id=$2,version=version+1,updated_at=now() WHERE id=$1",
        [row.lead_id, target],
      );
      await history(client, scope, row, target, action);
      return { id, assigned_user_id: target, status, version: row.version + 1 };
    });
  const queueMessage = (scope, id, input) =>
    transaction(async (client) => {
      const row = await assertConversation(client, scope, id, true);
      assertOwned(scope, row);
      if (
        !uuid.test(input.client_message_id || "") ||
        !["text", "image", "document", "audio", "template"].includes(input.type)
      )
        throw failure("Mensagem inválida.", 422);
      const accountRow = await accountInternal(client, scope.organization_id, row.account_id, true);
      if (!accountRow?.enabled) throw failure("Número desativado.", 503);
      const fingerprintContent = { ...input.content };
      const fingerprintMedia = input.media_reference?.sha256
        ? {
            sha256: input.media_reference.sha256,
            mime_type: input.media_reference.mime_type || null,
            filename: input.media_reference.filename || null,
          }
        : input.media_reference || null;
      if (input.media_reference?.sha256) delete fingerprintContent.media_id;
      const hash = createHash("sha256")
        .update(json([id, input.type, fingerprintContent, fingerprintMedia]))
        .digest("hex");
      const previous = (
        await client.query(
          "SELECT * FROM c2s_app.wa_messages WHERE organization_id=$1 AND client_message_id=$2",
          [scope.organization_id, input.client_message_id],
        )
      ).rows[0];
      if (previous) {
        if (previous.conversation_id !== id || previous.content?._request_hash !== hash)
          throw failure("Identificador de mensagem já utilizado com outro conteúdo.");
        return publicMessage(previous);
      }
      const message = (
        await client.query(
          "INSERT INTO c2s_app.wa_messages(id,organization_id,account_id,conversation_id,client_message_id,direction,type,content,media_reference,delivery_status,sent_by) VALUES($1,$2,$3,$4,$5,'outbound',$6,$7,$8,'queued',$9) RETURNING *",
          [
            randomUUID(),
            scope.organization_id,
            row.account_id,
            id,
            input.client_message_id,
            input.type,
            json({ ...input.content, _request_hash: hash }),
            input.media_reference ? json(input.media_reference) : null,
            scope.user_id,
          ],
        )
      ).rows[0];
      await audit(client, scope, id, "message.queued", { message_id: message.id });
      await change(client, scope.organization_id, id, "message.sent");
      return publicMessage(message);
    });
  const beginSend = (scope, id, messageId) =>
    transaction(async (client) => {
      const row = await assertConversation(client, scope, id, true);
      assertOwned(scope, row);
      const accountRow = await accountInternal(client, scope.organization_id, row.account_id, true);
      if (!accountRow?.enabled) throw failure("Número desativado.", 503);
      const message = (
        await client.query(
          "SELECT * FROM c2s_app.wa_messages WHERE organization_id=$1 AND conversation_id=$2 AND id=$3 FOR UPDATE",
          [scope.organization_id, id, messageId],
        )
      ).rows[0];
      if (!message || message.direction !== "outbound" || message.sent_by !== scope.user_id)
        throw failure("Mensagem não encontrada.", 404);
      if (message.delivery_status === "sending" && message.lease_until < new Date()) {
        await client.query(
          "UPDATE c2s_app.wa_messages SET delivery_status='uncertain',error_code='DELIVERY_UNKNOWN',lease_until=NULL WHERE id=$1",
          [messageId],
        );
        return {
          ...publicMessage(message),
          delivery_status: "uncertain",
          account: accountRow,
          wa_id: row.wa_id,
          conversation: row,
        };
      }
      if (!["queued", "failed"].includes(message.delivery_status) || message.attempts >= 3)
        return {
          ...publicMessage(message),
          account: accountRow,
          wa_id: row.wa_id,
          conversation: row,
          send_allowed: false,
        };
      if (
        message.type !== "template" &&
        (!row.last_customer_message_at ||
          Date.now() - new Date(row.last_customer_message_at).getTime() >= 24 * 60 * 60 * 1000)
      )
        throw failure("Janela de 24 horas encerrada. Utilize um modelo aprovado.", 422);
      const token = randomUUID();
      const sending = (
        await client.query(
          "UPDATE c2s_app.wa_messages SET delivery_status='sending',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '90 seconds',error_code=NULL WHERE id=$1 RETURNING *",
          [messageId, token],
        )
      ).rows[0];
      return {
        ...sending,
        send_allowed: true,
        account: accountRow,
        wa_id: row.wa_id,
        conversation: row,
      };
    });
  const finishSend = (job, result) =>
    transaction(async (client) => {
      const row = (
        await client.query(
          "SELECT * FROM c2s_app.wa_messages WHERE id=$1 AND organization_id=$2 AND lease_token=$3 AND delivery_status='sending' FOR UPDATE",
          [job.id, job.organization_id, job.lease_token],
        )
      ).rows[0];
      if (!row) return { updated: false };
      const status = result.provider_id ? "sent" : result.ambiguous ? "uncertain" : "failed";
      await client.query(
        "UPDATE c2s_app.wa_messages SET provider_id=$3,delivery_status=$4,error_code=$5,lease_token=NULL,lease_until=NULL,sent_at=CASE WHEN $4='sent' THEN now() ELSE sent_at END WHERE organization_id=$1 AND id=$2",
        [
          row.organization_id,
          row.id,
          result.provider_id || null,
          status,
          result.error_code ? String(result.error_code).slice(0, 120) : null,
        ],
      );
      if (status === "sent")
        await client.query(
          "UPDATE c2s_app.wa_conversations SET first_human_response_at=COALESCE(first_human_response_at,now()),last_message_at=now(),last_message_preview=$3,updated_at=now(),version=version+1 WHERE organization_id=$1 AND id=$2",
          [
            row.organization_id,
            row.conversation_id,
            String(row.content?.text || row.content?.caption || "[" + row.type + "]").slice(0, 250),
          ],
        );
      await change(client, row.organization_id, row.conversation_id, "message.status.updated");
      return { updated: true, delivery_status: status };
    });
  const recoverOutbox = async () => {
    const result = await pool.query(
      "UPDATE c2s_app.wa_messages SET delivery_status='uncertain',error_code='DELIVERY_UNKNOWN',lease_token=NULL,lease_until=NULL WHERE delivery_status='sending' AND lease_until<now() RETURNING organization_id,conversation_id",
    );
    for (const row of result.rows)
      await change(pool, row.organization_id, row.conversation_id, "message.status.updated");
    return { recovered: result.rowCount };
  };
  const events = async (scope, options = {}) => {
    await member(pool, scope);
    const args = scopeArgs(scope);
    args.push(String(options.after || "0"), pageSize(options.limit));
    const rows = (
      await pool.query(
        "SELECT e.id::text,e.conversation_id,e.event,e.created_at FROM c2s_app.wa_changes e JOIN c2s_app.wa_conversations v ON v.organization_id=e.organization_id AND v.id=e.conversation_id WHERE " +
          readPredicate +
          " AND e.id>$8::bigint ORDER BY e.id LIMIT $9",
        args,
      )
    ).rows;
    const organizationCursor = (
      await pool.query(
        "SELECT COALESCE(max(id),0)::text cursor FROM c2s_app.wa_changes WHERE organization_id=$1",
        [scope.organization_id],
      )
    ).rows[0].cursor;
    const cursor = rows.length === pageSize(options.limit) ? rows.at(-1).id : organizationCursor;
    // Only an organization-scoped resync signal survives loss of access after a transfer.
    // No inaccessible conversation IDs, owners or message content are returned.
    return {
      data: rows,
      cursor,
      next_cursor: cursor,
      resync: BigInt(organizationCursor) > BigInt(String(options.after || "0")),
    };
  };
  const webhookEvents = async (scope, options = {}) => {
    await member(pool, scope);
    if (!scope.can_configure) throw failure("Sem acesso ao diagnóstico.", 403);
    return {
      data: (
        await pool.query(
          "SELECT id,account_id,provider_event_key,status,attempts,error_code,received_at,processed_at FROM c2s_app.wa_webhook_events WHERE organization_id=$1 ORDER BY received_at DESC,id LIMIT $2",
          [scope.organization_id, pageSize(options.limit)],
        )
      ).rows,
    };
  };
  const metrics = async (scope, filters = {}) => {
    await member(pool, scope);
    const args = scopeArgs(scope);
    let where = readPredicate;
    for (const [key, column] of [
      ["from", "created_at"],
      ["to", "created_at"],
    ])
      if (filters[key]) {
        args.push(filters[key]);
        where += ` AND v.${column}${key === "from" ? ">=" : "<"}$${args.length}::timestamptz`;
      }
    for (const [key, column] of [
      ["status", "status"],
      ["source", "source"],
      ["campaign_id", "source_campaign_id"],
      ["user_id", "assigned_user_id"],
      ["team", "team"],
      ["account_id", "account_id"],
    ]) {
      if (filters[key]) {
        args.push(filters[key]);
        where += ` AND v.${column}=$${args.length}`;
      }
    }
    const unanswered =
      "v.last_customer_message_at IS NOT NULL AND v.last_customer_message_at>COALESCE((SELECT max(m.sent_at) FROM c2s_app.wa_messages m WHERE m.organization_id=v.organization_id AND m.conversation_id=v.id AND m.direction='outbound' AND m.sent_at IS NOT NULL),'-infinity')";
    const result = (
      await pool.query(
        "SELECT count(*)::int total,count(*) FILTER(WHERE v.status='waiting')::int waiting,count(*) FILTER(WHERE v.status='active')::int active,count(*) FILTER(WHERE v.status='closed')::int closed,count(*) FILTER(WHERE " +
          unanswered +
          ")::int unanswered,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM c2s_app.wa_assignment_history h WHERE h.organization_id=v.organization_id AND h.conversation_id=v.id AND h.action='transferred'))::int transferred,count(*) FILTER(WHERE l.stage=5)::int converted,avg(extract(epoch FROM(v.assigned_at-v.created_at))) FILTER(WHERE v.assigned_at>=v.created_at) average_assign_seconds,avg(extract(epoch FROM(v.first_human_response_at-v.created_at))) FILTER(WHERE v.first_human_response_at>=v.created_at) average_first_response_seconds FROM c2s_app.wa_conversations v JOIN c2s_app.leads l ON l.id=v.lead_id WHERE " +
          where,
        args,
      )
    ).rows[0];
    const group = async (key, name) =>
      (
        await pool.query(
          `SELECT ${key} key,${name} name,count(*)::int count FROM c2s_app.wa_conversations v LEFT JOIN c2s_app.resources u ON u.kind='users' AND u.id=v.assigned_user_id WHERE ${where} GROUP BY ${key},${name} ORDER BY count(*) DESC LIMIT 100`,
          args,
        )
      ).rows;
    const byUser = await group("v.assigned_user_id", "COALESCE(u.data->>'name','Não atribuído')");
    const bySource = await group("v.source", "COALESCE(NULLIF(v.source,''),'Origem desconhecida')");
    const byCampaign = await group(
      "v.source_campaign_id",
      "COALESCE(NULLIF(v.source_campaign_name,''),'Origem desconhecida')",
    );
    return {
      ...result,
      received: result.total,
      average_claim_seconds: result.average_assign_seconds,
      by_user: byUser,
      by_source: bySource,
      by_campaign: byCampaign,
      conversion_rate: result.total ? Number(result.converted) / Number(result.total) : null,
    };
  };
  const updateConversation = (scope, id, input) =>
    transaction(async (client) => {
      const row = await assertConversation(client, scope, id, true);
      assertVersion(row, input.version);
      if (row.assigned_user_id !== scope.user_id && !scope.can_manage)
        throw failure("Sem permissão para alterar o lead.", 403);
      if (
        !Array.isArray(input.tags) ||
        input.tags.length > 20 ||
        input.tags.some((x) => typeof x !== "string" || x.length > 60) ||
        typeof input.interest !== "string" ||
        input.interest.length > 250 ||
        !Number.isInteger(input.stage) ||
        input.stage < 0 ||
        input.stage > 5
      )
        throw failure("Dados comerciais inválidos.", 422);
      if (input.stage === 5 && input.confirm_sale !== true)
        throw failure("Confirme o negócio fechado.", 422);
      await client.query(
        "UPDATE c2s_app.wa_conversations SET tags=$3,interest=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [scope.organization_id, id, input.tags, input.interest],
      );
      await client.query(
        "UPDATE c2s_app.leads SET product=$2,stage=$3,version=version+1,updated_at=now() WHERE id=$1",
        [row.lead_id, input.interest || "WhatsApp", input.stage],
      );
      await audit(client, scope, id, "lead.updated", { stage: input.stage });
      await change(client, scope.organization_id, id, "lead.updated");
      return { id, version: row.version + 1 };
    });
  const message = async (scope, conversationId, messageId) => {
    await assertConversation(pool, scope, conversationId);
    return publicMessage(
      (
        await pool.query(
          "SELECT * FROM c2s_app.wa_messages WHERE organization_id=$1 AND conversation_id=$2 AND id=$3",
          [scope.organization_id, conversationId, messageId],
        )
      ).rows[0],
    );
  };
  const saveOrganizationSettings = (scope, input) => {
    if (!input.account_id || !uuid.test(input.account_id))
      throw failure("Configure e selecione um número primeiro.", 422);
    return saveSettings(scope, input.account_id, input);
  };
  const exportConversation = async (scope, id) => {
    const actor = await member(pool, scope);
    if (actor.role !== "admin" || !scope.can_configure)
      throw failure("Somente Admin pode exportar dados de atendimento.", 403);
    const row = await conversation(scope, id),
      page = await messages(scope, id, { limit: 100 });
    await audit(pool, scope, id, "privacy.exported");
    return {
      conversation: row,
      messages: page.data,
      notes: await notes(scope, id),
      history: await assignmentHistory(scope, id),
      next_message_cursor: page.next_cursor,
      complete: page.next_cursor === null,
    };
  };
  const redactContent = async (client, organization, id) => {
    // Preserve provider IDs and queue keys so a redelivery cannot recreate erased content.
    await client.query(
      "UPDATE c2s_app.wa_webhook_events e SET payload='{}'::jsonb,status=CASE WHEN status IN ('pending','retry','processing') THEN 'failed' ELSE status END,error_code=CASE WHEN status IN ('pending','retry','processing') THEN 'CONTENT_ERASED' ELSE error_code END,lease_token=NULL,lease_until=NULL WHERE e.organization_id=$1 AND EXISTS(SELECT 1 FROM c2s_app.wa_messages m WHERE m.organization_id=$1 AND m.conversation_id=$2 AND m.account_id=e.account_id AND m.provider_id=e.payload->>'whatsapp_message_id')",
      [organization, id],
    );
    await client.query(
      "UPDATE c2s_app.wa_messages SET content='{}'::jsonb,media_reference=NULL,error_code=NULL,delivery_status=CASE WHEN delivery_status IN ('queued','sending') THEN 'failed' ELSE delivery_status END,lease_token=NULL,lease_until=NULL WHERE organization_id=$1 AND conversation_id=$2",
      [organization, id],
    );
    await client.query(
      "DELETE FROM c2s_app.wa_internal_notes WHERE organization_id=$1 AND conversation_id=$2",
      [organization, id],
    );
    await client.query(
      "UPDATE c2s_app.wa_conversations SET referral='{}'::jsonb,interest='',tags='{}',source_campaign_id=NULL,source_campaign_name=NULL,last_message_preview='Conteúdo removido',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
      [organization, id],
    );
    await client.query(
      "UPDATE c2s_app.leads l SET attribution=l.attribution-'referral',version=l.version+1,updated_at=now() FROM c2s_app.wa_conversations v WHERE v.organization_id=$1 AND v.id=$2 AND l.id=v.lead_id",
      [organization, id],
    );
    await change(client, organization, id, "lead.updated");
  };
  const eraseConversation = (scope, id, version) =>
    transaction(async (client) => {
      const actor = await member(client, scope);
      if (actor.role !== "admin" || !scope.can_configure)
        throw failure("Somente Admin pode remover conteúdo de atendimento.", 403);
      const row = await assertConversation(client, scope, id, true);
      assertVersion(row, version);
      if (row.status !== "closed")
        throw failure("Finalize o atendimento antes de remover seu conteúdo.", 422);
      await redactContent(client, scope.organization_id, id);
      await audit(client, scope, id, "privacy.content_erased");
      return {
        redacted: true,
        contact_retained: true,
        scope: "conversation_content_only",
        version: row.version + 1,
      };
    });
  const expireContent = (limit = 25) =>
    transaction(async (client) => {
      const rows = (
        await client.query(
          "SELECT v.id,v.organization_id FROM c2s_app.wa_conversations v JOIN c2s_app.wa_accounts a ON a.organization_id=v.organization_id AND a.id=v.account_id WHERE v.status='closed' AND v.closed_at<now()-a.retention_days*interval '1 day' AND v.last_message_preview<>'Conteúdo removido' ORDER BY v.closed_at LIMIT $1 FOR UPDATE OF v SKIP LOCKED",
          [pageSize(limit)],
        )
      ).rows;
      for (const row of rows) {
        await redactContent(client, row.organization_id, row.id);
        await audit(
          client,
          { organization_id: row.organization_id, user_id: null },
          row.id,
          "retention.content_erased",
        );
      }
      return { redacted: rows.length, scope: "closed_conversation_content_only" };
    });
  return {
    accounts,
    account,
    accountsForWebhook,
    findWebhookAccount,
    settings,
    saveAccount,
    saveSettings,
    saveOrganizationSettings,
    availability,
    setAvailability,
    enqueueEvents,
    leaseEvents,
    processEvent,
    failEvent,
    conversations,
    conversation,
    messages,
    message,
    notes,
    addNote,
    assignmentHistory,
    markRead,
    claim,
    move,
    queueMessage,
    beginSend,
    finishSend,
    recoverOutbox,
    events,
    webhookEvents,
    metrics,
    updateConversation,
    exportConversation,
    eraseConversation,
    expireContent,
  };
}
