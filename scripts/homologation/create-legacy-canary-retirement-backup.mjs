import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { sha256, sha256File } from "./auth-mfa-upgrade-lib.mjs";
import {
  buildRetirementApplicationSql,
  buildRetirementPostconditionsSql,
  buildRetirementPreconditionsSql,
  loadRetirementCandidate,
  validateRetirementAllowlist,
  validateRetirementBackupProof,
  validateRetirementHistory,
} from "./legacy-canary-retirement-lib.mjs";
import { enterRuntimeStateLock } from "./runtime-state-lock.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-retirement-allowlist.json",
);
const allowlistRepositoryPath = "deploy/homologation/legacy-canary-retirement-allowlist.json";
const candidateRepositoryRoot = "deploy/homologation/migrations";
const backupParent = "/var/backups/descomplica-crm";
const dockerExecutable = "/usr/bin/docker";
const dockerSocket = "/var/run/docker.sock";
const dockerEndpoint = `unix://${dockerSocket}`;
const databaseContainer = "supabase_db_descomplica-homologation";
const appContainer = "descomplica-homologation-app";
const runtimeManifestPath = "/var/lib/descomplica-crm-homologation/manifest.json";
const safeEnvironment = {
  DOCKER_HOST: dockerEndpoint,
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};
const requiredConfigurationSources = Object.freeze([
  Object.freeze({ file: "/etc/descomplica-crm/homologation.env", expectedMode: 0o600 }),
  Object.freeze({
    file: "/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret",
    expectedMode: 0o640,
  }),
  Object.freeze({
    file: "/etc/descomplica-crm/data/investor-inventory-2026-09-05.json",
    expectedMode: 0o640,
  }),
  Object.freeze({
    file: "/etc/descomplica-crm/homologation-access.json",
    expectedMode: 0o600,
  }),
  Object.freeze({
    file: "/etc/descomplica-crm/homologation-accounts.json",
    expectedMode: 0o600,
  }),
  Object.freeze({
    file: "/etc/nginx/sites-enabled/homolog.descomplicapro.com.br",
    symlinkTargetRoot: "/etc/nginx/sites-available",
    expectedMode: 0o644,
  }),
  Object.freeze({
    file: "/etc/nginx/.htpasswd-descomplica-homologation",
    allowedGids: Object.freeze([33]),
    expectedMode: 0o640,
  }),
  Object.freeze({ file: runtimeManifestPath, expectedMode: 0o600 }),
  Object.freeze({
    file: "/srv/descomplica-crm/deploy/homologation/compose.yaml",
    expectedMode: 0o600,
  }),
]);

function fail(message) {
  throw new Error(message);
}

function run(command, arguments_, label, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: safeEnvironment,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail(`${label} failed; diagnostics suppressed.`);
  }
  return result.stdout;
}

function runBuffer(command, arguments_, label) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: safeEnvironment,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    fail(`${label} failed; diagnostics suppressed.`);
  }
  return result.stdout;
}

function docker(arguments_, label, options = {}) {
  return run(dockerExecutable, ["--host", dockerEndpoint, ...arguments_], label, options);
}

