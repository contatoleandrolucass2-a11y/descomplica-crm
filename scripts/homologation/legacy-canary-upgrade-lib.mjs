import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const versionPattern = /^\d{14}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
const filePattern = /^(\d{14})_([a-z0-9_]+)\.sql$/u;

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

export function validateLegacyCanaryAllowlist(raw) {
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.environment !== "isolated-homologation" ||
    !Array.isArray(raw.foundationCandidates) ||
    !raw.candidate
  ) {
    throw new Error("Legacy canary migration allowlist is invalid.");
  }
  const baselineVersions = assertOrderedVersions(raw.baselineVersions, "Baseline");
  const nonDeployableRepositoryVersions = assertOrderedVersions(
    raw.nonDeployableRepositoryVersions,
    "Non-deployable inventory",
  );
  const match = filePattern.exec(raw.candidate.file ?? "");
  const foundationCandidates = raw.foundationCandidates.map((candidate) => {
    if (
      !versionPattern.test(candidate?.version ?? "") ||
      typeof candidate?.name !== "string" ||
      !/^[a-z0-9_]+$/u.test(candidate.name) ||
      !hashPattern.test(candidate?.sha256 ?? "") ||
      !baselineVersions.includes(candidate.version)
    ) {
      throw new Error("Auth/MFA foundation candidate is invalid.");
    }
    return { ...candidate };
  });
  if (
    !match ||
    raw.candidate.version !== match[1] ||
    raw.candidate.name !== match[2] ||
    !hashPattern.test(raw.candidate.sha256 ?? "") ||
    baselineVersions.includes(raw.candidate.version) ||
    nonDeployableRepositoryVersions.includes(raw.candidate.version) ||
    baselineVersions.some((version) => nonDeployableRepositoryVersions.includes(version)) ||
    foundationCandidates.length !== 2 ||
    new Set(foundationCandidates.map(({ version }) => version)).size !== 2
  ) {
    throw new Error("Legacy canary candidate is invalid or overlaps migration history.");
  }
  return Object.freeze({
    schemaVersion: 1,
    environment: raw.environment,
    baselineVersions: Object.freeze(baselineVersions),
    nonDeployableRepositoryVersions: Object.freeze(nonDeployableRepositoryVersions),
    foundationCandidates: Object.freeze(foundationCandidates.map(Object.freeze)),
    candidate: Object.freeze({ ...raw.candidate }),
  });
}

export async function loadLegacyCanaryCandidate(repositoryRoot, manifest) {
  const migrationRoot = path.join(repositoryRoot, "supabase/migrations");
  const repositoryVersions = (await readdir(migrationRoot))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const match = filePattern.exec(file);
      if (!match) throw new Error(`Repository migration filename is invalid: ${file}.`);
      return match[1];
    })
    .sort();
  const expectedVersions = [
    ...manifest.baselineVersions,
    ...manifest.nonDeployableRepositoryVersions,
    manifest.candidate.version,
  ].sort();
  if (
    new Set(repositoryVersions).size !== repositoryVersions.length ||
    JSON.stringify(repositoryVersions) !== JSON.stringify(expectedVersions)
  ) {
    throw new Error("Repository migration inventory differs from the legacy canary allowlist.");
  }
  const candidatePath = path.resolve(migrationRoot, manifest.candidate.file);
  if (path.dirname(candidatePath) !== migrationRoot) {
    throw new Error("Legacy canary migration path escaped the migration directory.");
  }
  const contents = await readFile(candidatePath);
  const hash = createHash("sha256").update(contents).digest("hex");
  const text = contents.toString("utf8");
  if (hash !== manifest.candidate.sha256) {
    contents.fill(0);
    throw new Error("Legacy canary migration hash differs from the allowlist.");
  }
  if (/^\s*\\/mu.test(text) || /^\s*(?:begin|commit|rollback)\s*;/imu.test(text)) {
    contents.fill(0);
    throw new Error("Legacy canary migration contains forbidden transaction control.");
  }
  return { ...manifest.candidate, contents };
}

