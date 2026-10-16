import assert from "node:assert/strict";
import { test } from "vitest";
import {
  SOURCES,
  TABLES,
  digest,
  statements,
  stripOuterTransaction,
  loadSources,
  combineSources,
  buildActivation,
  buildRollbackRehearsal,
  snapshotSql,
  verificationPlan,
} from "../scripts/pages/catalog-activation.mjs";

test("immutable real trio loads in exact order and preserves every non-wrapper byte", async () => {
  const loaded = await loadSources();
  const body = combineSources(loaded);
  assert.equal(loaded.length, 3);
  for (const source of loaded) {
    const sql = source.bytes.toString("utf8");
    const spans = statements(sql);
    const first = spans[0];
    const last = spans.at(-1);
    assert.ok(first && last);
    assert.equal(
      stripOuterTransaction(sql),
      sql.slice(0, first.start) + sql.slice(first.end, last.start) + sql.slice(last.end),
    );
  }
  assert.equal(
    statements(body).filter(({ tokens }) => ["BEGIN", "COMMIT"].includes(tokens[0] ?? "")).length,
    0,
  );
  assert.match(body, /create or replace function public.get_crm_routines/);
  assert.match(body, /alter policy crm_point_metrics_select_authorized/);
});

test("reject missing, extra, reordered, changed and caller-rehashed sources", async () => {
  const loaded = await loadSources();
  assert.throws(() => combineSources(loaded.slice(1)), /exact source trio/);
  assert.throws(() => combineSources([...loaded, loaded[0]]), /exact source trio/);
  assert.throws(() => combineSources([...loaded].reverse()), /hash\/order/);
  for (const suffix of ["\n", "COMMIT;", "-- changed"]) {
    const changed = loaded.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }));
    const first = changed[0];
    assert.ok(first);
    first.bytes = Buffer.concat([first.bytes, Buffer.from(suffix)]);
    first.sha256 = "0".repeat(64);
    assert.throws(() => combineSources(changed), /hash\/order/);
  }
  assert.ok(Object.isFrozen(SOURCES) && SOURCES.every(Object.isFrozen));
});

for (const control of [
  "BEGIN",
  "BEGIN WORK",
  "START TRANSACTION",
  "COMMIT",
  "COMMIT AND CHAIN",
  "END",
  "ABORT",
  "ROLLBACK",
  "ROLLBACK TO SAVEPOINT x",
  "SAVEPOINT x",
  "RELEASE SAVEPOINT x",
  "PREPARE TRANSACTION 'x'",
  "COMMIT PREPARED 'x'",
  "ROLLBACK PREPARED 'x'",
  "SET TRANSACTION READ ONLY",
  "SET LOCAL TRANSACTION READ ONLY",
  "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY",
  "CoMmIt /* nested /* comment */ ok */",
]) {
  test(`reject extra top-level control: ${control}`, () => {
    assert.throws(
      () => stripOuterTransaction(`BEGIN; SELECT 1; ${control}; COMMIT;`),
      /Extra transaction control/,
    );
  });
}

test("retain PLpgSQL blocks, nested comments, escaped strings and quoted identifiers", () => {
  const body = `\n-- COMMIT;\n/* BEGIN; /* END; */ ROLLBACK; */
CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN PERFORM 'COMMIT;'; EXCEPTION WHEN OTHERS THEN RAISE; END;
END;
$fn$;
DO $$ BEGIN RAISE NOTICE 'BEGIN; END;'; END; $$;
SELECT 'it''s COMMIT;', E'escaped\\\' COMMIT;', "COMMIT;", $x$ROLLBACK;$x$;
`;
  assert.equal(
    stripOuterTransaction(`/*prefix*/BEGIN;${body}COMMIT;--suffix`),
    `/*prefix*/${body}--suffix`,
  );
});

