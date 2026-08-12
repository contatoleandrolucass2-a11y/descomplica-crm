import { randomBytes } from "node:crypto";
import { execFile, spawn, spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const visualHarnessPath = path.join(import.meta.dirname, "authenticated-visual.mjs");
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const requiredFixtureCounts = {
  dashboardViews: 3,
  dashboardMetrics: 15,
  dashboardDevelopments: 15,
  rankingParticipants: 20,
  pointMetrics: 7,
  funnelGoals: 2,
};

const activeChildren = new Set();
let requestedSignal = null;

function environmentSubset(names) {
  return Object.fromEntries(
    names.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  );
}

function parseLoopbackHttpOrigin(rawValue, label) {
  let candidate;
  try {
    candidate = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid HTTP loopback origin.`);
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
    throw new Error(`${label} must be an HTTP loopback origin without credentials or path.`);
  }

  return candidate.origin;
}

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not reserve a loopback QA port.")));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function resolveQaOrigin() {
  if (process.env.QA_AUTH_ORIGIN) {
    const origin = parseLoopbackHttpOrigin(process.env.QA_AUTH_ORIGIN, "QA_AUTH_ORIGIN");
    const candidate = new URL(origin);
    const port = Number(candidate.port || "80");
    if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
      throw new Error("QA_AUTH_ORIGIN must use an unprivileged loopback port.");
    }
    return { origin, hostname: candidate.hostname === "[::1]" ? "::1" : candidate.hostname, port };
  }

  const port = await reserveLoopbackPort();
  return { origin: `http://127.0.0.1:${port}`, hostname: "127.0.0.1", port };
}

function parseLoopbackDatabaseUrl(rawValue) {
  let candidate;
  try {
    candidate = new URL(rawValue);
  } catch {
    throw new Error("Local Supabase returned an invalid database URL.");
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
    throw new Error("Local Supabase database must use a loopback endpoint.");
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
      if (character === "}") {
        throw new Error("Supabase CLI did not return valid local status JSON.");
      }
      if (character !== "{") continue;
      if (candidate !== null) {
        throw new Error("Supabase CLI did not return valid local status JSON.");
      }

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
    throw new Error("Supabase CLI did not return valid local status JSON.");
  }

  return candidate;
}

function parseLocalStatus(stdout) {
  let status;
  try {
    status = JSON.parse(extractSingleTopLevelJsonObject(stdout));
  } catch {
    throw new Error("Supabase CLI did not return valid local status JSON.");
  }

  const apiUrl = parseLoopbackHttpOrigin(status.API_URL, "Local Supabase API URL");
  const database = parseLoopbackDatabaseUrl(status.DB_URL);
  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;

  if (typeof publishableKey !== "string" || publishableKey.length < 20) {
    throw new Error("Local Supabase publishable key is unavailable.");
  }
  if (typeof secretKey !== "string" || secretKey.length < 20) {
    throw new Error("Local Supabase secret key is unavailable.");
  }

  return { apiUrl, database, publishableKey, secretKey };
}

async function discoverLocalSupabase() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "pnpm",
      ["exec", "supabase", "status", "--output", "json", "--workdir", repositoryRoot],
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
    throw new Error("Local Supabase is not running for this repository.");
  }

  return parseLocalStatus(stdout);
}

