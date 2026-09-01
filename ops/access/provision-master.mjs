import { spawnSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import {
  parseMasterProvisioningArguments,
  selectMasterProvisioningRequest,
  validateMasterProvisioningManifest,
} from "./master-provisioning-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const manifestPath = path.join(import.meta.dirname, "master-provisioning.json");
const migrationVersion = "20260901204113";
const safeEnvironment = {
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};

function fail(message) {
  throw new Error(message);
}

function runGit(arguments_) {
  const result = spawnSync("/usr/bin/git", arguments_, {
    cwd: repositoryRoot,
    env: safeEnvironment,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) fail("Source revision verification failed.");
  return result.stdout;
}

async function readRootOnlySecretFile(filePath) {
  if ((await realpath(filePath)) !== filePath) fail("Database URL file must not be a symlink.");
  const metadata = await stat(filePath);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail("Database URL file must be a root:root regular file with mode 0600.");
  }
  const contents = await readFile(filePath);
  const connectionString = contents.toString("utf8").trim();
  contents.fill(0);
  if (
    !connectionString.startsWith("postgresql://") &&
    !connectionString.startsWith("postgres://")
  ) {
    fail("Database URL file does not contain a PostgreSQL connection string.");
  }
  return connectionString;
}

async function inspect(sql, request) {
  const [result] = await sql`
    with target as (
      select auth_user.id
      from auth.users auth_user
      where encode(
        sha256(convert_to(lower(btrim(auth_user.email)), 'UTF8')),
        'hex'
      ) = ${request.targetEmailSha256}
    )
    select
      (select count(*)::integer from target) as target_count,
      exists (
        select 1
        from target
        join private.legal_acceptance_requirements requirement
          on requirement.user_id = target.id
        join private.legal_acceptances acceptance
          on acceptance.user_id = target.id
         and acceptance.terms_version = requirement.terms_version
         and acceptance.privacy_version = requirement.privacy_version
        where requirement.terms_version = ${request.termsVersion}
          and requirement.privacy_version = ${request.privacyVersion}
      ) as legal_acceptance_current,
      coalesce((
        select case when user_role.role_key = 'master' then 'master' else 'other' end
        from target
        left join public.user_roles user_role on user_role.user_id = target.id
      ), 'none') as target_role_state,
      (select count(*)::integer from public.user_roles where role_key = 'master') as master_count,
      exists (
        select 1
        from supabase_migrations.schema_migrations migration
        where migration.version = ${migrationVersion}
      ) as migration_applied,
      current_user = 'postgres' as owner_session
  `;
  return result;
}

async function apply(sql, request, expectedSha) {
  return sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtextextended('ops.access.provision-master', 0))`;
    const before = await inspect(transaction, request);
    if (
      before.target_count !== 1 ||
      !before.legal_acceptance_current ||
      !before.migration_applied ||
      !before.owner_session
    ) {
      fail("Master provisioning preconditions are not satisfied.");
    }

    const [target] = await transaction`
      select auth_user.id
      from auth.users auth_user
      where encode(
        sha256(convert_to(lower(btrim(auth_user.email)), 'UTF8')),
        'hex'
      ) = ${request.targetEmailSha256}
      for update
    `;
    if (!target) fail("Source-controlled Master target no longer exists.");

    await transaction`select set_config('app.master_provisioning_change', ${request.changeRef}, true)`;
    await transaction`select set_config('app.master_provisioning_revision', ${expectedSha}, true)`;
    const [bootstrap] = await transaction`
      select public.bootstrap_master_user(${target.id}::uuid) as result
    `;
    const after = await inspect(transaction, request);
    if (
      after.target_count !== 1 ||
      after.target_role_state !== "master" ||
      after.master_count < before.master_count ||
      bootstrap?.result?.ok !== true
    ) {
      fail("Master provisioning postconditions failed.");
    }

    return {
      targetState: after.target_role_state,
      masterCountBefore: before.master_count,
      masterCountAfter: after.master_count,
      noop: bootstrap.result.noop === true,
    };
  });
}

async function main() {
  const options = parseMasterProvisioningArguments(process.argv.slice(2));
  if (process.getuid?.() !== 0) fail("Master provisioning requires a root operator.");

  const currentSha = runGit(["rev-parse", "HEAD"]).trim();
  if (currentSha !== options.expectedSha) fail("Current Git revision differs from --expected-sha.");
  if (runGit(["status", "--porcelain=v1", "--untracked-files=all"]).length !== 0) {
    fail("Master provisioning requires a clean worktree.");
  }
  runGit(["ls-files", "--error-unmatch", path.relative(repositoryRoot, manifestPath)]);

  const manifest = validateMasterProvisioningManifest(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const request = selectMasterProvisioningRequest(manifest, options.changeRef, options.environment);
  const databaseUrl = await readRootOnlySecretFile(options.databaseUrlFile);
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  });

  try {
    if (options.mode === "preflight") {
      const state = await inspect(sql, request);
      process.stdout.write(
        `${JSON.stringify({
          mode: "preflight",
          environment: options.environment,
          targetExists: state.target_count === 1,
          legalAcceptanceCurrent: state.legal_acceptance_current,
          targetState: state.target_role_state,
          masterCount: state.master_count,
          migrationApplied: state.migration_applied,
          ownerSession: state.owner_session,
        })}\n`,
      );
      return;
    }

    const state = await apply(sql, request, options.expectedSha);
    process.stdout.write(
      `${JSON.stringify({ mode: "apply", environment: options.environment, ...state })}\n`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  process.stderr.write("Master provisioning failed; sensitive diagnostics suppressed.\n");
  process.exitCode = 1;
});
