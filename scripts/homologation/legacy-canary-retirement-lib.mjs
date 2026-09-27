import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { postconditionsSql, validateBackupProof } from "./auth-mfa-upgrade-lib.mjs";

const versionPattern = /^\d{14}$/u;
const reconciliationVersionPattern = /^20260926\d{6}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
const filePattern = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const pinnedVersions = Object.freeze(["20260824230058", "20260824230100", "20260828135947"]);
const runtimeModeAssignment = "LEGACY_MIGRATION_RUNTIME_MODE=off";
const enabledModulesAssignment = "LEGACY_MIGRATION_ENABLED_MODULES=";
const stoppedAppContainerName = "/descomplica-homologation-app";

function assertOrderedVersions(versions, label) {
  if (
    !Array.isArray(versions) ||
    versions.some((version) => !versionPattern.test(version)) ||
    new Set(versions).size !== versions.length ||
    versions.some((version, index) => index > 0 && versions[index - 1] >= version)
  ) {
    throw new Error(`${label} must contain unique, strictly ordered migration versions.`);
  }
  return [...versions];
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function requiresRetirementRuntimeShutdown(mode) {
  if (!new Set(["dry-run", "apply", "verify"]).has(mode)) {
    throw new Error("Unknown legacy canary retirement mode.");
  }
  return mode === "apply";
}

export function validateRetirementRuntimeEnvironment(contents) {
  if (typeof contents !== "string" || contents.includes("\0")) {
    throw new Error("Homologation runtime environment is invalid.");
  }
  const lines = contents.split(/\r?\n/u);
  const runtimeModeLines = lines.filter((line) =>
    /^(?:export\s+)?LEGACY_MIGRATION_RUNTIME_MODE\s*=/u.test(line.trimStart()),
  );
  const enabledModuleLines = lines.filter((line) =>
    /^(?:export\s+)?LEGACY_MIGRATION_ENABLED_MODULES\s*=/u.test(line.trimStart()),
  );
  if (
    runtimeModeLines.length !== 1 ||
    runtimeModeLines[0] !== runtimeModeAssignment ||
    enabledModuleLines.length !== 1 ||
    enabledModuleLines[0] !== enabledModulesAssignment
  ) {
    throw new Error(
      "Apply requires exactly one disabled legacy runtime mode and one empty module allowlist.",
    );
  }
  return Object.freeze({ runtimeMode: "off", enabledModules: Object.freeze([]) });
}

export function validateStoppedRetirementAppInspection(output) {
  if (typeof output !== "string") {
    throw new Error("Homologation application container inspection is invalid.");
  }
  const rows = output
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length !== 1) {
    throw new Error("The homologation application container must exist exactly once.");
  }
  const separator = rows[0].indexOf("\t");
  if (separator <= 0 || rows[0].indexOf("\t", separator + 1) !== -1) {
    throw new Error("Homologation application container inspection is malformed.");
  }

  let name;
  let state;
  try {
    name = JSON.parse(rows[0].slice(0, separator));
    state = JSON.parse(rows[0].slice(separator + 1));
  } catch {
    throw new Error("Homologation application container inspection is malformed.");
  }
  if (
    name !== stoppedAppContainerName ||
    !state ||
    state.Status !== "exited" ||
    state.Running !== false ||
    state.Paused !== false ||
    state.Restarting !== false ||
    state.Dead !== false
  ) {
    throw new Error("Apply requires the exact homologation application container to be stopped.");
  }
  return Object.freeze({ name, status: state.Status });
}