async function assertReachableLoopback(origin, label, pathname) {
  let response;
  try {
    response = await fetch(`${origin}${pathname}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error(`${label} is not reachable on loopback.`);
  }

  if (response.status >= 500) throw new Error(`${label} returned an unhealthy response.`);
}

async function assertFreshProductionBuild() {
  const buildIdPath = path.join(repositoryRoot, ".next", "BUILD_ID");
  let buildStat;
  try {
    buildStat = await stat(buildIdPath);
  } catch {
    throw new Error("Production build is missing; run pnpm build before local visual QA.");
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
    throw new Error("Could not verify production build freshness.");
  }

  const inputs = [...new Set(stdout.split("\0").filter(Boolean))];
  const inputStats = await Promise.all(inputs.map((file) => stat(path.join(repositoryRoot, file))));
  if (inputStats.some((input) => input.mtimeMs > buildStat.mtimeMs)) {
    throw new Error("Production build is stale; run pnpm build before local visual QA.");
  }
}

async function startLocalNextServer({ hostname, port, origin, apiUrl, publishableKey }) {
  await assertFreshProductionBuild();

  const child = spawn("pnpm", ["start", "--hostname", hostname, "--port", String(port)], {
    cwd: repositoryRoot,
    detached: true,
    env: {
      ...environmentSubset(["PATH", "HOME", "TZ", "NODE_OPTIONS", "LD_LIBRARY_PATH"]),
      NODE_ENV: "production",
      APP_ORIGIN: origin,
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  activeChildren.add(child);
  let spawnError = false;
  child.once("error", () => {
    spawnError = true;
    activeChildren.delete(child);
  });
  child.once("exit", () => activeChildren.delete(child));

  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      throwIfInterrupted();
      if (spawnError || child.exitCode !== null || child.signalCode !== null) {
        throw new Error("Local Next.js production server stopped before becoming ready.");
      }
      try {
        await assertReachableLoopback(origin, "Local Next.js production server", "/login");
        return child;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    throw new Error("Local Next.js production server did not become ready within 30 seconds.");
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

function createAdminClient(apiUrl, secretKey) {
  return createClient(apiUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function assertUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Local Supabase returned an invalid QA user identifier.");
  }
  return value;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
        PGAPPNAME: "descomplica_local_authenticated_visual_qa",
        PGCONNECT_TIMEOUT: "5",
        PGPASSWORD: database.password,
      },
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error(`Local QA database ${purpose} failed.`);
  }
}

function fixtureSetupSql({ marker, userId }) {
  const markerSql = sqlLiteral(marker);
  const userIdSql = `${sqlLiteral(userId)}::uuid`;

  return `
begin;

do $qa_preflight$
begin
  if exists (select 1 from public.crm_dashboard_snapshots where snapshot_key = 'global') then
    raise exception 'reserved dashboard fixture slot is occupied';
  end if;
  if exists (select 1 from public.crm_ranking_snapshots where snapshot_key = 'global') then
    raise exception 'reserved ranking fixture slot is occupied';
  end if;
  if exists (select 1 from public.crm_point_settings where setting_key = 'default') then
    raise exception 'reserved point-settings fixture slot is occupied';
  end if;
  if exists (
    select 1
    from public.crm_funnel_goals
    where profile_key in ('dv', 'partnerships')
      and effective_month = date_trunc('month', timezone('America/Sao_Paulo', now()))::date
  ) then
    raise exception 'reserved funnel-goals fixture slot is occupied';
  end if;
  if exists (
    select 1
    from public.user_roles
    where role_key = 'master'
  ) then
    raise exception 'local visual QA requires a fresh database without a Master fixture';
  end if;
  if not exists (
    select 1
    from public.role_permissions
    where role_key = 'master' and permission_key = 'crm.simulators.view'
  ) then
    raise exception 'simulator permission migration is not applied';
  end if;
  if exists (
    select 1
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
  ) then
    raise exception 'global commercial v2 permissions are not Master-only';
  end if;
  if exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.is_active
      and profile.access_status = 'approved'
      and user_role.role_key = any(array['user', 'supervisor', 'broker_lead'])
  ) then
    raise exception 'approved legacy roles violate the local visual QA contract';
  end if;
end
$qa_preflight$;

select public.bootstrap_master_user(${userIdSql});

update public.profiles
set profile_completed = true
where user_id = ${userIdSql};

insert into public.crm_organizations (organization_key, name, kind)
values (
  'qa-' || replace(${userIdSql}::text, '-', ''),
  'QA synthetic organization',
  'internal'
);

insert into public.crm_dashboard_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  timezone,
  source,
  goals_available
)
values (
  'global',
  timezone('America/Sao_Paulo', now())::date,
  now(),
  'America/Sao_Paulo',
  ${markerSql},
  true
);

insert into public.crm_dashboard_views (
  snapshot_id,
  view_key,
  sales_value_month,
  sales_value_week,
  sales_value_today
)
select
  snapshot.id,
  fixture.view_key,
  fixture.sales_month,
  fixture.sales_week,
  fixture.sales_today
from public.crm_dashboard_snapshots snapshot
cross join (
  values
    ('all', 4500000::numeric, 1200000::numeric, 350000::numeric),
    ('with_canal_imob', 1500000::numeric, 420000::numeric, 120000::numeric),
    ('without_canal_imob', 3000000::numeric, 780000::numeric, 230000::numeric)
) as fixture(view_key, sales_month, sales_week, sales_today)
where snapshot.snapshot_key = 'global' and snapshot.source = ${markerSql};

insert into public.crm_dashboard_metrics (
  snapshot_id,
  view_key,
  stage_key,
  current_month,
  current_week,
  current_today,
  goal_month,
  goal_week,
  goal_today,
  previous_month,
  year_closed_months_average,
  last_three_closed_months_average,
  previous_fourteen_days,
  last_fourteen_days,
  previous_seven_days,
  last_seven_days,
  previous_week,
  yesterday
)
select
  snapshot.id,
  fixture_view.view_key,
  fixture_stage.stage_key,
  round(fixture_stage.current_month * fixture_view.factor)::bigint,
  round(fixture_stage.current_week * fixture_view.factor)::bigint,
  round(fixture_stage.current_today * fixture_view.factor)::bigint,
  round(fixture_stage.goal_month * fixture_view.factor),
  round(fixture_stage.goal_week * fixture_view.factor),
  round(fixture_stage.goal_today * fixture_view.factor),
  round(fixture_stage.previous_month * fixture_view.factor)::bigint,
  round(fixture_stage.year_average * fixture_view.factor),
  round(fixture_stage.three_month_average * fixture_view.factor),
  round(fixture_stage.previous_fourteen * fixture_view.factor)::bigint,
  round(fixture_stage.last_fourteen * fixture_view.factor)::bigint,
  round(fixture_stage.previous_seven * fixture_view.factor)::bigint,
  round(fixture_stage.last_seven * fixture_view.factor)::bigint,
  round(fixture_stage.previous_week * fixture_view.factor)::bigint,
  round(fixture_stage.yesterday * fixture_view.factor)::bigint
from public.crm_dashboard_snapshots snapshot
cross join (
  values
    ('all', 1.00::numeric),
    ('with_canal_imob', 0.35::numeric),
    ('without_canal_imob', 0.65::numeric)
) as fixture_view(view_key, factor)
cross join (
  values
    ('opportunities', 520::numeric, 130::numeric, 26::numeric, 600::numeric, 150::numeric, 30::numeric, 480::numeric, 455::numeric, 470::numeric, 238::numeric, 252::numeric, 118::numeric, 130::numeric, 121::numeric, 23::numeric),
    ('appointments', 210::numeric, 54::numeric, 11::numeric, 250::numeric, 63::numeric, 13::numeric, 198::numeric, 188::numeric, 195::numeric, 96::numeric, 103::numeric, 48::numeric, 54::numeric, 50::numeric, 9::numeric),
    ('visits', 128::numeric, 34::numeric, 7::numeric, 150::numeric, 38::numeric, 8::numeric, 119::numeric, 112::numeric, 116::numeric, 59::numeric, 64::numeric, 30::numeric, 34::numeric, 31::numeric, 6::numeric),
    ('folders', 72::numeric, 19::numeric, 4::numeric, 90::numeric, 23::numeric, 5::numeric, 68::numeric, 63::numeric, 66::numeric, 33::numeric, 37::numeric, 17::numeric, 19::numeric, 18::numeric, 3::numeric),
    ('sales', 29::numeric, 8::numeric, 2::numeric, 35::numeric, 9::numeric, 2::numeric, 27::numeric, 25::numeric, 26::numeric, 13::numeric, 15::numeric, 7::numeric, 8::numeric, 7::numeric, 1::numeric)
) as fixture_stage(
  stage_key,
  current_month,
  current_week,
  current_today,
  goal_month,
  goal_week,
  goal_today,
  previous_month,
  year_average,
  three_month_average,
  previous_fourteen,
  last_fourteen,
  previous_seven,
  last_seven,
  previous_week,
  yesterday
)
where snapshot.snapshot_key = 'global' and snapshot.source = ${markerSql};

insert into public.crm_dashboard_top_developments (snapshot_id, view_key, rank, name, total)
select
  snapshot.id,
  fixture_view.view_key,
  development.rank,
  development.name || ' QA',
  greatest(1, round(development.total * fixture_view.factor)::bigint)
from public.crm_dashboard_snapshots snapshot
cross join (
  values
    ('all', 1.00::numeric),
    ('with_canal_imob', 0.35::numeric),
    ('without_canal_imob', 0.65::numeric)
) as fixture_view(view_key, factor)
cross join (
  values
    (1::smallint, 'Vista Norte', 84::numeric),
    (2::smallint, 'Parque Central', 71::numeric),
    (3::smallint, 'Reserva Sul', 63::numeric),
    (4::smallint, 'Jardins', 52::numeric),
    (5::smallint, 'Horizonte', 44::numeric)
) as development(rank, name, total)
where snapshot.snapshot_key = 'global' and snapshot.source = ${markerSql};

insert into public.crm_point_settings (setting_key, updated_by)
values ('default', ${userIdSql});

insert into public.crm_point_metrics (setting_key, metric_key, weight, target)
values
  ('default', 'roulette', 0, 0),
  ('default', 'roulette_saturday', 0, 0),
  ('default', 'roulette_sunday', 0, 0),
  ('default', 'schedule', 1, 12),
  ('default', 'visit', 7, 8),
  ('default', 'approved_folder', 4, 4),
  ('default', 'sale', 10, 2);

insert into public.crm_ranking_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  timezone,
  source,
  roulette_available
)
values (
  'global',
  timezone('America/Sao_Paulo', now())::date,
  now(),
  'America/Sao_Paulo',
  ${markerSql},
  false
);

