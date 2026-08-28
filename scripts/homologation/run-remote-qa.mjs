import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import legalDocumentVersions from "../../lib/legal/versions.json" with { type: "json" };

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const accountsPath = "/etc/descomplica-crm/homologation-accounts.json";
const accessPath = "/etc/descomplica-crm/homologation-access.json";
const appEnvironmentPath = "/etc/descomplica-crm/homologation.env";
const activeProxyPath = "/etc/nginx/sites-enabled/homolog.descomplicapro.com.br";
const accessLogPath = "/var/log/nginx/homolog.descomplicapro.com.br.access.log";
const errorLogPath = "/var/log/nginx/homolog.descomplicapro.com.br.error.log";
const dockerSocketPath = "/var/run/docker.sock";
const dockerSocketUri = `unix://${dockerSocketPath}`;
const dockerCommand = "/usr/bin/docker";
const firewallCommand = "/usr/local/sbin/descomplica-homologation-firewall";
const runtimeSupabaseConfigPath = path.join(runtimeRoot, "supabase/config.toml");
const runtimeRecoveryTemplatePath = path.join(runtimeRoot, "supabase/templates/recovery.html");
const runtimeManifestPath = path.join(runtimeRoot, "manifest.json");
const versionedSupabaseConfigPath = path.join(
  repositoryRoot,
  "deploy/homologation/supabase.config.toml",
);
const versionedRecoveryTemplatePath = path.join(repositoryRoot, "supabase/templates/recovery.html");
const origin = "https://homolog.descomplicapro.com.br";
const mailpitOrigin = "http://127.0.0.1:55324";
const appContainer = "descomplica-homologation-app";
const sessionSecretSource = "/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret";
const inventorySecretSource = "/etc/descomplica-crm/secrets/homologation-inventory-source-auth";
const execFileAsync = promisify(execFile);
const commandEnvironment = Object.freeze({
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
});
const officialSimulatorKeys = new Set([
  "simulator.wf13",
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
]);
const legacyMigrationModules = new Set([
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
  "simulator.tabelao",
  "dialer",
  "dialer.weekend-forecast",
]);
const requiredRoles = Object.freeze([
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
const activeChildren = new Set();
let requestedSignal = null;

function fail(message) {
  throw new Error(message);
}

function throwIfInterrupted() {
  if (requestedSignal) fail(`Homologation QA interrupted by ${requestedSignal}.`);
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
      /^(APP_ORIGIN|AUTH_SESSION_COOKIE_SECRET_SOURCE|CRM_INVENTORY_SOURCE_AUTH_SOURCE|IMAGE_TAG|SUPABASE_URL|LEGACY_MIGRATION_RUNTIME_MODE|LEGACY_MIGRATION_ENABLED_MODULES)=(.*)$/u,
    );
    if (!match) continue;
    if (values.has(match[1])) fail("Homologation runtime configuration is duplicated.");
    values.set(match[1], match[2]);
  }

  if (
    values.get("APP_ORIGIN") !== origin ||
    values.get("SUPABASE_URL") !== "http://kong:8000" ||
    values.get("AUTH_SESSION_COOKIE_SECRET_SOURCE") !== sessionSecretSource ||
    values.get("CRM_INVENTORY_SOURCE_AUTH_SOURCE") !== inventorySecretSource ||
    !/^[a-f0-9]{40}$/u.test(values.get("IMAGE_TAG") ?? "")
  ) {
    fail("Homologation runtime environment contract is invalid.");
  }
  return {
    imageTag: values.get("IMAGE_TAG"),
    legacyMigrationMode: values.get("LEGACY_MIGRATION_RUNTIME_MODE"),
    legacyMigrationModules: values.get("LEGACY_MIGRATION_ENABLED_MODULES"),
  };
}

async function captured(command, arguments_, label) {
  try {
    return await execFileAsync(command, arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: commandEnvironment,
    });
  } catch {
    fail(label);
  }
}

async function verifyLocalDockerSocket() {
  let metadata;
  try {
    metadata = await lstat(dockerSocketPath);
  } catch {
    fail("Homologation QA local Docker socket is unavailable.");
  }
  if (metadata.uid !== 0 || (metadata.mode & 0o007) !== 0 || !metadata.isSocket()) {
    fail("Homologation QA local Docker socket is unsafe.");
  }
}

