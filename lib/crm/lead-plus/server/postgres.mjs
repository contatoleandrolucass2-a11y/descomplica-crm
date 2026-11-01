import pg from "pg";
import { spreadsheetRow } from "./spreadsheet.mjs";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scopedResourceId } from "./permissions.mjs";
import { leadRequestAuditDetail } from "./request-audit-context.mjs";

export const stages = [
  "Novos leads",
  "Em atendimento",
  "Visita agendada",
  "Visita realizada",
  "Proposta criada",
  "Negócio fechado",
];
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const leadSelect = `SELECT l.*,c.name,c.email,c.phone,COALESCE(u.data->>'name','Não atribuído') AS owner FROM c2s_app.leads l JOIN c2s_app.contacts c ON c.id=l.contact_id LEFT JOIN c2s_app.resources u ON u.kind='users' AND u.id=l.owner_id`;
const bucketStart = `CASE WHEN jsonb_typeof(l.attribution->'bucket_assigned_ms')='number' THEN to_timestamp((l.attribution->>'bucket_assigned_ms')::numeric/1000) ELSE l.created_at END`;
const bucketPending = `NOT l.archived AND l.stage=0 AND NOT EXISTS (SELECT 1 FROM c2s_app.activities a WHERE a.lead_id=l.id AND a.type IN ('call','whatsapp','visit'))`;
const bucketEligible = `${bucketPending} AND ${bucketStart} + $1 * interval '1 minute' <= now()`;
const bucketMinutes = `CASE WHEN bp.id IS NULL THEN $1::numeric WHEN jsonb_typeof(bp.data->'timeout_minutes')='number' THEN CASE WHEN (bp.data->>'timeout_minutes')::numeric BETWEEN 1 AND 525600 AND (bp.data->>'timeout_minutes')::numeric=trunc((bp.data->>'timeout_minutes')::numeric) THEN (bp.data->>'timeout_minutes')::numeric END END`;
const bucketEnabled = `CASE WHEN bp.id IS NULL THEN $2::boolean ELSE COALESCE(bp.data->'enabled'='true'::jsonb,false) END`;
const bucketPolicyJoin =
  " LEFT JOIN c2s_app.resources bp ON bp.kind='settings' AND bp.id='bucket-policy--'||md5(COALESCE(u.data->>'team',''))";
const leadRow = (row) =>
  row
    ? {
        ...row,
        negotiation_type: row.attribution?.negotiation_type || "Indefinido",
        value: Number(row.value),
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      }
    : null;
