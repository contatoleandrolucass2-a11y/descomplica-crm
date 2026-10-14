import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseReleaseArguments } from "./production-release.mjs";
import { executeRelease } from "./production-release-engine.mjs";
import {
  transformQlikReleaseEnvironment,
  qlikEnvironmentValues,
  environmentSha256,
  selectEnvironmentChange,
  assertEnvironmentChangeContents,
  assertQlikContainerDigests,
  qlikContainerDigestScript,
} from "./salesforce-release-environment.mjs";

const oldSha = "a".repeat(40),
  newSha = "b".repeat(40);
const secret = "q".repeat(48);
const before = `IMAGE_TAG=${oldSha}\nSUPABASE_SECRET_KEY=sb_secret_${"fixture".repeat(5)}\nSALESFORCE_INGEST_ENABLED=true\nSALESFORCE_REFRESH_ENABLED=false\nOTHER="preserved $VALUE"\n`;
const after = transformQlikReleaseEnvironment(before, oldSha, newSha, secret);
const change = {
  backupId: "00000000-0000-4000-8000-000000000001",
  beforeSha256: environmentSha256(before),
  afterSha256: environmentSha256(after),
};
const backup = { schemaVersion: 2, kind: "qlik-ranking-v2", ...change, before, after };

test("Qlik transformation changes only its two keys and the release SHA", () => {
  assert.equal(
    after,
    before.replace(oldSha, newSha) +
      `QLIK_RANKING_V2_ENABLED=true\nQLIK_RANKING_V2_HMAC_SECRET=${secret}\n`,
  );
  assert.deepEqual(qlikEnvironmentValues(before), {
    QLIK_RANKING_V2_ENABLED: "false",
    QLIK_RANKING_V2_HMAC_SECRET: "",
  });
  assert.equal(
    transformQlikReleaseEnvironment(after, newSha, oldSha, secret),
    before + `QLIK_RANKING_V2_ENABLED=true\nQLIK_RANKING_V2_HMAC_SECRET=${secret}\n`,
  );
});

test("Qlik requires an existing privileged server secret and a separate valid HMAC", () => {
  for (const value of ["", "short", secret + "\n", secret + "$", null])
    assert.throws(() => transformQlikReleaseEnvironment(before, oldSha, newSha, value));
  assert.throws(() =>
    transformQlikReleaseEnvironment(
      before.replace(/SUPABASE_SECRET_KEY=.*\n/u, ""),
      oldSha,
      newSha,
      secret,
    ),
  );
  assert.throws(() =>
    transformQlikReleaseEnvironment(
      before + `SALESFORCE_INGEST_SECRET=${secret}\n`,
      oldSha,
      newSha,
      secret,
    ),
  );
  assert.throws(() => transformQlikReleaseEnvironment(before, oldSha, oldSha, secret));
  assert.throws(() =>
    transformQlikReleaseEnvironment(
      before + "QLIK_RANKING_V2_ENABLED=false\nQLIK_RANKING_V2_ENABLED=true\n",
      oldSha,
      newSha,
      secret,
    ),
  );
  assert.throws(() =>
    transformQlikReleaseEnvironment(
      before + "QLIK_RANKING_V2_ENABLED=$VALUE\n",
      oldSha,
      newSha,
      secret,
    ),
  );
});

test("v2 backup binds exact transform and restores without consulting credentials", () => {
  assert.equal(
    selectEnvironmentChange(before, backup, change, {
      expectedCurrentSha: oldSha,
      targetSha: newSha,
    }),
    after,
  );
  assert.equal(
    selectEnvironmentChange(after, backup, change, {
      expectedCurrentSha: newSha,
      targetSha: oldSha,
      restoreEnvironment: true,
    }),
    before,
  );
  assert.doesNotThrow(() => assertEnvironmentChangeContents(before, backup, change, true));
  for (const invalid of [
    { ...backup, kind: "salesforce" },
    { ...backup, schemaVersion: 1 },
    { ...backup, unrelated: true },
    { ...backup, after: after + "EXTRA=true\n" },
  ])
    assert.throws(() =>
      selectEnvironmentChange(before, invalid, change, {
        expectedCurrentSha: oldSha,
        targetSha: newSha,
      }),
    );
  assert.throws(() =>
    selectEnvironmentChange(before + "OTHER_CHANGED=1\n", backup, change, {
      expectedCurrentSha: oldSha,
      targetSha: newSha,
    }),
  );
  const forgedAfter = after.replace(
    "SALESFORCE_INGEST_ENABLED=true",
    "SALESFORCE_INGEST_ENABLED=false",
  );
  const forgedChange = { ...change, afterSha256: environmentSha256(forgedAfter) };
  assert.throws(() =>
    assertEnvironmentChangeContents(
      forgedAfter,
      { ...backup, ...forgedChange, after: forgedAfter },
      forgedChange,
      false,
    ),
  );
});

