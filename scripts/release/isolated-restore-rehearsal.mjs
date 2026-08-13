import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sourceSupabaseRoot = path.join(repositoryRoot, "supabase");
const expectedPgTapTests = 922;
const applicationSchemas = ["commercial_engine", "private", "public", "qlik_relay"];
const applicationRoles = ["crm_commercial_engine", "crm_qlik_relay"];
const excludedServices = [
  "gotrue",
  "realtime",
  "storage-api",
  "imgproxy",
  "kong",
  "mailpit",
  "postgrest",
  "postgres-meta",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "supavisor",
].join(",");
const safeEnvironmentNames = ["PATH", "HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "TMPDIR"];

function environmentSubset(names) {
  return Object.fromEntries(
    names.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  );
}

let commandEnvironment = {
  ...environmentSubset(safeEnvironmentNames),
  NO_COLOR: "1",
  TZ: "UTC",
};
let interruptedSignal = null;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interruptedSignal ??= signal;
  });
}

function assertNotInterrupted() {
  if (interruptedSignal) throw new Error(`Interrupted by ${interruptedSignal}.`);
}

function sanitizeDiagnostic(value) {
  return String(value ?? "")
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"']+/gi, "[redacted-database-url]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)(?:[^\s/@:]+):(?:[^\s/@]+)@/gi, "$1[redacted]@")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b(?:sbp|sb_secret|sb_publishable)_[A-Za-z0-9_-]{8,}\b/gi, "[redacted-supabase-key]")
    .replace(
      /((?:authorization|api[_ -]?key|anon[_ -]?key|service[_ -]?role[_ -]?key|token|secret|password)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[redacted]",
    );
}

function commandFailure(command, result, label) {
  const diagnostic = sanitizeDiagnostic(
    `${result.stderr?.toString?.() ?? result.stderr ?? ""}\n${
      result.stdout?.toString?.() ?? result.stdout ?? ""
    }`,
  )
    .trim()
    .split("\n")
    .slice(-12)
    .join("\n")
    .slice(-2_000);
  return new Error(
    `${label ?? command} failed in the isolated local rehearsal.${
      diagnostic ? `\n${diagnostic}` : ""
    }`,
  );
}

function run(command, args, options = {}) {
  if (!options.cleanup) assertNotInterrupted();
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    env: options.env ?? commandEnvironment,
    input: options.input,
  });
  if (result.error || result.status !== 0) {
    throw commandFailure(command, result, options.label);
  }
  return result.stdout;
}

function runBuffer(command, args, options = {}) {
  assertNotInterrupted();
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: null,
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    env: options.env ?? commandEnvironment,
    input: options.input,
  });
  if (result.error || result.status !== 0) {
    throw commandFailure(command, result, options.label);
  }
  return result.stdout;
}

function runUnchecked(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    env: options.env ?? commandEnvironment,
    input: options.input,
  });
}

function runSupabase(projectRoot, args, label) {
  return run("pnpm", ["exec", "supabase", ...args, "--workdir", projectRoot], {
    cwd: repositoryRoot,
    label,
  });
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function migrationMetadata(name, contents) {
  const match = /^(\d{14})_(.+)\.sql$/.exec(name);
  if (!match) throw new Error(`Invalid migration filename: ${name}`);
  return { version: match[1], name: match[2], sha256: sha256(contents) };
}

async function readMigrationManifest() {
  const directory = await readdir(path.join(sourceSupabaseRoot, "migrations"));
  const names = directory.filter((name) => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const name of names) {
    const contents = await readFile(path.join(sourceSupabaseRoot, "migrations", name));
    migrations.push(migrationMetadata(name, contents));
  }
  if (
    migrations.length === 0 ||
    new Set(migrations.map(({ version }) => version)).size !== migrations.length
  ) {
    throw new Error("Migration versions must be non-empty and unique.");
  }
  return migrations;
}

async function readPgTapPlan() {
  const directory = path.join(sourceSupabaseRoot, "tests");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  let total = 0;
  for (const name of names) {
    const contents = await readFile(path.join(directory, name), "utf8");
    const plans = [...contents.matchAll(/^\s*select\s+plan\(\s*(\d+)\s*\)\s*;/gim)];
    if (plans.length !== 1) {
      throw new Error(`pgTAP file must declare exactly one plan: ${name}`);
    }
    total += Number(plans[0][1]);
  }
  if (names.length === 0 || total !== expectedPgTapTests) {
    throw new Error(
      `Expected ${expectedPgTapTests} planned pgTAP tests, found ${total} across ${names.length} files.`,
    );
  }
  return { files: names.length, tests: total };
}

async function captureProvenance(excludedEvidencePath) {
  const captureCommit = run("git", ["rev-parse", "HEAD"], { label: "source commit" }).trim();
  const pathspec = [".", ...(excludedEvidencePath ? [`:(exclude)${excludedEvidencePath}`] : [])];
  const diff = run("git", ["diff", "HEAD", "--binary", "--", ...pathspec], {
    label: "worktree provenance",
    maxBuffer: 128 * 1024 * 1024,
  });
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    label: "untracked provenance",
  })
    .split("\0")
    .filter(Boolean)
    .filter((file) => file !== excludedEvidencePath)
    .sort();
  const fingerprint = createHash("sha256").update("head-diff\0").update(diff);
  for (const file of untracked) {
    fingerprint.update("untracked\0").update(file).update("\0");
    fingerprint.update(await readFile(path.join(repositoryRoot, file)));
  }
  return {
    captureCommit,
    worktreeDirtyAtRehearsal: diff.length > 0 || untracked.length > 0,
    worktreeFingerprint: fingerprint.digest("hex"),
    worktreeFingerprintAlgorithm: "sha256-git-diff-head-and-untracked-v1",
  };
}

function unixSocketPath(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Effective Docker endpoint must be a local Unix socket.");
  }
  if (
    parsed.protocol !== "unix:" ||
    parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Effective Docker endpoint must be a local Unix socket.");
  }
  const socketPath = decodeURIComponent(parsed.pathname);
  if (!path.isAbsolute(socketPath)) {
    throw new Error("Effective Docker Unix socket path must be absolute.");
  }
  return socketPath;
}