insert into public.crm_ranking_participants (
  snapshot_id,
  period_key,
  broker_key,
  broker_name,
  manager_name,
  roulette,
  roulette_saturday,
  roulette_sunday,
  schedule,
  visit,
  approved_folder,
  sale
)
select
  snapshot.id,
  period.period_key,
  broker.broker_key,
  broker.broker_name || ' QA',
  broker.manager_name || ' QA',
  0,
  0,
  0,
  greatest(0, round(broker.schedule * period.factor)::bigint),
  greatest(0, round(broker.visit * period.factor)::bigint),
  greatest(0, round(broker.approved_folder * period.factor)::bigint),
  greatest(0, round(broker.sale * period.factor)::bigint)
from public.crm_ranking_snapshots snapshot
cross join (
  values
    ('month', 1.00::numeric),
    ('last_week', 0.22::numeric),
    ('week', 0.25::numeric),
    ('today', 0.05::numeric)
) as period(period_key, factor)
cross join (
  values
    ('qa-ana', 'Ana Lima', 'Gerência Norte', 18::numeric, 14::numeric, 8::numeric, 5::numeric),
    ('qa-bruno', 'Bruno Reis', 'Gerência Sul', 17::numeric, 12::numeric, 7::numeric, 4::numeric),
    ('qa-carla', 'Carla Luz', 'Gerência Norte', 15::numeric, 11::numeric, 6::numeric, 3::numeric),
    ('qa-diego', 'Diego Melo', 'Gerência Sul', 13::numeric, 10::numeric, 5::numeric, 3::numeric),
    ('qa-elisa', 'Elisa Nunes', 'Gerência Norte', 11::numeric, 8::numeric, 4::numeric, 2::numeric)
) as broker(broker_key, broker_name, manager_name, schedule, visit, approved_folder, sale)
where snapshot.snapshot_key = 'global' and snapshot.source = ${markerSql};