export function validateRetirementAllowlist(rawManifest) {
  if (
    !rawManifest ||
    rawManifest.schemaVersion !== 1 ||
    rawManifest.environment !== "isolated-homologation" ||
    rawManifest.scope !== "legacy-canary-retirement" ||
    rawManifest.productionEligible !== false ||
    rawManifest.beforePageCount !== 24 ||
    rawManifest.afterPageCount !== 17 ||
    !hashPattern.test(rawManifest.beforePageCatalogSha256 ?? "") ||
    !hashPattern.test(rawManifest.afterPageCatalogSha256 ?? "") ||
    !Array.isArray(rawManifest.pinnedHistory) ||
    !rawManifest.candidate
  ) {
    throw new Error("Legacy canary retirement allowlist is invalid.");
  }

  const baselineVersions = assertOrderedVersions(rawManifest.baselineVersions, "Baseline");
  if (
    baselineVersions.length !== 32 ||
    JSON.stringify(baselineVersions.slice(-pinnedVersions.length)) !==
      JSON.stringify(pinnedVersions)
  ) {
    throw new Error("Retirement baseline must be the exact 32-migration canary history.");
  }

  const pinnedHistory = rawManifest.pinnedHistory.map((migration) => {
    if (
      !migration ||
      !versionPattern.test(migration.version ?? "") ||
      !/^[a-z0-9_]+$/u.test(migration.name ?? "") ||
      migration.statementCount !== 1 ||
      !hashPattern.test(migration.sha256 ?? "")
    ) {
      throw new Error("A hash-pinned predecessor migration is invalid.");
    }
    return { ...migration };
  });
  if (
    JSON.stringify(pinnedHistory.map(({ version }) => version)) !==
      JSON.stringify(pinnedVersions) ||
    pinnedHistory.some(({ version }) => !baselineVersions.includes(version))
  ) {
    throw new Error("Auth/MFA and canary predecessor pins are incomplete or reordered.");
  }

  const candidateMatch = filePattern.exec(rawManifest.candidate.file ?? "");
  if (
    !candidateMatch ||
    rawManifest.candidate.version !== candidateMatch[1] ||
    rawManifest.candidate.name !== candidateMatch[2] ||
    !reconciliationVersionPattern.test(rawManifest.candidate.version) ||
    rawManifest.candidate.version <= baselineVersions.at(-1) ||
    baselineVersions.includes(rawManifest.candidate.version) ||
    !hashPattern.test(rawManifest.candidate.sha256 ?? "")
  ) {
    throw new Error("Legacy canary retirement candidate is invalid or not dated 20260926.");
  }

  return Object.freeze({
    schemaVersion: 1,
    environment: rawManifest.environment,
    scope: rawManifest.scope,
    productionEligible: false,
    beforePageCount: rawManifest.beforePageCount,
    afterPageCount: rawManifest.afterPageCount,
    beforePageCatalogSha256: rawManifest.beforePageCatalogSha256,
    afterPageCatalogSha256: rawManifest.afterPageCatalogSha256,
    baselineVersions: Object.freeze(baselineVersions),
    pinnedHistory: Object.freeze(pinnedHistory.map(Object.freeze)),
    candidate: Object.freeze({ ...rawManifest.candidate }),
  });
}

export async function loadRetirementCandidate(repositoryRoot, manifest) {
  const candidateRoot = path.join(repositoryRoot, "deploy/homologation/migrations");
  if ((await realpath(candidateRoot)) !== candidateRoot) {
    throw new Error("Homologation migration directory must not be a symlink.");
  }
  const sqlFiles = (await readdir(candidateRoot)).filter((file) => file.endsWith(".sql")).sort();
  if (JSON.stringify(sqlFiles) !== JSON.stringify([manifest.candidate.file])) {
    throw new Error("Homologation-only SQL inventory differs from the retirement allowlist.");
  }

  const candidatePath = path.resolve(candidateRoot, manifest.candidate.file);
  if (path.dirname(candidatePath) !== candidateRoot) {
    throw new Error("Retirement candidate path escaped the homologation migration directory.");
  }
  const candidateMetadata = await lstat(candidatePath);
  if (!candidateMetadata.isFile() || (await realpath(candidatePath)) !== candidatePath) {
    throw new Error("Retirement candidate must be a regular non-symlink file.");
  }
  const contents = await readFile(candidatePath);
  const text = contents.toString("utf8");
  if (sha256(contents) !== manifest.candidate.sha256) {
    contents.fill(0);
    throw new Error("Legacy canary retirement candidate hash differs from the allowlist.");
  }
  if (
    /^\s*\\/mu.test(text) ||
    /^\s*(?:begin|commit|rollback)\s*;/imu.test(text) ||
    /supabase_migrations\.schema_migrations/iu.test(text) ||
    /migration\s+repair/iu.test(text)
  ) {
    contents.fill(0);
    throw new Error("Legacy canary retirement candidate contains forbidden migration control.");
  }
  return { ...manifest.candidate, contents };
}

