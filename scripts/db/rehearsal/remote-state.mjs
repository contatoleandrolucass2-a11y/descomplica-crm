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

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const sourceSupabaseRoot = path.join(repositoryRoot, "supabase");
const migrationManifestPath = path.join(
  repositoryRoot,
  "docs/schema-history/production-migration-manifest.json",
);
const candidateMigrationNames = [
  "20260824230058_auth_mfa_legal_foundation.sql",
  "20260824230100_role_isolation_net_fail_closed.sql",
];
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

let commandEnvironment = {
  ...Object.fromEntries(
    safeEnvironmentNames.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  ),
  NO_COLOR: "1",
  TZ: "UTC",
};

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function sanitizedFailure(label, result, sensitive = false) {
  if (sensitive) return new Error(`${label} failed; sensitive diagnostics suppressed.`);
  const diagnostic = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"']+/gi, "[redacted-database-url]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b(?:sbp|sb_secret|sb_publishable)_[A-Za-z0-9_-]{8,}\b/gi, "[redacted-key]")
    .replace(/\b[0-9a-f]{64}\b/gi, "[redacted-hex]")
    .trim()
    .split("\n")
    .slice(-10)
    .join("\n")
    .slice(-1_500);
  return new Error(`${label} failed.${diagnostic ? `\n${diagnostic}` : ""}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? commandEnvironment,
    input: options.input,
    encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8",
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw sanitizedFailure(options.label ?? command, result, options.sensitive);
  }
  return result.stdout;
}

function runUnchecked(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? commandEnvironment,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function runSupabase(projectRoot, args, label) {
  return run("pnpm", ["exec", "supabase", ...args, "--workdir", projectRoot], {
    label,
    sensitive: true,
  });
}

function parseArguments() {
  const args = process.argv.slice(2);
  let backupDirectory = null;
  let evidencePath = null;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !["--backup-dir", "--evidence"].includes(flag)) {
      throw new Error(
        "Use --backup-dir <absolute-root-only-path> [--evidence <repo-relative.json>].",
      );
    }
    if (flag === "--backup-dir") backupDirectory = value;
    if (flag === "--evidence") evidencePath = value;
  }
  if (!backupDirectory || !path.isAbsolute(backupDirectory)) {
    throw new Error("--backup-dir must be an explicit absolute path.");
  }
  if (evidencePath && path.isAbsolute(evidencePath)) {
    throw new Error("--evidence must be repository-relative.");
  }
  return { backupDirectory: path.resolve(backupDirectory), evidencePath };
}

async function assertRootOnly(filePath) {
  const fileStatus = await stat(filePath);
  if (!fileStatus.isFile() || fileStatus.uid !== 0 || fileStatus.gid !== 0) {
    throw new Error(`Backup input must be a root-owned regular file: ${path.basename(filePath)}.`);
  }
  if ((fileStatus.mode & 0o077) !== 0) {
    throw new Error(
      `Backup input must not grant group/other permissions: ${path.basename(filePath)}.`,
    );
  }
}

async function resolveBackupFile(directory, alternatives) {
  for (const name of alternatives) {
    const candidate = path.join(directory, name);
    try {
      await assertRootOnly(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Required root-only backup file is absent: ${alternatives.join(" or ")}.`);
}