async function capturedDocker(arguments_, label) {
  return captured(dockerCommand, ["--host", dockerSocketUri, ...arguments_], label);
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
  let runtimeRecoveryTemplate;
  let versionedRecoveryTemplate;
  try {
    const [runtimeStats, configurations] = await Promise.all([
      Promise.all([stat(runtimeSupabaseConfigPath), stat(runtimeRecoveryTemplatePath)]),
      Promise.all([
        readFile(runtimeSupabaseConfigPath, "utf8"),
        readFile(versionedSupabaseConfigPath, "utf8"),
        readFile(runtimeRecoveryTemplatePath, "utf8"),
        readFile(versionedRecoveryTemplatePath, "utf8"),
      ]),
    ]);
    if (
      runtimeStats.some(
        (runtimeStat) =>
          runtimeStat.uid !== 0 ||
          runtimeStat.gid !== 0 ||
          (runtimeStat.mode & 0o022) !== 0 ||
          !runtimeStat.isFile(),
      )
    ) {
      fail("Homologation Supabase runtime configuration is unsafe.");
    }
    [
      runtimeConfiguration,
      versionedConfiguration,
      runtimeRecoveryTemplate,
      versionedRecoveryTemplate,
    ] = configurations;
  } catch {
    fail("Homologation Supabase runtime contract is unavailable.");
  }
  if (
    runtimeConfiguration !== versionedConfiguration ||
    runtimeRecoveryTemplate !== versionedRecoveryTemplate
  ) {
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
    capturedDocker(
      ["inspect", "--format", "{{json .Config.Env}}", appContainer],
      "Homologation container environment preflight failed.",
    ),
    capturedDocker(
      ["inspect", "--format", "{{json .State}}", appContainer],
      "Homologation container state preflight failed.",
    ),
    capturedDocker(
      ["inspect", "--format", "{{.Image}}\n{{.Config.Image}}\n{{.RestartCount}}", appContainer],
      "Homologation container image preflight failed.",
    ),
    capturedDocker(
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
    ["LEGACY_MIGRATION_RUNTIME_MODE", "active"],
    ["CRM_INVENTORY_RUNTIME_MODE", "off"],
    ["CRM_INVENTORY_SOURCE_AUTH_FILE", "/run/secrets/inventory_source_auth"],
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
  const legacyMigrationMode = environment.get("LEGACY_MIGRATION_RUNTIME_MODE");
  const legacyMigrationEnabledModules = environment.get("LEGACY_MIGRATION_ENABLED_MODULES");
  const parsedLegacyModules = (legacyMigrationEnabledModules ?? "")
    .split(",")
    .map((module) => module.trim())
    .filter(Boolean);
  const legacyMigrationContractIsValid =
    legacyMigrationMode === "active" &&
    parsedLegacyModules.length === legacyMigrationModules.size &&
    parsedLegacyModules.length === new Set(parsedLegacyModules).size &&
    parsedLegacyModules.every((module) => legacyMigrationModules.has(module));
  if (
    [...requiredEnvironment].some(([key, value]) => environment.get(key) !== value) ||
    [...environment.keys()].some((key) => key.startsWith("NEXT_PUBLIC_")) ||
    environment.has("AUTH_SESSION_COOKIE_SECRET") ||
    officialSimulatorEnabledKeys === undefined ||
    !simulatorContractIsValid ||
    !legacyMigrationContractIsValid
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
  const inventorySecretMounts = Array.isArray(mounts)
    ? mounts.filter((mount) => mount?.Destination === "/run/secrets/inventory_source_auth")
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
    sessionSecretMounts[0]?.RW !== false ||
    inventorySecretMounts.length !== 1 ||
    inventorySecretMounts[0]?.Source !== inventorySecretSource ||
    inventorySecretMounts[0]?.RW !== false
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
    legacyMigrationEnvironment: {
      LEGACY_MIGRATION_RUNTIME_MODE: legacyMigrationMode,
      LEGACY_MIGRATION_ENABLED_MODULES: legacyMigrationEnabledModules,
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
    activeChildren.add(child);
    child.once("error", (error) => {
      activeChildren.delete(child);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      activeChildren.delete(child);
      if (code === 0 && signal === null) resolve();
      else reject(new Error("Homologation QA child process failed."));
    });
  });
}

async function verifyAuthMfaAndLegacyCanaryMigrationContracts(expectedHead) {
  await run(
    "pnpm",
    ["homologation:migrate:legacy-canary", "verify", "--expected-sha", expectedHead],
    process.env,
  );
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
  const matches = [];
  const perPage = 100;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !Array.isArray(data?.users)) {
      fail("Homologation QA identity preflight failed.");
    }
    matches.push(...data.users.filter((user) => user.email === email));
    if (data.users.length < perPage || data.nextPage === null) break;
    if (page === 100) fail("Homologation QA identity preflight was incomplete.");
  }
  if (matches.length !== 1) fail("Homologation Master QA identity is ambiguous.");
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

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(assertUuid(value))}::uuid`;
}

function sqlUuidArray(values) {
  return `array[${values.map(sqlUuid).join(", ")}]::uuid[]`;
}

function assertCompleteEphemeralMatrix(accounts) {
  if (
    accounts.length !== requiredRoles.length ||
    new Set(accounts.map((account) => account.id)).size !== requiredRoles.length ||
    new Set(accounts.map((account) => account.email)).size !== requiredRoles.length ||
    new Set(accounts.map((account) => account.role)).size !== requiredRoles.length ||
    requiredRoles.some((role) => !accounts.some((account) => account.role === role))
  ) {
    fail("Homologation ephemeral QA identity matrix is incomplete.");
  }
}

async function createEphemeralAccount(adminClient, role, runId) {
  const email = `qa.rls-${role}-${runId}@local.invalid`;
  const password = `${randomBytes(36).toString("base64url")}aA1!`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { qa_ephemeral: true, qa_run_id: runId },
    user_metadata: {
      legal_acceptance: {
        termsAccepted: true,
        termsVersion: legalDocumentVersions.terms,
        privacyAccepted: true,
        privacyVersion: legalDocumentVersions.privacy,
      },
    },
  });
  if (error || !data.user) fail("Homologation ephemeral QA identity creation failed.");
  return { id: assertUuid(data.user.id), role, email, password };
}

function ephemeralMatrixSetupSql(accounts, persistentMaster, runId) {
  assertCompleteEphemeralMatrix(accounts);
  const persistentMasterId = sqlUuid(persistentMaster.id);
  const expectedValues = accounts
    .map((account) => `(${sqlUuid(account.id)}, ${sqlLiteral(account.role)})`)
    .join(",\n  ");
  const brokerPersonKey = `qa-hosted-${runId}-broker`;
  const brokerScopeKey = `qa-hosted-${runId}-broker-scope`;

  return `
begin;

select pg_advisory_xact_lock(hashtextextended('descomplica-hosted-ephemeral-qa', 0));

create temporary table qa_ephemeral_expected (
  user_id uuid primary key,
  role_key text not null unique
) on commit drop;

insert into qa_ephemeral_expected (user_id, role_key) values
  ${expectedValues};

