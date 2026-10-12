import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";

import { recoverRelease } from "./production-release-recovery.mjs";

const minute = Date.parse("2026-10-12T12:30:00.000Z");
const previousSha = "a".repeat(40);
const targetSha = "b".repeat(40);
const previousImageId = `sha256:${"1".repeat(64)}`;
const targetImageId = `sha256:${"2".repeat(64)}`;
const previousId = "00000000-0000-4000-8000-000000000001";
const pendingId = "00000000-0000-4000-8000-000000000002";
const recoveryId = "00000000-0000-4000-8000-000000000003";
const unrelatedId = "00000000-0000-4000-8000-000000000004";

function pendingState() {
  return {
    schemaVersion: 1,
    release: {
      deploymentId: previousId,
      sha: previousSha,
      imageId: previousImageId,
      deployedAt: "2026-10-12T11:00:00.000Z",
      evidence: "Verified receipt for the previous production release.",
    },
    inProgress: {
      deploymentId: pendingId,
      expectedDeploymentId: previousId,
      expectedSha: previousSha,
      targetSha,
      targetImageId,
      startedAt: "2026-10-12T12:00:00.000Z",
      operation: "deploy",
    },
  };
}

function harness({ environment = "target", container = "target", healthyPrevious = true } = {}) {
  const previousContainer = {
    containerSha: previousSha,
    containerImageId: previousImageId,
    running: true,
  };
  const targetContainer = {
    containerSha: targetSha,
    containerImageId: targetImageId,
    running: true,
  };
  const healthy = container === "previous" && healthyPrevious;
  const system = {
    clock: minute + 10_000,
    state: pendingState(),
    environmentSha: environment === "previous" ? previousSha : targetSha,
    container:
      container === "missing"
        ? null
        : container === "previous"
          ? previousContainer
          : targetContainer,
    healthSha: healthy ? previousSha : null,
    publicHealthSha: healthy ? previousSha : null,
    events: [],
    writes: [],
    idCalls: 0,
    hooks: {},
  };
  system.io = {
    now: () => system.clock,
    id: () => {
      system.idCalls += 1;
      return recoveryId;
    },
    readState: async () => {
      system.events.push("read-state");
      await system.hooks.readState?.();
      return structuredClone(system.state);
    },
    prepare: async (options, previousRelease) => {
      system.events.push("prepare");
      assert.equal(options.operation, "rollback");
      assert.equal(options.targetSha, previousSha);
      assert.equal(options.targetImageId, previousImageId);
      assert.deepEqual(previousRelease, pendingState().release);
      await system.hooks.prepare?.(options);
    },
    recoveryObservation: async () => {
      system.events.push("observe");
      const startedAt = system.clock;
      await system.hooks.observe?.();
      return {
        state: structuredClone(system.state),
        environmentSha: system.environmentSha,
        container: structuredClone(system.container),
        healthSha: system.healthSha,
        publicHealthSha: system.publicHealthSha,
        startedAt,
        checkedAt: system.clock,
      };
    },
    bind: async (options, beforeWrite) => {
      system.events.push("bind");
      assert.equal(options.expectedCurrentSha, system.environmentSha);
      assert.equal(options.targetSha, previousSha);
      assert.equal(options.expectedImageId, previousImageId);
      await system.hooks.bind?.(options, beforeWrite);
      await beforeWrite();
      system.events.push("environment-write");
      system.environmentSha = previousSha;
    },
    up: async (transaction, sha, beforeStart) => {
      system.events.push("up");
      assert.deepEqual(transaction, system.state.inProgress);
      assert.equal(sha, previousSha);
      await system.hooks.up?.(transaction, beforeStart);
      await beforeStart();
      system.events.push("container-start");
      system.container = structuredClone(previousContainer);
      system.healthSha = previousSha;
      system.publicHealthSha = previousSha;
    },
    verify: async (sha, imageId) => {
      system.events.push("verify");
      assert.equal(sha, previousSha);
      assert.equal(imageId, previousImageId);
      await system.hooks.verify?.();
      assert.equal(system.environmentSha, previousSha);
      assert.deepEqual(system.container, previousContainer);
      assert.equal(system.healthSha, previousSha);
      assert.equal(system.publicHealthSha, previousSha);
    },
    writeState: async (expected, next) => {
      const kind = isDeepStrictEqual(expected, next) ? "cas" : "complete";
      system.events.push(kind);
      await system.hooks.write?.(kind, expected, next);
      if (!isDeepStrictEqual(system.state, expected)) throw new Error("Recovery CAS rejected.");
      system.writes.push({
        expected: structuredClone(expected),
        next: structuredClone(next),
        kind,
      });
      if (kind !== "cas") system.state = structuredClone(next);
    },
  };
  return system;
}

