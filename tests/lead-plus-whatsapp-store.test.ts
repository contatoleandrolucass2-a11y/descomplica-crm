import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// @ts-expect-error The operational store is a server ESM module.
import { nextDeliveryStatus, whatsappStore } from "../lib/crm/lead-plus/server/whatsapp-store.mjs";
type LocalTestPool = {
  query(sql: string, args?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
};
const { Pool } = createRequire(import.meta.url)("pg") as {
  Pool: new (options: Record<string, unknown>) => LocalTestPool;
};

describe("WhatsApp delivery ordering", () => {
  it("does not downgrade read or delivered statuses when old webhooks arrive", () => {
    expect(nextDeliveryStatus("read", "sent")).toBe("read");
    expect(nextDeliveryStatus("delivered", "failed")).toBe("delivered");
    expect(nextDeliveryStatus("sent", "read")).toBe("read");
    expect(nextDeliveryStatus("uncertain", "delivered")).toBe("delivered");
    expect(nextDeliveryStatus("sent", "unknown")).toBe("sent");
  });
});

// This opt-in suite owns a disposable LOCAL database and role. It never reads runtime secrets or contacts a remote database.
describe.runIf(process.env.LEAD_WHATSAPP_PG_TEST === "1")(
  "WhatsApp transactional PostgreSQL store",
  () => {
    const suffix = randomBytes(6).toString("hex");
    const database = "lead_wa_test_" + suffix;
    const role = "lead_wa_role_" + suffix;
    let pool: LocalTestPool;
    let store: ReturnType<typeof whatsappStore>;
    const admin = {
      organization_id: "org-a",
      user_id: "admin-a",
      role: "admin",
      can_manage: true,
      can_configure: true,
      all: true,
      queue_visible: true,
      team: "",
      single_organization: true,
    };
    const broker = {
      ...admin,
      user_id: "broker-a",
      role: "broker",
      all: false,
      can_manage: false,
      can_configure: false,
      team: "team-a",
    };
    const second = { ...broker, user_id: "broker-b" };
    const other = { ...broker, organization_id: "org-b", user_id: "broker-other" };
    const sql = (input: string, target = database) =>
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          "c2s-supabase-db",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-d",
          target,
        ],
        { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
    beforeAll(async () => {
      const password = randomBytes(24).toString("hex");
      sql(
        `CREATE DATABASE ${database}; CREATE ROLE ${role} LOGIN PASSWORD '${password}' IN ROLE c2s_backend_scope;`,
        "postgres",
      );
      const schema = `CREATE SCHEMA c2s_app;
      CREATE TABLE c2s_app.resources(kind text NOT NULL,id text NOT NULL,data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz DEFAULT now(),PRIMARY KEY(kind,id));
      CREATE TABLE c2s_app.contacts(id uuid PRIMARY KEY,name text NOT NULL,email text,phone text,created_at timestamptz DEFAULT now());
      CREATE TABLE c2s_app.leads(id uuid PRIMARY KEY,contact_id uuid NOT NULL REFERENCES c2s_app.contacts(id),product text NOT NULL,source text NOT NULL,external_id text,stage smallint NOT NULL DEFAULT 0,owner_id text,value numeric NOT NULL DEFAULT 0,attribution jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source,external_id));
      CREATE TABLE c2s_app.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entity text,entity_id text,action text,detail jsonb,created_at timestamptz DEFAULT now());
      GRANT USAGE ON SCHEMA c2s_app TO c2s_backend_scope;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA c2s_app TO c2s_backend_scope;
      GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA c2s_app TO c2s_backend_scope;`;
      sql(schema);
      sql(
        readFileSync(
          new URL(
            "../lib/crm/lead-plus/server/migrations/20261102013756_lead_whatsapp_central.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      pool = new Pool({
        host: "127.0.0.1",
        port: 55432,
        user: role,
        password,
        database,
        max: 8,
      });
      store = whatsappStore(pool);
    }, 20000);
    afterAll(async () => {
      await pool?.end();
      sql(
        `DROP DATABASE IF EXISTS ${database} WITH (FORCE); DROP ROLE IF EXISTS ${role};`,
        "postgres",
      );
    });
    beforeEach(async () => {
      sql(
        "TRUNCATE c2s_app.wa_changes,c2s_app.wa_reads,c2s_app.wa_internal_notes,c2s_app.wa_assignment_history,c2s_app.wa_messages,c2s_app.wa_webhook_events,c2s_app.wa_availability,c2s_app.wa_conversations,c2s_app.wa_contacts,c2s_app.wa_accounts,c2s_app.leads,c2s_app.contacts,c2s_app.resources,c2s_app.audit RESTART IDENTITY CASCADE;",
      );
      for (const user of [admin, broker, second, other])
        await pool.query("INSERT INTO c2s_app.resources(kind,id,data) VALUES('users',$1,$2)", [
          user.user_id,
          JSON.stringify({
            active: true,
            role: user.role,
            organization_id: user.organization_id,
            team: user.team,
            name: user.user_id,
          }),
        ]);
    });
    const configured = async (scope = admin, phone = "123456789012345") =>
      store.saveAccount(
        scope.organization_id,
        {
          app_id: "4588155391458285",
          waba_id: "123456789012346",
          phone_number_id: phone,
          graph_version: "v26.0",
          enabled: true,
          secret_ciphertext: "encrypted-test-only",
        },
        scope,
      );
    const inbound = (overrides = {}) => ({
      provider_event_key: "message:wamid.test-1",
      kind: "message",
      whatsapp_message_id: "wamid.test-1",
      timestamp: new Date().toISOString(),
      from: "5511999990000",
      contact_name: "Cliente local",
      type: "text",
      content: { text: "Olá" },
      ...overrides,
    });
    const receive = async (account: { id: string; organization_id: string }, event = inbound()) => {
      await store.enqueueEvents(account, [event]);
      for (const job of await store.leaseEvents()) await store.processEvent(job);
      return (await store.conversations(admin)).data[0];
    };
    it("enables RLS and denies direct browser/service-role access to every WhatsApp table", async () => {
      const result = await pool.query(
        "SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') anon,has_table_privilege('authenticated',c.oid,'SELECT') authenticated,has_table_privilege('service_role',c.oid,'SELECT') service FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='c2s_app' AND c.relkind='r' AND c.relname LIKE 'wa_%'",
      );
      expect(result.rows).toHaveLength(10);
      for (const row of result.rows)
        expect(row).toMatchObject({
          relrowsecurity: true,
          anon: false,
          authenticated: false,
          service: false,
        });
    });
    it("persists a new contact and lead once across duplicate webhook delivery", async () => {
      const account = await configured();
      expect(account.secret_ciphertext).toBeUndefined();
      expect((await store.accounts("org-a"))[0].secret_ciphertext).toBeUndefined();
      expect(await store.enqueueEvents(account, [inbound(), inbound()])).toEqual({
        accepted: 1,
        duplicate: 1,
      });
      for (const job of await store.leaseEvents()) await store.processEvent(job);
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.leads")).rows[0]?.total,
      ).toBe(1);
      const conversation = (await store.conversations(admin)).data[0];
      expect(conversation.status).toBe("waiting");
      expect((await store.messages(broker, conversation.id)).data).toHaveLength(1);
    });
    it("reuses an active contact/conversation and preserves newest customer timestamp out of order", async () => {
      const account = await configured();
      const first = await receive(account);
      const older = new Date(Date.now() - 3600000).toISOString();
      await receive(
        account,
        inbound({
          provider_event_key: "message:wamid.older",
          whatsapp_message_id: "wamid.older",
          timestamp: older,
          content: { text: "antiga" },
        }),
      );
      const row = await store.conversation(admin, first.id);
      expect(row.last_message_preview).toBe("Olá");
      expect(new Date(row.last_customer_message_at).getTime()).toBeGreaterThan(Date.parse(older));
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.contacts")).rows[0]?.total,
      ).toBe(1);
      expect((await store.messages(admin, row.id)).data).toHaveLength(2);
    });
    it("assigns concurrent claims exactly once and keeps the existing CRM lead synchronized", async () => {
      const account = await configured();
      const row = await receive(account);
      const attempts = await Promise.allSettled([
        store.claim(broker, row.id, row.version),
        store.claim(second, row.id, row.version),
      ]);
      expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((x) => x.status === "rejected")).toHaveLength(1);
      const current = await store.conversation(admin, row.id);
      expect([broker.user_id, second.user_id]).toContain(current.assigned_user_id);
      expect(
        (
          await pool.query("SELECT owner_id,stage FROM c2s_app.leads WHERE id=$1", [
            current.lead_id,
          ])
        ).rows[0],
      ).toMatchObject({ owner_id: current.assigned_user_id, stage: 1 });
    });
    it("denies cross-organization reads, media/message lookup, claims and notes", async () => {
      const row = await receive(await configured());
      expect((await store.conversations(other)).data).toHaveLength(0);
      await expect(store.conversation(other, row.id)).rejects.toMatchObject({ status: 404 });
      await expect(store.messages(other, row.id)).rejects.toMatchObject({ status: 404 });
      await expect(store.claim(other, row.id, row.version)).rejects.toMatchObject({ status: 404 });
      await expect(store.addNote(other, row.id, "Não autorizado")).rejects.toMatchObject({
        status: 404,
      });
    });
    it("allows supervisor transfer with CAS, blocks ordinary broker transfer and keeps internal notes separate", async () => {
      const row = await receive(await configured());
      const claimed = await store.claim(broker, row.id, row.version);
      await store.setAvailability(second, true);
      await expect(
        store.move(broker, row.id, {
          version: claimed.version,
          action: "transfer",
          target_user_id: second.user_id,
        }),
      ).rejects.toMatchObject({ status: 403 });
      const moved = await store.move(admin, row.id, {
        version: claimed.version,
        action: "transfer",
        target_user_id: second.user_id,
      });
      expect(moved.assigned_user_id).toBe(second.user_id);
      await expect(
        store.move(admin, row.id, { version: claimed.version, action: "requeue" }),
      ).rejects.toMatchObject({ status: 409 });
      await store.addNote(second, row.id, "Nota interna");
      expect((await store.notes(second, row.id))[0].body).toBe("Nota interna");
      expect((await store.messages(second, row.id)).data).toHaveLength(1);
      await expect(store.conversation(broker, row.id)).rejects.toMatchObject({ status: 404 });
    });
    it("creates a fresh waiting conversation after closure without duplicating the contact", async () => {
      const account = await configured();
      const row = await receive(account);
      const claimed = await store.claim(broker, row.id, row.version);
      await store.move(broker, row.id, { version: claimed.version, action: "close" });
      await receive(
        account,
        inbound({ provider_event_key: "message:wamid.new", whatsapp_message_id: "wamid.new" }),
      );
      const all = (await store.conversations(admin)).data;
      expect(all).toHaveLength(2);
      expect(all.filter((v: { status: string }) => v.status === "waiting")).toHaveLength(1);
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.contacts")).rows[0]?.total,
      ).toBe(1);
    });
    it("persists outgoing messages idempotently and never automatically retries uncertain sends", async () => {
      const row = await receive(await configured());
      await store.claim(broker, row.id, row.version);
      const input = {
        client_message_id: randomUUID(),
        type: "text",
        content: { text: "Atendimento local" },
      };
      const queued = await store.queueMessage(broker, row.id, input);
      expect((await store.queueMessage(broker, row.id, input)).id).toBe(queued.id);
      await expect(
        store.queueMessage(broker, row.id, { ...input, content: { text: "Outro texto" } }),
      ).rejects.toMatchObject({ status: 409 });
      const job = await store.beginSend(broker, row.id, queued.id);
      expect(job.send_allowed).toBe(true);
      expect((await store.beginSend(broker, row.id, queued.id)).send_allowed).toBe(false);
      await store.finishSend(job, { ambiguous: true, error_code: "DELIVERY_UNKNOWN" });
      expect((await store.beginSend(broker, row.id, queued.id)).send_allowed).toBe(false);
      expect((await store.message(broker, row.id, queued.id)).delivery_status).toBe("uncertain");
    });
    it("rechecks active membership and the customer's 24-hour window before sending", async () => {
      const row = await receive(await configured());
      await store.claim(broker, row.id, row.version);
      const message = await store.queueMessage(broker, row.id, {
        client_message_id: randomUUID(),
        type: "text",
        content: { text: "Teste" },
      });
      sql(
        `UPDATE c2s_app.wa_conversations SET last_customer_message_at=now()-interval '25 hours' WHERE id='${row.id}';`,
      );
      await expect(store.beginSend(broker, row.id, message.id)).rejects.toMatchObject({
        status: 422,
      });
      await pool.query(
        "UPDATE c2s_app.resources SET data=jsonb_set(data,'{active}','false') WHERE kind='users' AND id=$1",
        [broker.user_id],
      );
      await expect(store.beginSend(broker, row.id, message.id)).rejects.toMatchObject({
        status: 403,
      });
    });
    it("recovers leased incoming work after restart and flags expired sending leases without resending", async () => {
      const account = await configured();
      await store.enqueueEvents(account, [inbound()]);
      const firstLease = (await store.leaseEvents())[0];
      sql(
        `UPDATE c2s_app.wa_webhook_events SET lease_until=now()-interval '1 minute' WHERE id='${firstLease.id}';`,
      );
      const secondLease = (await store.leaseEvents())[0];
      expect(secondLease.lease_token).not.toBe(firstLease.lease_token);
      expect(await store.processEvent(firstLease)).toEqual({ skipped: true });
      await store.processEvent(secondLease);
      const row = (await store.conversations(admin)).data[0];
      await store.claim(broker, row.id, row.version);
      const message = await store.queueMessage(broker, row.id, {
        client_message_id: randomUUID(),
        type: "text",
        content: { text: "Teste" },
      });
      await store.beginSend(broker, row.id, message.id);
      sql(
        `UPDATE c2s_app.wa_messages SET lease_until=now()-interval '1 minute' WHERE id='${message.id}';`,
      );
      expect(await store.recoverOutbox()).toEqual({ recovered: 1 });
      expect((await store.message(broker, row.id, message.id)).delivery_status).toBe("uncertain");
    });
    it("updates delivery status monotonically even when events are reordered", async () => {
      const account = await configured();
      const row = await receive(account);
      await store.claim(broker, row.id, row.version);
      const message = await store.queueMessage(broker, row.id, {
        client_message_id: randomUUID(),
        type: "text",
        content: { text: "Teste" },
      });
      const job = await store.beginSend(broker, row.id, message.id);
      await store.finishSend(job, { provider_id: "wamid.outbound" });
      for (const status of ["read", "sent", "delivered", "failed"]) {
        await store.enqueueEvents(account, [
          {
            kind: "status",
            provider_event_key: "status:wamid.outbound:" + status,
            whatsapp_message_id: "wamid.outbound",
            timestamp: new Date().toISOString(),
            status,
          },
        ]);
        for (const event of await store.leaseEvents()) await store.processEvent(event);
      }
      expect((await store.message(broker, row.id, message.id)).delivery_status).toBe("read");
    });
    it("supports automatic round-robin only among explicitly available users and enforces limits", async () => {
      const account = await configured();
      await store.saveSettings(admin, account.id, {
        version: account.version,
        distribution_mode: "automatic",
        max_conversations: 1,
        retention_days: 365,
        team: "team-a",
      });
      await store.setAvailability(broker, true);
      await store.setAvailability(second, true);
      for (let i = 0; i < 3; i++)
        await receive(
          account,
          inbound({
            provider_event_key: "message:" + i,
            whatsapp_message_id: "wamid." + i,
            from: "551199999000" + i,
          }),
        );
      const all = (await store.conversations(admin)).data;
      expect(all.filter((x: { status: string }) => x.status === "active")).toHaveLength(2);
      expect(all.filter((x: { status: string }) => x.status === "waiting")).toHaveLength(1);
      expect(
        new Set(
          all
            .filter((x: { status: string }) => x.status === "active")
            .map((x: { assigned_user_id: string }) => x.assigned_user_id),
        ).size,
      ).toBe(2);
    });
    it("enforces concurrent capacity across different official numbers", async () => {
      const one = await configured(),
        two = await configured(admin, "123456789012349");
      for (const account of [one, two])
        await store.saveSettings(admin, account.id, {
          version: account.version,
          distribution_mode: "shared",
          max_conversations: 1,
          retention_days: 365,
          team: "",
        });
      await receive(
        one,
        inbound({ provider_event_key: "message:one", whatsapp_message_id: "wamid.one" }),
      );
      await receive(
        two,
        inbound({ provider_event_key: "message:two", whatsapp_message_id: "wamid.two" }),
      );
      const all = (await store.conversations(admin)).data;
      const result = await Promise.allSettled(
        all.map((row: { id: string; version: number }) => store.claim(broker, row.id, row.version)),
      );
      expect(
        result.filter((x: PromiseSettledResult<unknown>) => x.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        result.filter((x: PromiseSettledResult<unknown>) => x.status === "rejected"),
      ).toHaveLength(1);
    });
    it("signals scoped resync after transfer without revealing the now inaccessible conversation", async () => {
      const row = await receive(await configured());
      const claimed = await store.claim(broker, row.id, row.version);
      const before = await store.events(broker);
      await store.setAvailability(second, true);
      await store.move(admin, row.id, {
        version: claimed.version,
        action: "transfer",
        target_user_id: second.user_id,
      });
      const after = await store.events(broker, { after: before.cursor });
      expect(after.data).toEqual([]);
      expect(after.resync).toBe(true);
      expect(BigInt(after.next_cursor)).toBeGreaterThan(BigInt(before.cursor));
      expect((await store.events(other)).resync).toBe(false);
    });
    it("keeps media idempotency tied to uploaded bytes rather than changing provider media IDs", async () => {
      const row = await receive(await configured());
      await store.claim(broker, row.id, row.version);
      const id = randomUUID();
      const first = await store.queueMessage(broker, row.id, {
        client_message_id: id,
        type: "image",
        content: { type: "image", media_id: "11111" },
        media_reference: { id: "11111", sha256: "abc", mime_type: "image/png" },
      });
      const again = await store.queueMessage(broker, row.id, {
        client_message_id: id,
        type: "image",
        content: { type: "image", media_id: "22222" },
        media_reference: { id: "22222", sha256: "abc", mime_type: "image/png" },
      });
      expect(again.id).toBe(first.id);
      expect(again.media_reference.id).toBe("11111");
      await expect(
        store.queueMessage(broker, row.id, {
          client_message_id: id,
          type: "image",
          content: { type: "image", media_id: "22222" },
          media_reference: { id: "22222", sha256: "different" },
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("uses confirmed responses for unanswered metrics and restricts grouped metrics to organization", async () => {
      const row = await receive(await configured());
      await store.claim(broker, row.id, row.version);
      const first = await store.metrics(broker);
      expect(first).toMatchObject({ received: 1, unanswered: 1, transferred: 0 });
      const message = await store.queueMessage(broker, row.id, {
        client_message_id: randomUUID(),
        type: "text",
        content: { text: "Respondido" },
      });
      await store.finishSend(await store.beginSend(broker, row.id, message.id), {
        provider_id: "wamid.metrics",
      });
      const metrics = await store.metrics(broker, { status: "active", source: "whatsapp" });
      expect(metrics.unanswered).toBe(0);
      expect(metrics.by_user[0]).toMatchObject({ key: broker.user_id, count: 1 });
      expect(metrics.by_campaign[0]).toMatchObject({
        key: null,
        name: "Origem desconhecida",
        count: 1,
      });
      expect((await store.metrics(other)).received).toBe(0);
      expect((await store.metrics(broker, { status: "closed" })).received).toBe(0);
      expect((await store.conversations(broker, { filter: "unanswered" })).data).toHaveLength(0);
    });
    it("blocks a stale elevated scope after role or team is changed", async () => {
      await pool.query(
        "UPDATE c2s_app.resources SET data=jsonb_set(data,'{role}','\"broker\"') WHERE kind='users' AND id=$1",
        [admin.user_id],
      );
      await expect(store.conversations(admin)).rejects.toMatchObject({ status: 403 });
      await pool.query(
        "UPDATE c2s_app.resources SET data=jsonb_set(data,'{team}','\"other-team\"') WHERE kind='users' AND id=$1",
        [broker.user_id],
      );
      await expect(store.conversations(broker)).rejects.toMatchObject({ status: 403 });
    });
    it("exports authorized data and erases only closed conversation content while retaining deduplication keys", async () => {
      const account = await configured(),
        row = await receive(account);
      const claim = await store.claim(broker, row.id, row.version);
      await store.addNote(broker, row.id, "Observação privada");
      await expect(store.exportConversation(broker, row.id)).rejects.toMatchObject({ status: 403 });
      const exported = await store.exportConversation(admin, row.id);
      expect(exported.complete).toBe(true);
      expect(exported.messages).toHaveLength(1);
      expect(exported.notes).toHaveLength(1);
      await expect(store.eraseConversation(admin, row.id, claim.version)).rejects.toMatchObject({
        status: 422,
      });
      const closed = await store.move(broker, row.id, { version: claim.version, action: "close" });
      const erased = await store.eraseConversation(admin, row.id, closed.version);
      expect(erased).toMatchObject({ redacted: true, contact_retained: true });
      expect((await store.messages(admin, row.id)).data[0].content).toEqual({});
      expect(await store.notes(admin, row.id)).toEqual([]);
      expect((await store.conversation(admin, row.id)).phone).toBe("+5511999990000");
      expect(await store.enqueueEvents(account, [inbound()])).toEqual({
        accepted: 0,
        duplicate: 1,
      });
      expect((await store.messages(admin, row.id)).data[0].content).toEqual({});
      await expect(store.eraseConversation(admin, row.id, closed.version)).rejects.toMatchObject({
        status: 409,
      });
    });
    it("applies account retention only to old closed conversation content", async () => {
      const account = await configured(),
        row = await receive(account);
      const claimed = await store.claim(broker, row.id, row.version);
      await store.move(broker, row.id, { version: claimed.version, action: "close" });
      sql(
        `UPDATE c2s_app.wa_conversations SET closed_at=now()-interval '366 days' WHERE id='${row.id}';`,
      );
      await receive(
        account,
        inbound({ provider_event_key: "message:newer", whatsapp_message_id: "wamid.newer" }),
      );
      expect(await store.expireContent()).toMatchObject({ redacted: 1 });
      expect((await store.messages(admin, row.id)).data[0].content).toEqual({});
      const waiting = (await store.conversations(admin, { status: "waiting" })).data[0];
      expect((await store.messages(admin, waiting.id)).data[0].content.text).toBe("Olá");
      expect(await store.expireContent()).toMatchObject({ redacted: 0 });
    });
    it("reuses an existing contact only when its organization is proven", async () => {
      const one = await configured(),
        two = await configured(admin, "123456789012349");
      await receive(
        one,
        inbound({ provider_event_key: "message:one", whatsapp_message_id: "wamid.one" }),
      );
      await receive(
        two,
        inbound({ provider_event_key: "message:two", whatsapp_message_id: "wamid.two" }),
      );
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.contacts")).rows[0]?.total,
      ).toBe(1);
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.wa_conversations")).rows[0]
          ?.total,
      ).toBe(2);
      const otherAdmin = {
        ...other,
        role: "admin",
        can_configure: true,
        can_manage: true,
        all: true,
      };
      await pool.query(
        "UPDATE c2s_app.resources SET data=jsonb_set(data,'{role}','\"admin\"') WHERE kind='users' AND id=$1",
        [other.user_id],
      );
      const third = await configured(otherAdmin, "123456789012348");
      await store.enqueueEvents(third, [inbound()]);
      for (const event of await store.leaseEvents()) await store.processEvent(event);
      expect(
        (await pool.query("SELECT count(*)::int total FROM c2s_app.contacts")).rows[0]?.total,
      ).toBe(2);
    });
    it("does not allow blanket legacy membership fallback outside a single server-bound organization", async () => {
      await pool.query(
        "UPDATE c2s_app.resources SET data=data-'organization_id' WHERE kind='users' AND id=$1",
        [broker.user_id],
      );
      await expect(
        store.conversations({ ...broker, single_organization: false }),
      ).rejects.toMatchObject({ status: 403 });
      expect((await store.conversations(broker)).data).toEqual([]);
    });
  },
);