test("CR and CRLF line comments cannot hide transaction controls", () => {
  for (const newline of ["\r", "\r\n", "\n"]) {
    assert.throws(
      () => stripOuterTransaction(`BEGIN; SELECT 1; -- comment${newline}COMMIT; SELECT 2; COMMIT;`),
      /Extra transaction control/,
    );
  }
});

for (const input of [
  "SELECT 1;",
  "BEGIN; COMMIT;",
  "BEGIN WORK; SELECT 1; COMMIT;",
  "BEGIN; SELECT 1; COMMIT AND CHAIN;",
  "BEGIN; SELECT 1; COMMIT; SELECT 2;",
  "BEGIN; SELECT 'oops; COMMIT;",
  "BEGIN; SELECT $$oops; COMMIT;",
  "BEGIN; /*oops",
  "BEGIN; SELECT 1; COMMIT",
  "BEGIN; ; COMMIT;",
  "BEGIN; \\include file; COMMIT;",
  "BEGIN; SELECT 1; COMMIT; /* unterminated",
]) {
  test(`reject malformed or unsupported input ${JSON.stringify(input)}`, () =>
    assert.throws(() => stripOuterTransaction(input)));
}

const snapshot = () =>
  Object.fromEntries(TABLES.map((table) => [table, { count: 0, sha256: "a".repeat(64) }]));
test("CAS and preservation share one PostgreSQL DO statement before and after immutable body", async () => {
  const loaded = await loadSources();
  const activation = buildActivation(loaded, snapshot());
  assert.equal(activation.transactionOwner, "PostgreSQL single DO statement");
  assert.match(activation.query, /current_setting\('transaction_isolation'\) <> 'read committed'/);
  assert.ok(!activation.query.includes("set transaction"));
  assert.match(activation.sha256, /^[a-f0-9]{64}$/);
  const list = statements(activation.query);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0]?.tokens, ["DO", "<quoted>", "LANGUAGE", "PLPGSQL"]);
  assert.equal(
    list.filter(({ tokens }) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(tokens[0] ?? "")).length,
    0,
  );
  assert.ok(activation.query.indexOf("lock table") < activation.query.indexOf("do $catalog_cas$"));
  assert.ok(
    activation.query.indexOf("do $catalog_cas$") < activation.query.indexOf(combineSources(loaded)),
  );
  assert.ok(
    activation.query.indexOf(combineSources(loaded)) <
      activation.query.indexOf("do $catalog_preserved$"),
  );
  for (const table of TABLES) {
    assert.ok(activation.query.includes(`catalog CAS mismatch: ${table}`));
    assert.ok(activation.query.includes(`catalog preservation failed: ${table}`));
    assert.ok(snapshotSql.includes(`public.${table}`));
  }
  assert.match(activation.query, /select key, is_active from catalog_before_app_pages/);
  assert.match(activation.query, /select \* from catalog_before_user_permission_overrides/);
  assert.match(activation.query, /errcode = '40001'/);
});

test("backup snapshot is mandatory, exact, typed and cannot inject SQL", async () => {
  const loaded = await loadSources();
  for (const bad of [undefined, {}, { ...snapshot(), extra: {} }])
    assert.throws(() => buildActivation(loaded, bad), /snapshot/);
  for (const value of [
    { count: -1, sha256: "a".repeat(64) },
    { count: "0", sha256: "a".repeat(64) },
    { count: 0, sha256: "'; COMMIT; --" },
    { count: 0, sha256: "a".repeat(64), extra: true },
  ]) {
    assert.throws(
      () => buildActivation(loaded, { ...snapshot(), app_pages: value }),
      /Invalid backup snapshot/,
    );
  }
  assert.ok(verificationPlan.backupAndCas.some((entry) => entry.includes("NEW backup")));
});

