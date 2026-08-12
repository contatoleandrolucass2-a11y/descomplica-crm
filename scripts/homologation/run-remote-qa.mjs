import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const accountsPath = "/etc/descomplica-crm/homologation-accounts.json";
const accessPath = "/etc/descomplica-crm/homologation-access.json";
const origin = "https://homolog.descomplicapro.com.br";
const roles = new Set([
  "master",
  "admin",
  "manager",
  "broker",
  "coordinator",
  "real_estate",
  "house",
  "partnership_channel",
  "pending",
]);

function fail(message) {
  throw new Error(message);
}

async function readPrivateJson(file) {
  const fileStat = await stat(file);
  if ((fileStat.mode & 0o077) !== 0) fail("Homologation private storage has unsafe permissions.");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail("Homologation private storage is invalid.");
  }
}

async function run(command, arguments_, environment) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error("Homologation QA child process failed."));
    });
  });
}

async function main() {
  if (process.getuid?.() !== 0) fail("Remote homologation QA requires root.");
  process.env.HOMOLOGATION_MODE = "true";
  process.env.QA_SUPABASE_WORKDIR = runtimeRoot;

  const [accountsPayload, access, localModule] = await Promise.all([
    readPrivateJson(accountsPath),
    readPrivateJson(accessPath),
    import("../qa/local-authenticated-visual.mjs"),
  ]);
  if (
    accountsPayload?.environment !== "isolated-homologation" ||
    accountsPayload?.dataClassification !== "synthetic-only" ||
    !Array.isArray(accountsPayload.accounts) ||
    accountsPayload.accounts.length !== roles.size ||
    new Set(accountsPayload.accounts.map((account) => account?.role)).size !== roles.size ||
    [...roles].some(
      (role) => !accountsPayload.accounts.some((account) => account?.role === role),
    ) ||
    accountsPayload.accounts.some(
      (account) =>
        typeof account?.email !== "string" ||
        !/^qa\.rls-[a-z_]+-[a-f0-9]+@local\.invalid$/.test(account.email) ||
        typeof account?.password !== "string" ||
        account.password.length < 20,
    ) ||
    typeof accountsPayload.visualSourceMarker !== "string"
  ) {
    fail("Homologation synthetic account matrix is incomplete.");
  }
  if (
    access?.environment !== "isolated-homologation" ||
    access?.origin !== origin ||
    typeof access.username !== "string" ||
    typeof access.password !== "string"
  ) {
    fail("Homologation Basic Auth material is invalid.");
  }

  const local = await localModule.discoverLocalSupabase();
  const master = accountsPayload.accounts.find((account) => account.role === "master");
  const sharedEnvironment = {
    ...process.env,
    HOMOLOGATION_MODE: "true",
    QA_SUPABASE_WORKDIR: runtimeRoot,
  };

  await run("pnpm", ["exec", "playwright", "test", "e2e/release-candidate.spec.ts"], {
    ...sharedEnvironment,
    QA_E2E_REMOTE_HOMOLOGATION: "true",
    QA_E2E_ORIGIN: origin,
    QA_E2E_BASIC_AUTH_USERNAME: access.username,
    QA_E2E_BASIC_AUTH_PASSWORD: access.password,
    QA_E2E_ACCOUNTS: JSON.stringify(accountsPayload.accounts),
  });

  await run("node", ["scripts/qa/authenticated-visual.mjs"], {
    ...sharedEnvironment,
    QA_AUTH_REMOTE_HOMOLOGATION: "true",
    QA_AUTH_ORIGIN: origin,
    QA_AUTH_BASIC_USERNAME: access.username,
    QA_AUTH_BASIC_PASSWORD: access.password,
    QA_AUTH_EMAIL: master.email,
    QA_AUTH_PASSWORD: master.password,
    QA_AUTH_SUPABASE_URL: local.apiUrl,
    QA_AUTH_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    QA_AUTH_FIXTURE_VERIFICATION: "rls-marker-v1",
    QA_AUTH_EXPECTED_SOURCE_MARKER: accountsPayload.visualSourceMarker,
  });

  process.stdout.write("Remote homologation QA passed; secrets=not-printed.\n");
}

try {
  await main();
} catch {
  process.stderr.write("Remote homologation QA failed; secrets=not-printed.\n");
  process.exitCode = 1;
}