async function pinLocalDockerEndpoint() {
  const configuredHost = process.env.DOCKER_HOST?.trim();
  let endpoint;
  if (configuredHost) {
    endpoint = configuredHost;
  } else {
    const context = run("docker", ["context", "show"], {
      label: "Docker context discovery",
      env: commandEnvironment,
    }).trim();
    if (!context) throw new Error("Could not determine the effective Docker context.");
    endpoint = run(
      "docker",
      ["context", "inspect", context, "--format", '{{(index .Endpoints "docker").Host}}'],
      { label: "Docker endpoint discovery", env: commandEnvironment },
    ).trim();
  }

  const socketPath = unixSocketPath(endpoint);
  let socketStatus;
  try {
    socketStatus = await stat(socketPath);
  } catch {
    throw new Error("Effective Docker Unix socket does not exist.");
  }
  if (!socketStatus.isSocket()) {
    throw new Error("Effective Docker endpoint is not a Unix socket.");
  }

  commandEnvironment = { ...commandEnvironment, DOCKER_HOST: endpoint };
  run("docker", ["version", "--format", "{{.Server.Version}}"], {
    label: "local Docker daemon verification",
  });
}

function patchConfig(contents, projectId, ports) {
  const replacements = new Map([
    ["54320", String(ports.shadow)],
    ["54321", String(ports.api)],
    ["54322", String(ports.database)],
    ["54323", String(ports.studio)],
    ["54324", String(ports.mail)],
    ["54327", String(ports.analytics)],
    ["54329", String(ports.pooler)],
    ["8083", String(ports.inspector)],
  ]);
  const projectMatches = contents.match(/^project_id\s*=.*$/gm) ?? [];
  if (projectMatches.length !== 1) {
    throw new Error("Supabase config must contain exactly one active project_id.");
  }
  let patched = contents.replace(/^project_id\s*=.*$/m, `project_id = "${projectId}"`);
  for (const [current, replacement] of replacements) {
    const occurrences = patched.split(current).length - 1;
    if (occurrences !== 1) {
      throw new Error(`Supabase config port ${current} must occur exactly once.`);
    }
    patched = patched.replaceAll(current, replacement);
  }
  const seedPattern = /(\[db\.seed\][\s\S]*?^\s*enabled\s*=\s*)true/m;
  if (!seedPattern.test(patched)) {
    throw new Error("Supabase config must contain one enabled db.seed section.");
  }
  patched = patched.replace(seedPattern, "$1false");
  return patched;
}

function portBlocks() {
  const start = 50_000 + (Number.parseInt(randomBytes(2).toString("hex"), 16) % 12_000);
  const block = (offset) => ({
    api: start + offset,
    database: start + offset + 1,
    shadow: start + offset + 2,
    pooler: start + offset + 3,
    studio: start + offset + 4,
    mail: start + offset + 5,
    analytics: start + offset + 6,
    inspector: start + offset + 7,
  });
  return { source: block(0), target: block(16) };
}

async function prepareProject(projectRoot, projectId, ports, includeMigrations) {
  const supabaseRoot = path.join(projectRoot, "supabase");
  await mkdir(supabaseRoot, { recursive: true });
  const copies = [
    cp(path.join(sourceSupabaseRoot, "tests"), path.join(supabaseRoot, "tests"), {
      recursive: true,
    }),
  ];
  if (includeMigrations) {
    copies.push(
      cp(path.join(sourceSupabaseRoot, "migrations"), path.join(supabaseRoot, "migrations"), {
        recursive: true,
      }),
      cp(path.join(sourceSupabaseRoot, "seed.sql"), path.join(supabaseRoot, "seed.sql")),
    );
  } else {
    copies.push(
      mkdir(path.join(supabaseRoot, "migrations"), { recursive: true }),
      writeFile(path.join(supabaseRoot, "seed.sql"), "-- disabled for isolated restore\n", {
        mode: 0o600,
      }),
    );
  }
  await Promise.all(copies);
  const config = await readFile(path.join(sourceSupabaseRoot, "config.toml"), "utf8");
  await writeFile(path.join(supabaseRoot, "config.toml"), patchConfig(config, projectId, ports), {
    mode: 0o600,
  });
}

function exactDatabaseContainer(projectId) {
  const names = run(
    "docker",
    ["ps", "--filter", `label=com.supabase.cli.project=${projectId}`, "--format", "{{.Names}}"],
    { label: "isolated database container discovery" },
  )
    .trim()
    .split("\n")
    .filter((name) => name.startsWith("supabase_db_"));
  if (names.length !== 1 || names[0] !== `supabase_db_${projectId}`) {
    throw new Error("Could not identify exactly one isolated Supabase database container.");
  }
  return names[0];
}

function dockerDatabase(container, database, sql) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--username",
      "postgres",
      "--dbname",
      database,
    ],
    { input: sql, label: `isolated ${database} verification`, maxBuffer: 128 * 1024 * 1024 },
  ).trim();
}

function bootstrapApplicationRoles(container) {
  dockerDatabase(
    container,
    "postgres",
    `
do $bootstrap_roles$
begin
  if exists (
    select 1 from pg_catalog.pg_roles
    where rolname in ('crm_qlik_relay', 'crm_commercial_engine')
  ) then
    raise exception 'application role unexpectedly exists in clean restore target';
  end if;

  create role crm_qlik_relay
    nologin nosuperuser nocreatedb nocreaterole noinherit noreplication
    nobypassrls connection limit 2;
  create role crm_commercial_engine
    nologin nosuperuser nocreatedb nocreaterole noinherit noreplication
    nobypassrls connection limit 2;
end
$bootstrap_roles$;

alter role crm_qlik_relay set statement_timeout = '35s';
alter role crm_qlik_relay set lock_timeout = '5s';
alter role crm_qlik_relay set idle_in_transaction_session_timeout = '10s';
alter role crm_qlik_relay set search_path = pg_catalog;
alter role crm_commercial_engine set statement_timeout = '15s';
alter role crm_commercial_engine set lock_timeout = '5s';
alter role crm_commercial_engine set idle_in_transaction_session_timeout = '10s';
alter role crm_commercial_engine set search_path = pg_catalog;
`,
  );
}

