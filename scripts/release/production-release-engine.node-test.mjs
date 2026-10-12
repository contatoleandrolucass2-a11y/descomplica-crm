import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";

import { executeRelease } from "./production-release-engine.mjs";

const minute = Date.parse("2026-10-12T12:30:00.000Z");
const currentSha = "a".repeat(40);
const targetSha = "b".repeat(40);
const currentImageId = `sha256:${"1".repeat(64)}`;
const targetImageId = `sha256:${"2".repeat(64)}`;
const currentId = "00000000-0000-4000-8000-000000000001";
const nextId = "00000000-0000-4000-8000-000000000002";
const concurrentId = "00000000-0000-4000-8000-000000000003";

function initialState() {
  return {
    schemaVersion: 1,
    release: {
      deploymentId: currentId,
      sha: currentSha,
      imageId: currentImageId,
      deployedAt: "2026-10-12T11:00:00.000Z",
      evidence: "Verified deployment receipt for the currently published image.",
    },
    inProgress: null,
  };
}

function options(overrides = {}) {
  return {
    operation: "deploy",
    expectedDeploymentId: currentId,
    expectedSha: currentSha,
    targetSha,
    targetImageId,
    ciRunId: 123,
    ...overrides,
  };
}

function approvedCandidate() {
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
    jobs: ["validate", "release-gates", "isolated-restore", "promotable-image"].map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
    })),
  };
}

function harness() {
  const system = {
    clock: minute + 10_000,
    state: initialState(),
    liveSha: currentSha,
    liveImageId: currentImageId,
    environmentSha: currentSha,
    events: [],
    observeCount: 0,
    candidateCount: 0,
    writeCount: 0,
    writes: [],
    hooks: {},
  };
  system.io = {
    now: () => system.clock,
    id: () => nextId,
    observe: async () => {
      system.events.push("observe");
      system.observeCount += 1;
      const startedAt = system.clock;
      await system.hooks.observe?.(system.observeCount);
      return {
        state: structuredClone(system.state),
        environmentSha: system.environmentSha,
        containerSha: system.liveSha,
        containerImageId: system.liveImageId,
        healthSha: system.liveSha,
        publicHealthSha: system.liveSha,
        startedAt,
        checkedAt: system.clock,
      };
    },
    candidate: async (ciRunId) => {
      system.events.push("candidate");
      system.candidateCount += 1;
      assert.equal(ciRunId, 123);
      return (await system.hooks.candidate?.(system.candidateCount)) ?? approvedCandidate();
    },
    prepare: async (releaseOptions, previousRelease) => {
      system.events.push("prepare");
      assert.equal(releaseOptions.expectedSha, currentSha);
      assert.deepEqual(previousRelease, initialState().release);
      await system.hooks.prepare?.(releaseOptions, previousRelease);
    },
    writeState: async (expected, next) => {
      system.writeCount += 1;
      const kind = isDeepStrictEqual(expected, next)
        ? "cas"
        : next.inProgress === null
          ? "complete"
          : "intent";
      system.events.push(kind);
      system.writes.push({
        expected: structuredClone(expected),
        next: structuredClone(next),
        kind,
      });
      await system.hooks.write?.(kind, expected, next);
      if (!isDeepStrictEqual(system.state, expected)) {
        throw new Error("CAS rejected changed ledger.");
      }
      if (kind !== "cas") {
        system.state = structuredClone(next);
      }
    },
    bind: async (binding, beforeWrite) => {
      system.events.push("bind");
      assert.equal(binding.expectedCurrentSha, currentSha);
      assert.equal(binding.targetSha, targetSha);
      assert.equal(binding.expectedImageId, targetImageId);
      await system.hooks.bind?.(binding, beforeWrite);
      await beforeWrite();
      system.events.push("environment-write");
      system.environmentSha = binding.targetSha;
      await system.hooks.afterBind?.();
    },
    up: async (transaction, sha, beforeStart) => {
      system.events.push("up");
      assert.deepEqual(transaction, system.state.inProgress);
      assert.equal(sha, transaction.targetSha);
      await system.hooks.up?.(transaction, beforeStart);
      await beforeStart();
      system.events.push("container-start");
      system.liveSha = transaction.targetSha;
      system.liveImageId = transaction.targetImageId;
    },
    verify: async (sha, imageId) => {
      system.events.push("verify");
      assert.equal(sha, system.liveSha);
      assert.equal(imageId, system.liveImageId);
      await system.hooks.verify?.();
    },
    readState: async () => {
      system.events.push("read-state");
      await system.hooks.readState?.();
      return structuredClone(system.state);
    },
  };
  return system;
}