insert into public.crm_funnel_goals (
  profile_key,
  effective_month,
  opportunities,
  appointments,
  visits,
  folders,
  approved_folders,
  sales,
  opportunities_rate,
  appointments_rate,
  visits_rate,
  folders_rate,
  approved_folders_rate,
  broker_minimum_month_1,
  broker_minimum_month_2,
  broker_minimum_month_3,
  broker_minimum_month_4_plus,
  broker_weekly_appointments,
  broker_weekly_visits,
  broker_weekly_folders,
  productive_team_appointments,
  productive_team_visits,
  productive_team_folders,
  productive_team_sales,
  updated_by
)
values
  (
    'dv', date_trunc('month', timezone('America/Sao_Paulo', now()))::date,
    400, 200, 120, 80, 40, 20,
    2, 1.67, 1.5, 2, 2,
    2, 3, 4, 5,
    5, 3, 2,
    80, 70, 60, 50,
    ${userIdSql}
  ),
  (
    'partnerships', date_trunc('month', timezone('America/Sao_Paulo', now()))::date,
    0, 0, 100, 60, 30, 15,
    0, 0, 1.67, 2, 2,
    1, 2, 3, 4,
    0, 3, 2,
    0, 70, 60, 50,
    ${userIdSql}
  );

do $qa_verify$
begin
  if not exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = ${userIdSql}
      and profile.is_active
      and profile.access_status = 'approved'
      and profile.profile_completed
      and user_role.role_key = 'master'
  ) then
    raise exception 'QA authorization fixture is incomplete';
  end if;
  if (
    select count(*)
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where scope_grant.user_id = ${userIdSql}
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and (scope_grant.valid_until is null or scope_grant.valid_until > now())
      and reporting_scope.is_active
      and reporting_scope.scope_type = 'global'
      and reporting_scope.scope_key = 'global'
  ) <> 1 then
    raise exception 'QA active global reporting scope fixture is incomplete';
  end if;
  if exists (
    select 1
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = ${userIdSql}
      and profile.is_active
      and profile.access_status = 'approved'
      and user_role.role_key = any(array['user', 'supervisor', 'broker_lead'])
  ) then
    raise exception 'QA fixture approved a legacy role';
  end if;
  if (
    select count(*)
    from public.crm_dashboard_views
    where snapshot_id = (
      select id from public.crm_dashboard_snapshots
      where snapshot_key = 'global' and source = ${markerSql}
    )
  ) <> ${requiredFixtureCounts.dashboardViews}
    or (
      select count(*)
      from public.crm_dashboard_metrics
      where snapshot_id = (
        select id from public.crm_dashboard_snapshots
        where snapshot_key = 'global' and source = ${markerSql}
      )
    ) <> ${requiredFixtureCounts.dashboardMetrics}
    or (
      select count(*)
      from public.crm_dashboard_top_developments
      where snapshot_id = (
        select id from public.crm_dashboard_snapshots
        where snapshot_key = 'global' and source = ${markerSql}
      )
    ) <> ${requiredFixtureCounts.dashboardDevelopments}
  then
    raise exception 'dashboard fixture is incomplete';
  end if;
  if (
    select count(*)
    from public.crm_ranking_participants
    where snapshot_id = (
      select id from public.crm_ranking_snapshots
      where snapshot_key = 'global' and source = ${markerSql}
    )
  ) <> ${requiredFixtureCounts.rankingParticipants}
    or exists (
      select 1
      from public.crm_ranking_participants
      where snapshot_id = (
        select id from public.crm_ranking_snapshots
        where snapshot_key = 'global' and source = ${markerSql}
      )
        and (roulette <> 0 or roulette_saturday <> 0 or roulette_sunday <> 0)
    )
  then
    raise exception 'ranking fixture is incomplete';
  end if;
  if not exists (
    select 1 from public.crm_point_settings
    where setting_key = 'default' and updated_by = ${userIdSql}
  ) or (select count(*) from public.crm_point_metrics where setting_key = 'default') <> ${requiredFixtureCounts.pointMetrics}
  then
    raise exception 'point fixture marker is missing';
  end if;
  if (
    select count(*) from public.crm_funnel_goals
    where updated_by = ${userIdSql}
      and effective_month = date_trunc('month', timezone('America/Sao_Paulo', now()))::date
  ) <> ${requiredFixtureCounts.funnelGoals}
  then
    raise exception 'funnel fixture marker is missing';
  end if;
  if not exists (
    select 1 from public.crm_dashboard_snapshots
    where snapshot_key = 'global' and source = ${markerSql} and goals_available
  ) or not exists (
    select 1 from public.crm_ranking_snapshots
    where snapshot_key = 'global' and source = ${markerSql} and not roulette_available
  ) then
    raise exception 'snapshot fixture marker is missing';
  end if;
