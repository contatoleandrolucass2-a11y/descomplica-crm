import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "../..");
const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function localStatus(raw) {
  const status = JSON.parse(raw);
  const api = new URL(status.API_URL);
  const database = new URL(status.DB_URL);
  assert.ok(
    api.protocol === "http:" &&
      loopback.has(api.hostname) &&
      api.port === "54321" &&
      api.pathname === "/" &&
      !api.search &&
      !api.hash &&
      !api.username &&
      !api.password,
    "REST timeout proof accepts only the isolated loopback API",
  );
  assert.ok(
    ["postgres:", "postgresql:"].includes(database.protocol) &&
      loopback.has(database.hostname) &&
      database.port === "54322" &&
      database.pathname === "/postgres" &&
      decodeURIComponent(database.username) === "postgres" &&
      !database.search &&
      !database.hash,
    "REST timeout proof accepts only the isolated loopback database",
  );
  assert.ok(
    typeof status.JWT_SECRET === "string" && status.JWT_SECRET.length >= 32,
    "Isolated JWT signing secret is required",
  );
  assert.ok(
    typeof status.ANON_KEY === "string" && status.ANON_KEY.length >= 20,
    "Isolated API key is required",
  );
  return {
    api: api.origin,
    database: database.href,
    secret: status.JWT_SECRET,
    apiKey: status.ANON_KEY,
  };
}

export function localJwt(secret, role) {
  assert.match(role, /^(?:anon|authenticated|qa_ingest_timeout_[a-f0-9]{16})$/u);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    role,
    iss: "supabase",
    aud: "authenticated",
    iat: now,
    exp: now + 300,
    ...(role === "authenticated" ? { sub: "00000000-0000-4000-8000-000000000001" } : {}),
  })}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

const catalogSql = `select p.prosrc, p.proconfig, p.proacl::text, p.proowner, p.prosecdef
  from pg_catalog.pg_proc p
  where p.oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure`;
const rolesSql = `select rolname, rolconfig from pg_catalog.pg_roles
  where rolname in ('authenticator','anon','authenticated','service_role') order by rolname`;