export function expectedRetirementHistory(manifest, mode) {
  if (mode === "dry-run" || mode === "apply") return [...manifest.baselineVersions];
  if (mode === "verify") {
    return [...manifest.baselineVersions, manifest.candidate.version].sort();
  }
  throw new Error("Unknown legacy canary retirement mode.");
}

export function validateRetirementHistory(manifest, mode, historyRows) {
  if (!Array.isArray(historyRows)) {
    throw new Error("Legacy canary retirement history result is invalid.");
  }
  const actualVersions = historyRows.map((row) => String(row?.version ?? ""));
  if (
    actualVersions.some((version) => !versionPattern.test(version)) ||
    new Set(actualVersions).size !== actualVersions.length
  ) {
    throw new Error("Migration history contains an invalid or duplicate version.");
  }
  actualVersions.sort();
  if (
    JSON.stringify(actualVersions) !== JSON.stringify(expectedRetirementHistory(manifest, mode))
  ) {
    throw new Error("Homologation history differs from the exact canary retirement gate.");
  }

  const byVersion = new Map(historyRows.map((row) => [String(row?.version ?? ""), row]));
  for (const expected of manifest.pinnedHistory) {
    const actual = byVersion.get(expected.version);
    if (
      actual?.name !== expected.name ||
      actual?.statement_count !== expected.statementCount ||
      actual?.sha256 !== expected.sha256
    ) {
      throw new Error(`Hash-pinned predecessor mismatch: ${expected.version}.`);
    }
  }
  if (mode === "verify") {
    const actual = byVersion.get(manifest.candidate.version);
    if (
      actual?.name !== manifest.candidate.name ||
      actual?.statement_count !== 1 ||
      actual?.sha256 !== manifest.candidate.sha256
    ) {
      throw new Error("Applied retirement candidate history hash is invalid.");
    }
  }

  return {
    historyCount: actualVersions.length,
    pendingVersions: mode === "verify" ? [] : [manifest.candidate.version],
  };
}

