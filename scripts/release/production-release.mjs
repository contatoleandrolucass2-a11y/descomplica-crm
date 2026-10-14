import path from "node:path";
import { pathToFileURL } from "node:url";
import { withProductionLock } from "./production-release-lock.mjs";
import { productionHost } from "./production-release-host.mjs";
import { privateJsonStore } from "./private-json-store.mjs";
import { executeRelease } from "./production-release-engine.mjs";
import { recoverRelease } from "./production-release-recovery.mjs";
import { qlikReleaseHost } from "./qlik-release-host.mjs";
import { executeQlikRelease, recoverQlikRelease } from "./qlik-release-engine.mjs";

export function parseReleaseArguments(args) {
  const [operation, ...rest] = args;
  const operations = {
    status: [],
    initialize: ["attestation"],
    recover: ["deployment-id"],
    deploy: ["expected-deployment-id", "expected-sha", "sha", "image-id", "ci-run-id"],
    "qlik-status": [],
    "qlik-recover": ["deployment-id"],
    "qlik-deploy": [
      "expected-deployment-id",
      "expected-sha",
      "expected-owner-sha",
      "sha",
      "image-id",
      "ci-run-id",
    ],
  };
  if (!Object.hasOwn(operations, operation)) throw new Error("Unknown release operation.");
  const required = operations[operation];
  const optional = operation === "deploy" ? ["salesforce-ingestion", "qlik-ranking"] : [];
  if (!required || rest.length % 2 !== 0 || rest.length < required.length * 2)
    throw new Error("Invalid release arguments.");
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index].replace(/^--/u, "");
    if (
      rest[index] !== `--${key}` ||
      ![...required, ...optional].includes(key) ||
      Object.hasOwn(values, key) ||
      !rest[index + 1] ||
      rest[index + 1].startsWith("--")
    ) {
      throw new Error("Unknown, duplicate, or missing release argument.");
    }
    values[key] = rest[index + 1];
  }
  if (required.some((key) => !Object.hasOwn(values, key)))
    throw new Error("Missing release argument.");
  if (values["salesforce-ingestion"] && values["salesforce-ingestion"] !== "enable")
    throw new Error("Only explicit Salesforce ingestion enable is supported.");
  if (values["qlik-ranking"] && values["qlik-ranking"] !== "enable")
    throw new Error("Only explicit Qlik ranking enable is supported.");
  if (values["qlik-ranking"] && values["salesforce-ingestion"])
    throw new Error("Integration configurations require separate releases.");
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
    const qlik = qlikReleaseHost(lock);
    if (operation === "qlik-status") {
      const state = await qlik.readState();
      return {
        status: state?.inProgress ? "recovery-required" : "recorded",
        release: state?.release ?? null,
        inProgress: state?.inProgress ?? null,
      };
    }
    if (operation === "qlik-recover") return recoverQlikRelease(values["deployment-id"], qlik);
    if (operation === "qlik-deploy")
      return executeQlikRelease(
        {
          operation,
          expectedDeploymentId: values["expected-deployment-id"],
          expectedSha: values["expected-sha"],
          expectedOwnerSha: values["expected-owner-sha"],
          targetSha: values.sha,
          targetImageId: values["image-id"],
          ciRunId: Number(values["ci-run-id"]),
        },
        qlik,
      );
    if (operation !== "status" && (await qlik.readState())?.inProgress)
      throw new Error("Recover the pending Qlik operation before changing production.");
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
        ...(values["salesforce-ingestion"] === "enable" ? { salesforceIngestion: true } : {}),
        ...(values["qlik-ranking"] === "enable" ? { qlikRanking: true } : {}),
      },
      io,
    );
  });
  // Expose only release identifiers/times. Attestation evidence, configuration
  // contents, raw Docker output and credentials never become CLI output.
  const { deploymentId, sha, imageId, deployedAt } = result.release ?? {};
  process.stdout.write(
    `${JSON.stringify({ status: result.status, deploymentId, sha, imageId, deployedAt, ...(operation.startsWith("qlik-") ? { component: "qlik-owner", preflightStatus: result.preflightStatus ?? null, rankingConnected: false } : {}), pendingDeploymentId: result.inProgress?.deploymentId ?? null })}\n`,
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
