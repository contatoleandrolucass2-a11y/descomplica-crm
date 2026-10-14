import { isDeepStrictEqual } from "node:util";

import {
  assertApprovedCandidate,
  assertFreshObservation,
  assertLiveDeployment,
  decideRelease,
  validateDeploymentState,
} from "./production-release-policy.mjs";

function fail(message) {
  throw new Error(message);
}

function captureObservation(observation) {
  if (observation === null || typeof observation !== "object" || Array.isArray(observation)) {
    fail("Production observation is unavailable.");
  }
  return { ...observation, state: structuredClone(observation.state) };
}

function assertSameState(actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail("The production deployment ledger changed; reconcile before continuing.");
  }
}

async function checkCandidate(io, ciRunId, targetSha) {
  if (!Number.isSafeInteger(ciRunId) || ciRunId <= 0) {
    fail("Deployment requires a positive, safe integer CI run ID.");
  }
  const candidate = await io.candidate(ciRunId);
  assertApprovedCandidate(candidate, targetSha);
  if (candidate.run.id !== ciRunId) {
    fail("The approved candidate does not match the requested CI run ID.");
  }
}

/**
 * Executes a release under a shared production lock already held by the caller.
 * Any failure after the intent is persisted leaves it in place for explicit recovery.
 * This function never acquires or releases the caller's lock and never rolls back implicitly.
 */
export async function executeRelease(options, io) {
  if (options === null || typeof options !== "object" || options.operation !== "deploy") {
    fail("Only a CI-approved deploy is allowed; recover restores an exact pending release.");
  }
  if (options.salesforceIngestion !== undefined && options.salesforceIngestion !== true)
    fail("Salesforce ingestion requires an explicit enable request.");
  const releaseOptions = {
    operation: options.operation,
    expectedDeploymentId: options.expectedDeploymentId,
    expectedSha: options.expectedSha,
    targetSha: options.targetSha,
    targetImageId: options.targetImageId,
    ciRunId: options.ciRunId,
    ...(options.salesforceIngestion ? { salesforceIngestion: true } : {}),
  };
  const { operation, expectedDeploymentId, expectedSha, targetSha, targetImageId, ciRunId } =
    releaseOptions;
  const expected = { expectedDeploymentId, expectedSha };
  const initial = captureObservation(await io.observe());
  assertLiveDeployment(initial, expected, io.now());
  if (decideRelease(initial, targetSha, targetImageId) === "noop") {
    if (options.salesforceIngestion)
      fail("Configuration changes require a new CI-approved release SHA.");
    return { status: "noop", release: initial.state.release };
  }

  await checkCandidate(io, ciRunId, targetSha);
  await io.prepare(releaseOptions, structuredClone(initial.state.release));

  // The observation's original start includes all source reads and the final CI lookup.
  const finalObservation = captureObservation(await io.observe());
  assertLiveDeployment(finalObservation, expected, io.now());
  assertSameState(finalObservation.state, initial.state);
  await checkCandidate(io, ciRunId, targetSha);
  const completedObservationAt = io.now();
  if (completedObservationAt < finalObservation.checkedAt) {
    fail("The clock moved backwards during the final CI lookup.");
  }
  finalObservation.checkedAt = completedObservationAt;
  assertLiveDeployment(finalObservation, expected, io.now());

  const previousState = finalObservation.state;
  const deploymentId = io.id();
  if (deploymentId === previousState.release.deploymentId) {
    fail("A new release must have a new deployment ID.");
  }
  const environmentChange = options.salesforceIngestion
    ? await io.prepareEnvironmentChange(releaseOptions, deploymentId)
    : undefined;
  const startedAt = io.now();
  assertFreshObservation(finalObservation, startedAt);
  const transaction = {
    deploymentId,
    expectedDeploymentId,
    expectedSha,
    targetSha,
    targetImageId,
    startedAt: new Date(startedAt).toISOString(),
    operation,
    ...(environmentChange ? { environmentChange } : {}),
  };
  if (options.salesforceIngestion && !environmentChange)
    fail("A durable environment backup is required before deployment intent.");
  const intentState = {
    schemaVersion: 1,
    release: structuredClone(previousState.release),
    inProgress: transaction,
  };
  validateDeploymentState(intentState, startedAt);
  await io.writeState(structuredClone(previousState), structuredClone(intentState));

  let beforeWriteAttempted = false;
  let beforeWriteCompleted = false;
  await io.bind(
    {
      expectedCurrentSha: expectedSha,
      targetSha,
      expectedImageId: targetImageId,
      boundarySha: targetSha,
      ...(environmentChange ? { environmentChange } : {}),
    },
    async () => {
      if (beforeWriteAttempted) {
        fail("Production image binding must validate exactly once immediately before writing.");
      }
      beforeWriteAttempted = true;
      assertFreshObservation(finalObservation, io.now());
      const current = await io.readState();
      validateDeploymentState(current, io.now());
      assertSameState(current, intentState);
      // The adapter performs a durable compare-and-swap without rewriting identical state.
      await io.writeState(structuredClone(intentState), structuredClone(intentState));
      assertFreshObservation(finalObservation, io.now());
      beforeWriteCompleted = true;
    },
  );
  if (!beforeWriteCompleted) {
    fail("Production image binding did not complete its mandatory before-write validation.");
  }
  assertFreshObservation(finalObservation, io.now());
  let beforeStartAttempted = false;
  let beforeStartCompleted = false;
  await io.up(structuredClone(transaction), targetSha, async () => {
    if (beforeStartAttempted) {
      fail("Production promotion must validate exactly once immediately before starting.");
    }
    beforeStartAttempted = true;
    assertFreshObservation(finalObservation, io.now());
    await io.writeState(structuredClone(intentState), structuredClone(intentState));
    assertFreshObservation(finalObservation, io.now());
    beforeStartCompleted = true;
  });
  if (!beforeStartCompleted) {
    fail("Production promotion did not complete its mandatory before-start validation.");
  }
  await io.verify(
    targetSha,
    targetImageId,
    environmentChange ? { change: environmentChange, restore: false } : undefined,
  );

  const completedAt = io.now();
  if (completedAt < startedAt) fail("The clock moved backwards during publication.");
  if (typeof completedAt !== "number" || !Number.isFinite(completedAt) || completedAt < startedAt) {
    fail("The clock moved backwards or became invalid before the deployment receipt was recorded.");
  }
  const release = {
    deploymentId,
    sha: targetSha,
    imageId: targetImageId,
    deployedAt: new Date(completedAt).toISOString(),
    evidence: `ci-run:${ciRunId}; previous-deployment:${expectedDeploymentId}`,
  };
  const completedState = { schemaVersion: 1, release, inProgress: null };
  validateDeploymentState(completedState, completedAt);
  await io.writeState(structuredClone(intentState), structuredClone(completedState));
  return { status: "deployed", release };
}