async function loadBackup(directory) {
  const directoryStatus = await stat(directory);
  if (!directoryStatus.isDirectory() || directoryStatus.uid !== 0) {
    throw new Error("Backup directory must exist and be owned by root.");
  }
  const files = {
    checksums: await resolveBackupFile(directory, ["SHA256SUMS"]),
    roles: await resolveBackupFile(directory, ["roles.sql"]),
    schema: await resolveBackupFile(directory, ["schema.sql"]),
    data: await resolveBackupFile(directory, ["data.sql"]),
    historySchema: await resolveBackupFile(directory, ["history-schema.sql", "history_schema.sql"]),
    historyData: await resolveBackupFile(directory, ["history-data.sql", "history_data.sql"]),
  };
  const checksumLines = (await readFile(files.checksums, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const expected = new Map();
  for (const line of checksumLines) {
    const match = /^([0-9a-f]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error("Backup checksum manifest has an invalid line.");
    expected.set(path.basename(match[2]), match[1]);
  }
  const contents = {};
  const checksums = {};
  for (const [kind, filePath] of Object.entries(files)) {
    if (kind === "checksums") continue;
    const buffer = await readFile(filePath);
    const actual = sha256(buffer);
    const declared = expected.get(path.basename(filePath));
    if (!declared || declared !== actual) {
      buffer.fill(0);
      throw new Error(`Backup checksum mismatch: ${path.basename(filePath)}.`);
    }
    contents[kind] = buffer;
    checksums[path.basename(filePath)] = actual;
  }
  return { files, contents, checksums };
}

function unixSocketPath(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Effective Docker endpoint must be a local Unix socket.");
  }
  if (parsed.protocol !== "unix:" || parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Effective Docker endpoint must be a local Unix socket.");
  }
  return decodeURIComponent(parsed.pathname);
}

async function pinLocalDockerEndpoint() {
  const configured = process.env.DOCKER_HOST?.trim();
  const endpoint =
    configured ||
    run(
      "docker",
      [
        "context",
        "inspect",
        run("docker", ["context", "show"], { label: "Docker context" }).trim(),
        "--format",
        '{{(index .Endpoints "docker").Host}}',
      ],
      { label: "Docker endpoint" },
    ).trim();
  const socketPath = unixSocketPath(endpoint);
  const socketStatus = await stat(socketPath);
  if (!socketStatus.isSocket()) throw new Error("Effective Docker endpoint is not a Unix socket.");
  commandEnvironment = { ...commandEnvironment, DOCKER_HOST: endpoint };
  run("docker", ["version", "--format", "{{.Server.Version}}"], { label: "Docker daemon" });
}

function portBlocks() {
  const start = 46_000 + (Number.parseInt(randomBytes(2).toString("hex"), 16) % 12_000);
  const block = (offset) => ({
    shadow: start + offset,
    api: start + offset + 1,
    database: start + offset + 2,
    studio: start + offset + 3,
    mail: start + offset + 4,
    analytics: start + offset + 5,
    pooler: start + offset + 6,
    inspector: start + offset + 7,
  });
  return { source: block(0), target: block(16) };
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
  let patched = contents.replace(/^project_id\s*=.*$/m, `project_id = "${projectId}"`);
  for (const [current, replacement] of replacements)
    patched = patched.replaceAll(current, replacement);
  patched = patched.replace(/(\[db\.seed\][\s\S]*?^\s*enabled\s*=\s*)true/m, "$1false");
  return patched;
}

async function prepareProject(projectRoot, projectId, ports) {
  const supabaseRoot = path.join(projectRoot, "supabase");
  await mkdir(path.join(supabaseRoot, "migrations"), { recursive: true, mode: 0o700 });
  await cp(path.join(sourceSupabaseRoot, "templates"), path.join(supabaseRoot, "templates"), {
    recursive: true,
  });
  await writeFile(path.join(supabaseRoot, "seed.sql"), "-- disabled\n", { mode: 0o600 });
  const config = await readFile(path.join(sourceSupabaseRoot, "config.toml"), "utf8");
  await writeFile(path.join(supabaseRoot, "config.toml"), patchConfig(config, projectId, ports), {
    mode: 0o600,
  });
}

function databaseContainer(projectId) {
  const names = run(
    "docker",
    ["ps", "--filter", `label=com.supabase.cli.project=${projectId}`, "--format", "{{.Names}}"],
    { label: "database container discovery" },
  )
    .trim()
    .split("\n")
    .filter((name) => name.startsWith("supabase_db_"));
  if (names.length !== 1 || names[0] !== `supabase_db_${projectId}`) {
    throw new Error(`Expected exactly one database container for ${projectId}.`);
  }
  return names[0];
}

function isolateContainerNetwork(container) {
  const networks = JSON.parse(
    run("docker", ["inspect", container, "--format", "{{json .NetworkSettings.Networks}}"], {
      label: "container network inspection",
    }),
  );
  for (const network of Object.keys(networks)) {
    run("docker", ["network", "disconnect", "--force", network, container], {
      label: "container network isolation",
    });
  }
  const remaining = JSON.parse(
    run("docker", ["inspect", container, "--format", "{{json .NetworkSettings.Networks}}"], {
      label: "isolated network verification",
    }),
  );
  if (Object.keys(remaining).length !== 0)
    throw new Error("Database container still has a network.");
}

function psql(container, input, label, options = {}) {
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
      ...(options.singleTransaction ? ["--single-transaction"] : []),
      "--username",
      options.user ?? "postgres",
      "--dbname",
      "postgres",
    ],
    { input, encoding: options.encoding ?? "utf8", label, sensitive: options.sensitive ?? true },
  );
}