do $qa_preflight$
begin
  if (
    select count(*)
    from public.user_roles user_role
    join public.profiles profile on profile.user_id = user_role.user_id
    where user_role.user_id = ${persistentMasterId}
      and user_role.role_key = 'master'
      and profile.is_active
      and profile.profile_completed
      and profile.access_status = 'approved'
      and private.user_role_scope_is_valid(user_role.user_id, user_role.role_key)
  ) <> 1 or (select count(*) from public.user_roles where role_key = 'master') <> 1 then
    raise exception 'persistent visual Master preflight failed';
  end if;

  if (select count(*) from qa_ephemeral_expected) <> 9
     or exists (
       select 1
       from qa_ephemeral_expected expected
       left join auth.users auth_user on auth_user.id = expected.user_id
       left join public.profiles profile on profile.user_id = expected.user_id
       left join public.user_roles user_role on user_role.user_id = expected.user_id
       where auth_user.id is null
          or auth_user.raw_app_meta_data ->> 'qa_ephemeral' is distinct from 'true'
          or auth_user.raw_app_meta_data ->> 'qa_run_id' is distinct from ${sqlLiteral(runId)}
          or profile.user_id is null
          or profile.is_active
          or profile.profile_completed
          or profile.access_status <> 'pending'
          or user_role.role_key <> 'pending'
     )
     or exists (
       select 1 from public.crm_user_reporting_scope_grants
       where user_id = any(array(select user_id from qa_ephemeral_expected))
     )
     or exists (
       select 1 from public.user_permission_overrides
       where user_id = any(array(select user_id from qa_ephemeral_expected))
     ) then
    raise exception 'ephemeral identity preflight failed';
  end if;

  if not exists (
       select 1 from public.crm_reporting_scopes
       where scope_type = 'global' and is_active
     ) or not exists (
       select 1
       from public.crm_reporting_scopes reporting_scope
       join public.crm_organizations organization
         on organization.id = reporting_scope.organization_id
        and organization.is_active
       where reporting_scope.scope_type = 'organization'
         and reporting_scope.is_active
     ) or not exists (
       select 1
       from public.crm_reporting_scopes reporting_scope
       join public.crm_organizations organization
         on organization.id = reporting_scope.organization_id
        and organization.is_active
       where reporting_scope.scope_type = 'organization'
         and reporting_scope.is_active
         and organization.kind = 'real_estate'
     ) or not exists (
       select 1
       from public.crm_reporting_scopes reporting_scope
       join public.crm_organizations organization
         on organization.id = reporting_scope.organization_id
        and organization.is_active
       where reporting_scope.scope_type = 'organization'
         and reporting_scope.is_active
         and organization.kind = 'house'
     ) or not exists (
       select 1
       from public.crm_reporting_scopes reporting_scope
       join public.crm_teams team on team.id = reporting_scope.team_id and team.is_active
       join public.crm_organizations organization
         on organization.id = team.organization_id
        and organization.is_active
       where reporting_scope.scope_type = 'team' and reporting_scope.is_active
     ) or not exists (
       select 1
       from public.crm_reporting_scopes reporting_scope
       join public.crm_portfolios portfolio
         on portfolio.id = reporting_scope.portfolio_id
        and portfolio.is_active
       where reporting_scope.scope_type = 'portfolio'
         and reporting_scope.is_active
         and portfolio.kind = 'partnership'
     ) then
    raise exception 'compatible hosted reporting scopes are unavailable';
  end if;
end
$qa_preflight$;

update public.profiles
set is_active = false,
    access_status = 'pending'
where user_id = ${persistentMasterId};

update public.user_roles
set role_key = 'pending'
where user_id = ${persistentMasterId};

update public.user_roles user_role
set role_key = expected.role_key,
    assigned_by = ${persistentMasterId}
from qa_ephemeral_expected expected
where user_role.user_id = expected.user_id;

insert into public.crm_people (person_key, display_name, auth_user_id)
select
  ${sqlLiteral(brokerPersonKey)},
  'Synthetic hosted QA broker',
  expected.user_id
from qa_ephemeral_expected expected
where expected.role_key = 'broker';

insert into public.crm_team_memberships (team_id, person_id, membership_role, valid_from)
select team.id, person.id, 'broker', now() - interval '1 minute'
from public.crm_people person
cross join lateral (
  select candidate.id
  from public.crm_teams candidate
  join public.crm_organizations organization
    on organization.id = candidate.organization_id
   and organization.is_active
  where candidate.is_active
  order by candidate.id
  limit 1
) team
where person.person_key = ${sqlLiteral(brokerPersonKey)};

insert into public.crm_reporting_scopes (scope_key, scope_type, person_id)
select ${sqlLiteral(brokerScopeKey)}, 'person', person.id
from public.crm_people person
where person.person_key = ${sqlLiteral(brokerPersonKey)};

