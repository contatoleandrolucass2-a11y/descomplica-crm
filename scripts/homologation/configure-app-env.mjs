import { execFile } from "node:child_process";
import { chmod, rename, rm, writeFile } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const destination = "/etc/descomplica-crm/homologation.env";

function extractSingleJsonObject(stdout) {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  const objects = [];

  for (let index = 0; index < stdout.length; index += 1) {
    const character = stdout[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) objects.push(stdout.slice(start, index + 1));
    }
  }

  if (objects.length !== 1 || depth !== 0 || quoted) {
    throw new Error("Supabase status JSON is unavailable or ambiguous.");
  }
  const candidate = objects[0];
  const parsed = JSON.parse(candidate);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Supabase status JSON is invalid.");
  }
  return parsed;
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error("App environment configuration requires root.");
  const imageTag = process.env.IMAGE_TAG;
  if (!/^[0-9a-f]{7,64}$/.test(imageTag ?? "")) {
    throw new Error("IMAGE_TAG must be an immutable Git SHA.");
  }

  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "supabase", "status", "--output", "json", "--workdir", runtimeRoot],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      env: Object.fromEntries(
        ["PATH", "HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "DOCKER_HOST"].flatMap((name) =>
          process.env[name] ? [[name, process.env[name]]] : [],
        ),
      ),
    },
  );
  const status = extractSingleJsonObject(stdout);
  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (typeof publishableKey !== "string" || !/^[A-Za-z0-9._-]{20,2048}$/.test(publishableKey)) {
    throw new Error("Supabase publishable key is unavailable.");
  }

  const temporary = `${destination}.tmp-${process.pid}`;
  const contents = [
    `IMAGE_TAG=${imageTag}`,
    "NEXT_PUBLIC_SUPABASE_URL=http://kong:8000",
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    "APP_ORIGIN=https://homolog.descomplicapro.com.br",
    "",
  ].join("\n");
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  process.stdout.write("Homologation app environment configured: secrets=not-printed\n");
}

try {
  await main();
} catch {
  process.stderr.write("Homologation app environment failed; no diagnostic secrets emitted.\n");
  process.exitCode = 1;
}