function prepareRestoreDefaults(container) {
  psql(
    container,
    `alter default privileges for role postgres in schema public
       revoke all on tables from public, anon, authenticated, service_role;
     alter default privileges for role supabase_admin in schema public
       revoke all on tables from public, anon, authenticated, service_role;`,
    "prepare fail-closed restore defaults",
    { user: "supabase_admin" },
  );
}

function restoreRemoteSource(container, backup) {
  psql(container, backup.roles, "restore remote roles", {
    encoding: null,
    user: "supabase_admin",
  });
  prepareRestoreDefaults(container);
  psql(container, backup.schema, "restore remote schema", {
    encoding: null,
    user: "supabase_admin",
  });
  psql(container, backup.historySchema, "restore remote migration schema", {
    encoding: null,
    user: "supabase_admin",
  });
  psql(container, backup.historyData, "restore remote migration history", {
    encoding: null,
    user: "supabase_admin",
  });
  const dataInput = Buffer.concat([
    Buffer.from("set session_replication_role = replica;\n"),
    backup.data,
    Buffer.from("\nset session_replication_role = origin;\n"),
  ]);
  try {
    psql(container, dataInput, "restore remote data", {
      encoding: null,
      user: "supabase_admin",
    });
  } finally {
    dataInput.fill(0);
  }
}

function structuralDump(container) {
  const output = run(
    "docker",
    [
      "exec",
      container,
      "pg_dump",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
      "--data-only",
      "--column-inserts",
      "--no-owner",
      "--no-privileges",
      "--table=public.roles",
      "--table=public.permissions",
      "--table=public.role_permissions",
      "--table=public.app_pages",
    ],
    { label: "sanitized structural export", encoding: null, sensitive: true },
  );
  const text = output.toString("utf8");
  if (/@|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(text)) {
    output.fill(0);
    throw new Error("Sanitized structural export unexpectedly contains an identity marker.");
  }
  return output;
}

const fingerprintSql = `
select jsonb_build_object(
  'roles', encode(extensions.digest(convert_to(coalesce((select jsonb_agg(to_jsonb(r) order by r.key) from public.roles r), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'),
  'permissions', encode(extensions.digest(convert_to(coalesce((select jsonb_agg(to_jsonb(p) order by p.key) from public.permissions p), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'),
  'role_permissions', encode(extensions.digest(convert_to(coalesce((select jsonb_agg(to_jsonb(rp) order by rp.role_key, rp.permission_key) from public.role_permissions rp), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'),
  'app_pages', encode(extensions.digest(convert_to(coalesce((select jsonb_agg(to_jsonb(ap) order by ap.key) from public.app_pages ap), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex'),
  'counts', jsonb_build_object(
    'roles', (select count(*) from public.roles),
    'permissions', (select count(*) from public.permissions),
    'role_permissions', (select count(*) from public.role_permissions),
    'app_pages', (select count(*) from public.app_pages),
    'profiles', (select count(*) from public.profiles),
    'user_roles', (select count(*) from public.user_roles),
    'overrides', (select count(*) from public.user_permission_overrides)
  )
);
`;

function parseSingleJson(output, label) {
  const lines = output
    .toString("utf8")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) throw new Error(`${label} returned an unexpected row count.`);
  return JSON.parse(lines[0]);
}

