import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  executeQlikRelease,
  recoverQlikRelease,
  validateQlikState,
} from "./qlik-release-engine.mjs";

const minute = Date.parse("2026-10-14T12:30:00.000Z");
const crmSha = "a".repeat(40);
const ownerSha = "b".repeat(40);
const targetSha = "c".repeat(40);
const previousHash = "1".repeat(64);
const targetHash = "2".repeat(64);
const crmImage = `sha256:${"3".repeat(64)}`;
const targetImage = `sha256:${"4".repeat(64)}`;
const crmId = "00000000-0000-4000-8000-000000000001";
const deployId = "00000000-0000-4000-8000-000000000002";
const recoveryId = "00000000-0000-4000-8000-000000000003";
const oldId = "00000000-0000-4000-8000-000000000004";
const clone = (value) => structuredClone(value);

function options(overrides = {}) {
  return {
    operation: "qlik-deploy",
    expectedDeploymentId: crmId,
    expectedSha: crmSha,
    expectedOwnerSha: ownerSha,
    targetSha,
    targetImageId: targetImage,
    ciRunId: 123,
    ...overrides,
  };
}

function owner(overrides = {}) {
  return {
    sha: ownerSha,
    unitHash: previousHash,
    enabled: false,
    active: true,
    preflight: false,
    ...overrides,
  };
}

function appState() {
  return {
    schemaVersion: 1,
    release: {
      deploymentId: crmId,
      sha: crmSha,
      imageId: crmImage,
      deployedAt: "2026-10-14T10:00:00.000Z",
      evidence: "Verified CRM publication.",
    },
    inProgress: null,
  };
}

function candidate(sha = targetSha) {
  return {
    mainSha: sha,
    run: {
      id: 123,
      status: "completed",
      conclusion: "success",
      event: "push",
      head_branch: "main",
      head_sha: sha,
    },
    jobs: ["validate", "release-gates", "isolated-restore", "promotable-image"].map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
    })),
  };
}

function ledger(snapshot = owner(), overrides = {}) {
  return {
    schemaVersion: 1,
    baseline: clone(snapshot),
    release: {
      ...snapshot,
      deploymentId: oldId,
      imageId: crmImage,
      ciRunId: 100,
      deployedAt: "2026-10-14T11:00:00.000Z",
      preflightStatus: snapshot.preflight ? "pending" : "disabled",
      ...overrides,
    },
    inProgress: null,
  };
}

function harness() {
  const s = {
    clock: minute + 10_000,
    state: null,
    owner: owner(),
    crm: appState(),
    candidate: candidate(),
    hooks: {},
    events: [],
    writes: [],
    ids: [deployId, recoveryId],
    gates: 0,
    ciChecks: 0,
    status: "pending",
    rankingStatus: "succeeded",
    profileBackup: false,
    imageProven: false,
  };
  const event = async (name, ...args) => {
    s.events.push(name);
    return s.hooks[name]?.(...args);
  };
  const pending = (tx) => assert.deepEqual(tx, s.state.inProgress);
  s.io = {
    now: () => s.clock,
    id: () => s.ids.shift(),
    app: Object.freeze({
      async observe() {
        s.gates += 1;
        const startedAt = s.clock;
        await event("observe", s.gates);
        return {
          state: clone(s.crm),
          environmentSha: s.crm.release.sha,
          containerSha: s.crm.release.sha,
          healthSha: s.crm.release.sha,
          publicHealthSha: s.crm.release.sha,
          containerImageId: s.crm.release.imageId,
          startedAt,
          checkedAt: s.clock,
        };
      },
      async candidate(id) {
        assert.equal(id, 123);
        s.ciChecks += 1;
        await event("candidate", s.ciChecks);
        return clone(s.candidate);
      },
    }),
    async readState() {
      await event("read");
      return clone(s.state);
    },
    async writeState(expected, next) {
      const kind = isDeepStrictEqual(expected, next)
        ? "cas"
        : next.inProgress === null
          ? "receipt"
          : next.inProgress.boot &&
              next.inProgress.boot !== expected?.inProgress?.boot &&
              next.inProgress.boot !== "unchanged"
            ? `boot-${next.inProgress.boot}`
            : next.inProgress.phase === "recovering"
              ? "recovery-intent"
              : next.inProgress.phase === "profile-backed-up"
                ? "backed-up"
                : "intent";
      await event(kind, expected, next);
      assert.deepEqual(s.state, expected, "Qlik ledger CAS mismatch");
      s.state = clone(next);
      s.writes.push({ kind, expected: clone(expected), next: clone(next) });
      await event(`after-${kind}`);
    },
    async inspectOwner() {
      await event("inspect");
      return clone(s.owner);
    },
    async prepare(opts, previousOwner, id) {
      assert.deepEqual(previousOwner, s.owner);
      assert.equal(opts.targetImageId, targetImage);
      assert.equal(opts.targetSha, targetSha);
      s.imageProven = true;
      const backup = {
        id,
        previousSha: previousOwner.sha,
        targetSha: opts.targetSha,
        previousUnitHash: previousOwner.unitHash,
        targetUnitHash: targetHash,
      };
      await event("prepare", opts, previousOwner, backup);
      return backup;
    },
    async quiesce(tx) {
      pending(tx);
      await event("quiesce", tx);
      s.owner.active = false;
      await event("after-quiesce", tx);
    },
    async backupProfile(tx) {
      pending(tx);
      assert.equal(s.owner.active, false);
      await event("backup-profile", tx);
      s.profileBackup = true;
      await event("after-backup-profile", tx);
    },
    async apply(tx, beforeWrite) {
      pending(tx);
      assert.ok(s.profileBackup && s.imageProven);
      assert.equal(tx.phase, "profile-backed-up");
      await event("apply", tx);
      const check = await beforeWrite();
      await event("apply-recheck", tx);
      pending(tx);
      check();
      s.events.push("apply-write");
      s.owner = owner({
        sha: tx.targetSha,
        unitHash: tx.backup.targetUnitHash,
        enabled: tx.previousOwner.enabled,
        active: false,
        preflight: !tx.ranking,
        ...(tx.ranking ? { ranking: true } : {}),
      });
      await event("after-apply", tx);
    },
    async start(tx, beforeStart, restore) {
      pending(tx);
      assert.equal(s.owner.active, false);
      await event(restore ? "recovery-start" : "start", tx);
      const check = await beforeStart();
      await event("start-recheck", tx, restore);
      pending(tx);
      check();
      s.events.push("start-write");
      s.owner.active = true;
      await event("after-start", tx, restore);
    },
    async verifyOwner(tx, restore) {
      pending(tx);
      await event("verify", tx, restore);
      assert.equal(s.owner.active, true);
      return {
        preflightStatus: s.owner.preflight ? s.status : "disabled",
        ...(s.owner.ranking
          ? { rankingStatus: s.rankingStatus, rankingConnected: s.rankingStatus === "succeeded" }
          : {}),
      };
    },
    async restore(tx, beforeWrite) {
      pending(tx);
      assert.equal(tx.phase, "recovering");
      assert.equal(s.owner.active, false);
      await event("restore", tx);
      const check = await beforeWrite();
      await event("restore-recheck", tx);
      pending(tx);
      check();
      s.events.push("restore-write");
      s.owner = {
        ...clone(tx.previousOwner),
        active: false,
        ...(tx.ranking ? { enabled: s.owner.enabled } : {}),
      };
      await event("after-restore");
    },
    async setBoot(tx, beforeBoot, restore) {
      pending(tx);
      assert.equal(tx.boot, restore ? "restore-pending" : "enable-pending");
      const name = restore ? "restore-boot" : "enable-boot";
      await event(name, tx);
      const check = await beforeBoot();
      await event(`${name}-recheck`, tx);
      pending(tx);
      check();
      s.events.push(`${name}-write`);
      s.owner.enabled = restore ? tx.previousOwner.enabled : true;
      await event(`after-${name}`, tx);
    },
  };
  return s;
}