with target_scopes as (
  select
    expected.user_id,
    expected.role_key,
    case expected.role_key
      when 'master' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        where reporting_scope.scope_type = 'global' and reporting_scope.is_active
        order by reporting_scope.id
        limit 1
      )
      when 'admin' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_organizations organization
          on organization.id = reporting_scope.organization_id
         and organization.is_active
        where reporting_scope.scope_type = 'organization' and reporting_scope.is_active
        order by reporting_scope.id
        limit 1
      )
      when 'manager' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_teams team on team.id = reporting_scope.team_id and team.is_active
        join public.crm_organizations organization
          on organization.id = team.organization_id
         and organization.is_active
        where reporting_scope.scope_type = 'team' and reporting_scope.is_active
        order by reporting_scope.id
        limit 1
      )
      when 'broker' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        where reporting_scope.scope_key = ${sqlLiteral(brokerScopeKey)}
      )
      when 'coordinator' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_portfolios portfolio
          on portfolio.id = reporting_scope.portfolio_id
         and portfolio.is_active
        where reporting_scope.scope_type = 'portfolio'
          and reporting_scope.is_active
          and portfolio.kind = 'partnership'
        order by reporting_scope.id
        limit 1
      )
      when 'real_estate' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_organizations organization
          on organization.id = reporting_scope.organization_id
         and organization.is_active
        where reporting_scope.scope_type = 'organization'
          and reporting_scope.is_active
          and organization.kind = 'real_estate'
        order by reporting_scope.id
        limit 1
      )
      when 'house' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_organizations organization
          on organization.id = reporting_scope.organization_id
         and organization.is_active
        where reporting_scope.scope_type = 'organization'
          and reporting_scope.is_active
          and organization.kind = 'house'
        order by reporting_scope.id
        limit 1
      )
      when 'partnership_channel' then (
        select reporting_scope.id
        from public.crm_reporting_scopes reporting_scope
        join public.crm_portfolios portfolio
          on portfolio.id = reporting_scope.portfolio_id
         and portfolio.is_active
        where reporting_scope.scope_type = 'portfolio'
          and reporting_scope.is_active
          and portfolio.kind = 'partnership'
        order by reporting_scope.id
        limit 1
      )
    end as reporting_scope_id
  from qa_ephemeral_expected expected
  where expected.role_key <> 'pending'
)
insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
select
  target.user_id,
  target.reporting_scope_id,
  ${persistentMasterId},
  'Ephemeral hosted Playwright QA scope'
from target_scopes target;

update public.profiles profile
set is_active = true,
    profile_completed = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = ${persistentMasterId}
from qa_ephemeral_expected expected
where profile.user_id = expected.user_id
  and expected.role_key <> 'pending';

do $qa_verify$
begin
  if exists (
       select 1
       from qa_ephemeral_expected expected
       left join public.user_roles user_role
         on user_role.user_id = expected.user_id
        and user_role.role_key = expected.role_key
       where user_role.user_id is null
     ) or (
       select count(*)
       from public.profiles profile
       where profile.user_id = any(array(select user_id from qa_ephemeral_expected))
         and profile.is_active
         and profile.profile_completed
         and profile.access_status = 'approved'
         and profile.approved_by = ${persistentMasterId}
     ) <> 8 or not exists (
       select 1
       from qa_ephemeral_expected expected
       join public.profiles profile on profile.user_id = expected.user_id
       where expected.role_key = 'pending'
         and not profile.is_active
         and not profile.profile_completed
         and profile.access_status = 'pending'
         and profile.approved_at is null
         and profile.approved_by is null
     ) then
    raise exception 'ephemeral role or profile matrix is invalid';
  end if;

  if (select count(*) from public.user_roles where role_key = 'master') <> 1
     or not exists (
       select 1
       from qa_ephemeral_expected expected
       join public.user_roles user_role on user_role.user_id = expected.user_id
       where expected.role_key = 'master' and user_role.role_key = 'master'
     ) or not exists (
       select 1
       from public.user_roles user_role
       join public.profiles profile on profile.user_id = user_role.user_id
       where user_role.user_id = ${persistentMasterId}
         and user_role.role_key = 'pending'
         and not profile.is_active
         and profile.access_status = 'pending'
     ) then
    raise exception 'visual Master parking is invalid';
  end if;

  if (
       select count(*)
       from public.crm_user_reporting_scope_grants scope_grant
       where scope_grant.user_id = any(array(select user_id from qa_ephemeral_expected))
         and scope_grant.revoked_at is null
         and scope_grant.valid_from <= now()
         and scope_grant.valid_until is null
     ) <> 8 or exists (
       select 1
       from qa_ephemeral_expected expected
       join public.user_roles user_role on user_role.user_id = expected.user_id
       where expected.role_key <> 'pending'
         and not private.user_role_scope_is_valid(expected.user_id, user_role.role_key)
     ) or exists (
       select 1
       from public.crm_user_reporting_scope_grants scope_grant
       join qa_ephemeral_expected expected on expected.user_id = scope_grant.user_id
       where expected.role_key = 'pending'
     ) or exists (
       select 1 from public.user_permission_overrides
       where user_id = any(array(select user_id from qa_ephemeral_expected))
     ) then
    raise exception 'ephemeral scope matrix is invalid';
  end if;

  if not exists (
       select 1
       from public.crm_people person
       join public.crm_team_memberships membership on membership.person_id = person.id
       join public.crm_reporting_scopes reporting_scope on reporting_scope.person_id = person.id
       join qa_ephemeral_expected expected on expected.user_id = person.auth_user_id
       where expected.role_key = 'broker'
         and person.person_key = ${sqlLiteral(brokerPersonKey)}
         and reporting_scope.scope_key = ${sqlLiteral(brokerScopeKey)}
         and membership.membership_role = 'broker'
         and membership.valid_from <= now()
         and membership.valid_until is null
     ) then
    raise exception 'ephemeral broker scope is invalid';
  end if;

  if (
       select count(*)
       from private.legal_acceptance_requirements requirement
       where requirement.user_id = any(array(select user_id from qa_ephemeral_expected))
         and requirement.terms_version = ${sqlLiteral(legalDocumentVersions.terms)}
         and requirement.privacy_version = ${sqlLiteral(legalDocumentVersions.privacy)}
     ) <> 9 or (
       select count(*)
       from private.legal_acceptances acceptance
       where acceptance.user_id = any(array(select user_id from qa_ephemeral_expected))
         and acceptance.terms_version = ${sqlLiteral(legalDocumentVersions.terms)}
         and acceptance.privacy_version = ${sqlLiteral(legalDocumentVersions.privacy)}
         and acceptance.source = 'public_registration'
     ) <> 9 or exists (
       select 1 from auth.sessions
       where user_id = any(array(select user_id from qa_ephemeral_expected))
     ) or exists (
       select 1 from auth.mfa_factors
       where user_id = any(array(select user_id from qa_ephemeral_expected))
     ) then
    raise exception 'ephemeral Auth or legal baseline is invalid';
  end if;