function assertIntentRetained(system) {
  assert.deepEqual(system.state.release, initialState().release);
  assert.equal(system.state.inProgress.deploymentId, nextId);
  assert.equal(system.state.inProgress.expectedDeploymentId, currentId);
  assert.equal(system.state.inProgress.expectedSha, currentSha);
  assert.equal(system.state.inProgress.targetSha, targetSha);
  assert.equal(system.state.inProgress.targetImageId, targetImageId);
}

test("final CI lookup cannot hide clock regression within the observation interval", async () => {
  const system = harness();
  system.hooks.observe = (count) => {
    if (count === 2) system.clock += 2000;
  };
  system.hooks.candidate = (count) => {
    if (count === 2) system.clock -= 1000;
  };
  await assert.rejects(executeRelease(options(), system.io), /clock moved backwards/u);
  assert.equal(system.writeCount, 0);
});

test("a backwards clock after promotion leaves the pending receipt for recovery", async () => {
  const system = harness();
  system.hooks.verify = () => {
    system.clock -= 1000;
  };
  await assert.rejects(executeRelease(options(), system.io), /clock moved backwards/u);
  assertIntentRetained(system);
});

test("deploys only after both observations, both CI checks, intent, and before-write CAS", async () => {
  const system = harness();
  system.hooks.verify = () => {
    system.clock += 5_000;
  };
  const result = await executeRelease(options(), system.io);
  assert.deepEqual(system.events, [
    "observe",
    "candidate",
    "prepare",
    "observe",
    "candidate",
    "intent",
    "bind",
    "read-state",
    "cas",
    "environment-write",
    "up",
    "cas",
    "container-start",
    "verify",
    "complete",
  ]);
  assert.equal(result.status, "deployed");
  assert.deepEqual(result.release, system.state.release);
  assert.equal(result.release.deploymentId, nextId);
  assert.equal(result.release.sha, targetSha);
  assert.equal(result.release.imageId, targetImageId);
  assert.equal(result.release.deployedAt, new Date(system.clock).toISOString());
  assert.match(result.release.evidence, /ci-run:123/);
  assert.equal(system.state.inProgress, null);
  assert.deepEqual(system.writes[1].expected, system.writes[1].next);
});

test("returns noop without CI, preparation, state writes, image binding, or promotion", async () => {
  const system = harness();
  const result = await executeRelease(
    options({ targetSha: currentSha, targetImageId: currentImageId, ciRunId: undefined }),
    system.io,
  );
  assert.deepEqual(result, { status: "noop", release: initialState().release });
  assert.deepEqual(system.events, ["observe"]);
  assert.deepEqual(system.state, initialState());
});

test("rejects the same published SHA with another image before any mutation", async () => {
  const system = harness();
  await assert.rejects(
    executeRelease(options({ targetSha: currentSha }), system.io),
    /already published with a different image/,
  );
  assert.deepEqual(system.events, ["observe"]);
});

test("generic rollback cannot bypass candidate CI", async () => {
  const system = harness();
  await assert.rejects(
    executeRelease(options({ operation: "rollback", ciRunId: undefined }), system.io),
    /CI-approved deploy/u,
  );
  assert.equal(system.events.length, 0);
});

test("deploy binds using the target checkout boundary", async () => {
  const system = harness();
  system.hooks.bind = (binding) => assert.equal(binding.boundarySha, targetSha);
  await executeRelease(options(), system.io);
});