function assertPending(system) {
  assert.deepEqual(system.state, pendingState());
}

test("recovers every previous/target environment with a previous/target/missing container", async () => {
  for (const environment of ["previous", "target"]) {
    for (const container of ["previous", "target", "missing"]) {
      const system = harness({ environment, container });
      system.hooks.verify = () => {
        system.clock += 1_234;
      };
      const result = await recoverRelease(pendingId, system.io);
      assert.equal(system.state.inProgress, null);
      assert.equal(system.environmentSha, previousSha);
      assert.equal(system.state.release.sha, previousSha);
      assert.equal(system.state.release.imageId, previousImageId);
      assert.deepEqual(result.release, system.state.release);
      assert.equal(system.events.indexOf("cas") < system.events.indexOf("environment-write"), true);
      assert.equal(system.events.indexOf("verify") < system.events.indexOf("complete"), true);
      if (container === "previous") {
        assert.equal(result.status, "aborted");
        assert.deepEqual(result.release, pendingState().release);
        assert.equal(system.events.includes("up"), false);
        assert.equal(system.idCalls, 0);
      } else {
        assert.equal(result.status, "recovered");
        assert.equal(result.release.deploymentId, recoveryId);
        assert.equal(result.release.deployedAt, new Date(system.clock).toISOString());
        assert.match(result.release.evidence, new RegExp(pendingId, "u"));
        assert.equal(system.events.includes("container-start"), true);
        assert.equal(system.idCalls, 1);
      }
    }
  }
});

test("a transient HTTP failure does not republish the previous running container", async () => {
  for (const source of ["healthSha", "publicHealthSha"]) {
    const system = harness({ environment: "previous", container: "previous" });
    system[source] = null;
    system.hooks.verify = () => {
      system[source] = previousSha;
    };
    const result = await recoverRelease(pendingId, system.io);
    assert.equal(result.status, "aborted");
    assert.deepEqual(result.release, pendingState().release);
    assert.equal(system.events.includes("container-start"), false);
    assert.equal(system.idCalls, 0);
  }
});

test("a stopped previous container is started and receives a new deployment receipt", async () => {
  const system = harness({ environment: "previous", container: "previous" });
  system.container.running = false;
  const result = await recoverRelease(pendingId, system.io);
  assert.equal(result.status, "recovered");
  assert.equal(result.release.deploymentId, recoveryId);
  assert.equal(system.events.includes("container-start"), true);
});

test("recovery uses only the exact recorded previous image and the pending checkout boundary", async () => {
  for (const operation of ["deploy", "rollback"]) {
    const system = harness();
    system.state.inProgress.operation = operation;
    const boundarySha = operation === "deploy" ? targetSha : previousSha;
    system.hooks.prepare = (options) => assert.equal(options.expectedSha, boundarySha);
    system.hooks.bind = (options) => assert.equal(options.boundarySha, boundarySha);
    await recoverRelease(pendingId, system.io);
  }
});

test("an incorrect pending ID, absent transaction, or invalid previous identity blocks all changes", async () => {
  const wrongId = harness();
  await assert.rejects(recoverRelease(unrelatedId, wrongId.io));
  assert.deepEqual(wrongId.events, ["read-state"]);
  for (const mutate of [
    (state) => (state.inProgress = null),
    (state) => (state.inProgress.expectedDeploymentId = unrelatedId),
    (state) => (state.inProgress.expectedSha = "c".repeat(40)),
    (state) => (state.schemaVersion = 2),
  ]) {
    const system = harness();
    mutate(system.state);
    await assert.rejects(recoverRelease(pendingId, system.io));
    assert.deepEqual(system.events, ["read-state"]);
    assert.equal(system.writes.length, 0);
  }
});

test("a changed ledger during preparation cannot be recovered using the old intent", async () => {
  const system = harness();
  system.hooks.prepare = () => {
    system.state.inProgress.deploymentId = unrelatedId;
  };
  await assert.rejects(recoverRelease(pendingId, system.io), /changed/);
  assert.equal(system.events.includes("bind"), false);
  assert.equal(system.writes.length, 0);
});

test("unrelated environment or container identity blocks recovery before mutation", async () => {
  const systems = [harness(), harness(), harness(), harness()];
  systems[0].environmentSha = "c".repeat(40);
  systems[1].container.containerSha = "c".repeat(40);
  systems[2].container.containerImageId = `sha256:${"3".repeat(64)}`;
  systems[3].container = { containerSha: previousSha, containerImageId: targetImageId };
  for (const system of systems) {
    await assert.rejects(recoverRelease(pendingId, system.io), /unrelated/);
    assert.equal(system.events.includes("bind"), false);
    assert.equal(system.writes.length, 0);
    assertPending(system);
  }
});