async function failedAttempt(at = "verify") {
  const s = harness();
  s.hooks[at] = () => {
    throw new Error("private host failure");
  };
  await assert.rejects(executeQlikRelease(options(), s.io), /Private details withheld/);
  delete s.hooks[at];
  assert.equal(s.state.inProgress.deploymentId, deployId);
  return s;
}

function noPublication(s) {
  assert.ok(!s.events.includes("apply-write"));
  assert.ok(!s.events.includes("start-write"));
}

test("ranking activation upgrades v1 only at durable intent and enables boot after a successful cycle", async () => {
  const s = harness();
  s.state = ledger();
  const prior = clone(s.state);
  s.hooks.prepare = (opts) => {
    assert.equal(opts.ranking, true);
    assert.deepEqual(s.state, prior);
  };
  const result = await executeQlikRelease(options({ ranking: true }), s.io);
  assert.equal(s.state.schemaVersion, 2);
  assert.deepEqual(s.state.baseline, prior.baseline);
  assert.equal(result.release.ranking, true);
  assert.equal(result.release.enabled, true);
  assert.equal(result.release.preflight, false);
  assert.equal(result.preflightStatus, "disabled");
  assert.equal(result.rankingStatus, "succeeded");
  assert.equal(result.rankingConnected, true);
  assert.ok(s.events.indexOf("verify") < s.events.indexOf("boot-enable-pending"));
  assert.ok(s.events.indexOf("boot-enable-pending") < s.events.indexOf("enable-boot-write"));
  assert.ok(s.events.indexOf("enable-boot-write") < s.events.indexOf("receipt"));
  assert.equal(s.state.inProgress, null);
  validateQlikState(s.state, s.clock);
});

test("an eight-minute ranking cycle gets a new CRM/CI observation before enabling boot", async (t) => {
  for (const change of ["none", "crm", "ci"])
    await t.test(change, async () => {
      const s = harness();
      let gatesBeforeCycle;
      let checksBeforeCycle;
      s.hooks.verify = () => {
        gatesBeforeCycle = s.gates;
        checksBeforeCycle = s.ciChecks;
        s.clock += 8 * 60_000;
        if (change === "crm") s.crm.release.deploymentId = oldId;
        if (change === "ci") s.candidate.run.conclusion = "failure";
      };
      s.hooks["enable-boot-recheck"] = () => {
        assert.ok(s.gates > gatesBeforeCycle);
        assert.ok(s.ciChecks > checksBeforeCycle);
      };
      if (change === "none") {
        const result = await executeQlikRelease(options({ ranking: true }), s.io);
        assert.equal(result.release.enabled, true);
        assert.equal(result.release.deployedAt, new Date(s.clock).toISOString());
      } else {
        await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
        assert.ok(!s.events.includes("enable-boot-write"));
        assert.equal(s.state.inProgress.boot, "enable-pending");
      }
    });
});

test("ranking failure, reauthentication and running cannot authorize boot or a receipt", async (t) => {
  for (const status of ["running", "reauth_required", "unavailable", "invented"]) {
    await t.test(status, async () => {
      const s = harness();
      s.rankingStatus = status;
      await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
      assert.equal(s.state.inProgress.boot, "unchanged");
      assert.equal(s.state.release, null);
      assert.equal(s.owner.enabled, false);
      assert.ok(!s.events.includes("enable-boot-write"));
    });
  }
});

test("ranking result must be exact and cannot claim connected without succeeded", async (t) => {
  for (const result of [
    { preflightStatus: "disabled", rankingStatus: "succeeded", rankingConnected: false },
    { preflightStatus: "disabled", rankingStatus: "unavailable", rankingConnected: true },
    {
      preflightStatus: "disabled",
      rankingStatus: "succeeded",
      rankingConnected: true,
      secret: "forbidden",
    },
    { preflightStatus: "inspected", rankingStatus: "succeeded", rankingConnected: true },
  ])
    await t.test(JSON.stringify(result), async () => {
      const s = harness();
      s.io.verifyOwner = async () => result;
      await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
      assert.ok(!s.events.includes("enable-boot-write"));
    });
});