test("rejects a failed first CI gate or an unexpected run before preparation", async () => {
  for (const mutate of [
    (candidate) => (candidate.run.conclusion = "failure"),
    (candidate) => (candidate.run.id = 456),
    (candidate) => (candidate.mainSha = currentSha),
  ]) {
    const system = harness();
    system.hooks.candidate = () => {
      const candidate = approvedCandidate();
      mutate(candidate);
      return candidate;
    };
    await assert.rejects(executeRelease(options(), system.io));
    assert.deepEqual(system.events, ["observe", "candidate"]);
  }
});

test("queries candidate again after preparation and blocks a changed approval", async () => {
  for (const mutate of [
    (candidate) => (candidate.mainSha = currentSha),
    (candidate) => (candidate.run.id = 456),
    (candidate) => (candidate.run.conclusion = "failure"),
    (candidate) => candidate.jobs.pop(),
  ]) {
    const system = harness();
    system.hooks.candidate = (count) => {
      const candidate = approvedCandidate();
      if (count === 2) mutate(candidate);
      return candidate;
    };
    await assert.rejects(executeRelease(options(), system.io));
    assert.equal(system.candidateCount, 2);
    assert.equal(system.writeCount, 0);
    assert.deepEqual(system.state, initialState());
  }
});

test("includes final CI query duration in the observation and blocks an expired minute", async () => {
  const system = harness();
  system.hooks.candidate = (count) => {
    if (count === 2) system.clock = minute + 60_000;
  };
  await assert.rejects(executeRelease(options(), system.io), /publication minute/);
  assert.equal(system.writeCount, 0);
  assert.equal(system.candidateCount, 2);
});

test("refreshes evidence after lengthy preparation and accepts fresh final CI", async () => {
  const system = harness();
  system.hooks.prepare = () => {
    system.clock += 180_000;
  };
  system.hooks.candidate = (count) => {
    if (count === 2) system.clock += 1_000;
  };
  const result = await executeRelease(options(), system.io);
  assert.equal(result.status, "deployed");
  assert.equal(system.observeCount, 2);
});

test("rejects a concurrent release including ABA to the same SHA during preparation", async () => {
  for (const sha of [currentSha, targetSha]) {
    const system = harness();
    system.hooks.prepare = () => {
      system.state.release.deploymentId = concurrentId;
      system.state.release.sha = sha;
      system.liveSha = sha;
      system.environmentSha = sha;
    };
    await assert.rejects(executeRelease(options(), system.io), /deployment ID or SHA changed/);
    assert.equal(system.writeCount, 0);
    assert.equal(system.events.includes("bind"), false);
  }
});

test("compares the whole initial and final ledger even when identity and SHA remain equal", async () => {
  const system = harness();
  system.hooks.prepare = () => {
    system.state.release.evidence = "Altered receipt without a new deployment identity.";
  };
  await assert.rejects(executeRelease(options(), system.io), /ledger changed/);
  assert.equal(system.writeCount, 0);
});

test("blocks divergent final live sources before persisting any intent", async () => {
  const system = harness();
  system.hooks.prepare = () => {
    system.liveSha = targetSha;
  };
  await assert.rejects(
    executeRelease(options(), system.io),
    /disagrees with the deployment ledger/,
  );
  assert.equal(system.writeCount, 0);
});

test("blocks stale or invalid initial evidence before CI", async () => {
  const system = harness();
  system.hooks.observe = () => {
    system.clock += 60_001;
  };
  await assert.rejects(executeRelease(options(), system.io), /older than 60 seconds/);
  assert.deepEqual(system.events, ["observe"]);
});

test("blocks an expired minute or TTL during binding before environment write", async () => {
  for (const clock of [minute + 60_000, minute + 70_001]) {
    const system = harness();
    system.hooks.bind = () => {
      system.clock = clock;
    };
    await assert.rejects(
      executeRelease(options(), system.io),
      /publication minute|older than 60 seconds/,
    );
    assertIntentRetained(system);
    assert.equal(system.events.includes("environment-write"), false);
    assert.equal(system.events.includes("up"), false);
  }
});