test("stale observations and minute changes before writing keep the pending transaction", async () => {
  for (const phase of ["observe", "bind"]) {
    const system = harness();
    system.hooks[phase] = () => {
      system.clock = minute + 60_000;
    };
    await assert.rejects(recoverRelease(pendingId, system.io), /publication minute/);
    assertPending(system);
    assert.equal(system.events.includes("environment-write"), false);
    assert.equal(system.events.includes("container-start"), false);
  }
});

test("before-write CAS failure or elapsed minute prevents environment modification", async () => {
  for (const outcome of ["failure", "minute-change"]) {
    const system = harness();
    system.hooks.write = (kind) => {
      if (kind !== "cas") return;
      if (outcome === "failure") throw new Error("Recovery persistence check failed.");
      system.clock = minute + 60_000;
    };
    await assert.rejects(recoverRelease(pendingId, system.io));
    assertPending(system);
    assert.equal(system.events.includes("environment-write"), false);
  }
});

test("the before-start check blocks elapsed time and concurrent ledger changes after binding", async () => {
  for (const outcome of ["minute-change", "changed-state"]) {
    const system = harness();
    system.hooks.up = () => {
      if (outcome === "minute-change") system.clock = minute + 60_000;
      else system.state.inProgress.deploymentId = unrelatedId;
    };
    await assert.rejects(recoverRelease(pendingId, system.io));
    assert.equal(system.events.includes("container-start"), false);
    assert.notEqual(system.state.inProgress, null);
    assert.equal(system.environmentSha, previousSha);
  }
});

test("the before-start CAS must itself complete in the publication minute", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "cas" && system.events.includes("up")) system.clock = minute + 60_000;
  };
  await assert.rejects(recoverRelease(pendingId, system.io), /publication minute/);
  assertPending(system);
  assert.equal(system.events.includes("container-start"), false);
});

test("health, image-start, and final receipt failures retain the durable pending transaction", async () => {
  for (const phase of ["up", "verify", "complete"]) {
    const system = harness();
    if (phase === "complete") {
      system.hooks.write = (kind) => {
        if (kind === "complete") throw new Error("Recovery receipt failed.");
      };
    } else {
      system.hooks[phase] = () => {
        throw new Error(`Recovery ${phase} failed.`);
      };
    }
    await assert.rejects(recoverRelease(pendingId, system.io));
    assertPending(system);
    assert.equal(system.events.filter((event) => event === "up").length, 1);
  }
});

test("aborting an unstarted release still requires health verification before clearing intent", async () => {
  const system = harness({ container: "previous" });
  system.hooks.verify = () => {
    throw new Error("Previous release health changed after observation.");
  };
  await assert.rejects(recoverRelease(pendingId, system.io), /health changed/);
  assertPending(system);
  assert.equal(system.events.includes("up"), false);
});

test("recovery cannot reuse deployment identity or record a regressed deployment time", async () => {
  for (const identity of [previousId, pendingId, "invalid-uuid"]) {
    const system = harness();
    system.io.id = () => identity;
    await assert.rejects(recoverRelease(pendingId, system.io));
    assertPending(system);
  }
  const regressed = harness();
  regressed.hooks.verify = () => {
    regressed.clock -= 1;
  };
  await assert.rejects(recoverRelease(pendingId, regressed.io), /clock|time/i);
  assertPending(regressed);
});

test("binding and starting adapters must execute their mandatory validation callbacks", async () => {
  const missingBind = harness();
  missingBind.io.bind = async () => {
    missingBind.environmentSha = previousSha;
  };
  await assert.rejects(recoverRelease(pendingId, missingBind.io));
  assertPending(missingBind);
  const missingUp = harness();
  missingUp.io.up = async () => {
    missingUp.container = {
      containerSha: previousSha,
      containerImageId: previousImageId,
      running: true,
    };
    missingUp.healthSha = previousSha;
    missingUp.publicHealthSha = previousSha;
  };
  await assert.rejects(recoverRelease(pendingId, missingUp.io));
  assertPending(missingUp);
});

test("the final recovery receipt cannot overwrite an intent changed after health verification", async () => {
  const system = harness();
  system.hooks.verify = () => {
    system.state.inProgress.deploymentId = unrelatedId;
  };
  await assert.rejects(recoverRelease(pendingId, system.io), /CAS rejected/);
  assert.equal(system.state.inProgress.deploymentId, unrelatedId);
  assert.deepEqual(system.state.release, pendingState().release);
});