function captureFingerprint(container) {
  return parseSingleJson(psql(container, fingerprintSql, "RBAC fingerprint"), "RBAC fingerprint");
}

function restoreSanitizedTarget(container, backup, sanitizedData) {
  psql(container, backup.roles, "restore target roles", {
    encoding: null,
    user: "supabase_admin",
  });
  prepareRestoreDefaults(container);
  psql(container, backup.schema, "restore target schema", {
    encoding: null,
    user: "supabase_admin",
  });
  psql(container, backup.historySchema, "restore target migration schema", {
    encoding: null,
    user: "supabase_admin",
  });
  psql(container, backup.historyData, "restore target migration history", {
    encoding: null,
    user: "supabase_admin",
  });
  psql(container, sanitizedData, "restore sanitized structural baseline", {
    encoding: null,
    user: "supabase_admin",
  });
}

async function applyCandidateMigrations(container) {
  const applied = [];
  for (const fileName of candidateMigrationNames) {
    const match = /^(\d{14})_(.+)\.sql$/.exec(fileName);
    if (!match) throw new Error(`Invalid candidate migration filename: ${fileName}.`);
    const migrationPath = path.join(sourceSupabaseRoot, "migrations", fileName);
    const contents = await readFile(migrationPath);
    psql(container, contents, `apply candidate ${match[1]}`, {
      encoding: null,
      singleTransaction: true,
    });
    const encoded = contents.toString("base64");
    psql(
      container,
      `insert into supabase_migrations.schema_migrations (version, statements, name) values ('${match[1]}', array[convert_from(decode('${encoded}', 'base64'), 'UTF8')], '${match[2]}');`,
      `record candidate ${match[1]}`,
    );
    applied.push({ version: match[1], name: match[2], sha256: sha256(contents) });
    contents.fill(0);
  }
  return applied;
}

