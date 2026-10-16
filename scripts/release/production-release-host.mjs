import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promisify, isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import {
  bindProductionImage,
  readValidatedEnvironment,
  transformProductionImageEnvironment,
  verifyPromotableImage,
  verifyReleaseBoundary,
} from "./bind-production-image.mjs";
import { runtimeCompose } from "./compose-with-runtime-secret.mjs";
import { assertHeldLock } from "./production-release-lock.mjs";
import { assertFreshObservation, validateDeploymentState } from "./production-release-policy.mjs";
import { privateJsonStore } from "./private-json-store.mjs";
import {
  assertEnvironmentChangeContents,
  assertSalesforceContainerDigests,
  readSalesforceReleaseSecrets,
  salesforceContainerDigestScript,
  salesforceEnvironmentBackupStore,
  transformSalesforceReleaseEnvironment,
  assertQlikContainerDigests,
  qlikContainerDigestScript,
  readQlikReleaseSecret,
  transformQlikReleaseEnvironment,
} from "./salesforce-release-environment.mjs";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const api = "https://api.github.com/repos/contatoleandrolucass2-a11y/descomplica-crm";
const statePath = "/etc/descomplica-crm/production-release.json";
const environment = {
  DOCKER_HOST: "unix:///var/run/docker.sock",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};

async function json(url) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { "Cache-Control": "no-cache, no-store", "User-Agent": "descomplica-release-guard" },
  });
  if (!response.ok) throw new Error("Live release source is unavailable; publication blocked.");
  return response.json();
}

async function docker(args) {
  try {
    const { stdout } = await exec("/usr/bin/docker", args, {
      cwd: root,
      env: environment,
      timeout: 15000,
      maxBuffer: 65536,
    });
    return stdout.trim();
  } catch {
    throw new Error("Local Docker observation failed.");
  }
}

async function environmentSha() {
  const contents = await readValidatedEnvironment();
  const sha = contents.match(/^IMAGE_TAG=([0-9a-f]{40})\r?$/mu)?.[1];
  transformProductionImageEnvironment(contents, sha, sha);
  return sha;
}

async function containerVersion(includeStopped = false) {
  const ids = await docker([
    "ps",
    ...(includeStopped ? ["--all"] : []),
    "--no-trunc",
    "--filter",
    "label=com.docker.compose.project=descomplica-crm",
    "--filter",
    "label=com.docker.compose.service=app",
    "--format",
    "{{.ID}}",
  ]);
  if (includeStopped && ids === "") return null;
  if (!/^[0-9a-f]{64}$/u.test(ids))
    throw new Error("Exactly one running production app is required.");
  const fields = (
    await docker([
      "container",
      "inspect",
      "--format",
      '{{.Image}}\t{{index .Config.Labels "org.opencontainers.image.revision"}}\t{{.State.Running}}',
      ids,
    ])
  ).split("\t");
  if (fields.length !== 3 || (!includeStopped && fields[2] !== "true"))
    throw new Error("Production app is not running.");
  return {
    containerId: ids,
    containerImageId: fields[0],
    containerSha: fields[1],
    running: fields[2] === "true",
  };
}

async function assertRuntimeEnvironment(contents, expectedSha, expectedImageId, qlik = false) {
  const container = await containerVersion();
  if (container.containerSha !== expectedSha || container.containerImageId !== expectedImageId) {
    throw new Error("Runtime configuration check requires the exact production image.");
  }
  let digests;
  try {
    digests = JSON.parse(
      await docker([
        "exec",
        container.containerId,
        "node",
        "--input-type=commonjs",
        "--eval",
        salesforceContainerDigestScript,
      ]),
    );
  } catch {
    throw new Error("Effective production configuration is unavailable.");
  }
  assertSalesforceContainerDigests(contents, digests);
  if (qlik) {
    let qlikDigests;
    try {
      qlikDigests = JSON.parse(
        await docker([
          "exec",
          container.containerId,
          "node",
          "--input-type=commonjs",
          "--eval",
          qlikContainerDigestScript,
        ]),
      );
    } catch {
      throw new Error("Effective Qlik configuration is unavailable.");
    }
    assertQlikContainerDigests(contents, qlikDigests);
  }
  if (
    !isDeepStrictEqual(await containerVersion(), container) ||
    (await readValidatedEnvironment()) !== contents
  ) {
    throw new Error("Production configuration changed during runtime verification.");
  }
}