end
$qa_verify$;

commit;
`;
}

function persistentMasterRestorationStatements(accounts, persistentMaster) {
  const ephemeralMaster = accounts.find((account) => account.role === "master");
  const persistentMasterId = sqlUuid(persistentMaster.id);
  const ephemeralMasterId = ephemeralMaster ? sqlUuid(ephemeralMaster.id) : null;
  return `
${
  ephemeralMasterId
    ? `update public.profiles
set is_active = false,
    access_status = 'pending'
where user_id = ${ephemeralMasterId};

update public.user_roles
set role_key = 'pending'
where user_id = ${ephemeralMasterId};`
    : ""
}

update public.user_roles
set role_key = 'master'
where user_id = ${persistentMasterId};

update public.profiles
set is_active = true,
    access_status = 'approved'
where user_id = ${persistentMasterId};
`;
}

function persistentMasterRestorationProof(persistentMaster) {
  const persistentMasterId = sqlUuid(persistentMaster.id);
  return `
do $qa_restore$
begin
  if (select count(*) from public.user_roles where role_key = 'master') <> 1
     or not exists (
       select 1
       from public.user_roles user_role
       join public.profiles profile on profile.user_id = user_role.user_id
       where user_role.user_id = ${persistentMasterId}
         and user_role.role_key = 'master'
         and profile.is_active
         and profile.profile_completed
         and profile.access_status = 'approved'
         and private.user_role_scope_is_valid(user_role.user_id, user_role.role_key)
     ) then
    raise exception 'persistent visual Master restoration failed';
  end if;
end
$qa_restore$;
`;
}

function restorePersistentMasterSql(accounts, persistentMaster) {
  return `
begin;
select pg_advisory_xact_lock(hashtextextended('descomplica-hosted-ephemeral-qa', 0));

${persistentMasterRestorationStatements(accounts, persistentMaster)}

${persistentMasterRestorationProof(persistentMaster)}
commit;
`;
}

function ephemeralDatabaseCleanupSql(accounts, persistentMaster, runId) {
  if (accounts.length === 0) return restorePersistentMasterSql(accounts, persistentMaster);
  const userIds = sqlUuidArray(accounts.map((account) => account.id));
  const brokerPersonKey = `qa-hosted-${runId}-broker`;
  const brokerScopeKey = `qa-hosted-${runId}-broker-scope`;

  return `
begin;
select pg_advisory_xact_lock(hashtextextended('descomplica-hosted-ephemeral-qa', 0));

${persistentMasterRestorationStatements(accounts, persistentMaster)}

${persistentMasterRestorationProof(persistentMaster)}

delete from public.audit_logs
where actor_id = any(${userIds})
   or target_user_id = any(${userIds})
   or reporting_scope_id in (
     select id from public.crm_reporting_scopes
     where scope_key = ${sqlLiteral(brokerScopeKey)}
   );

delete from private.crm_reporting_scope_grant_lineage
where owner_user_id = any(${userIds})
   or grant_id in (
     select id from public.crm_user_reporting_scope_grants
     where user_id = any(${userIds}) or granted_by = any(${userIds})
   )
   or parent_grant_id in (
     select id from public.crm_user_reporting_scope_grants
     where user_id = any(${userIds}) or granted_by = any(${userIds})
   )
   or root_grant_id in (
     select id from public.crm_user_reporting_scope_grants
     where user_id = any(${userIds}) or granted_by = any(${userIds})
   );

delete from public.crm_user_reporting_scope_grants
where user_id = any(${userIds}) or granted_by = any(${userIds});

delete from public.user_permission_overrides
where user_id = any(${userIds});

delete from public.crm_reporting_scopes
where scope_key = ${sqlLiteral(brokerScopeKey)};

delete from public.crm_people
where person_key = ${sqlLiteral(brokerPersonKey)}
   or auth_user_id = any(${userIds});

alter table private.legal_acceptances
  disable trigger legal_acceptances_append_only;
delete from private.legal_acceptances
where user_id = any(${userIds});
alter table private.legal_acceptances
  enable trigger legal_acceptances_append_only;

alter table private.legal_acceptance_requirements
  disable trigger legal_acceptance_requirements_append_only;
delete from private.legal_acceptance_requirements
where user_id = any(${userIds});
alter table private.legal_acceptance_requirements
  enable trigger legal_acceptance_requirements_append_only;

do $qa_cleanup$
begin
  if exists (
       select 1 from public.audit_logs
       where actor_id = any(${userIds}) or target_user_id = any(${userIds})
     ) or exists (
       select 1 from private.crm_reporting_scope_grant_lineage
       where owner_user_id = any(${userIds})
     ) or exists (
       select 1 from public.crm_user_reporting_scope_grants
       where user_id = any(${userIds}) or granted_by = any(${userIds})
     ) or exists (
       select 1 from public.user_permission_overrides
       where user_id = any(${userIds})
     ) or exists (
       select 1 from public.crm_reporting_scopes
       where scope_key = ${sqlLiteral(brokerScopeKey)}
     ) or exists (
       select 1 from public.crm_people
       where person_key = ${sqlLiteral(brokerPersonKey)} or auth_user_id = any(${userIds})
     ) or exists (
       select 1 from private.legal_acceptances where user_id = any(${userIds})
     ) or exists (
       select 1 from private.legal_acceptance_requirements where user_id = any(${userIds})
     ) then
    raise exception 'ephemeral hosted QA database cleanup is incomplete';
  end if;
