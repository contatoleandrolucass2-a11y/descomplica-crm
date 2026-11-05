import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { localJwt, localStatus } from "./salesforce-ingest-timeout.mjs";

const fixture = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:fixture@127.0.0.1:54322/postgres",
  JWT_SECRET: "synthetic-local-signing-secret-at-least-thirty-two",
  ANON_KEY: "synthetic-local-api-key-at-least-twenty",
};

test("REST timeout proof rejects remote and ambiguous targets before opening a connection", () => {
  assert.equal(localStatus(JSON.stringify(fixture)).api, fixture.API_URL);
  for (const change of [
    { API_URL: "https://127.0.0.1:54321" },
    { API_URL: "http://example.test:54321" },
    { API_URL: "http://127.0.0.1:54321/other" },
    { API_URL: "http://127.0.0.1:54321?remote=true" },
    { DB_URL: "postgresql://postgres:fixture@example.test:54322/postgres" },
    { DB_URL: "postgresql://postgres:fixture@127.0.0.1:5432/postgres" },
    { DB_URL: "postgresql://postgres:fixture@127.0.0.1:54322/other" },
    { JWT_SECRET: "short" },
    { ANON_KEY: "short" },
  ])
    assert.throws(() => localStatus(JSON.stringify({ ...fixture, ...change })));
});

test("synthetic tokens cannot impersonate the machine role or an arbitrary role", () => {
  for (const role of [
    "service_role",
    "postgres",
    "authenticator",
    "arbitrary",
    "qa_ingest_timeout_bad",
  ]) {
    assert.throws(() => localJwt(fixture.JWT_SECRET, role));
  }
  for (const role of ["anon", "authenticated", "qa_ingest_timeout_0123456789abcdef"]) {
    const body = JSON.parse(
      Buffer.from(localJwt(fixture.JWT_SECRET, role).split(".")[1], "base64url"),
    );
    assert.equal(body.role, role);
    assert.equal(body.exp - body.iat, 300);
  }
});

test("migration changes only the existing machine RPC timeout and documents its exact rollback", async () => {
  const sql = await readFile(
    "supabase/migrations/20261104201024_salesforce_ingest_bounded_timeout.sql",
    "utf8",
  );
  const executable = sql.replace(/^--.*$/gmu, "").trim();
  assert.match(
    executable,
    /^alter function public\.ingest_crm_salesforce_snapshot\(jsonb\)\s+set statement_timeout = '30s';\s+notify pgrst, 'reload schema';$/u,
  );
  assert.match(sql, /reset statement_timeout/u);
});