async function dockerToFile(arguments_, destination, label) {
  const handle = await open(destination, "wx", 0o600);
  try {
    const result = spawnSync(dockerExecutable, ["--host", dockerEndpoint, ...arguments_], {
      cwd: repositoryRoot,
      env: safeEnvironment,
      stdio: ["ignore", handle.fd, "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) fail(`${label} failed; diagnostics suppressed.`);
    await handle.sync();
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  } finally {
    await handle.close();
  }
}

function psql(container, database, sql, label) {
  return docker(
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
      "supabase_admin",
      "--dbname",
      database,
    ],
    label,
    { input: sql },
  ).trim();
}

function readHistory(container, database, manifest, label) {
  const hashedVersions = [
    ...manifest.pinnedHistory.map(({ version }) => version),
    manifest.candidate.version,
  ];
  const sqlVersions = hashedVersions.map((version) => `'${version}'`).join(",");
  const output = psql(
    container,
    database,
    `select coalesce(jsonb_agg(jsonb_build_object(
  'version', migration.version,
  'name', migration.name,
  'statement_count', coalesce(cardinality(migration.statements), 0),
  'sha256', case when migration.version in (${sqlVersions})
    then encode(extensions.digest(convert_to(array_to_string(migration.statements, ''), 'UTF8'), 'sha256'), 'hex')
    else null end
) order by migration.version), '[]'::jsonb)
from supabase_migrations.schema_migrations migration;`,
    label,
  );
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) fail(`${label} returned an invalid value.`);
  return parsed;
}

function readDatabaseState(container, database, manifest, label) {
  return JSON.parse(
    psql(
      container,
      database,
      `select jsonb_build_object(
  'historyCount', (select count(*) from supabase_migrations.schema_migrations),
  'candidateCount', (
    select count(*) from supabase_migrations.schema_migrations
    where version = '${manifest.candidate.version}'
  ),
  'pageCount', (select count(*) from public.app_pages)
);`,
      label,
    ),
  );
}

const roleContractSql = `select jsonb_build_object(
  'roles', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', role_row.rolname,
      'bootstrap', role_row.oid = 10,
      'superuser', role_row.rolsuper,
      'inherit', role_row.rolinherit,
      'createRole', role_row.rolcreaterole,
      'createDb', role_row.rolcreatedb,
      'canLogin', role_row.rolcanlogin,
      'replication', role_row.rolreplication,
      'bypassRls', role_row.rolbypassrls,
      'connectionLimit', role_row.rolconnlimit,
      'validUntil', role_row.rolvaliduntil::text,
      'configuration', coalesce((
        select jsonb_agg(setting order by setting)
        from pg_catalog.pg_db_role_setting role_setting
        cross join lateral unnest(role_setting.setconfig) setting
        where role_setting.setrole = role_row.oid
          and role_setting.setdatabase = 0
      ), '[]'::jsonb),
      'passwordVerifier', role_row.rolpassword
    ) order by role_row.rolname)
    from pg_catalog.pg_authid role_row
    where role_row.rolname !~ '^pg_'
  ), '[]'::jsonb),
  'memberships', coalesce((
    select jsonb_agg(jsonb_build_object(
      'role', granted_role.rolname,
      'member', member_role.rolname,
      'grantor', grantor_role.rolname,
      'adminOption', membership.admin_option,
      'inheritOption', membership.inherit_option,
      'setOption', membership.set_option
    ) order by granted_role.rolname, member_role.rolname, grantor_role.rolname)
    from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles granted_role on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles member_role on member_role.oid = membership.member
    join pg_catalog.pg_roles grantor_role on grantor_role.oid = membership.grantor
    where granted_role.rolname !~ '^pg_' and member_role.rolname !~ '^pg_'
  ), '[]'::jsonb)
);`;

const databaseSecurityContractSql = `with user_namespace as (
  select namespace.oid, namespace.nspname, namespace.nspowner, namespace.nspacl
  from pg_catalog.pg_namespace namespace
  where namespace.nspname <> 'information_schema'
    and namespace.nspname !~ '^pg_'
)
select jsonb_build_object(
  'database', (
    select jsonb_build_object(
      'owner', pg_catalog.pg_get_userbyid(database_row.datdba),
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case
            when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee)
          end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from pg_catalog.aclexplode(coalesce(
          database_row.datacl,
          pg_catalog.acldefault('d', database_row.datdba)
        )) acl_entry
      ), '[]'::jsonb)
    )
    from pg_catalog.pg_database database_row
    where database_row.datname = current_database()
  ),
  'schemas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', namespace.nspname,
      'owner', pg_catalog.pg_get_userbyid(namespace.nspowner),
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(namespace.nspacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by namespace.nspname)
    from user_namespace namespace
  ), '[]'::jsonb),
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', relation.relname,
      'kind', relation.relkind,
      'owner', pg_catalog.pg_get_userbyid(relation.relowner),
      'rowSecurity', relation.relrowsecurity,
      'forceRowSecurity', relation.relforcerowsecurity,
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(relation.relacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by namespace.nspname, relation.relname, relation.relkind)
    from pg_catalog.pg_class relation
    join user_namespace namespace on namespace.oid = relation.relnamespace
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'relation', relation.relname,
      'column', attribute.attname,
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(attribute.attacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by namespace.nspname, relation.relname, attribute.attnum)
    from pg_catalog.pg_attribute attribute
    join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
    join user_namespace namespace on namespace.oid = relation.relnamespace
    where attribute.attnum > 0 and not attribute.attisdropped
  ), '[]'::jsonb),
  'routines', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', routine.proname,
      'kind', routine.prokind,
      'identityArguments', pg_catalog.pg_get_function_identity_arguments(routine.oid),
      'owner', pg_catalog.pg_get_userbyid(routine.proowner),
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(routine.proacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by namespace.nspname, routine.proname, pg_catalog.pg_get_function_identity_arguments(routine.oid))
    from pg_catalog.pg_proc routine
    join user_namespace namespace on namespace.oid = routine.pronamespace
  ), '[]'::jsonb),
  'types', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', type_row.typname,
      'owner', pg_catalog.pg_get_userbyid(type_row.typowner),
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(type_row.typacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by namespace.nspname, type_row.typname)
    from pg_catalog.pg_type type_row
    join user_namespace namespace on namespace.oid = type_row.typnamespace
  ), '[]'::jsonb),
  'defaultAcls', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', coalesce(namespace.nspname, ''),
      'owner', pg_catalog.pg_get_userbyid(default_acl.defaclrole),
      'objectType', default_acl.defaclobjtype,
      'acl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantor', pg_catalog.pg_get_userbyid(acl_entry.grantor),
          'grantee', case when acl_entry.grantee = 0 then 'PUBLIC'
            else pg_catalog.pg_get_userbyid(acl_entry.grantee) end,
          'privilege', acl_entry.privilege_type,
          'grantable', acl_entry.is_grantable
        ) order by acl_entry.grantee, acl_entry.grantor, acl_entry.privilege_type)
        from unnest(coalesce(default_acl.defaclacl, '{}'::aclitem[])) raw_acl(item)
        cross join lateral pg_catalog.aclexplode(array[raw_acl.item]) acl_entry
      ), '[]'::jsonb)
    ) order by coalesce(namespace.nspname, ''), pg_catalog.pg_get_userbyid(default_acl.defaclrole), default_acl.defaclobjtype)
    from pg_catalog.pg_default_acl default_acl
    left join pg_catalog.pg_namespace namespace on namespace.oid = default_acl.defaclnamespace
    where namespace.oid is null or namespace.nspname in (select nspname from user_namespace)
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'relation', relation.relname,
      'name', policy.polname,
      'permissive', policy.polpermissive,
      'command', policy.polcmd,
      'roles', coalesce((
        select jsonb_agg(role_row.rolname order by role_row.rolname)
        from unnest(policy.polroles) role_oid
        join pg_catalog.pg_roles role_row on role_row.oid = role_oid
      ), '[]'::jsonb),
      'using', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
      'check', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
    ) order by namespace.nspname, relation.relname, policy.polname)
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join user_namespace namespace on namespace.oid = relation.relnamespace
  ), '[]'::jsonb)
);`;

function readJsonContract(container, database, sql, label) {
  const output = psql(container, database, sql, label);
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    fail(`${label} returned an invalid value.`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} returned an invalid value.`);
  }
  const serialized = JSON.stringify(value);
  return Object.freeze({ value, serialized, sha256: sha256(Buffer.from(serialized, "utf8")) });
}

function parseRoleContractOutput(output, label, ignoredHarnessRole = null) {
  let raw;
  try {
    raw = JSON.parse(output);
  } catch {
    fail(`${label} returned an invalid value.`);
  }
  if (!Array.isArray(raw?.roles) || !Array.isArray(raw?.memberships)) {
    fail(`${label} returned an invalid value.`);
  }
  const passwordVerifiers = [];
  const roles = raw.roles
    .filter((role) => role?.name !== ignoredHarnessRole)
    .map((role) => {
      if (
        typeof role?.name !== "string" ||
        (role.passwordVerifier !== null && typeof role.passwordVerifier !== "string")
      ) {
        fail(`${label} returned an invalid value.`);
      }
      const { passwordVerifier, ...publicRole } = role;
      passwordVerifiers.push({ name: role.name, verifier: passwordVerifier });
      return {
        ...publicRole,
        passwordPresent: passwordVerifier !== null,
        passwordSha256:
          passwordVerifier === null ? null : sha256(Buffer.from(passwordVerifier, "utf8")),
      };
    });
  const memberships = raw.memberships.filter(
    (membership) =>
      membership?.role !== ignoredHarnessRole &&
      membership?.member !== ignoredHarnessRole &&
      membership?.grantor !== ignoredHarnessRole,
  );
  if (ignoredHarnessRole !== null && roles.length !== raw.roles.length - 1) {
    fail("Identity restore harness role boundary is invalid.");
  }
  const value = { ...raw, roles, memberships };
  const serialized = JSON.stringify(value);
  return Object.freeze({
    value,
    serialized,
    sha256: sha256(Buffer.from(serialized, "utf8")),
    passwordVerifiers: Object.freeze(passwordVerifiers.map(Object.freeze)),
  });
}

function readRoleContract(container, database, label) {
  return parseRoleContractOutput(psql(container, database, roleContractSql, label), label);
}

export function assertExactSecurityContract(expected, actual, label) {
  if (
    !expected ||
    !actual ||
    typeof expected.serialized !== "string" ||
    typeof actual.serialized !== "string" ||
    !/^[0-9a-f]{64}$/u.test(expected.sha256 ?? "") ||
    !/^[0-9a-f]{64}$/u.test(actual.sha256 ?? "") ||
    expected.sha256 !== sha256(Buffer.from(expected.serialized, "utf8")) ||
    actual.sha256 !== sha256(Buffer.from(actual.serialized, "utf8")) ||
    expected.serialized !== actual.serialized ||
    expected.sha256 !== actual.sha256
  ) {
    fail(`${label} differs from the source database.`);
  }
  return expected.sha256;
}

function quoteSqlIdentifier(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("Role contract contains an invalid identifier.");
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteSqlLiteral(value) {
  if (typeof value !== "string" || value.includes("\0")) {
    fail("Role contract contains an invalid literal.");
  }
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildRestoreRolePreparationSql(contract) {
  const roles = contract?.value?.roles;
  const memberships = contract?.value?.memberships;
  const passwordVerifiers = contract?.passwordVerifiers;
  if (
    !Array.isArray(roles) ||
    !Array.isArray(memberships) ||
    !Array.isArray(passwordVerifiers) ||
    roles.length === 0 ||
    passwordVerifiers.length !== roles.length
  ) {
    fail("Source role contract is invalid.");
  }
  const passwordByRole = new Map(
    passwordVerifiers.map((entry) => {
      if (
        typeof entry?.name !== "string" ||
        (entry.verifier !== null && typeof entry.verifier !== "string")
      ) {
        fail("Source role password contract is invalid.");
      }
      return [entry.name, entry.verifier];
    }),
  );
  if (passwordByRole.size !== roles.length) fail("Source role password contract is incomplete.");
  const statements = [];
  for (const role of roles) {
    if (
      !role ||
      typeof role.name !== "string" ||
      typeof role.bootstrap !== "boolean" ||
      !Number.isSafeInteger(role.connectionLimit) ||
      !Array.isArray(role.configuration) ||
      ![
        role.superuser,
        role.inherit,
        role.createRole,
        role.createDb,
        role.canLogin,
        role.replication,
        role.bypassRls,
      ].every((value) => typeof value === "boolean") ||
      (role.validUntil !== null && typeof role.validUntil !== "string")
    ) {
      fail("Source role contract is invalid.");
    }
    const identifier = quoteSqlIdentifier(role.name);
    const roleLiteral = quoteSqlLiteral(role.name);
    statements.push(`do $prepare_role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = ${roleLiteral}) then
    create role ${identifier};
  end if;
end;
$prepare_role$;`);
    statements.push(`alter role ${identifier} with
  ${role.superuser === true ? "superuser" : "nosuperuser"}
  ${role.inherit === true ? "inherit" : "noinherit"}
  ${role.createRole === true ? "createrole" : "nocreaterole"}
  ${role.createDb === true ? "createdb" : "nocreatedb"}
  ${role.canLogin === true ? "login" : "nologin"}
  ${role.replication === true ? "replication" : "noreplication"}
  ${role.bypassRls === true ? "bypassrls" : "nobypassrls"}
  connection limit ${role.connectionLimit}${
    role.validUntil === null ? "" : `\n  valid until ${quoteSqlLiteral(role.validUntil)}`
  };`);
    const passwordVerifier = passwordByRole.get(role.name);
    statements.push(
      `alter role ${identifier} password ${
        passwordVerifier === null ? "null" : quoteSqlLiteral(passwordVerifier)
      };`,
    );
    statements.push(`alter role ${identifier} reset all;`);
    for (const setting of role.configuration) {
      if (typeof setting !== "string" || !setting.includes("=")) {
        fail("Source role contract contains an invalid role setting.");
      }
      const separator = setting.indexOf("=");
      const name = setting.slice(0, separator);
      const value = setting.slice(separator + 1);
      if (!/^[a-z_][a-z0-9_.]*$/u.test(name)) {
        fail("Source role contract contains an invalid role setting name.");
      }
      if (name === "search_path" || name === "session_preload_libraries") {
        statements.push(
          `select pg_catalog.set_config(${quoteSqlLiteral(name)}, ${quoteSqlLiteral(value)}, false);`,
        );
        statements.push(`alter role ${identifier} set ${name} from current;`);
        statements.push(`reset ${name};`);
      } else {
        statements.push(`alter role ${identifier} set ${name} to ${quoteSqlLiteral(value)};`);
      }
    }
  }
  const bootstrapRoles = roles.filter((role) => role.bootstrap === true);
  if (bootstrapRoles.length !== 1 || bootstrapRoles[0].superuser !== true) {
    fail("Source role contract must contain exactly one bootstrap superuser.");
  }
  const bootstrapRole = bootstrapRoles[0].name;
  statements.unshift(`do $assert_bootstrap_role$
begin
  if not exists (
    select 1 from pg_catalog.pg_authid
    where oid = 10 and rolname = ${quoteSqlLiteral(bootstrapRole)}
  ) then
    raise exception 'Restore cluster bootstrap superuser differs from the source contract.';
  end if;
end;
$assert_bootstrap_role$;`);
  for (const membership of memberships) {
    if (
      !membership ||
      typeof membership.role !== "string" ||
      typeof membership.member !== "string" ||
      typeof membership.grantor !== "string" ||
      typeof membership.adminOption !== "boolean" ||
      typeof membership.inheritOption !== "boolean" ||
      typeof membership.setOption !== "boolean" ||
      membership.grantor !== bootstrapRole
    ) {
      fail("Source role membership contract is invalid.");
    }
    statements.push(
      `grant ${quoteSqlIdentifier(membership.role)} to ${quoteSqlIdentifier(membership.member)} with admin ${membership.adminOption};`,
    );
    statements.push(
      `grant ${quoteSqlIdentifier(membership.role)} to ${quoteSqlIdentifier(membership.member)} with inherit ${membership.inheritOption};`,
    );
    statements.push(
      `grant ${quoteSqlIdentifier(membership.role)} to ${quoteSqlIdentifier(membership.member)} with set ${membership.setOption};`,
    );
  }
  return `${statements.join("\n")}\n`;
}

export function buildRestoreDatabaseBoundarySql(contract, databaseName) {
  const database = contract?.value?.database;
  if (
    !database ||
    typeof database.owner !== "string" ||
    !Array.isArray(database.acl) ||
    typeof databaseName !== "string"
  ) {
    fail("Source database boundary contract is invalid.");
  }
  const databaseIdentifier = quoteSqlIdentifier(databaseName);
  const ownerIdentifier = quoteSqlIdentifier(database.owner);
  const statements = [
    `alter database ${databaseIdentifier} owner to ${ownerIdentifier};`,
    `revoke all privileges on database ${databaseIdentifier} from public;`,
  ];
  const grantees = new Set(database.acl.map((entry) => entry?.grantee));
  for (const grantee of grantees) {
    if (typeof grantee !== "string") fail("Source database ACL contract is invalid.");
    if (grantee !== "PUBLIC") {
      statements.push(
        `revoke all privileges on database ${databaseIdentifier} from ${quoteSqlIdentifier(grantee)};`,
      );
    }
  }
  for (const entry of database.acl) {
    if (
      !entry ||
      typeof entry.grantor !== "string" ||
      typeof entry.grantee !== "string" ||
      !new Set(["CONNECT", "CREATE", "TEMPORARY"]).has(entry.privilege) ||
      typeof entry.grantable !== "boolean"
    ) {
      fail("Source database ACL contract is invalid.");
    }
    statements.push(`set role ${quoteSqlIdentifier(entry.grantor)};`);
    statements.push(
      `grant ${entry.privilege} on database ${databaseIdentifier} to ${
        entry.grantee === "PUBLIC" ? "public" : quoteSqlIdentifier(entry.grantee)
      }${entry.grantable ? " with grant option" : ""};`,
    );
    statements.push("reset role;");
  }
  return `${statements.join("\n")}\n`;
}

const schemaPrivileges = new Set(["CREATE", "USAGE"]);
const tablePrivileges = new Set([
  "DELETE",
  "INSERT",
  "MAINTAIN",
  "REFERENCES",
  "SELECT",
  "TRIGGER",
  "TRUNCATE",
  "UPDATE",
]);
const sequencePrivileges = new Set(["SELECT", "UPDATE", "USAGE"]);
const columnPrivileges = new Set(["INSERT", "REFERENCES", "SELECT", "UPDATE"]);

function groupAclEntries(entries, allowedPrivileges, label) {
  if (!Array.isArray(entries)) fail(`${label} is invalid.`);
  const groups = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.grantor !== "string" ||
      typeof entry.grantee !== "string" ||
      !allowedPrivileges.has(entry.privilege) ||
      typeof entry.grantable !== "boolean"
    ) {
      fail(`${label} is invalid.`);
    }
    const key = JSON.stringify([entry.grantor, entry.grantee, entry.grantable]);
    const group = groups.get(key) ?? {
      grantor: entry.grantor,
      grantee: entry.grantee,
      grantable: entry.grantable,
      privileges: [],
    };
    if (!group.privileges.includes(entry.privilege)) group.privileges.push(entry.privilege);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function appendObjectAclStatements(statements, entries, allowedPrivileges, target, label, column) {
  for (const group of groupAclEntries(entries, allowedPrivileges, label)) {
    const privileges = group.privileges
      .map((privilege) =>
        column === null ? privilege : `${privilege} (${quoteSqlIdentifier(column)})`,
      )
      .join(", ");
    statements.push(`set role ${quoteSqlIdentifier(group.grantor)};`);
    statements.push(
      `grant ${privileges} on ${target} to ${
        group.grantee === "PUBLIC" ? "public" : quoteSqlIdentifier(group.grantee)
      }${group.grantable ? " with grant option" : ""};`,
    );
    statements.push("reset role;");
  }
}

export function buildRestoreObjectAclSql(contract) {
  const value = contract?.value;
  if (
    !value ||
    !Array.isArray(value.schemas) ||
    !Array.isArray(value.relations) ||
    !Array.isArray(value.columns) ||
    !Array.isArray(value.routines) ||
    !Array.isArray(value.types) ||
    !Array.isArray(value.defaultAcls)
  ) {
    fail("Source object ACL contract is invalid.");
  }
  const statements = [];
  for (const schema of value.schemas) {
    if (!schema || typeof schema.name !== "string") fail("Source schema ACL contract is invalid.");
    appendObjectAclStatements(
      statements,
      schema.acl,
      schemaPrivileges,
      `schema ${quoteSqlIdentifier(schema.name)}`,
      "Source schema ACL contract",
      null,
    );
  }
  for (const relation of value.relations) {
    if (
      !relation ||
      typeof relation.schema !== "string" ||
      typeof relation.name !== "string" ||
      typeof relation.kind !== "string"
    ) {
      fail("Source relation ACL contract is invalid.");
    }
    const sequence = relation.kind === "S";
    appendObjectAclStatements(
      statements,
      relation.acl,
      sequence ? sequencePrivileges : tablePrivileges,
      `${sequence ? "sequence" : "table"} ${quoteSqlIdentifier(relation.schema)}.${quoteSqlIdentifier(
        relation.name,
      )}`,
      "Source relation ACL contract",
      null,
    );
  }
  for (const column of value.columns) {
    if (
      !column ||
      typeof column.schema !== "string" ||
      typeof column.relation !== "string" ||
      typeof column.column !== "string"
    ) {
      fail("Source column ACL contract is invalid.");
    }
    appendObjectAclStatements(
      statements,
      column.acl,
      columnPrivileges,
      `table ${quoteSqlIdentifier(column.schema)}.${quoteSqlIdentifier(column.relation)}`,
      "Source column ACL contract",
      column.column,
    );
  }
  for (const routine of value.routines) {
    if (
      !routine ||
      typeof routine.schema !== "string" ||
      typeof routine.name !== "string" ||
      typeof routine.kind !== "string" ||
      typeof routine.identityArguments !== "string"
    ) {
      fail("Source routine ACL contract is invalid.");
    }
    appendObjectAclStatements(
      statements,
      routine.acl,
      new Set(["EXECUTE"]),
      `${routine.kind === "p" ? "procedure" : "function"} ${quoteSqlIdentifier(
        routine.schema,
      )}.${quoteSqlIdentifier(routine.name)}(${routine.identityArguments})`,
      "Source routine ACL contract",
      null,
    );
  }
  for (const type of value.types) {
    if (!type || typeof type.schema !== "string" || typeof type.name !== "string") {
      fail("Source type ACL contract is invalid.");
    }
    appendObjectAclStatements(
      statements,
      type.acl,
      new Set(["USAGE"]),
      `type ${quoteSqlIdentifier(type.schema)}.${quoteSqlIdentifier(type.name)}`,
      "Source type ACL contract",
      null,
    );
  }
  const defaultObjectTypes = new Map([
    ["r", "tables"],
    ["S", "sequences"],
    ["f", "functions"],
  ]);
  for (const defaultAcl of value.defaultAcls) {
    if (
      !defaultAcl ||
      typeof defaultAcl.schema !== "string" ||
      typeof defaultAcl.owner !== "string" ||
      typeof defaultAcl.objectType !== "string" ||
      !defaultObjectTypes.has(defaultAcl.objectType)
    ) {
      fail("Source default ACL contract is invalid.");
    }
    for (const group of groupAclEntries(
      defaultAcl.acl,
      defaultAcl.objectType === "r"
        ? tablePrivileges
        : defaultAcl.objectType === "S"
          ? sequencePrivileges
          : new Set(["EXECUTE"]),
      "Source default ACL contract",
    )) {
      if (group.grantor !== defaultAcl.owner) fail("Source default ACL grantor is invalid.");
      statements.push(`set role ${quoteSqlIdentifier(defaultAcl.owner)};`);
      statements.push(
        `alter default privileges${
          defaultAcl.schema === "" ? "" : ` in schema ${quoteSqlIdentifier(defaultAcl.schema)}`
        } grant ${group.privileges.join(", ")} on ${defaultObjectTypes.get(
          defaultAcl.objectType,
        )} to ${
          group.grantee === "PUBLIC" ? "public" : quoteSqlIdentifier(group.grantee)
        }${group.grantable ? " with grant option" : ""};`,
      );
      statements.push("reset role;");
    }
  }
  return `${statements.join("\n")}\n`;
}

function assertRootOwnedRegularFile(
  metadata,
  label,
  expectedUid,
  allowedGids,
  expectedMode = null,
) {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== expectedUid ||
    !allowedGids.includes(metadata.gid) ||
    (metadata.mode & 0o022) !== 0 ||
    (expectedMode !== null && (metadata.mode & 0o777) !== expectedMode)
  ) {
    fail(`${label} must be an approved owner-controlled regular file.`);
  }
}

export async function collectRequiredConfigurationSources(
  specifications = requiredConfigurationSources,
  { expectedUid = 0, expectedGid = 0 } = {},
) {
  if (!Array.isArray(specifications) || specifications.length === 0) {
    fail("The critical homologation configuration inventory is empty.");
  }
  const archived = [];
  for (const specification of specifications) {
    if (!specification || !path.isAbsolute(specification.file ?? "")) {
      fail("A critical homologation configuration path is invalid.");
    }
    const sourceUid = specification.expectedUid ?? expectedUid;
    const sourceGids = specification.allowedGids ?? [expectedGid];
    const sourceMode = specification.expectedMode ?? null;
    if (
      !Number.isSafeInteger(sourceUid) ||
      !Array.isArray(sourceGids) ||
      sourceGids.length === 0 ||
      sourceGids.some((gid) => !Number.isSafeInteger(gid)) ||
      (sourceMode !== null &&
        (!Number.isSafeInteger(sourceMode) || sourceMode < 0 || sourceMode > 0o777))
    ) {
      fail("A critical homologation configuration ownership policy is invalid.");
    }
    let sourceMetadata;
    try {
      sourceMetadata = await lstat(specification.file);
    } catch (error) {
      if (error?.code === "ENOENT") {
        fail("A required homologation configuration artifact is absent.");
      }
      throw error;
    }

    if (sourceMetadata.isSymbolicLink()) {
      const targetRoot = specification.symlinkTargetRoot;
      if (!path.isAbsolute(targetRoot ?? "") || (await realpath(targetRoot)) !== targetRoot) {
        fail("A required homologation configuration symlink has no approved target root.");
      }
      const target = await realpath(specification.file);
      const relativeTarget = path.relative(targetRoot, target);
      if (
        relativeTarget === "" ||
        relativeTarget === ".." ||
        relativeTarget.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTarget)
      ) {
        fail("A required homologation configuration symlink escaped its approved target root.");
      }
      const targetMetadata = await lstat(target);
      assertRootOwnedRegularFile(
        targetMetadata,
        "Homologation configuration symlink target",
        sourceUid,
        sourceGids,
        sourceMode,
      );
      archived.push(specification.file, target);
      continue;
    }

    if (specification.symlinkTargetRoot) {
      fail("The approved Nginx configuration source must remain a symlink.");
    }
    assertRootOwnedRegularFile(
      sourceMetadata,
      "Homologation configuration source",
      sourceUid,
      sourceGids,
      sourceMode,
    );
    archived.push(specification.file);
  }
  return Object.freeze([...new Set(archived)]);
}

export async function openPrivateBackupParent(
  directory,
  { expectedUid = 0, expectedGid = 0 } = {},
) {
  if (!path.isAbsolute(directory)) fail("Backup parent path must be absolute.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const before = await lstat(directory);
  if (
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    before.uid !== expectedUid ||
    before.gid !== expectedGid ||
    (before.mode & 0o777) !== 0o700 ||
    (await realpath(directory)) !== directory
  ) {
    fail("Backup parent must be a real owner-controlled directory with mode 0700.");
  }

  const handle = await open(
    directory,
    fileConstants.O_RDONLY | fileConstants.O_DIRECTORY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    const after = await lstat(directory);
    if (
      !opened.isDirectory() ||
      opened.uid !== expectedUid ||
      opened.gid !== expectedGid ||
      (opened.mode & 0o777) !== 0o700 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino
    ) {
      fail("Backup parent changed while its safety boundary was established.");
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export function assertHeadBoundBytes({ label, loaded, committed, expectedSha256 }) {
  if (!Buffer.isBuffer(loaded) || !Buffer.isBuffer(committed) || loaded.length === 0) {
    fail(`${label} could not be bound to the release commit.`);
  }
  const loadedSha256 = sha256(loaded);
  const committedSha256 = sha256(committed);
  if (
    loadedSha256 !== committedSha256 ||
    !loaded.equals(committed) ||
    (expectedSha256 !== undefined && loadedSha256 !== expectedSha256)
  ) {
    fail(`${label} differs from the immutable release commit.`);
  }
  return Object.freeze({ bytes: loaded.length, sha256: loadedSha256 });
}

function assertSourceBoundary(expectedSha) {
  if (process.getuid?.() !== 0) fail("Homologation retirement backup requires root.");
  const sourceSha = run("git", ["rev-parse", "HEAD"], "Git SHA").trim();
  const status = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], "Git worktree");
  if (
    !/^[0-9a-f]{40}$/u.test(sourceSha) ||
    (expectedSha !== undefined && sourceSha !== expectedSha) ||
    status !== ""
  ) {
    fail("Homologation retirement backup requires a clean full-SHA checkout.");
  }
  return sourceSha;
}

async function loadHeadBoundRetirementInputs(sourceSha) {
  const allowlistContents = await readFile(allowlistPath);
  const committedAllowlist = runBuffer(
    "git",
    ["cat-file", "blob", `${sourceSha}:${allowlistRepositoryPath}`],
    "Committed retirement allowlist",
  );
  const allowlistBinding = assertHeadBoundBytes({
    label: "Retirement allowlist",
    loaded: allowlistContents,
    committed: committedAllowlist,
  });
  const manifest = validateRetirementAllowlist(JSON.parse(allowlistContents.toString("utf8")));
  const candidate = await loadRetirementCandidate(repositoryRoot, manifest);
  try {
    const candidateRepositoryPath = `${candidateRepositoryRoot}/${candidate.file}`;
    const committedCandidate = runBuffer(
      "git",
      ["cat-file", "blob", `${sourceSha}:${candidateRepositoryPath}`],
      "Committed retirement candidate",
    );
    const candidateBinding = assertHeadBoundBytes({
      label: "Retirement candidate",
      loaded: candidate.contents,
      committed: committedCandidate,
      expectedSha256: manifest.candidate.sha256,
    });
    return {
      manifest,
      candidate,
      sourceInputs: Object.freeze({
        allowlist: Object.freeze({ file: allowlistRepositoryPath, ...allowlistBinding }),
        candidate: Object.freeze({ file: candidateRepositoryPath, ...candidateBinding }),
      }),
    };
  } catch (error) {
    candidate.contents.fill(0);
    throw error;
  }
}

async function assertRuntimeBoundary(manifest, sourceSha) {
  const runtimeManifestMetadata = await lstat(runtimeManifestPath);
  if (
    !runtimeManifestMetadata.isFile() ||
    runtimeManifestMetadata.isSymbolicLink() ||
    runtimeManifestMetadata.uid !== 0 ||
    runtimeManifestMetadata.gid !== 0 ||
    (runtimeManifestMetadata.mode & 0o777) !== 0o600
  ) {
    fail("Homologation runtime manifest must be a root:root regular file with mode 0600.");
  }
  const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
  if (
    runtimeManifest.schemaVersion !== 1 ||
    runtimeManifest.environment !== "isolated-homologation" ||
    runtimeManifest.dataClassification !== "synthetic-only" ||
    runtimeManifest.sourceSha !== sourceSha
  ) {
    fail("Homologation runtime manifest is invalid or stale for the current release.");
  }
  const socket = await lstat(dockerSocket);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o007) !== 0) {
    fail("Approved Docker socket is unavailable or permissive.");
  }

  const history = readHistory(databaseContainer, "postgres", manifest, "Canary history preflight");
  validateRetirementHistory(manifest, "dry-run", history);
  psql(
    databaseContainer,
    "postgres",
    `begin read only;\n${buildRetirementPreconditionsSql(manifest)}\nrollback;`,
    "Canary retirement preconditions",
  );
  const state = readDatabaseState(
    databaseContainer,
    "postgres",
    manifest,
    "Canary database preflight",
  );
  if (
    state.historyCount !== manifest.baselineVersions.length ||
    state.candidateCount !== 0 ||
    state.pageCount !== manifest.beforePageCount
  ) {
    fail("Homologation database is not the exact 32-migration, 24-page canary baseline.");
  }
  return { sourceSha, history };
}

async function artifact(file, kind) {
  await chmod(file, 0o600);
  const metadata = await stat(file);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail("Backup artifacts must be root:root regular files with mode 0600.");
  }
  return {
    file: path.basename(file),
    kind,
    bytes: metadata.size,
    sha256: await sha256File(file),
  };
}

async function reservePrivateFile(file) {
  const handle = await open(file, "wx", 0o600);
  await handle.close();
}

async function syncRegularFile(file) {
  const handle = await open(file, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) fail("Backup durability sync requires regular files.");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function finalizeBackupDurability(files, backupRoot, backupParentHandle) {
  if (!Array.isArray(files) || files.length === 0 || !backupParentHandle?.sync) {
    fail("Backup durability boundary is invalid.");
  }
  for (const file of files) await syncRegularFile(file);
  const backupRootHandle = await open(
    backupRoot,
    fileConstants.O_RDONLY | fileConstants.O_DIRECTORY | fileConstants.O_NOFOLLOW,
  );
  try {
    const metadata = await backupRootHandle.stat();
    if (!metadata.isDirectory()) fail("Backup durability sync requires a private directory.");
    await backupRootHandle.sync();
  } finally {
    await backupRootHandle.close();
  }
  await backupParentHandle.sync();
}

function waitForRestoreDatabase(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      dockerExecutable,
      [
        "--host",
        dockerEndpoint,
        "exec",
        container,
        "pg_isready",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
      ],
      { env: safeEnvironment, stdio: "ignore" },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  fail("Isolated restore database did not become ready.");
}

function readIdentityRoleContract(container, label, username, ignoredHarnessRole) {
  const output = docker(
    [
      "exec",
      "--interactive",
      "--user",
      "postgres",
      container,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--host",
      "/identity/socket",
      "--port",
      "55432",
      "--username",
      username,
      "--dbname",
      "postgres",
    ],
    label,
    { input: roleContractSql },
  ).trim();
  return parseRoleContractOutput(output, label, ignoredHarnessRole);
}

function proveIdentityArchive(container, databaseGlobalsFile, sourceRoleContract) {
  const bootstrapRoles = sourceRoleContract.value.roles?.filter?.(
    (role) => role?.bootstrap === true,
  );
  if (bootstrapRoles?.length !== 1 || bootstrapRoles[0]?.superuser !== true) {
    fail("Identity restore requires exactly one source bootstrap superuser.");
  }
  const bootstrapRole = bootstrapRoles[0].name;
  docker(["exec", container, "mkdir", "--parents", "/identity/socket"], "Identity restore root");
  docker(
    ["cp", databaseGlobalsFile, `${container}:/tmp/database-globals.sql`],
    "Identity archive staging copy",
  );
  docker(
    ["exec", container, "cp", "/tmp/database-globals.sql", "/identity/database-globals.sql"],
    "Identity archive tmpfs copy",
  );
  docker(
    ["exec", container, "chown", "--recursive", "postgres:postgres", "/identity"],
    "Identity restore ownership",
  );
  docker(
    ["exec", container, "chmod", "0600", "/identity/database-globals.sql"],
    "Identity archive permissions",
  );
  docker(
    ["exec", container, "rm", "-f", "/tmp/database-globals.sql"],
    "Identity archive staging cleanup",
  );
  docker(
    [
      "exec",
      "--user",
      "postgres",
      container,
      "initdb",
      "--pgdata",
      "/identity/data",
      "--username",
      bootstrapRole,
      "--auth-local",
      "trust",
      "--auth-host",
      "reject",
      "--no-instructions",
    ],
    "Identity restore cluster initialization",
  );
  let started = false;
  try {
    docker(
      [
        "exec",
        "--user",
        "postgres",
        container,
        "pg_ctl",
        "--pgdata",
        "/identity/data",
        "--options",
        "-k /identity/socket -p 55432 -c listen_addresses=''",
        "--wait",
        "start",
      ],
      "Identity restore cluster startup",
    );
    started = true;
    docker(
      [
        "exec",
        "--interactive",
        "--user",
        "postgres",
        container,
        "psql",
        "-X",
        "--no-psqlrc",
        "--set",
        "ON_ERROR_STOP=1",
        "--quiet",
        "--host",
        "/identity/socket",
        "--port",
        "55432",
        "--username",
        bootstrapRole,
        "--dbname",
        "postgres",
        "--file",
        "/identity/database-globals.sql",
      ],
      "Identity archive restore",
    );
    const restoredRoleContract = readIdentityRoleContract(
      container,
      "Identity archive role contract",
      bootstrapRole,
      null,
    );
    assertExactSecurityContract(
      sourceRoleContract,
      restoredRoleContract,
      "Identity archive role contract",
    );
    return restoredRoleContract;
  } finally {
    if (started) {
      spawnSync(
        dockerExecutable,
        [
          "--host",
          dockerEndpoint,
          "exec",
          "--user",
          "postgres",
          container,
          "pg_ctl",
          "--pgdata",
          "/identity/data",
          "--mode",
          "fast",
          "--wait",
          "stop",
        ],
        { env: safeEnvironment, stdio: "ignore" },
      );
    }
  }
}

async function proveConfigurationArchive(
  configurationFile,
  backupRoot,
  configurationSources,
  databaseGlobalsFile,
  databaseSecurityFile,
) {
  const members = run("/usr/bin/tar", ["--list", "--file", configurationFile], "Config list")
    .trim()
    .split("\n")
    .filter(Boolean);
  const expectedMembers = [
    ...configurationSources.map((source) => source.replace(/^\/+/, "")),
    path.basename(databaseGlobalsFile),
    path.basename(databaseSecurityFile),
  ].sort();
  const normalizedMembers = members.map((member) => member.replace(/^\/+/, "")).sort();
  if (
    new Set(normalizedMembers).size !== normalizedMembers.length ||
    JSON.stringify(normalizedMembers) !== JSON.stringify(expectedMembers)
  ) {
    fail("Configuration archive inventory differs from the exact required source set.");
  }

  const extractionRoot = path.join(backupRoot, "configuration-restore-smoke");
  await mkdir(extractionRoot, { mode: 0o700 });
  try {
    run(
      "/usr/bin/tar",
      ["--extract", "--file", configurationFile, "--directory", extractionRoot],
      "Configuration archive restore smoke",
    );
    for (const source of configurationSources) {
      const extracted = path.join(extractionRoot, source.replace(/^\/+/, ""));
      const sourceMetadata = await lstat(source);
      const extractedMetadata = await lstat(extracted);
      if (sourceMetadata.isSymbolicLink()) {
        if (
          !extractedMetadata.isSymbolicLink() ||
          (await readlink(extracted)) !== (await readlink(source))
        ) {
          fail("Configuration archive did not preserve an approved symlink.");
        }
      } else if (
        !extractedMetadata.isFile() ||
        (await sha256File(extracted)) !== (await sha256File(source))
      ) {
        fail("Configuration archive restore differs from a required source.");
      }
    }
    for (const generated of [databaseGlobalsFile, databaseSecurityFile]) {
      const extracted = path.join(extractionRoot, path.basename(generated));
      if ((await sha256File(extracted)) !== (await sha256File(generated))) {
        fail("Configuration archive restore differs from generated recovery evidence.");
      }
    }
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

function proveImageArchive(imageFile, expectedImageId) {
  docker(["image", "load", "--input", imageFile], "Application image archive restore smoke");
  const restoredImageId = docker(
    ["image", "inspect", "--format", "{{.Id}}", expectedImageId],
    "Restored application image inventory",
  ).trim();
  if (restoredImageId !== expectedImageId) {
    fail("Application image archive restore did not preserve the immutable image ID.");
  }
  return restoredImageId;
}

async function proveRestore(
  databaseDump,
  databaseGlobalsFile,
  databaseImage,
  backupId,
  manifest,
  candidate,
  sourceRoleContract,
  sourceDatabaseSecurityContract,
) {
  const container = `descomplica-homologation-retirement-restore-${backupId.slice(-12)}`;
  const restorePassword = randomBytes(36).toString("base64url");
  const bootstrapRoles = sourceRoleContract.value.roles?.filter?.(
    (role) => role?.bootstrap === true,
  );
  if (bootstrapRoles?.length !== 1 || bootstrapRoles[0]?.superuser !== true) {
    fail("Database restore requires exactly one source bootstrap superuser.");
  }
  const bootstrapRole = bootstrapRoles[0].name;
  try {
    docker(
      [
        "run",
        "--detach",
        "--name",
        container,
        "--network",
        "none",
        "--tmpfs",
        "/var/lib/postgresql/data:rw,nosuid,noexec,size=2g",
        "--tmpfs",
        "/identity:rw,nosuid,noexec,size=256m",
        "--env",
        `POSTGRES_PASSWORD=${restorePassword}`,
        databaseImage,
      ],
      "Isolated restore container creation",
    );
    waitForRestoreDatabase(container);
    const restoredIdentityContract = proveIdentityArchive(
      container,
      databaseGlobalsFile,
      sourceRoleContract,
    );
    psql(
      container,
      "postgres",
      buildRestoreRolePreparationSql(sourceRoleContract),
      "Prepared restore roles and memberships",
    );
    const preparedRoleContract = readRoleContract(
      container,
      "postgres",
      "Prepared restore role contract",
    );
    assertExactSecurityContract(
      sourceRoleContract,
      preparedRoleContract,
      "Prepared restore role contract",
    );
    docker(
      [
        "exec",
        container,
        "createdb",
        "--username",
        bootstrapRole,
        "--owner",
        sourceDatabaseSecurityContract.value.database.owner,
        "restore",
      ],
      "Restore DB",
    );
    psql(
      container,
      "postgres",
      buildRestoreDatabaseBoundarySql(sourceDatabaseSecurityContract, "restore"),
      "Prepared restore database owner and ACL contract",
    );
    docker(["cp", databaseDump, `${container}:/tmp/database.dump`], "Restore copy");
    docker(
      [
        "exec",
        container,
        "pg_restore",
        "--exit-on-error",
        "--username",
        bootstrapRole,
        "--dbname",
        "restore",
        "/tmp/database.dump",
      ],
      "Isolated database restore",
    );
    psql(
      container,
      "restore",
      buildRestoreObjectAclSql(sourceDatabaseSecurityContract),
      "Restored object ACL replay",
    );
    const restoredDatabaseSecurityContract = readJsonContract(
      container,
      "restore",
      databaseSecurityContractSql,
      "Restored ownership and ACL contract",
    );
    assertExactSecurityContract(
      sourceDatabaseSecurityContract,
      restoredDatabaseSecurityContract,
      "Restored ownership and ACL contract",
    );

    const baselineHistory = readHistory(container, "restore", manifest, "Restored canary history");
    validateRetirementHistory(manifest, "dry-run", baselineHistory);
    psql(
      container,
      "restore",
      `begin read only;\n${buildRetirementPreconditionsSql(manifest)}\nrollback;`,
      "Restored canary preconditions",
    );
    const restored = readDatabaseState(container, "restore", manifest, "Isolated restore proof");
    const canary = manifest.pinnedHistory.at(-1);
    const restoredCanary = baselineHistory.find(({ version }) => version === canary.version);
    const networkMode = docker(
      ["inspect", "--format", "{{.HostConfig.NetworkMode}}", container],
      "Restore network proof",
    ).trim();
    const temporaryFilesystems = JSON.parse(
      docker(
        ["inspect", "--format", "{{json .HostConfig.Tmpfs}}", container],
        "Restore tmpfs proof",
      ).trim(),
    );
    if (
      restored.historyCount !== manifest.baselineVersions.length ||
      restored.candidateCount !== 0 ||
      restored.pageCount !== manifest.beforePageCount ||
      restoredCanary?.name !== canary.name ||
      restoredCanary?.statement_count !== canary.statementCount ||
      restoredCanary?.sha256 !== canary.sha256 ||
      networkMode !== "none" ||
      typeof temporaryFilesystems?.["/var/lib/postgresql/data"] !== "string"
    ) {
      fail("Isolated restore contents or containment boundary are invalid.");
    }

    psql(
      container,
      "restore",
      buildRetirementApplicationSql(manifest, candidate),
      "Isolated retirement rehearsal",
    );
    const rehearsedHistory = readHistory(container, "restore", manifest, "Rehearsed history proof");
    validateRetirementHistory(manifest, "verify", rehearsedHistory);
    psql(
      container,
      "restore",
      `begin read only;\n${buildRetirementPostconditionsSql(manifest)}\nrollback;`,
      "Rehearsed retirement postconditions",
    );
    const rehearsed = readDatabaseState(
      container,
      "restore",
      manifest,
      "Retirement rehearsal proof",
    );
    if (
      rehearsed.historyCount !== manifest.baselineVersions.length + 1 ||
      rehearsed.candidateCount !== 1 ||
      rehearsed.pageCount !== manifest.afterPageCount
    ) {
      fail("Isolated retirement rehearsal did not reach the approved 33/17 state.");
    }

    return {
      restore: {
        ...restored,
        legacyCanary: {
          version: restoredCanary.version,
          name: restoredCanary.name,
          statementCount: restoredCanary.statement_count,
          sha256: restoredCanary.sha256,
        },
      },
      rehearsal: rehearsed,
      security: {
        sourceRoleContractSha256: sourceRoleContract.sha256,
        restoredIdentityContractSha256: restoredIdentityContract.sha256,
        restoredRoleContractSha256: preparedRoleContract.sha256,
        sourceDatabaseAclSha256: sourceDatabaseSecurityContract.sha256,
        restoredDatabaseAclSha256: restoredDatabaseSecurityContract.sha256,
      },
    };
  } finally {
    spawnSync(dockerExecutable, ["--host", dockerEndpoint, "rm", "--force", container], {
      env: safeEnvironment,
      stdio: "ignore",
    });
  }
}

async function main(arguments_) {
  if (arguments_.length !== 0) fail("Homologation retirement backup accepts no arguments.");
  const sourceSha = assertSourceBoundary();
  const { manifest, candidate, sourceInputs } = await loadHeadBoundRetirementInputs(sourceSha);
  let backupParentHandle;
  try {
    const { history } = await assertRuntimeBoundary(manifest, sourceSha);
    const configurationSources = await collectRequiredConfigurationSources();
    backupParentHandle = await openPrivateBackupParent(backupParent);
    const createdAt = new Date().toISOString();
    const backupId = `${createdAt
      .replace(/[-:]/gu, "")
      .replace(/\.\d{3}Z$/u, "Z")}-${randomBytes(6).toString("hex")}`;
    const backupRoot = path.join(backupParent, backupId);
    await mkdir(backupRoot, { mode: 0o700 });
    const backupRootMetadata = await lstat(backupRoot);
    const backupParentMetadata = await backupParentHandle.stat();
    const backupParentPathMetadata = await lstat(backupParent);
    if (
      !backupRootMetadata.isDirectory() ||
      backupRootMetadata.isSymbolicLink() ||
      backupRootMetadata.uid !== 0 ||
      backupRootMetadata.gid !== 0 ||
      (backupRootMetadata.mode & 0o777) !== 0o700 ||
      (await realpath(backupRoot)) !== backupRoot ||
      backupParentMetadata.dev !== backupParentPathMetadata.dev ||
      backupParentMetadata.ino !== backupParentPathMetadata.ino
    ) {
      fail("Backup directory or its private parent changed before artifact creation.");
    }

    const databaseDump = path.join(backupRoot, "database.dump");
    const historyFile = path.join(backupRoot, "migration-history.sql");
    const configurationFile = path.join(backupRoot, "homologation-config.tar");
    const imageFile = path.join(backupRoot, "current-image.tar");
    const databaseGlobalsFile = path.join(backupRoot, "database-globals.sql");
    const databaseSecurityFile = path.join(backupRoot, "database-security-contract.json");
    try {
      const databaseImage = docker(
        ["inspect", "--format", "{{.Image}}", databaseContainer],
        "Database image inventory",
      ).trim();
      const appImage = docker(
        ["inspect", "--format", "{{.Image}}", appContainer],
        "Application image inventory",
      ).trim();
      if (
        !/^sha256:[0-9a-f]{64}$/u.test(databaseImage) ||
        !/^sha256:[0-9a-f]{64}$/u.test(appImage)
      ) {
        fail("Homologation image inventory is invalid.");
      }

      const sourceRoleContract = readRoleContract(
        databaseContainer,
        "postgres",
        "Source database role contract",
      );
      const sourceDatabaseSecurityContract = readJsonContract(
        databaseContainer,
        "postgres",
        databaseSecurityContractSql,
        "Source database ownership and ACL contract",
      );

      await dockerToFile(
        [
          "exec",
          databaseContainer,
          "pg_dump",
          "--format=custom",
          "--username",
          "supabase_admin",
          "--dbname",
          "postgres",
        ],
        databaseDump,
        "Database backup",
      );
      await writeFile(databaseGlobalsFile, buildRestoreRolePreparationSql(sourceRoleContract), {
        mode: 0o600,
        flag: "wx",
      });
      await syncRegularFile(databaseGlobalsFile);
      const databaseGlobals = await artifact(databaseGlobalsFile, "database-globals");
      await writeFile(
        databaseSecurityFile,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            roleContract: sourceRoleContract.value,
            databaseOwnershipAndAclContract: sourceDatabaseSecurityContract.value,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600, flag: "wx" },
      );
      await artifact(databaseSecurityFile, "database-security-contract");
      await syncRegularFile(databaseSecurityFile);
      await writeFile(historyFile, `${JSON.stringify(history, null, 2)}\n`, {
        mode: 0o600,
        flag: "wx",
      });
      await syncRegularFile(historyFile);
      await reservePrivateFile(configurationFile);
      run(
        "/usr/bin/tar",
        [
          "--create",
          "--file",
          configurationFile,
          "--absolute-names",
          ...configurationSources,
          "--directory",
          backupRoot,
          path.basename(databaseGlobalsFile),
          path.basename(databaseSecurityFile),
        ],
        "Configuration backup",
      );
      await chmod(configurationFile, 0o600);
      await syncRegularFile(configurationFile);
      await proveConfigurationArchive(
        configurationFile,
        backupRoot,
        configurationSources,
        databaseGlobalsFile,
        databaseSecurityFile,
      );
      await reservePrivateFile(imageFile);
      docker(["image", "save", "--output", imageFile, appImage], "Application image backup");
      await chmod(imageFile, 0o600);
      await syncRegularFile(imageFile);
      const restoredImageId = proveImageArchive(imageFile, appImage);

      const isolated = await proveRestore(
        databaseDump,
        databaseGlobalsFile,
        databaseImage,
        backupId,
        manifest,
        candidate,
        sourceRoleContract,
        sourceDatabaseSecurityContract,
      );
      await rm(databaseGlobalsFile);
      await rm(databaseSecurityFile);
      const artifacts = await Promise.all([
        artifact(databaseDump, "database"),
        artifact(historyFile, "migration-history"),
        artifact(configurationFile, "configuration"),
        artifact(imageFile, "image"),
      ]);
      const databaseArtifact = artifacts.find(({ kind }) => kind === "database");
      const testedAt = new Date().toISOString();
      assertSourceBoundary(sourceSha);
      const finalAllowlistContents = await readFile(allowlistPath);
      assertHeadBoundBytes({
        label: "Retirement allowlist",
        loaded: finalAllowlistContents,
        committed: runBuffer(
          "git",
          ["cat-file", "blob", `${sourceSha}:${allowlistRepositoryPath}`],
          "Final committed retirement allowlist",
        ),
        expectedSha256: sourceInputs.allowlist.sha256,
      });
      const finalCandidatePath = path.join(repositoryRoot, sourceInputs.candidate.file);
      assertHeadBoundBytes({
        label: "Retirement candidate",
        loaded: await readFile(finalCandidatePath),
        committed: runBuffer(
          "git",
          ["cat-file", "blob", `${sourceSha}:${sourceInputs.candidate.file}`],
          "Final committed retirement candidate",
        ),
        expectedSha256: sourceInputs.candidate.sha256,
      });
      const proof = {
        schemaVersion: 1,
        environment: "isolated-homologation",
        sourceSha,
        backupId,
        createdAt,
        sourceInputs,
        artifacts,
        restore: {
          result: "passed",
          isolated: true,
          networkCount: 0,
          historyCount: isolated.restore.historyCount,
          candidateCount: isolated.restore.candidateCount,
          pageCount: isolated.restore.pageCount,
          preconditionsVerified: true,
          legacyCanary: isolated.restore.legacyCanary,
          databaseArtifact: databaseArtifact.file,
          databaseSha256: databaseArtifact.sha256,
          identityArchiveSha256: databaseGlobals.sha256,
          identityArchiveRestored: true,
          configurationArchiveRestored: true,
          imageArchiveRestored: true,
          restoredImageId,
          databaseImageId: databaseImage,
          rolesPrepared: true,
          ownersAndPrivilegesRestored: true,
          ...isolated.security,
          testedAt,
        },
        rehearsal: {
          result: "passed",
          networkCount: 0,
          historyCount: isolated.rehearsal.historyCount,
          candidateCount: isolated.rehearsal.candidateCount,
          pageCount: isolated.rehearsal.pageCount,
          postconditionsVerified: true,
          candidate: {
            version: manifest.candidate.version,
            name: manifest.candidate.name,
            sha256: manifest.candidate.sha256,
          },
        },
        runtime: { previousImageId: appImage },
      };
      validateRetirementBackupProof(proof, {
        expectedSha: sourceSha,
        expectedBackupId: backupId,
        manifest,
        expectedAllowlistSha256: sourceInputs.allowlist.sha256,
        now: Date.parse(testedAt),
      });

      const proofPath = path.join(backupRoot, "restore-proof.json");
      await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`, {
        mode: 0o600,
        flag: "wx",
      });
      const allFiles = [...artifacts.map(({ file }) => file), "restore-proof.json"];
      const checksumLines = [];
      for (const file of allFiles) {
        checksumLines.push(`${await sha256File(path.join(backupRoot, file))}  ${file}`);
      }
      const checksumPath = path.join(backupRoot, "SHA256SUMS");
      await writeFile(checksumPath, `${checksumLines.join("\n")}\n`, {
        mode: 0o600,
        flag: "wx",
      });
      await chmod(proofPath, 0o600);
      await chmod(checksumPath, 0o600);
      await finalizeBackupDurability(
        [databaseDump, historyFile, configurationFile, imageFile, proofPath, checksumPath],
        backupRoot,
        backupParentHandle,
      );

      process.stdout.write(
        `${JSON.stringify({
          environment: "isolated-homologation",
          scope: manifest.scope,
          productionEligible: false,
          sourceSha,
          backupId,
          checksumManifest: checksumPath,
          historyCount: isolated.restore.historyCount,
          pageCount: isolated.restore.pageCount,
          candidateCount: isolated.restore.candidateCount,
          rehearsalHistoryCount: isolated.rehearsal.historyCount,
          rehearsalPageCount: isolated.rehearsal.pageCount,
          restore: "passed",
          rehearsal: "passed",
          secretsPrinted: false,
        })}\n`,
      );
    } catch (error) {
      await rm(backupRoot, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await backupParentHandle?.close();
    candidate.contents.fill(0);
  }
}

async function dispatch() {
  const state = await enterRuntimeStateLock({
    arguments_: process.argv.slice(2),
    scriptPath: fileURLToPath(import.meta.url),
  });
  if (!state.delegated) await main(state.arguments_);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await dispatch();
  } catch {
    process.stderr.write(
      "Homologation legacy canary retirement backup failed; secrets=not-printed.\n",
    );
    process.exitCode = 1;
  }
}