export function createPool(env = process.env) {
  const databaseUrl = env.LEAD_DB_URL ?? env.SUPABASE_DB_URL;
  const projectRef = env.LEAD_DB_PROJECT_REF ?? env.SUPABASE_PROJECT_REF;
  const caFile = env.LEAD_DB_CA_FILE ?? env.SUPABASE_DB_CA_FILE;
  if (!databaseUrl) throw fail("Defina LEAD_DB_URL no servidor para conectar ao Supabase.", 503);
  const url = new URL(databaseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && !projectRef)
    throw fail("Defina LEAD_DB_PROJECT_REF para validar o projeto de destino.", 503);
  if (
    !local &&
    !(
      url.hostname === `db.${projectRef}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(url.username).endsWith("." + projectRef))
    )
  )
    throw fail("A conexão não corresponde ao projeto Supabase configurado.", 503);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(caFile ? { ca: readFileSync(caFile, "utf8") } : {}),
        },
    max: local ? 5 : 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: "c2s-backend",
  });
  pool.on("error", () =>
    console.error("Uma conexão ociosa com o banco foi encerrada; o pool abrirá outra conexão."),
  );
  pool.c2sTarget = local ? "local" : "remote";
  pool.c2sProjectRef = local ? null : projectRef;
  return pool;
}
export function postgresStore(pool) {
  const query = (sql, args = []) => pool.query(sql, args);
  const transaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };
  const audit = async (client, entity, id, action, detail = {}) =>
    client.query("INSERT INTO c2s_app.audit(entity,entity_id,action,detail) VALUES($1,$2,$3,$4)", [
      entity,
      id,
      action,
      JSON.stringify(leadRequestAuditDetail(detail)),
    ]);
  const resources = async (kind, client = pool) =>
    (
      await client.query(
        "SELECT id,data,version FROM c2s_app.resources WHERE kind=$1 ORDER BY created_at,id",
        [kind],
      )
    ).rows.map((r) => ({ ...r.data, id: r.id, version: r.version }));
  const getLead = async (id, client = pool) =>
    leadRow((await client.query(leadSelect + " WHERE l.id=$1", [id])).rows[0]);
  const leads = async () =>
    (await query(leadSelect + " ORDER BY l.created_at DESC,l.id")).rows.map(leadRow);
  const bucketPolicy = async (client = pool, team = null) => {
    const settings = await resources("settings", client);
    const specific = team
      ? settings.find((row) => row.id === scopedResourceId("bucket-policy", team))
      : null;
    const row = specific || settings.find((row) => row.id === "bucket-policy");
    const minutes = row?.timeout_minutes;
    const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 525600;
    return {
      enabled: row?.enabled === true && valid,
      timeout_minutes: valid ? minutes : null,
      version: team && !specific ? null : (row?.version ?? null),
    };
  };
  const bucketLeads = async (client = pool) => {
    const policy = await bucketPolicy(client);
    const minutes = bucketMinutes;
    const enabled = bucketEnabled;
    const rows = await client.query(
      leadSelect.replace(
        "SELECT l.*,",
        `SELECT l.*,u.data->>'team' AS owner_team,(${bucketStart} + (${minutes}) * interval '1 minute') AS bucket_available_at,`,
      ) +
        bucketPolicyJoin +
        " WHERE (" +
        enabled +
        ") AND " +
        bucketEligible.split("$1").join("(" + minutes + ")") +
        " ORDER BY l.created_at,l.id",
      [policy.timeout_minutes, policy.enabled],
    );
    return {
      data: rows.rows.map((row) => ({
        ...leadRow(row),
        bucket_available_at: row.bucket_available_at.toISOString(),
      })),
      policy,
    };
  };
  const bucketTimers = async (client = pool) => {
    const policy = await bucketPolicy(client);
    const result = await client.query(
      `SELECT l.id, ${bucketStart} AS bucket_started_at, (${bucketStart} + (${bucketMinutes}) * interval '1 minute') AS bucket_deadline_at
       FROM c2s_app.leads l
       LEFT JOIN c2s_app.resources u ON u.kind='users' AND u.id=l.owner_id` +
        bucketPolicyJoin +
        ` WHERE (${bucketEnabled}) AND (${bucketMinutes}) IS NOT NULL AND ${bucketPending}`,
      [policy.timeout_minutes, policy.enabled],
    );
    return result.rows.map((row) => ({
      id: row.id,
      bucket_started_at: row.bucket_started_at.toISOString(),
      bucket_deadline_at: row.bucket_deadline_at.toISOString(),
    }));
  };
  const claimBucketLead = async (id, input) =>
    transaction(async (client) => {
      const existing = (
        await client.query("SELECT * FROM c2s_app.leads WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!existing) throw fail("Lead não encontrado.", 404);
      if (existing.version !== input.version)
        throw fail("Este lead já foi alterado ou assumido. Atualize o Bolsão.");
      const previousOwner = (await resources("users", client)).find(
        (user) => user.id === existing.owner_id,
      );
      const policy = await bucketPolicy(client, previousOwner?.team);
      if (!policy.enabled) throw fail("O Bolsão está desativado ou sem prazo configurado.", 422);
      const user = (
        await client.query(
          "SELECT data FROM c2s_app.resources WHERE kind='users' AND id=$1 FOR SHARE",
          [input.owner_id],
        )
      ).rows[0];
      if (user?.data.active !== true) throw fail("Usuário responsável inválido ou inativo.", 422);
      const eligible = await client.query(
        "SELECT 1 FROM c2s_app.leads l WHERE l.id=$2 AND " + bucketEligible,
        [policy.timeout_minutes, id],
      );
      if (!eligible.rowCount) throw fail("Este lead não está mais disponível no Bolsão.");
      await client.query(
        "UPDATE c2s_app.leads SET owner_id=$2,version=version+1,updated_at=now(),attribution=jsonb_set(attribution,'{bucket_assigned_ms}',to_jsonb(extract(epoch FROM now())*1000)) WHERE id=$1",
        [id, input.owner_id],
      );
      await audit(client, "lead", id, "bucket_claimed", {
        previous_owner_id: existing.owner_id,
        owner_id: input.owner_id,
        reason: "unattended_timeout",
        auth_user_id: input.auth_user_id,
        timeout_minutes: policy.timeout_minutes,
      });
      return getLead(id, client);
    });
  const saveResource = async (kind, id, data, version) =>
    transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(730102)");
      const existing = (
        await client.query(
          "SELECT version FROM c2s_app.resources WHERE kind=$1 AND id=$2 FOR UPDATE",
          [kind, id],
        )
      ).rows[0];
      if (existing && existing.version !== version)
        throw fail("Registro alterado em outra tela. Atualize antes de salvar.");
      if (kind === "properties") {
        const duplicate = await client.query(
          "SELECT 1 FROM c2s_app.resources WHERE kind='properties' AND id<>$1 AND lower(data->>'code')=lower($2)",
          [id, data.code],
        );
        if (duplicate.rowCount) throw fail("Já existe um imóvel com este código.", 422);
      }
      await client.query(
        "INSERT INTO c2s_app.resources(kind,id,data) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=c2s_app.resources.version+1",
        [kind, id, JSON.stringify(data)],
      );
      await audit(client, kind, id, existing ? "updated" : "created");
      return (await resources(kind, client)).find((r) => r.id === id);
    });
  const createLead = async (input, key, contextClient = null, permittedOwners = null) =>
    (contextClient ? (fn) => fn(contextClient) : transaction)(async (client) => {
      // Uma transação cobre deduplicação, pessoa, distribuição, lead e auditoria.
      await client.query("SELECT pg_advisory_xact_lock(730101)");
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      if (key) {
        const previous = (await client.query("SELECT * FROM c2s_app.requests WHERE key=$1", [key]))
          .rows[0];
        if (previous) {
          if (previous.hash !== hash)
            throw fail("Chave de idempotência já utilizada para outro conteúdo.");
          return {
            lead: await getLead(previous.lead_id, client),
            duplicate: true,
          };
        }
      }
      if (input.external_id) {
        const previous = (
          await client.query("SELECT id FROM c2s_app.leads WHERE source=$1 AND external_id=$2", [
            input.source,
            input.external_id,
          ])
        ).rows[0];
        if (previous) return { lead: await getLead(previous.id, client), duplicate: true };
      }
      let contact = (
        await client.query(
          "SELECT id FROM c2s_app.contacts WHERE ($1::text IS NOT NULL AND phone=$1) OR ($2::text IS NOT NULL AND email=$2) ORDER BY created_at,id LIMIT 1",
          [input.phone || null, input.email || null],
        )
      ).rows[0];
      if (!contact) {
        contact = { id: randomUUID() };
        await client.query(
          "INSERT INTO c2s_app.contacts(id,name,email,phone) VALUES($1,$2,$3,$4)",
          [contact.id, input.name, input.email || null, input.phone || null],
        );
      }
      const fingerprint =
        !input.external_id && !key
          ? createHash("sha256")
              .update(JSON.stringify([contact.id, input.product, input.source]))
              .digest("hex")
          : null;
      if (fingerprint) {
        const previous = (
          await client.query("SELECT id FROM c2s_app.leads WHERE fingerprint=$1", [fingerprint])
        ).rows[0];
        if (previous) return { lead: await getLead(previous.id, client), duplicate: true };
      }
      const users = (await resources("users", client)).filter(
        (u) => u.active && (!permittedOwners || permittedOwners.has(u.id)),
      );
      let owner = input.owner_id;
      if (owner && !users.some((u) => u.id === owner))
        throw fail("Usuário responsável inválido ou inativo.", 422);
      if (!owner && users.length) {
        const state = (
          await client.query(
            "UPDATE c2s_app.distribution_state SET next_index=next_index+1 RETURNING next_index-1 AS cursor",
          )
        ).rows[0];
        owner = users[Number(BigInt(state.cursor) % BigInt(users.length))].id;
      }
      const id = randomUUID();
      await client.query(
        "INSERT INTO c2s_app.leads(id,contact_id,product,source,external_id,fingerprint,owner_id,attribution) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          contact.id,
          input.product,
          input.source,
          input.external_id || null,
          fingerprint,
          owner || null,
          JSON.stringify(
            Object.fromEntries(
              Object.entries(input.attribution || {}).filter(([key]) => !key.startsWith("bucket_")),
            ),
          ),
        ],
      );
      if (input.message)
        await client.query(
          "INSERT INTO c2s_app.activities(id,lead_id,type,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), id, "message", input.message],
        );
      if (key)
        await client.query("INSERT INTO c2s_app.requests(key,hash,lead_id) VALUES($1,$2,$3)", [
          key,
          hash,
          id,
        ]);
      await audit(client, "lead", id, "created", {
        source: input.source,
        owner_id: owner,
      });
      return { lead: await getLead(id, client), duplicate: false };
    });
  const updateLead = async (id, input, actor = null, contextClient = null) =>
    (contextClient ? (fn) => fn(contextClient) : transaction)(async (client) => {
      const existing = (
        await client.query("SELECT * FROM c2s_app.leads WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!existing) throw fail("Lead não encontrado.", 404);
      if (
        actor &&
        !actor.canManage &&
        (existing.owner_id !== actor.id ||
          (input.owner_id !== undefined && input.owner_id !== actor.id))
      )
        throw fail("Você não pode alterar o responsável deste lead.", 403);
      if (existing.version !== input.version)
        throw fail("Lead alterado em outra tela. Recarregue antes de salvar.");
      if (
        input.owner_id &&
        !(await resources("users", client)).some((u) => u.id === input.owner_id && u.active)
      )
        throw fail("Usuário responsável inválido ou inativo.", 422);
      const stage = input.stage ?? existing.stage;
      if (stage === 5 && existing.stage !== 5 && !input.confirm_sale)
        throw fail("Confirme o negócio fechado antes de concluir a venda.", 422);
      if (input.archived === true && !input.archive_reason)
        throw fail("Informe o motivo de arquivamento.", 422);
      await client.query(
        "UPDATE c2s_app.leads SET stage=$1,archived=$2,owner_id=$3,value=$4,version=version+1,updated_at=now() WHERE id=$5",
        [
          stage,
          input.archived ?? existing.archived,
          input.owner_id === "" ? null : (input.owner_id ?? existing.owner_id),
          input.value ?? existing.value,
          id,
        ],
      );
      await audit(client, "lead", id, "updated", {
        from: existing.stage,
        to: stage,
        owner_id: input.owner_id,
        archive_reason: input.archive_reason,
        auth_user_id: actor?.auth_id,
      });
      if (input.next_contact_at !== undefined) {
        if (input.next_contact_at === null)
          await client.query(
            "UPDATE c2s_app.leads SET attribution=attribution-'next_contact_at' WHERE id=$1",
            [id],
          );
        else
          await client.query(
            "UPDATE c2s_app.leads SET attribution=jsonb_set(attribution,'{next_contact_at}',to_jsonb($2::text)) WHERE id=$1",
            [id, input.next_contact_at],
          );
      }
      if (input.negotiation_type)
        await client.query(
          "UPDATE c2s_app.leads SET attribution=jsonb_set(attribution,'{negotiation_type}',to_jsonb($2::text)) WHERE id=$1",
          [id, input.negotiation_type],
        );
      if (input.owner_id !== undefined && input.owner_id !== existing.owner_id) {
        await client.query(
          "UPDATE c2s_app.leads SET attribution=jsonb_set(attribution,'{bucket_assigned_ms}',to_jsonb(extract(epoch FROM now())*1000)) WHERE id=$1",
          [id],
        );
      }
      return getLead(id, client);
    });
  const deleteResource = async (kind, id, version) =>
    transaction(async (client) => {
      const existing = (
        await client.query(
          "SELECT version FROM c2s_app.resources WHERE kind=$1 AND id=$2 FOR UPDATE",
          [kind, id],
        )
      ).rows[0];
      if (!existing) throw fail("Registro não encontrado.", 404);
      if (existing.version !== version) throw fail("Registro alterado. Atualize a página.");
      if (
        kind === "users" &&
        (await client.query("SELECT 1 FROM c2s_app.leads WHERE owner_id=$1 LIMIT 1", [id])).rows
          .length
      )
        throw fail("Usuário possui leads atribuídos. Reatribua antes de excluir.");
      await client.query("DELETE FROM c2s_app.resources WHERE kind=$1 AND id=$2", [kind, id]);
      await audit(client, kind, id, "deleted");
    });
  const addActivity = async (id, input, actor = null) =>
    transaction(async (client) => {
      const lead = await client.query(
        "SELECT id,owner_id FROM c2s_app.leads WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!lead.rowCount) throw fail("Lead não encontrado.", 404);
      if (actor && !actor.canManage && lead.rows[0].owner_id !== actor.id)
        throw fail("O lead pertence a outro responsável.", 403);
      const row = (
        await client.query(
          "INSERT INTO c2s_app.activities(id,lead_id,type,body) VALUES($1,$2,$3,$4) RETURNING *",
          [randomUUID(), id, input.type, input.body],
        )
      ).rows[0];
      await audit(client, "lead", id, "activity_added", {
        type: input.type,
        auth_user_id: actor?.auth_id,
      });
      return row;
    });
  const saveCampaignSelectionCAS = async (campaignIds, version) =>
    transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(730102)");
      const existing = (
        await client.query(
          "SELECT version FROM c2s_app.resources WHERE kind='settings' AND id='meta-campaign-selection' FOR UPDATE",
        )
      ).rows[0];
      if ((existing?.version ?? 0) !== version)
        throw fail("Seleção alterada em outra tela. Atualize antes de salvar.");
      const row = (
        await client.query(
          "INSERT INTO c2s_app.resources(kind,id,data) VALUES('settings','meta-campaign-selection',$1) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=c2s_app.resources.version+1 RETURNING data,version",
          [JSON.stringify({ campaign_ids: campaignIds })],
        )
      ).rows[0];
      await audit(client, "settings", "meta-campaign-selection", existing ? "updated" : "created", {
        campaign_count: campaignIds.length,
      });
      return { campaign_ids: row.data.campaign_ids, version: row.version };
    });
  const createMetaLead = async (input, key, permittedOwners) =>
    transaction(async (client) => {
      // The same lock as selection writes keeps a deselection from racing the final commit.
      await client.query("SELECT pg_advisory_xact_lock(730102)");
      const policy = (
        await client.query(
          "SELECT data FROM c2s_app.resources WHERE kind='settings' AND id='meta-campaign-selection' FOR UPDATE",
        )
      ).rows[0];
      if (
        !Array.isArray(policy?.data?.campaign_ids) ||
        !policy.data.campaign_ids.includes(input.attribution?.campaign_id)
      )
        throw Object.assign(Error("Campanha não selecionada."), {
          code: "META_CAMPAIGN_NOT_SELECTED",
        });
      const masters = (await resources("users", client)).filter(
        (user) =>
          user.active === true &&
          ["admin", "superintendent", "manager"].includes(user.role) &&
          permittedOwners?.has(user.id),
      );
      if (!masters.length)
        throw Object.assign(Error("Nenhum master ativo disponível."), {
          code: "META_MASTER_UNAVAILABLE",
        });
      return createLead(input, key, client, new Set(masters.map((user) => user.id)));
    });
  const enqueueMeta = async (jobs) =>
    transaction(async (client) => {
      let accepted = 0;
      for (const j of jobs) {
        accepted += (
          await client.query(
            "INSERT INTO c2s_app.inbox(id,provider,external_id,page_id,form_id,ad_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,external_id) DO NOTHING",
            [randomUUID(), "facebook", j.external_id, j.page_id, j.form_id, j.ad_id],
          )
        ).rowCount;
      }
      return { accepted };
    });
  const claimMeta = async () =>
    transaction(async (client) => {
      // A reserva e seu vencimento impedem processamento concorrente sem perder jobs após falhas.
      await client.query(
        "UPDATE c2s_app.inbox SET status='failed',error_code='LEASE_EXPIRED',lease_until=NULL WHERE status='processing' AND lease_until<now() AND attempts>=5",
      );
      const row = (
        await client.query(
          "SELECT * FROM c2s_app.inbox WHERE provider='facebook' AND attempts<5 AND ((status IN ('pending','retry') AND next_at<=now()) OR (status='processing' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      return (
        await client.query(
          "UPDATE c2s_app.inbox SET status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes' WHERE id=$1 RETURNING *",
          [row.id],
        )
      ).rows[0];
    });
  return {
    pool,
    transaction,
    query,
    stages,
    leads,
    bucketPolicy,
    bucketLeads,
    bucketTimers,
    claimBucketLead,
    resolveAuthenticatedUser: async (user) =>
      transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(730102)");
        const users = await resources("users", client);
        const matches = users.filter(
          (row) =>
            row.auth_user_id === user.id ||
            row.id === user.id ||
            row.email?.toLowerCase() === user.email?.toLowerCase(),
        );
        if (matches.length > 1 || (matches[0]?.auth_user_id && matches[0].auth_user_id !== user.id))
          throw fail("Cadastro de usuário ambíguo. Consulte a administração.", 403);
        const existing = matches[0];
        if (existing && existing.active !== true)
          throw fail("Usuário desativado no DESCOMPLICA LEAD.", 403);
        const id = existing?.id ?? user.id;
        const data = existing
          ? { ...existing, auth_user_id: user.id }
          : {
              auth_user_id: user.id,
              name:
                typeof user.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name.slice(0, 160)
                  : user.email,
              email: user.email,
              phone: "",
              team: "",
              active: true,
            };
        delete data.id;
        delete data.version;
        if (!existing || existing.auth_user_id !== user.id) {
          await client.query(
            "INSERT INTO c2s_app.resources(kind,id,data) VALUES('users',$1,$2) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=c2s_app.resources.version+1",
            [id, JSON.stringify(data)],
          );
          await audit(client, "users", id, "auth_linked", {
            auth_user_id: user.id,
          });
        }
        return { ...data, id };
      }),
    importProperties: async (properties, actor) =>
      transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(730102)");
        const existing = await resources("properties", client);
        const byCode = new Map(existing.map((row) => [row.code.toLocaleLowerCase(), row.id]));
        const imported = new Set();
        let created = 0;
        let updated = 0;
        for (const property of properties) {
          const code = property.code.toLocaleLowerCase();
          if (imported.has(code))
            throw fail("O arquivo contém códigos de imóveis duplicados.", 422);
          imported.add(code);
          const previous = byCode.get(code);
          const id = previous || randomUUID();
          await client.query(
            "INSERT INTO c2s_app.resources(kind,id,data) VALUES('properties',$1,$2) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=c2s_app.resources.version+1",
            [id, JSON.stringify(property)],
          );
          await audit(client, "properties", id, previous ? "import_updated" : "import_created", {
            auth_user_id: actor.auth_id,
          });
          if (previous) updated++;
          else created++;
        }
        return { created, updated, total: properties.length };
      }),
    importJobs: async () =>
      (
        await query(
          "SELECT id,data-'rows' AS data,version FROM c2s_app.resources WHERE kind='imports' ORDER BY created_at DESC",
        )
      ).rows.map((row) => ({ ...row.data, id: row.id, version: row.version })),
    importJob: async (id) => {
      const row = (
        await query(
          "SELECT id,data,version FROM c2s_app.resources WHERE kind='imports' AND id=$1",
          [id],
        )
      ).rows[0];
      return row ? { ...row.data, id: row.id, version: row.version } : null;
    },
    importSpreadsheet: (jobId, job, users, actor) =>
      transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(730103)");
        const previous = (
          await client.query("SELECT data FROM c2s_app.resources WHERE kind='imports' AND id=$1", [
            jobId,
          ])
        ).rows[0];
        if (previous) return { id: jobId, ...previous.data, duplicate: true };
        const outcomes = [];
        const records = job.has_header ? job.rows.slice(1) : job.rows;
        for (const [index, row] of records.entries()) {
          await client.query("SAVEPOINT import_row");
          try {
            const parsed = spreadsheetRow(row, {
              users,
              ownerId: job.owner_id,
              canAssign: actor.canAssign,
              actorId: actor.id,
              index,
            });
            const key =
              "sheet:" +
              actor.id +
              ":" +
              createHash("sha256")
                .update(JSON.stringify({ ...parsed, archived: job.archived }))
                .digest("hex");
            const saved = await createLead(
              parsed.input,
              key,
              client,
              new Set(users.map((user) => user.id)),
            );
            let lead = saved.lead;
            if (!saved.duplicate) {
              lead = await updateLead(
                lead.id,
                {
                  version: lead.version,
                  value: parsed.value,
                  ...(job.archived
                    ? { archived: true, archive_reason: "Importado como arquivado" }
                    : {}),
                },
                { ...actor, canManage: actor.canAssign },
                client,
              );
              await client.query(
                "UPDATE c2s_app.leads SET created_at=COALESCE($2::timestamptz,created_at),attribution=attribution||jsonb_build_object('import_id',$3::text,'bucket_assigned_ms',extract(epoch FROM now())*1000) WHERE id=$1",
                [lead.id, parsed.createdAt || null, jobId],
              );
            }
            outcomes.push({
              line: index + (job.has_header ? 2 : 1),
              name: row[0],
              status: saved.duplicate ? "Já importado" : "Importado",
              lead_id: lead.id,
              created: !saved.duplicate,
              version: lead.version,
            });
          } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT import_row");
            outcomes.push({
              line: index + (job.has_header ? 2 : 1),
              name: row[0] || "",
              status: "Erro",
              error: error.status ? error.message : "Não foi possível importar esta linha.",
            });
          }
          await client.query("RELEASE SAVEPOINT import_row");
        }
        const data = {
          ...job,
          actor_id: actor.id,
          actor_name: actor.name || "Prévia local",
          actor_team: actor.team || "",
          outcomes,
          status: outcomes.some((row) => row.status === "Erro")
            ? "Finalizado com erros"
            : "Finalizado",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await client.query("INSERT INTO c2s_app.resources(kind,id,data) VALUES('imports',$1,$2)", [
          jobId,
          data,
        ]);
        await audit(client, "imports", jobId, "created", {
          imported: outcomes.filter((row) => row.created).length,
          auth_user_id: actor.auth_id,
        });
        return { id: jobId, ...data };
      }),
    removeSpreadsheetLeads: (jobId, actor, permittedOwners) =>
      transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(730103)");
        const job = (
          await client.query(
            "SELECT data FROM c2s_app.resources WHERE kind='imports' AND id=$1 FOR UPDATE",
            [jobId],
          )
        ).rows[0]?.data;
        if (!job) throw fail("Importação não encontrada.", 404);
        if (job.deleted) return { deleted: true };
        const created = job.outcomes.filter((row) => row.created);
        for (const item of created) {
          const lead = (
            await client.query("SELECT * FROM c2s_app.leads WHERE id=$1 FOR UPDATE", [item.lead_id])
          ).rows[0];
          if (!lead || lead.attribution?.import_id !== jobId || lead.version !== item.version)
            throw fail(
              "Um lead foi alterado após a importação. Revise os atendimentos antes de apagar.",
              409,
            );
          if (permittedOwners && !permittedOwners.has(lead.owner_id))
            throw fail("Lead fora do seu acesso.", 403);
        }
        for (const item of created) {
          const lead = (
            await client.query("SELECT contact_id FROM c2s_app.leads WHERE id=$1", [item.lead_id])
          ).rows[0];
          await client.query("DELETE FROM c2s_app.requests WHERE lead_id=$1", [item.lead_id]);
          await client.query("DELETE FROM c2s_app.activities WHERE lead_id=$1", [item.lead_id]);
          await client.query("DELETE FROM c2s_app.leads WHERE id=$1", [item.lead_id]);
          await client.query(
            "DELETE FROM c2s_app.contacts WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM c2s_app.leads WHERE contact_id=$1)",
            [lead.contact_id],
          );
        }
        const updated = {
          ...job,
          deleted: true,
          status: "Leads apagados",
          updated_at: new Date().toISOString(),
        };
        await client.query(
          "UPDATE c2s_app.resources SET data=$2,version=version+1 WHERE kind='imports' AND id=$1",
          [jobId, updated],
        );
        await audit(client, "imports", jobId, "leads_deleted", {
          count: created.length,
          auth_user_id: actor.auth_id,
        });
        return { deleted: true, count: created.length };
      }),
    getLead,
    listResources: resources,
    saveResource,
    createLead,
    updateLead,
    deleteResource,
    addActivity,
    enqueueMeta,
    saveCampaignSelectionCAS,
    createMetaLead,
    claimMeta,
    health: async () => {
      await query("SELECT 1 FROM c2s_app.leads LIMIT 1");
      return {
        storage: "supabase-postgres",
        database_target: pool.c2sTarget,
        project_ref: pool.c2sProjectRef,
        schema: "c2s_app",
        ok: true,
      };
    },
    activities: async (id) =>
      (
        await query("SELECT * FROM c2s_app.activities WHERE lead_id=$1 ORDER BY created_at DESC", [
          id,
        ])
      ).rows,
    analyticsHistory: async (ids) => {
      if (!ids.length) return { activities: [], events: [] };
      const [activities, events] = await Promise.all([
        query(
          "SELECT lead_id,type,created_at FROM c2s_app.activities WHERE lead_id=ANY($1::uuid[]) ORDER BY created_at",
          [ids],
        ),
        query(
          "SELECT entity_id,detail,created_at FROM c2s_app.audit WHERE entity='lead' AND entity_id=ANY($1::text[]) AND action='updated' ORDER BY created_at,id",
          [ids],
        ),
      ]);
      return { activities: activities.rows, events: events.rows };
    },
    auditEntries: async () =>
      (await query("SELECT * FROM c2s_app.audit ORDER BY id DESC LIMIT 200")).rows,
    inboxEvents: async () =>
      (
        await query(
          "SELECT provider,external_id,status,attempts,error_code,created_at FROM c2s_app.inbox ORDER BY created_at DESC LIMIT 50",
        )
      ).rows,
    eventCounts: async (provider) =>
      (
        await query(
          "SELECT status,count(*)::integer AS count FROM c2s_app.inbox WHERE provider=$1 GROUP BY status",
          [provider],
        )
      ).rows,
    ignoreMeta: async (id, code = "META_CAMPAIGN_NOT_SELECTED") =>
      query(
        "UPDATE c2s_app.inbox SET status='completed',lead_id=NULL,error_code=$1,lease_until=NULL WHERE id=$2 AND lead_id IS NULL AND status='processing'",
        [code, id],
      ),
    completeMeta: async (id, leadId) =>
      query(
        "UPDATE c2s_app.inbox SET status='completed',lead_id=$1,error_code=NULL,lease_until=NULL WHERE id=$2",
        [leadId, id],
      ),
    failMeta: async (job, code) =>
      query(
        "UPDATE c2s_app.inbox SET status=$1,error_code=$2,next_at=$3,lease_until=NULL WHERE id=$4",
        [
          job.attempts >= 5 ? "failed" : "retry",
          code,
          new Date(Date.now() + Math.min(3600000, 1000 * 2 ** job.attempts)),
          job.id,
        ],
      ),
    close: () => pool.end(),
  };
}
