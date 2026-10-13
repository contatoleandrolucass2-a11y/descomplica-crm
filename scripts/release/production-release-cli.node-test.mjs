import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { parseReleaseArguments } from "./production-release.mjs";

const execFileAsync = promisify(execFile);
const sha = "a".repeat(40);
const targetSha = "b".repeat(40);
const imageId = `sha256:${"1".repeat(64)}`;
const deploymentId = "00000000-0000-4000-8000-000000000001";
let temporaryDirectory;
let guardPath;

function deployArguments() {
  return [
    "deploy",
    "--expected-deployment-id",
    deploymentId,
    "--expected-sha",
    sha,
    "--sha",
    targetSha,
    "--image-id",
    imageId,
    "--ci-run-id",
    "123",
  ];
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "release-cli-test-"));
  guardPath = path.join(temporaryDirectory, "reject-production-io.mjs");
  // Exercise the real CLI entry points as root in an isolated subprocess while
  // trapping production paths and every subprocess spawn before any access.
  await writeFile(
    guardPath,
    `import fs from "node:fs";
import promises from "node:fs/promises";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";
function forbidden() {
  process.stderr.write("FORBIDDEN_PRODUCTION_IO\\n");
  throw new Error("Production access is forbidden in this test.");
}
function protect(object, names) {
  for (const name of names) {
    const original = object[name];
    if (typeof original !== "function") continue;
    object[name] = function (...args) {
      const target = args[0] instanceof URL ? fileURLToPath(args[0]) : String(args[0]);
      if (/^\\/(?:etc\\/descomplica-crm(?:\\/|$)|srv\\/descomplica-crm(?:\\/|$)|var\\/run\\/docker\\.sock$)/u.test(target)) forbidden();
      return original.apply(this, args);
    };
  }
}
protect(promises, ["lstat", "stat", "open", "readFile", "writeFile", "realpath", "rename", "rm", "mkdir", "unlink", "access"]);
protect(fs, ["lstat", "lstatSync", "stat", "statSync", "open", "openSync", "readFile", "readFileSync", "writeFile", "writeFileSync", "realpath", "realpathSync", "rename", "renameSync", "rm", "rmSync", "mkdir", "mkdirSync", "unlink", "unlinkSync", "access", "accessSync"]);
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) childProcess[name] = forbidden;
process.getuid = () => 0;
Object.defineProperty(process, "platform", { value: "linux" });
syncBuiltinESMExports();
`,
    { mode: 0o600 },
  );
});

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function blockedCli(script, arguments_) {
  try {
    await execFileAsync(
      process.execPath,
      ["--import", pathToFileURL(guardPath).href, script, ...arguments_],
      {
        cwd: temporaryDirectory,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
        env: {
          PATH: process.env.PATH,
          TZ: "UTC",
          PRODUCTION_IMAGE_BINDING_LOCK_HELD: "1",
          PRODUCTION_RELEASE_LOCK_HELD: "1",
        },
      },
    );
    assert.fail("A legacy production CLI command unexpectedly succeeded.");
  } catch (error) {
    assert.equal(error.code, 1);
    assert.equal(error.killed, false);
    assert.equal(error.stdout, "");
    assert.doesNotMatch(error.stderr, /FORBIDDEN_PRODUCTION_IO/u);
    return error.stderr;
  }
}

test("parses the supported status, initialization, recovery, and deployment commands", () => {
  assert.deepEqual(parseReleaseArguments(["status"]), { operation: "status", values: {} });
  assert.deepEqual(
    parseReleaseArguments(["initialize", "--attestation", "/private/receipt.json"]),
    {
      operation: "initialize",
      values: { attestation: "/private/receipt.json" },
    },
  );
  assert.deepEqual(parseReleaseArguments(["recover", "--deployment-id", deploymentId]), {
    operation: "recover",
    values: { "deployment-id": deploymentId },
  });
  assert.deepEqual(parseReleaseArguments(deployArguments()), {
    operation: "deploy",
    values: {
      "expected-deployment-id": deploymentId,
      "expected-sha": sha,
      sha: targetSha,
      "image-id": imageId,
      "ci-run-id": "123",
    },
  });
  const reordered = deployArguments();
  const pair = reordered.splice(1, 2);
  reordered.push(...pair);
  assert.deepEqual(parseReleaseArguments(reordered), parseReleaseArguments(deployArguments()));
});

