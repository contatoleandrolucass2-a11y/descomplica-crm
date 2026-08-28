import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repository = "descomplica-crm";
const dockerEnvironment = {
  DOCKER_HOST: "unix:///var/run/docker.sock",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
};

async function git(...arguments_) {
  const { stdout } = await execFileAsync("/usr/bin/git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: dockerEnvironment,
  });
  return stdout.trim();
}

function run(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: dockerEnvironment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? code ?? "unknown"}).`));
    });
  });
}

async function main() {
  const head = await git("rev-parse", "HEAD");
  const imageTag = process.env.IMAGE_TAG?.trim() || head;
  if (!/^[a-f0-9]{40}$/.test(imageTag) || imageTag !== head) {
    throw new Error("IMAGE_TAG must equal the current full Git SHA.");
  }
  if (await git("status", "--porcelain=v1")) {
    throw new Error("Worktree must be clean before building the release image.");
  }

  const image = `${repository}:${imageTag}`;
  await run("/usr/bin/docker", [
    "build",
    "--pull",
    "--build-arg",
    `DEPLOYMENT_VERSION=${imageTag}`,
    "--label",
    `org.opencontainers.image.revision=${imageTag}`,
    "--tag",
    image,
    ".",
  ]);

  const { stdout } = await execFileAsync(
    "/usr/bin/docker",
    ["image", "inspect", "--format", "{{.Id}}", image],
    { cwd: repositoryRoot, encoding: "utf8", env: dockerEnvironment },
  );
  const imageId = stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    throw new Error("Docker did not return an immutable image ID.");
  }
  process.stdout.write(`${JSON.stringify({ image, imageId, revision: imageTag })}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Image build failed."}\n`);
  process.exitCode = 1;
}