test("ranking noop preserves recorded connection fields without another cycle or write", async () => {
  const s = harness();
  const deployed = await executeQlikRelease(options({ ranking: true }), s.io);
  const writes = s.writes.length;
  const cycles = s.events.filter((event) => event === "verify").length;
  s.rankingStatus = "unavailable";
  const result = await executeQlikRelease(
    options({ ranking: true, expectedOwnerSha: targetSha }),
    s.io,
  );
  assert.equal(result.status, "noop");
  assert.deepEqual(result.release, deployed.release);
  assert.equal(result.rankingStatus, "succeeded");
  assert.equal(result.rankingConnected, true);
  assert.equal(s.writes.length, writes);
  assert.equal(s.events.filter((event) => event === "verify").length, cycles);
});

test("final CRM observation cannot hide owner drift before deploy or recovery receipt", async (t) => {
  for (const ranking of [false, true])
    for (const restore of [false, true])
      for (const field of ["active", "unitHash", "enabled"])
        await t.test(
          `${ranking ? "v2" : "v1"}-${restore ? "recover" : "deploy"}-${field}`,
          async () => {
            const s = harness();
            s.state = ledger();
            const previous = clone(s.state.release);
            const opts = options(ranking ? { ranking: true } : {});
            if (restore) {
              s.hooks.verify = () => {
                throw new Error("Synthetic interruption");
              };
              await assert.rejects(executeQlikRelease(opts, s.io));
              delete s.hooks.verify;
            }
            let verified = false;
            let drifted = false;
            s.hooks.verify = () => {
              verified = true;
            };
            s.hooks.observe = () => {
              if (verified && (restore || !ranking || s.state.inProgress.boot === "enabled")) {
                drifted = true;
                if (field === "unitHash") s.owner.unitHash = "f".repeat(64);
                else s.owner[field] = !s.owner[field];
              }
            };
            await assert.rejects(
              restore ? recoverQlikRelease(deployId, s.io) : executeQlikRelease(opts, s.io),
              restore ? /\(recovery-receipt\)/ : /\(receipt\)/,
            );
            assert.equal(drifted, true);
            assert.equal(s.state.inProgress.deploymentId, deployId);
            assert.deepEqual(s.state.release, previous);
            assert.ok(!s.events.includes("receipt"));
          },
        );
});

test("same SHA cannot silently enable ranking; future deploys preserve the enabled mode", async () => {
  const old = harness();
  old.owner = owner({ preflight: true });
  old.state = ledger(old.owner);
  old.candidate = candidate(ownerSha);
  await assert.rejects(
    executeQlikRelease(
      options({ targetSha: ownerSha, targetImageId: crmImage, ranking: true }),
      old.io,
    ),
  );
  assert.ok(!old.events.includes("prepare"));
  const s = harness();
  s.owner = owner({ ranking: true, enabled: true });
  s.state = {
    ...ledger(s.owner, { rankingStatus: "succeeded", rankingConnected: true }),
    schemaVersion: 2,
  };
  s.hooks.prepare = (opts) => assert.equal(opts.ranking, true);
  const result = await executeQlikRelease(options(), s.io);
  assert.equal(result.release.ranking, true);
  assert.equal(result.release.enabled, true);
});

test("ranking recovery handles every boot interruption and restores exact previous enabled/mode", async (t) => {
  for (const enabled of [false, true])
    for (const at of [
      "after-apply",
      "verify",
      "after-boot-enable-pending",
      "enable-boot",
      "after-enable-boot",
      "boot-enabled",
      "after-boot-enabled",
      "receipt",
    ])
      await t.test(`${enabled}-${at}`, async () => {
        const s = harness();
        s.owner.enabled = enabled;
        const previous = clone(s.owner);
        s.hooks[at] = () => {
          throw new Error("Synthetic interrupted release");
        };
        await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
        delete s.hooks[at];
        const result = await recoverQlikRelease(deployId, s.io);
        assert.equal(result.status, "recovered");
        assert.deepEqual(s.owner, previous);
        assert.equal(s.state.inProgress, null);
        assert.equal(result.release.enabled, enabled);
        assert.equal(result.release.ranking, undefined);
        assert.ok(s.events.indexOf("restore-write") < s.events.indexOf("restore-boot-write"));
        assert.ok(s.events.indexOf("restore-boot-write") < s.events.indexOf("recovery-start"));
      });
});

test("ranking recovery retries after restoring unit or boot, including a previous ranking owner", async (t) => {
  for (const at of [
    "after-restore",
    "after-boot-restore-pending",
    "restore-boot",
    "after-restore-boot",
    "after-boot-restored",
    "recovery-start",
  ]) {
    await t.test(at, async () => {
      const s = harness();
      s.owner = owner({ ranking: true, enabled: true });
      s.state = {
        ...ledger(s.owner, { rankingStatus: "succeeded", rankingConnected: true }),
        schemaVersion: 2,
      };
      const prior = clone(s.owner);
      s.hooks["after-enable-boot"] = () => {
        throw new Error("Interrupted enable");
      };
      await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
      delete s.hooks["after-enable-boot"];
      s.hooks[at] = () => {
        throw new Error("Interrupted recovery");
      };
      await assert.rejects(recoverQlikRelease(deployId, s.io));
      delete s.hooks[at];
      s.rankingStatus = "reauth_required";
      const result = await recoverQlikRelease(deployId, s.io);
      assert.deepEqual(s.owner, prior);
      assert.equal(result.rankingConnected, false);
      assert.equal(result.rankingStatus, "reauth_required");
    });
  }
});

test("boot callbacks recheck freshness, CRM, ledger and owner, including recovery", async (t) => {
  for (const restore of [false, true])
    for (const change of ["clock", "regression", "crm", "ledger", "unit", "active"]) {
      await t.test(`${restore}-${change}`, async () => {
        const s = harness();
        if (restore) {
          s.hooks["after-enable-boot"] = () => {
            throw new Error("Interrupted enable");
          };
          await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
          delete s.hooks["after-enable-boot"];
        }
        const name = restore ? "restore-boot" : "enable-boot";
        s.hooks[change === "clock" || change === "regression" ? `${name}-recheck` : name] = () => {
          if (change === "clock") s.clock += 60001;
          if (change === "regression") s.clock--;
          if (change === "crm") s.crm.release.deploymentId = oldId;
          if (change === "ledger") s.state.inProgress.startedAt = new Date(minute).toISOString();
          if (change === "unit") s.owner.unitHash = "f".repeat(64);
          if (change === "active") s.owner.active = restore;
        };
        await assert.rejects(
          restore
            ? recoverQlikRelease(deployId, s.io)
            : executeQlikRelease(options({ ranking: true }), s.io),
        );
        assert.ok(!s.events.includes(`${name}-write`));
        assert.ok(s.state.inProgress);
      });
    }
});