test("rollback rehearsal injects after the last migration and compares full before/after state", async () => {
  const loaded = await loadSources();
  const rehearsal = buildRollbackRehearsal(loaded, snapshot());
  assert.equal(rehearsal.expectedSqlState, "P0235");
  assert.ok(
    rehearsal.query.indexOf("do $catalog_injected_failure$") >
      rehearsal.query.indexOf("alter policy crm_point_metrics_select_authorized"),
  );
  assert.ok(
    rehearsal.query.indexOf("do $catalog_injected_failure$") <
      rehearsal.query.indexOf("do $catalog_preserved$"),
  );
  assert.ok(rehearsal.query.includes(combineSources(loaded)));
  assert.equal(
    statements(rehearsal.query).filter(({ tokens }) =>
      ["BEGIN", "COMMIT", "ROLLBACK"].includes(tokens[0] ?? ""),
    ).length,
    0,
  );
  for (const name of [...TABLES, "routines", "policies"]) {
    assert.ok(rehearsal.fixtureSql.includes(`catalog_rollback_${name} on commit preserve rows`));
    assert.ok(rehearsal.verifyRollbackSql.includes(`rollback mismatch: ${name}`));
  }
  assert.equal((rehearsal.verifyRollbackSql.match(/union all/g) ?? []).length, 7);
  assert.ok(rehearsal.query.includes("using errcode = 'P0236'"));
  assert.ok(
    rehearsal.query.indexOf("using errcode = 'P0236'") <
      rehearsal.query.indexOf("using errcode = 'P0235'"),
  );
  assert.ok(!buildActivation(loaded, snapshot()).query.includes("P0235"));
});

function dynamicPayload(query: string) {
  const match = query.match(/  execute (\$catalog_bundle_\d+\$)([\s\S]*)\1;\nend;/);
  assert.ok(match?.[2], "Expected one dollar-quoted EXECUTE payload");
  return match[2];
}

test("operation and rehearsal are one statement with a byte-preserved, control-free dynamic payload", async () => {
  const loaded = await loadSources();
  const operation = buildActivation(loaded, snapshot());
  const rehearsal = buildRollbackRehearsal(loaded, snapshot());
  for (const query of [operation.query, rehearsal.query]) {
    assert.equal(statements(query).length, 1);
    assert.equal(statements(query)[0]?.tokens[0], "DO");
    const payload = dynamicPayload(query);
    assert.ok(payload.includes(combineSources(loaded)));
    const inner = statements(payload);
    assert.ok(inner.length > 3);
    assert.ok(
      !inner.some(({ tokens }) =>
        /^(BEGIN|COMMIT|END|ROLLBACK|ABORT|START|SAVEPOINT|RELEASE|PREPARE)$/.test(tokens[0] ?? ""),
      ),
    );
    assert.ok(!inner.some(({ tokens }) => tokens[0] === "SET" && tokens[1] === "TRANSACTION"));
    assert.ok(query.indexOf("errcode = '25001'") < query.indexOf("  execute "));
    assert.ok(!query.slice(0, query.indexOf("  execute ")).includes("exception when"));
  }
  assert.equal(operation.sha256, digest(operation.query));
  assert.equal(operation.query, buildActivation(loaded, snapshot()).query);
  assert.ok(rehearsal.instructions.includes("NO external BEGIN/ROLLBACK"));
});

test("source pins require raw LF and reject CRLF checkout bytes", async () => {
  const loaded = await loadSources();
  for (const source of loaded) {
    assert.ok(!source.bytes.includes(13), `${source.name} must contain raw LF`);
    const changed = loaded.map((entry) =>
      entry === source
        ? { ...entry, bytes: Buffer.from(entry.bytes.toString("utf8").replaceAll("\n", "\r\n")) }
        : entry,
    );
    assert.throws(() => combineSources(changed), /hash\/order/);
  }
});

test("plan separates statement atomicity from history and timeout guarantees", () => {
  assert.ok(verificationPlan.backupAndCas.some((entry) => entry.includes("NOT assumed atomic")));
  assert.ok(verificationPlan.limitations.includes("does NOT guarantee a deadline"));
  assert.ok(verificationPlan.limitations.includes("lock_timeout remains 5s"));
  assert.ok(verificationPlan.localRehearsal.some((entry) => entry.includes("AUTOCOMMIT")));
});
