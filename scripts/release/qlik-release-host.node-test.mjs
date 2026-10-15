import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fixture = fileURLToPath(new URL("./fixtures/qlik-host-fixture.mjs", import.meta.url));
const scenarios = [
  "happy",
  "current-unit",
  "credential-valid",
  "credential-stat-error",
  "credential-absent",
  "credential-owner",
  "credential-mode",
  "credential-special-mode",
  "credential-empty",
  "credential-oversize",
  "credential-hardlink",
  "credential-symlink",
  "credential-directory",
  "credential-parent-mode",
  "credential-parent-owner",
  "credential-parent-symlink",
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
  "artifact-stale-legacy",
  "artifact-delayed",
  "artifact-deadline-overrun",
  "artifact-deadline-exact",
  "artifact-deadline-delay",
  "artifact-future",
  "artifact-connected",
  "artifact-owner",
  "artifact-mode",
  "recovery",
  "recovery-residue",
  "legacy-recovery",
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
    if (scenario === "artifact-delayed") {
      assert.equal(report.verification.elapsedMs, 200_000);
      assert.deepEqual(report.verification.delays, Array(100).fill(2000));
    }
    if (scenario.startsWith("artifact-deadline-")) {
      assert.equal(
        report.verification.elapsedMs,
        scenario === "artifact-deadline-overrun" ? 420_001 : 420_000,
      );
      assert.deepEqual(report.verification.delays, [
        scenario === "artifact-deadline-delay" ? 500 : 0,
      ]);
    }
  });
}