export function validateLegacyCanaryHistory(manifest, mode, rows) {
  if (!new Set(["dry-run", "apply", "verify"]).has(mode) || !Array.isArray(rows)) {
    throw new Error("Legacy canary migration history input is invalid.");
  }
  const actual = rows.map((row) => String(row?.version ?? "")).sort();
  const expected =
    mode === "verify"
      ? [...manifest.baselineVersions, manifest.candidate.version].sort()
      : [...manifest.baselineVersions];
  if (
    actual.some((version) => !versionPattern.test(version)) ||
    new Set(actual).size !== actual.length ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    throw new Error("Homologation migration history differs from the exact legacy canary gate.");
  }
  if (mode === "verify") {
    const applied = rows.find((row) => row.version === manifest.candidate.version);
    if (
      applied?.name !== manifest.candidate.name ||
      applied?.statement_count !== 1 ||
      applied?.sha256 !== manifest.candidate.sha256
    ) {
      throw new Error("Applied legacy canary migration history hash is invalid.");
    }
  }
  const byVersion = new Map(rows.map((row) => [row.version, row]));
  for (const foundation of manifest.foundationCandidates) {
    const applied = byVersion.get(foundation.version);
    if (
      applied?.name !== foundation.name ||
      applied?.statement_count !== 1 ||
      applied?.sha256 !== foundation.sha256
    ) {
      throw new Error("Applied Auth/MFA foundation migration history hash is invalid.");
    }
  }
  return {
    historyCount: actual.length,
    pendingVersions: mode === "verify" ? [] : [manifest.candidate.version],
  };
}

function sqlTextArray(values) {
  if (values.some((value) => !versionPattern.test(value))) {
    throw new Error("Unsafe migration version supplied to the legacy canary SQL builder.");
  }
  return `array[${values.map((value) => `'${value}'`).join(",")}]::text[]`;
}