function verifyTarget(container, expectedFingerprint, migrationManifest) {
  const actualFingerprint = captureFingerprint(container);
  for (const key of ["roles", "permissions", "role_permissions", "app_pages"]) {
    if (actualFingerprint[key] !== expectedFingerprint[key]) {
      throw new Error(`Candidate changed production ${key} fingerprint.`);
    }
  }
  const expectedVersions = [
    ...migrationManifest.remoteOnlyReconciliations.map(({ version }) => version),
    ...candidateMigrationNames.map((name) => name.slice(0, 14)),
  ];
  const verification = parseSingleJson(
    psql(
      container,
      `select jsonb_build_object(
        'candidate_history', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in ('20260824230058','20260824230100')),
        'reconciled_history', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in (${migrationManifest.remoteOnlyReconciliations.map(({ version }) => `'${version}'`).join(",")})),
        'migration_count', (select count(*) from supabase_migrations.schema_migrations),
        'sanitized', not exists(select 1 from public.profiles) and not exists(select 1 from public.user_roles) and not exists(select 1 from public.user_permission_overrides) and not exists(select 1 from public.audit_logs) and not exists(select 1 from private.crm_imob_ranking_read_secrets),
        'qlik_direct_grant_count', (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and grantee in ('PUBLIC','anon','authenticated','service_role')),
        'qlik_unsafe_read_policy_count', (select count(*) from pg_policies where schemaname='public' and tablename in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and cmd in ('SELECT','ALL') and (permissive <> 'RESTRICTIVE' or policyname <> 'authenticated_session_mfa_gate' or roles <> array['authenticated']::name[] or coalesce(qual, '') not like '%current_session_satisfies_mfa%' or coalesce(with_check, '') not like '%current_session_satisfies_mfa%')),
        'qlik_mfa_restrictive_policy_count', (select count(*) from pg_policies where schemaname='public' and tablename in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and policyname='authenticated_session_mfa_gate' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and coalesce(qual, '') like '%current_session_satisfies_mfa%' and coalesce(with_check, '') like '%current_session_satisfies_mfa%'),
        'qlik_tables_fail_closed', not exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and grantee in ('PUBLIC','anon','authenticated','service_role')) and not exists(select 1 from pg_policies where schemaname='public' and tablename in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and cmd in ('SELECT','ALL') and (permissive <> 'RESTRICTIVE' or policyname <> 'authenticated_session_mfa_gate' or roles <> array['authenticated']::name[] or coalesce(qual, '') not like '%current_session_satisfies_mfa%' or coalesce(with_check, '') not like '%current_session_satisfies_mfa%')) and (select count(*)=3 from pg_policies where schemaname='public' and tablename in ('crm_imob_ranking_runs','crm_imob_ranking_entries','crm_imob_ranking_developments') and policyname='authenticated_session_mfa_gate' and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[] and coalesce(qual, '') like '%current_session_satisfies_mfa%' and coalesce(with_check, '') like '%current_session_satisfies_mfa%'),
        'legal_tables_secure', (select count(*)=2 and bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('legal_acceptance_requirements','legal_acceptances')) and not exists(select 1 from information_schema.role_table_grants where table_schema='private' and table_name in ('legal_acceptance_requirements','legal_acceptances') and grantee in ('PUBLIC','anon','authenticated','service_role')),
        'session_functions', to_regprocedure('private.current_session_is_live()') is not null and to_regprocedure('private.current_session_satisfies_mfa()') is not null and to_regprocedure('public.revoke_current_user_sessions_after_password_recovery()') is not null,
        'registration_trigger', exists(select 1 from pg_trigger where not tgisinternal and tgrelid='auth.users'::regclass and tgname='on_auth_user_legal_acceptance'),
        'future_foundations_absent', to_regnamespace('qlik_relay') is null and to_regnamespace('commercial_engine') is null and not exists(select 1 from pg_roles where rolname in ('crm_qlik_relay','crm_commercial_engine'))
      );`,
      "target compatibility verification",
    ),
    "target compatibility verification",
  );
  if (
    JSON.stringify(verification.candidate_history) !== JSON.stringify(expectedVersions.slice(-2))
  ) {
    throw new Error("Candidate migration history is incomplete.");
  }
  if (
    JSON.stringify(verification.reconciled_history) !==
    JSON.stringify(expectedVersions.slice(0, -2))
  ) {
    throw new Error("Remote-only migration history is not reconciled.");
  }
  for (const invariant of [
    "sanitized",
    "qlik_tables_fail_closed",
    "legal_tables_secure",
    "session_functions",
    "registration_trigger",
    "future_foundations_absent",
  ]) {
    if (verification[invariant] !== true) {
      const detail =
        invariant === "qlik_tables_fail_closed"
          ? ` grants=${verification.qlik_direct_grant_count}; unsafePolicies=${verification.qlik_unsafe_read_policy_count}; mfaRestrictivePolicies=${verification.qlik_mfa_restrictive_policy_count}`
          : "";
      throw new Error(`Target invariant failed: ${invariant}.${detail}`);
    }
  }
  return { fingerprint: actualFingerprint, verification };
}

function parseNamedResources(output, projectId) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, name]) => name === projectId || name?.endsWith(`_${projectId}`));
}

function cleanupProject(_projectRoot, projectId, attempted) {
  if (!attempted) return;
  const commands = [
    ["container", ["ps", "-a", "--format", "{{.ID}}\t{{.Names}}"], ["rm", "--force"]],
    ["network", ["network", "ls", "--format", "{{.ID}}\t{{.Name}}"], ["network", "rm"]],
    ["volume", ["volume", "ls", "--format", "{{.Name}}\t{{.Name}}"], ["volume", "rm"]],
  ];
  for (const [, discovery, removal] of commands) {
    const result = runUnchecked("docker", discovery);
    if (result.status !== 0) continue;
    const ids = parseNamedResources(result.stdout, projectId).map(([id]) => id);
    if (ids.length > 0) runUnchecked("docker", [...removal, ...ids]);
  }
}

