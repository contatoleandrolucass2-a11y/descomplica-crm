import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertRankingFailureResult } from "./qlik-release-host.mjs";
import { rankingCycleArtifact } from "../../ops/qlik/ranking-artifact.mjs";

test("ranking diagnostic host boundary accepts legacy and projected allowlisted failures", () => {
  for (const state of ["running", "reauth_required", "unavailable"])
    assert.doesNotThrow(() => assertRankingFailureResult({ state }));
  for (const state of ["reauth_required", "unavailable"])
    for (const code of [
      "mapping_invalid",
      "csrf_unavailable",
      "totals_mismatch",
      "transport_timeout",
      "page_disposal_unconfirmed",
      "staging_unavailable",
      "publication_unavailable",
    ])
      assert.doesNotThrow(() =>
        assertRankingFailureResult(rankingCycleArtifact({ state, reason: code }).result),
      );
});

test("ranking diagnostic host boundary rejects unknown fields, values and receipt substitutes", () => {
  for (const value of [
    null,
    [],
    { state: "succeeded", code: "mapping_invalid" },
    { state: "running", code: "mapping_invalid" },
    { state: "unavailable", reason: "mapping_invalid" },
    { state: "unavailable", code: "mapping_invalid", payload: "private" },
    ...["private", "mapping_invalid:private", null, ["mapping_invalid"], {}, 123].map((code) => ({
      state: "unavailable",
      code,
    })),
  ])
    assert.throws(() => assertRankingFailureResult(value), /Invalid Qlik ranking result/);
});

const fixture = fileURLToPath(new URL("./fixtures/qlik-host-fixture.mjs", import.meta.url));
const scenarios = [
  "happy",
  "status-pending",
  "status-reauth_required",
  "status-unavailable",
  "input-mismatch",
  "unsafe-parent",
  "unsafe-profile",
  "unit-mismatch",
  "effective-unit",
  "console-active",
  "owner-process",
  "pending-mismatch",
  "backup-unit-hash",
  "archive-corrupt",
  "unsafe-archive",
  "apply-callback",
  "start-callback",
  "artifact-stale",
  "artifact-future",
  "artifact-connected",
  "artifact-owner",
  "artifact-mode",
  "recovery",
  "recovery-residue",
  "lost-lock",
  "backup-identity",
  "start-reload",
  "start-directory",
  "deferred-reload",
  "unit-umask",
  "apply-race-unit",
  "apply-race-ledger",
  "apply-race-lock",
  "apply-guard-missing",
  "apply-guard-expired",
  "start-race-unit",
  "start-race-ledger",
  "start-race-reload",
  "start-race-directory",
  "start-race-lock",
  "start-race-process",
  "start-guard-missing",
  "start-guard-expired",
  "profile-root-symlink",
  "profile-root-symlink-before-tar",
  "profile-root-owner",
  "profile-root-mode",
  "profile-root-realpath",
  "ranking-happy",
  "ranking-previous-enabled",
  "ranking-eight-minutes",
  "ranking-timeout",
  "ranking-deadline-expired",
  "ranking-unavailable",
  "ranking-reauth_required",
  ...[
    "stale",
    "future",
    "retimestamped",
    "receipt",
    "hash",
    "uuid",
    "kind",
    "extra",
    "connected",
    "mode",
    "owner",
    "link",
  ].map((reason) => `ranking-artifact-${reason}`),
  ...["missing", "owner", "mode", "link"].map((reason) => `ranking-credential-prepare-${reason}`),
  "ranking-credential-apply",
  "ranking-credential-start",
  "ranking-credential-boot",
  ...[
    "unit",
    "ledger",
    "lock",
    "enabled",
    "link",
    "reload",
    "active",
    "artifact",
    "guard-missing",
    "guard-expired",
  ].map((reason) => `ranking-boot-${reason}`),
  ...[
    "before-enable",
    "after-enable",
    "enabled",
    "ranking",
    "disable-fail",
    "without-credential",
  ].map((reason) => `ranking-recovery-${reason}`),
];

for (const scenario of scenarios) {
  test(`Qlik real host, isolated subprocess: ${scenario}`, { timeout: 30000 }, () => {
    assert.equal(Number(process.versions.node.split(".")[0]), 24, "Use Node 24 for these tests");
    const result = spawnSync(
      process.execPath,
      ["--experimental-test-module-mocks", fixture, scenario],
      { encoding: "utf8", timeout: 25000, maxBuffer: 1048576, windowsHide: true },
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, `${scenario}\n${result.stderr}\n${result.stdout}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.scenario, scenario);
    assert.equal(report.passed, true);
    assert.equal(report.temporaryRemoved, true);
    assert.equal(report.realExternalCommands, 0);
    assert.ok(report.lockChecks > 0);
  });
}