test("boot mutation must consume its synchronous guard exactly once", async (t) => {
  for (const restore of [false, true])
    for (const behavior of ["omit", "twice", "late", "swallow"]) {
      await t.test(`${restore}-${behavior}`, async () => {
        const s = harness();
        if (restore) {
          s.hooks["after-enable-boot"] = () => {
            throw new Error("Interrupted enable");
          };
          await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
          delete s.hooks["after-enable-boot"];
        }
        let late;
        s.io.setBoot = async (_tx, callback) => {
          if (behavior === "omit") return;
          const guard = await callback();
          if (behavior === "late") {
            late = guard;
            return;
          }
          if (behavior === "swallow") s.clock += 60001;
          try {
            guard();
            if (behavior === "twice") guard();
          } catch {
            /* Broken host double. */
          }
        };
        await assert.rejects(
          restore
            ? recoverQlikRelease(deployId, s.io)
            : executeQlikRelease(options({ ranking: true }), s.io),
        );
        if (late) assert.throws(late);
        assert.ok(s.state.inProgress);
      });
    }
});

test("v2 ledger and ranking options stay strict; unjournaled boot drift is not recovery authority", async (t) => {
  for (const value of [false, "enable", null, 1]) {
    const s = harness();
    await assert.rejects(executeQlikRelease(options({ ranking: value }), s.io));
    assert.deepEqual(s.events, []);
  }
  const s = harness();
  s.hooks.verify = () => {
    throw new Error("Before boot intent");
  };
  await assert.rejects(executeQlikRelease(options({ ranking: true }), s.io));
  for (const mutate of [
    (v) => {
      v.schemaVersion = 1;
    },
    (v) => {
      v.inProgress.ranking = false;
    },
    (v) => {
      v.inProgress.boot = "arbitrary";
    },
    (v) => {
      v.inProgress.boot = "restored";
    },
    (v) => {
      v.inProgress.phase = "prepared";
      v.inProgress.boot = "enable-pending";
    },
    (v) => {
      v.inProgress.previousOwner.ranking = true;
      v.inProgress.previousOwner.preflight = true;
    },
  ]) {
    const changed = clone(s.state);
    mutate(changed);
    assert.throws(() => validateQlikState(changed, s.clock));
  }
  await t.test("no enable intent", async () => {
    s.owner.enabled = true;
    await assert.rejects(recoverQlikRelease(deployId, s.io));
    assert.ok(!s.events.includes("restore-write"));
  });
});

test("first adoption records an observed baseline, durable intent before stop and a verified receipt", async () => {
  const s = harness();
  s.hooks.verify = () => {
    s.clock += 5000;
  };
  const result = await executeQlikRelease(options(), s.io);
  assert.equal(result.status, "deployed");
  assert.equal(result.preflightStatus, "pending");
  assert.deepEqual(s.state.baseline, owner());
  assert.equal(Object.hasOwn(s.state.baseline, "deployedAt"), false);
  assert.equal(s.writes.find((w) => w.kind === "intent").next.release, null);
  assert.equal(result.release.deployedAt, new Date(s.clock).toISOString());
  assert.equal(result.release.imageId, targetImage);
  assert.equal(result.release.deploymentId, deployId);
  assert.equal(s.state.inProgress, null);
  assert.deepEqual(s.crm, appState());
  assert.equal(s.gates, 5);
  assert.equal(s.ciChecks, 4);
  for (const [before, after] of [
    ["prepare", "intent"],
    ["intent", "quiesce"],
    ["quiesce", "backup-profile"],
    ["backed-up", "apply-write"],
    ["apply-write", "start-write"],
    ["verify", "receipt"],
  ]) {
    assert.ok(s.events.indexOf(before) < s.events.indexOf(after), `${before} before ${after}`);
  }
  validateQlikState(s.state, s.clock);
});

test("metadata failure states do not misrepresent or block successful owner promotion", async (t) => {
  for (const status of ["inspected", "pending", "unavailable", "reauth_required"])
    await t.test(status, async () => {
      const s = harness();
      s.status = status;
      const result = await executeQlikRelease(options(), s.io);
      assert.equal(result.preflightStatus, status);
      assert.equal(result.release.preflightStatus, status);
      assert.equal(Object.hasOwn(result, "rankingConnected"), false);
    });
});

test("same SHA with no verified receipt or disabled preflight fails without preparation/restart", async (t) => {
  for (const kind of [
    "no-ledger-enabled",
    "baseline-only",
    "receipt-disabled",
    "no-ledger-disabled",
  ])
    await t.test(kind, async () => {
      const s = harness();
      s.owner = owner({
        sha: targetSha,
        unitHash: targetHash,
        preflight: !kind.endsWith("disabled"),
      });
      if (kind === "baseline-only")
        s.state = { schemaVersion: 1, baseline: clone(s.owner), release: null, inProgress: null };
      if (kind === "receipt-disabled") s.state = ledger(s.owner, { imageId: targetImage });
      await assert.rejects(executeQlikRelease(options({ expectedOwnerSha: targetSha }), s.io));
      assert.ok(!s.events.includes("prepare"));
      assert.ok(!s.events.includes("quiesce"));
      assert.equal(s.writes.length, 0);
    });
});

test("noop requires an exact active owner, enabled preflight and valid matching receipt/image", async () => {
  const s = harness();
  s.owner = owner({ sha: targetSha, unitHash: targetHash, preflight: true });
  s.state = ledger(s.owner, { imageId: targetImage });
  const before = clone(s.state);
  const result = await executeQlikRelease(options({ expectedOwnerSha: targetSha }), s.io);
  assert.equal(result.status, "noop");
  assert.deepEqual(s.state, before);
  assert.equal(s.writes.length, 0);
  assert.ok(!s.events.includes("prepare"));
  assert.equal(s.ciChecks, 1);
});

