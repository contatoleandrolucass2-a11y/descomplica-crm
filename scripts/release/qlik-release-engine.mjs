import { isDeepStrictEqual } from "node:util";
import {
  assertApprovedCandidate,
  assertFreshObservation,
  assertLiveDeployment,
} from "./production-release-policy.mjs";

const shaPattern = /^[0-9a-f]{40}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
const imagePattern = /^sha256:[0-9a-f]{64}$/u;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ownerKeys = ["sha", "unitHash", "enabled", "active", "preflight"];
const optionKeys = [
  "operation",
  "expectedDeploymentId",
  "expectedSha",
  "expectedOwnerSha",
  "targetSha",
  "targetImageId",
  "ciRunId",
];
const statuses = ["inspected", "pending", "unavailable", "reauth_required"];
const rankingStatuses = ["running", "succeeded", "reauth_required", "unavailable"];
const clone = (value) => structuredClone(value);
const rankingFields = (value) => (Object.hasOwn(value, "ranking") ? ["ranking"] : []);

function requireValid(condition) {
  if (!condition) throw new Error("Invalid Qlik release state or boundary.");
}

function keys(value, expected) {
  requireValid(value !== null && typeof value === "object" && !Array.isArray(value));
  requireValid([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  requireValid(Reflect.ownKeys(value).length === expected.length);
  requireValid(expected.every((key) => Object.hasOwn(value, key)));
}

function pattern(value, expression) {
  requireValid(typeof value === "string" && expression.test(value));
}

function time(value, now) {
  requireValid(typeof value === "string");
  const parsed = Date.parse(value);
  requireValid(Number.isFinite(parsed) && parsed <= now);
  requireValid(new Date(parsed).toISOString() === value);
  return parsed;
}

function validateOwner(owner) {
  keys(owner, [...ownerKeys, ...rankingFields(owner)]);
  if (Object.hasOwn(owner, "ranking")) requireValid(owner.ranking === true && !owner.preflight);
  pattern(owner.sha, shaPattern);
  pattern(owner.unitHash, hashPattern);
  for (const key of ["enabled", "active", "preflight"])
    requireValid(typeof owner[key] === "boolean");
  return owner;
}

function validateOptions(options) {
  keys(options, [...optionKeys, ...rankingFields(options)]);
  if (Object.hasOwn(options, "ranking")) requireValid(options.ranking === true);
  requireValid(options.operation === "qlik-deploy");
  pattern(options.expectedDeploymentId, idPattern);
  for (const key of ["expectedSha", "expectedOwnerSha", "targetSha"])
    pattern(options[key], shaPattern);
  pattern(options.targetImageId, imagePattern);
  requireValid(Number.isSafeInteger(options.ciRunId) && options.ciRunId > 0);
  return options;
}

function validateBackup(backup, transaction) {
  keys(backup, ["id", "previousSha", "targetSha", "previousUnitHash", "targetUnitHash"]);
  requireValid(backup.id === transaction.deploymentId);
  requireValid(backup.previousSha === transaction.previousOwner.sha);
  requireValid(backup.targetSha === transaction.targetSha);
  requireValid(backup.previousUnitHash === transaction.previousOwner.unitHash);
  pattern(backup.targetUnitHash, hashPattern);
}

function ownerFromReceipt(receipt) {
  return Object.fromEntries(
    [...ownerKeys, ...rankingFields(receipt)].map((key) => [key, receipt[key]]),
  );
}

function validateRankingResult(result) {
  requireValid(rankingStatuses.includes(result.rankingStatus));
  requireValid(typeof result.rankingConnected === "boolean");
  requireValid(result.rankingConnected === (result.rankingStatus === "succeeded"));
}

function validateReceipt(receipt, now) {
  keys(receipt, [
    ...ownerKeys,
    "deploymentId",
    "imageId",
    "ciRunId",
    "deployedAt",
    "preflightStatus",
    ...(receipt.ranking ? ["ranking", "rankingStatus", "rankingConnected"] : []),
  ]);
  validateOwner(ownerFromReceipt(receipt));
  if (receipt.ranking) validateRankingResult(receipt);
  requireValid(receipt.active);
  pattern(receipt.deploymentId, idPattern);
  time(receipt.deployedAt, now);
  if (receipt.imageId !== null) pattern(receipt.imageId, imagePattern);
  requireValid(
    receipt.ciRunId === null || (Number.isSafeInteger(receipt.ciRunId) && receipt.ciRunId > 0),
  );
  requireValid((receipt.imageId === null) === (receipt.ciRunId === null));
  requireValid(
    receipt.preflight
      ? statuses.includes(receipt.preflightStatus)
      : receipt.preflightStatus === "disabled",
  );
}

/** Nullable, separate Qlik ledger. The observed baseline deliberately has no deployment date. */
export function validateQlikState(state, now) {
  requireValid(Number.isFinite(now) && Number.isFinite(new Date(now).getTime()));
  if (state === null) return state;
  keys(state, ["schemaVersion", "baseline", "release", "inProgress"]);
  requireValid([1, 2].includes(state.schemaVersion));
  validateOwner(state.baseline);
  requireValid(state.baseline.active);
  if (state.release !== null) validateReceipt(state.release, now);
  if (state.schemaVersion === 1)
    requireValid(!state.baseline.ranking && !state.release?.ranking && !state.inProgress?.ranking);
  if (state.inProgress !== null) {
    const transaction = state.inProgress;
    keys(transaction, [
      "deploymentId",
      "expectedDeploymentId",
      "expectedSha",
      "targetSha",
      "targetImageId",
      "ciRunId",
      "startedAt",
      "previousOwner",
      "backup",
      "operation",
      "phase",
      ...(transaction.ranking ? ["ranking", "boot"] : []),
    ]);
    validateOwner(transaction.previousOwner);
    if (transaction.ranking) {
      requireValid(state.schemaVersion === 2 && transaction.ranking === true);
      requireValid(
        ["unchanged", "enable-pending", "enabled", "restore-pending", "restored"].includes(
          transaction.boot,
        ),
      );
      requireValid(transaction.phase !== "prepared" || transaction.boot === "unchanged");
      requireValid(
        !["restore-pending", "restored"].includes(transaction.boot) ||
          transaction.phase === "recovering",
      );
    } else requireValid(!transaction.previousOwner.ranking);
    validateOptions({
      operation: transaction.operation,
      expectedDeploymentId: transaction.expectedDeploymentId,
      expectedSha: transaction.expectedSha,
      expectedOwnerSha: transaction.previousOwner.sha,
      targetSha: transaction.targetSha,
      targetImageId: transaction.targetImageId,
      ciRunId: transaction.ciRunId,
    });
    pattern(transaction.deploymentId, idPattern);
    requireValid(transaction.deploymentId !== transaction.expectedDeploymentId);
    requireValid(transaction.deploymentId !== state.release?.deploymentId);
    const startedAt = time(transaction.startedAt, now);
    if (state.release !== null) requireValid(startedAt >= Date.parse(state.release.deployedAt));
    requireValid(["prepared", "profile-backed-up", "recovering"].includes(transaction.phase));
    requireValid(
      isDeepStrictEqual(
        transaction.previousOwner,
        state.release ? ownerFromReceipt(state.release) : state.baseline,
      ),
    );
    validateBackup(transaction.backup, transaction);
  }
  return state;
}

function runtime(io) {
  let lastTime = -Infinity;
  let appState;
  const now = () => {
    const value = io.now();
    requireValid(
      Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) && value >= lastTime,
    );
    lastTime = value;
    return value;
  };
  const read = async () => clone(validateQlikState(await io.readState(), now()));
  const inspect = async () => clone(validateOwner(await io.inspectOwner()));
  const write = async (expected, next) => {
    validateQlikState(next, now());
    await io.writeState(clone(expected), clone(next));
    requireValid(isDeepStrictEqual(await read(), next));
  };
  const gate = async (options, checkCandidate) => {
    now();
    const observation = clone(await io.app.observe());
    assertLiveDeployment(observation, options, now());
    if (appState === undefined) appState = clone(observation.state);
    requireValid(isDeepStrictEqual(observation.state, appState));
    if (checkCandidate) {
      const candidate = await io.app.candidate(options.ciRunId);
      assertApprovedCandidate(candidate, options.targetSha);
      requireValid(candidate.run.id === options.ciRunId);
    }
    const completedAt = now();
    requireValid(completedAt >= observation.checkedAt);
    observation.checkedAt = completedAt;
    assertLiveDeployment(observation, options, now());
    return observation;
  };
  const cas = async (state, observation) => {
    assertFreshObservation(observation, now());
    requireValid(isDeepStrictEqual(await read(), state));
    await write(state, state);
    assertFreshObservation(observation, now());
  };
  return { now, read, inspect, write, gate, cas };
}

// Hosts await the callback, recheck local lock/CAS inputs, then consume its
// synchronous guard exactly once at rename/spawn, with no intervening await.
// Counting cannot undo a host mutation performed in violation of that contract.
async function guardedMutation(invoke, before) {
  let attempts = 0;
  let consumptions = 0;
  let complete = false;
  let open = true;
  try {
    await invoke(async () => {
      attempts += 1;
      requireValid(open && attempts === 1);
      const check = await before();
      requireValid(open && attempts === 1 && typeof check === "function");
      return () => {
        consumptions += 1;
        requireValid(open && attempts === 1 && consumptions === 1);
        requireValid(check() === undefined);
        complete = true;
      };
    });
  } finally {
    open = false;
  }
  requireValid(attempts === 1 && consumptions === 1 && complete);
}

function desiredOwner(transaction, restore = false, active = true) {
  return restore
    ? { ...transaction.previousOwner, active }
    : {
        sha: transaction.targetSha,
        unitHash: transaction.backup.targetUnitHash,
        enabled:
          transaction.ranking && transaction.boot === "enabled"
            ? true
            : transaction.previousOwner.enabled,
        active,
        preflight: !transaction.ranking,
        ...(transaction.ranking ? { ranking: true } : {}),
      };
}

function assertRelatedOwner(owner, transaction) {
  const bootIntermediate =
    transaction.ranking &&
    ["enable-pending", "enabled", "restore-pending"].includes(transaction.boot);
  requireValid(
    isDeepStrictEqual(owner, desiredOwner(transaction, true, owner.active)) ||
      isDeepStrictEqual(owner, desiredOwner(transaction, false, owner.active)) ||
      (bootIntermediate &&
        [true, transaction.previousOwner.enabled].includes(owner.enabled) &&
        [true, false].some((restore) =>
          isDeepStrictEqual(owner, {
            ...desiredOwner(transaction, restore, owner.active),
            enabled: owner.enabled,
          }),
        )),
  );
}

async function verify(io, run, transaction, restore) {
  const result = await io.verifyOwner(clone(transaction), restore);
  const owner = desiredOwner(transaction, restore);
  keys(result, [
    "preflightStatus",
    ...(owner.ranking ? ["rankingStatus", "rankingConnected"] : []),
  ]);
  if (owner.ranking) validateRankingResult(result);
  requireValid(
    owner.preflight
      ? statuses.includes(result.preflightStatus)
      : result.preflightStatus === "disabled",
  );
  requireValid(isDeepStrictEqual(await run.inspect(), owner));
  return { owner, ...result };
}

function receipt(deploymentId, owner, imageId, ciRunId, now, verified) {
  return {
    ...owner,
    deploymentId,
    imageId,
    ciRunId,
    deployedAt: new Date(now).toISOString(),
    preflightStatus: verified.preflightStatus,
    ...(owner.ranking
      ? { rankingStatus: verified.rankingStatus, rankingConnected: verified.rankingConnected }
      : {}),
  };
}

/**
 * Caller holds all three production locks. app exposes ONLY observe/candidate.
 * prepare(options, owner, id) proves the exact immutable SHA/image and writes a
 * private unit backup. quiesce proves no owner process remains; backupProfile
 * durably backs up the stopped profile. Neither may change the unit or CRM.
 * apply/restore(tx, beforeWrite), start(tx, beforeStart, restore=false) await
 * the callback, recheck host lock/CAS, and consume its synchronous freshness
 * guard once at rename/spawn without intervening async work.
 * verifyOwner(tx, restore=false) proves the started owner and a fresh artifact.
 * Ranking requires a successful cycle before the journaled setBoot mutation.
 * Recovery restores recorded unit bytes and boot state, including interrupted enable.
 * No operation here restores a profile archive, writes the CRM ledger or runs Compose.
 */
export async function executeQlikRelease(options, io) {
  let stage = "options";
  try {
    options = clone(validateOptions(options));
    const run = runtime(io);
    stage = "baseline";
    const previous = await run.read();
    requireValid(previous?.inProgress == null);
    const owner = await run.inspect();
    requireValid(owner.active && owner.sha === options.expectedOwnerSha);
    if (previous !== null) {
      requireValid(
        isDeepStrictEqual(
          owner,
          previous.release ? ownerFromReceipt(previous.release) : previous.baseline,
        ),
      );
    }
    stage = "approval";
    await run.gate(options, true);
    if (owner.sha === options.targetSha) {
      requireValid(
        previous?.release !== null &&
          previous?.release !== undefined &&
          (owner.preflight || owner.ranking),
      );
      requireValid(!options.ranking || (owner.ranking && owner.enabled));
      requireValid(previous.release.imageId === options.targetImageId);
      requireValid(isDeepStrictEqual(await run.read(), previous));
      requireValid(isDeepStrictEqual(await run.inspect(), owner));
      return {
        status: "noop",
        release: clone(previous.release),
        preflightStatus: previous.release.preflightStatus,
        ...(owner.ranking
          ? {
              rankingStatus: previous.release.rankingStatus,
              rankingConnected: previous.release.rankingConnected,
            }
          : {}),
      };
    }

    stage = "prepare";
    const deploymentId = io.id();
    pattern(deploymentId, idPattern);
    requireValid(
      deploymentId !== options.expectedDeploymentId &&
        deploymentId !== previous?.release?.deploymentId,
    );
    const ranking = options.ranking === true || owner.ranking === true;
    const backup = clone(
      await io.prepare(
        { ...clone(options), ...(ranking ? { ranking: true } : {}) },
        clone(owner),
        deploymentId,
      ),
    );
    const transaction = {
      deploymentId,
      expectedDeploymentId: options.expectedDeploymentId,
      expectedSha: options.expectedSha,
      targetSha: options.targetSha,
      targetImageId: options.targetImageId,
      ciRunId: options.ciRunId,
      startedAt: new Date(run.now()).toISOString(),
      previousOwner: owner,
      backup,
      operation: "qlik-deploy",
      phase: "prepared",
      ...(ranking ? { ranking: true, boot: "unchanged" } : {}),
    };
    let state = {
      schemaVersion: ranking || previous?.schemaVersion === 2 ? 2 : 1,
      baseline: previous?.baseline ?? owner,
      release: previous?.release ?? null,
      inProgress: transaction,
    };
    validateQlikState(state, run.now());
    stage = "intent";
    const observation = await run.gate(options, true);
    requireValid(isDeepStrictEqual(await run.inspect(), owner));
    assertFreshObservation(observation, run.now());
    await run.write(previous, state);
    await run.cas(state, observation);

    stage = "quiesce";
    await io.quiesce(clone(state.inProgress));
    requireValid(isDeepStrictEqual(await run.inspect(), { ...owner, active: false }));
    stage = "profile-backup";
    await io.backupProfile(clone(state.inProgress));
    requireValid(isDeepStrictEqual(await run.inspect(), { ...owner, active: false }));
    const backedUp = { ...state, inProgress: { ...state.inProgress, phase: "profile-backed-up" } };
    await run.write(state, backedUp);
    state = backedUp;

    stage = "apply";
    await guardedMutation(
      (beforeWrite) => io.apply(clone(state.inProgress), beforeWrite),
      async () => {
        const current = await run.gate(options, true);
        requireValid(isDeepStrictEqual(await run.inspect(), { ...owner, active: false }));
        await run.cas(state, current);
        return () => assertFreshObservation(current, run.now());
      },
    );
    stage = "start";
    await guardedMutation(
      (beforeStart) => io.start(clone(state.inProgress), beforeStart, false),
      async () => {
        const current = await run.gate(options, true);
        requireValid(
          isDeepStrictEqual(await run.inspect(), desiredOwner(state.inProgress, false, false)),
        );
        await run.cas(state, current);
        return () => assertFreshObservation(current, run.now());
      },
    );
    stage = "verify";
    const verified = await verify(io, run, state.inProgress, false);
    if (ranking) {
      requireValid(verified.rankingStatus === "succeeded" && verified.rankingConnected);
      stage = "boot-intent";
      const enabling = { ...state, inProgress: { ...state.inProgress, boot: "enable-pending" } };
      await run.write(state, enabling);
      state = enabling;
      stage = "boot-enable";
      await guardedMutation(
        (beforeBoot) => io.setBoot(clone(state.inProgress), beforeBoot, false),
        async () => {
          const current = await run.gate(options, true);
          requireValid(isDeepStrictEqual(await run.inspect(), desiredOwner(state.inProgress)));
          await run.cas(state, current);
          return () => assertFreshObservation(current, run.now());
        },
      );
      const enabled = { ...state, inProgress: { ...state.inProgress, boot: "enabled" } };
      requireValid(isDeepStrictEqual(await run.inspect(), desiredOwner(enabled.inProgress)));
      await run.write(state, enabled);
      state = enabled;
      verified.owner = desiredOwner(state.inProgress);
    }
    stage = "receipt";
    const finalObservation = await run.gate(options, false);
    requireValid(isDeepStrictEqual(await run.inspect(), verified.owner));
    assertFreshObservation(finalObservation, run.now());
    const release = receipt(
      deploymentId,
      verified.owner,
      options.targetImageId,
      options.ciRunId,
      run.now(),
      verified,
    );
    await run.write(state, { ...state, release, inProgress: null });
    return {
      status: "deployed",
      release,
      preflightStatus: verified.preflightStatus,
      ...(ranking
        ? { rankingStatus: verified.rankingStatus, rankingConnected: verified.rankingConnected }
        : {}),
    };
  } catch {
    throw new Error(`Qlik release blocked or incomplete (${stage}). Private details withheld.`);
  }
}

/** Restore only the exact pending attempt; never auto-restore the profile backup. */
export async function recoverQlikRelease(deploymentId, io) {
  let stage = "recovery-state";
  try {
    pattern(deploymentId, idPattern);
    const run = runtime(io);
    let state = await run.read();
    requireValid(state?.inProgress?.deploymentId === deploymentId);
    const original = state.inProgress;
    // Recovery authority is the durable intent, not a new deployment of old code.
    // A later main/CI must not prevent restoring this attempt's exact backup.
    const observation = await run.gate(original, false);
    assertRelatedOwner(await run.inspect(), original);
    stage = "recovery-intent";
    const recovering = { ...state, inProgress: { ...original, phase: "recovering" } };
    assertFreshObservation(observation, run.now());
    await run.write(state, recovering);
    state = recovering;
    await run.cas(state, observation);
    stage = "recovery-quiesce";
    await io.quiesce(clone(state.inProgress));
    const stopped = await run.inspect();
    assertRelatedOwner(stopped, state.inProgress);
    requireValid(!stopped.active);
    stage = "restore";
    await guardedMutation(
      (beforeWrite) => io.restore(clone(state.inProgress), beforeWrite),
      async () => {
        const current = await run.gate(original, false);
        const currentOwner = await run.inspect();
        assertRelatedOwner(currentOwner, state.inProgress);
        requireValid(!currentOwner.active);
        await run.cas(state, current);
        return () => assertFreshObservation(current, run.now());
      },
    );
    if (original.ranking) {
      stage = "recovery-boot-intent";
      const restoringBoot = {
        ...state,
        inProgress: { ...state.inProgress, boot: "restore-pending" },
      };
      await run.write(state, restoringBoot);
      state = restoringBoot;
      stage = "recovery-boot";
      await guardedMutation(
        (beforeBoot) => io.setBoot(clone(state.inProgress), beforeBoot, true),
        async () => {
          const current = await run.gate(original, false);
          const currentOwner = await run.inspect();
          assertRelatedOwner(currentOwner, state.inProgress);
          requireValid(
            !currentOwner.active && currentOwner.unitHash === original.previousOwner.unitHash,
          );
          await run.cas(state, current);
          return () => assertFreshObservation(current, run.now());
        },
      );
      const restored = { ...state, inProgress: { ...state.inProgress, boot: "restored" } };
      requireValid(
        isDeepStrictEqual(await run.inspect(), desiredOwner(state.inProgress, true, false)),
      );
      await run.write(state, restored);
      state = restored;
    }
    stage = "recovery-start";
    await guardedMutation(
      (beforeStart) => io.start(clone(state.inProgress), beforeStart, true),
      async () => {
        const current = await run.gate(original, false);
        requireValid(
          isDeepStrictEqual(await run.inspect(), desiredOwner(state.inProgress, true, false)),
        );
        await run.cas(state, current);
        return () => assertFreshObservation(current, run.now());
      },
    );
    stage = "recovery-verify";
    const verified = await verify(io, run, state.inProgress, true);
    stage = "recovery-receipt";
    const finalObservation = await run.gate(original, false);
    requireValid(isDeepStrictEqual(await run.inspect(), verified.owner));
    assertFreshObservation(finalObservation, run.now());
    const recoveryId = io.id();
    pattern(recoveryId, idPattern);
    requireValid(
      ![deploymentId, state.release?.deploymentId, original.expectedDeploymentId].includes(
        recoveryId,
      ),
    );
    const release = receipt(
      recoveryId,
      verified.owner,
      state.release?.imageId ?? null,
      state.release?.ciRunId ?? null,
      run.now(),
      verified,
    );
    await run.write(state, { ...state, release, inProgress: null });
    return {
      status: "recovered",
      release,
      preflightStatus: verified.preflightStatus,
      ...(verified.owner.ranking
        ? { rankingStatus: verified.rankingStatus, rankingConnected: verified.rankingConnected }
        : {}),
    };
  } catch {
    throw new Error(`Qlik release blocked or incomplete (${stage}). Private details withheld.`);
  }
}
