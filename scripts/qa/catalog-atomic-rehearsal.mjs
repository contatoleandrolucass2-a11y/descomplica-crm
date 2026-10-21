import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixtureDirectory = "/work/tests/fixtures/compact-user-access";

function beforeOnce(source, marker) {
  assert.equal(source.split(marker).length, 2, `Expected one fixture boundary: ${marker}`);
  return source.slice(0, source.indexOf(marker));
}

// Reuse the maintained legacy fixtures, stopping before their migration/test
// sections. Absolute includes retain psql's resolution when SQL arrives on stdin.
export function buildAtomicBaseline({ rehearsal, catalog, pageData }) {
  return [
    beforeOnce(rehearsal, "\\ir user-access.test.sql"),
    beforeOnce(catalog, "begin;\nselect plan(8);"),
    "\\ir ../../../supabase/migrations/20261013014310_crm_shared_routines.sql",
    "\\ir ../../../supabase/migrations/20261014020437_crm_routine_completions.sql",
    beforeOnce(
      pageData,
      "\\ir ../../../supabase/migrations/20261016000120_individual_page_data_access.sql",
    ),
    "\\set baseline true",
    `\\ir ${fixtureDirectory}/catalog-atomic-rehearsal.sql`,
  ]
    .join("\n")
    .replace(
      /^\\ir (?!\/)(.+)$/gm,
      (_, relative) => `\\ir ${path.posix.resolve(fixtureDirectory, relative.trim())}`,
    );
}

export function buildRollbackSession(rehearsal) {
  assert.equal(rehearsal.expectedSqlState, "P0235");
  // Keep the temp preimage, failed DO and verification in ONE psql connection.
  // Only the injected statement may fail; SQLSTATE must match before continuing.
  return `\\set AUTOCOMMIT on
\\set ON_ERROR_STOP on
${rehearsal.fixtureSql}
\\set ON_ERROR_STOP off
${rehearsal.query}
\\set observed_sqlstate :SQLSTATE
\\set ON_ERROR_STOP on
select :'observed_sqlstate' = 'P0235' as expected_failure \\gset
\\if :expected_failure
${rehearsal.verifyRollbackSql}
\\echo QA_ATOMIC_ROLLBACK_VERIFIED P0235
\\else
\\echo QA_ATOMIC_UNEXPECTED_SQLSTATE :observed_sqlstate
\\quit
\\endif
`;
}

export async function rehearseCatalogAtomicity({ repositoryRoot, executeSql, verifyTap }) {
  const readFixture = async (name) =>
    (
      await readFile(path.join(repositoryRoot, "tests/fixtures/compact-user-access", name), "utf8")
    ).replaceAll("\r\n", "\n");
  const baseline = buildAtomicBaseline({
    rehearsal: await readFixture("rehearsal.sql"),
    catalog: await readFixture("page-catalog.test.sql"),
    pageData: await readFixture("page-data.test.sql"),
  });
  // This is the production builder, not a QA implementation of transaction stripping.
  const { buildActivation, buildRollbackRehearsal, loadSources, snapshotSql, statements } =
    await import("../pages/catalog-activation.mjs");
  const migrations = await loadSources(path.join(repositoryRoot, "supabase/migrations"));
  await executeSql(baseline);
  const expectedSnapshot = JSON.parse((await executeSql(snapshotSql)).trim());
  const activation = buildActivation(migrations, expectedSnapshot);
  const rehearsal = buildRollbackRehearsal(migrations, expectedSnapshot);
  for (const query of [activation.query, rehearsal.query]) {
    const parsed = statements(query);
    assert.equal(parsed.length, 1, "Autocommit proof requires exactly one statement");
    assert.equal(parsed[0].tokens[0], "DO", "Atomic operation must be a single DO");
  }
  const snapshot = async () =>
    JSON.parse((await executeSql("select qa_atomic.snapshot();")).trim());
  const before = await snapshot();
  const rollbackOutput = await executeSql(buildRollbackSession(rehearsal));
  assert.match(rollbackOutput, /^QA_ATOMIC_ROLLBACK_VERIFIED P0235\s*$/m);
  const after = await snapshot();
  for (const component of Object.keys(before)) {
    assert.deepEqual(after[component], before[component], `Atomic rollback changed ${component}`);
  }
  await executeSql(`\\set AUTOCOMMIT on\n${activation.query}`);
  const output = await executeSql(
    `\\set baseline false\n\\ir ${fixtureDirectory}/catalog-atomic-rehearsal.sql`,
  );
  const assertions = verifyTap(output, [26, 29]);
  return {
    status: "passed",
    rollbackComponents: Object.keys(before),
    assertions,
    activationSha256: activation.sha256,
    migrations: migrations.map(({ name, sha256 }) => ({ name, sha256 })),
  };
}
