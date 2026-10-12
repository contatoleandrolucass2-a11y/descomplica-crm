import { isDeepStrictEqual } from "node:util";
import { assertFreshObservation, validateDeploymentState } from "./production-release-policy.mjs";

// Caller holds the shared host lock. A pending transaction survives crashes;
// recovery can only restore that transaction's exact recorded previous image.
export async function recoverRelease(deploymentId, io) {
  let state = validateDeploymentState(await io.readState(), io.now());
  let pending = state.inProgress;
  const previous = state.release;
  if (
    !pending ||
    pending.deploymentId !== deploymentId ||
    pending.expectedDeploymentId !== previous.deploymentId ||
    pending.expectedSha !== previous.sha
  )
    throw new Error("Recovery requires the exact pending deployment and previous release.");

  // A recovery always runs from the candidate checkout that created this intent.
  // The rollback phase changes neither the candidate nor the recorded previous image.
  const boundarySha = pending.targetSha;
  await io.prepare(
    {
      operation: "rollback",
      expectedSha: boundarySha,
      targetSha: previous.sha,
      targetImageId: previous.imageId,
    },
    previous,
  );
  const observation = await io.recoveryObservation();
  if (!isDeepStrictEqual(observation.state, state))
    throw new Error("Pending deployment changed before recovery.");
  assertFreshObservation(observation, io.now());
  if (![previous.sha, pending.targetSha].includes(observation.environmentSha)) {
    throw new Error("Recovery found an unrelated production environment.");
  }
  if (observation.container) {
    const { containerSha, containerImageId } = observation.container;
    if (
      !(containerSha === previous.sha && containerImageId === previous.imageId) &&
      !(containerSha === pending.targetSha && containerImageId === pending.targetImageId)
    )
      throw new Error("Recovery found an unrelated production container.");
  }
  const previousRunning =
    observation.container?.containerSha === previous.sha &&
    observation.container?.containerImageId === previous.imageId &&
    observation.container?.running === true;
  const abortUnstartedDeployment = previousRunning && pending.operation === "deploy";
  if (!abortUnstartedDeployment) {
    // Persist the recovery phase before changing production. If recovery dies
    // after restoring the previous image, a retry must issue a new receipt rather
    // than mistake that restored image for an unstarted deployment.
    const recoveringState = {
      ...state,
      inProgress: { ...pending, operation: "rollback" },
    };
    validateDeploymentState(recoveringState, io.now());
    await io.writeState(state, recoveringState);
    state = recoveringState;
    pending = recoveringState.inProgress;
    assertFreshObservation(observation, io.now());
  }
  let beforeWriteCompleted = false;
  await io.bind(
    {
      expectedCurrentSha: observation.environmentSha,
      targetSha: previous.sha,
      expectedImageId: previous.imageId,
      boundarySha,
    },
    async () => {
      if (beforeWriteCompleted) throw new Error("Recovery before-write validation must run once.");
      await io.writeState(state, state);
      assertFreshObservation(observation, io.now());
      beforeWriteCompleted = true;
    },
  );
  if (!beforeWriteCompleted) throw new Error("Recovery before-write validation is required.");
  if (abortUnstartedDeployment) {
    await io.verify(previous.sha, previous.imageId);
    await io.writeState(state, { ...state, inProgress: null });
    return { status: "aborted", release: previous };
  }
  if (!previousRunning) {
    let beforeStartCompleted = false;
    await io.up(pending, previous.sha, async () => {
      if (beforeStartCompleted) throw new Error("Recovery before-start validation must run once.");
      await io.writeState(state, state);
      assertFreshObservation(observation, io.now());
      beforeStartCompleted = true;
    });
    if (!beforeStartCompleted) throw new Error("Recovery before-start validation is required.");
  }
  await io.verify(previous.sha, previous.imageId);
  const restoredDeploymentId = io.id();
  const completedAt = io.now();
  if (
    restoredDeploymentId === previous.deploymentId ||
    restoredDeploymentId === pending.deploymentId ||
    completedAt < observation.checkedAt
  ) {
    throw new Error("Recovery requires a new deployment ID and a non-regressing clock.");
  }
  const restored = {
    schemaVersion: 1,
    release: {
      ...previous,
      deploymentId: restoredDeploymentId,
      deployedAt: new Date(completedAt).toISOString(),
      evidence: `Recovery of deployment ${pending.deploymentId}; previous deployment ${previous.deploymentId}`,
    },
    inProgress: null,
  };
  validateDeploymentState(restored, completedAt);
  await io.writeState(state, restored);
  return { status: "recovered", release: restored.release };
}
