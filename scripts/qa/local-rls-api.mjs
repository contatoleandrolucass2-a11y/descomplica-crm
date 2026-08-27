import { randomBytes, randomUUID } from "node:crypto";
import { execFile, spawn, spawnSync } from "node:child_process";
import { chmod, link, open, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import legalDocumentVersions from "../../lib/legal/versions.json" with { type: "json" };

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const homologationRuntimeRoot = "/var/lib/descomplica-crm-homologation";
const homologationAccountsPath = "/etc/descomplica-crm/homologation-accounts.json";
const playwrightOutputRoot = "/tmp/descomplica-playwright-results";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const requiredRoles = [
  "master",
  "admin",
  "manager",
  "broker",
  "coordinator",
  "real_estate",
  "house",
  "partnership_channel",
  "pending",
];
const legacyRoles = new Set(["user", "supervisor", "broker_lead"]);
const simulatorPageKeys = ["crm.simulation", "crm.simulation.wf13"];
const inheritedAnalyticalPageKeys = [
  "crm.dashboard",
  "crm.ranking",
  "crm.stage.appointments",
  "crm.stage.folders",
  "crm.stage.opportunities",
  "crm.stage.sales",
  "crm.stage.visits",
];
const administrativeCommercialPageKeys = [
  "crm.settings",
  "crm.settings.goals",
  "crm.settings.partnerships",
  "crm.settings.points",
];
const masterOnlyCommercialPageKeys = ["crm.partnerships"];
const masterAdministrativePageKeys = ["admin.home", "admin.pages", "admin.users"];
const expectedPageKeysByRole = {
  master: [
    ...masterAdministrativePageKeys,
    ...inheritedAnalyticalPageKeys,
    ...administrativeCommercialPageKeys,
    ...masterOnlyCommercialPageKeys,
    ...simulatorPageKeys,
  ].sort(),
  admin: [
    ...masterAdministrativePageKeys,
    ...inheritedAnalyticalPageKeys,
    ...administrativeCommercialPageKeys,
  ].sort(),
  manager: [],
  broker: [...inheritedAnalyticalPageKeys].sort(),
  coordinator: [...inheritedAnalyticalPageKeys].sort(),
  real_estate: [...inheritedAnalyticalPageKeys].sort(),
  house: [],
  partnership_channel: [],
  pending: [],
};
const positivePageRoles = new Set(
  Object.entries(expectedPageKeysByRole)
    .filter(([, pageKeys]) => pageKeys.length > 0)
    .map(([role]) => role),
);
const commercialRankingRoles = new Set(
  Object.entries(expectedPageKeysByRole)
    .filter(([, pageKeys]) => pageKeys.includes("crm.ranking"))
    .map(([role]) => role),
);
const activeChildren = new Set();

class LocalQaError extends Error {}

let requestedSignal = null;

function fail(message) {
  throw new LocalQaError(message);
}

function environmentSubset(names) {
  return Object.fromEntries(
    names.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  );
}

function parseLoopbackHttpOrigin(rawValue) {
  let candidate;
  try {
    candidate = new URL(rawValue);
  } catch {
    fail("Local Supabase returned an invalid API URL.");
  }

  if (
    candidate.protocol !== "http:" ||
    !loopbackHosts.has(candidate.hostname) ||
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash
  ) {
    fail("Supabase API target is not a credential-free HTTP loopback origin.");
  }

  return candidate.origin;
}

function parseLoopbackDatabaseUrl(rawValue) {
  let candidate;
  try {
    candidate = new URL(rawValue);
  } catch {
    fail("Local Supabase returned an invalid database URL.");
  }

  const port = Number(candidate.port);
  const database = decodeURIComponent(candidate.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(candidate.protocol) ||
    !loopbackHosts.has(candidate.hostname) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    !candidate.username ||
    !database ||
    candidate.search ||
    candidate.hash
  ) {
    fail("Supabase database target is not a valid loopback endpoint.");
  }

  return {
    host: candidate.hostname === "[::1]" ? "::1" : candidate.hostname,
    port: String(port),
    user: decodeURIComponent(candidate.username),
    password: decodeURIComponent(candidate.password),
    database,
  };
}

function extractSingleTopLevelJsonObject(stdout) {
  let candidate = null;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < stdout.length; index += 1) {
    const character = stdout[index];

    if (depth === 0) {
      if (character === "}") fail("Supabase CLI did not return valid local status JSON.");
      if (character !== "{") continue;
      if (candidate !== null) fail("Supabase CLI did not return valid local status JSON.");

      start = index;
      depth = 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        candidate = stdout.slice(start, index + 1);
        start = -1;
      }
    }
  }

  if (candidate === null || depth !== 0) {
    fail("Supabase CLI did not return valid local status JSON.");
  }

  return candidate;
}

function parseLocalStatus(stdout) {
  let status;
  try {
    status = JSON.parse(extractSingleTopLevelJsonObject(stdout));
  } catch {
    fail("Supabase CLI did not return valid local status JSON.");
  }

  const apiUrl = parseLoopbackHttpOrigin(status.API_URL);
  const database = parseLoopbackDatabaseUrl(status.DB_URL);
  const mailpitUrl = parseLoopbackHttpOrigin(status.INBUCKET_URL || status.MAILPIT_URL);
  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;

  if (typeof publishableKey !== "string" || publishableKey.length < 20) {
    fail("Local Supabase publishable key is unavailable.");
  }
  if (typeof secretKey !== "string" || secretKey.length < 20) {
    fail("Local Supabase admin key is unavailable.");
  }

  return { apiUrl, database, mailpitUrl, publishableKey, secretKey };
}

async function discoverLocalSupabase() {
  const configuredWorkdir = process.env.QA_SUPABASE_WORKDIR;
  const workdir = configuredWorkdir ? path.resolve(configuredWorkdir) : repositoryRoot;
  if (
    workdir !== repositoryRoot &&
    (process.env.HOMOLOGATION_MODE !== "true" || workdir !== homologationRuntimeRoot)
  ) {
    fail("Alternate Supabase workdir is restricted to explicit isolated homologation.");
  }

  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "pnpm",
      ["exec", "supabase", "status", "--output", "json", "--workdir", workdir],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: environmentSubset([
          "PATH",
          "HOME",
          "XDG_CONFIG_HOME",
          "XDG_RUNTIME_DIR",
          "DOCKER_HOST",
        ]),
      },
    ));
  } catch {
    fail("Local Supabase is not running for this repository.");
  }

  return parseLocalStatus(stdout);
}