export function validateRetirementBackupProof(
  rawProof,
  { expectedSha, expectedBackupId, expectedAllowlistSha256, manifest, now },
) {
  const proof = validateBackupProof(rawProof, {
    expectedSha,
    expectedBackupId,
    expectedHistoryCount: manifest.baselineVersions.length,
    ...(now === undefined ? {} : { now }),
  });
  const canary = manifest.pinnedHistory.at(-1);
  const restoredCanary = rawProof.restore?.legacyCanary;
  const sourceInputs = rawProof.sourceInputs;
  const expectedCandidateFile = `deploy/homologation/migrations/${manifest.candidate.file}`;
  if (
    !hashPattern.test(expectedAllowlistSha256 ?? "") ||
    sourceInputs?.allowlist?.file !==
      "deploy/homologation/legacy-canary-retirement-allowlist.json" ||
    sourceInputs?.allowlist?.sha256 !== expectedAllowlistSha256 ||
    !Number.isSafeInteger(sourceInputs?.allowlist?.bytes) ||
    sourceInputs.allowlist.bytes <= 0 ||
    sourceInputs?.candidate?.file !== expectedCandidateFile ||
    sourceInputs?.candidate?.sha256 !== manifest.candidate.sha256 ||
    !Number.isSafeInteger(sourceInputs?.candidate?.bytes) ||
    sourceInputs.candidate.bytes <= 0 ||
    rawProof.restore?.pageCount !== manifest.beforePageCount ||
    rawProof.restore?.preconditionsVerified !== true ||
    restoredCanary?.version !== canary.version ||
    restoredCanary?.name !== canary.name ||
    restoredCanary?.statementCount !== canary.statementCount ||
    restoredCanary?.sha256 !== canary.sha256
  ) {
    throw new Error(
      "Backup restore proof does not contain the exact legacy canary baseline bound to this release.",
    );
  }

  const security = rawProof.restore?.security ?? rawProof.restore;
  if (
    rawProof.restore?.identityArchiveRestored !== true ||
    rawProof.restore?.configurationArchiveRestored !== true ||
    rawProof.restore?.imageArchiveRestored !== true ||
    !/^sha256:[0-9a-f]{64}$/u.test(rawProof.restore?.restoredImageId ?? "") ||
    !/^sha256:[0-9a-f]{64}$/u.test(rawProof.restore?.databaseImageId ?? "") ||
    rawProof.restore?.rolesPrepared !== true ||
    rawProof.restore?.ownersAndPrivilegesRestored !== true ||
    !hashPattern.test(rawProof.restore?.identityArchiveSha256 ?? "") ||
    !hashPattern.test(security?.sourceRoleContractSha256 ?? "") ||
    security.sourceRoleContractSha256 !== security.restoredIdentityContractSha256 ||
    security.sourceRoleContractSha256 !== security.restoredRoleContractSha256 ||
    !hashPattern.test(security?.sourceDatabaseAclSha256 ?? "") ||
    security.sourceDatabaseAclSha256 !== security.restoredDatabaseAclSha256
  ) {
    throw new Error(
      "Backup restore proof does not preserve the exact role, owner, and ACL contract.",
    );
  }

  const rehearsal = rawProof.rehearsal;
  if (
    rehearsal?.result !== "passed" ||
    rehearsal?.networkCount !== 0 ||
    rehearsal?.historyCount !== manifest.baselineVersions.length + 1 ||
    rehearsal?.candidateCount !== 1 ||
    rehearsal?.pageCount !== manifest.afterPageCount ||
    rehearsal?.postconditionsVerified !== true ||
    rehearsal?.candidate?.version !== manifest.candidate.version ||
    rehearsal?.candidate?.name !== manifest.candidate.name ||
    rehearsal?.candidate?.sha256 !== manifest.candidate.sha256
  ) {
    throw new Error("Backup retirement rehearsal proof is absent or invalid.");
  }
  return proof;
}

function sqlTextArray(values) {
  if (values.some((value) => !versionPattern.test(value))) {
    throw new Error("Unsafe migration version supplied to SQL builder.");
  }
  return `array[${values.map((value) => `'${value}'`).join(",")}]::text[]`;
}

function pageCatalogFingerprintSql(expectedCount, expectedHash, phase) {
  if (!Number.isSafeInteger(expectedCount) || !hashPattern.test(expectedHash)) {
    throw new Error("Unsafe page-catalog contract supplied to SQL builder.");
  }
  return `do $retirement_${phase}$
declare
  v_count bigint;
  v_sha256 text;
begin
  select count(*), encode(extensions.digest(convert_to(
    coalesce(jsonb_agg(to_jsonb(page) - 'created_at' - 'updated_at' order by page.key), '[]'::jsonb)::text,
    'UTF8'
  ), 'sha256'), 'hex')
    into v_count, v_sha256
  from public.app_pages page;

  if v_count <> ${expectedCount} or v_sha256 <> '${expectedHash}' then
    raise exception 'legacy canary retirement ${phase} page catalog mismatch'
      using errcode = '23514';
  end if;
end;
$retirement_${phase}$;`;
}