end
$qa_cleanup$;

commit;
`;
}

function proveEphemeralAbsenceSql(accounts, persistentMaster, runId) {
  const userIds = sqlUuidArray(accounts.map((account) => account.id));
  const textUserIds = `array[${accounts.map((account) => sqlLiteral(account.id)).join(", ")}]::text[]`;
  const persistentMasterId = sqlUuid(persistentMaster.id);
  return `
do $qa_absence$
begin
  if exists (select 1 from auth.users where id = any(${userIds}))
     or exists (select 1 from auth.sessions where user_id = any(${userIds}))
     or exists (select 1 from auth.identities where user_id = any(${userIds}))
     or exists (select 1 from auth.refresh_tokens where user_id = any(${textUserIds}))
     or exists (select 1 from auth.mfa_factors where user_id = any(${userIds}))
     or exists (select 1 from public.profiles where user_id = any(${userIds}))
     or exists (select 1 from public.user_roles where user_id = any(${userIds}))
     or exists (select 1 from public.user_permission_overrides where user_id = any(${userIds}))
     or exists (select 1 from public.crm_user_reporting_scope_grants where user_id = any(${userIds}))
     or exists (
       select 1 from public.audit_logs
       where actor_id = any(${userIds}) or target_user_id = any(${userIds})
     )
     or exists (select 1 from private.legal_acceptances where user_id = any(${userIds}))
     or exists (
       select 1 from private.legal_acceptance_requirements where user_id = any(${userIds})
     )
     or exists (
       select 1 from public.crm_people
       where auth_user_id = any(${userIds})
          or person_key = ${sqlLiteral(`qa-hosted-${runId}-broker`)}
     )
     or exists (
       select 1 from public.crm_reporting_scopes
       where scope_key = ${sqlLiteral(`qa-hosted-${runId}-broker-scope`)}
     )
     or (select count(*) from public.user_roles where role_key = 'master') <> 1
     or not exists (
       select 1
       from public.user_roles user_role
       join public.profiles profile on profile.user_id = user_role.user_id
       where user_role.user_id = ${persistentMasterId}
         and user_role.role_key = 'master'
         and profile.is_active
         and profile.profile_completed
         and profile.access_status = 'approved'
         and private.user_role_scope_is_valid(user_role.user_id, user_role.role_key)
     ) then
    raise exception 'ephemeral hosted QA absence proof failed';
  end if;