function persistentAccountsPath() {
  const candidate = process.env.QA_RELEASE_PERSIST_ACCOUNTS_FILE;
  if (!candidate) return null;
  if (
    process.env.HOMOLOGATION_MODE !== "true" ||
    path.resolve(process.env.QA_SUPABASE_WORKDIR ?? "") !== homologationRuntimeRoot ||
    path.resolve(candidate) !== homologationAccountsPath
  ) {
    fail("Persistent QA accounts are restricted to isolated homologation storage.");
  }
  return homologationAccountsPath;
}

async function persistSyntheticAccounts(destination, runId, accounts) {
  const payload = {
    schemaVersion: 1,
    environment: "isolated-homologation",
    dataClassification: "synthetic-only",
    runId,
    visualRunId: `${Date.now()}-${randomBytes(6).toString("hex")}`,
    accounts: accounts.map(({ id, role, email, password }) => ({ id, role, email, password })),
  };
  const temporary = `${destination}.tmp-${process.pid}`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporary, 0o600);
    await link(temporary, destination);
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not reserve a loopback E2E port.")));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function assertFreshProductionBuild() {
  let buildStat;
  try {
    buildStat = await stat(path.join(repositoryRoot, ".next", "BUILD_ID"));
  } catch {
    fail("Production build is missing; run pnpm build before browser E2E.");
  }

  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "git",
      [
        "ls-files",
        "-co",
        "--exclude-standard",
        "-z",
        "--",
        "app",
        "lib",
        "public",
        "next.config.ts",
        "package.json",
        "pnpm-lock.yaml",
        "postcss.config.mjs",
        "proxy.ts",
        "tsconfig.json",
      ],
      { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ));
  } catch {
    fail("Could not verify production build freshness for browser E2E.");
  }

  const inputs = [...new Set(stdout.split("\0").filter(Boolean))];
  const inputStats = await Promise.all(inputs.map((file) => stat(path.join(repositoryRoot, file))));
  if (inputStats.some((input) => input.mtimeMs > buildStat.mtimeMs)) {
    fail("Production build is stale; run pnpm build before browser E2E.");
  }
}

async function assertLoopbackServerReady(origin) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    throwIfInterrupted();
    try {
      const response = await fetch(`${origin}/login`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status < 500) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("Local Next.js production server did not become ready for browser E2E.");
}

async function startLocalNextServer(local) {
  await assertFreshProductionBuild();
  const port = await reserveLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn("pnpm", ["start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: repositoryRoot,
    detached: true,
    env: {
      ...environmentSubset(["PATH", "HOME", "TZ", "NODE_OPTIONS", "LD_LIBRARY_PATH"]),
      NODE_ENV: "production",
      APP_ORIGIN: origin,
      AUTH_LOCAL_INSECURE_LOOPBACK_QA: "true",
      AUTH_SESSION_COOKIE_SECRET: randomBytes(32).toString("base64url"),
      SUPABASE_URL: local.apiUrl,
      SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
      OFFICIAL_SIMULATOR_RUNTIME_MODE: "active",
      OFFICIAL_SIMULATOR_ENABLED_KEYS: "simulator.wf13",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  activeChildren.add(child);
  child.once("exit", () => activeChildren.delete(child));
  child.once("error", () => activeChildren.delete(child));

  try {
    await assertLoopbackServerReady(origin);
    return { child, origin };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

function signalChildGroup(child, signal) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  signalChildGroup(child, "SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    signalChildGroup(child, "SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

function runBrowserE2e(origin, mailpitUrl, accounts) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "playwright", "test", "--config", "playwright.config.ts"],
      {
        cwd: repositoryRoot,
        detached: true,
        env: {
          ...environmentSubset([
            "PATH",
            "HOME",
            "CI",
            "TZ",
            "NODE_OPTIONS",
            "PLAYWRIGHT_BROWSERS_PATH",
            "LD_LIBRARY_PATH",
          ]),
          QA_E2E_LOCAL_ONLY: "true",
          QA_E2E_ORIGIN: origin,
          QA_E2E_MAILPIT_ORIGIN: mailpitUrl,
          PLAYWRIGHT_NO_COPY_PROMPT: "1",
          ...(process.env.QA_CAPTURE_STATE_EVIDENCE === "true"
            ? { QA_CAPTURE_STATE_EVIDENCE: "true" }
            : {}),
          QA_E2E_ACCOUNTS: JSON.stringify(
            accounts.map(({ email, password, role }) => ({ email, password, role })),
          ),
        },
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    activeChildren.add(child);
    let settled = false;
    child.once("error", () => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      reject(new Error("Playwright release-candidate process could not start."));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`Playwright release-candidate process failed (${signal || code}).`));
    });
  });
}

function localOnlyFetch(expectedOrigin) {
  return async (input, init = {}) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? input : input.url;
    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      fail("Supabase client attempted an invalid local request.");
    }

    if (
      target.origin !== expectedOrigin ||
      target.protocol !== "http:" ||
      !loopbackHosts.has(target.hostname)
    ) {
      fail("Supabase client attempted a non-loopback request.");
    }

    try {
      return await fetch(input, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (error instanceof LocalQaError) throw error;
      fail("Local Supabase request failed.");
    }
  };
}

function createLocalClient(apiUrl, key) {
  return createClient(apiUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localOnlyFetch(apiUrl) },
  });
}

function assertUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail("Local Supabase returned an invalid QA user identifier.");
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

function runLocalSql(database, sql, purpose) {
  const result = spawnSync(
    "psql",
    [
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--host",
      database.host,
      "--port",
      database.port,
      "--username",
      database.user,
      "--dbname",
      database.database,
    ],
    {
      cwd: repositoryRoot,
      input: sql,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...environmentSubset(["PATH", "HOME"]),
        PGAPPNAME: "descomplica_local_rls_api_qa",
        PGCONNECT_TIMEOUT: "5",
        PGPASSWORD: database.password,
      },
    },
  );

  if (result.error || result.status !== 0) {
    fail(`Local QA database ${purpose} failed.`);
  }
}