test("checks freshness after the before-write CAS and blocks a minute crossed during it", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "cas") system.clock = minute + 60_000;
  };
  await assert.rejects(executeRelease(options(), system.io), /publication minute/);
  assertIntentRetained(system);
  assert.equal(system.events.includes("environment-write"), false);
});

test("blocks if the exact intent changes before environment write", async () => {
  const system = harness();
  system.hooks.bind = () => {
    system.state.inProgress.deploymentId = concurrentId;
  };
  await assert.rejects(executeRelease(options(), system.io), /ledger changed/);
  assert.equal(system.state.inProgress.deploymentId, concurrentId);
  assert.equal(system.events.includes("environment-write"), false);
});

test("before-write CAS rejects a ledger changed after readState", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "cas") system.state.inProgress.deploymentId = concurrentId;
  };
  await assert.rejects(executeRelease(options(), system.io), /CAS rejected/);
  assert.equal(system.events.includes("environment-write"), false);
  assert.equal(system.state.inProgress.deploymentId, concurrentId);
});

test("retains intent and blocks promotion if the minute expires after environment write", async () => {
  const system = harness();
  system.hooks.afterBind = () => {
    system.clock = minute + 60_000;
  };
  await assert.rejects(executeRelease(options(), system.io), /publication minute/);
  assertIntentRetained(system);
  assert.equal(system.environmentSha, targetSha);
  assert.equal(system.events.includes("up"), false);
});

test("blocks actual container start when promotion preparation crosses the publication minute", async () => {
  const system = harness();
  system.hooks.up = () => {
    system.clock = minute + 60_000;
  };
  await assert.rejects(executeRelease(options(), system.io), /publication minute/);
  assertIntentRetained(system);
  assert.equal(system.environmentSha, targetSha);
  assert.equal(system.events.includes("container-start"), false);
  assert.equal(system.events.includes("verify"), false);
});

test("rechecks freshness after the final before-start CAS", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "cas" && system.events.includes("up")) system.clock = minute + 60_000;
  };
  await assert.rejects(executeRelease(options(), system.io), /publication minute/);
  assertIntentRetained(system);
  assert.equal(system.events.includes("container-start"), false);
});

test("blocks actual container start if its intent changes after binding", async () => {
  const system = harness();
  system.hooks.up = () => {
    system.state.inProgress.deploymentId = concurrentId;
  };
  await assert.rejects(executeRelease(options(), system.io), /CAS rejected/);
  assert.equal(system.events.includes("container-start"), false);
  assert.equal(system.state.inProgress.deploymentId, concurrentId);
});

test("requires exactly one successful before-start validation from the promotion adapter", async () => {
  const missing = harness();
  missing.io.up = async () => undefined;
  await assert.rejects(executeRelease(options(), missing.io), /mandatory before-start validation/);
  assertIntentRetained(missing);
  assert.equal(missing.events.includes("verify"), false);
  const repeated = harness();
  repeated.hooks.up = async (_transaction, beforeStart) => beforeStart();
  await assert.rejects(executeRelease(options(), repeated.io), /exactly once/);
  assertIntentRetained(repeated);
  assert.equal(repeated.events.includes("container-start"), false);
});

test("does not promote when a binding adapter omits or repeats before-write validation", async () => {
  const missing = harness();
  missing.io.bind = async () => undefined;
  await assert.rejects(executeRelease(options(), missing.io), /mandatory before-write validation/);
  assertIntentRetained(missing);
  assert.equal(missing.events.includes("up"), false);
  const repeated = harness();
  repeated.hooks.bind = async (_binding, beforeWrite) => beforeWrite();
  await assert.rejects(executeRelease(options(), repeated.io), /exactly once/);
  assertIntentRetained(repeated);
  assert.equal(repeated.events.includes("environment-write"), false);
});

test("a failed intent write cannot trigger binding or promotion", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "intent") throw new Error("Intent persistence failed.");
  };
  await assert.rejects(executeRelease(options(), system.io), /Intent persistence failed/);
  assert.deepEqual(system.state, initialState());
  assert.equal(system.events.includes("bind"), false);
});