export async function proveTimeout(client, status) {
  assert.equal(
    (await client.query("show server_version_num")).rows[0].server_version_num.slice(0, 2),
    "17",
  );
  const original = (await client.query(catalogSql)).rows;
  assert.ok(original[0].proconfig.includes("statement_timeout=30s"));
  const originalRoles = (await client.query(rolesSql)).rows;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const role = `qa_ingest_timeout_${suffix}`;
  const baseline = `qa_ingest_baseline_${suffix}`;
  const bounded = `qa_ingest_bounded_${suffix}`;
  const names = [role, baseline, bounded];
  for (const name of names) assert.match(name, /^qa_ingest_[a-z]+_[a-f0-9]{16}$/u);
  assert.equal(
    (await client.query("select count(*)::int n from pg_catalog.pg_roles where rolname=$1", [role]))
      .rows[0].n,
    0,
  );
  const receipts = [];
  const request = async (name, seconds, caller = role) => {
    const started = performance.now();
    const response = await fetch(`${status.api}/rest/v1/rpc/${name}`, {
      method: "POST",
      redirect: "error",
      headers: {
        apikey: status.apiKey,
        Authorization: `Bearer ${localJwt(status.secret, caller)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        name === "ingest_crm_salesforce_snapshot" ? { p_payload: {} } : { seconds },
      ),
      signal: AbortSignal.timeout(45000),
    });
    const body = await response.json();
    return { status: response.status, body, elapsedMs: Math.round(performance.now() - started) };
  };
  let fixtureCreated = false;
  let stage = "fixture-setup";
  try {
    await client.query("begin");
    await client.query(`create role ${role} nologin noinherit; alter role ${role} set statement_timeout='8s';
      grant ${role} to authenticator; grant usage on schema public to ${role};
      create function public.${baseline}(seconds integer) returns text
      language plpgsql security definer set search_path='' as $$
      begin perform pg_catalog.pg_sleep(seconds); return pg_catalog.current_setting('statement_timeout'); end $$;
      create function public.${bounded}(seconds integer) returns text
      language plpgsql security definer set search_path='' set statement_timeout='30s' as $$
      begin perform pg_catalog.pg_sleep(seconds); return pg_catalog.current_setting('statement_timeout'); end $$;
      revoke all on function public.${baseline}(integer),public.${bounded}(integer) from public,anon,authenticated;
      grant execute on function public.${baseline}(integer),public.${bounded}(integer) to ${role};`);
    await client.query("commit");
    fixtureCreated = true;
    await client.query("notify pgrst, 'reload config'; notify pgrst, 'reload schema'");
    stage = "schema-reload";
    let ready;
    for (let attempt = 0; attempt < 40; attempt++) {
      ready = await request(baseline, 0);
      if (ready.status === 200) break;
      assert.ok(
        ["PGRST202", "42501"].includes(ready.body.code),
        "Unexpected fixture reload response",
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(ready.status, 200, "PostgREST must load the isolated fixture");
    assert.equal(
      ready.body,
      "8s",
      "Synthetic impersonated role has an effective eight-second REST budget",
    );
    stage = "inherited-timeout";
    const before = await request(baseline, 9);
    assert.equal(before.body.code, "57014");
    assert.ok(before.elapsedMs >= 7500);
    receipts.push({
      check: "inherited-eight-second-timeout",
      http: before.status,
      code: before.body.code,
      elapsedMs: before.elapsedMs,
    });
    stage = "function-override";
    const success = await request(bounded, 9);
    assert.equal(success.status, 200);
    assert.equal(success.body, "30s");
    assert.ok(success.elapsedMs >= 8500);
    receipts.push({
      check: "function-override-survives-nine-seconds",
      http: success.status,
      effectiveTimeout: success.body,
      elapsedMs: success.elapsedMs,
    });
    stage = "finite-limit";
    const limit = await request(bounded, 31);
    assert.equal(limit.body.code, "57014");
    assert.ok(limit.elapsedMs >= 29000);
    receipts.push({
      check: "function-override-remains-bounded",
      http: limit.status,
      code: limit.body.code,
      elapsedMs: limit.elapsedMs,
    });
    stage = "no-leak";
    for (let attempt = 0; attempt < 5; attempt++) {
      const next = await request(baseline, 0);
      assert.equal(next.status, 200);
      assert.equal(next.body, "8s", "Function setting must not leak into later requests");
    }
    receipts.push({ check: "subsequent-requests-retain-eight-seconds", requests: 5 });
    stage = "authorization";
    for (const caller of ["anon", "authenticated"]) {
      for (const name of [bounded, "ingest_crm_salesforce_snapshot"]) {
        const denied = await request(name, 0, caller);
        assert.ok([401, 403].includes(denied.status));
        assert.equal(
          denied.body.code,
          "42501",
          "Denial must be function authorization, not invalid JWT",
        );
      }
    }
    receipts.push({ check: "anonymous-and-authenticated-denied", functions: 2 });
  } catch {
    throw Object.assign(new Error("Isolated REST proof failed"), { proofStage: stage });
  } finally {
    await client.query("rollback");
    if (fixtureCreated) {
      await client.query(`begin; drop function public.${baseline}(integer),public.${bounded}(integer);
        revoke usage on schema public from ${role}; revoke ${role} from authenticator; drop role ${role}; commit;`);
      await client.query("notify pgrst, 'reload config'; notify pgrst, 'reload schema'");
    }
    assert.deepEqual(
      (await client.query(catalogSql)).rows,
      original,
      "Production RPC body, configuration, owner and ACL must remain untouched by the proof",
    );
    assert.deepEqual(
      (await client.query(rolesSql)).rows,
      originalRoles,
      "Existing roles and their settings must remain untouched by the proof",
    );
    assert.equal(
      (
        await client.query("select count(*)::int n from pg_catalog.pg_roles where rolname=$1", [
          role,
        ])
      ).rows[0].n,
      0,
      "Isolated role must be removed",
    );
    assert.equal(
      (
        await client.query(
          "select count(*)::int n from pg_catalog.pg_proc where proname=any($1::text[])",
          [[baseline, bounded]],
        )
      ).rows[0].n,
      0,
      "Isolated functions must be removed",
    );
  }
  return {
    postgresMajor: 17,
    originOfEightSecondBudget: "synthetic impersonated role, not a change to authenticator",
    realRpcTimeout: "30s",
    requestDeadlineMs: 45000,
    receipts,
    cleanupVerified: true,
  };
}

async function main() {
  assert.equal(process.env.CI, "true", "REST timeout proof requires an isolated CI runner");
  assert.equal(
    process.env.CRM_INGEST_TIMEOUT_ISOLATED,
    "true",
    "Explicit isolated proof scope is required",
  );
  const raw = execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  const status = localStatus(raw);
  const client = new pg.Client({
    connectionString: status.database,
    ssl: false,
    application_name: "salesforce-ingest-timeout-proof",
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const result = await proveTimeout(client, status);
    const directory = path.join(root, "test-results/salesforce-ingest-timeout");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const stage = /^[a-z-]+$/u.test(error?.proofStage || "")
      ? error.proofStage
      : "preflight-or-cleanup";
    console.error(`Isolated ingestion timeout proof failed (${stage}).`);
    process.exitCode = 1;
  });
}