function preflightSql() {
  return `
do $qa_preflight$
begin
  if to_regclass('public.crm_organizations') is null
     or to_regclass('public.crm_reporting_scopes') is null
     or to_regprocedure('public.bootstrap_master_user(uuid)') is null then
    raise exception 'required local RLS foundation is not applied';
  end if;

  if exists (
    select 1 from public.user_roles where role_key = 'master'
  ) then
    raise exception 'local QA requires a fresh database without a Master fixture';
  end if;

  if (
    select count(*) from public.roles
    where key = any(array[
      'master', 'admin', 'manager', 'broker', 'coordinator',
      'real_estate', 'house', 'partnership_channel', 'pending'
    ])
  ) <> 9 then
    raise exception 'required local QA roles are unavailable';
  end if;

  if exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.is_active
      and profile.access_status = 'approved'
      and user_role.role_key = any(array['user', 'supervisor', 'broker_lead'])
  ) then
    raise exception 'approved legacy roles violate the local QA contract';
  end if;

  if exists (
    with expected(role_key, permission_key) as (
      values
        ('admin', 'crm.dashboard.view'),
        ('admin', 'crm.stages.view'),
        ('admin', 'crm.ranking.view'),
        ('admin', 'pages.manage'),
        ('admin', 'crm.settings.view'),
        ('admin', 'crm.settings.manage'),
        ('admin', 'crm.salesforce.refresh'),
        ('admin', 'crm.ingest.manage'),
        ('coordinator', 'crm.dashboard.view'),
        ('coordinator', 'crm.stages.view'),
        ('coordinator', 'crm.ranking.view'),
        ('supervisor', 'crm.dashboard.view'),
        ('supervisor', 'crm.stages.view'),
        ('supervisor', 'crm.ranking.view'),
        ('real_estate', 'crm.dashboard.view'),
        ('real_estate', 'crm.stages.view'),
        ('real_estate', 'crm.ranking.view'),
        ('broker_lead', 'crm.dashboard.view'),
        ('broker_lead', 'crm.stages.view'),
        ('broker_lead', 'crm.ranking.view'),
        ('broker', 'crm.dashboard.view'),
        ('broker', 'crm.stages.view'),
        ('broker', 'crm.ranking.view'),
        ('user', 'crm.dashboard.view'),
        ('user', 'crm.stages.view'),
        ('user', 'crm.ranking.view')
    ),
    actual as (
      select role_permission.role_key, role_permission.permission_key
      from public.role_permissions role_permission
      where role_permission.role_key <> 'master'
        and role_permission.permission_key = any(array[
          'crm.dashboard.view',
          'crm.stages.view',
          'crm.ranking.view',
          'crm.partnerships.view',
          'pages.manage',
          'crm.settings.view',
          'crm.settings.manage',
          'crm.salesforce.refresh',
          'crm.ingest.manage'
        ])
    )
    select 1
    from (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    ) difference
  ) then
    raise exception 'inherited commercial permission baseline diverged';
  end if;
end
$qa_preflight$;
`;
}

function createFixtures(runKey) {
  const organizationA = { id: randomUUID(), key: `${runKey}-org-a` };
  const organizationB = { id: randomUUID(), key: `${runKey}-org-b` };
  const teamA = { id: randomUUID(), key: `${runKey}-team-a` };
  const teamB = { id: randomUUID(), key: `${runKey}-team-b` };
  const personA = { id: randomUUID(), key: `${runKey}-person-a` };
  const pendingPerson = { id: randomUUID(), key: `${runKey}-person-pending` };
  const portfolioA = { id: randomUUID(), key: `${runKey}-portfolio-a` };
  const portfolioB = { id: randomUUID(), key: `${runKey}-portfolio-b` };
  const reportingScopes = {
    organizationA: { id: randomUUID(), key: `${runKey}-scope-org-a` },
    organizationB: { id: randomUUID(), key: `${runKey}-scope-org-b` },
    teamA: { id: randomUUID(), key: `${runKey}-scope-team-a` },
    teamB: { id: randomUUID(), key: `${runKey}-scope-team-b` },
    personA: { id: randomUUID(), key: `${runKey}-scope-person-a` },
    pendingPerson: { id: randomUUID(), key: `${runKey}-scope-person-pending` },
    portfolioA: { id: randomUUID(), key: `${runKey}-scope-portfolio-a` },
    portfolioB: { id: randomUUID(), key: `${runKey}-scope-portfolio-b` },
  };

  return {
    organizationA,
    organizationB,
    teamA,
    teamB,
    personA,
    pendingPerson,
    portfolioA,
    portfolioB,
    reportingScopes,
    teamMembershipId: randomUUID(),
    pendingCurrentMembershipId: randomUUID(),
    pendingFutureMembershipId: randomUUID(),
    portfolioOrganizationAId: randomUUID(),
    portfolioOrganizationBId: randomUUID(),
    commercialRanking: {
      key: `${runKey}-commercial-v2`,
      source: `Synthetic local RLS API QA ${runKey}`,
    },
  };
}

