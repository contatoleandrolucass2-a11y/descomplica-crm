import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertApprovedCandidate,
  assertFreshObservation,
  assertLiveDeployment,
  decideRelease,
  validateDeploymentState,
} from "./production-release-policy.mjs";

const minute = Date.parse("2026-10-12T12:30:00.000Z");
const now = minute + 30_000;
const currentSha = "a".repeat(40);
const targetSha = "b".repeat(40);
const currentImageId = `sha256:${"1".repeat(64)}`;
const targetImageId = `sha256:${"2".repeat(64)}`;
const currentId = "00000000-0000-4000-8000-000000000001";
const nextId = "00000000-0000-4000-8000-000000000002";
const expected = { expectedDeploymentId: currentId, expectedSha: currentSha };
const jobNames = ["validate", "release-gates", "isolated-restore", "promotable-image"];

function state() {
  return {
    schemaVersion: 1,
    release: {
      deploymentId: currentId,
      sha: currentSha,
      imageId: currentImageId,
      deployedAt: "2026-10-12T11:00:00.000Z",
      evidence: "Verified production release receipt: deployment 123.",
    },
    inProgress: null,
  };
}

function inProgress() {
  return {
    deploymentId: nextId,
    expectedDeploymentId: currentId,
    expectedSha: currentSha,
    targetSha,
    targetImageId,
    startedAt: new Date(minute).toISOString(),
    operation: "deploy",
  };
}

function observation() {
  return {
    state: state(),
    environmentSha: currentSha,
    containerSha: currentSha,
    containerImageId: currentImageId,
    healthSha: currentSha,
    publicHealthSha: currentSha,
    startedAt: minute + 10_000,
    checkedAt: minute + 20_000,
  };
}

function approval() {
  return {
    mainSha: targetSha,
    run: {
      id: 123,
      status: "completed",
      conclusion: "success",
      event: "push",
      head_branch: "main",
      head_sha: targetSha,
    },
    jobs: jobNames.map((name) => ({ name, status: "completed", conclusion: "success" })),
  };
}

test("accepts fresh evidence from the publication minute including zero elapsed time", () => {
  assert.doesNotThrow(() => assertFreshObservation({ startedAt: now, checkedAt: now }, now));
  assert.doesNotThrow(() =>
    assertFreshObservation({ startedAt: minute, checkedAt: minute + 59_999 }, minute + 59_999),
  );
});

test("rejects evidence over 60 seconds old and exact TTL crossing a minute", () => {
  assert.throws(
    () =>
      assertFreshObservation({ startedAt: minute, checkedAt: minute + 20_000 }, minute + 60_001),
    /older than 60 seconds/,
  );
  assert.throws(
    () =>
      assertFreshObservation({ startedAt: minute, checkedAt: minute + 20_000 }, minute + 60_000),
    /publication minute/,
  );
});

test("rejects a minute boundary even when evidence is only one millisecond old", () => {
  assert.throws(
    () =>
      assertFreshObservation(
        { startedAt: minute + 59_999, checkedAt: minute + 59_999 },
        minute + 60_000,
      ),
    /publication minute/,
  );
  assert.throws(
    () => assertFreshObservation({ startedAt: minute - 1, checkedAt: minute }, minute),
    /publication minute/,
  );
});

test("rejects clock regression and observations completed before they started", () => {
  for (const timestamps of [
    { startedAt: now + 1, checkedAt: now + 1 },
    { startedAt: now - 10, checkedAt: now + 1 },
    { startedAt: now - 10, checkedAt: now - 11 },
  ]) {
    assert.throws(() => assertFreshObservation(timestamps, now), /out of order/);
  }
});

test("requires finite numeric observation timestamps and current time", () => {
  for (const invalid of [undefined, null, "0", NaN, Infinity, -Infinity]) {
    assert.throws(() => assertFreshObservation({ startedAt: invalid, checkedAt: now }, now));
    assert.throws(() => assertFreshObservation({ startedAt: now, checkedAt: invalid }, now));
    assert.throws(() => assertFreshObservation({ startedAt: now, checkedAt: now }, invalid));
  }
  assert.throws(() => assertFreshObservation(null, now));
});

test("validates the authoritative ledger without mutating it", () => {
  const ledger = state();
  const before = structuredClone(ledger);
  Object.freeze(ledger.release);
  Object.freeze(ledger);
  assert.equal(validateDeploymentState(ledger, now), ledger);
  assert.deepEqual(ledger, before);
  const deploying = { ...state(), inProgress: inProgress() };
  assert.equal(validateDeploymentState(deploying, now), deploying);
  deploying.inProgress.operation = "rollback";
  assert.equal(validateDeploymentState(deploying, now), deploying);
});

