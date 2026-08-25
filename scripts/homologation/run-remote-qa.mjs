import { execFile, spawn } from "node:child_process";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const accountsPath = "/etc/descomplica-crm/homologation-accounts.json";
const accessPath = "/etc/descomplica-crm/homologation-access.json";
const appEnvironmentPath = "/etc/descomplica-crm/homologation.env";
const activeProxyPath = "/etc/nginx/sites-enabled/homolog.descomplicapro.com.br";
const accessLogPath = "/var/log/nginx/homolog.descomplicapro.com.br.access.log";
const firewallCommand = "/usr/local/sbin/descomplica-homologation-firewall";
const runtimeSupabaseConfigPath = path.join(runtimeRoot, "supabase/config.toml");
const versionedSupabaseConfigPath = path.join(
  repositoryRoot,
  "deploy/homologation/supabase.config.toml",
);
const origin = "https://homolog.descomplicapro.com.br";
const mailpitOrigin = "http://127.0.0.1:55324";
const appContainer = "descomplica-homologation-app";
const sessionSecretSource = "/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret";
const execFileAsync = promisify(execFile);
const officialSimulatorKeys = new Set([
  "simulator.wf13",
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
]);
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
  if (
    fileStat.uid !== 0 ||
    fileStat.gid !== 0 ||
    (fileStat.mode & 0o077) !== 0 ||
    !fileStat.isFile()
  ) {
    fail("Homologation private storage has unsafe ownership or permissions.");
  }
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail("Homologation private storage is invalid.");
  }
}

async function readRuntimeEnvironmentContract() {
  const fileStat = await stat(appEnvironmentPath);
  if (
    fileStat.uid !== 0 ||
    fileStat.gid !== 0 ||
    (fileStat.mode & 0o077) !== 0 ||
    !fileStat.isFile()
  ) {
    fail("Homologation app environment has unsafe ownership or permissions.");
  }

  const contents = await readFile(appEnvironmentPath, "utf8");
  const values = new Map();
  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(
      /^(APP_ORIGIN|AUTH_SESSION_COOKIE_SECRET_SOURCE|IMAGE_TAG|SUPABASE_URL)=(.*)$/u,
    );
    if (!match) continue;
    if (values.has(match[1])) fail("Homologation runtime configuration is duplicated.");
    values.set(match[1], match[2]);
  }

  if (
    values.get("APP_ORIGIN") !== origin ||
    values.get("SUPABASE_URL") !== "http://kong:8000" ||
    values.get("AUTH_SESSION_COOKIE_SECRET_SOURCE") !== sessionSecretSource ||
    !/^[a-f0-9]{40}$/u.test(values.get("IMAGE_TAG") ?? "")
  ) {
    fail("Homologation runtime environment contract is invalid.");
  }
  return { imageTag: values.get("IMAGE_TAG") };
}

async function captured(command, arguments_, label) {
  try {
    return await execFileAsync(command, arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: Object.fromEntries(
        ["PATH", "HOME", "DOCKER_HOST"].flatMap((name) =>
          process.env[name] ? [[name, process.env[name]]] : [],
        ),
      ),
    });
  } catch {
    fail(label);
  }
}

async function verifyRepositoryState() {
  const [{ stdout: headOutput }, { stdout: statusOutput }] = await Promise.all([
    captured("git", ["rev-parse", "HEAD"], "Homologation QA HEAD preflight failed."),
    captured(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      "Homologation QA worktree preflight failed.",
    ),
  ]);
  const head = headOutput.trim();
  if (!/^[a-f0-9]{40}$/u.test(head) || statusOutput !== "") {
    fail("Homologation QA requires a clean full-SHA checkout.");
  }
  return head;
}

async function verifySupabaseRuntimeContract() {
  let runtimeConfiguration;
  let versionedConfiguration;
  try {
    const [runtimeStat, configurations] = await Promise.all([
      stat(runtimeSupabaseConfigPath),
      Promise.all([
        readFile(runtimeSupabaseConfigPath, "utf8"),
        readFile(versionedSupabaseConfigPath, "utf8"),
      ]),
    ]);
    if (
      runtimeStat.uid !== 0 ||
      runtimeStat.gid !== 0 ||
      (runtimeStat.mode & 0o022) !== 0 ||
      !runtimeStat.isFile()
    ) {
      fail("Homologation Supabase runtime configuration is unsafe.");
    }
    [runtimeConfiguration, versionedConfiguration] = configurations;
  } catch {
    fail("Homologation Supabase runtime contract is unavailable.");
  }
  if (runtimeConfiguration !== versionedConfiguration) {
    fail("Homologation Supabase runtime differs from the checked-out release.");
  }
}