function setupSql(accounts, fixtures) {
  const byRole = Object.fromEntries(accounts.map((account) => [account.role, account]));
  const masterId = sqlUuid(byRole.master.id);
  const approvedAssignments = [
    ["admin", fixtures.reportingScopes.organizationA.id],
    ["manager", fixtures.reportingScopes.teamA.id],
    ["broker", fixtures.reportingScopes.personA.id],
    ["coordinator", fixtures.reportingScopes.portfolioB.id],
    ["real_estate", fixtures.reportingScopes.organizationB.id],
    ["house", fixtures.reportingScopes.organizationA.id],
    ["partnership_channel", fixtures.reportingScopes.portfolioA.id],
  ];
  const assignmentValues = approvedAssignments
    .map(
      ([role, scopeId]) =>
        `(${sqlUuid(byRole[role].id)}, ${sqlLiteral(role)}, ${sqlUuid(scopeId)})`,
    )
    .join(",\n    ");

  return `
begin;

select public.bootstrap_master_user(${masterId});

insert into public.crm_organizations (id, organization_key, name, kind)
values
  (${sqlUuid(fixtures.organizationA.id)}, ${sqlLiteral(fixtures.organizationA.key)}, 'Synthetic local RLS QA house', 'house'),
  (${sqlUuid(fixtures.organizationB.id)}, ${sqlLiteral(fixtures.organizationB.key)}, 'Synthetic local RLS QA real estate', 'real_estate');

insert into public.crm_teams (id, organization_id, team_key, name)
values
  (${sqlUuid(fixtures.teamA.id)}, ${sqlUuid(fixtures.organizationA.id)}, ${sqlLiteral(fixtures.teamA.key)}, 'Synthetic local RLS QA team A'),
  (${sqlUuid(fixtures.teamB.id)}, ${sqlUuid(fixtures.organizationB.id)}, ${sqlLiteral(fixtures.teamB.key)}, 'Synthetic local RLS QA team B');

insert into public.crm_people (id, person_key, display_name, auth_user_id)
values
  (
    ${sqlUuid(fixtures.personA.id)},
    ${sqlLiteral(fixtures.personA.key)},
    'Synthetic local RLS QA person',
    ${sqlUuid(byRole.broker.id)}
  ),
  (
    ${sqlUuid(fixtures.pendingPerson.id)},
    ${sqlLiteral(fixtures.pendingPerson.key)},
    'Synthetic local RLS QA dual-affiliation target',
    ${sqlUuid(byRole.pending.id)}
  );

insert into public.crm_team_memberships (
  id,
  team_id,
  person_id,
  membership_role,
  valid_from
)
values
  (
    ${sqlUuid(fixtures.teamMembershipId)},
    ${sqlUuid(fixtures.teamA.id)},
    ${sqlUuid(fixtures.personA.id)},
    'broker',
    now() - interval '1 hour'
  ),
  (
    ${sqlUuid(fixtures.pendingCurrentMembershipId)},
    ${sqlUuid(fixtures.teamA.id)},
    ${sqlUuid(fixtures.pendingPerson.id)},
    'broker',
    now() - interval '1 hour'
  ),
  (
    ${sqlUuid(fixtures.pendingFutureMembershipId)},
    ${sqlUuid(fixtures.teamB.id)},
    ${sqlUuid(fixtures.pendingPerson.id)},
    'broker',
    now() + interval '1 day'
  );

insert into public.crm_portfolios (id, portfolio_key, name, kind)
values
  (${sqlUuid(fixtures.portfolioA.id)}, ${sqlLiteral(fixtures.portfolioA.key)}, 'Synthetic local RLS QA portfolio A', 'partnership'),
  (${sqlUuid(fixtures.portfolioB.id)}, ${sqlLiteral(fixtures.portfolioB.key)}, 'Synthetic local RLS QA portfolio B', 'partnership');

insert into public.crm_portfolio_organizations (id, portfolio_id, organization_id)
values
  (${sqlUuid(fixtures.portfolioOrganizationAId)}, ${sqlUuid(fixtures.portfolioA.id)}, ${sqlUuid(fixtures.organizationA.id)}),
  (${sqlUuid(fixtures.portfolioOrganizationBId)}, ${sqlUuid(fixtures.portfolioB.id)}, ${sqlUuid(fixtures.organizationB.id)});

insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id,
  team_id,
  portfolio_id,
  person_id
)
values
  (${sqlUuid(fixtures.reportingScopes.organizationA.id)}, ${sqlLiteral(fixtures.reportingScopes.organizationA.key)}, 'organization', ${sqlUuid(fixtures.organizationA.id)}, null, null, null),
  (${sqlUuid(fixtures.reportingScopes.organizationB.id)}, ${sqlLiteral(fixtures.reportingScopes.organizationB.key)}, 'organization', ${sqlUuid(fixtures.organizationB.id)}, null, null, null),
  (${sqlUuid(fixtures.reportingScopes.teamA.id)}, ${sqlLiteral(fixtures.reportingScopes.teamA.key)}, 'team', null, ${sqlUuid(fixtures.teamA.id)}, null, null),
  (${sqlUuid(fixtures.reportingScopes.teamB.id)}, ${sqlLiteral(fixtures.reportingScopes.teamB.key)}, 'team', null, ${sqlUuid(fixtures.teamB.id)}, null, null),
  (${sqlUuid(fixtures.reportingScopes.personA.id)}, ${sqlLiteral(fixtures.reportingScopes.personA.key)}, 'person', null, null, null, ${sqlUuid(fixtures.personA.id)}),
  (${sqlUuid(fixtures.reportingScopes.pendingPerson.id)}, ${sqlLiteral(fixtures.reportingScopes.pendingPerson.key)}, 'person', null, null, null, ${sqlUuid(fixtures.pendingPerson.id)}),
  (${sqlUuid(fixtures.reportingScopes.portfolioA.id)}, ${sqlLiteral(fixtures.reportingScopes.portfolioA.key)}, 'portfolio', null, null, ${sqlUuid(fixtures.portfolioA.id)}, null),
  (${sqlUuid(fixtures.reportingScopes.portfolioB.id)}, ${sqlLiteral(fixtures.reportingScopes.portfolioB.key)}, 'portfolio', null, null, ${sqlUuid(fixtures.portfolioB.id)}, null);

update public.user_roles user_role
set role_key = fixture.role_key,
    assigned_by = ${masterId},
    updated_at = now()
from (values
    ${assignmentValues}
) as fixture(user_id, role_key, reporting_scope_id)
where user_role.user_id = fixture.user_id;

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
select
  fixture.user_id,
  fixture.reporting_scope_id,
  ${masterId},
  'Ephemeral local RLS API QA scope'
from (values
    ${assignmentValues}
) as fixture(user_id, role_key, reporting_scope_id);

update public.profiles profile
set is_active = true,
    profile_completed = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = ${masterId}
from (values
    ${assignmentValues}
) as fixture(user_id, role_key, reporting_scope_id)
where profile.user_id = fixture.user_id;

insert into public.crm_ranking_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  timezone,
  source,
  roulette_available
)
values (
  ${sqlLiteral(fixtures.commercialRanking.key)},
  timezone('America/Sao_Paulo', now())::date,
  now(),
  'America/Sao_Paulo',
  ${sqlLiteral(fixtures.commercialRanking.source)},
  false
);

do $qa_verify$
begin
  if (
    select count(*)
    from public.profiles profile
    where profile.user_id = any(${sqlUuidArray(accounts.map((account) => account.id))})
      and profile.is_active
      and profile.access_status = 'approved'
  ) <> 8 then
    raise exception 'approved local QA profile fixture count is invalid';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = ${sqlUuid(byRole.pending.id)}
      and not profile.is_active
      and profile.access_status = 'pending'
      and user_role.role_key = 'pending'
  ) then
    raise exception 'pending local QA fixture is invalid';
  end if;

  if not exists (
    select 1
    from public.crm_people target_person
    join public.crm_team_memberships current_membership
      on current_membership.id = ${sqlUuid(fixtures.pendingCurrentMembershipId)}
     and current_membership.person_id = target_person.id
     and current_membership.team_id = ${sqlUuid(fixtures.teamA.id)}
     and current_membership.valid_from <= now()
     and (
       current_membership.valid_until is null
       or current_membership.valid_until > now()
     )
    join public.crm_team_memberships future_membership
      on future_membership.id = ${sqlUuid(fixtures.pendingFutureMembershipId)}
     and future_membership.person_id = target_person.id
     and future_membership.team_id = ${sqlUuid(fixtures.teamB.id)}
     and future_membership.valid_from > now()
     and (
       future_membership.valid_until is null
       or future_membership.valid_until > now()
     )
    where target_person.id = ${sqlUuid(fixtures.pendingPerson.id)}
      and target_person.auth_user_id = ${sqlUuid(byRole.pending.id)}
  ) then
    raise exception 'dual-affiliation local QA fixture is invalid';
  end if;

  if (
    select count(*)
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where scope_grant.user_id = any(${sqlUuidArray(accounts.map((account) => account.id))})
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and scope_grant.valid_until is null
      and reporting_scope.is_active
  ) <> 8 then
    raise exception 'local QA active reporting-scope grant count is invalid';
  end if;

  if (
    select count(*)
    from (values
      ${assignmentValues}
    ) as expected(user_id, role_key, reporting_scope_id)
    join public.user_roles user_role
      on user_role.user_id = expected.user_id
     and user_role.role_key = expected.role_key
    join public.crm_user_reporting_scope_grants scope_grant
      on scope_grant.user_id = expected.user_id
     and scope_grant.reporting_scope_id = expected.reporting_scope_id
     and scope_grant.valid_until is null
     and scope_grant.revoked_at is null
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
     and reporting_scope.is_active
  ) <> 7 then
    raise exception 'local QA role-to-scope assignment is invalid';
  end if;

  if exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = any(${sqlUuidArray(accounts.map((account) => account.id))})
      and profile.is_active
      and profile.access_status = 'approved'
      and user_role.role_key = any(array['user', 'supervisor', 'broker_lead'])
  ) then
    raise exception 'local QA approved a legacy role';
  end if;

  if not exists (
    select 1
    from public.crm_ranking_snapshots ranking_snapshot
    where ranking_snapshot.snapshot_key = ${sqlLiteral(fixtures.commercialRanking.key)}
      and ranking_snapshot.source = ${sqlLiteral(fixtures.commercialRanking.source)}
  ) then
    raise exception 'local QA commercial v2 marker is missing';
  end if;
end
$qa_verify$;

commit;
`;
}

