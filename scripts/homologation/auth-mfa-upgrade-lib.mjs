import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const versionPattern = /^\d{14}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
const filePattern = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const backupIdPattern = /^\d{8}T\d{6}Z-[0-9a-f]{12}$/u;
const backupFilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const backupArtifactLimits = Object.freeze({
  database: Object.freeze({ minimum: 4 * 1024, maximum: 8 * 1024 * 1024 * 1024 }),
  "migration-history": Object.freeze({ minimum: 256, maximum: 64 * 1024 * 1024 }),
  configuration: Object.freeze({ minimum: 256, maximum: 1024 * 1024 * 1024 }),
  image: Object.freeze({ minimum: 1024 * 1024, maximum: 16 * 1024 * 1024 * 1024 }),
});

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function validateBackupProof(
  rawProof,
  { expectedSha, expectedBackupId, expectedHistoryCount, now = Date.now() },
) {
  if (
    !rawProof ||
    rawProof.schemaVersion !== 1 ||
    rawProof.environment !== "isolated-homologation" ||
    rawProof.sourceSha !== expectedSha ||
    rawProof.backupId !== expectedBackupId ||
    !backupIdPattern.test(rawProof.backupId ?? "") ||
    !Array.isArray(rawProof.artifacts) ||
    !rawProof.restore
  ) {
    throw new Error("Backup restore proof does not match this homologation release.");
  }

  const createdAt = Date.parse(rawProof.createdAt ?? "");
  const testedAt = Date.parse(rawProof.restore.testedAt ?? "");
  const maximumFutureSkew = 5 * 60 * 1000;
  const maximumBackupAge = 24 * 60 * 60 * 1000;
  const maximumRestoreAge = 6 * 60 * 60 * 1000;
  const createdIdPrefix = Number.isFinite(createdAt)
    ? new Date(createdAt)
        .toISOString()
        .replace(/[-:]/gu, "")
        .replace(/\.\d{3}Z$/u, "Z")
    : null;
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(testedAt) ||
    createdAt > now + maximumFutureSkew ||
    testedAt > now + maximumFutureSkew ||
    testedAt < createdAt ||
    now - createdAt > maximumBackupAge ||
    now - testedAt > maximumRestoreAge ||
    createdIdPrefix === null ||
    !rawProof.backupId.startsWith(`${createdIdPrefix}-`)
  ) {
    throw new Error("Backup and isolated-restore proof must be fresh and chronologically valid.");
  }

  if (rawProof.artifacts.length !== 4) {
    throw new Error("Backup proof must declare exactly four typed artifacts.");
  }
  const artifacts = rawProof.artifacts.map((artifact) => {
    const limits = backupArtifactLimits[artifact?.kind];
    if (
      !limits ||
      !backupFilePattern.test(artifact?.file ?? "") ||
      artifact.file === "SHA256SUMS" ||
      artifact.file === "restore-proof.json" ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < limits.minimum ||
      artifact.bytes > limits.maximum ||
      !hashPattern.test(artifact.sha256 ?? "")
    ) {
      throw new Error("Backup proof contains an invalid artifact contract.");
    }
    return { ...artifact };
  });
  if (
    new Set(artifacts.map(({ file }) => file)).size !== artifacts.length ||
    new Set(artifacts.map(({ kind }) => kind)).size !== Object.keys(backupArtifactLimits).length
  ) {
    throw new Error("Backup proof must contain one distinct artifact of each required type.");
  }

  const databaseArtifact = artifacts.find(({ kind }) => kind === "database");
  if (
    rawProof.restore.result !== "passed" ||
    rawProof.restore.isolated !== true ||
    rawProof.restore.networkCount !== 0 ||
    rawProof.restore.historyCount !== expectedHistoryCount ||
    rawProof.restore.candidateCount !== 0 ||
    rawProof.restore.databaseArtifact !== databaseArtifact?.file ||
    rawProof.restore.databaseSha256 !== databaseArtifact?.sha256
  ) {
    throw new Error("Backup has no valid isolated restore proof for the approved baseline.");
  }

  return Object.freeze({
    backupId: rawProof.backupId,
    artifacts: Object.freeze(artifacts.map(Object.freeze)),
  });
}