test("noop refuses image conflicts, inactive/changed owner, stale CRM and concurrent ledger changes", async (t) => {
  for (const kind of ["image", "inactive", "hash", "enabled", "preflight", "crm", "ledger"])
    await t.test(kind, async () => {
      const s = harness();
      s.owner = owner({ sha: targetSha, unitHash: targetHash, preflight: true });
      s.state = ledger(s.owner, { imageId: targetImage });
      if (kind === "image") s.state.release.imageId = crmImage;
      if (kind === "inactive") s.owner.active = false;
      if (kind === "hash") s.owner.unitHash = previousHash;
      if (kind === "enabled") s.owner.enabled = true;
      if (kind === "preflight") s.owner.preflight = false;
      if (kind === "crm") s.crm.release.deploymentId = oldId;
      if (kind === "ledger")
        s.hooks.candidate = () => {
          s.state.release.deploymentId = recoveryId;
        };
      await assert.rejects(executeQlikRelease(options({ expectedOwnerSha: targetSha }), s.io));
      assert.equal(s.writes.length, 0);
      assert.ok(!s.events.includes("prepare"));
    });
});

test("invalid options are rejected before any IO", async (t) => {
  for (const patch of [
    { operation: "deploy" },
    { targetSha: "main" },
    { expectedOwnerSha: "b" },
    { targetImageId: "latest" },
    { ciRunId: 0 },
    { ciRunId: "123" },
    { expectedDeploymentId: "id" },
    { arbitraryCommand: "secret" },
    { expectedSha: null },
  ])
    await t.test(JSON.stringify(patch), async () => {
      const s = harness();
      await assert.rejects(executeQlikRelease(options(patch), s.io), /\(options\)/);
      assert.deepEqual(s.events, []);
    });
});

test("exact main SHA, exact run and all successful gates are mandatory before prepare", async (t) => {
  const changes = {
    main: (c) => {
      c.mainSha = ownerSha;
    },
    branch: (c) => {
      c.run.head_branch = "feature";
    },
    event: (c) => {
      c.run.event = "pull_request";
    },
    running: (c) => {
      c.run.status = "in_progress";
    },
    run: (c) => {
      c.run.id = 124;
    },
    sha: (c) => {
      c.run.head_sha = ownerSha;
    },
    missing: (c) => {
      c.jobs.pop();
    },
    failed: (c) => {
      c.jobs[0].conclusion = "failure";
    },
    duplicate: (c) => {
      c.jobs.push(clone(c.jobs[0]));
    },
    extraFailed: (c) => {
      c.jobs.push({ name: "other", status: "completed", conclusion: "failure" });
    },
  };
  for (const [name, change] of Object.entries(changes))
    await t.test(name, async () => {
      const s = harness();
      change(s.candidate);
      await assert.rejects(executeQlikRelease(options(), s.io), /\(approval\)/);
      assert.ok(!s.events.includes("prepare"));
      assert.equal(s.state, null);
    });
});

test("CRM health mismatch or pending CRM deployment blocks before preparation", async (t) => {
  for (const kind of ["health", "pending", "date", "expected-sha"])
    await t.test(kind, async () => {
      const s = harness();
      const observe = s.io.app.observe;
      s.io.app = {
        ...s.io.app,
        async observe() {
          const result = await observe();
          if (kind === "health") result.publicHealthSha = ownerSha;
          if (kind === "pending") result.state.inProgress = {};
          if (kind === "date") result.state.release.deployedAt = "unknown";
          return result;
        },
      };
      await assert.rejects(
        executeQlikRelease(options(kind === "expected-sha" ? { expectedSha: ownerSha } : {}), s.io),
      );
      assert.ok(!s.events.includes("prepare"));
      assert.equal(s.state, null);
    });
});

test("prepare must prove the immutable image and return an exact backup identity/hash descriptor", async (t) => {
  for (const field of [
    "id",
    "previousSha",
    "targetSha",
    "previousUnitHash",
    "targetUnitHash",
    "extra",
    "image",
  ])
    await t.test(field, async () => {
      const s = harness();
      s.hooks.prepare = (_opts, _owner, backup) => {
        if (field === "image") throw new Error("wrong immutable image");
        if (field === "extra") backup.secret = "private";
        else backup[field] = "invalid";
      };
      await assert.rejects(executeQlikRelease(options(), s.io), /Private details withheld/);
      assert.equal(s.state, null);
      assert.ok(!s.events.includes("quiesce"));
    });
});

test("long preparation and profile backup get fresh CRM/CI checks before unit mutation", async () => {
  const s = harness();
  s.hooks.prepare = () => {
    s.clock += 120000;
  };
  s.hooks["backup-profile"] = () => {
    s.clock += 120000;
  };
  await executeQlikRelease(options(), s.io);
  assert.equal(s.ciChecks, 4);
  assert.ok(s.events.lastIndexOf("candidate") > s.events.indexOf("apply-write"));
});

test("CRM or CI changes at every renewed gate fail closed", async (t) => {
  for (const gate of [2, 3, 4])
    for (const source of ["crm", "ci"])
      await t.test(`${source}-${gate}`, async () => {
        const s = harness();
        if (source === "crm")
          s.hooks.observe = (count) => {
            if (count === gate) s.crm.release.deploymentId = oldId;
          };
        else
          s.hooks.candidate = (count) => {
            if (count === gate) s.candidate.mainSha = ownerSha;
          };
        await assert.rejects(executeQlikRelease(options(), s.io));
        if (gate === 2) assert.equal(s.state, null);
        else assert.equal(s.state.inProgress.deploymentId, deployId);
        assert.ok(!s.events.includes(gate === 4 ? "start-write" : "apply-write"));
      });
});

test("minute rollover during CI and clock regression fail without masking stale evidence", async (t) => {
  for (const change of [60000, -1])
    for (const gate of [1, 2, 3, 4])
      await t.test(`${change}-${gate}`, async () => {
        const s = harness();
        s.hooks.candidate = (count) => {
          if (count === gate) s.clock += change;
        };
        await assert.rejects(executeQlikRelease(options(), s.io));
        assert.ok(!s.events.includes(gate === 4 ? "start-write" : "apply-write"));
      });
});