function fixtureObjectIds(fixtures) {
  return {
    organizations: [fixtures.organizationA.id, fixtures.organizationB.id],
    teams: [fixtures.teamA.id, fixtures.teamB.id],
    people: [fixtures.personA.id, fixtures.pendingPerson.id],
    portfolios: [fixtures.portfolioA.id, fixtures.portfolioB.id],
    reportingScopes: Object.values(fixtures.reportingScopes).map((scope) => scope.id),
    teamMemberships: [
      fixtures.teamMembershipId,
      fixtures.pendingCurrentMembershipId,
      fixtures.pendingFutureMembershipId,
    ],
    portfolioOrganizations: [fixtures.portfolioOrganizationAId, fixtures.portfolioOrganizationBId],
  };
}

function cleanupFixturesSql(accounts, fixtures) {
  const userIds = sqlUuidArray(accounts.map((account) => account.id));
  const ids = fixtureObjectIds(fixtures);

  return `
begin;

delete from public.crm_ranking_snapshots
where snapshot_key = ${sqlLiteral(fixtures.commercialRanking.key)}
  and source = ${sqlLiteral(fixtures.commercialRanking.source)};

delete from public.audit_logs
where actor_id = any(${userIds})
   or target_user_id = any(${userIds});

delete from private.crm_reporting_scope_grant_lineage
where owner_user_id = any(${userIds})
   or grant_id in (
     select id
     from public.crm_user_reporting_scope_grants
     where user_id = any(${userIds})
        or granted_by = any(${userIds})
   );

delete from public.crm_user_reporting_scope_grants
where user_id = any(${userIds})
   or granted_by = any(${userIds});

delete from public.crm_team_memberships
where id = any(${sqlUuidArray(ids.teamMemberships)});

delete from public.crm_portfolio_organizations
where id = any(${sqlUuidArray(ids.portfolioOrganizations)});

delete from public.crm_reporting_scopes
where id = any(${sqlUuidArray(ids.reportingScopes)});

delete from public.crm_people
where id = any(${sqlUuidArray(ids.people)});

delete from public.crm_teams
where id = any(${sqlUuidArray(ids.teams)});

delete from public.crm_portfolios
where id = any(${sqlUuidArray(ids.portfolios)});

delete from public.crm_organizations
where id = any(${sqlUuidArray(ids.organizations)});

-- These are synthetic loopback-only acceptances, not legal records. The
-- append-only triggers remain enabled in every runtime and are disabled only
-- transactionally around deletion of the exact ephemeral account IDs.
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

do $qa_cleanup_verify$
begin
  if exists (
    select 1 from public.crm_ranking_snapshots
    where snapshot_key = ${sqlLiteral(fixtures.commercialRanking.key)}
       or source = ${sqlLiteral(fixtures.commercialRanking.source)}
  ) or exists (
    select 1 from public.audit_logs
    where actor_id = any(${userIds}) or target_user_id = any(${userIds})
  ) or exists (
    select 1 from public.crm_user_reporting_scope_grants
    where user_id = any(${userIds}) or granted_by = any(${userIds})
  ) or exists (
    select 1 from private.crm_reporting_scope_grant_lineage
    where owner_user_id = any(${userIds})
       or grant_id in (
         select id
         from public.crm_user_reporting_scope_grants
         where user_id = any(${userIds})
            or granted_by = any(${userIds})
       )
  ) or exists (
    select 1 from public.crm_reporting_scopes
    where id = any(${sqlUuidArray(ids.reportingScopes)})
  ) or exists (
    select 1 from public.crm_organizations
    where id = any(${sqlUuidArray(ids.organizations)})
  ) or exists (
    select 1 from private.legal_acceptances
    where user_id = any(${userIds})
  ) or exists (
    select 1 from private.legal_acceptance_requirements
    where user_id = any(${userIds})
  ) or exists (
    select 1 from public.crm_teams
    where id = any(${sqlUuidArray(ids.teams)})
  ) or exists (
    select 1 from public.crm_people
    where id = any(${sqlUuidArray(ids.people)})
  ) or exists (
    select 1 from public.crm_portfolios
    where id = any(${sqlUuidArray(ids.portfolios)})
  ) or exists (
    select 1 from public.crm_team_memberships
    where id = any(${sqlUuidArray(ids.teamMemberships)})
  ) or exists (
    select 1 from public.crm_portfolio_organizations
    where id = any(${sqlUuidArray(ids.portfolioOrganizations)})
  ) then
    raise exception 'ephemeral local QA fixture cleanup is incomplete';
  end if;
end
$qa_cleanup_verify$;

commit;
`;
}