function createRestoreDatabase(container, database) {
  run(
    "docker",
    [
      "exec",
      container,
      "createdb",
      "--username",
      "postgres",
      "--owner",
      "postgres",
      "--template",
      "template0",
      database,
    ],
    { label: "isolated restore database creation" },
  );
}

function logicalDump(container) {
  return runBuffer(
    "docker",
    [
      "exec",
      container,
      "pg_dump",
      "--username",
      "supabase_admin",
      "--dbname",
      "postgres",
      "--format",
      "custom",
      "--serializable-deferrable",
    ],
    { label: "isolated logical backup" },
  );
}

function restoreLogicalDump(container, database, dump) {
  run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "--username",
      "supabase_admin",
      "--dbname",
      database,
      "--single-transaction",
      "--exit-on-error",
    ],
    { input: dump, label: "isolated logical restore", maxBuffer: 128 * 1024 * 1024 },
  );
}

const canonicalFingerprintSql = String.raw`
set timezone = 'UTC';
set datestyle = 'ISO, YMD';
set intervalstyle = 'postgres';
set bytea_output = 'hex';
set extra_float_digits = 3;

create or replace function pg_temp.rc_application_data_fingerprint()
returns jsonb
language plpgsql
set search_path = pg_catalog
as $fingerprint$
declare
  relation record;
  sequence_record record;
  row_count bigint;
  value_hash text;
  result jsonb := '[]'::jsonb;
begin
  for relation in
    select namespace.nspname as schema_name, class.relname as relation_name
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
      and ((class.relkind = 'r' and not class.relispartition) or class.relkind = 'p')
    order by namespace.nspname, class.relname
  loop
    execute pg_catalog.format(
      'select count(*)::bigint, pg_catalog.encode(extensions.digest(pg_catalog.convert_to(coalesce(pg_catalog.jsonb_agg(row_value order by row_value::text), ''[]''::jsonb)::text, ''UTF8''), ''sha256''), ''hex'') from (select pg_catalog.to_jsonb(source_row) as row_value from %I.%I source_row) rows',
      relation.schema_name,
      relation.relation_name
    ) into row_count, value_hash;
    result := result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'schema', relation.schema_name,
      'name', relation.relation_name,
      'kind', 'table',
      'row_count', row_count,
      'sha256', value_hash
    ));
  end loop;

  for sequence_record in
    select namespace.nspname as schema_name, class.relname as sequence_name
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
      and class.relkind = 'S'
    order by namespace.nspname, class.relname
  loop
    execute pg_catalog.format(
      'select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(''last_value'', last_value, ''is_called'', is_called)::text, ''UTF8''), ''sha256''), ''hex'') from %I.%I',
      sequence_record.schema_name,
      sequence_record.sequence_name
    ) into value_hash;
    result := result || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'schema', sequence_record.schema_name,
      'name', sequence_record.sequence_name,
      'kind', 'sequence',
      'sha256', value_hash
    ));
  end loop;
  return result;
end
$fingerprint$;

with
schema_rows as (
  select namespace.nspname as schema_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'owner', pg_catalog.pg_get_userbyid(namespace.nspowner),
      'acl', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantee', privilege.grantee,
          'privilege', privilege.privilege_type,
          'grantable', privilege.is_grantable
        ) order by privilege.grantee, privilege.privilege_type, privilege.is_grantable), '[]'::jsonb)
        from (
          select case when acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
            acl.privilege_type,
            pg_catalog.bool_or(acl.is_grantable) as is_grantable
          from (
            select explicit_acl.grantee, explicit_acl.privilege_type, explicit_acl.is_grantable
            from pg_catalog.aclexplode(coalesce(
              namespace.nspacl,
              pg_catalog.acldefault('n'::"char", namespace.nspowner)
            )) explicit_acl
            union all
            select owner_acl.grantee, owner_acl.privilege_type, owner_acl.is_grantable
            from pg_catalog.aclexplode(
              pg_catalog.acldefault('n'::"char", namespace.nspowner)
            ) owner_acl
            where owner_acl.grantee = namespace.nspowner
          ) acl
          group by acl.grantee, acl.privilege_type
        ) privilege
      )
    ) as value
  from pg_catalog.pg_namespace namespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
schemas as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name), '[]'::jsonb) as value,
    count(*)::bigint as count
  from schema_rows
),
relation_rows as (
  select namespace.nspname as schema_name, class.relname as object_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'name', class.relname,
      'kind', class.relkind,
      'owner', pg_catalog.pg_get_userbyid(class.relowner),
      'persistence', class.relpersistence,
      'row_security', class.relrowsecurity,
      'force_row_security', class.relforcerowsecurity,
      'replica_identity', class.relreplident,
      'is_partition', class.relispartition,
      'partition_bound', case when class.relispartition then pg_catalog.pg_get_expr(class.relpartbound, class.oid, true) end,
      'view_definition', case when class.relkind in ('v', 'm') then pg_catalog.pg_get_viewdef(class.oid, true) end,
      'options', (
        select coalesce(pg_catalog.jsonb_agg(option order by option), '[]'::jsonb)
        from pg_catalog.unnest(coalesce(class.reloptions, '{}'::text[])) option
      ),
      'acl', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantee', privilege.grantee,
          'privilege', privilege.privilege_type,
          'grantable', privilege.is_grantable
        ) order by privilege.grantee, privilege.privilege_type, privilege.is_grantable), '[]'::jsonb)
        from (
          select case when acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
            acl.privilege_type,
            pg_catalog.bool_or(acl.is_grantable) as is_grantable
          from (
            select explicit_acl.grantee, explicit_acl.privilege_type, explicit_acl.is_grantable
            from pg_catalog.aclexplode(coalesce(
              class.relacl,
              pg_catalog.acldefault(
                case when class.relkind = 'S' then 's'::"char" else 'r'::"char" end,
                class.relowner
              )
            )) explicit_acl
            union all
            select owner_acl.grantee, owner_acl.privilege_type, owner_acl.is_grantable
            from pg_catalog.aclexplode(pg_catalog.acldefault(
              case when class.relkind = 'S' then 's'::"char" else 'r'::"char" end,
              class.relowner
            )) owner_acl
            where owner_acl.grantee = class.relowner
          ) acl
          group by acl.grantee, acl.privilege_type
        ) privilege
      ),
      'columns', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'position', attribute.attnum,
          'name', attribute.attname,
          'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
          'not_null', attribute.attnotnull,
          'identity', attribute.attidentity,
          'generated', attribute.attgenerated,
          'collation', case when attribute.attcollation = 0 then null else pg_catalog.format('%I.%I', collation_namespace.nspname, collation_row.collname) end,
          'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true),
          'acl', (
            select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'grantee', column_privilege.grantee,
              'privilege', column_privilege.privilege_type,
              'grantable', column_privilege.is_grantable
            ) order by column_privilege.grantee, column_privilege.privilege_type, column_privilege.is_grantable), '[]'::jsonb)
            from (
              select case when column_acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(column_acl.grantee) end as grantee,
                column_acl.privilege_type,
                pg_catalog.bool_or(column_acl.is_grantable) as is_grantable
              from pg_catalog.aclexplode(attribute.attacl) column_acl
              group by column_acl.grantee, column_acl.privilege_type
            ) column_privilege
          )
        ) order by attribute.attnum), '[]'::jsonb)
        from pg_catalog.pg_attribute attribute
        left join pg_catalog.pg_attrdef default_value
          on default_value.adrelid = attribute.attrelid and default_value.adnum = attribute.attnum
        left join pg_catalog.pg_collation collation_row on collation_row.oid = attribute.attcollation
        left join pg_catalog.pg_namespace collation_namespace on collation_namespace.oid = collation_row.collnamespace
        where attribute.attrelid = class.oid and attribute.attnum > 0 and not attribute.attisdropped
      )
    ) as value
  from pg_catalog.pg_class class
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
    and class.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
),
relations as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name), '[]'::jsonb) as value,
    count(*)::bigint as count,
    count(*) filter (where value ->> 'kind' in ('r', 'p'))::bigint as table_count
  from relation_rows
),
policy_rows as (
  select namespace.nspname as schema_name, class.relname as object_name, policy.polname as policy_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'table', class.relname,
      'name', policy.polname,
      'permissive', policy.polpermissive,
      'command', policy.polcmd,
      'roles', (
        select coalesce(pg_catalog.jsonb_agg(role_name order by role_name), '[]'::jsonb)
        from (
          select case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end as role_name
          from pg_catalog.unnest(policy.polroles) role_oid
        ) policy_role
      ),
      'using', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true),
      'with_check', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, true)
    ) as value
  from pg_catalog.pg_policy policy
  join pg_catalog.pg_class class on class.oid = policy.polrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
policies as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name, policy_name), '[]'::jsonb) as value,
    count(*)::bigint as count
  from policy_rows
),
function_rows as (
  select namespace.nspname as schema_name, procedure.proname as object_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'name', procedure.proname,
      'identity_arguments', pg_catalog.pg_get_function_identity_arguments(procedure.oid),
      'result', pg_catalog.pg_get_function_result(procedure.oid),
      'kind', procedure.prokind,
      'language', language.lanname,
      'owner', pg_catalog.pg_get_userbyid(procedure.proowner),
      'security_definer', procedure.prosecdef,
      'leakproof', procedure.proleakproof,
      'strict', procedure.proisstrict,
      'volatility', procedure.provolatile,
      'parallel', procedure.proparallel,
      'configuration', (
        select coalesce(pg_catalog.jsonb_agg(setting order by setting), '[]'::jsonb)
        from pg_catalog.unnest(coalesce(procedure.proconfig, '{}'::text[])) setting
      ),
      'search_path', (
        select setting from pg_catalog.unnest(coalesce(procedure.proconfig, '{}'::text[])) setting
        where setting like 'search_path=%' order by setting limit 1
      ),
      'definition_sha256', case when procedure.prokind in ('f', 'p') then
        pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(procedure.oid), 'UTF8'), 'sha256'), 'hex')
      else
        pg_catalog.encode(extensions.digest(pg_catalog.convert_to(procedure.prosrc, 'UTF8'), 'sha256'), 'hex')
      end,
      'acl', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantee', privilege.grantee,
          'privilege', privilege.privilege_type,
          'grantable', privilege.is_grantable
        ) order by privilege.grantee, privilege.privilege_type, privilege.is_grantable), '[]'::jsonb)
        from (
          select case when acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
            acl.privilege_type,
            pg_catalog.bool_or(acl.is_grantable) as is_grantable
          from (
            select explicit_acl.grantee, explicit_acl.privilege_type, explicit_acl.is_grantable
            from pg_catalog.aclexplode(coalesce(
              procedure.proacl,
              pg_catalog.acldefault('f'::"char", procedure.proowner)
            )) explicit_acl
            union all
            select owner_acl.grantee, owner_acl.privilege_type, owner_acl.is_grantable
            from pg_catalog.aclexplode(
              pg_catalog.acldefault('f'::"char", procedure.proowner)
            ) owner_acl
            where owner_acl.grantee = procedure.proowner
          ) acl
          group by acl.grantee, acl.privilege_type
        ) privilege
      )
    ) as value
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_language language on language.oid = procedure.prolang
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
functions as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name, identity_arguments), '[]'::jsonb) as value,
    count(*)::bigint as count
  from function_rows
),
constraint_rows as (
  select namespace.nspname as schema_name, class.relname as object_name, constraint_row.conname as constraint_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'table', class.relname,
      'name', constraint_row.conname,
      'type', constraint_row.contype,
      'validated', constraint_row.convalidated,
      'deferrable', constraint_row.condeferrable,
      'deferred', constraint_row.condeferred,
      'local', constraint_row.conislocal,
      'no_inherit', constraint_row.connoinherit,
      'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
    ) as value
  from pg_catalog.pg_constraint constraint_row
  join pg_catalog.pg_class class on class.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
constraints as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name, constraint_name), '[]'::jsonb) as value,
    count(*)::bigint as count
  from constraint_rows
),
index_rows as (
  select namespace.nspname as schema_name, table_class.relname as object_name, index_class.relname as index_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'table', table_class.relname,
      'name', index_class.relname,
      'owner', pg_catalog.pg_get_userbyid(index_class.relowner),
      'unique', index_row.indisunique,
      'primary', index_row.indisprimary,
      'exclusion', index_row.indisexclusion,
      'immediate', index_row.indimmediate,
      'clustered', index_row.indisclustered,
      'replica_identity', index_row.indisreplident,
      'valid', index_row.indisvalid,
      'ready', index_row.indisready,
      'live', index_row.indislive,
      'definition', pg_catalog.pg_get_indexdef(index_row.indexrelid, 0, true)
    ) as value
  from pg_catalog.pg_index index_row
  join pg_catalog.pg_class table_class on table_class.oid = index_row.indrelid
  join pg_catalog.pg_class index_class on index_class.oid = index_row.indexrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = table_class.relnamespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
indexes as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name, index_name), '[]'::jsonb) as value,
    count(*)::bigint as count
  from index_rows
),
trigger_rows as (
  select namespace.nspname as schema_name, class.relname as object_name, trigger_row.tgname as trigger_name,
    pg_catalog.jsonb_build_object(
      'schema', namespace.nspname,
      'table', class.relname,
      'name', trigger_row.tgname,
      'enabled', trigger_row.tgenabled,
      'function', pg_catalog.format('%I.%I(%s)', function_namespace.nspname, procedure.proname, pg_catalog.pg_get_function_identity_arguments(procedure.oid)),
      'definition', pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
    ) as value
  from pg_catalog.pg_trigger trigger_row
  join pg_catalog.pg_class class on class.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  join pg_catalog.pg_proc procedure on procedure.oid = trigger_row.tgfoid
  join pg_catalog.pg_namespace function_namespace on function_namespace.oid = procedure.pronamespace
  where namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
    and not trigger_row.tgisinternal
),
triggers as (
  select coalesce(pg_catalog.jsonb_agg(value order by schema_name, object_name, trigger_name), '[]'::jsonb) as value,
    count(*)::bigint as count
  from trigger_rows
),
default_acl_rows as (
  select pg_catalog.pg_get_userbyid(default_acl.defaclrole) as owner_name,
    coalesce(namespace.nspname, '*') as schema_name,
    default_acl.defaclobjtype as object_type,
    pg_catalog.jsonb_build_object(
      'owner', pg_catalog.pg_get_userbyid(default_acl.defaclrole),
      'schema', coalesce(namespace.nspname, '*'),
      'object_type', default_acl.defaclobjtype,
      'acl', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantee', privilege.grantee,
          'privilege', privilege.privilege_type,
          'grantable', privilege.is_grantable
        ) order by privilege.grantee, privilege.privilege_type, privilege.is_grantable), '[]'::jsonb)
        from (
          select case when acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
            acl.privilege_type,
            pg_catalog.bool_or(acl.is_grantable) as is_grantable
          from pg_catalog.aclexplode(default_acl.defaclacl) acl
          group by acl.grantee, acl.privilege_type
        ) privilege
      )
    ) as value
  from pg_catalog.pg_default_acl default_acl
  left join pg_catalog.pg_namespace namespace on namespace.oid = default_acl.defaclnamespace
  where default_acl.defaclnamespace = 0
    or namespace.nspname in ('commercial_engine', 'private', 'public', 'qlik_relay')
),
default_acls as (
  select coalesce(pg_catalog.jsonb_agg(value order by owner_name, schema_name, object_type), '[]'::jsonb) as value,
    count(*)::bigint as count
  from default_acl_rows
),
role_rows as (
  select role.rolname as role_name,
    pg_catalog.jsonb_build_object(
      'name', role.rolname,
      'superuser', role.rolsuper,
      'inherit', role.rolinherit,
      'create_role', role.rolcreaterole,
      'create_db', role.rolcreatedb,
      'can_login', role.rolcanlogin,
      'replication', role.rolreplication,
      'connection_limit', role.rolconnlimit,
      'bypass_rls', role.rolbypassrls,
      'valid_until', role.rolvaliduntil,
      'configuration', (
        select coalesce(pg_catalog.jsonb_agg(setting order by setting), '[]'::jsonb)
        from pg_catalog.unnest(coalesce(role.rolconfig, '{}'::text[])) setting
      )
    ) as value
  from pg_catalog.pg_roles role
  where role.rolname in ('crm_commercial_engine', 'crm_qlik_relay')
),
role_membership_rows as (
  select role.rolname as role_name, member.rolname as member_name,
    pg_catalog.jsonb_build_object(
      'role', role.rolname,
      'member', member.rolname,
      'grantor', pg_catalog.pg_get_userbyid(membership.grantor),
      'admin', membership.admin_option,
      'inherit', membership.inherit_option,
      'set', membership.set_option
    ) as value
  from pg_catalog.pg_auth_members membership
  join pg_catalog.pg_roles role on role.oid = membership.roleid
  join pg_catalog.pg_roles member on member.oid = membership.member
  where role.rolname in ('crm_commercial_engine', 'crm_qlik_relay')
    or member.rolname in ('crm_commercial_engine', 'crm_qlik_relay')
),
roles as (
  select pg_catalog.jsonb_build_object(
      'attributes', coalesce((select pg_catalog.jsonb_agg(value order by role_name) from role_rows), '[]'::jsonb),
      'memberships', coalesce((select pg_catalog.jsonb_agg(value order by role_name, member_name) from role_membership_rows), '[]'::jsonb)
    ) as value,
    (select count(*)::bigint from role_rows) as count
),
migration_rows as (
  select migration.version, migration.name,
    pg_catalog.jsonb_build_object(
      'version', migration.version,
      'name', migration.name,
      'statements_sha256', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.array_to_string(migration.statements, E'\n'), 'UTF8'), 'sha256'), 'hex')
    ) as value
  from supabase_migrations.schema_migrations migration
),
migrations as (
  select coalesce(pg_catalog.jsonb_agg(value order by version), '[]'::jsonb) as value,
    coalesce(pg_catalog.jsonb_agg(version order by version), '[]'::jsonb) as versions,
    count(*)::bigint as count
  from migration_rows
),
data as (
  select pg_temp.rc_application_data_fingerprint() as value
),
table_data as (
  select coalesce(pg_catalog.jsonb_agg(item order by item ->> 'schema', item ->> 'name'), '[]'::jsonb) as value
  from data, pg_catalog.jsonb_array_elements(data.value) item
  where item ->> 'kind' = 'table'
),
sequence_data as (
  select coalesce(pg_catalog.jsonb_agg(item order by item ->> 'schema', item ->> 'name'), '[]'::jsonb) as value
  from data, pg_catalog.jsonb_array_elements(data.value) item
  where item ->> 'kind' = 'sequence'
),
canonical as (
  select pg_catalog.jsonb_build_object(
    'schemas', schemas.value,
    'relations', relations.value,
    'policies', policies.value,
    'functions', functions.value,
    'constraints', constraints.value,
    'indexes', indexes.value,
    'triggers', triggers.value,
    'default_acls', default_acls.value,
    'roles', roles.value,
    'migrations', migrations.value,
    'data', table_data.value,
    'sequences', sequence_data.value
  ) as value
  from schemas, relations, policies, functions, constraints, indexes, triggers,
    default_acls, roles, migrations, table_data, sequence_data
)
select pg_catalog.jsonb_build_object(
  'canonical_sha256', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical.value::text, 'UTF8'), 'sha256'), 'hex'),
  'component_sha256', pg_catalog.jsonb_build_object(
    'schemas', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(schemas.value::text, 'UTF8'), 'sha256'), 'hex'),
    'relations', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(relations.value::text, 'UTF8'), 'sha256'), 'hex'),
    'policies', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(policies.value::text, 'UTF8'), 'sha256'), 'hex'),
    'functions', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(functions.value::text, 'UTF8'), 'sha256'), 'hex'),
    'constraints', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(constraints.value::text, 'UTF8'), 'sha256'), 'hex'),
    'indexes', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(indexes.value::text, 'UTF8'), 'sha256'), 'hex'),
    'triggers', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(triggers.value::text, 'UTF8'), 'sha256'), 'hex'),
    'default_acls', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(default_acls.value::text, 'UTF8'), 'sha256'), 'hex'),
    'roles', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(roles.value::text, 'UTF8'), 'sha256'), 'hex'),
    'migrations', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(migrations.value::text, 'UTF8'), 'sha256'), 'hex'),
    'data', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(table_data.value::text, 'UTF8'), 'sha256'), 'hex'),
    'sequences', pg_catalog.encode(extensions.digest(pg_catalog.convert_to(sequence_data.value::text, 'UTF8'), 'sha256'), 'hex')
  ),
  'object_sha256', pg_catalog.jsonb_build_object(
    'relations', (
      select coalesce(pg_catalog.jsonb_object_agg(
        pg_catalog.format('%s.%s', relation_row.schema_name, relation_row.object_name),
        pg_catalog.encode(extensions.digest(pg_catalog.convert_to(relation_row.value::text, 'UTF8'), 'sha256'), 'hex')
        order by relation_row.schema_name, relation_row.object_name
      ), '{}'::jsonb)
      from relation_rows relation_row
    )
  ),
  'object_detail', pg_catalog.jsonb_build_object(
    'relations', (
      select coalesce(pg_catalog.jsonb_object_agg(
        pg_catalog.format('%s.%s', relation_row.schema_name, relation_row.object_name),
        relation_row.value
        order by relation_row.schema_name, relation_row.object_name
      ), '{}'::jsonb)
      from relation_rows relation_row
    )
  ),
  'migration_versions', migrations.versions,
  'counts', pg_catalog.jsonb_build_object(
    'schemas', schemas.count,
    'relations', relations.count,
    'tables', relations.table_count,
    'policies', policies.count,
    'functions', functions.count,
    'constraints', constraints.count,
    'indexes', indexes.count,
    'triggers', triggers.count,
    'default_acls', default_acls.count,
    'roles', roles.count,
    'data_tables', pg_catalog.jsonb_array_length(table_data.value),
    'data_rows', (select coalesce(sum((item ->> 'row_count')::bigint), 0) from pg_catalog.jsonb_array_elements(table_data.value) item),
    'sequences', pg_catalog.jsonb_array_length(sequence_data.value)
  ),
  'fail_closed', pg_catalog.jsonb_build_object(
    'relay_credentials', (select count(*) from private.crm_qlik_relay_credentials),
    'relay_gates', (select count(*) from private.crm_integration_cutover_gates),
    'mapping_authorities', (select count(*) from private.crm_mapping_source_authorities),
    'commercial_policies', (select count(*) from private.crm_commercial_policy_versions),
    'commercial_gates', (select count(*) from private.crm_commercial_engine_gates),
    'commercial_executions', (select count(*) from private.crm_commercial_engine_executions),
    'relay_role_safe', coalesce((select not role.rolsuper and not role.rolcreatedb and not role.rolcreaterole and not role.rolinherit and not role.rolcanlogin and not role.rolreplication and not role.rolbypassrls and role.rolconnlimit = 2 from pg_catalog.pg_roles role where role.rolname = 'crm_qlik_relay'), false),
    'commercial_role_safe', coalesce((select not role.rolsuper and not role.rolcreatedb and not role.rolcreaterole and not role.rolinherit and not role.rolcanlogin and not role.rolreplication and not role.rolbypassrls and role.rolconnlimit = 2 from pg_catalog.pg_roles role where role.rolname = 'crm_commercial_engine'), false)
  )
)::text
from canonical, schemas, relations, policies, functions, constraints, indexes,
  triggers, default_acls, roles, migrations, table_data, sequence_data;
`;