test("rejects missing, unknown, duplicate, empty, and extra release arguments", () => {
  const missingPair = deployArguments().slice(0, -2);
  const missingValue = deployArguments().slice(0, -1);
  const unknown = deployArguments();
  unknown[3] = "--unknown";
  const duplicate = deployArguments();
  duplicate[3] = "--sha";
  const emptyValue = deployArguments();
  emptyValue[2] = "";
  const optionAsValue = deployArguments();
  optionAsValue[2] = "--expected-sha";
  const bareKey = deployArguments();
  bareKey[1] = "expected-deployment-id";
  const extraCi = ["recover", "--deployment-id", deploymentId, "--ci-run-id", "123"];
  for (const args of [
    [],
    ["unknown"],
    ["toString"],
    ["valueOf"],
    ["toLocaleString"],
    ["status", "--ci-run-id", "123"],
    ["initialize"],
    ["recover"],
    missingPair,
    missingValue,
    unknown,
    duplicate,
    emptyValue,
    optionAsValue,
    bareKey,
    extraCi,
    [...deployArguments(), "--ci-run-id", "123"],
  ]) {
    assert.throws(
      () => parseReleaseArguments(args),
      `Arguments must be rejected: ${args.join(" ")}`,
    );
  }
});

test("rejects rollback as a public command instead of bypassing candidate CI", () => {
  const args = deployArguments().slice(0, -2);
  args[0] = "rollback";
  assert.throws(() => parseReleaseArguments(args));
  assert.throws(() => parseReleaseArguments(["rollback"]));
});

test("accepts only a canonical positive safe integer CI run ID", () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "+1",
    "01",
    "1e3",
    " 123",
    "123 ",
    "abc",
    "9007199254740992",
  ]) {
    const args = deployArguments();
    args[args.length - 1] = value;
    assert.throws(() => parseReleaseArguments(args), `CI run ID must be rejected: ${value}`);
  }
});

test("Salesforce configuration is an explicit deploy-only option, never raw credentials", () => {
  const args = [...deployArguments(), "--salesforce-ingestion", "enable"];
  assert.equal(parseReleaseArguments(args).values["salesforce-ingestion"], "enable");
  for (const value of ["true", "false", "disable", "secret-value"]) {
    assert.throws(() =>
      parseReleaseArguments([...deployArguments(), "--salesforce-ingestion", value]),
    );
  }
  assert.throws(() => parseReleaseArguments(["status", "--salesforce-ingestion", "enable"]));
  assert.throws(() => parseReleaseArguments([...args, "--salesforce-ingestion", "enable"]));
  assert.throws(() =>
    parseReleaseArguments([...deployArguments().slice(0, -2), "--salesforce-ingestion", "enable"]),
  );
});

test("the standalone legacy image binder rejects valid old arguments and a forged lock marker", async () => {
  const script = path.join(import.meta.dirname, "bind-production-image.mjs");
  const args = ["--expected-old-sha", sha, "--new-sha", targetSha, "--expected-image-id", imageId];
  for (const invocation of [args, ["--production-image-binding-lock-held", ...args]]) {
    const stderr = await blockedCli(script, invocation);
    assert.match(stderr, /Standalone image binding is disabled/u);
  }
});

test("direct production Compose up rejects missing or forged lock claims before production access", async () => {
  const script = path.join(import.meta.dirname, "compose-with-runtime-secret.mjs");
  const args = ["production", "up", "-d", "--no-build", "--remove-orphans"];
  for (const invocation of [args, [...args, "--production-image-binding-lock-held"]]) {
    const stderr = await blockedCli(script, invocation);
    assert.match(stderr, /Production mutations require pnpm release:production/u);
  }
});