end
$qa_verify$;

commit;
`;
}

function fixtureCleanupSql({ marker, userId }) {
  const markerSql = sqlLiteral(marker);
  const userIdSql = `${sqlLiteral(userId)}::uuid`;

  return `
begin;

delete from public.crm_dashboard_snapshots
where snapshot_key = 'global' and source = ${markerSql};

delete from public.crm_ranking_snapshots
where snapshot_key = 'global' and source = ${markerSql};

delete from public.crm_funnel_goals
where updated_by = ${userIdSql};

delete from public.crm_point_settings
where setting_key = 'default' and updated_by = ${userIdSql};

delete from public.audit_logs
where actor_id = ${userIdSql}
   or target_user_id = ${userIdSql};

delete from private.crm_reporting_scope_grant_lineage
where owner_user_id = ${userIdSql}
   or grant_id in (
     select id
     from public.crm_user_reporting_scope_grants
     where user_id = ${userIdSql}
   );

delete from public.crm_user_reporting_scope_grants
where user_id = ${userIdSql};

delete from public.crm_organizations
where organization_key = 'qa-' || replace(${userIdSql}::text, '-', '');

do $qa_cleanup_verify$
begin
  if exists (select 1 from public.crm_dashboard_snapshots where source = ${markerSql})
    or exists (select 1 from public.crm_ranking_snapshots where source = ${markerSql})
    or exists (select 1 from public.crm_funnel_goals where updated_by = ${userIdSql})
    or exists (select 1 from public.crm_point_settings where updated_by = ${userIdSql})
    or exists (
      select 1 from public.crm_user_reporting_scope_grants
      where user_id = ${userIdSql}
    )
    or exists (
      select 1 from private.crm_reporting_scope_grant_lineage
      where owner_user_id = ${userIdSql}
         or grant_id in (
           select id
           from public.crm_user_reporting_scope_grants
           where user_id = ${userIdSql}
         )
    )
    or exists (
      select 1 from public.audit_logs
      where actor_id = ${userIdSql}
         or target_user_id = ${userIdSql}
    )
    or exists (
      select 1 from public.crm_organizations
      where organization_key = 'qa-' || replace(${userIdSql}::text, '-', '')
    )
    or not exists (
      select 1 from public.crm_reporting_scopes
      where scope_key = 'global'
        and scope_type = 'global'
        and is_active
    )
  then
    raise exception 'ephemeral fixture cleanup is incomplete';
  end if;