function proveUserRemovalSql(accounts) {
  const userIds = sqlUuidArray(accounts.map((account) => account.id));
  const textUserIds = `array[${accounts
    .map((account) => sqlLiteral(account.id))
    .join(", ")}]::text[]`;
  return `
do $qa_user_cleanup_verify$
begin
  if exists (select 1 from auth.users where id = any(${userIds}))
     or exists (select 1 from auth.sessions where user_id = any(${userIds}))
     or exists (select 1 from auth.identities where user_id = any(${userIds}))
     or exists (select 1 from auth.refresh_tokens where user_id = any(${textUserIds}))
     or exists (select 1 from public.profiles where user_id = any(${userIds}))
     or exists (select 1 from public.user_roles where user_id = any(${userIds})) then
    raise exception 'ephemeral local QA account cleanup is incomplete';
  end if;
end
$qa_user_cleanup_verify$;
`;
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

  if (error || !data.user) fail("Could not create an ephemeral local QA account.");
  return { id: assertUuid(data.user.id), role, email, password };
}

async function requestLocalRest({ apiUrl, publishableKey, accessToken, pathname, method, body }) {
  const target = new URL(pathname, `${apiUrl}/`);
  if (target.origin !== apiUrl || !target.pathname.startsWith("/rest/v1/")) {
    fail("Local REST request escaped the approved loopback endpoint.");
  }

  let response;
  try {
    response = await fetch(target, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        apikey: publishableKey,
        ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    fail("Direct local PostgREST request failed.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("Direct local PostgREST response was not JSON.");
  }

  return { status: response.status, payload };
}

function assertSuccessfulRows(result, label) {
  if (result.status !== 200 || !Array.isArray(result.payload)) {
    fail(`${label} failed through local PostgREST.`);
  }
  return result.payload;
}

function anonymousResponseRowCount(payload) {
  if (Array.isArray(payload)) return payload.length;
  if (
    payload !== null &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data.length;
  }
  return 0;
}

function assertAnonymousDenied(result, label) {
  const rowCount = anonymousResponseRowCount(result.payload);
  if (![401, 403, 404].includes(result.status) || rowCount !== 0) {
    fail(`${label} did not fail closed for an anonymous PostgREST caller.`);
  }
  return rowCount;
}

async function verifyAnonymousDenials(local) {
  const requests = [
    {
      label: "Qlik runs table",
      method: "GET",
      pathname: "/rest/v1/crm_imob_ranking_runs?select=id&limit=1",
    },
    {
      label: "Qlik entries table",
      method: "GET",
      pathname: "/rest/v1/crm_imob_ranking_entries?select=run_id&limit=1",
    },
    {
      label: "Qlik developments table",
      method: "GET",
      pathname: "/rest/v1/crm_imob_ranking_developments?select=run_id&limit=1",
    },
    {
      label: "Qlik scoped-read RPC",
      method: "POST",
      pathname: "/rest/v1/rpc/list_scoped_crm_imob_ranking_entries",
      body: { p_limit: 1, p_offset: 0 },
    },
    {
      label: "Qlik ingestion RPC",
      method: "POST",
      pathname: "/rest/v1/rpc/ingest_crm_imob_ranking_snapshot",
      body: { p_payload: {} },
    },
    {
      label: "removed legacy Qlik RPC",
      method: "POST",
      pathname: "/rest/v1/rpc/publish_crm_imob_ranking",
      body: { p_payload: {}, p_token: "anonymous-local-qa-proof" },
    },
    {
      label: "commercial ranking read model",
      method: "GET",
      pathname: "/rest/v1/crm_ranking_snapshots?select=id&limit=1",
    },
    {
      label: "application-page catalog",
      method: "GET",
      pathname: "/rest/v1/app_pages?select=key&limit=1",
    },
  ];

  let rowCount = 0;
  for (const request of requests) {
    const result = await requestLocalRest({
      apiUrl: local.apiUrl,
      publishableKey: local.publishableKey,
      method: request.method,
      pathname: request.pathname,
      body: request.body,
    });
    rowCount += assertAnonymousDenied(result, request.label);
  }

  return { denied: requests.length, rows: rowCount };
}

function dualAffiliationDenialProofSql(pendingAccount) {
  return `
do $qa_dual_affiliation_denial$
begin
  if not exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = ${sqlUuid(pendingAccount.id)}
      and not profile.is_active
      and profile.access_status = 'pending'
      and user_role.role_key = 'pending'
  ) or exists (
    select 1
    from public.crm_user_reporting_scope_grants scope_grant
    where scope_grant.user_id = ${sqlUuid(pendingAccount.id)}
  ) then
    raise exception 'dual-affiliation denial changed the pending target';
  end if;
end
$qa_dual_affiliation_denial$;
`;
}

async function verifyDualAffiliationApprovalDenied(local, adminAccount, pendingAccount, fixtures) {
  const client = createLocalClient(local.apiUrl, local.publishableKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: adminAccount.email,
    password: adminAccount.password,
  });
  const accessToken = data.session?.access_token;
  if (error || data.user?.id !== adminAccount.id || !accessToken) {
    fail("Organization Admin could not authenticate for the dual-affiliation exploit proof.");
  }

  try {
    const result = await requestLocalRest({
      ...local,
      accessToken,
      method: "POST",
      pathname: "/rest/v1/rpc/approve_user_access",
      body: {
        target_user_id: pendingAccount.id,
        target_role_key: "broker",
        reporting_scope_ids: [fixtures.reportingScopes.pendingPerson.id],
        reason: "Reject synthetic dual-affiliation approval",
      },
    });

    if (
      result.status !== 403 ||
      result.payload?.code !== "42501" ||
      result.payload?.message !== "forbidden: requested scope is outside actor scope"
    ) {
      fail("Organization Admin dual-affiliation approval did not fail uniformly.");
    }
  } finally {
    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) fail("Dual-affiliation exploit session cleanup failed.");
  }

  runLocalSql(
    local.database,
    dualAffiliationDenialProofSql(pendingAccount),
    "dual-affiliation denial proof",
  );
  return 1;
}