test("effective runtime comparison uses hashes and explicit disabled defaults", () => {
  const output = execFileSync(process.execPath, ["--eval", qlikContainerDigestScript], {
    env: {},
    encoding: "utf8",
  });
  assertQlikContainerDigests(before, JSON.parse(output));
  assert.ok(!output.includes(secret));
  const live = Object.fromEntries(
    Object.entries(qlikEnvironmentValues(after)).map(([key, value]) => [
      key,
      environmentSha256(value),
    ]),
  );
  assertQlikContainerDigests(after, live);
  assert.throws(() =>
    assertQlikContainerDigests(after, {
      ...live,
      QLIK_RANKING_V2_ENABLED: environmentSha256("false"),
    }),
  );
  assert.throws(() => assertQlikContainerDigests(after, { ...live, extra: "x" }));
});

test("CLI only accepts explicit Qlik configuration on protected deploy", () => {
  const args = [
    "deploy",
    "--expected-deployment-id",
    change.backupId,
    "--expected-sha",
    oldSha,
    "--sha",
    newSha,
    "--image-id",
    `sha256:${"1".repeat(64)}`,
    "--ci-run-id",
    "123",
  ];
  assert.equal(
    parseReleaseArguments([...args, "--qlik-ranking", "enable"]).values["qlik-ranking"],
    "enable",
  );
  for (const bad of ["true", "false", secret])
    assert.throws(() => parseReleaseArguments([...args, "--qlik-ranking", bad]));
  assert.throws(() =>
    parseReleaseArguments([
      ...args,
      "--qlik-ranking",
      "enable",
      "--salesforce-ingestion",
      "enable",
    ]),
  );
  assert.throws(() => parseReleaseArguments(["status", "--qlik-ranking", "enable"]));
});

test("empty Qlik activation flag matches the disabled Compose default", () => {
  const compose = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
  assert.match(compose, /QLIK_RANKING_V2_ENABLED:\s*\$\{QLIK_RANKING_V2_ENABLED:-false\}/u);
  const contents = before + 'QLIK_RANKING_V2_ENABLED=""\nQLIK_RANKING_V2_HMAC_SECRET=\n';
  const digests = JSON.parse(
    execFileSync(process.execPath, ["--eval", qlikContainerDigestScript], {
      env: { QLIK_RANKING_V2_ENABLED: "false", QLIK_RANKING_V2_HMAC_SECRET: "" },
      encoding: "utf8",
    }),
  );
  assert.doesNotThrow(() => assertQlikContainerDigests(contents, digests));
});

function engineFixture() {
  const currentId = "aaaaaaaa-0000-4000-8000-000000000001";
  const currentImage = `sha256:${"1".repeat(64)}`;
  const targetImage = `sha256:${"2".repeat(64)}`;
  const system = {
    clock: Date.parse("2026-10-14T12:00:00.000Z"),
    state: {
      schemaVersion: 1,
      inProgress: null,
      release: {
        deploymentId: currentId,
        sha: oldSha,
        imageId: currentImage,
        deployedAt: "2026-10-14T11:00:00.000Z",
        evidence: "synthetic prior receipt",
      },
    },
    events: [],
  };
  system.options = {
    operation: "deploy",
    expectedDeploymentId: currentId,
    expectedSha: oldSha,
    targetSha: newSha,
    targetImageId: targetImage,
    ciRunId: 123,
    qlikRanking: true,
  };
  system.io = {
    now: () => system.clock,
    id: () => change.backupId,
    observe: async () => ({
      state: structuredClone(system.state),
      environmentSha: oldSha,
      containerSha: oldSha,
      containerImageId: currentImage,
      healthSha: oldSha,
      publicHealthSha: oldSha,
      startedAt: system.clock,
      checkedAt: system.clock,
    }),
    candidate: async () => {
      system.events.push("candidate");
      return {
        mainSha: newSha,
        run: {
          id: 123,
          status: "completed",
          conclusion: "success",
          event: "push",
          head_branch: "main",
          head_sha: newSha,
        },
        jobs: ["validate", "release-gates", "isolated-restore", "promotable-image"].map((name) => ({
          name,
          status: "completed",
          conclusion: "success",
        })),
      };
    },
    prepare: async (options) => {
      assert.equal(options.qlikRanking, true);
      system.events.push("prepare");
    },
    prepareEnvironmentChange: async (options, id) => {
      assert.equal(options.qlikRanking, true);
      assert.equal(options.salesforceIngestion, undefined);
      assert.equal(id, change.backupId);
      system.events.push("backup");
      return change;
    },
    readState: async () => structuredClone(system.state),
    writeState: async (expected, next) => {
      assert.deepEqual(system.state, expected);
      system.events.push(next.inProgress ? "pending-cas" : "completed");
      system.state = structuredClone(next);
    },
    bind: async (options, guard) => {
      assert.deepEqual(options.environmentChange, change);
      await guard();
      system.events.push("bind");
    },
    up: async (pending, sha, guard) => {
      assert.deepEqual(pending.environmentChange, change);
      assert.equal(sha, newSha);
      await guard();
      system.events.push("up");
    },
    verify: async (sha, image, check) => {
      assert.equal(sha, newSha);
      assert.equal(image, targetImage);
      assert.deepEqual(check, { change, restore: false });
      system.events.push("verify");
    },
  };
  return system;
}