export const legacyCanaryPostconditionsSql = `do $legacy_canary_postconditions$
declare
  v_contract record;
  v_actual_pages text[];
begin
  if (select count(*) from public.app_pages) <> 24
     or not exists (
       select 1 from public.permissions permission
       where permission.key = 'crm.dialer.view'
         and permission.min_level = 100
     )
     or (
       select coalesce(array_agg(role_key order by role_key), array[]::text[])
       from public.role_permissions
       where permission_key = 'crm.dialer.view'
     ) is distinct from array['master']::text[]
     or exists (
       select 1 from public.user_permission_overrides
       where permission_key in ('crm.dialer.view', 'crm.simulators.view')
     ) then
    raise exception 'legacy canary permission postcondition failed' using errcode = '42501';
  end if;

  if to_regclass('private.legal_acceptances') is null
     or to_regclass('private.legal_acceptance_requirements') is null
     or to_regprocedure('private.current_session_is_live()') is null
     or to_regprocedure('private.current_session_satisfies_mfa()') is null
     or to_regprocedure('public.current_session_is_live()') is null
     or to_regprocedure('public.revoke_current_user_sessions_after_password_recovery()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger trigger_row
       where not trigger_row.tgisinternal
         and trigger_row.tgrelid = 'auth.users'::regclass
         and trigger_row.tgname = 'on_auth_user_legal_acceptance'
     ) then
    raise exception 'Auth/MFA foundation object postcondition failed' using errcode = '42P01';
  end if;

  if (
       select count(*)
       from pg_catalog.pg_class relation
       join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'private'
         and relation.relname in ('legal_acceptances', 'legal_acceptance_requirements')
         and relation.relkind in ('r', 'p')
         and relation.relrowsecurity
         and relation.relforcerowsecurity
     ) <> 2
     or pg_catalog.has_function_privilege('anon', 'public.current_session_is_live()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.current_session_is_live()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.current_session_is_live()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.revoke_current_user_sessions_after_password_recovery()', 'EXECUTE') then
    raise exception 'Auth/MFA RLS or execute-grant postcondition failed' using errcode = '42501';
  end if;

  if exists (
    with expected(page_key, page_path, permission_key) as (values
      ('crm.simulation.wf16', '/app/simulacao/calcular-documentacao', 'crm.simulators.view'),
      ('crm.simulation.caixa', '/app/simulacao/caixa', 'crm.simulators.view'),
      ('crm.simulation.wf14', '/app/simulacao/tabela-direta', 'crm.simulators.view'),
      ('crm.simulation.wf15', '/app/simulacao/tabela-investidor', 'crm.simulators.view'),
      ('crm.simulation.tabelao', '/app/simulacao/tabela', 'crm.simulators.view'),
      ('crm.dialer', '/app/discador', 'crm.dialer.view'),
      ('crm.dialer.weekend_forecast', '/app/discador/previsao-final-de-semana', 'crm.dialer.view')
    ), actual as (
      select key, path, permission_key from public.app_pages
      where key in (select page_key from expected) and is_active and is_navigation
    ), difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    ) select 1 from difference
  ) then
    raise exception 'legacy canary page postcondition failed' using errcode = '23514';
  end if;

  for v_contract in select * from (values
    ('master', array['admin.home','admin.pages','admin.users','crm.dashboard','crm.dialer','crm.dialer.weekend_forecast','crm.partnerships','crm.ranking','crm.settings','crm.settings.goals','crm.settings.partnerships','crm.settings.points','crm.simulation','crm.simulation.caixa','crm.simulation.tabelao','crm.simulation.wf13','crm.simulation.wf14','crm.simulation.wf15','crm.simulation.wf16','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('admin', array['admin.home','admin.pages','admin.users','crm.dashboard','crm.ranking','crm.settings','crm.settings.goals','crm.settings.partnerships','crm.settings.points','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('coordinator', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('supervisor', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('real_estate', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('broker_lead', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('broker', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('user', array['crm.dashboard','crm.ranking','crm.stage.appointments','crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits']::text[]),
    ('manager', array[]::text[]), ('house', array[]::text[]),
    ('partnership_channel', array[]::text[]), ('pending', array[]::text[])
  ) contract(role_key, expected_pages) loop
    select coalesce(array_agg(page.key order by page.key), array[]::text[])
      into v_actual_pages
    from public.app_pages page
    where page.is_active
      and exists (select 1 from public.role_permissions grant_row where grant_row.role_key = v_contract.role_key and grant_row.permission_key = 'pages.view')
      and exists (select 1 from public.role_permissions grant_row where grant_row.role_key = v_contract.role_key and grant_row.permission_key = page.permission_key);
    if v_actual_pages is distinct from v_contract.expected_pages then
      raise exception 'legacy canary role matrix postcondition failed for %', v_contract.role_key using errcode = '23514';
    end if;
  end loop;
end;
$legacy_canary_postconditions$;`;

export function buildLegacyCanaryApplicationSql(manifest, candidate) {
  if (
    candidate.version !== manifest.candidate.version ||
    candidate.sha256 !== manifest.candidate.sha256
  ) {
    throw new Error("Loaded legacy canary candidate does not match the allowlist.");
  }
  const encoded = candidate.contents.toString("base64");
  return `\\set ON_ERROR_STOP on
set statement_timeout = '15min';
do $upgrade_lock$
begin
  if not pg_catalog.pg_try_advisory_lock(2026082813, 5947) then
    raise exception 'another legacy canary migration is running' using errcode = '55P03';
  end if;
end;
$upgrade_lock$;
begin;
do $history_guard$
declare v_actual text[];
begin
  select coalesce(array_agg(version order by version), array[]::text[]) into v_actual
  from supabase_migrations.schema_migrations;
  if v_actual is distinct from ${sqlTextArray([...manifest.baselineVersions].sort())} then
    raise exception 'homologation migration history changed after preflight' using errcode = '55000';
  end if;
end;
$history_guard$;
${candidate.contents.toString("utf8")}
insert into supabase_migrations.schema_migrations (version, statements, name)
values ('${candidate.version}', array[pg_catalog.convert_from(pg_catalog.decode('${encoded}', 'base64'), 'UTF8')], '${candidate.name}');
${legacyCanaryPostconditionsSql}
commit;
select pg_catalog.pg_advisory_unlock(2026082813, 5947);\n`;
}