function expectedOrganizationsByRole(fixtures) {
  return {
    master: [fixtures.organizationA.id, fixtures.organizationB.id],
    admin: [fixtures.organizationA.id],
    manager: [fixtures.organizationA.id],
    broker: [fixtures.organizationA.id],
    coordinator: [fixtures.organizationB.id],
    real_estate: [fixtures.organizationB.id],
    house: [fixtures.organizationA.id],
    partnership_channel: [fixtures.organizationA.id],
    pending: [],
  };
}

async function verifyAccountThroughRest(local, account, fixtures) {
  const client = createLocalClient(local.apiUrl, local.publishableKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  const accessToken = data.session?.access_token;
  if (error || data.user?.id !== account.id || !accessToken) {
    fail("Ephemeral QA account could not authenticate against local Supabase.");
  }

  try {
    const fixtureOrganizationIds = [fixtures.organizationA.id, fixtures.organizationB.id];
    const [profileResult, organizationsResult, pagesResult, scopeGrantsResult, commercialResult] =
      await Promise.all([
        requestLocalRest({
          ...local,
          accessToken,
          method: "GET",
          pathname: `/rest/v1/profiles?select=user_id,access_status,is_active&user_id=eq.${account.id}`,
        }),
        requestLocalRest({
          ...local,
          accessToken,
          method: "GET",
          pathname: `/rest/v1/crm_organizations?select=id&id=in.(${fixtureOrganizationIds.join(",")})&order=id.asc`,
        }),
        requestLocalRest({
          ...local,
          accessToken,
          method: "GET",
          pathname: "/rest/v1/app_pages?select=key&order=key.asc",
        }),
        requestLocalRest({
          ...local,
          accessToken,
          method: "GET",
          pathname: `/rest/v1/crm_user_reporting_scope_grants?select=user_id,reporting_scope_id,valid_from,valid_until,revoked_at&user_id=eq.${account.id}`,
        }),
        requestLocalRest({
          ...local,
          accessToken,
          method: "GET",
          pathname: `/rest/v1/crm_ranking_snapshots?select=id,snapshot_key&snapshot_key=eq.${fixtures.commercialRanking.key}`,
        }),
      ]);

    const profiles = assertSuccessfulRows(profileResult, "Own-profile RLS assertion");
    if (
      profiles.length !== 1 ||
      profiles[0].user_id !== account.id ||
      profiles[0].access_status !== (account.role === "pending" ? "pending" : "approved") ||
      profiles[0].is_active !== (account.role !== "pending")
    ) {
      fail("Own-profile RLS assertion returned unexpected rows.");
    }

    const organizations = assertSuccessfulRows(
      organizationsResult,
      "Organization-scope RLS assertion",
    );
    const actualOrganizationIds = organizations.map((row) => row.id).sort();
    const expectedOrganizationIds = expectedOrganizationsByRole(fixtures)[account.role].sort();
    if (JSON.stringify(actualOrganizationIds) !== JSON.stringify(expectedOrganizationIds)) {
      fail("Organization scope or cross-organization denial is incorrect.");
    }

    const pages = assertSuccessfulRows(pagesResult, "Application-page RLS assertion");
    const actualPageKeys = pages.map((page) => page.key).sort();
    if (JSON.stringify(actualPageKeys) !== JSON.stringify(expectedPageKeysByRole[account.role])) {
      fail("Application-page visibility does not match role permissions.");
    }

    const scopeGrants = assertSuccessfulRows(scopeGrantsResult, "Active reporting-scope assertion");
    if (account.role === "pending") {
      if (scopeGrants.length !== 0) fail("Pending account received a reporting scope.");
    } else {
      const currentTime = Date.now();
      const validFrom = Date.parse(scopeGrants[0]?.valid_from);
      const validUntil =
        scopeGrants[0]?.valid_until === null ? null : Date.parse(scopeGrants[0]?.valid_until);
      if (
        scopeGrants.length !== 1 ||
        scopeGrants[0].user_id !== account.id ||
        scopeGrants[0].revoked_at !== null ||
        !Number.isFinite(validFrom) ||
        validFrom > currentTime ||
        (validUntil !== null && (!Number.isFinite(validUntil) || validUntil <= currentTime))
      ) {
        fail("Approved account does not have exactly one active reporting scope.");
      }
    }

    const commercialRows = assertSuccessfulRows(commercialResult, "Commercial v2 RLS assertion");
    const expectedCommercialRows = commercialRankingRoles.has(account.role) ? 1 : 0;
    if (commercialRows.length !== expectedCommercialRows) {
      fail("Commercial v2 visibility diverges from the inherited ranking permission.");
    }

    if (account.role === "pending") {
      const guardedRpcResult = await requestLocalRest({
        ...local,
        accessToken,
        method: "POST",
        pathname: "/rest/v1/rpc/replace_crm_point_settings",
        body: { p_weights: {}, p_targets: {} },
      });
      if (
        guardedRpcResult.status !== 403 ||
        guardedRpcResult.payload?.message !== "forbidden: actor is not approved"
      ) {
        fail("Pending account was not denied by guarded commercial RPC.");
      }
    }
  } finally {
    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) fail("Ephemeral local QA session cleanup failed.");
  }
}