end
$qa_absence$;
`;
}

function revokeQaSessions(localModule, database, users) {
  const userIds = users.map((user) => assertUuid(user.id));
  if (userIds.length === 0 || new Set(userIds).size !== userIds.length) {
    fail("Homologation QA session cleanup target is invalid.");
  }
  const userIdArray = `array[${userIds.map((userId) => `'${userId}'::uuid`).join(",")}]`;
  localModule.runLocalSql(
    database,
    `begin;\nlock table auth.sessions in share row exclusive mode;\ndelete from auth.sessions where user_id = any(${userIdArray});\ndo $qa_cleanup$\nbegin\n  if exists (select 1 from auth.sessions where user_id = any(${userIdArray})) then\n    raise exception using errcode = 'P0001', message = 'QA sessions remain';\n  end if;\nend\n$qa_cleanup$;\ncommit;\n`,
    "hosted QA session revocation",
  );
}

async function restorePersistentVisualIdentity(
  adminClient,
  localModule,
  database,
  user,
  originalFactorIds,
) {
  const userId = assertUuid(user.id);
  let restorationFailed = false;

  try {
    const currentFactorIds = await listFactorIds(adminClient, userId);
    for (const factorId of currentFactorIds) {
      if (originalFactorIds.has(factorId)) continue;
      const { error } = await adminClient.auth.admin.mfa.deleteFactor({ userId, id: factorId });
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
      revokeQaSessions(localModule, database, [user]);
    } catch {
      restorationFailed = true;
    }
  }

  if (restorationFailed) fail("Homologation QA identity restoration failed.");
}

function mailMatchesRecipient(message, recipients) {
  return (
    message !== null &&
    typeof message === "object" &&
    typeof message.ID === "string" &&
    Array.isArray(message.To) &&
    message.To.some(
      (entry) => entry !== null && typeof entry === "object" && recipients.has(entry.Address),
    )
  );
}

async function purgeQaMail(recipientList) {
  const recipients = new Set(recipientList);
  if (recipients.size === 0 || recipients.size !== recipientList.length) {
    fail("Homologation SMTP cleanup target is invalid.");
  }
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
      .filter((message) => mailMatchesRecipient(message, recipients))
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

async function cleanupPersistentVisualState({
  adminClient,
  localModule,
  database,
  apiUrl,
  publishableKey,
  masterUser,
  master,
  originalFactorIds,
}) {
  let cleanupFailed = false;
  try {
    await restorePersistentVisualIdentity(
      adminClient,
      localModule,
      database,
      masterUser,
      originalFactorIds,
    );
  } catch {
    cleanupFailed = true;
  }
  try {
    await verifyQaCredential(apiUrl, publishableKey, master.email, master.password);
  } catch {
    cleanupFailed = true;
  } finally {
    try {
      revokeQaSessions(localModule, database, [masterUser]);
    } catch {
      cleanupFailed = true;
    }
  }
  try {
    await purgeQaMail([master.email]);
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) fail("Homologation hosted QA cleanup failed.");
}

function clearEphemeralPasswords(accounts) {
  for (const account of accounts) account.password = "";
}

async function removeEphemeralQaState({
  adminClient,
  localModule,
  database,
  persistentMaster,
  accounts,
  runId,
}) {
  if (accounts.length === 0) return;
  const failures = [];
  const recipients = accounts.map((account) => account.email);

  for (const account of accounts) {
    try {
      const factorIds = await listFactorIds(adminClient, assertUuid(account.id));
      for (const factorId of factorIds) {
        const { error } = await adminClient.auth.admin.mfa.deleteFactor({
          userId: account.id,
          id: factorId,
        });
        if (error) failures.push("factor");
      }
      if ((await listFactorIds(adminClient, account.id)).size !== 0) failures.push("factor-proof");
    } catch {
      failures.push("factor");
    }
  }

  try {
    revokeQaSessions(localModule, database, accounts);
  } catch {
    failures.push("sessions");
  }

  try {
    localModule.runLocalSql(
      database,
      ephemeralDatabaseCleanupSql(accounts, persistentMaster, runId),
      "hosted ephemeral QA database cleanup",
    );
  } catch {
    failures.push("database");
  }

  try {
    localModule.runLocalSql(
      database,
      restorePersistentMasterSql(accounts, persistentMaster),
      "hosted persistent Master restoration",
    );
  } catch {
    failures.push("master");
  }

  const deletionOrder = [...accounts].sort((left, right) => {
    if (left.role === "master") return 1;
    if (right.role === "master") return -1;
    return 0;
  });
  for (const account of deletionOrder) {
    try {
      const { error } = await adminClient.auth.admin.deleteUser(assertUuid(account.id), false);
      if (error) {
        const lookup = await adminClient.auth.admin.getUserById(account.id);
        if (lookup.data?.user || !lookup.error) failures.push("identity");
      }
    } catch {
      failures.push("identity");
    }
  }

  try {
    localModule.runLocalSql(
      database,
      proveEphemeralAbsenceSql(accounts, persistentMaster, runId),
      "hosted ephemeral QA absence proof",
    );
  } catch {
    failures.push("proof");
  }

  try {
    await purgeQaMail(recipients);
  } catch {
    failures.push("mail");
  }

  if (failures.length > 0) fail("Homologation ephemeral QA cleanup was incomplete.");
}

async function snapshotHostedLog(file, label) {
  let logStat;
  try {
    logStat = await lstat(file);
  } catch {
    fail(label);
  }
  if (!logStat.isFile()) fail(label);
  return { device: logStat.dev, inode: logStat.ino, offset: logStat.size };
}

async function readHostedLogTail(file, snapshot, label) {
  let current;
  try {
    current = await lstat(file);
  } catch {
    fail(label);
  }
  if (
    !current.isFile() ||
    current.dev !== snapshot.device ||
    current.ino !== snapshot.inode ||
    current.size < snapshot.offset
  ) {
    fail(label);
  }
  const appendedBytes = current.size - snapshot.offset;
  if (appendedBytes > 8 * 1024 * 1024) fail(label);
  if (appendedBytes === 0) return "";

  const handle = await open(file, "r");
  try {
    const appended = Buffer.alloc(Number(appendedBytes));
    const { bytesRead } = await handle.read(appended, 0, appended.length, snapshot.offset);
    if (bytesRead !== appended.length) fail(label);
    return appended.toString("utf8");
  } finally {
    await handle.close();
  }
}

function containsSensitiveCallbackMaterial(value) {
  return /(?:\/auth\/callback|%2fauth%2fcallback|token_hash(?:=|%3d)|type(?:=|%3d)recovery)/iu.test(
    value,
  );
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
    configuration.split(`access_log ${accessLogPath};`).length - 1 !== 2 ||
    configuration.split(`error_log ${errorLogPath};`).length - 1 !== 2 ||
    callbackBlocks.some(
      (match) =>
        !/\baccess_log\s+off\s*;/u.test(match.groups?.body ?? "") ||
        !/\berror_log\s+\/dev\/null\s+crit\s*;/u.test(match.groups?.body ?? ""),
    )
  ) {
    fail("Homologation callback logging is not fail-closed.");
  }

  const [access, error] = await Promise.all([
    snapshotHostedLog(accessLogPath, "Homologation access log preflight failed."),
    snapshotHostedLog(errorLogPath, "Homologation error log preflight failed."),
  ]);
  return { access, error };
}

async function assertHostedAccessLogSafety(snapshot) {
  const [accessLogTail, errorLogTail] = await Promise.all([
    readHostedLogTail(
      accessLogPath,
      snapshot.access,
      "Homologation access log proof was incomplete.",
    ),
    readHostedLogTail(errorLogPath, snapshot.error, "Homologation error log proof was incomplete."),
  ]);
  if (
    containsSensitiveCallbackMaterial(accessLogTail) ||
    containsSensitiveCallbackMaterial(errorLogTail) ||
    /"\s+5\d{2}\s/u.test(accessLogTail)
  ) {
    fail("Homologation proxy logs violated the hosted QA contract.");
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
  const { stdout, stderr } = await capturedDocker(
    ["logs", "--since", since, "--tail", "10000", appContainer],
    "Homologation application log postflight failed.",
  );
  const logs = `${stdout}\n${stderr}`;
  if (
    containsSensitiveCallbackMaterial(logs) ||
    /(?:uncaught exception|unhandled rejection|fatal error)/iu.test(logs)
  ) {
    fail("Homologation application logs violated the hosted QA contract.");
  }
}

async function main() {
  if (process.getuid?.() !== 0) fail("Remote homologation QA requires root.");
  process.env.HOMOLOGATION_MODE = "true";
  process.env.QA_SUPABASE_WORKDIR = runtimeRoot;

  await verifyLocalDockerSocket();
  const head = await verifyRepositoryState();
  const [accountsPayload, access, runtimeEnvironment, runtimeManifest, localModule] =
    await Promise.all([
      readPrivateJson(accountsPath),
      readPrivateJson(accessPath),
      readRuntimeEnvironmentContract(),
      readPrivateJson(runtimeManifestPath),
      import("../qa/local-authenticated-visual.mjs"),
    ]);
  await verifySupabaseRuntimeContract();
  await verifyHomologationNetworkIsolation();
  if (runtimeEnvironment.imageTag !== head) {
    fail("Homologation private runtime does not match the checked-out release.");
  }
  if (
    runtimeManifest?.schemaVersion !== 1 ||
    runtimeManifest?.environment !== "isolated-homologation" ||
    runtimeManifest?.dataClassification !== "synthetic-only" ||
    !/^[a-f0-9]{40}$/u.test(runtimeManifest?.sourceSha ?? "")
  ) {
    fail("Homologation runtime manifest does not match the checked-out release.");
  }
  const persistentMasterCandidates = Array.isArray(accountsPayload?.accounts)
    ? accountsPayload.accounts.filter((account) => account?.role === "master")
    : [];
  const master = persistentMasterCandidates[0];
  if (
    accountsPayload?.environment !== "isolated-homologation" ||
    accountsPayload?.dataClassification !== "synthetic-only" ||
    persistentMasterCandidates.length !== 1 ||
    typeof master?.email !== "string" ||
    !/^qa\.rls-master-[a-f0-9]+@local\.invalid$/.test(master.email) ||
    typeof master?.password !== "string" ||
    master.password.length < 20 ||
    typeof accountsPayload.visualSourceMarker !== "string" ||
    accountsPayload.visualSourceMarker.length === 0
  ) {
    fail("Homologation persistent visual Master fixture is incomplete.");
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
  const hostedRuntime = await inspectHostedRuntime(head);
  const officialSimulatorEnvironment = hostedRuntime.officialSimulatorEnvironment;
  await verifyHostedHealth(head, access);
  await verifyAuthMfaAndLegacyCanaryMigrationContracts(head);
  const adminClient = createAdminClient(local.apiUrl, local.secretKey);
  const masterUser = await resolveQaUser(adminClient, master.email);
  const masterUserId = assertUuid(masterUser.id);
  const originalFactorIds = await listFactorIds(adminClient, masterUserId);
  if (originalFactorIds.size !== 0) {
    fail("Dedicated visual Master identity must start without enrolled MFA factors.");
  }
  try {
    await verifyQaCredential(local.apiUrl, local.publishableKey, master.email, master.password);
  } finally {
    revokeQaSessions(localModule, local.database, [masterUser]);
  }
  await purgeQaMail([master.email]);
  const callbackLogSnapshot = await verifyProxyPrivacyContract();
  const applicationLogSince = new Date(Date.now() - 1_000).toISOString();
  const sharedEnvironment = {
    ...process.env,
    HOMOLOGATION_MODE: "true",
    QA_SUPABASE_WORKDIR: runtimeRoot,
    ...officialSimulatorEnvironment,
    ...hostedRuntime.legacyMigrationEnvironment,
  };

  let qaFailure;
  let cleanupFailed = false;
  let privacyFailed = false;
  const runId = randomBytes(8).toString("hex");
  const ephemeralAccounts = [];
  try {
    for (const role of requiredRoles) {
      ephemeralAccounts.push(await createEphemeralAccount(adminClient, role, runId));
      throwIfInterrupted();
    }
    assertCompleteEphemeralMatrix(ephemeralAccounts);
    localModule.runLocalSql(
      local.database,
      ephemeralMatrixSetupSql(ephemeralAccounts, masterUser, runId),
      "hosted ephemeral QA matrix setup",
    );
    throwIfInterrupted();
    await run("pnpm", ["exec", "playwright", "test", "e2e/release-candidate.spec.ts"], {
      ...sharedEnvironment,
      QA_E2E_REMOTE_HOMOLOGATION: "true",
      QA_E2E_ORIGIN: origin,
      QA_E2E_MAILPIT_ORIGIN: mailpitOrigin,
      QA_E2E_BASIC_AUTH_USERNAME: access.username,
      QA_E2E_BASIC_AUTH_PASSWORD: access.password,
      QA_E2E_ACCOUNTS: JSON.stringify(ephemeralAccounts),
    });
  } catch (error) {
    qaFailure = error;
  } finally {
    clearEphemeralPasswords(ephemeralAccounts);
    try {
      await removeEphemeralQaState({
        adminClient,
        localModule,
        database: local.database,
        persistentMaster: masterUser,
        accounts: ephemeralAccounts,
        runId,
      });
    } catch {
      cleanupFailed = true;
    }
    try {
      await cleanupPersistentVisualState({
        adminClient,
        localModule,
        database: local.database,
        apiUrl: local.apiUrl,
        publishableKey: local.publishableKey,
        masterUser,
        master,
        originalFactorIds,
      });
    } catch {
      cleanupFailed = true;
    }
    try {
      await assertHostedAccessLogSafety(callbackLogSnapshot);
    } catch {
      privacyFailed = true;
    }
  }

  if (!qaFailure && !cleanupFailed && !privacyFailed) {
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

  try {
    await cleanupPersistentVisualState({
      adminClient,
      localModule,
      database: local.database,
      apiUrl: local.apiUrl,
      publishableKey: local.publishableKey,
      masterUser,
      master,
      originalFactorIds,
    });
  } catch {
    cleanupFailed = true;
  }

  let postflightFailed = privacyFailed;
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

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (requestedSignal) return;
    requestedSignal = signal;
    for (const child of activeChildren) child.kill(signal);
  });
}

try {
  await main();
  if (requestedSignal) {
    process.exitCode = requestedSignal === "SIGINT" ? 130 : 143;
  }
} catch {
  process.stderr.write("Remote homologation QA failed; secrets=not-printed.\n");
  process.exitCode = requestedSignal === "SIGINT" ? 130 : requestedSignal === "SIGTERM" ? 143 : 1;
}