end
$qa_cleanup_verify$;

commit;
`;
}

async function createEphemeralQaUser(adminClient, runId) {
  const email = `qa.visual-${runId}@local.invalid`;
  const password = `${randomBytes(36).toString("base64url")}aA1!`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { qa_ephemeral: true, qa_run_id: runId },
  });

  if (error || !data.user) throw new Error("Could not create the ephemeral local QA account.");
  return { id: assertUuid(data.user.id), email, password };
}

async function verifyFixturesThroughRls({ apiUrl, publishableKey, account, marker }) {
  const client = createClient(apiUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signInError || sessionData.user?.id !== account.id) {
    throw new Error("Ephemeral QA account could not authenticate against local Supabase.");
  }

  try {
    const [
      profile,
      userRole,
      scopeGrants,
      dashboardSnapshot,
      rankingSnapshot,
      pointSettings,
      pointMetrics,
      funnelGoals,
    ] = await Promise.all([
      client
        .from("profiles")
        .select("user_id,access_status,is_active")
        .eq("user_id", account.id)
        .single(),
      client.from("user_roles").select("role_key").eq("user_id", account.id).single(),
      client
        .from("crm_user_reporting_scope_grants")
        .select("reporting_scope_id,valid_from,valid_until,revoked_at")
        .eq("user_id", account.id),
      client
        .from("crm_dashboard_snapshots")
        .select("id,source")
        .eq("snapshot_key", "global")
        .eq("source", marker)
        .single(),
      client
        .from("crm_ranking_snapshots")
        .select("id,source,roulette_available")
        .eq("snapshot_key", "global")
        .eq("source", marker)
        .single(),
      client
        .from("crm_point_settings")
        .select("updated_by")
        .eq("setting_key", "default")
        .eq("updated_by", account.id)
        .single(),
      client.from("crm_point_metrics").select("metric_key").eq("setting_key", "default"),
      client.from("crm_funnel_goals").select("profile_key,updated_by").eq("updated_by", account.id),
    ]);

    if (
      [
        profile,
        userRole,
        scopeGrants,
        dashboardSnapshot,
        rankingSnapshot,
        pointSettings,
        pointMetrics,
        funnelGoals,
      ].some((result) => result.error) ||
      !dashboardSnapshot.data?.id ||
      !rankingSnapshot.data?.id
    ) {
      throw new Error("Synthetic fixtures are not readable through QA RLS.");
    }

    const currentTime = Date.now();
    const activeScopeGrant = scopeGrants.data?.[0];
    const validFrom = Date.parse(activeScopeGrant?.valid_from);
    const validUntil =
      activeScopeGrant?.valid_until === null ? null : Date.parse(activeScopeGrant?.valid_until);
    if (
      profile.data?.user_id !== account.id ||
      profile.data.access_status !== "approved" ||
      profile.data.is_active !== true ||
      userRole.data?.role_key !== "master" ||
      scopeGrants.data?.length !== 1 ||
      activeScopeGrant?.revoked_at !== null ||
      !Number.isFinite(validFrom) ||
      validFrom > currentTime ||
      (validUntil !== null && (!Number.isFinite(validUntil) || validUntil <= currentTime))
    ) {
      throw new Error("Master QA authorization or active scope validation failed.");
    }

    const reportingScope = await client
      .from("crm_reporting_scopes")
      .select("scope_key,scope_type,is_active")
      .eq("id", activeScopeGrant.reporting_scope_id)
      .single();
    if (
      reportingScope.error ||
      reportingScope.data?.scope_key !== "global" ||
      reportingScope.data.scope_type !== "global" ||
      reportingScope.data.is_active !== true
    ) {
      throw new Error("Master QA global reporting scope validation failed.");
    }

    const [dashboardViews, dashboardMetrics, dashboardDevelopments, rankingParticipants] =
      await Promise.all([
        client
          .from("crm_dashboard_views")
          .select("view_key")
          .eq("snapshot_id", dashboardSnapshot.data.id),
        client
          .from("crm_dashboard_metrics")
          .select("view_key,stage_key")
          .eq("snapshot_id", dashboardSnapshot.data.id),
        client
          .from("crm_dashboard_top_developments")
          .select("view_key,rank")
          .eq("snapshot_id", dashboardSnapshot.data.id),
        client
          .from("crm_ranking_participants")
          .select("period_key,broker_key,roulette,roulette_saturday,roulette_sunday")
          .eq("snapshot_id", rankingSnapshot.data.id),
      ]);

    if (
      [dashboardViews, dashboardMetrics, dashboardDevelopments, rankingParticipants].some(
        (result) => result.error,
      )
    ) {
      throw new Error("Synthetic fixture children are not readable through QA RLS.");
    }

    if (
      dashboardSnapshot.data.source !== marker ||
      dashboardViews.data?.length !== requiredFixtureCounts.dashboardViews ||
      dashboardMetrics.data?.length !== requiredFixtureCounts.dashboardMetrics ||
      dashboardDevelopments.data?.length !== requiredFixtureCounts.dashboardDevelopments ||
      rankingSnapshot.data.source !== marker ||
      rankingSnapshot.data.roulette_available !== false ||
      rankingParticipants.data?.length !== requiredFixtureCounts.rankingParticipants ||
      rankingParticipants.data.some(
        (row) => row.roulette !== 0 || row.roulette_saturday !== 0 || row.roulette_sunday !== 0,
      ) ||
      pointSettings.data?.updated_by !== account.id ||
      pointMetrics.data?.length !== requiredFixtureCounts.pointMetrics ||
      funnelGoals.data?.length !== requiredFixtureCounts.funnelGoals ||
      funnelGoals.data.some((row) => row.updated_by !== account.id)
    ) {
      throw new Error("Synthetic fixture markers failed authenticated validation.");
    }
  } finally {
    await client.auth.signOut({ scope: "global" });
  }
}

function runVisualHarness({ origin, apiUrl, publishableKey, account, marker }) {
  const requestedArguments = process.argv.slice(2);
  if (
    requestedArguments.length > 1 ||
    (requestedArguments.length === 1 && requestedArguments[0] !== "--update-baseline")
  ) {
    throw new Error("Authenticated visual QA accepts only the optional --update-baseline flag.");
  }
  const childEnvironment = {
    ...environmentSubset([
      "PATH",
      "HOME",
      "CI",
      "TZ",
      "NODE_OPTIONS",
      "PLAYWRIGHT_BROWSERS_PATH",
      "LD_LIBRARY_PATH",
    ]),
    QA_AUTH_ORIGIN: origin,
    QA_AUTH_EMAIL: account.email,
    QA_AUTH_PASSWORD: account.password,
    QA_AUTH_SUPABASE_URL: apiUrl,
    QA_AUTH_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    QA_AUTH_FIXTURE_VERIFICATION: "rls-marker-v1",
    QA_AUTH_EXPECTED_SOURCE_MARKER: marker,
  };

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [visualHarnessPath, ...requestedArguments], {
      cwd: repositoryRoot,
      detached: true,
      env: childEnvironment,
      stdio: ["ignore", "inherit", "inherit"],
    });
    activeChildren.add(child);
    let settled = false;

    child.once("error", () => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      reject(new Error("Authenticated visual QA process could not start."));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`Authenticated visual QA process failed (${signal || code}).`));
    });
  });
}

function throwIfInterrupted() {
  if (requestedSignal) throw new Error(`Interrupted by ${requestedSignal}.`);
}

async function main() {
  const local = await discoverLocalSupabase();
  await assertReachableLoopback(local.apiUrl, "Local Supabase API", "/auth/v1/health");
  throwIfInterrupted();

  const qaEndpoint = await resolveQaOrigin();
  const nextServer = await startLocalNextServer({
    ...qaEndpoint,
    apiUrl: local.apiUrl,
    publishableKey: local.publishableKey,
  });
  const { origin } = qaEndpoint;
  throwIfInterrupted();

  const runId = `${Date.now()}-${randomBytes(6).toString("hex")}`;
  const marker = `QA local synthetic — not production · run ${runId}`;
  const adminClient = createAdminClient(local.apiUrl, local.secretKey);
  let account = null;
  let cleanupPromise = null;

  const cleanup = () => {
    cleanupPromise ??= (async () => {
      const failures = [];

      if (account) {
        try {
          runLocalSql(local.database, fixtureCleanupSql({ marker, userId: account.id }), "cleanup");
        } catch (error) {
          failures.push(error);
        }
      }

      if (account) {
        const { error } = await adminClient.auth.admin.deleteUser(account.id, false);
        if (error) {
          failures.push(new Error("Ephemeral local QA account cleanup failed."));
        } else {
          const lookup = await adminClient.auth.admin.getUserById(account.id);
          if (
            lookup.data?.user ||
            lookup.error?.status !== 404 ||
            lookup.error?.code !== "user_not_found"
          ) {
            failures.push(new Error("Ephemeral local QA account still exists after cleanup."));
          } else {
            account = null;
          }
        }
      }

      if (failures.length > 0) {
        throw new AggregateError(failures, "Ephemeral local QA cleanup was incomplete.");
      }
    })();
    return cleanupPromise;
  };

  try {
    try {
      account = await createEphemeralQaUser(adminClient, runId);
      throwIfInterrupted();
      runLocalSql(local.database, fixtureSetupSql({ marker, userId: account.id }), "fixture setup");
      throwIfInterrupted();
      await verifyFixturesThroughRls({
        apiUrl: local.apiUrl,
        publishableKey: local.publishableKey,
        account,
        marker,
      });
      throwIfInterrupted();
      await runVisualHarness({
        origin,
        apiUrl: local.apiUrl,
        publishableKey: local.publishableKey,
        account,
        marker,
      });
    } finally {
      await cleanup();
    }
  } finally {
    await stopChild(nextServer);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (requestedSignal) return;
    requestedSignal = signal;
    for (const child of activeChildren) {
      signalChildGroup(child, signal);
    }
  });
}

try {
  await main();
  if (requestedSignal) {
    process.exitCode = requestedSignal === "SIGINT" ? 130 : 143;
  } else {
    process.stdout.write(
      "Local authenticated QA passed; ephemeral account and fixtures removed.\n",
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown local QA failure.";
  process.stderr.write(`Local authenticated QA failed: ${message}\n`);
  process.exitCode = requestedSignal === "SIGINT" ? 130 : requestedSignal === "SIGTERM" ? 143 : 1;
}
