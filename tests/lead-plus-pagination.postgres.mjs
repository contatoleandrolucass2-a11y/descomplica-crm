import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { postgresStore } from "../lib/crm/lead-plus/server/postgres.mjs";
import { leadPageRequest } from "../lib/crm/lead-plus/server/lead-list-page.mjs";

// Explicit isolated loopback test URL only. Never reads the operational or CRM URL.
let url;
try {
  url = new URL(process.env.LEAD_PAGINATION_TEST_URL || "invalid:");
} catch {
  throw new Error("Invalid isolated fixture URL.");
}
assert.ok(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
  "Set LEAD_PAGINATION_TEST_URL to an isolated loopback PostgreSQL 17 database.",
);
assert.equal(url.search, "", "Connection URL options are not accepted by this isolated fixture.");
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 1,
  connectionTimeoutMillis: 5000,
});
const client = await pool.connect();
let queryCount = 0;
const store = postgresStore({
  query: (...args) => {
    queryCount += 1;
    return client.query(...args);
  },
});
const actorId = "broker-a";
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const cases = [];
try {
  const metadata = (
    await client.query(
      "SELECT current_setting('server_version_num')::int AS version,to_regnamespace('c2s_app') IS NULL AS empty_schema",
    )
  ).rows[0];
  assert.ok(metadata.version >= 170000, "Fixture follows the repository PostgreSQL 17 contract.");
  assert.equal(
    metadata.empty_schema,
    true,
    "Refuse to touch a database with an existing operational schema.",
  );
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout='10s'");
  await client.query(`CREATE SCHEMA c2s_app;
    CREATE TABLE c2s_app.contacts(id uuid PRIMARY KEY,name text NOT NULL,email text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '');
    CREATE TABLE c2s_app.resources(kind text NOT NULL,id text NOT NULL,data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,id));
    CREATE TABLE c2s_app.leads(id uuid PRIMARY KEY,contact_id uuid NOT NULL REFERENCES c2s_app.contacts(id),owner_id text,source text NOT NULL DEFAULT 'manual',product text NOT NULL DEFAULT 'Fixture',stage integer NOT NULL DEFAULT 0,archived boolean NOT NULL DEFAULT false,value numeric NOT NULL DEFAULT 100,attribution jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE c2s_app.activities(id bigserial PRIMARY KEY,lead_id uuid NOT NULL REFERENCES c2s_app.leads(id),type text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE c2s_app.audit(id bigserial PRIMARY KEY,entity text,entity_id text,action text,detail jsonb,created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO c2s_app.resources(kind,id,data) VALUES
      ('users','broker-a','{"name":"Synthetic A","team":"A"}'),('users','broker-b','{"name":"Synthetic B","team":"B"}'),('users','broker-c','{"name":"Synthetic C","team":"C"}'),
      ('settings','bucket-policy','{"enabled":true,"timeout_minutes":60}'),
      ('settings','bucket-policy--'||md5('B'),'{"enabled":false,"timeout_minutes":60}');
    INSERT INTO c2s_app.contacts(id,name,email,phone)
      SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
        CASE WHEN n=17 THEN 'Nome%_ especial' ELSE 'Synthetic '||n END,'fixture@example.invalid','0000000000' FROM generate_series(1,130) n;
    INSERT INTO c2s_app.leads(id,contact_id,owner_id,stage,archived,created_at,attribution)
      SELECT id,id,CASE WHEN right(id::text,1)::int%3=0 THEN 'broker-a' WHEN right(id::text,1)::int%3=1 THEN 'broker-b' ELSE 'broker-c' END,
        right(id::text,1)::int%6,right(id::text,2)::int%10=0,
        now()-interval '2 days'+floor(right(id::text,2)::int/3)*interval '1 microsecond',
        CASE WHEN right(id::text,1)::int%2=0 THEN jsonb_build_object('next_contact_at',now()+interval '1 day') ELSE '{"next_contact_at":"invalid"}'::jsonb END
      FROM c2s_app.contacts;
  `);
  await client.query(
    "INSERT INTO c2s_app.resources(kind,id,data) VALUES('lead-preferences',$1,$2)",
    [actorId, JSON.stringify({ favorites: [id(2), id(3), id(17), id(33)] })],
  );
  await client.query(
    "UPDATE c2s_app.leads SET attribution=jsonb_build_object('next_contact_at',CASE WHEN id=$1::uuid THEN 'infinity' ELSE 'tomorrow' END) WHERE id=ANY($2::uuid[])",
    [id(13), [id(13), id(15)]],
  );
  const reference = new Date();
  const legacy = async (ownerIds) => {
    const [leads, bucket, timers] = await Promise.all([
      store.leads({ ownerIds }),
      store.bucketLeads(),
      store.bucketTimers(),
    ]);
    const visible = new Map(leads.map((row) => [row.id, row]));
    for (const row of bucket.data) if (!visible.has(row.id)) visible.set(row.id, row);
    const timing = new Map(timers.map((row) => [row.id, row]));
    const available = new Map(bucket.data.map((row) => [row.id, row.bucket_available_at]));
    return [...visible.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
      .map((row) => ({
        ...row,
        ...timing.get(row.id),
        ...(available.has(row.id) ? { bucket_available_at: available.get(row.id) } : {}),
      }));
  };
  const favoriteIds = new Set([id(2), id(3), id(17), id(33)]);
  const future = (row) =>
    !row.archived &&
    row.stage < 5 &&
    Date.parse(row.attribution?.next_contact_at || "") > +reference;
  const category = (row, name) =>
    name === "all"
      ? true
      : name === "favorites"
        ? favoriteIds.has(row.id)
        : name === "future"
          ? future(row)
          : name === "visits"
            ? !row.archived && [2, 3].includes(row.stage)
            : !row.archived && row.stage < 5 && !future(row);
  for (const ownerIds of [["broker-a"], ["broker-a", "broker-b"], [], null]) {
    const complete = await legacy(ownerIds);
    for (const filters of [
      { q: "", owner: "", status: "all" },
      { q: "%_", owner: "", status: "all" },
      { q: "", owner: "broker-b", status: "active" },
      { q: "", owner: "", status: "archived" },
    ]) {
      const filtered = complete.filter(
        (row) =>
          row.name.toLowerCase().includes(filters.q.toLowerCase()) &&
          (!filters.owner || row.owner_id === filters.owner) &&
          (filters.status === "all" || row.archived === (filters.status === "archived")),
      );
      for (const name of ["all", "todo", "visits", "future", "favorites"]) {
        const expected = filtered.filter((row) => category(row, name));
        const received = [];
        let cursor = null;
        let page;
        do {
          const parameters = new URLSearchParams({
            ...filters,
            category: name,
            limit: "7",
            ...(cursor ? { cursor } : {}),
          });
          page = await store.leadPage(
            leadPageRequest(parameters, { ownerIds, actorId }, reference),
          );
          assert.equal(page.total, expected.length);
          assert.equal(page.counts.Todos, filtered.length);
          assert.equal(
            page.counts["A fazer"],
            filtered.filter((row) => category(row, "todo")).length,
          );
          assert.equal(
            page.counts.Visitas,
            filtered.filter((row) => category(row, "visits")).length,
          );
          assert.equal(
            page.counts.Futuras,
            filtered.filter((row) => category(row, "future")).length,
          );
          assert.equal(
            page.counts.Favoritos,
            filtered.filter((row) => category(row, "favorites")).length,
          );
          received.push(...page.data.map((row) => row.id));
          cursor = page.next_cursor;
        } while (cursor);
        // Timestamp rounding in the legacy JS display never defines SQL ordering.
        const expectedIds = expected.map((row) => row.id).sort();
        assert.deepEqual([...received].sort(), expectedIds);
        assert.equal(
          new Set(received).size,
          received.length,
          "No duplicates across tied microsecond cursors",
        );
        cases.push({
          scope: ownerIds === null ? "all" : ownerIds.length,
          filter: filters.q ? "literal" : filters.owner ? "owner" : filters.status,
          category: name,
          rows: received.length,
        });
      }
    }
  }
  // A newly inserted record after the first page cannot move the remaining cursor chain.
  const initial = await store.leadPage(
    leadPageRequest(
      new URLSearchParams({ limit: "2", category: "all" }),
      { ownerIds: null, actorId },
      reference,
    ),
  );
  await client.query(
    "INSERT INTO c2s_app.leads(id,contact_id,owner_id,created_at) VALUES($1,$2,$3,$4)",
    [id(999), id(1), actorId, new Date(+reference + 1000)],
  );
  const continued = await store.leadPage(
    leadPageRequest(
      new URLSearchParams({ limit: "100", category: "all", cursor: initial.next_cursor }),
      { ownerIds: null, actorId },
      new Date(+reference + 2000),
    ),
  );
  assert.equal(continued.total, initial.total);
  assert.ok(!continued.data.some((row) => row.id === id(999)));
  // Complete exports continue to use the unrestricted-by-page read.
  assert.equal((await store.leads()).length, 131);
  await client.query("DELETE FROM c2s_app.leads WHERE id=$1", [id(999)]);
  await client.query(`INSERT INTO c2s_app.contacts(id,name,email,phone)
    SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic volume '||n,'fixture@example.invalid','0000000000' FROM generate_series(131,5000) n;
    INSERT INTO c2s_app.leads(id,contact_id,owner_id,created_at)
    SELECT id,id,'broker-a',now()-interval '2 days'+right(id::text,12)::bigint*interval '1 microsecond'
    FROM c2s_app.contacts WHERE right(id::text,12)::bigint>130`);
  assert.equal((await store.leads()).length, 5000);
  const times = {};
  for (const [name, read] of Object.entries({
    legacy: () => legacy(null),
    page: () =>
      store.leadPage(
        leadPageRequest(
          new URLSearchParams({ limit: "50", category: "all" }),
          { ownerIds: null, actorId },
          new Date(),
        ),
      ),
  })) {
    const samples = [];
    let result, queries;
    for (let sample = 0; sample < 3; sample++) {
      const before = queryCount,
        started = performance.now();
      result = await read();
      samples.push(performance.now() - started);
      queries = queryCount - before;
    }
    times[name] = {
      samplesMs: samples,
      firstExecutionMs: samples[0],
      repeatedExecutionsMs: samples.slice(1),
      queries,
      serializedBytes: Buffer.byteLength(JSON.stringify(result)),
      returnedRows: Array.isArray(result) ? result.length : result.data.length,
    };
  }
  const evidence = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    node: process.version,
    postgresVersionNum: metadata.version,
    method:
      "One established local connection, sequential requests, three raw samples per reader; first/repeated executions separated, no cache flush. Includes local SQL round trip and DTO mapping; not production page latency or a percentile.",
    sourceHashes: Object.fromEntries(
      await Promise.all(
        [
          "lib/crm/lead-plus/server/postgres.mjs",
          "lib/crm/lead-plus/server/lead-list-page.mjs",
          "tests/lead-plus-pagination.postgres.mjs",
        ].map(async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(file))
            .digest("hex"),
        ]),
      ),
    ),
    database:
      "isolated loopback PostgreSQL17, transactional synthetic c2s_app fixture; not production schema attestation",
    cases: cases.length,
    measurementVolume: 5000,
    authorizationFiltersCategories: "passed",
    microsecondCursor: "passed",
    newRecordBoundary: "passed",
    exportComplete: "passed",
    measurement: times,
  };
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/lead-pagination-postgres.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await client.query("ROLLBACK").catch(() => {});
  client.release();
  await pool.end();
}