test("freshness is checked after the final before-write and before-start ledger CAS", async (t) => {
  for (const phase of ["apply", "start"])
    await t.test(phase, async () => {
      const s = harness();
      s.hooks["after-cas"] = () => {
        if (s.events.includes(phase) && !s.events.includes(`${phase}-write`)) s.clock += 60000;
      };
      await assert.rejects(executeQlikRelease(options(), s.io));
      assert.ok(!s.events.includes(`${phase}-write`));
      assert.ok(s.state.inProgress);
    });
});

test("intent precedes stop even if acknowledgement is lost; pending blocks all new publication", async () => {
  const s = harness();
  s.hooks["after-intent"] = () => {
    throw new Error("lost acknowledgement");
  };
  await assert.rejects(executeQlikRelease(options(), s.io));
  assert.equal(s.state.inProgress.deploymentId, deployId);
  assert.ok(!s.events.includes("quiesce"));
  delete s.hooks["after-intent"];
  s.events = [];
  await assert.rejects(executeQlikRelease(options(), s.io), /\(baseline\)/);
  assert.deepEqual(s.events, ["read"]);
});

test("failures never clear pending intent or replace the last valid release", async (t) => {
  for (const at of [
    "quiesce",
    "backup-profile",
    "backed-up",
    "apply",
    "after-apply",
    "start",
    "after-start",
    "verify",
    "receipt",
  ])
    await t.test(at, async () => {
      const s = harness();
      s.state = ledger();
      const previous = clone(s.state.release);
      s.hooks[at] = () => {
        throw new Error("SECRET_PRIVATE_DATA");
      };
      await assert.rejects(executeQlikRelease(options(), s.io), (error) => {
        assert.match(error.message, /Private details withheld/);
        assert.doesNotMatch(error.stack, /SECRET_PRIVATE_DATA/);
        assert.equal(error.cause, undefined);
        return true;
      });
      assert.deepEqual(s.state.release, previous);
      assert.equal(s.state.inProgress.deploymentId, deployId);
    });
});

test("unproven stopped state, changed unit or changed enabled flag blocks apply/start/receipt", async (t) => {
  for (const at of ["after-quiesce", "after-backup-profile", "apply", "start", "verify"])
    await t.test(at, async () => {
      const s = harness();
      s.hooks[at] = () => {
        s.owner.unitHash = "f".repeat(64);
      };
      await assert.rejects(executeQlikRelease(options(), s.io));
      assert.ok(s.state.inProgress);
      if (["after-quiesce", "after-backup-profile", "apply"].includes(at)) noPublication(s);
      if (at === "start") assert.ok(!s.events.includes("start-write"));
    });
});

test("host cannot omit, duplicate, swallow failure of or defer mandatory callbacks", async (t) => {
  for (const method of ["apply", "start"])
    for (const behavior of ["omit", "twice", "swallow", "late"])
      await t.test(`${method}-${behavior}`, async () => {
        const s = harness();
        let late;
        s.io[method] = async (_tx, callback) => {
          if (behavior === "omit") return;
          if (behavior === "late") {
            late = callback;
            return;
          }
          if (behavior === "swallow") s.candidate.mainSha = ownerSha;
          try {
            const check = await callback();
            check();
          } catch {
            /* Deliberately broken host. */
          }
          if (behavior === "twice")
            try {
              await callback();
            } catch {
              /* Must still block. */
            }
        };
        await assert.rejects(executeQlikRelease(options(), s.io));
        if (late) await assert.rejects(late());
        assert.ok(s.state.inProgress);
        assert.ok(!s.events.includes("start-write"));
      });
});

test("concurrent ledger changes cannot be overwritten at intent, apply, start or receipt", async (t) => {
  for (const at of ["intent", "apply", "start", "receipt"])
    await t.test(at, async () => {
      const s = harness();
      s.hooks[at] = () => {
        s.state = ledger(owner({ sha: "e".repeat(40) }));
      };
      await assert.rejects(executeQlikRelease(options(), s.io));
      assert.equal(s.state.baseline.sha, "e".repeat(40));
      if (at !== "receipt")
        assert.ok(!s.events.includes(at === "start" ? "start-write" : "apply-write"));
    });
});

test("verification must return only an allowed status, never data or arbitrary strings", async (t) => {
  for (const result of [
    undefined,
    { status: "inspected" },
    { preflightStatus: "secret" },
    { preflightStatus: "disabled" },
    { preflightStatus: "pending", cookies: "secret" },
  ])
    await t.test(JSON.stringify(result), async () => {
      const s = harness();
      s.io.verifyOwner = async () => result;
      await assert.rejects(executeQlikRelease(options(), s.io), /\(verify\)/);
      assert.ok(s.state.inProgress);
      assert.equal(s.state.release, null);
    });
});

test("recovery uses exact pending ID, preserves profile and records a new verified baseline receipt", async () => {
  const s = await failedAttempt();
  const profileBackups = s.events.filter((e) => e === "backup-profile").length;
  s.io.app = {
    ...s.io.app,
    candidate: async () => {
      throw new Error("Recovery must not publish old main");
    },
  };
  const result = await recoverQlikRelease(deployId, s.io);
  assert.equal(result.status, "recovered");
  assert.equal(result.release.deploymentId, recoveryId);
  assert.equal(result.release.sha, ownerSha);
  assert.equal(result.release.imageId, null);
  assert.equal(result.release.ciRunId, null);
  assert.equal(result.preflightStatus, "disabled");
  assert.deepEqual(s.owner, owner());
  assert.equal(s.events.filter((e) => e === "backup-profile").length, profileBackups);
  assert.ok(s.events.indexOf("recovery-intent") < s.events.lastIndexOf("quiesce"));
  assert.equal(s.state.inProgress, null);
  assert.deepEqual(s.crm, appState());
  validateQlikState(s.state, s.clock);
});