test("fails closed for an absent or corrupt ledger and unsupported schemas or fields", () => {
  for (const invalid of [undefined, null, [], "{}", {}, true, 1]) {
    assert.throws(() => validateDeploymentState(invalid, now));
  }
  for (const key of ["schemaVersion", "release", "inProgress"]) {
    const ledger = state();
    delete ledger[key];
    assert.throws(() => validateDeploymentState(ledger, now), /missing or unsupported/);
  }
  for (const schemaVersion of ["1", 0, 2, null]) {
    assert.throws(() => validateDeploymentState({ ...state(), schemaVersion }, now));
  }
  assert.throws(() => validateDeploymentState({ ...state(), ignored: true }, now));
  assert.throws(() => validateDeploymentState(state(), NaN));
});

test("requires every published release field and rejects invalid identities and evidence", () => {
  for (const key of Object.keys(state().release)) {
    const ledger = state();
    delete ledger.release[key];
    assert.throws(() => validateDeploymentState(ledger, now));
  }
  for (const [key, values] of Object.entries({
    deploymentId: [null, "unknown", "00000000-0000-0000-0000-000000000000"],
    sha: [null, currentSha.toUpperCase(), currentSha.slice(1), `${currentSha}\n`],
    imageId: [null, currentImageId.replace("sha256:", ""), targetSha],
    evidence: [null, "", "  \n", "a".repeat(501), 123],
  })) {
    for (const value of values) {
      const ledger = state();
      ledger.release[key] = value;
      assert.throws(() => validateDeploymentState(ledger, now), `${key} must reject ${value}`);
    }
  }
  const ledger = state();
  ledger.release.evidence = "a".repeat(500);
  assert.doesNotThrow(() => validateDeploymentState(ledger, now));
  ledger.release.extra = true;
  assert.throws(() => validateDeploymentState(ledger, now));
});

test("accepts only canonical actual deployment times at or before the current time", () => {
  const ledger = state();
  ledger.release.deployedAt = new Date(now).toISOString();
  assert.doesNotThrow(() => validateDeploymentState(ledger, now));
  for (const value of [
    undefined,
    null,
    now,
    "invalid",
    "2026-10-12T12:30:00Z",
    "2026-10-12T12:30:00.000+00:00",
    "2026-02-30T12:30:00.000Z",
    new Date(now + 1).toISOString(),
  ]) {
    ledger.release.deployedAt = value;
    assert.throws(() => validateDeploymentState(ledger, now));
  }
});

test("validates all in-progress deployment fields", () => {
  for (const key of Object.keys(inProgress())) {
    const ledger = { ...state(), inProgress: inProgress() };
    delete ledger.inProgress[key];
    assert.throws(() => validateDeploymentState(ledger, now));
  }
  for (const [key, value] of Object.entries({
    deploymentId: "not-a-uuid",
    expectedDeploymentId: "not-a-uuid",
    expectedSha: "main",
    targetSha: targetSha.toUpperCase(),
    targetImageId: "latest",
    startedAt: new Date(now + 1).toISOString(),
    operation: "restart",
  })) {
    const ledger = { ...state(), inProgress: { ...inProgress(), [key]: value } };
    assert.throws(() => validateDeploymentState(ledger, now));
  }
  for (const invalid of [undefined, false, "", [], {}]) {
    assert.throws(() => validateDeploymentState({ ...state(), inProgress: invalid }, now));
  }
  assert.throws(() =>
    validateDeploymentState({ ...state(), inProgress: { ...inProgress(), extra: true } }, now),
  );
});

test("accepts agreement between every live source and the expected deployment", () => {
  assert.doesNotThrow(() => assertLiveDeployment(observation(), expected, now));
});

test("blocks an ABA change even when a later deployment restored the same SHA and image", () => {
  const live = observation();
  live.state.release.deploymentId = nextId;
  assert.throws(() => assertLiveDeployment(live, expected, now), /deployment ID or SHA changed/);
  assert.throws(
    () => assertLiveDeployment(observation(), { ...expected, expectedSha: targetSha }, now),
    /deployment ID or SHA changed/,
  );
});

