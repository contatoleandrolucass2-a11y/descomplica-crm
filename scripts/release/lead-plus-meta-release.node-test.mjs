import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { executeRelease } from "./production-release-engine.mjs";
import { recoverRelease } from "./production-release-recovery.mjs";
import { parseReleaseArguments } from "./production-release.mjs";
import { validateDeploymentState } from "./production-release-policy.mjs";
const a = "a".repeat(40),
  b = "b".repeat(40),
  imageA = "sha256:" + "1".repeat(64),
  imageB = "sha256:" + "2".repeat(64);
const oldId = "00000000-0000-4000-8000-000000000001",
  newId = "00000000-0000-4000-8000-000000000002",
  recoveryId = "00000000-0000-4000-8000-000000000003";
const now = Date.parse("2026-11-01T12:30:10.000Z"),
  change = { backupId: newId, beforeSha256: "3".repeat(64), afterSha256: "4".repeat(64) };
function fixture() {
  const system = {
    state: {
      schemaVersion: 1,
      release: {
        deploymentId: oldId,
        sha: a,
        imageId: imageA,
        deployedAt: "2026-11-01T12:00:00.000Z",
        evidence: "Original receipt",
      },
      inProgress: null,
    },
    env: a,
    live: a,
    json: "before",
    events: [],
    failure: null,
  };
  const observation = () => ({
    state: structuredClone(system.state),
    environmentSha: system.env,
    containerSha: system.live,
    containerImageId: system.live === a ? imageA : imageB,
    healthSha: system.live,
    publicHealthSha: system.live,
    startedAt: now,
    checkedAt: now,
  });
  const crash = (phase) => {
    if (system.failure === phase) {
      system.failure = null;
      throw Error("Synthetic interruption");
    }
  };
  system.io = {
    now: () => now,
    id: () => (system.state.inProgress?.operation === "rollback" ? recoveryId : newId),
    observe: async () => observation(),
    readState: async () => structuredClone(system.state),
    candidate: async () => ({
      mainSha: b,
      run: {
        id: 123,
        status: "completed",
        conclusion: "success",
        event: "push",
        head_branch: "main",
        head_sha: b,
      },
      jobs: ["validate", "release-gates", "isolated-restore", "promotable-image"].map((name) => ({
        name,
        status: "completed",
        conclusion: "success",
      })),
    }),
    prepare: async () => {},
    prepareRuntimeChange: async () => {
      system.events.push("backup");
      assert.equal(system.json, "before");
      return change;
    },
    writeState: async (expected, next) => {
      assert.ok(isDeepStrictEqual(expected, system.state));
      system.events.push(next.inProgress ? "intent-or-cas" : "receipt");
      system.state = structuredClone(next);
    },
    bind: async (options, beforeWrite) => {
      await beforeWrite();
      assert.deepEqual(system.state.inProgress.runtimeChange, change);
      system.json = options.restoreRuntime ? "before" : "after";
      system.events.push("json-" + system.json);
      crash("json");
      system.env = options.targetSha;
      crash("bind");
    },
    up: async (transaction, sha, beforeStart) => {
      await beforeStart();
      assert.equal(system.json, transaction.operation === "rollback" ? "before" : "after");
      system.live = sha;
      system.events.push("up-" + sha[0]);
      crash("up");
    },
    verify: async (sha, image, environmentCheck, runtimeCheck) => {
      assert.equal(system.live, sha);
      assert.deepEqual(runtimeCheck.change, change);
      assert.equal(system.json, runtimeCheck.restore ? "before" : "after");
      crash("verify");
    },
    recoveryObservation: async () => ({
      ...observation(),
      container: {
        containerSha: system.live,
        containerImageId: system.live === a ? imageA : imageB,
        running: true,
      },
    }),
  };
  system.options = {
    operation: "deploy",
    expectedDeploymentId: oldId,
    expectedSha: a,
    targetSha: b,
    targetImageId: imageB,
    ciRunId: 123,
    leadPlusMeta: true,
  };
  return system;
}
test("LEAD+ explicit CLI flag is exclusive and never accepts credential arguments", () => {
  const args = [
    "deploy",
    "--expected-deployment-id",
    oldId,
    "--expected-sha",
    a,
    "--sha",
    b,
    "--image-id",
    imageB,
    "--ci-run-id",
    "123",
    "--lead-plus-meta",
    "enable",
  ];
  assert.equal(parseReleaseArguments(args).values["lead-plus-meta"], "enable");
  assert.throws(() => parseReleaseArguments([...args, "--meta-ads", "enable"]));
  assert.throws(() => parseReleaseArguments([...args, "--token", "private"]));
});
test("LEAD+ durable descriptor is recorded before any configuration or image change", async () => {
  const s = fixture();
  const result = await executeRelease(s.options, s.io);
  assert.equal(result.status, "deployed");
  assert.ok(s.events.indexOf("backup") < s.events.indexOf("intent-or-cas"));
  assert.ok(s.events.indexOf("intent-or-cas") < s.events.indexOf("json-after"));
  assert.equal(s.json, "after");
});
for (const phase of ["json", "bind", "up", "verify"])
  test("LEAD+ recovery restores configuration after interruption at " + phase, async () => {
    const s = fixture();
    s.failure = phase;
    await assert.rejects(executeRelease(s.options, s.io));
    assert.deepEqual(s.state.inProgress.runtimeChange, change);
    const result = await recoverRelease(newId, s.io);
    assert.equal(s.json, "before");
    assert.equal(s.live, a);
    assert.equal(s.state.inProgress, null);
    assert.ok(["aborted", "recovered"].includes(result.status));
  });
test("LEAD+ interrupted recovery resumes without reapplying new credentials", async () => {
  const s = fixture();
  s.failure = "verify";
  await assert.rejects(executeRelease(s.options, s.io));
  s.failure = "up";
  await assert.rejects(recoverRelease(newId, s.io));
  assert.equal(s.state.inProgress.operation, "rollback");
  assert.equal(s.json, "before");
  const result = await recoverRelease(newId, s.io);
  assert.equal(result.status, "recovered");
  assert.equal(s.json, "before");
});
test("LEAD+ same SHA cannot activate configuration and malformed runtime descriptors fail closed", async () => {
  const s = fixture();
  await assert.rejects(
    executeRelease({ ...s.options, targetSha: a, targetImageId: imageA }, s.io),
    /new CI-approved/,
  );
  assert.equal(s.events.length, 0);
  const state = {
    ...s.state,
    inProgress: {
      deploymentId: newId,
      expectedDeploymentId: oldId,
      expectedSha: a,
      targetSha: b,
      targetImageId: imageB,
      startedAt: new Date(now).toISOString(),
      operation: "deploy",
      runtimeChange: { ...change, beforeSha256: "bad" },
    },
  };
  assert.throws(() => validateDeploymentState(state, now));
  assert.doesNotThrow(() => validateDeploymentState(s.state, now));
});