test("engine records only the Qlik backup descriptor before CAS, bind and runtime verification", async () => {
  const system = engineFixture();
  const result = await executeRelease(system.options, system.io);
  assert.equal(result.status, "deployed");
  assert.equal(system.state.inProgress, null);
  assert.deepEqual(system.events, [
    "candidate",
    "prepare",
    "candidate",
    "backup",
    "pending-cas",
    "pending-cas",
    "bind",
    "pending-cas",
    "up",
    "verify",
    "completed",
  ]);
  assert.equal(JSON.stringify(system.state).includes(secret), false);
});

test("engine refuses malformed or simultaneous Qlik activation before any observation", async () => {
  for (const patch of [
    { qlikRanking: false },
    { qlikRanking: "enable" },
    { qlikRanking: true, salesforceIngestion: true },
  ]) {
    const system = engineFixture();
    system.io.observe = async () => assert.fail("Must reject options before observation");
    await assert.rejects(executeRelease({ ...system.options, ...patch }, system.io));
    assert.deepEqual(system.events, []);
  }
});

test("Qlik configuration cannot bypass CI by reusing the active SHA", async () => {
  const system = engineFixture();
  await assert.rejects(
    executeRelease(
      { ...system.options, targetSha: oldSha, targetImageId: system.state.release.imageId },
      system.io,
    ),
    /new CI-approved release SHA/u,
  );
  assert.deepEqual(system.events, []);
});

test("missing backup or failed CI prevents Qlik intent, bind and start", async () => {
  for (const failure of ["backup", "ci"]) {
    const system = engineFixture();
    if (failure === "backup") system.io.prepareEnvironmentChange = async () => undefined;
    else
      system.io.candidate = async () => {
        throw new Error("Synthetic CI unavailable");
      };
    await assert.rejects(executeRelease(system.options, system.io), /backup|CI unavailable/u);
    assert.equal(system.state.inProgress, null);
    assert.equal(
      system.events.some((event) => ["pending-cas", "bind", "up"].includes(event)),
      false,
    );
  }
});

test("Qlik backup preparation cannot make the final observation older than sixty seconds", async () => {
  const system = engineFixture();
  const prepare = system.io.prepareEnvironmentChange;
  system.io.prepareEnvironmentChange = async (...args) => {
    const descriptor = await prepare(...args);
    system.clock += 60_001;
    return descriptor;
  };
  await assert.rejects(executeRelease(system.options, system.io), /fresh|60|stale/u);
  assert.equal(system.state.inProgress, null);
  assert.equal(system.events.includes("bind"), false);
});

test("failed Qlik runtime verification retains the exact pending backup for recovery", async () => {
  const system = engineFixture();
  system.io.verify = async () => {
    throw new Error("Synthetic Qlik digest mismatch");
  };
  await assert.rejects(executeRelease(system.options, system.io), /digest mismatch/u);
  assert.equal(system.state.release.sha, oldSha);
  assert.deepEqual(system.state.inProgress.environmentChange, change);
  assert.equal(system.state.inProgress.deploymentId, change.backupId);
  assert.equal(system.events.includes("completed"), false);
});
