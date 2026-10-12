import path from "node:path";
import { pathToFileURL } from "node:url";
import { withProductionLock } from "./production-release-lock.mjs";
import { productionHost } from "./production-release-host.mjs";
import { privateJsonStore } from "./private-json-store.mjs";
import { executeRelease } from "./production-release-engine.mjs";
import { recoverRelease } from "./production-release-recovery.mjs";

export function parseReleaseArguments(args) {
  const [operation, ...rest] = args;
  const operations = {
    status: [],
    initialize: ["attestation"],
    recover: ["deployment-id"],
    deploy: ["expected-deployment-id", "expected-sha", "sha", "image-id", "ci-run-id"],
  };
  if (!Object.hasOwn(operations, operation)) throw new Error("Unknown release operation.");
  const required = operations[operation];
  if (!required || rest.length !== required.length * 2)
    throw new Error("Invalid release arguments.");
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index].replace(/^--/u, "");
    if (
      rest[index] !== `--${key}` ||
      !required.includes(key) ||
      Object.hasOwn(values, key) ||
      !rest[index + 1] ||
      rest[index + 1].startsWith("--")
    ) {
      throw new Error("Unknown, duplicate, or missing release argument.");
    }
    values[key] = rest[index + 1];
  }
  if (
    values["ci-run-id"] &&
    (!/^[1-9][0-9]*$/u.test(values["ci-run-id"]) ||
      !Number.isSafeInteger(Number(values["ci-run-id"])))
  )
    throw new Error("Invalid CI run ID.");
  return { operation, values };
}

async function main(args) {
  const { operation, values } = parseReleaseArguments(args);
  const result = await withProductionLock(async (lock) => {
    const io = productionHost(lock);
    if (operation === "status") {
      const state = await io.readState();
      return { status: state.inProgress ? "recovery-required" : "recorded", ...state };
    }
    if (operation === "initialize") {
      if (!path.isAbsolute(values.attestation))
        throw new Error("Attestation path must be absolute.");
      const attestation = await privateJsonStore(values.attestation, (value) => value).read();
      return io.initialize(attestation);
    }
    if (operation === "recover") return recoverRelease(values["deployment-id"], io);
    return executeRelease(
      {
        operation,
        expectedDeploymentId: values["expected-deployment-id"],
        expectedSha: values["expected-sha"],
        targetSha: values.sha,
        targetImageId: values["image-id"],
        ciRunId: values["ci-run-id"] ? Number(values["ci-run-id"]) : undefined,
      },
      io,
    );
  });
  // Expose only release identifiers/times. Attestation evidence, configuration
  // contents, raw Docker output and credentials never become CLI output.
  const { deploymentId, sha, imageId, deployedAt } = result.release;
  process.stdout.write(
    `${JSON.stringify({ status: result.status, deploymentId, sha, imageId, deployedAt, pendingDeploymentId: result.inProgress?.deploymentId ?? null })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write(
      "Production release blocked or incomplete. Check live sources and release:production status; recover any pending deployment before retrying. Private data withheld.\n",
    );
    process.exitCode = 1;
  });
}