function databaseFingerprint(container, database) {
  const result = dockerDatabase(container, database, canonicalFingerprintSql);
  let parsed;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("Isolated database fingerprint was not valid JSON.");
  }
  return parsed;
}

function assertFailClosedFingerprint(fingerprint, expectedVersions) {
  if (JSON.stringify(fingerprint.migration_versions) !== JSON.stringify(expectedVersions)) {
    throw new Error("Isolated migration ledger does not match the versioned manifest.");
  }
  if (fingerprint.counts?.schemas !== applicationSchemas.length) {
    throw new Error("Isolated application schema inventory is incomplete.");
  }
  if (fingerprint.counts?.roles !== applicationRoles.length) {
    throw new Error("Isolated application role inventory is incomplete.");
  }
  for (const key of [
    "relay_credentials",
    "relay_gates",
    "mapping_authorities",
    "commercial_policies",
    "commercial_gates",
    "commercial_executions",
  ]) {
    if (fingerprint.fail_closed?.[key] !== 0) {
      throw new Error(`${key} must be empty after a clean rebuild.`);
    }
  }
  if (
    fingerprint.fail_closed?.relay_role_safe !== true ||
    fingerprint.fail_closed?.commercial_role_safe !== true
  ) {
    throw new Error("Dedicated application roles must remain least-privilege NOLOGIN roles.");
  }
}