test("an ambiguous intent acknowledgement never clears an intent already persisted", async () => {
  const system = harness();
  const writeState = system.io.writeState;
  system.io.writeState = async (expected, next) => {
    await writeState(expected, next);
    if (expected.inProgress === null && next.inProgress !== null) {
      throw new Error("Intent persisted but its acknowledgement was lost.");
    }
  };
  await assert.rejects(executeRelease(options(), system.io), /acknowledgement was lost/);
  assertIntentRetained(system);
  assert.equal(system.events.includes("bind"), false);
});

test("a failed before-write CAS retains intent and cannot write the environment", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "cas") throw new Error("Before-write persistence check failed.");
  };
  await assert.rejects(
    executeRelease(options(), system.io),
    /Before-write persistence check failed/,
  );
  assertIntentRetained(system);
  assert.equal(system.events.includes("environment-write"), false);
});

test("bind, up, and health failures retain durable intent without automatic rollback", async () => {
  for (const phase of ["bind", "up", "verify"]) {
    const system = harness();
    system.hooks[phase] = () => {
      throw new Error(`Failure at ${phase}.`);
    };
    await assert.rejects(
      executeRelease(options(), system.io),
      new RegExp(`Failure at ${phase}`, "u"),
    );
    assertIntentRetained(system);
    assert.equal(system.events.includes("complete"), false);
    assert.equal(system.events.filter((event) => event === "bind").length, 1);
    assert.equal(system.events.filter((event) => event === "up").length, phase === "bind" ? 0 : 1);
  }
});

test("a failed final receipt retains intent even after healthy promotion", async () => {
  const system = harness();
  system.hooks.write = (kind) => {
    if (kind === "complete") throw new Error("Final receipt persistence failed.");
  };
  await assert.rejects(executeRelease(options(), system.io), /Final receipt persistence failed/);
  assertIntentRetained(system);
  assert.equal(system.liveSha, targetSha);
  assert.equal(system.environmentSha, targetSha);
  assert.equal(system.events.filter((event) => event === "up").length, 1);
});

test("a retained intent blocks subsequent deployment until explicit recovery", async () => {
  const system = harness();
  system.hooks.bind = () => {
    throw new Error("Interrupted after durable intent.");
  };
  await assert.rejects(executeRelease(options(), system.io), /Interrupted after durable intent/);
  const writes = system.writeCount;
  system.events = [];
  await assert.rejects(executeRelease(options(), system.io), /already in progress/);
  assert.deepEqual(system.events, ["observe"]);
  assert.equal(system.writeCount, writes);
  assertIntentRetained(system);
});

test("rejects invalid options and reuse of the previous deployment identity", async () => {
  for (const invalid of [undefined, null, {}, { operation: "restart" }]) {
    const system = harness();
    await assert.rejects(executeRelease(invalid, system.io), /CI-approved deploy/);
    assert.deepEqual(system.events, []);
  }
  for (const ciRunId of [undefined, "123", 0, -1, 1.5]) {
    const system = harness();
    await assert.rejects(executeRelease(options({ ciRunId }), system.io), /CI run ID/);
    assert.deepEqual(system.events, ["observe"]);
  }
  for (const id of [currentId, "not-a-uuid"]) {
    const system = harness();
    system.io.id = () => id;
    await assert.rejects(executeRelease(options(), system.io), /deployment ID/);
    assert.equal(system.writeCount, 0);
  }
});

test("the completion CAS cannot overwrite a concurrently altered intent", async () => {
  const system = harness();
  system.hooks.verify = () => {
    system.state.inProgress.deploymentId = concurrentId;
  };
  await assert.rejects(executeRelease(options(), system.io), /CAS rejected/);
  assert.equal(system.state.inProgress.deploymentId, concurrentId);
  assert.deepEqual(system.state.release, initialState().release);
});

test("clock regression after promotion leaves the intent for explicit recovery", async () => {
  const system = harness();
  system.hooks.verify = () => {
    system.clock -= 1;
  };
  await assert.rejects(executeRelease(options(), system.io), /clock moved backwards/);
  assertIntentRetained(system);
  assert.equal(system.events.includes("complete"), false);
});
