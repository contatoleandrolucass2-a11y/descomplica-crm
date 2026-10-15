import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const image = "public.ecr.aws/supabase/postgres:17.6.1.159";
const expectedPlans = [116, 8];
const expectedAssertions = expectedPlans.reduce((sum, count) => sum + count, 0);
const fixture = "tests/fixtures/compact-user-access/rehearsal.sql";
const invocationId = randomUUID();
const container = `descomplica-compact-users-${invocationId}`;
const database = `compact_users_${invocationId.replaceAll("-", "")}`;
const ownershipLabel = "com.descomplica.qa.compact-user-access";
const cancellation = new AbortController();
const startedAt = Date.now();
let environment = Object.fromEntries(
  ["PATH", "HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "TMPDIR"].flatMap((name) =>
    process.env[name] ? [[name, process.env[name]]] : [],
  ),
);
let createAttempted = false;
let containerRemoved = false;
let result;
let failure;

// Do not forward application environment variables, database URLs or keys.
// Docker is pinned to a verified local Unix socket before any mutation.
environment = { ...environment, NO_COLOR: "1", TZ: "UTC" };

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => cancellation.abort(new Error(`Interrupted by ${signal}.`)));
}

async function docker(args, { cleanup = false, timeout = 60_000 } = {}) {
  if (!cleanup) cancellation.signal.throwIfAborted();
  const { stdout } = await execute("docker", args, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout,
    ...(cleanup ? {} : { signal: cancellation.signal }),
  });
  return stdout;
}

async function pinLocalDocker() {
  let endpoint = process.env.DOCKER_HOST?.trim();
  if (!endpoint) {
    const context = (await docker(["context", "show"])).trim();
    if (!context) throw new Error("Docker did not return a local context.");
    endpoint = (
      await docker([
        "context",
        "inspect",
        context,
        "--format",
        '{{(index .Endpoints "docker").Host}}',
      ])
    ).trim();
  }
  const url = new URL(endpoint);
  if (
    url.protocol !== "unix:" ||
    url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Compact authorization tests require a local Docker Unix socket.");
  }
  const socket = decodeURIComponent(url.pathname);
  if (!path.isAbsolute(socket) || !(await stat(socket)).isSocket()) {
    throw new Error("The local Docker endpoint is not an absolute Unix socket.");
  }
  environment = { ...environment, DOCKER_HOST: endpoint };
  await docker(["version", "--format", "{{.Server.Version}}"]);
}

async function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    cancellation.signal.throwIfAborted();
    try {
      // The image initializes through a temporary Unix-socket-only server and
      // then restarts PostgreSQL. TCP becomes available only on the final server.
      await docker(
        ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres"],
        { timeout: 5_000 },
      );
      return;
    } catch {
      cancellation.signal.throwIfAborted();
      await delay(500, undefined, { signal: cancellation.signal });
    }
  }
  throw new Error("The isolated PostgreSQL container did not become ready within 60 seconds.");
}

function verifyTap(output) {
  const plans = [...output.matchAll(/^1\.\.(\d+)\s*$/gm)];
  const assertions = [...output.matchAll(/^(ok|not ok) (\d+)\b.*$/gm)];
  if (
    plans.length !== expectedPlans.length ||
    assertions.length !== expectedAssertions ||
    plans.some((plan, planIndex) => {
      const suite = assertions.filter(
        (assertion) =>
          assertion.index > plan.index &&
          assertion.index < (plans[planIndex + 1]?.index ?? output.length),
      );
      return (
        Number(plan[1]) !== expectedPlans[planIndex] ||
        suite.length !== expectedPlans[planIndex] ||
        suite.some(
          (assertion, index) => assertion[1] !== "ok" || Number(assertion[2]) !== index + 1,
        )
      );
    }) ||
    /^Bail out!/im.test(output) ||
    /(?:^|\n)(?:psql:[^\n]*\s)?(?:ERROR|FATAL):/m.test(output)
  ) {
    const failures = output
      .split("\n")
      .filter((line) => /^(?:not ok|#|Bail out!)/i.test(line))
      .slice(0, 8)
      .join("\n");
    throw new Error(
      `Expected exactly ${expectedAssertions} passing compact pgTAP assertions; received ${assertions.length}.${failures ? `\n${failures}` : ""}`,
    );
  }
  return assertions.length;
}

async function cleanupContainer() {
  if (!createAttempted) return;
  // Discover only this invocation's unique resource. Never prune containers,
  // volumes, networks or other concurrently running database tests.
  const ownedContainers = (
    await docker(["ps", "-aq", "--filter", `label=${ownershipLabel}=${invocationId}`], {
      cleanup: true,
      timeout: 15_000,
    })
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  if (ownedContainers.length > 1) {
    throw new Error(
      "Unexpected duplicate compact-test ownership labels; automatic cleanup stopped.",
    );
  }
  if (ownedContainers.length === 1) {
    await docker(["rm", "--force", "--volumes", ownedContainers[0]], {
      cleanup: true,
      timeout: 30_000,
    });
  }
  containerRemoved = true;
}

try {
  await pinLocalDocker();
  await stat(path.join(repositoryRoot, fixture));
  createAttempted = true;
  await docker(
    [
      "run",
      "--detach",
      "--name",
      container,
      "--label",
      `${ownershipLabel}=${invocationId}`,
      "--network",
      "none",
      "--mount",
      `type=bind,source=${repositoryRoot},target=/work,readonly`,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      image,
    ],
    { timeout: 300_000 },
  );
  const [inspection] = JSON.parse(await docker(["inspect", container]));
  const mountedRepository = inspection.Mounts.find((mount) => mount.Destination === "/work");
  if (
    inspection.HostConfig.NetworkMode !== "none" ||
    Object.keys(inspection.HostConfig.PortBindings ?? {}).length !== 0 ||
    mountedRepository?.RW !== false ||
    mountedRepository.Source !== repositoryRoot
  ) {
    throw new Error("The compact-test container does not satisfy the required isolation.");
  }
  await waitForPostgres();
  await docker([
    "exec",
    container,
    "createdb",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "--template=template0",
    database,
  ]);
  const output = await docker([
    "exec",
    container,
    "psql",
    "-X",
    "-qAt",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    database,
    "-f",
    `/work/${fixture}`,
  ]);
  result = {
    status: "passed",
    image,
    assertions: verifyTap(output),
    expectedAssertions,
    failedAssertions: 0,
    network: "none",
    publishedPorts: 0,
    repositoryReadOnly: true,
    fixture,
  };
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanupContainer();
  } catch (error) {
    failure = new Error(`${failure ? `${failure.message}\n` : ""}Cleanup failed: ${error.message}`);
  }
}

if (failure) {
  // Only synthetic fixture diagnostics are printed. Do not dump command
  // environments, Docker inspect payloads or any application configuration.
  const error = String(failure.stderr || failure.message)
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"']+/gi, "[redacted-database-url]")
    .split("\n")
    .slice(-8)
    .join("\n")
    .slice(-1_500);
  console.error(
    JSON.stringify({
      status: "failed",
      error,
      containerRemoved,
      durationMs: Date.now() - startedAt,
    }),
  );
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ...result, containerRemoved, durationMs: Date.now() - startedAt }));
}