export function buildRetirementPreconditionsSql(manifest) {
  return `${pageCatalogFingerprintSql(
    manifest.beforePageCount,
    manifest.beforePageCatalogSha256,
    "precondition",
  )}
do $retirement_permission_precondition$
begin
  if not exists (
    select 1 from public.permissions permission
    where permission.key = 'crm.dialer.view'
      and permission.description = 'Acessar interfaces do Discador autorizadas para o perfil Master'
      and permission.min_level = 100
  ) or (
    select coalesce(array_agg(role_permission.role_key order by role_permission.role_key), array[]::text[])
    from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.dialer.view'
  ) is distinct from array['master']::text[] or exists (
    select 1 from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.dialer.view'
  ) then
    raise exception 'legacy canary retirement permission precondition mismatch'
      using errcode = '23514';
  end if;
end;
$retirement_permission_precondition$;`;
}

export function buildRetirementPostconditionsSql(manifest) {
  return `${pageCatalogFingerprintSql(
    manifest.afterPageCount,
    manifest.afterPageCatalogSha256,
    "postcondition",
  )}
do $retirement_permission_postcondition$
begin
  if exists (
    select 1 from public.permissions permission where permission.key = 'crm.dialer.view'
  ) or exists (
    select 1 from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.dialer.view'
  ) or exists (
    select 1 from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.dialer.view'
  ) then
    raise exception 'legacy canary retirement permission postcondition failed'
      using errcode = '23514';
  end if;
end;
$retirement_permission_postcondition$;
${postconditionsSql}`;
}

export function buildRetirementApplicationSql(manifest, candidate) {
  if (
    candidate.version !== manifest.candidate.version ||
    candidate.name !== manifest.candidate.name ||
    candidate.sha256 !== manifest.candidate.sha256
  ) {
    throw new Error("Loaded retirement candidate does not match the allowlist.");
  }
  const encoded = candidate.contents.toString("base64");
  const pinnedHistoryValues = manifest.pinnedHistory
    .map(
      ({ version, name, statementCount, sha256: hash }) =>
        `('${version}', '${name}', ${statementCount}, '${hash}')`,
    )
    .join(",\n    ");
  return `\\set ON_ERROR_STOP on
set statement_timeout = '15min';
do $retirement_lock$
begin
  if not pg_catalog.pg_try_advisory_lock(2026092612, 0) then
    raise exception 'another legacy canary retirement is running' using errcode = '55P03';
  end if;
end;
$retirement_lock$;
begin;
set local lock_timeout = '5s';
lock table
  supabase_migrations.schema_migrations,
  public.app_pages,
  public.permissions,
  public.role_permissions,
  public.user_permission_overrides
in share row exclusive mode;
do $history_guard$
declare
  v_actual text[];
begin
  select coalesce(array_agg(version order by version), array[]::text[])
    into v_actual
  from supabase_migrations.schema_migrations;
  if v_actual is distinct from ${sqlTextArray([...manifest.baselineVersions].sort())} then
    raise exception 'homologation migration history changed after retirement preflight'
      using errcode = '55000';
  end if;
end;
$history_guard$;
do $pinned_history_guard$
begin
  if exists (
    with expected(version, name, statement_count, sha256) as (
      values
        ${pinnedHistoryValues}
    ), actual as (
      select
        migration.version,
        migration.name,
        coalesce(cardinality(migration.statements), 0) as statement_count,
        encode(extensions.digest(
          convert_to(array_to_string(migration.statements, ''), 'UTF8'),
          'sha256'
        ), 'hex') as sha256
      from supabase_migrations.schema_migrations migration
      where migration.version in (select expected.version from expected)
    )
    select 1
    from expected
    left join actual using (version)
    where actual.version is null
      or actual.name is distinct from expected.name
      or actual.statement_count is distinct from expected.statement_count
      or actual.sha256 is distinct from expected.sha256
  ) then
    raise exception 'hash-pinned predecessor changed after retirement preflight'
      using errcode = '55000';
  end if;
end;
$pinned_history_guard$;
${candidate.contents.toString("utf8")}
insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '${candidate.version}',
  array[pg_catalog.convert_from(pg_catalog.decode('${encoded}', 'base64'), 'UTF8')],
  '${candidate.name}'
);
${buildRetirementPostconditionsSql(manifest)}
commit;
select pg_catalog.pg_advisory_unlock(2026092612, 0);
`;
}