function changedNonSequenceComponents(before, after) {
  return Object.keys(before.component_sha256).filter(
    (key) => key !== "sequences" && before.component_sha256[key] !== after.component_sha256[key],
  );
}

function fingerprintDifferences(before, after) {
  const components = Object.keys(before.component_sha256).filter(
    (key) => before.component_sha256[key] !== after.component_sha256[key],
  );
  const relationNames = new Set([
    ...Object.keys(before.object_sha256?.relations ?? {}),
    ...Object.keys(after.object_sha256?.relations ?? {}),
  ]);
  const relations = [...relationNames].filter(
    (name) => before.object_sha256?.relations?.[name] !== after.object_sha256?.relations?.[name],
  );
  const relationFields = new Set();
  for (const name of relations) {
    const beforeRelation = before.object_detail?.relations?.[name] ?? {};
    const afterRelation = after.object_detail?.relations?.[name] ?? {};
    for (const field of new Set([...Object.keys(beforeRelation), ...Object.keys(afterRelation)])) {
      if (JSON.stringify(beforeRelation[field]) !== JSON.stringify(afterRelation[field])) {
        relationFields.add(field);
      }
    }
  }
  return { components, relations, relationFields: [...relationFields].sort() };
}

function assertPgTapOutput(output, label) {
  const reported = [...output.matchAll(/\bTests=(\d+)\b/g)].map((match) => Number(match[1]));
  if (!reported.includes(expectedPgTapTests)) {
    throw new Error(`${label} did not report exactly ${expectedPgTapTests} pgTAP tests.`);
  }
  return expectedPgTapTests;
}