test("recovery retains the prior known image and preflight settings without restoring a tar", async () => {
  const s = harness();
  s.owner.preflight = true;
  s.owner.enabled = true;
  s.state = ledger(s.owner);
  s.hooks.verify = () => {
    throw new Error();
  };
  await assert.rejects(executeQlikRelease(options(), s.io));
  delete s.hooks.verify;
  const result = await recoverQlikRelease(deployId, s.io);
  assert.equal(result.release.imageId, crmImage);
  assert.equal(result.release.ciRunId, 100);
  assert.equal(result.release.enabled, true);
  assert.equal(result.release.preflight, true);
  assert.equal(result.preflightStatus, "pending");
});

test("recovery from every interrupted stage restores only the recorded owner", async (t) => {
  for (const at of [
    "quiesce",
    "backup-profile",
    "backed-up",
    "apply",
    "after-apply",
    "start",
    "after-start",
    "verify",
    "receipt",
  ])
    await t.test(at, async () => {
      const s = await failedAttempt(at);
      await recoverQlikRelease(deployId, s.io);
      assert.deepEqual(s.owner, owner());
      assert.equal(s.state.inProgress, null);
    });
});

test("recovery rejects wrong ID, absent intent, unrelated owner and changed CRM without stopping", async (t) => {
  for (const kind of ["id", "no-state", "no-intent", "owner", "flag", "crm"])
    await t.test(kind, async () => {
      const s = await failedAttempt();
      s.events = [];
      if (kind === "no-state") s.state = null;
      if (kind === "no-intent") s.state.inProgress = null;
      if (kind === "owner") s.owner.sha = "e".repeat(40);
      if (kind === "flag") s.owner.enabled = true;
      if (kind === "crm") s.crm.release.deploymentId = oldId;
      await assert.rejects(recoverQlikRelease(kind === "id" ? oldId : deployId, s.io));
      assert.ok(!s.events.includes("quiesce"));
    });
});

test("recovery failure retains phase and permits retry with the same pending ID", async (t) => {
  for (const at of [
    "recovery-intent",
    "quiesce",
    "restore",
    "after-restore",
    "recovery-start",
    "verify",
    "receipt",
  ])
    await t.test(at, async () => {
      const s = await failedAttempt();
      s.hooks[at] = () => {
        throw new Error("secret rollback error");
      };
      await assert.rejects(recoverQlikRelease(deployId, s.io), /Private details withheld/);
      assert.equal(s.state.inProgress.deploymentId, deployId);
      delete s.hooks[at];
      s.ids.push(oldId);
      const result = await recoverQlikRelease(deployId, s.io);
      assert.equal(result.status, "recovered");
      assert.equal(s.state.inProgress, null);
    });
});

test("recovery restore/start callbacks are mandatory and cannot swallow duplicate invocation", async (t) => {
  for (const method of ["restore", "start"])
    for (const twice of [false, true])
      await t.test(`${method}-${twice}`, async () => {
        const s = await failedAttempt();
        s.io[method] = async (_tx, callback) => {
          if (twice) {
            const check = await callback();
            check();
            await callback().catch(() => {});
          }
        };
        await assert.rejects(recoverQlikRelease(deployId, s.io));
        assert.equal(s.state.inProgress.phase, "recovering");
      });
});

test("recovery rechecks CRM and freshness at restore/start instead of trusting the original gate", async (t) => {
  for (const phase of ["restore", "recovery-start"])
    for (const kind of ["crm", "clock", "cas"])
      await t.test(`${phase}-${kind}`, async () => {
        const s = await failedAttempt();
        s.events = [];
        if (kind === "crm")
          s.hooks[phase] = () => {
            s.crm.release.deploymentId = oldId;
          };
        if (kind === "clock")
          s.hooks[phase] = () => {
            s.clock -= 1;
          };
        if (kind === "cas")
          s.hooks["after-cas"] = () => {
            if (s.events.includes(phase)) s.clock += 60000;
          };
        await assert.rejects(recoverQlikRelease(deployId, s.io));
        assert.ok(!s.events.includes(phase === "restore" ? "restore-write" : "start-write"));
        assert.equal(s.state.inProgress.phase, "recovering");
      });
});

test("deployment and recovery UUID collisions cannot fabricate a receipt", async (t) => {
  for (const id of ["invalid", crmId, oldId])
    await t.test(`deploy-${id}`, async () => {
      const s = harness();
      s.state = ledger();
      s.ids = [id];
      await assert.rejects(executeQlikRelease(options(), s.io));
      assert.ok(!s.events.includes("prepare"));
    });
  for (const id of ["invalid", deployId, crmId])
    await t.test(`recover-${id}`, async () => {
      const s = await failedAttempt();
      s.ids = [id];
      await assert.rejects(recoverQlikRelease(deployId, s.io));
      assert.ok(s.state.inProgress);
    });
});

test("malformed ledgers cannot supply baseline history, arbitrary metadata or inconsistent backups", async (t) => {
  const pending = (await failedAttempt()).state;
  const changes = [
    (s) => {
      s.schemaVersion = 3;
    },
    (s) => {
      s.baseline.deployedAt = "invented";
    },
    (s) => {
      s.baseline.active = false;
    },
    (s) => {
      s.baseline.preflight = "true";
    },
    (s) => {
      s.inProgress.backup.id = oldId;
    },
    (s) => {
      s.inProgress.backup.previousSha = targetSha;
    },
    (s) => {
      s.inProgress.previousOwner.unitHash = targetHash;
    },
    (s) => {
      s.inProgress.phase = "done";
    },
    (s) => {
      s.inProgress.startedAt = "2026-10-15T00:00:00.000Z";
    },
    (s) => {
      s.inProgress.operation = "deploy";
    },
    (s) => {
      s.inProgress.password = "secret";
    },
    (s) => {
      s.inProgress.deploymentId = crmId;
    },
  ];
  for (const [index, change] of changes.entries())
    await t.test(String(index), () => {
      const state = clone(pending);
      change(state);
      assert.throws(() => validateQlikState(state, minute + 10000));
    });
  for (const value of [undefined, {}, [], 0, false])
    assert.throws(() => validateQlikState(value, minute));
  assert.equal(validateQlikState(null, minute), null);
  assert.throws(() => validateQlikState(null, NaN));
});