async function verifyHomologationNetworkIsolation() {
  await captured(
    firewallCommand,
    ["check"],
    "Homologation Supabase and SMTP firewall contract is unavailable.",
  );
}

function parseEnvironmentList(rawValue) {
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    fail("Homologation container environment inspection failed.");
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    fail("Homologation container environment inspection failed.");
  }
  const values = new Map();
  for (const entry of parsed) {
    const separator = entry.indexOf("=");
    if (separator < 1) fail("Homologation container environment inspection failed.");
    const key = entry.slice(0, separator);
    if (values.has(key)) fail("Homologation container environment is ambiguous.");
    values.set(key, entry.slice(separator + 1));
  }
  return values;
}

async function inspectHostedRuntime(expectedHead) {
  const [
    { stdout: environmentJson },
    { stdout: stateJson },
    { stdout: imageOutput },
    { stdout: mountsJson },
  ] = await Promise.all([
    captured(
      "docker",
      ["inspect", "--format", "{{json .Config.Env}}", appContainer],
      "Homologation container environment preflight failed.",
    ),
    captured(
      "docker",
      ["inspect", "--format", "{{json .State}}", appContainer],
      "Homologation container state preflight failed.",
    ),
    captured(
      "docker",
      ["inspect", "--format", "{{.Image}}\n{{.Config.Image}}\n{{.RestartCount}}", appContainer],
      "Homologation container image preflight failed.",
    ),
    captured(
      "docker",
      ["inspect", "--format", "{{json .Mounts}}", appContainer],
      "Homologation container mount preflight failed.",
    ),
  ]);
  const environment = parseEnvironmentList(environmentJson);
  const requiredEnvironment = new Map([
    ["APP_ORIGIN", origin],
    ["AUTH_SESSION_COOKIE_SECRET_FILE", "/run/secrets/auth_session_cookie_secret"],
    ["DEPLOYMENT_VERSION", expectedHead],
    ["HOMOLOGATION_MODE", "true"],
    ["PUBLIC_SIGNUP_ENABLED", "false"],
    ["SALESFORCE_INGEST_ENABLED", "false"],
    ["SALESFORCE_REFRESH_ENABLED", "false"],
    ["SUPABASE_URL", "http://kong:8000"],
    ["QLIK_RELAY_MODE", "off"],
    ["QLIK_RELAY_WRITE_ENABLED", "false"],
    ["COMMERCIAL_ENGINE_RUNTIME_MODE", "off"],
    ["COMMERCIAL_ENGINE_ENABLED_KEYS", ""],
  ]);
  const officialSimulatorMode = environment.get("OFFICIAL_SIMULATOR_RUNTIME_MODE");
  const officialSimulatorEnabledKeys = environment.get("OFFICIAL_SIMULATOR_ENABLED_KEYS");
  const parsedSimulatorKeys = (officialSimulatorEnabledKeys ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const simulatorContractIsValid =
    parsedSimulatorKeys.length === new Set(parsedSimulatorKeys).size &&
    parsedSimulatorKeys.every((key) => officialSimulatorKeys.has(key)) &&
    ((officialSimulatorMode === "off" && parsedSimulatorKeys.length === 0) ||
      (officialSimulatorMode === "active" && parsedSimulatorKeys.length > 0));
  if (
    [...requiredEnvironment].some(([key, value]) => environment.get(key) !== value) ||
    [...environment.keys()].some((key) => key.startsWith("NEXT_PUBLIC_")) ||
    environment.has("AUTH_SESSION_COOKIE_SECRET") ||
    officialSimulatorEnabledKeys === undefined ||
    !simulatorContractIsValid
  ) {
    fail("Homologation container runtime contract is invalid.");
  }

  let state;
  let mounts;
  try {
    state = JSON.parse(stateJson);
    mounts = JSON.parse(mountsJson);
  } catch {
    fail("Homologation container state inspection failed.");
  }
  const [imageId, imageReference, restartCountRaw, ...unexpected] = imageOutput.trim().split("\n");
  const restartCount = Number(restartCountRaw);
  const sessionSecretMounts = Array.isArray(mounts)
    ? mounts.filter((mount) => mount?.Destination === "/run/secrets/auth_session_cookie_secret")
    : [];
  if (
    unexpected.length !== 0 ||
    !/^sha256:[a-f0-9]{64}$/u.test(imageId ?? "") ||
    imageReference !== `descomplica-crm:${expectedHead}` ||
    !Number.isSafeInteger(restartCount) ||
    restartCount < 0 ||
    state?.Status !== "running" ||
    state?.Health?.Status !== "healthy" ||
    typeof state?.StartedAt !== "string" ||
    sessionSecretMounts.length !== 1 ||
    sessionSecretMounts[0]?.Source !== sessionSecretSource ||
    sessionSecretMounts[0]?.RW !== false
  ) {
    fail("Homologation container is not the expected healthy immutable release.");
  }
  return {
    imageId,
    restartCount,
    startedAt: state.StartedAt,
    officialSimulatorEnvironment: {
      OFFICIAL_SIMULATOR_RUNTIME_MODE: officialSimulatorMode,
      OFFICIAL_SIMULATOR_ENABLED_KEYS: officialSimulatorEnabledKeys,
    },
  };
}

async function verifyHostedHealth(expectedHead, access) {
  let response;
  try {
    response = await fetch(`${origin}/api/health`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${access.username}:${access.password}`).toString("base64")}`,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    fail("Homologation HTTPS health preflight failed.");
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("Homologation HTTPS health response is invalid.");
  }
  if (
    response.status !== 200 ||
    !response.headers.get("cache-control")?.includes("no-store") ||
    payload?.status !== "ok" ||
    payload?.version !== expectedHead
  ) {
    fail("Homologation HTTPS health does not match the checked-out release.");
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

function createAdminClient(apiUrl, secretKey) {
  return createClient(apiUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function verifyQaCredential(apiUrl, publishableKey, email, password) {
  const client = createClient(apiUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail("Homologation Master QA credential preflight failed.");
  const { error: signOutError } = await client.auth.signOut({ scope: "local" });
  if (signOutError) fail("Homologation Master QA credential cleanup failed.");
}

async function resolveQaUser(adminClient, email) {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) fail("Homologation QA identity preflight failed.");
  const matches = data.users.filter((user) => user.email === email);
  if (matches.length !== 1 || data.nextPage !== null) {
    fail("Homologation Master QA identity is ambiguous.");
  }
  return matches[0];
}

async function listFactorIds(adminClient, userId) {
  const { data, error } = await adminClient.auth.admin.mfa.listFactors({ userId });
  if (error) fail("Homologation MFA factor preflight failed.");
  return new Set(data.factors.map((factor) => factor.id));
}

function assertUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    fail("Homologation QA identity returned an invalid identifier.");
  }
  return value;
}

async function restoreQaIdentity(
  adminClient,
  localModule,
  database,
  user,
  originalPassword,
  originalFactorIds,
) {
  const userId = assertUuid(user.id);
  let restorationFailed = false;

  // Password restoration is attempted first. Factor and session cleanup run in
  // nested finally blocks even when an earlier administrative call fails.
  try {
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: originalPassword,
    });
    restorationFailed ||= Boolean(error);
  } catch {
    restorationFailed = true;
  } finally {
    try {
      const currentFactorIds = await listFactorIds(adminClient, userId);
      for (const factorId of currentFactorIds) {
        if (originalFactorIds.has(factorId)) continue;
        const { error } = await adminClient.auth.admin.mfa.deleteFactor({
          userId,
          id: factorId,
        });
        restorationFailed ||= Boolean(error);
      }

      const restoredFactorIds = await listFactorIds(adminClient, userId);
      restorationFailed ||=
        restoredFactorIds.size !== originalFactorIds.size ||
        [...restoredFactorIds].some((factorId) => !originalFactorIds.has(factorId));
    } catch {
      restorationFailed = true;
    } finally {
      try {
        localModule.runLocalSql(
          database,
          `begin;\ndelete from auth.sessions where user_id = '${userId}'::uuid;\ncommit;\n`,
          "hosted QA session revocation",
        );
      } catch {
        restorationFailed = true;
      }
    }
  }

  if (restorationFailed) fail("Homologation QA identity restoration failed.");
}

function mailMatchesRecipient(message, recipient) {
  return (
    message !== null &&
    typeof message === "object" &&
    typeof message.ID === "string" &&
    Array.isArray(message.To) &&
    message.To.some(
      (entry) => entry !== null && typeof entry === "object" && entry.Address === recipient,
    )
  );
}

async function purgeQaMail(recipient) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let listResponse;
    try {
      listResponse = await fetch(`${mailpitOrigin}/api/v1/messages`, {
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      fail("Homologation SMTP cleanup preflight failed.");
    }
    let payload;
    try {
      payload = await listResponse.json();
    } catch {
      fail("Homologation SMTP cleanup response is invalid.");
    }
    if (!listResponse.ok || !Array.isArray(payload?.messages)) {
      fail("Homologation SMTP cleanup response is invalid.");
    }
    const identifiers = payload.messages
      .filter((message) => mailMatchesRecipient(message, recipient))
      .map((message) => message.ID);
    if (identifiers.length === 0) return;

    let deleteResponse;
    try {
      deleteResponse = await fetch(`${mailpitOrigin}/api/v1/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: identifiers }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      fail("Homologation SMTP cleanup failed.");
    }
    if (!deleteResponse.ok) fail("Homologation SMTP cleanup failed.");
  }
  fail("Homologation SMTP cleanup proof failed.");
}

async function verifyProxyPrivacyContract() {
  const proxyStat = await stat(activeProxyPath);
  if (
    proxyStat.uid !== 0 ||
    proxyStat.gid !== 0 ||
    (proxyStat.mode & 0o022) !== 0 ||
    !proxyStat.isFile()
  ) {
    fail("Homologation proxy privacy configuration is unsafe.");
  }
  let configuration;
  try {
    configuration = await readFile(activeProxyPath, "utf8");
  } catch {
    fail("Homologation proxy privacy configuration is unavailable.");
  }
  const callbackBlocks = [
    ...configuration.matchAll(/location\s*=\s*\/auth\/callback\s*\{(?<body>[^}]*)\}/gu),
  ];
  if (
    callbackBlocks.length !== 2 ||
    callbackBlocks.some(
      (match) =>
        !/\baccess_log\s+off\s*;/u.test(match.groups?.body ?? "") ||
        !/\berror_log\s+\/dev\/null\s+crit\s*;/u.test(match.groups?.body ?? ""),
    )
  ) {
    fail("Homologation callback logging is not fail-closed.");
  }

  const logStat = await stat(accessLogPath);
  if (!logStat.isFile()) fail("Homologation access log preflight failed.");
  return { device: logStat.dev, inode: logStat.ino, offset: logStat.size };
}

async function assertHostedAccessLogSafety(snapshot) {
  const current = await stat(accessLogPath);
  if (
    current.dev !== snapshot.device ||
    current.ino !== snapshot.inode ||
    current.size < snapshot.offset
  ) {
    fail("Homologation access log rotated during callback privacy QA.");
  }
  const appendedBytes = current.size - snapshot.offset;
  if (appendedBytes > 8 * 1024 * 1024) {
    fail("Homologation access log growth exceeded the bounded QA inspection.");
  }
  if (appendedBytes === 0) return;

  const handle = await open(accessLogPath, "r");
  try {
    const appended = Buffer.alloc(Number(appendedBytes));
    const { bytesRead } = await handle.read(appended, 0, appended.length, snapshot.offset);
    if (bytesRead !== appended.length) fail("Homologation access log proof was incomplete.");
    const logTail = appended.toString("utf8");
    if (logTail.includes("/auth/callback") || /"\s+5\d{2}\s/u.test(logTail)) {
      fail("Homologation access log violated the hosted QA contract.");
    }
  } finally {
    await handle.close();
  }
}

async function assertHostedRuntimeStayedHealthy(expectedHead, before, access) {
  const after = await inspectHostedRuntime(expectedHead);
  if (
    after.imageId !== before.imageId ||
    after.restartCount !== before.restartCount ||
    after.startedAt !== before.startedAt
  ) {
    fail("Homologation container changed or restarted during hosted QA.");
  }
  await verifyHostedHealth(expectedHead, access);
}

async function assertHostedApplicationLogSafety(since) {
  const { stdout, stderr } = await captured(
    "docker",
    ["logs", "--since", since, "--tail", "10000", appContainer],
    "Homologation application log postflight failed.",
  );
  const logs = `${stdout}\n${stderr}`;
  if (
    /(?:token_hash=|\/auth\/callback\?)/iu.test(logs) ||
    /(?:uncaught exception|unhandled rejection|fatal error)/iu.test(logs)
  ) {
    fail("Homologation application logs violated the hosted QA contract.");
  }
}

async function main() {
  if (process.getuid?.() !== 0) fail("Remote homologation QA requires root.");
  process.env.HOMOLOGATION_MODE = "true";
  process.env.QA_SUPABASE_WORKDIR = runtimeRoot;

  const head = await verifyRepositoryState();
  const [accountsPayload, access, runtimeEnvironment, localModule] = await Promise.all([
    readPrivateJson(accountsPath),
    readPrivateJson(accessPath),
    readRuntimeEnvironmentContract(),
    import("../qa/local-authenticated-visual.mjs"),
  ]);
  await verifySupabaseRuntimeContract();
  await verifyHomologationNetworkIsolation();
  if (runtimeEnvironment.imageTag !== head) {
    fail("Homologation private runtime does not match the checked-out release.");
  }
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
    !/^[^:\p{Cc}]{1,128}$/u.test(access.username) ||
    typeof access.password !== "string" ||
    access.password.length < 20 ||
    access.password.length > 256 ||
    /\p{Cc}/u.test(access.password)
  ) {
    fail("Homologation Basic Auth material is invalid.");
  }

  const local = await localModule.discoverLocalSupabase();
  const master = accountsPayload.accounts.find((account) => account.role === "master");
  const hostedRuntime = await inspectHostedRuntime(head);
  const officialSimulatorEnvironment = hostedRuntime.officialSimulatorEnvironment;
  await verifyHostedHealth(head, access);
  const adminClient = createAdminClient(local.apiUrl, local.secretKey);
  await verifyQaCredential(local.apiUrl, local.publishableKey, master.email, master.password);
  const masterUser = await resolveQaUser(adminClient, master.email);
  const originalFactorIds = await listFactorIds(adminClient, masterUser.id);
  if (originalFactorIds.size !== 0) {
    fail("Dedicated Master QA identity must start without enrolled MFA factors.");
  }
  await purgeQaMail(master.email);
  const callbackLogSnapshot = await verifyProxyPrivacyContract();
  const applicationLogSince = new Date(Date.now() - 1_000).toISOString();
  const sharedEnvironment = {
    ...process.env,
    HOMOLOGATION_MODE: "true",
    QA_SUPABASE_WORKDIR: runtimeRoot,
    ...officialSimulatorEnvironment,
  };

  let qaFailure;
  let cleanupFailed = false;
  try {
    await run("pnpm", ["exec", "playwright", "test", "e2e/release-candidate.spec.ts"], {
      ...sharedEnvironment,
      QA_E2E_REMOTE_HOMOLOGATION: "true",
      QA_E2E_ORIGIN: origin,
      QA_E2E_MAILPIT_ORIGIN: mailpitOrigin,
      QA_E2E_BASIC_AUTH_USERNAME: access.username,
      QA_E2E_BASIC_AUTH_PASSWORD: access.password,
      QA_E2E_ACCOUNTS: JSON.stringify(accountsPayload.accounts),
    });
  } catch (error) {
    qaFailure = error;
  } finally {
    try {
      await restoreQaIdentity(
        adminClient,
        localModule,
        local.database,
        masterUser,
        master.password,
        originalFactorIds,
      );
      await verifyQaCredential(local.apiUrl, local.publishableKey, master.email, master.password);
    } catch {
      cleanupFailed = true;
    }
    try {
      await purgeQaMail(master.email);
    } catch {
      cleanupFailed = true;
    }
    try {
      await assertHostedAccessLogSafety(callbackLogSnapshot);
    } catch {
      cleanupFailed = true;
    }
  }

  if (!qaFailure && !cleanupFailed) {
    try {
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
    } catch (error) {
      qaFailure = error;
    }
  }

  let postflightFailed = false;
  try {
    await assertHostedAccessLogSafety(callbackLogSnapshot);
  } catch {
    postflightFailed = true;
  }
  try {
    await assertHostedRuntimeStayedHealthy(head, hostedRuntime, access);
  } catch {
    postflightFailed = true;
  }
  try {
    await assertHostedApplicationLogSafety(applicationLogSince);
  } catch {
    postflightFailed = true;
  }
  try {
    if ((await verifyRepositoryState()) !== head) postflightFailed = true;
  } catch {
    postflightFailed = true;
  }
  if (cleanupFailed) fail("Homologation hosted QA cleanup failed.");
  if (postflightFailed) fail("Homologation hosted QA postflight failed.");
  if (qaFailure) throw qaFailure;

  process.stdout.write("Remote homologation QA passed; secrets=not-printed.\n");
}

try {
  await main();
} catch {
  process.stderr.write("Remote homologation QA failed; secrets=not-printed.\n");
  process.exitCode = 1;
}