export function validateAllowlist(rawManifest) {
  if (
    !rawManifest ||
    rawManifest.schemaVersion !== 1 ||
    rawManifest.environment !== "isolated-homologation" ||
    !Array.isArray(rawManifest.baselineVersions) ||
    !Array.isArray(rawManifest.nonDeployableRepositoryVersions) ||
    !Array.isArray(rawManifest.candidates)
  ) {
    throw new Error("Homologation migration allowlist is invalid.");
  }

  const baselineVersions = [...rawManifest.baselineVersions];
  if (
    baselineVersions.length === 0 ||
    baselineVersions.some((version) => !versionPattern.test(version)) ||
    new Set(baselineVersions).size !== baselineVersions.length ||
    baselineVersions.some((version, index) => index > 0 && baselineVersions[index - 1] >= version)
  ) {
    throw new Error("Homologation baseline versions must be unique and strictly ordered.");
  }

  const nonDeployableRepositoryVersions = [...rawManifest.nonDeployableRepositoryVersions];
  if (
    nonDeployableRepositoryVersions.some((version) => !versionPattern.test(version)) ||
    new Set(nonDeployableRepositoryVersions).size !== nonDeployableRepositoryVersions.length ||
    nonDeployableRepositoryVersions.some(
      (version, index) => index > 0 && nonDeployableRepositoryVersions[index - 1] >= version,
    ) ||
    nonDeployableRepositoryVersions.some((version) => baselineVersions.includes(version))
  ) {
    throw new Error("Non-deployable repository versions must be unique and strictly ordered.");
  }

  if (rawManifest.candidates.length !== 2) {
    throw new Error("The Auth/MFA upgrade must allow exactly two candidate migrations.");
  }

  const candidates = rawManifest.candidates.map((candidate) => {
    const match = filePattern.exec(candidate?.file ?? "");
    if (
      !match ||
      candidate.version !== match[1] ||
      candidate.name !== match[2] ||
      !hashPattern.test(candidate.sha256 ?? "")
    ) {
      throw new Error("A candidate migration allowlist entry is invalid.");
    }
    return { ...candidate };
  });

  const candidateVersions = candidates.map(({ version }) => version);
  if (
    new Set(candidateVersions).size !== candidates.length ||
    candidateVersions.some(
      (version, index) => index > 0 && candidateVersions[index - 1] >= version,
    ) ||
    candidateVersions.some(
      (version) =>
        baselineVersions.includes(version) || nonDeployableRepositoryVersions.includes(version),
    )
  ) {
    throw new Error("Candidate migration versions must be unique, ordered, and pending.");
  }

  return Object.freeze({
    schemaVersion: 1,
    environment: rawManifest.environment,
    baselineVersions: Object.freeze(baselineVersions),
    nonDeployableRepositoryVersions: Object.freeze(nonDeployableRepositoryVersions),
    candidates: Object.freeze(candidates.map(Object.freeze)),
  });
}

export async function loadCandidateFiles(repositoryRoot, manifest) {
  const migrationRoot = path.join(repositoryRoot, "supabase/migrations");
  const repositoryVersions = (await readdir(migrationRoot))
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => {
      const match = filePattern.exec(fileName);
      if (!match) throw new Error(`Repository migration filename is invalid: ${fileName}.`);
      return match[1];
    })
    .sort();
  const expectedRepositoryVersions = [
    ...manifest.baselineVersions,
    ...manifest.nonDeployableRepositoryVersions,
    ...manifest.candidates.map(({ version }) => version),
  ].sort();
  if (
    new Set(repositoryVersions).size !== repositoryVersions.length ||
    JSON.stringify(repositoryVersions) !== JSON.stringify(expectedRepositoryVersions)
  ) {
    throw new Error("Repository migration inventory differs from the homologation allowlist.");
  }

  const loaded = [];
  for (const candidate of manifest.candidates) {
    const candidatePath = path.resolve(migrationRoot, candidate.file);
    if (path.dirname(candidatePath) !== migrationRoot) {
      throw new Error("Candidate migration path escaped the migration directory.");
    }
    const contents = await readFile(candidatePath);
    if (sha256(contents) !== candidate.sha256) {
      contents.fill(0);
      throw new Error(`Candidate migration hash mismatch: ${candidate.version}.`);
    }
    const text = contents.toString("utf8");
    if (/^\s*\\/mu.test(text) || /^\s*(?:begin|commit|rollback)\s*;/imu.test(text)) {
      contents.fill(0);
      throw new Error(
        `Candidate migration contains forbidden transaction control: ${candidate.version}.`,
      );
    }
    loaded.push({ ...candidate, contents });
  }
  return loaded;
}

export function expectedHistoryForMode(manifest, mode) {
  if (mode === "dry-run" || mode === "apply") return [...manifest.baselineVersions];
  if (mode === "verify") {
    return [
      ...manifest.baselineVersions,
      ...manifest.candidates.map(({ version }) => version),
    ].sort();
  }
  throw new Error("Unknown homologation migration mode.");
}