async function health(url) {
  const result = await json(`${url}?release_check=${randomUUID()}`);
  if (result.status !== "ok" || !/^[0-9a-f]{40}$/u.test(result.version ?? "")) {
    throw new Error("Production health did not report an exact release SHA.");
  }
  return result.version;
}

export function productionHost(lock) {
  const store = privateJsonStore(statePath, (state) => validateDeploymentState(state, Date.now()));
  const environmentBackups = salesforceEnvironmentBackupStore();
  async function runtime() {
    const [sha, container, healthSha, publicHealthSha] = await Promise.all([
      environmentSha(),
      containerVersion(),
      health("http://127.0.0.1:3000/api/health"),
      health("https://crm.descomplicapro.com.br/api/health"),
    ]);
    return { environmentSha: sha, ...container, healthSha, publicHealthSha };
  }

  const io = {
    now: Date.now,
    id: randomUUID,
    readState: store.read,
    async writeState(expected, next) {
      await assertHeldLock(lock);
      await store.compareAndWrite(expected, next);
    },
    async observe() {
      await assertHeldLock(lock);
      const startedAt = Date.now();
      const state = await store.read();
      const current = await runtime();
      if (!isDeepStrictEqual(await store.read(), state))
        throw new Error("Release changed during observation.");
      return { state, ...current, startedAt, checkedAt: Date.now() };
    },
    async candidate(runId) {
      if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("Exact CI run ID required.");
      const nonce = randomUUID();
      const [main, run] = await Promise.all([
        json(`${api}/commits/main?release_check=${nonce}`),
        json(`${api}/actions/runs/${runId}?release_check=${nonce}`),
      ]);
      if (run.path !== ".github/workflows/ci.yml" || !Number.isSafeInteger(run.run_attempt)) {
        throw new Error("Candidate run is not the approved CI workflow.");
      }
      const result = await json(
        `${api}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100&release_check=${nonce}`,
      );
      if (!Array.isArray(result.jobs) || result.total_count !== result.jobs.length) {
        throw new Error("CI job evidence is incomplete.");
      }
      return { mainSha: main.sha, run, jobs: result.jobs };
    },
    async prepare(options, previous) {
      await assertHeldLock(lock);
      await verifyReleaseBoundary(
        options.operation === "deploy" ? options.targetSha : options.expectedSha,
      );
      await verifyPromotableImage(options.targetSha, options.targetImageId);
      await verifyPromotableImage(previous.sha, previous.imageId);
      if (options.environmentChange) await environmentBackups.read(options.environmentChange);
      await runtimeCompose(["production", "config", "--quiet"], lock);
    },
    async prepareEnvironmentChange(options, deploymentId) {
      await assertHeldLock(lock);
      if (
        options.operation !== "deploy" ||
        (options.salesforceIngestion !== true && options.qlikRanking !== true) ||
        (options.salesforceIngestion === true && options.qlikRanking === true)
      ) {
        throw new Error("Integration configuration requires an explicit protected deployment.");
      }
      const state = await store.read();
      if (
        state.inProgress ||
        state.release.deploymentId !== options.expectedDeploymentId ||
        state.release.sha !== options.expectedSha
      ) {
        throw new Error("Environment preparation requires the exact previous release.");
      }
      const before = await readValidatedEnvironment();
      const after = options.qlikRanking
        ? transformQlikReleaseEnvironment(
            before,
            options.expectedSha,
            options.targetSha,
            await readQlikReleaseSecret(),
          )
        : transformSalesforceReleaseEnvironment(
            before,
            options.expectedSha,
            options.targetSha,
            await readSalesforceReleaseSecrets(),
          );
      await assertRuntimeEnvironment(
        before,
        options.expectedSha,
        state.release.imageId,
        options.qlikRanking === true,
      );
      await assertHeldLock(lock);
      const change = await environmentBackups.create(
        deploymentId,
        before,
        after,
        options.qlikRanking ? "qlik-ranking-v2" : "salesforce",
      );
      await assertHeldLock(lock);
      if (
        (await readValidatedEnvironment()) !== before ||
        !isDeepStrictEqual(await store.read(), state)
      ) {
        throw new Error("Production changed while preparing its environment backup.");
      }
      return change;
    },
    async bind(options, beforeWrite) {
      await bindProductionImage(options, lock, beforeWrite);
    },
    async up(transaction, targetSha = transaction.targetSha, beforeStart) {
      await assertHeldLock(lock);
      const state = await store.read();
      if (
        !isDeepStrictEqual(state.inProgress, transaction) ||
        (await environmentSha()) !== targetSha
      ) {
        throw new Error("Production start requires the exact pending release.");
      }
      // Compose inherits all lock descriptors. If this coordinator is killed,
      // a still-running Docker child continues to hold all three host locks.
      await runtimeCompose(
        ["production", "up", "-d", "--no-build", "--remove-orphans"],
        lock,
        beforeStart,
      );
    },
    async recoveryObservation() {
      await assertHeldLock(lock);
      const startedAt = Date.now();
      const state = await store.read();
      const [sha, container, checks] = await Promise.all([
        environmentSha(),
        containerVersion(true),
        Promise.allSettled([
          health("http://127.0.0.1:3000/api/health"),
          health("https://crm.descomplicapro.com.br/api/health"),
        ]),
      ]);
      return {
        state,
        environmentSha: sha,
        container,
        startedAt,
        checkedAt: Date.now(),
        healthSha: checks[0].status === "fulfilled" ? checks[0].value : null,
        publicHealthSha: checks[1].status === "fulfilled" ? checks[1].value : null,
      };
    },
    async verify(sha, imageId, environmentCheck) {
      const backup = environmentCheck
        ? await environmentBackups.read(environmentCheck.change)
        : null;
      for (let attempt = 0; attempt < 30; attempt++) {
        await assertHeldLock(lock);
        try {
          const current = await runtime();
          if (
            current.environmentSha === sha &&
            current.containerSha === sha &&
            current.containerImageId === imageId &&
            current.healthSha === sha &&
            current.publicHealthSha === sha
          ) {
            if (environmentCheck) {
              const contents = await readValidatedEnvironment();
              assertEnvironmentChangeContents(
                contents,
                backup,
                environmentCheck.change,
                environmentCheck.restore,
              );
              await assertRuntimeEnvironment(
                contents,
                sha,
                imageId,
                backup.kind === "qlik-ranking-v2",
              );
              await assertHeldLock(lock);
            }
            return;
          }
        } catch {
          // Transient startup/HTTP failure is bounded. No response body or
          // runtime environment is written to logs.
        }
        if (attempt < 29) await delay(2000);
      }
      throw new Error("Release health verification failed; recovery is required.");
    },
    async initialize(attestation) {
      await assertHeldLock(lock);
      const startedAt = Date.now();
      const state = validateDeploymentState(
        { schemaVersion: 1, release: attestation, inProgress: null },
        Date.now(),
      );
      const current = await runtime();
      if (
        current.environmentSha !== attestation.sha ||
        current.containerSha !== attestation.sha ||
        current.containerImageId !== attestation.imageId ||
        current.healthSha !== attestation.sha ||
        current.publicHealthSha !== attestation.sha
      )
        throw new Error("Historical deployment evidence does not match the live release.");
      assertFreshObservation({ startedAt, checkedAt: Date.now() }, Date.now());
      await io.writeState(null, state);
      return { status: "initialized", release: state.release };
    },
  };
  return io;
}
