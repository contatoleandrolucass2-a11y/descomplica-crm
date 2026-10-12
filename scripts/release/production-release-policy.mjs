const shaPattern = /^[0-9a-f]{40}$/u;
const imageIdPattern = /^sha256:[0-9a-f]{64}$/u;
const deploymentIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const requiredJobs = ["validate", "release-gates", "isolated-restore", "promotable-image"];

function fail(message) {
  throw new Error(message);
}

function assertRecord(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail(`${label} must be an object.`);
  }
}

function assertExactKeys(value, keys, label) {
  assertRecord(value, label);
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    fail(`${label} has missing or unsupported fields.`);
  }
}

function assertStringPattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} is invalid.`);
  }
}

function assertFiniteTime(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite millisecond timestamp.`);
  }
}

function assertCanonicalTime(value, nowMs, label) {
  if (typeof value !== "string") {
    fail(`${label} must be a canonical ISO UTC timestamp.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    fail(`${label} must be a canonical ISO UTC timestamp.`);
  }
  if (timestamp > nowMs) {
    fail(`${label} cannot be in the future.`);
  }
}

export function assertFreshObservation(observation, nowMs) {
  assertRecord(observation, "Production observation");
  const { startedAt, checkedAt } = observation;
  assertFiniteTime(startedAt, "Observation start");
  assertFiniteTime(checkedAt, "Observation completion");
  assertFiniteTime(nowMs, "Current time");
  if (startedAt > checkedAt || checkedAt > nowMs) {
    fail("Production observation timestamps are out of order or the clock moved backwards.");
  }
  if (nowMs - startedAt < 0 || nowMs - startedAt > 60_000) {
    fail("Production observation is older than 60 seconds.");
  }
  const minute = Math.floor(nowMs / 60_000);
  if (Math.floor(startedAt / 60_000) !== minute || Math.floor(checkedAt / 60_000) !== minute) {
    fail("Production observation must be refreshed in the publication minute.");
  }
}

export function validateDeploymentState(state, nowMs) {
  assertFiniteTime(nowMs, "Current time");
  assertExactKeys(state, ["schemaVersion", "release", "inProgress"], "Deployment ledger");
  if (state.schemaVersion !== 1) {
    fail("Deployment ledger schemaVersion must be 1.");
  }
  const { release, inProgress } = state;
  assertExactKeys(
    release,
    ["deploymentId", "sha", "imageId", "deployedAt", "evidence"],
    "Published release",
  );
  assertStringPattern(release.deploymentId, deploymentIdPattern, "Published deployment ID");
  assertStringPattern(release.sha, shaPattern, "Published Git SHA");
  assertStringPattern(release.imageId, imageIdPattern, "Published image ID");
  assertCanonicalTime(release.deployedAt, nowMs, "Actual deployment time");
  if (
    typeof release.evidence !== "string" ||
    release.evidence.trim().length === 0 ||
    release.evidence.length > 500
  ) {
    fail("Deployment evidence must be a nonempty string of at most 500 characters.");
  }
  if (inProgress !== null) {
    assertExactKeys(
      inProgress,
      [
        "deploymentId",
        "expectedDeploymentId",
        "expectedSha",
        "targetSha",
        "targetImageId",
        "startedAt",
        "operation",
      ],
      "In-progress deployment",
    );
    assertStringPattern(inProgress.deploymentId, deploymentIdPattern, "In-progress deployment ID");
    assertStringPattern(
      inProgress.expectedDeploymentId,
      deploymentIdPattern,
      "Expected deployment ID",
    );
    assertStringPattern(inProgress.expectedSha, shaPattern, "Expected Git SHA");
    assertStringPattern(inProgress.targetSha, shaPattern, "Target Git SHA");
    assertStringPattern(inProgress.targetImageId, imageIdPattern, "Target image ID");
    assertCanonicalTime(inProgress.startedAt, nowMs, "Deployment start time");
    if (!["deploy", "rollback"].includes(inProgress.operation)) {
      fail("In-progress operation must be deploy or rollback.");
    }
  }
  return state;
}

export function assertLiveDeployment(observation, expected, nowMs) {
  assertRecord(observation, "Production observation");
  assertRecord(expected, "Expected production state");
  assertStringPattern(expected.expectedDeploymentId, deploymentIdPattern, "Expected deployment ID");
  assertStringPattern(expected.expectedSha, shaPattern, "Expected Git SHA");
  const { state } = observation;
  validateDeploymentState(state, nowMs);
  assertFreshObservation(observation, nowMs);
  if (state.inProgress !== null) {
    fail("A production deployment is already in progress; reconcile before continuing.");
  }
  if (
    state.release.deploymentId !== expected.expectedDeploymentId ||
    state.release.sha !== expected.expectedSha
  ) {
    fail("Production deployment ID or SHA changed; reconcile before continuing.");
  }
  for (const key of ["environmentSha", "containerSha", "healthSha", "publicHealthSha"]) {
    assertStringPattern(observation[key], shaPattern, key);
    if (observation[key] !== state.release.sha) {
      fail(`Production ${key} disagrees with the deployment ledger.`);
    }
  }
  assertStringPattern(observation.containerImageId, imageIdPattern, "Container image ID");
  if (observation.containerImageId !== state.release.imageId) {
    fail("Production container image ID disagrees with the deployment ledger.");
  }
}

export function assertApprovedCandidate(candidate, targetSha) {
  assertRecord(candidate, "Candidate approval");
  assertStringPattern(targetSha, shaPattern, "Target Git SHA");
  const { mainSha, run, jobs } = candidate;
  if (mainSha !== targetSha) {
    fail("The candidate is no longer the exact remote main SHA.");
  }
  assertRecord(run, "Candidate CI run");
  if (
    !Number.isSafeInteger(run.id) ||
    run.id <= 0 ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.event !== "push" ||
    run.head_branch !== "main" ||
    run.head_sha !== targetSha
  ) {
    fail("The candidate requires a successful completed push CI run on the exact main SHA.");
  }
  if (!Array.isArray(jobs)) {
    fail("Candidate CI jobs are unavailable.");
  }
  const jobCounts = new Map();
  for (const job of jobs) {
    assertRecord(job, "Candidate CI job");
    if (
      typeof job.name !== "string" ||
      job.name.trim().length === 0 ||
      job.status !== "completed" ||
      job.conclusion !== "success"
    ) {
      fail("Every candidate CI job must be named, completed, and successful.");
    }
    jobCounts.set(job.name, (jobCounts.get(job.name) ?? 0) + 1);
  }
  for (const name of requiredJobs) {
    if (jobCounts.get(name) !== 1) {
      fail(`Candidate CI must include exactly one successful ${name} job.`);
    }
  }
}

// The caller must pass the live-state gate while holding the shared production lock first.
export function decideRelease(observation, targetSha, targetImageId) {
  assertRecord(observation, "Production observation");
  assertRecord(observation.state, "Deployment ledger");
  assertRecord(observation.state.release, "Published release");
  const { release } = observation.state;
  assertStringPattern(release.sha, shaPattern, "Published Git SHA");
  assertStringPattern(release.imageId, imageIdPattern, "Published image ID");
  assertStringPattern(targetSha, shaPattern, "Target Git SHA");
  assertStringPattern(targetImageId, imageIdPattern, "Target image ID");
  if (release.sha !== targetSha) {
    return "deploy";
  }
  if (release.imageId !== targetImageId) {
    fail("The candidate SHA is already published with a different image ID; reconcile first.");
  }
  return "noop";
}