export function validateHistoryState(manifest, mode, historyRows) {
  if (!Array.isArray(historyRows)) throw new Error("Migration history result is invalid.");
  const actualVersions = historyRows.map((row) => String(row?.version ?? ""));
  if (
    actualVersions.some((version) => !versionPattern.test(version)) ||
    new Set(actualVersions).size !== actualVersions.length
  ) {
    throw new Error("Migration history contains an invalid or duplicate version.");
  }
  actualVersions.sort();
  const expectedVersions = expectedHistoryForMode(manifest, mode);
  if (JSON.stringify(actualVersions) !== JSON.stringify(expectedVersions)) {
    throw new Error("Homologation migration history differs from the exact approved baseline.");
  }

  if (mode === "verify") {
    const byVersion = new Map(historyRows.map((row) => [row.version, row]));
    for (const candidate of manifest.candidates) {
      const applied = byVersion.get(candidate.version);
      if (
        applied?.name !== candidate.name ||
        applied?.statement_count !== 1 ||
        applied?.sha256 !== candidate.sha256
      ) {
        throw new Error(`Applied candidate history hash mismatch: ${candidate.version}.`);
      }
    }
  }

  return {
    historyCount: actualVersions.length,
    pendingVersions: mode === "verify" ? [] : manifest.candidates.map(({ version }) => version),
  };
}

function sqlTextArray(values) {
  if (values.some((value) => !versionPattern.test(value))) {
    throw new Error("Unsafe migration version supplied to SQL builder.");
  }
  return `array[${values.map((value) => `'${value}'`).join(",")}]::text[]`;
}

function historyGuardSql(expectedVersions) {
  return `do $history_guard$
declare
  v_actual text[];
begin
  select coalesce(array_agg(version order by version), array[]::text[])
    into v_actual
  from supabase_migrations.schema_migrations;

  if v_actual is distinct from ${sqlTextArray([...expectedVersions].sort())} then
    raise exception 'homologation migration history changed after preflight'
      using errcode = '55000';
  end if;
end;
$history_guard$;`;
}