async function writeEvidence(relativePath, evidence) {
  if (!relativePath) return;
  const destination = path.resolve(repositoryRoot, relativePath);
  if (!destination.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error("Evidence path must remain inside the repository.");
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const { backupDirectory, evidencePath } = parseArguments();
  const migrationManifest = JSON.parse(await readFile(migrationManifestPath, "utf8"));
  const backup = await loadBackup(backupDirectory);
  await pinLocalDockerEndpoint();

  const runId = randomBytes(5).toString("hex");
  const sourceProjectId = `descomplica-remote-source-${runId}`;
  const targetProjectId = `descomplica-remote-target-${runId}`;
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "descomplica-remote-rehearsal-"));
  const sourceProjectRoot = path.join(temporaryRoot, "source");
  const targetProjectRoot = path.join(temporaryRoot, "target");
  const ports = portBlocks();
  let sourceAttempted = false;
  let targetAttempted = false;
  let sanitizedData = null;
  let result;
  let failure;

  try {
    await Promise.all([
      prepareProject(sourceProjectRoot, sourceProjectId, ports.source),
      prepareProject(targetProjectRoot, targetProjectId, ports.target),
    ]);

    sourceAttempted = true;
    runSupabase(
      sourceProjectRoot,
      ["start", "--exclude", excludedServices, "--yes"],
      "source start",
    );
    const sourceContainer = databaseContainer(sourceProjectId);
    isolateContainerNetwork(sourceContainer);
    restoreRemoteSource(sourceContainer, backup.contents);
    const sourceFingerprint = captureFingerprint(sourceContainer);
    if (
      sourceFingerprint.counts.roles !== 8 ||
      sourceFingerprint.counts.permissions !== 20 ||
      sourceFingerprint.counts.role_permissions !== 61 ||
      sourceFingerprint.counts.app_pages !== 17
    ) {
      throw new Error(
        `Remote backup does not match the audited structural baseline: ${JSON.stringify(sourceFingerprint.counts)}.`,
      );
    }
    sanitizedData = structuralDump(sourceContainer);

    targetAttempted = true;
    runSupabase(
      targetProjectRoot,
      ["start", "--exclude", excludedServices, "--yes"],
      "target start",
    );
    const targetContainer = databaseContainer(targetProjectId);
    isolateContainerNetwork(targetContainer);
    restoreSanitizedTarget(targetContainer, backup.contents, sanitizedData);
    const applied = await applyCandidateMigrations(targetContainer);
    const target = verifyTarget(targetContainer, sourceFingerprint, migrationManifest);

    result = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      environment: "two isolated local Supabase/PostgreSQL 17 projects",
      source: "root-only production backup",
      remoteMutation: false,
      sourceNetworkCount: 0,
      targetNetworkCount: 0,
      backupChecksums: backup.checksums,
      remoteMigrationCount: migrationManifest.remoteMigrationCount,
      reconciledRemoteOnlyVersions: migrationManifest.remoteOnlyReconciliations.map(
        ({ version }) => version,
      ),
      appliedCandidates: applied,
      structuralCounts: sourceFingerprint.counts,
      structuralFingerprintsPreserved: true,
      sanitizedTarget: target.verification.sanitized,
      qlikTablesFailClosed: target.verification.qlik_tables_fail_closed,
      legalTablesSecure: target.verification.legal_tables_secure,
      sessionFunctionsPresent: target.verification.session_functions,
      registrationTriggerPresent: target.verification.registration_trigger,
      futureFoundationsAbsent: target.verification.future_foundations_absent,
      cleanInstallGate: "run separately with pnpm db:rehearse and pnpm db:test",
    };
  } catch (error) {
    failure = error;
  } finally {
    sanitizedData?.fill(0);
    for (const buffer of Object.values(backup.contents)) buffer.fill(0);
    cleanupProject(targetProjectRoot, targetProjectId, targetAttempted);
    cleanupProject(sourceProjectRoot, sourceProjectId, sourceAttempted);
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  if (failure) throw failure;
  await writeEvidence(evidencePath, result);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `Remote-state rehearsal failed: ${String(error instanceof Error ? error.message : error).replace(/\b[0-9a-f]{64}\b/gi, "[redacted-hex]")}\n`,
  );
  process.exitCode = 1;
}