function throwIfInterrupted() {
  if (requestedSignal) fail(`Local RLS API QA interrupted by ${requestedSignal}.`);
}

async function removeEphemeralState(local, adminClient, accounts, fixtures) {
  const failures = [];

  if (accounts.length > 0) {
    try {
      runLocalSql(local.database, cleanupFixturesSql(accounts, fixtures), "fixture cleanup");
    } catch {
      failures.push("fixtures");
    }

    const deletionOrder = [...accounts].sort((left, right) => {
      if (left.role === "master") return 1;
      if (right.role === "master") return -1;
      return 0;
    });
    for (const account of deletionOrder) {
      const { error } = await adminClient.auth.admin.deleteUser(account.id, false);
      if (error) failures.push("account");
    }

    try {
      runLocalSql(local.database, proveUserRemovalSql(accounts), "account cleanup proof");
    } catch {
      failures.push("proof");
    }
  }

  if (failures.length > 0) fail("Ephemeral local QA cleanup was incomplete.");
}

async function main() {
  if (requiredRoles.some((role) => legacyRoles.has(role))) {
    fail("Local RLS API QA cannot approve legacy roles.");
  }

  const local = await discoverLocalSupabase();
  runLocalSql(local.database, preflightSql(), "preflight");
  throwIfInterrupted();

  const browserE2eEnabled = process.env.QA_RELEASE_BROWSER === "true";
  if (process.env.QA_RELEASE_BROWSER && !browserE2eEnabled) {
    fail("QA_RELEASE_BROWSER accepts only the literal true when browser E2E is requested.");
  }
  const nextServer = browserE2eEnabled ? await startLocalNextServer(local) : null;

  const runId = randomBytes(8).toString("hex");
  const runKey = `qa-rls-${runId}`;
  const fixtures = createFixtures(runKey);
  const adminClient = createLocalClient(local.apiUrl, local.secretKey);
  const accounts = [];
  const accountsDestination = persistentAccountsPath();
  let persisted = false;
  let anonymousDenied = 0;
  let anonymousRows = 0;
  let dualAffiliationDenied = 0;
  let browserE2e = 0;

  try {
    for (const role of requiredRoles) {
      accounts.push(await createEphemeralAccount(adminClient, role, runId));
      throwIfInterrupted();
    }

    runLocalSql(local.database, setupSql(accounts, fixtures), "fixture setup");
    throwIfInterrupted();

    const anonymous = await verifyAnonymousDenials(local);
    anonymousDenied = anonymous.denied;
    anonymousRows = anonymous.rows;
    throwIfInterrupted();

    const byRole = Object.fromEntries(accounts.map((account) => [account.role, account]));
    dualAffiliationDenied = await verifyDualAffiliationApprovalDenied(
      local,
      byRole.admin,
      byRole.pending,
      fixtures,
    );
    throwIfInterrupted();

    for (const account of accounts) {
      await verifyAccountThroughRest(local, account, fixtures);
      throwIfInterrupted();
    }

    if (nextServer) {
      await runBrowserE2e(nextServer.origin, local.mailpitUrl, accounts);
      browserE2e = 1;
      throwIfInterrupted();
    }

    if (accountsDestination) {
      await persistSyntheticAccounts(accountsDestination, runId, accounts);
      persisted = true;
    }
  } finally {
    try {
      if (!persisted) {
        await removeEphemeralState(local, adminClient, accounts, fixtures);
      }
    } finally {
      try {
        await stopChild(nextServer?.child);
      } finally {
        if (browserE2eEnabled) {
          await rm(playwrightOutputRoot, { recursive: true, force: true });
        }
      }
    }
  }

  return {
    users: accounts.length,
    profiles: accounts.length,
    organizationRows: 9,
    positivePages: positivePageRoles.size,
    zeroPages: requiredRoles.length - positivePageRoles.size,
    activeScopes: requiredRoles.length - 1,
    commercialAllowed: commercialRankingRoles.size,
    commercialDenied: requiredRoles.length - commercialRankingRoles.size,
    legacyApproved: 0,
    rpcDenials: 1,
    persisted: persisted ? accounts.length : 0,
    removed: persisted ? 0 : accounts.length,
    anonymousDenied,
    anonymousRows,
    dualAffiliationDenied,
    browserE2e,
  };
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    requestedSignal ??= signal;
    for (const child of activeChildren) signalChildGroup(child, signal);
  });
}

try {
  const counts = await main();
  if (requestedSignal) {
    process.exitCode = requestedSignal === "SIGINT" ? 130 : 143;
  } else {
    process.stdout.write(
      `RLS API QA: users=${counts.users} profiles=${counts.profiles} organization_rows=${counts.organizationRows} page_positive=${counts.positivePages} page_zero=${counts.zeroPages} active_scopes=${counts.activeScopes} commercial_allowed=${counts.commercialAllowed} commercial_denied=${counts.commercialDenied} legacy_approved=${counts.legacyApproved} rpc_denials=${counts.rpcDenials} anon_denied=${counts.anonymousDenied} anon_rows=${counts.anonymousRows} dual_affiliation_denied=${counts.dualAffiliationDenied} browser_e2e=${counts.browserE2e} persisted=${counts.persisted} removed=${counts.removed}\n`,
    );
  }
} catch (error) {
  const message =
    error instanceof LocalQaError ? error.message : "Unexpected local RLS API QA failure.";
  process.stderr.write(`RLS API QA failed: ${message}\n`);
  process.exitCode = requestedSignal === "SIGINT" ? 130 : requestedSignal === "SIGTERM" ? 143 : 1;
}