test("receipt timestamps and immutable provenance remain validated on subsequent runs", async (t) => {
  const changes = [
    (s) => {
      s.release.deployedAt = "unknown";
    },
    (s) => {
      s.release.deployedAt = "2027-01-01T00:00:00.000Z";
    },
    (s) => {
      s.release.imageId = "latest";
    },
    (s) => {
      s.release.imageId = null;
    },
    (s) => {
      s.release.ciRunId = 0;
    },
    (s) => {
      s.release.preflightStatus = "secret";
    },
    (s) => {
      s.release.active = false;
    },
    (s) => {
      s.release.deploymentId = "bad";
    },
  ];
  for (const [index, change] of changes.entries())
    await t.test(String(index), () => {
      const state = ledger();
      change(state);
      assert.throws(() => validateQlikState(state, minute));
    });
});

test("clock regression after verify never records a successful deployment or recovery", async () => {
  const s = harness();
  s.hooks.verify = () => {
    s.clock -= 1;
  };
  await assert.rejects(executeQlikRelease(options(), s.io));
  assert.ok(s.state.inProgress);
  s.clock += 1;
  await assert.rejects(recoverQlikRelease(deployId, s.io));
  assert.ok(s.state.inProgress);
});

test("host argument mutation cannot rewrite the owned transaction or baseline", async () => {
  const s = harness();
  s.hooks.prepare = (opts, snapshot) => {
    opts.targetSha = ownerSha;
    snapshot.sha = targetSha;
  };
  s.hooks.quiesce = (tx) => {
    tx.targetSha = ownerSha;
    tx.previousOwner.sha = targetSha;
  };
  await executeQlikRelease(options(), s.io);
  assert.deepEqual(s.state.baseline, owner());
  assert.equal(s.state.release.sha, targetSha);
});

test("noop is rejected when live CI approval is revoked or main/run has changed", async (t) => {
  for (const change of ["revoked", "main", "run"])
    await t.test(change, async () => {
      const s = harness();
      s.owner = owner({ sha: targetSha, unitHash: targetHash, preflight: true });
      s.state = ledger(s.owner, { imageId: targetImage });
      const before = clone(s.state);
      if (change === "revoked") s.candidate.jobs[0].conclusion = "failure";
      if (change === "main") s.candidate.mainSha = ownerSha;
      if (change === "run") s.candidate.run.id = 124;
      await assert.rejects(
        executeQlikRelease(options({ expectedOwnerSha: targetSha }), s.io),
        /\(approval\)/,
      );
      assert.equal(s.ciChecks, 1);
      assert.deepEqual(s.state, before);
      assert.equal(s.writes.length, 0);
      assert.ok(!s.events.includes("prepare"));
      assert.ok(!s.events.includes("quiesce"));
    });
});

const mutationCases = [
  { name: "apply", method: "apply", recovery: false },
  { name: "start", method: "start", recovery: false },
  { name: "restore", method: "restore", recovery: true },
  { name: "recovery-start", method: "start", recovery: true },
];

function runMutationCase(s, recovery) {
  return recovery ? recoverQlikRelease(deployId, s.io) : executeQlikRelease(options(), s.io);
}

test("final synchronous guard rejects expiration or clock regression after asynchronous host rechecks", async (t) => {
  for (const { name, method, recovery } of mutationCases)
    for (const delta of [50000, 60001, -1])
      await t.test(`${name}-${delta}`, async () => {
        const s = recovery ? await failedAttempt() : harness();
        const previousRelease = clone(s.state?.release ?? null);
        const writes = s.events.filter((entry) => entry === `${method}-write`).length;
        s.hooks[`${method}-recheck`] = () => {
          s.clock += delta;
        };
        await assert.rejects(runMutationCase(s, recovery));
        assert.equal(s.events.filter((entry) => entry === `${method}-write`).length, writes);
        assert.equal(s.state.inProgress.deploymentId, deployId);
        assert.deepEqual(s.state.release, previousRelease);
      });
});

test("hosts must consume the returned final guard once and cannot swallow its failure", async (t) => {
  for (const { name, method, recovery } of mutationCases)
    for (const behavior of ["omit", "twice", "swallow-expired", "late", "late-after-error"])
      await t.test(`${name}-${behavior}`, async () => {
        const s = recovery ? await failedAttempt() : harness();
        const previousRelease = clone(s.state?.release ?? null);
        let late;
        s.io[method] = async (_tx, before) => {
          const check = await before();
          assert.equal(typeof check, "function");
          if (behavior === "omit") return;
          if (behavior.startsWith("late")) {
            late = check;
            if (behavior === "late-after-error") throw new Error("private host error");
            return;
          }
          if (behavior === "swallow-expired") s.clock += 60000;
          try {
            check();
          } catch {
            /* Simulate a host incorrectly swallowing guard failure. */
          }
          if (behavior === "twice") {
            assert.throws(check);
          }
        };
        await assert.rejects(runMutationCase(s, recovery), /Private details withheld/);
        if (late) assert.throws(late);
        assert.equal(s.state.inProgress.deploymentId, deployId);
        assert.deepEqual(s.state.release, previousRelease);
      });
});

test("final guard is synchronous, performs no async IO and expires when its host invocation ends", async (t) => {
  for (const { name, method, recovery } of mutationCases)
    await t.test(name, async () => {
      const s = recovery ? await failedAttempt() : harness();
      const original = s.io[method];
      let savedGuard;
      let consumed = 0;
      s.hooks[`${method}-recheck`] = () => {
        s.clock += 1;
      };
      s.io[method] = (tx, before, restore) =>
        original(
          tx,
          async () => {
            savedGuard = await before();
            return () => {
              const eventCount = s.events.length;
              const result = savedGuard();
              assert.equal(result, undefined);
              assert.equal(s.events.length, eventCount);
              consumed += 1;
              return result;
            };
          },
          restore,
        );
      const result = await runMutationCase(s, recovery);
      assert.equal(result.status, recovery ? "recovered" : "deployed");
      assert.equal(consumed, 1);
      assert.throws(savedGuard);
      assert.equal(s.state.inProgress, null);
    });
});