test("blocks in-progress publication, invalid expectations, absent ledger, and stale live evidence", () => {
  const live = observation();
  live.state.inProgress = inProgress();
  assert.throws(() => assertLiveDeployment(live, expected, now), /already in progress/);
  assert.throws(() => assertLiveDeployment(observation(), { expectedSha: currentSha }, now));
  assert.throws(() => assertLiveDeployment(observation(), null, now));
  assert.throws(() => assertLiveDeployment({ ...observation(), state: null }, expected, now));
  assert.throws(() => assertLiveDeployment(observation(), expected, minute + 60_000));
});

test("blocks any missing, invalid, or divergent live SHA source and container image", () => {
  for (const key of ["environmentSha", "containerSha", "healthSha", "publicHealthSha"]) {
    for (const value of [undefined, null, "main", targetSha]) {
      assert.throws(() => assertLiveDeployment({ ...observation(), [key]: value }, expected, now));
    }
  }
  for (const value of [undefined, null, "latest", targetImageId]) {
    assert.throws(() =>
      assertLiveDeployment({ ...observation(), containerImageId: value }, expected, now),
    );
  }
});

test("returns noop for an already published SHA and image, deploy for a different SHA", () => {
  assert.equal(decideRelease(observation(), currentSha, currentImageId), "noop");
  assert.equal(decideRelease(observation(), targetSha, targetImageId), "deploy");
  assert.equal(decideRelease(observation(), targetSha, currentImageId), "deploy");
  assert.throws(
    () => decideRelease(observation(), currentSha, targetImageId),
    /already published with a different image/,
  );
  assert.throws(() => decideRelease(observation(), "main", targetImageId));
  assert.throws(() => decideRelease(observation(), targetSha, "latest"));
  assert.throws(() => decideRelease({ state: null }, targetSha, targetImageId));
});

test("accepts one successful push run on the exact current main SHA with all four gates", () => {
  assert.doesNotThrow(() => assertApprovedCandidate(approval(), targetSha));
  const candidate = approval();
  candidate.jobs.push({ name: "extra-check", status: "completed", conclusion: "success" });
  assert.doesNotThrow(() => assertApprovedCandidate(candidate, targetSha));
});

test("rejects a changed remote main, pull-request CI, another SHA, and unsuccessful runs", () => {
  assert.throws(() => assertApprovedCandidate({ ...approval(), mainSha: currentSha }, targetSha));
  assert.throws(() => assertApprovedCandidate(approval(), "main"));
  for (const [key, values] of Object.entries({
    id: [undefined, 0, -1, "123", NaN, 1.5, Number.MAX_SAFE_INTEGER + 1],
    status: [undefined, "in_progress", "queued"],
    conclusion: [undefined, null, "failure", "cancelled", "skipped"],
    event: [undefined, "pull_request", "workflow_dispatch", "workflow_run"],
    head_branch: [undefined, "feature"],
    head_sha: [undefined, currentSha],
  })) {
    for (const value of values) {
      const candidate = approval();
      candidate.run[key] = value;
      assert.throws(() => assertApprovedCandidate(candidate, targetSha), `${key}: ${value}`);
    }
  }
});

test("rejects each missing or duplicate gate and malformed jobs", () => {
  for (const name of jobNames) {
    const missing = approval();
    missing.jobs = missing.jobs.filter((job) => job.name !== name);
    assert.throws(() => assertApprovedCandidate(missing, targetSha), /exactly one/);
    const duplicate = approval();
    duplicate.jobs.push({ name, status: "completed", conclusion: "success" });
    assert.throws(() => assertApprovedCandidate(duplicate, targetSha), /exactly one/);
  }
  for (const jobs of [undefined, null, {}, []]) {
    assert.throws(() => assertApprovedCandidate({ ...approval(), jobs }, targetSha));
  }
  for (const invalid of [null, {}, "job"]) {
    const candidate = approval();
    candidate.jobs.push(invalid);
    assert.throws(() => assertApprovedCandidate(candidate, targetSha));
  }
});

test("rejects every failed, skipped, cancelled, or unfinished job including additional jobs", () => {
  for (const status of ["queued", "in_progress", undefined]) {
    const candidate = approval();
    candidate.jobs[0].status = status;
    assert.throws(() => assertApprovedCandidate(candidate, targetSha));
  }
  for (const conclusion of ["failure", "skipped", "cancelled", "neutral", null]) {
    const candidate = approval();
    candidate.jobs.push({ name: "extra-check", status: "completed", conclusion });
    assert.throws(() => assertApprovedCandidate(candidate, targetSha));
  }
  for (const name of [undefined, "", "   ", 123]) {
    const candidate = approval();
    candidate.jobs.push({ name, status: "completed", conclusion: "success" });
    assert.throws(() => assertApprovedCandidate(candidate, targetSha));
  }
});