export const postconditionsSql = `do $auth_mfa_postconditions$
declare
  v_public_rls_tables bigint;
  v_public_mfa_policies bigint;
begin
  if (
    select array_agg(concat_ws('|', page.key, page.path, page.permission_key, page.is_navigation::text) order by page.key)
    from public.app_pages page
    where page.is_active
  ) is distinct from array[
    'admin.home|/admin|admin.access|true',
    'admin.pages|/admin/paginas|pages.manage|true',
    'admin.users|/admin/usuarios|users.view|true',
    'crm.dashboard|/app|crm.dashboard.view|true',
    'crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view|true',
    'crm.ranking|/app/ranking|crm.ranking.view|true',
    'crm.settings|/app/configuracoes|crm.settings.view|true',
    'crm.settings.goals|/app/configuracoes/metas|crm.settings.manage|true',
    'crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage|true',
    'crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage|true',
    'crm.simulation|/app/simulacao|crm.simulators.view|true',
    'crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view|true',
    'crm.stage.appointments|/app/etapas/agendamentos|crm.stages.view|true',
    'crm.stage.folders|/app/etapas/pastas|crm.stages.view|true',
    'crm.stage.opportunities|/app/etapas/oportunidades|crm.stages.view|true',
    'crm.stage.sales|/app/etapas/vendas|crm.stages.view|true',
    'crm.stage.visits|/app/etapas/visitas|crm.stages.view|true'
  ]::text[] or (select count(*) from public.app_pages) <> 17 then
    raise exception 'approved seventeen-page catalog postcondition failed'
      using errcode = '23514';
  end if;

  if exists (
    with expected(role_key, expected_pages) as (
      values
        ('master', array[
          'admin.home','admin.pages','admin.users','crm.dashboard','crm.partnerships',
          'crm.ranking','crm.settings','crm.settings.goals','crm.settings.partnerships',
          'crm.settings.points','crm.simulation','crm.simulation.wf13',
          'crm.stage.appointments','crm.stage.folders','crm.stage.opportunities',
          'crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('admin', array[
          'admin.home','admin.pages','admin.users','crm.dashboard','crm.ranking',
          'crm.settings','crm.settings.goals','crm.settings.partnerships',
          'crm.settings.points','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('broker', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('broker_lead', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('coordinator', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('real_estate', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('supervisor', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('user', array[
          'crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders',
          'crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
        ]::text[]),
        ('manager', array[]::text[]),
        ('house', array[]::text[]),
        ('partnership_channel', array[]::text[]),
        ('pending', array[]::text[])
    ), actual as (
      select expected.role_key,
        coalesce(array_agg(page.key order by page.key) filter (where page.key is not null), array[]::text[]) as actual_pages
      from expected
      left join public.app_pages page
        on page.is_active
       and exists (
         select 1 from public.role_permissions role_permission
         where role_permission.role_key = expected.role_key
           and role_permission.permission_key = 'pages.view'
       )
       and exists (
         select 1 from public.role_permissions role_permission
         where role_permission.role_key = expected.role_key
           and role_permission.permission_key = page.permission_key
       )
      group by expected.role_key
    )
    select 1
    from expected
    join actual using (role_key)
    where actual.actual_pages is distinct from expected.expected_pages
  ) then
    raise exception 'role page-set postcondition failed'
      using errcode = '23514';
  end if;

  if not (
    select count(*) = 2 and bool_and(relation.relrowsecurity and relation.relforcerowsecurity)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname in ('legal_acceptance_requirements', 'legal_acceptances')
  ) or exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'private'
      and grant_row.table_name in ('legal_acceptance_requirements', 'legal_acceptances')
      and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'private legal-ledger RLS or grant postcondition failed'
      using errcode = '42501';
  end if;

  select count(*) into v_public_rls_tables
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  select count(*) into v_public_mfa_policies
  from pg_catalog.pg_policies policy
  where policy.schemaname = 'public'
    and policy.policyname = 'authenticated_session_mfa_gate'
    and policy.permissive = 'RESTRICTIVE'
    and policy.roles = array['authenticated']::name[]
    and policy.cmd = 'ALL'
    and coalesce(policy.qual, '') like '%current_session_satisfies_mfa%'
    and coalesce(policy.with_check, '') like '%current_session_satisfies_mfa%';

  if v_public_rls_tables = 0 or v_public_mfa_policies <> v_public_rls_tables then
    raise exception 'public session/MFA RLS coverage postcondition failed'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
      and (
        pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'DELETE')
      )
  ) then
    raise exception 'authenticated table grant without RLS postcondition failed'
      using errcode = '42501';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) <> 3 or exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) or (
    select count(*)
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
  ) <> 3 or exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and (
        policy.policyname <> 'authenticated_session_mfa_gate'
        or policy.permissive <> 'RESTRICTIVE'
        or policy.roles <> array['authenticated']::name[]
        or policy.cmd <> 'ALL'
        or coalesce(policy.qual, '') not like '%current_session_satisfies_mfa%'
        or coalesce(policy.with_check, '') not like '%current_session_satisfies_mfa%'
      )
  ) then
    raise exception 'Qlik direct-read fail-closed postcondition failed'
      using errcode = '42501';
  end if;

  if to_regprocedure('private.current_session_is_live()') is null
     or to_regprocedure('private.current_session_satisfies_mfa()') is null
     or to_regprocedure('public.current_session_is_live()') is null
     or to_regprocedure('public.revoke_current_user_sessions_after_password_recovery()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger trigger_row
       where not trigger_row.tgisinternal
         and trigger_row.tgrelid = 'auth.users'::regclass
         and trigger_row.tgname = 'on_auth_user_legal_acceptance'
     ) then
    raise exception 'Auth/MFA function or trigger postcondition failed'
      using errcode = '42P01';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.current_session_is_live()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.current_session_is_live()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.current_session_is_live()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE') then
    raise exception 'Auth/MFA execute-grant postcondition failed'
      using errcode = '42501';
  end if;
end;
$auth_mfa_postconditions$;`;

export function buildApplicationSql(manifest, loadedCandidates) {
  if (
    loadedCandidates.length !== manifest.candidates.length ||
    loadedCandidates.some(
      (candidate, index) =>
        candidate.version !== manifest.candidates[index].version ||
        candidate.sha256 !== manifest.candidates[index].sha256,
    )
  ) {
    throw new Error("Loaded candidates do not match the migration allowlist.");
  }

  const sections = [
    "\\set ON_ERROR_STOP on",
    "set statement_timeout = '15min';",
    `do $upgrade_lock$
begin
  if not pg_catalog.pg_try_advisory_lock(2026082423, 49) then
    raise exception 'another Auth/MFA homologation migration is running'
      using errcode = '55P03';
  end if;
end;
$upgrade_lock$;`,
  ];
  let expectedVersions = [...manifest.baselineVersions];

  for (const candidate of loadedCandidates) {
    const encoded = candidate.contents.toString("base64");
    sections.push(
      "begin;",
      historyGuardSql(expectedVersions),
      candidate.contents.toString("utf8"),
      `insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '${candidate.version}',
  array[pg_catalog.convert_from(pg_catalog.decode('${encoded}', 'base64'), 'UTF8')],
  '${candidate.name}'
);`,
    );
    expectedVersions = [...expectedVersions, candidate.version].sort();
    if (candidate === loadedCandidates.at(-1)) sections.push(postconditionsSql);
    sections.push("commit;");
  }

  sections.push("select pg_catalog.pg_advisory_unlock(2026082423, 49);");
  return `${sections.join("\n\n")}\n`;
}