function validateDatabase(projectRoot, connectionArgs, label) {
  const pgTapOutput = runSupabase(projectRoot, ["test", "db", ...connectionArgs], `${label} pgTAP`);
  const pgTapTests = assertPgTapOutput(pgTapOutput, label);
  runSupabase(
    projectRoot,
    ["db", "lint", ...connectionArgs, "--level", "warning", "--fail-on", "warning"],
    `${label} database lint`,
  );
  runSupabase(
    projectRoot,
    [
      "db",
      "advisors",
      ...connectionArgs,
      "--type",
      "security",
      "--level",
      "warn",
      "--fail-on",
      "warn",
    ],
    `${label} security advisors`,
  );
  runSupabase(
    projectRoot,
    [
      "db",
      "advisors",
      ...connectionArgs,
      "--type",
      "performance",
      "--level",
      "warn",
      "--fail-on",
      "warn",
    ],
    `${label} performance advisors`,
  );
  return {
    pgTapTests,
    databaseLint: "passed",
    securityAdvisors: "passed",
    performanceAdvisors: "passed",
  };
}

function localDatabaseUrl(port, database) {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/${database}`;
}

function parseNamedResources(output, projectId) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, name]) => name === projectId || name?.endsWith(`_${projectId}`));
}

function discoverProjectResources(projectId) {
  const commands = [
    ["container", ["ps", "-a", "--format", "{{.ID}}\t{{.Names}}"]],
    ["network", ["network", "ls", "--format", "{{.ID}}\t{{.Name}}"]],
    ["volume", ["volume", "ls", "--format", "{{.Name}}\t{{.Name}}"]],
  ];
  const resources = { container: [], network: [], volume: [] };
  for (const [kind, args] of commands) {
    const result = runUnchecked("docker", args);
    if (result.error || result.status !== 0) {
      throw commandFailure("docker", result, `isolated ${kind} cleanup discovery`);
    }
    resources[kind] = parseNamedResources(result.stdout, projectId).map(([id]) => id);
  }
  return resources;
}

function removeProjectResources(resources) {
  const commands = [
    ["container", ["rm", "--force"]],
    ["network", ["network", "rm"]],
    ["volume", ["volume", "rm"]],
  ];
  for (const [kind, prefix] of commands) {
    if (resources[kind].length === 0) continue;
    runUnchecked("docker", [...prefix, ...resources[kind]]);
  }
}

function cleanupProject(projectRoot, projectId, attempted) {
  if (!attempted) return;
  runUnchecked("pnpm", ["exec", "supabase", "stop", "--no-backup", "--workdir", projectRoot], {
    cwd: repositoryRoot,
  });
  let resources = discoverProjectResources(projectId);
  removeProjectResources(resources);
  resources = discoverProjectResources(projectId);
  const remaining = Object.values(resources).reduce((total, values) => total + values.length, 0);
  if (remaining !== 0) {
    throw new Error(`Cleanup could not remove all resources for isolated project ${projectId}.`);
  }
}

async function writeAtomicJson(destination, value) {
  const absolute = path.resolve(repositoryRoot, destination);
  if (!absolute.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error("Evidence output must stay inside the repository.");
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, absolute);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const evidencePath = arguments_.length === 0 ? null : arguments_[1];
  if (
    arguments_.length !== 0 &&
    (arguments_.length !== 2 || arguments_[0] !== "--evidence" || !evidencePath)
  ) {
    throw new Error("Use --evidence with exactly one repository-relative JSON path.");
  }
  if (evidencePath && path.isAbsolute(evidencePath)) {
    throw new Error("Evidence output must use a repository-relative path.");
  }

  const [migrations, pgTapPlan, provenance] = await Promise.all([
    readMigrationManifest(),
    readPgTapPlan(),
    captureProvenance(evidencePath),
  ]);
  await pinLocalDockerEndpoint();

  const expectedVersions = migrations.map(({ version }) => version);
  const runId = randomBytes(5).toString("hex");
  const sourceProjectId = `descomplica-rc-source-${runId}`;
  const targetProjectId = `descomplica-rc-target-${runId}`;
  const restoreDatabase = `rc_restore_${runId}`;
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "descomplica-rc-"));
  const sourceProjectRoot = path.join(temporaryRoot, "source");
  const targetProjectRoot = path.join(temporaryRoot, "target");
  const ports = portBlocks();
  let sourceAttempted = false;
  let targetAttempted = false;
  let evidence = null;
  let operationError = null;

  try {
    await Promise.all([
      prepareProject(sourceProjectRoot, sourceProjectId, ports.source, true),
      prepareProject(targetProjectRoot, targetProjectId, ports.target, false),
    ]);

    sourceAttempted = true;
    runSupabase(
      sourceProjectRoot,
      ["start", "--exclude", excludedServices, "--yes"],
      "isolated source Supabase start",
    );
    const sourceContainer = exactDatabaseContainer(sourceProjectId);
    runSupabase(
      sourceProjectRoot,
      ["db", "reset", "--local", "--no-seed"],
      "isolated source migration reset",
    );
    const sourcePreValidationFingerprint = databaseFingerprint(sourceContainer, "postgres");
    assertFailClosedFingerprint(sourcePreValidationFingerprint, expectedVersions);
    const sourceValidation = validateDatabase(sourceProjectRoot, ["--local"], "source");
    const sourceFingerprint = databaseFingerprint(sourceContainer, "postgres");
    assertFailClosedFingerprint(sourceFingerprint, expectedVersions);
    const sourceValidationChanges = changedNonSequenceComponents(
      sourcePreValidationFingerprint,
      sourceFingerprint,
    );
    if (sourceValidationChanges.length > 0) {
      throw new Error(
        `Source changed during validation components: ${sourceValidationChanges.join(", ")}.`,
      );
    }
    targetAttempted = true;
    runSupabase(
      targetProjectRoot,
      ["start", "--exclude", excludedServices, "--yes"],
      "isolated target Supabase start",
    );
    const targetContainer = exactDatabaseContainer(targetProjectId);
    if (sourceProjectId === targetProjectId || sourceContainer === targetContainer) {
      throw new Error("Source and target Supabase projects and containers must be distinct.");
    }
    bootstrapApplicationRoles(targetContainer);
    createRestoreDatabase(targetContainer, restoreDatabase);

    const dump = logicalDump(sourceContainer);
    const dumpSha256 = sha256(dump);
    const dumpBytes = dump.byteLength;
    try {
      restoreLogicalDump(targetContainer, restoreDatabase, dump);
    } finally {
      dump.fill(0);
    }

    const targetFingerprint = databaseFingerprint(targetContainer, restoreDatabase);
    assertFailClosedFingerprint(targetFingerprint, expectedVersions);
    if (sourceFingerprint.canonical_sha256 !== targetFingerprint.canonical_sha256) {
      const differences = fingerprintDifferences(sourceFingerprint, targetFingerprint);
      throw new Error(
        `Restored canonical fingerprint differs. Components: ${differences.components.join(", ") || "unknown"}; relation fields: ${differences.relationFields.join(", ") || "unknown"}.`,
      );
    }
    const targetUrl = localDatabaseUrl(ports.target.database, restoreDatabase);
    const targetValidation = validateDatabase(
      targetProjectRoot,
      ["--db-url", targetUrl],
      "restored target",
    );
    const validatedTargetFingerprint = databaseFingerprint(targetContainer, restoreDatabase);
    assertFailClosedFingerprint(validatedTargetFingerprint, expectedVersions);
    const postValidationChanges = changedNonSequenceComponents(
      sourceFingerprint,
      validatedTargetFingerprint,
    );
    if (postValidationChanges.length > 0) {
      throw new Error(
        `Restored target changed during validation components: ${postValidationChanges.join(", ")}.`,
      );
    }

    evidence = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      environment: "two independent ephemeral local Supabase/PostgreSQL 17 projects",
      remoteMutation: false,
      representativeRemoteRestore: false,
      remoteMigrationHistoryRehearsed: false,
      cutoverAuthorized: false,
      dockerTransport: "local-unix",
      independentSourceAndTargetProjects: true,
      independentSourceAndTargetContainers: true,
      ...provenance,
      migrationCount: migrations.length,
      migrationManifestSha256: sha256(
        migrations
          .map(({ version, name, sha256: hash }) => `${version}:${name}:${hash}\n`)
          .join(""),
      ),
      pgTapFiles: pgTapPlan.files,
      pgTapTests: pgTapPlan.tests,
      sourceValidation,
      restoredValidation: targetValidation,
      reset: "passed",
      logicalBackup: "passed",
      logicalBackupBytes: dumpBytes,
      logicalBackupSha256: dumpSha256,
      logicalRestore: "passed",
      ownersPreserved: true,
      effectivePrivilegesPreserved: true,
      aclFingerprintMode: "effective-privileges-owner-implicit-grantor-independent",
      aclGrantorsCompared: false,
      targetAclMutationApplied: false,
      fingerprintMatch: true,
      sourcePostValidationNonSequenceFingerprintMatch: true,
      postValidationNonSequenceFingerprintMatch: true,
      canonicalFingerprintSha256: sourceFingerprint.canonical_sha256,
      componentSha256: sourceFingerprint.component_sha256,
      objectCounts: sourceFingerprint.counts,
      failClosed: sourceFingerprint.fail_closed,
    };
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors = [];
  for (const [projectRoot, projectId, attempted] of [
    [targetProjectRoot, targetProjectId, targetAttempted],
    [sourceProjectRoot, sourceProjectId, sourceAttempted],
  ]) {
    try {
      cleanupProject(projectRoot, projectId, attempted);
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error.message : "Unknown project cleanup error.");
    }
  }
  try {
    await rm(temporaryRoot, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(error instanceof Error ? error.message : "Unknown temporary cleanup error.");
  }

  if (operationError || cleanupErrors.length > 0) {
    const messages = [
      operationError instanceof Error ? operationError.message : operationError,
      ...cleanupErrors,
    ].filter(Boolean);
    throw new Error(messages.map(sanitizeDiagnostic).join("\n"));
  }
  if (!evidence) throw new Error("Isolated rehearsal produced no evidence.");

  if (evidencePath) await writeAtomicJson(evidencePath, evidence);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

try {
  await main();
} catch (error) {
  const message = sanitizeDiagnostic(
    error instanceof Error ? error.message : "Unknown isolated rehearsal failure.",
  );
  process.stderr.write(`Isolated restore rehearsal failed: ${message}\n`);
  process.exitCode = 1;
}
