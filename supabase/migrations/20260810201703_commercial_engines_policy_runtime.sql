-- Local-only foundation for versioned commercial policy engines.
--
-- This migration deliberately contains no formula, target, score, campaign,
-- prize, golden value, policy version or activation row. Runtime execution is
-- denied until an approved policy is imported, its database gate is moved
-- through the controlled states below, and the application feature flag is
-- enabled separately.

set lock_timeout = '5s';
set statement_timeout = '60s';

-- The application executes policies through a direct server-only PostgreSQL
-- capability. Browser JWT roles cannot read policy documents or forge the
-- hashes-only execution ledger by bypassing the Route Handler.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'crm_commercial_engine'
  ) then
    create role crm_commercial_engine
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls
      connection limit 2;
  elsif exists (
    select 1
    from pg_catalog.pg_roles role
    where role.rolname = 'crm_commercial_engine'
      and (
        role.rolsuper or role.rolcreatedb or role.rolcreaterole
        or role.rolinherit or role.rolcanlogin or role.rolreplication
        or role.rolbypassrls or role.rolconnlimit <> 2
      )
  ) then
    raise exception 'unsafe existing crm_commercial_engine role attributes'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_commercial_engine'
    )
  ) or exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_commercial_engine'
    )
      and (
        membership.member <> (
          select role.oid from pg_catalog.pg_roles role
          where role.rolname = 'postgres'
        )
        or membership.inherit_option
        or membership.set_option
      )
  ) then
    raise exception 'unsafe existing crm_commercial_engine role membership'
      using errcode = '42501';
  end if;
end;
$$;

alter role crm_commercial_engine set statement_timeout = '15s';
alter role crm_commercial_engine set lock_timeout = '5s';
alter role crm_commercial_engine set idle_in_transaction_session_timeout = '10s';
alter role crm_commercial_engine set search_path = pg_catalog;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'commercial_engine'
      and pg_catalog.pg_get_userbyid(namespace.nspowner) <> 'postgres'
  ) then
    raise exception 'unsafe existing commercial_engine schema owner'
      using errcode = '42501';
  end if;
end;
$$;

create schema if not exists commercial_engine authorization postgres;
revoke all on schema commercial_engine
  from public, anon, authenticated, service_role, crm_qlik_relay,
    crm_commercial_engine;
grant usage on schema commercial_engine to crm_commercial_engine;

revoke all privileges on all tables in schema public from crm_commercial_engine;
revoke all privileges on all sequences in schema public from crm_commercial_engine;
revoke all privileges on all functions in schema public from crm_commercial_engine;
revoke all privileges on all tables in schema private from crm_commercial_engine;
revoke all privileges on all sequences in schema private from crm_commercial_engine;
revoke all privileges on all functions in schema private from crm_commercial_engine;

-- --------------------------------------------------------------------------
-- Authorization catalog
-- --------------------------------------------------------------------------

insert into public.permissions (key, description, min_level) values
  (
    'crm.simulators.execute',
    'Execute an approved commercial simulator policy',
    10
  ),
  (
    'crm.commercial_engine.execute',
    'Execute an approved non-interactive commercial engine policy',
    100
  ),
  (
    'crm.commercial_policy.manage',
    'Import and gate versioned commercial policies',
    100
  );

-- Simulator execution intentionally has no role grant. It remains unavailable
-- until an explicit, reviewed authorization increment grants it.
insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.commercial_policy.manage');

-- --------------------------------------------------------------------------
-- Private catalogs and append-only ledgers
-- --------------------------------------------------------------------------

create table private.crm_commercial_engine_catalog (
  engine_key text primary key,
  domain text not null,
  required_permission_key text not null
    references public.permissions(key) on delete restrict,
  interactive boolean not null,
  created_at timestamptz not null default now(),
  constraint crm_commercial_engine_catalog_key_check check (
    length(engine_key) between 1 and 100
    and engine_key ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
  ),
  constraint crm_commercial_engine_catalog_domain_check check (
    domain in (
      'simulator', 'goals', 'points', 'ranking', 'sla',
      'roulette', 'campaign', 'awards'
    )
  )
);

insert into private.crm_commercial_engine_catalog (
  engine_key,
  domain,
  required_permission_key,
  interactive
) values
  ('simulator.wf13', 'simulator', 'crm.simulators.execute', true),
  ('simulator.wf14', 'simulator', 'crm.simulators.execute', true),
  ('simulator.wf15', 'simulator', 'crm.simulators.execute', true),
  ('simulator.wf16', 'simulator', 'crm.simulators.execute', true),
  ('simulator.caixa', 'simulator', 'crm.simulators.execute', true),
  ('goals.dv', 'goals', 'crm.commercial_engine.execute', false),
  ('goals.partnerships', 'goals', 'crm.commercial_engine.execute', false),
  ('points.ranking', 'points', 'crm.commercial_engine.execute', false),
  ('ranking.broker', 'ranking', 'crm.commercial_engine.execute', false),
  ('ranking.manager', 'ranking', 'crm.commercial_engine.execute', false),
  ('sla.loss', 'sla', 'crm.commercial_engine.execute', false),
  ('roulette.eligibility', 'roulette', 'crm.commercial_engine.execute', false),
  ('campaign.eligibility', 'campaign', 'crm.commercial_engine.execute', false),
  ('awards.calculation', 'awards', 'crm.commercial_engine.execute', false);

create index crm_commercial_engine_catalog_permission_idx
  on private.crm_commercial_engine_catalog (required_permission_key);

create table private.crm_commercial_policy_versions (
  id uuid primary key default gen_random_uuid(),
  engine_key text not null
    references private.crm_commercial_engine_catalog(engine_key)
    on delete restrict,
  version integer not null,
  contract_version smallint not null default 1,
  policy_document jsonb not null,
  db_document_hash text not null,
  runtime_policy_hash text not null,
  golden_report_hash text not null,
  golden_case_count smallint not null,
  owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  backup_owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  effective_from timestamptz not null,
  effective_until timestamptz,
  timezone text not null,
  evidence_reference text not null,
  change_reason text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint crm_commercial_policy_versions_engine_version_key
    unique (engine_key, version),
  constraint crm_commercial_policy_versions_id_engine_key
    unique (id, engine_key),
  constraint crm_commercial_policy_versions_contract_check
    check (contract_version = 1),
  constraint crm_commercial_policy_versions_version_check
    check (version between 1 and 1000000),
  constraint crm_commercial_policy_versions_document_check check (
    jsonb_typeof(policy_document) = 'object'
    and octet_length(convert_to(policy_document::text, 'UTF8')) <= 2000000
    and policy_document ->> 'engineKey' = engine_key
    and policy_document ->> 'version' = version::text
  ),
  constraint crm_commercial_policy_versions_hashes_check check (
    db_document_hash ~ '^[0-9a-f]{64}$'
    and runtime_policy_hash ~ '^[0-9a-f]{64}$'
    and golden_report_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_commercial_policy_versions_goldens_check check (
    golden_case_count between 1 and 100
    and golden_case_count = case
      when jsonb_typeof(policy_document -> 'goldenCases') = 'array'
        then jsonb_array_length(policy_document -> 'goldenCases')
      else -1
    end
  ),
  constraint crm_commercial_policy_versions_owners_check
    check (owner_id <> backup_owner_id),
  constraint crm_commercial_policy_versions_window_check check (
    pg_catalog.isfinite(effective_from)
    and (effective_until is null or (
      pg_catalog.isfinite(effective_until)
      and effective_until > effective_from
    ))
    and pg_catalog.isfinite(approved_at)
  ),
  constraint crm_commercial_policy_versions_timezone_check
    check (timezone = 'America/Sao_Paulo'),
  constraint crm_commercial_policy_versions_evidence_check check (
    nullif(btrim(evidence_reference), '') is not null
    and length(evidence_reference) <= 1000
    and evidence_reference !~ '[[:cntrl:]]'
    and nullif(btrim(change_reason), '') is not null
    and length(change_reason) <= 500
    and change_reason !~ '[[:cntrl:]]'
  )
);

create index crm_commercial_policy_versions_runtime_hash_idx
  on private.crm_commercial_policy_versions (engine_key, runtime_policy_hash);
create index crm_commercial_policy_versions_effective_idx
  on private.crm_commercial_policy_versions (
    engine_key,
    effective_from,
    effective_until
  );
create index crm_commercial_policy_versions_owner_idx
  on private.crm_commercial_policy_versions (owner_id);
create index crm_commercial_policy_versions_backup_owner_idx
  on private.crm_commercial_policy_versions (backup_owner_id);
create index crm_commercial_policy_versions_approved_by_idx
  on private.crm_commercial_policy_versions (approved_by);

create table private.crm_commercial_policy_imports (
  request_id uuid primary key,
  policy_id uuid not null
    references private.crm_commercial_policy_versions(id) on delete restrict,
  manifest_hash text not null,
  plan_hash text not null,
  disposition text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint crm_commercial_policy_imports_hashes_check check (
    manifest_hash ~ '^[0-9a-f]{64}$'
    and plan_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_commercial_policy_imports_disposition_check
    check (disposition in ('create', 'noop'))
);

create index crm_commercial_policy_imports_policy_idx
  on private.crm_commercial_policy_imports (policy_id, created_at);
create index crm_commercial_policy_imports_actor_idx
  on private.crm_commercial_policy_imports (actor_user_id, created_at desc);

create table private.crm_commercial_engine_gates (
  engine_key text primary key
    references private.crm_commercial_engine_catalog(engine_key)
    on delete restrict,
  state text not null,
  policy_id uuid
    references private.crm_commercial_policy_versions(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  evidence_reference text,
  change_reason text,
  updated_at timestamptz not null default now(),
  constraint crm_commercial_engine_gates_policy_engine_fkey
    foreign key (policy_id, engine_key)
    references private.crm_commercial_policy_versions(id, engine_key)
    on delete restrict,
  constraint crm_commercial_engine_gates_state_check
    check (state in ('disabled', 'shadow', 'active', 'rolled_back')),
  constraint crm_commercial_engine_gates_policy_check check (
    (state in ('disabled', 'rolled_back') and policy_id is null)
    or
    (
      state in ('shadow', 'active')
      and policy_id is not null
      and approved_by is not null
      and approved_at is not null
      and pg_catalog.isfinite(approved_at)
      and nullif(btrim(coalesce(evidence_reference, '')), '') is not null
      and length(evidence_reference) <= 1000
      and evidence_reference !~ '[[:cntrl:]]'
      and nullif(btrim(coalesce(change_reason, '')), '') is not null
      and length(change_reason) <= 500
      and change_reason !~ '[[:cntrl:]]'
    )
  )
);

create table private.crm_commercial_engine_executions (
  id uuid primary key default gen_random_uuid(),
  engine_key text not null
    references private.crm_commercial_engine_catalog(engine_key)
    on delete restrict,
  policy_id uuid not null
    references private.crm_commercial_policy_versions(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  mode text not null,
  input_hash text not null,
  output_hash text not null,
  duration_ms integer not null,
  received_at timestamptz not null default now(),
  constraint crm_commercial_engine_executions_policy_engine_fkey
    foreign key (policy_id, engine_key)
    references private.crm_commercial_policy_versions(id, engine_key)
    on delete restrict,
  constraint crm_commercial_engine_executions_request_key
    unique (engine_key, actor_user_id, request_id),
  constraint crm_commercial_engine_executions_mode_check
    check (mode in ('shadow', 'active')),
  constraint crm_commercial_engine_executions_hashes_check check (
    input_hash ~ '^[0-9a-f]{64}$'
    and output_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_commercial_engine_executions_duration_check
    check (duration_ms between 0 and 600000),
  constraint crm_commercial_engine_executions_received_check
    check (pg_catalog.isfinite(received_at))
);

create index crm_commercial_engine_gates_policy_idx
  on private.crm_commercial_engine_gates (policy_id)
  where policy_id is not null;
create index crm_commercial_engine_gates_approved_by_idx
  on private.crm_commercial_engine_gates (approved_by)
  where approved_by is not null;

create index crm_commercial_engine_executions_actor_idx
  on private.crm_commercial_engine_executions (
    actor_user_id,
    received_at desc
  );
create index crm_commercial_engine_executions_policy_idx
  on private.crm_commercial_engine_executions (policy_id, received_at desc);

alter table private.crm_commercial_engine_catalog enable row level security;
alter table private.crm_commercial_engine_catalog force row level security;
alter table private.crm_commercial_policy_versions enable row level security;
alter table private.crm_commercial_policy_versions force row level security;
alter table private.crm_commercial_policy_imports enable row level security;
alter table private.crm_commercial_policy_imports force row level security;
alter table private.crm_commercial_engine_gates enable row level security;
alter table private.crm_commercial_engine_gates force row level security;
alter table private.crm_commercial_engine_executions enable row level security;
alter table private.crm_commercial_engine_executions force row level security;

revoke all on table
  private.crm_commercial_engine_catalog,
  private.crm_commercial_policy_versions,
  private.crm_commercial_policy_imports,
  private.crm_commercial_engine_gates,
  private.crm_commercial_engine_executions
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;

-- Policies and ledgers are append-only. Even a privileged implementation bug
-- cannot silently rewrite the history used to explain a commercial result.
create or replace function private.prevent_crm_commercial_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'immutable: commercial policy history cannot be changed'
    using errcode = '55000';
end;
$$;

create trigger crm_commercial_policy_versions_immutable
  before update or delete on private.crm_commercial_policy_versions
  for each row execute function private.prevent_crm_commercial_immutable_change();
create trigger crm_commercial_policy_imports_immutable
  before update or delete on private.crm_commercial_policy_imports
  for each row execute function private.prevent_crm_commercial_immutable_change();
create trigger crm_commercial_engine_executions_immutable
  before update or delete on private.crm_commercial_engine_executions
  for each row execute function private.prevent_crm_commercial_immutable_change();

alter function private.prevent_crm_commercial_immutable_change()
  owner to postgres;
revoke all privileges on function
  private.prevent_crm_commercial_immutable_change()
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;

-- --------------------------------------------------------------------------
-- Import validation and deterministic dry-run plan
-- --------------------------------------------------------------------------

create or replace function private.build_crm_commercial_policy_import_plan(
  p_manifest jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_policy jsonb;
  v_definition jsonb;
  v_item jsonb;
  v_request_id uuid;
  v_engine_key text;
  v_version integer;
  v_policy_hash text;
  v_golden_report_hash text;
  v_owner_key text;
  v_backup_owner_key text;
  v_owner_id uuid;
  v_backup_owner_id uuid;
  v_effective_from timestamptz;
  v_effective_until timestamptz;
  v_evidence_reference text;
  v_change_reason text;
  v_golden_case_count integer;
  v_db_document_hash text;
  v_manifest_hash text;
  v_plan_hash text;
  v_disposition text;
  v_reason_code text;
  v_latest_version integer;
  v_existing private.crm_commercial_policy_versions%rowtype;
begin
  if p_manifest is null
     or jsonb_typeof(p_manifest) <> 'object'
     or octet_length(convert_to(p_manifest::text, 'UTF8')) > 2000000
     or (select count(*) from jsonb_object_keys(p_manifest)) <> 5
     or exists (
       select 1
       from jsonb_object_keys(p_manifest) manifest_key
       where manifest_key not in (
         'schemaVersion', 'requestId', 'policy',
         'policyHash', 'goldenReportHash'
       )
     )
     or jsonb_typeof(p_manifest -> 'schemaVersion') <> 'number'
     or p_manifest ->> 'schemaVersion' <> '1'
     or jsonb_typeof(p_manifest -> 'requestId') <> 'string'
     or jsonb_typeof(p_manifest -> 'policyHash') <> 'string'
     or jsonb_typeof(p_manifest -> 'goldenReportHash') <> 'string'
     or jsonb_typeof(p_manifest -> 'policy') <> 'object' then
    raise exception 'invalid_argument: invalid commercial policy manifest shape'
      using errcode = '22023';
  end if;

  begin
    v_request_id := (p_manifest ->> 'requestId')::uuid;
  exception when others then
    raise exception 'invalid_argument: invalid commercial policy request id'
      using errcode = '22023';
  end;

  v_policy := p_manifest -> 'policy';
  v_policy_hash := p_manifest ->> 'policyHash';
  v_golden_report_hash := p_manifest ->> 'goldenReportHash';

  if v_request_id is null
     or p_manifest ->> 'requestId' <> v_request_id::text
     or v_policy_hash !~ '^[0-9a-f]{64}$'
     or v_golden_report_hash !~ '^[0-9a-f]{64}$'
     or (select count(*) from jsonb_object_keys(v_policy)) not between 11 and 12
     or exists (
       select 1
       from jsonb_object_keys(v_policy) policy_key
       where policy_key not in (
         'schemaVersion', 'engineKey', 'version', 'effectiveFrom',
         'effectiveUntil', 'timezone', 'ownerKey', 'backupOwnerKey',
         'evidenceReference', 'changeReason', 'definition', 'goldenCases'
       )
     )
     or not (
       v_policy ?& array[
         'schemaVersion', 'engineKey', 'version', 'effectiveFrom',
         'timezone', 'ownerKey', 'backupOwnerKey', 'evidenceReference',
         'changeReason', 'definition', 'goldenCases'
       ]
     )
     or jsonb_typeof(v_policy -> 'schemaVersion') <> 'number'
     or v_policy ->> 'schemaVersion' <> '1'
     or jsonb_typeof(v_policy -> 'engineKey') <> 'string'
     or jsonb_typeof(v_policy -> 'version') <> 'number'
     or (v_policy ->> 'version') !~ '^[1-9][0-9]{0,5}$'
     or jsonb_typeof(v_policy -> 'effectiveFrom') <> 'string'
     or jsonb_typeof(v_policy -> 'timezone') <> 'string'
     or jsonb_typeof(v_policy -> 'ownerKey') <> 'string'
     or jsonb_typeof(v_policy -> 'backupOwnerKey') <> 'string'
     or jsonb_typeof(v_policy -> 'evidenceReference') <> 'string'
     or jsonb_typeof(v_policy -> 'changeReason') <> 'string'
     or jsonb_typeof(v_policy -> 'definition') <> 'object'
     or jsonb_typeof(v_policy -> 'goldenCases') <> 'array'
     or (
       v_policy ? 'effectiveUntil'
       and jsonb_typeof(v_policy -> 'effectiveUntil') not in ('string', 'null')
     ) then
    raise exception 'invalid_argument: invalid commercial policy document shape'
      using errcode = '22023';
  end if;

  v_engine_key := v_policy ->> 'engineKey';
  v_version := (v_policy ->> 'version')::integer;
  v_owner_key := v_policy ->> 'ownerKey';
  v_backup_owner_key := v_policy ->> 'backupOwnerKey';
  v_evidence_reference := v_policy ->> 'evidenceReference';
  v_change_reason := v_policy ->> 'changeReason';
  v_definition := v_policy -> 'definition';
  v_golden_case_count := jsonb_array_length(v_policy -> 'goldenCases');

  if length(v_engine_key) not between 1 and 100
     or v_engine_key !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
     or not exists (
       select 1
       from private.crm_commercial_engine_catalog catalog
       where catalog.engine_key = v_engine_key
     )
     or v_version not between 1 and 1000000
     or v_policy ->> 'timezone' <> 'America/Sao_Paulo'
     or length(v_owner_key) not between 1 and 100
     or v_owner_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or length(v_backup_owner_key) not between 1 and 100
     or v_backup_owner_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or v_owner_key = v_backup_owner_key
     or v_evidence_reference <> btrim(v_evidence_reference)
     or length(v_evidence_reference) not between 1 and 1000
     or v_evidence_reference ~ '[[:cntrl:]]'
     or v_change_reason <> btrim(v_change_reason)
     or length(v_change_reason) not between 1 and 500
     or v_change_reason ~ '[[:cntrl:]]'
     or v_golden_case_count not between 1 and 100 then
    raise exception 'invalid_argument: incomplete commercial policy governance'
      using errcode = '22023';
  end if;

  if (select count(*) from jsonb_object_keys(v_definition)) <> 4
     or exists (
       select 1
       from jsonb_object_keys(v_definition) definition_key
       where definition_key not in (
         'schemaVersion', 'runtimeVersion', 'inputs', 'outputs'
       )
     )
     or jsonb_typeof(v_definition -> 'schemaVersion') <> 'number'
     or v_definition ->> 'schemaVersion' <> '1'
     or jsonb_typeof(v_definition -> 'runtimeVersion') <> 'number'
     or v_definition ->> 'runtimeVersion' <> '1'
     or jsonb_typeof(v_definition -> 'inputs') <> 'array'
     or jsonb_typeof(v_definition -> 'outputs') <> 'array' then
    raise exception 'invalid_argument: invalid commercial policy definition'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_definition -> 'inputs') not between 1 and 100
     or jsonb_array_length(v_definition -> 'outputs') not between 1 and 100 then
    raise exception 'invalid_argument: commercial policy fields are out of bounds'
      using errcode = '22023';
  end if;

  for v_item in
    select input_item.value
    from jsonb_array_elements(v_definition -> 'inputs') input_item(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or (select count(*) from jsonb_object_keys(v_item)) <> 2
       or not (v_item ?& array['key', 'valueType'])
       or exists (
         select 1 from jsonb_object_keys(v_item) item_key
         where item_key not in ('key', 'valueType')
       )
       or jsonb_typeof(v_item -> 'key') <> 'string'
       or length(v_item ->> 'key') not between 1 and 100
       or (v_item ->> 'key') !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
       or jsonb_typeof(v_item -> 'valueType') <> 'string'
       or (v_item ->> 'valueType') not in (
         'decimal', 'boolean', 'string', 'date'
       ) then
      raise exception 'invalid_argument: invalid commercial policy input'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(v_definition -> 'inputs') input_item(value)
    group by input_item.value ->> 'key'
    having count(*) > 1
  ) then
    raise exception 'invalid_argument: duplicate commercial policy input key'
      using errcode = '22023';
  end if;

  for v_item in
    select output_item.value
    from jsonb_array_elements(v_definition -> 'outputs') output_item(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or (select count(*) from jsonb_object_keys(v_item)) <> 3
       or not (v_item ?& array['key', 'valueType', 'expression'])
       or exists (
         select 1 from jsonb_object_keys(v_item) item_key
         where item_key not in ('key', 'valueType', 'expression')
       )
       or jsonb_typeof(v_item -> 'key') <> 'string'
       or length(v_item ->> 'key') not between 1 and 100
       or (v_item ->> 'key') !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
       or jsonb_typeof(v_item -> 'valueType') <> 'string'
       or (v_item ->> 'valueType') not in (
         'decimal', 'boolean', 'string', 'date'
       )
       or jsonb_typeof(v_item -> 'expression') <> 'object' then
      raise exception 'invalid_argument: invalid commercial policy output'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(v_definition -> 'outputs') output_item(value)
    group by output_item.value ->> 'key'
    having count(*) > 1
  ) then
    raise exception 'invalid_argument: duplicate commercial policy output key'
      using errcode = '22023';
  end if;

  for v_item in
    select golden_item.value
    from jsonb_array_elements(v_policy -> 'goldenCases') golden_item(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or (select count(*) from jsonb_object_keys(v_item)) <> 3
       or not (v_item ?& array['caseKey', 'input', 'expected'])
       or exists (
         select 1 from jsonb_object_keys(v_item) item_key
         where item_key not in ('caseKey', 'input', 'expected')
       )
       or jsonb_typeof(v_item -> 'caseKey') <> 'string'
       or length(v_item ->> 'caseKey') not between 1 and 100
       or (v_item ->> 'caseKey') !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
       or jsonb_typeof(v_item -> 'input') <> 'object'
       or jsonb_typeof(v_item -> 'expected') <> 'object'
       or (select count(*) from jsonb_object_keys(v_item -> 'input')) > 100
       or (select count(*) from jsonb_object_keys(v_item -> 'expected')) > 100 then
      raise exception 'invalid_argument: invalid commercial policy golden case'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(v_policy -> 'goldenCases') golden_item(value)
    group by golden_item.value ->> 'caseKey'
    having count(*) > 1
  ) then
    raise exception 'invalid_argument: duplicate commercial golden case key'
      using errcode = '22023';
  end if;

  if v_policy ->> 'effectiveFrom' !~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or (
       v_policy ? 'effectiveUntil'
       and jsonb_typeof(v_policy -> 'effectiveUntil') = 'string'
       and v_policy ->> 'effectiveUntil' !~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     ) then
    raise exception 'invalid_argument: invalid commercial policy window format'
      using errcode = '22023';
  end if;

  begin
    v_effective_from := (v_policy ->> 'effectiveFrom')::timestamptz;
    v_effective_until := case
      when jsonb_typeof(v_policy -> 'effectiveUntil') = 'string'
        then (v_policy ->> 'effectiveUntil')::timestamptz
      else null
    end;
  exception when others then
    raise exception 'invalid_argument: invalid commercial policy window'
      using errcode = '22023';
  end;

  if not pg_catalog.isfinite(v_effective_from)
     or (
       v_effective_until is not null
       and (
         not pg_catalog.isfinite(v_effective_until)
         or v_effective_until <= v_effective_from
       )
     ) then
    raise exception 'invalid_argument: invalid commercial policy window'
      using errcode = '22023';
  end if;

  select owner.id into v_owner_id
  from private.crm_integration_owners owner
  where owner.owner_key = v_owner_key and owner.is_active;

  select owner.id into v_backup_owner_id
  from private.crm_integration_owners owner
  where owner.owner_key = v_backup_owner_key and owner.is_active;

  if v_owner_id is null
     or v_backup_owner_id is null
     or v_owner_id = v_backup_owner_id then
    raise exception 'conflict: commercial policy owners are unavailable'
      using errcode = '23505';
  end if;

  v_db_document_hash := encode(extensions.digest(
    convert_to(v_policy::text, 'UTF8'),
    'sha256'
  ), 'hex');
  v_manifest_hash := encode(extensions.digest(
    convert_to(p_manifest::text, 'UTF8'),
    'sha256'
  ), 'hex');

  select policy.* into v_existing
  from private.crm_commercial_policy_versions policy
  where policy.engine_key = v_engine_key
    and policy.version = v_version;

  select max(policy.version) into v_latest_version
  from private.crm_commercial_policy_versions policy
  where policy.engine_key = v_engine_key;

  if v_existing.id is null
     and (v_latest_version is null or v_version > v_latest_version) then
    v_disposition := 'create';
    v_reason_code := null;
  elsif v_existing.db_document_hash = v_db_document_hash
        and v_existing.runtime_policy_hash = v_policy_hash
        and v_existing.golden_report_hash = v_golden_report_hash
        and v_existing.policy_document = v_policy
        and v_existing.owner_id = v_owner_id
        and v_existing.backup_owner_id = v_backup_owner_id
        and v_existing.effective_from = v_effective_from
        and v_existing.effective_until is not distinct from v_effective_until then
    v_disposition := 'noop';
    v_reason_code := null;
  elsif v_existing.id is not null then
    v_disposition := 'conflict';
    v_reason_code := 'engine_version_conflict';
  else
    v_disposition := 'conflict';
    v_reason_code := 'non_monotonic_version';
  end if;

  v_plan_hash := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'manifestHash', v_manifest_hash,
      'engineKey', v_engine_key,
      'version', v_version,
      'policyHash', v_policy_hash,
      'goldenReportHash', v_golden_report_hash,
      'disposition', v_disposition,
      'reasonCode', v_reason_code,
      'existingPolicyId', v_existing.id
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  return jsonb_build_object(
    'ok', v_disposition <> 'conflict',
    'ready', v_disposition <> 'conflict',
    'manifestHash', v_manifest_hash,
    'planHash', v_plan_hash,
    'requestId', v_request_id,
    'engineKey', v_engine_key,
    'version', v_version,
    'policyHash', v_policy_hash,
    'goldenReportHash', v_golden_report_hash,
    'goldenCaseCount', v_golden_case_count,
    'dbDocumentHash', v_db_document_hash,
    'ownerId', v_owner_id,
    'backupOwnerId', v_backup_owner_id,
    'effectiveFrom', v_effective_from,
    'effectiveUntil', v_effective_until,
    'evidenceReference', v_evidence_reference,
    'changeReason', v_change_reason,
    'disposition', v_disposition,
    'reasonCode', v_reason_code,
    'existingPolicyId', v_existing.id
  );
end;
$$;

alter function private.build_crm_commercial_policy_import_plan(jsonb)
  owner to postgres;
revoke all privileges on function
  private.build_crm_commercial_policy_import_plan(jsonb)
from public, anon, authenticated, service_role, crm_qlik_relay;

-- --------------------------------------------------------------------------
-- Authenticated management RPCs
-- --------------------------------------------------------------------------

create or replace function public.preview_crm_commercial_policy_import(
  p_manifest jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan jsonb;
begin
  if v_actor is null
     or not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(
       v_actor,
       'crm.commercial_policy.manage'
     ), false) then
    raise exception 'forbidden: commercial policy preview is not permitted'
      using errcode = '42501';
  end if;

  v_plan := private.build_crm_commercial_policy_import_plan(p_manifest);

  return jsonb_build_object(
    'ok', v_plan -> 'ok',
    'mode', 'preview',
    'ready', v_plan -> 'ready',
    'manifestHash', v_plan -> 'manifestHash',
    'planHash', v_plan -> 'planHash',
    'requestId', v_plan -> 'requestId',
    'engineKey', v_plan -> 'engineKey',
    'version', v_plan -> 'version',
    'policyHash', v_plan -> 'policyHash',
    'goldenReportHash', v_plan -> 'goldenReportHash',
    'goldenCaseCount', v_plan -> 'goldenCaseCount',
    'disposition', v_plan -> 'disposition',
    'reasonCode', v_plan -> 'reasonCode'
  );
end;
$$;

create or replace function public.apply_crm_commercial_policy_import(
  p_manifest jsonb,
  p_expected_plan_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request_id uuid;
  v_existing_import private.crm_commercial_policy_imports%rowtype;
  v_existing_policy private.crm_commercial_policy_versions%rowtype;
  v_replay_manifest_hash text;
  v_plan jsonb;
  v_policy_id uuid;
  v_disposition text;
begin
  if v_actor is null then
    raise exception 'forbidden: commercial policy import is not permitted'
      using errcode = '42501';
  end if;

  perform private.lock_and_assert_actor(v_actor);

  if not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(
       v_actor,
       'crm.commercial_policy.manage'
     ), false) then
    raise exception 'forbidden: commercial policy import is not permitted'
      using errcode = '42501';
  end if;
  if p_expected_plan_hash is null
     or p_expected_plan_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_argument: invalid expected commercial plan hash'
      using errcode = '22023';
  end if;
  if p_manifest is null
     or jsonb_typeof(p_manifest) <> 'object'
     or jsonb_typeof(p_manifest -> 'requestId') <> 'string' then
    raise exception 'invalid_argument: invalid commercial policy manifest'
      using errcode = '22023';
  end if;

  begin
    v_request_id := (p_manifest ->> 'requestId')::uuid;
  exception when others then
    raise exception 'invalid_argument: invalid commercial policy request id'
      using errcode = '22023';
  end;
  if v_request_id is null
     or p_manifest ->> 'requestId' <> v_request_id::text then
    raise exception 'invalid_argument: invalid commercial policy request id'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-policy-import:' || v_request_id::text,
    0
  ));

  select import.* into v_existing_import
  from private.crm_commercial_policy_imports import
  where import.request_id = v_request_id;

  if v_existing_import.request_id is not null then
    -- Historical replay is bound to the immutable manifest and policy, not to
    -- mutable owner availability. Owner deactivation blocks gates/execution,
    -- but cannot make an already-committed request cease to be idempotent.
    if octet_length(convert_to(p_manifest::text, 'UTF8')) > 2000000 then
      raise exception 'conflict: commercial policy request id was reused'
        using errcode = '23505';
    end if;
    v_replay_manifest_hash := encode(extensions.digest(
      convert_to(p_manifest::text, 'UTF8'),
      'sha256'
    ), 'hex');

    select policy.* into strict v_existing_policy
    from private.crm_commercial_policy_versions policy
    where policy.id = v_existing_import.policy_id;

    if v_existing_import.manifest_hash <> v_replay_manifest_hash
       or v_existing_import.plan_hash <> p_expected_plan_hash
       or p_manifest -> 'policy' is distinct from v_existing_policy.policy_document
       or p_manifest ->> 'policyHash' is distinct from
         v_existing_policy.runtime_policy_hash
       or p_manifest ->> 'goldenReportHash' is distinct from
         v_existing_policy.golden_report_hash then
      raise exception 'conflict: commercial policy request id was reused'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'ok', true,
      'mode', 'apply',
      'ready', true,
      'manifestHash', v_existing_import.manifest_hash,
      'planHash', v_existing_import.plan_hash,
      'requestId', v_existing_import.request_id,
      'policyId', v_existing_import.policy_id,
      'engineKey', v_existing_policy.engine_key,
      'version', v_existing_policy.version,
      'policyHash', v_existing_policy.runtime_policy_hash,
      'goldenReportHash', v_existing_policy.golden_report_hash,
      'disposition', v_existing_import.disposition,
      'noop', true,
      'replay', true
    );
  end if;

  -- Freeze owner availability while planning and inserting. The policy table
  -- itself is protected by an engine advisory lock and immutability.
  lock table private.crm_integration_owners in share mode;
  v_plan := private.build_crm_commercial_policy_import_plan(p_manifest);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-policy-engine:' || (v_plan ->> 'engineKey'),
    0
  ));

  -- Plan again after the engine lock to enforce monotonic versions and close
  -- both the preview/apply and concurrent-version races.
  v_plan := private.build_crm_commercial_policy_import_plan(p_manifest);
  if v_plan ->> 'planHash' <> p_expected_plan_hash then
    raise exception 'conflict: commercial policy import plan is stale'
      using errcode = '23505';
  end if;
  if coalesce((v_plan ->> 'ready')::boolean, false) is not true then
    raise exception 'conflict: commercial policy import has conflicts'
      using errcode = '23505';
  end if;

  v_disposition := v_plan ->> 'disposition';
  if v_disposition = 'create' then
    insert into private.crm_commercial_policy_versions (
      engine_key,
      version,
      contract_version,
      policy_document,
      db_document_hash,
      runtime_policy_hash,
      golden_report_hash,
      golden_case_count,
      owner_id,
      backup_owner_id,
      effective_from,
      effective_until,
      timezone,
      evidence_reference,
      change_reason,
      approved_by,
      approved_at
    ) values (
      v_plan ->> 'engineKey',
      (v_plan ->> 'version')::integer,
      1,
      p_manifest -> 'policy',
      v_plan ->> 'dbDocumentHash',
      v_plan ->> 'policyHash',
      v_plan ->> 'goldenReportHash',
      (v_plan ->> 'goldenCaseCount')::integer,
      (v_plan ->> 'ownerId')::uuid,
      (v_plan ->> 'backupOwnerId')::uuid,
      (v_plan ->> 'effectiveFrom')::timestamptz,
      nullif(v_plan ->> 'effectiveUntil', '')::timestamptz,
      'America/Sao_Paulo',
      v_plan ->> 'evidenceReference',
      v_plan ->> 'changeReason',
      v_actor,
      clock_timestamp()
    ) returning id into v_policy_id;
  elsif v_disposition = 'noop' then
    v_policy_id := (v_plan ->> 'existingPolicyId')::uuid;
  else
    raise exception 'conflict: commercial policy import has conflicts'
      using errcode = '23505';
  end if;

  insert into private.crm_commercial_policy_imports (
    request_id,
    policy_id,
    manifest_hash,
    plan_hash,
    disposition,
    actor_user_id
  ) values (
    v_request_id,
    v_policy_id,
    v_plan ->> 'manifestHash',
    p_expected_plan_hash,
    v_disposition,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'commercial.policy_import_apply',
    jsonb_build_object(
      'request_id', v_request_id,
      'engine_key', v_plan ->> 'engineKey',
      'version', (v_plan ->> 'version')::integer
    ),
    jsonb_build_object(
      'policy_id', v_policy_id,
      'policy_hash', v_plan ->> 'policyHash',
      'golden_report_hash', v_plan ->> 'goldenReportHash',
      'golden_case_count', (v_plan ->> 'goldenCaseCount')::integer,
      'plan_hash', p_expected_plan_hash,
      'disposition', v_disposition,
      'reason', v_plan ->> 'changeReason',
      'evidence_reference', v_plan ->> 'evidenceReference'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'mode', 'apply',
    'ready', true,
    'manifestHash', v_plan -> 'manifestHash',
    'planHash', v_plan -> 'planHash',
    'requestId', v_request_id,
    'policyId', v_policy_id,
    'engineKey', v_plan -> 'engineKey',
    'version', v_plan -> 'version',
    'policyHash', v_plan -> 'policyHash',
    'goldenReportHash', v_plan -> 'goldenReportHash',
    'disposition', v_disposition,
    'noop', v_disposition = 'noop',
    'replay', false
  );
end;
$$;

create or replace function public.set_crm_commercial_engine_gate(
  p_engine_key text,
  p_policy_hash text,
  p_state text,
  p_change_reason text,
  p_evidence_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing private.crm_commercial_engine_gates%rowtype;
  v_policy private.crm_commercial_policy_versions%rowtype;
  v_policy_id uuid;
  v_noop boolean := false;
begin
  if v_actor is null then
    raise exception 'forbidden: commercial engine gate is not permitted'
      using errcode = '42501';
  end if;

  perform private.lock_and_assert_actor(v_actor);

  if not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(
       v_actor,
       'crm.commercial_policy.manage'
     ), false) then
    raise exception 'forbidden: commercial engine gate is not permitted'
      using errcode = '42501';
  end if;
  if p_engine_key is null
     or length(p_engine_key) not between 1 and 100
     or p_engine_key !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
     or not exists (
       select 1 from private.crm_commercial_engine_catalog catalog
       where catalog.engine_key = p_engine_key
     )
     or p_state is null
     or p_state not in ('disabled', 'shadow', 'active', 'rolled_back')
     or p_change_reason is null
     or p_change_reason <> btrim(p_change_reason)
     or length(p_change_reason) not between 1 and 500
     or p_change_reason ~ '[[:cntrl:]]'
     or p_evidence_reference is null
     or p_evidence_reference <> btrim(p_evidence_reference)
     or length(p_evidence_reference) not between 1 and 1000
     or p_evidence_reference ~ '[[:cntrl:]]'
     or (
       p_state in ('shadow', 'active')
       and (
         p_policy_hash is null
         or p_policy_hash !~ '^[0-9a-f]{64}$'
       )
     )
     or (
       p_state in ('disabled', 'rolled_back')
       and p_policy_hash is not null
     ) then
    raise exception 'invalid_argument: invalid commercial engine gate command'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-engine-gate:' || p_engine_key,
    0
  ));

  -- Owner/backup deactivation takes a conflicting table lock. Holding SHARE
  -- through the transition prevents activation after either authority leaves.
  lock table private.crm_integration_owners in share mode;

  select gate.* into v_existing
  from private.crm_commercial_engine_gates gate
  where gate.engine_key = p_engine_key;

  if p_state in ('shadow', 'active') then
    select policy.* into v_policy
    from private.crm_commercial_policy_versions policy
    join private.crm_integration_owners owner
      on owner.id = policy.owner_id and owner.is_active
    join private.crm_integration_owners backup_owner
      on backup_owner.id = policy.backup_owner_id and backup_owner.is_active
    where policy.engine_key = p_engine_key
      and policy.runtime_policy_hash = p_policy_hash
      and policy.golden_case_count > 0
      and policy.approved_at is not null
      and policy.effective_from <= now()
      and (policy.effective_until is null or policy.effective_until > now())
    order by policy.version desc
    limit 1;

    if v_policy.id is null then
      raise exception 'conflict: approved commercial policy is unavailable'
        using errcode = '23505';
    end if;
    v_policy_id := v_policy.id;
  else
    v_policy_id := null;
  end if;

  v_noop := v_existing.engine_key is not null
    and v_existing.state = p_state
    and v_existing.policy_id is not distinct from v_policy_id;

  if v_noop then
    null;
  elsif v_existing.engine_key is null then
    if p_state <> 'disabled' then
      raise exception 'conflict: commercial gate must start disabled'
        using errcode = '23505';
    end if;
  elsif p_state = 'shadow' and (
    v_existing.state not in ('disabled', 'shadow')
    or (
      v_existing.state = 'shadow'
      and v_existing.policy_id <> v_policy_id
    )
  ) then
    raise exception 'conflict: invalid commercial shadow transition'
      using errcode = '23505';
  elsif p_state = 'active' and (
    v_existing.state <> 'shadow'
    or v_existing.policy_id <> v_policy_id
  ) then
    raise exception 'conflict: active requires shadow on the same policy'
      using errcode = '23505';
  elsif p_state = 'rolled_back' and v_existing.state not in ('shadow', 'active') then
    raise exception 'conflict: rollback requires a running commercial gate'
      using errcode = '23505';
  end if;

  if not v_noop then
    insert into private.crm_commercial_engine_gates (
      engine_key,
      state,
      policy_id,
      approved_by,
      approved_at,
      evidence_reference,
      change_reason,
      updated_at
    ) values (
      p_engine_key,
      p_state,
      v_policy_id,
      v_actor,
      clock_timestamp(),
      p_evidence_reference,
      p_change_reason,
      clock_timestamp()
    )
    on conflict (engine_key) do update set
      state = excluded.state,
      policy_id = excluded.policy_id,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      evidence_reference = excluded.evidence_reference,
      change_reason = excluded.change_reason,
      updated_at = excluded.updated_at;

    insert into public.audit_logs (actor_id, action, before, after)
    values (
      v_actor,
      'commercial.engine_gate_changed',
      case when v_existing.engine_key is null then null else jsonb_build_object(
        'engine_key', v_existing.engine_key,
        'state', v_existing.state,
        'policy_id', v_existing.policy_id
      ) end,
      jsonb_build_object(
        'engine_key', p_engine_key,
        'state', p_state,
        'policy_id', v_policy_id,
        'policy_hash', p_policy_hash,
        'reason', p_change_reason,
        'evidence_reference', p_evidence_reference
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'engineKey', p_engine_key,
    'state', p_state,
    'policyId', v_policy_id,
    'policyHash', p_policy_hash,
    'noop', v_noop
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Runtime RPCs: policy lookup and hashes-only execution evidence
-- --------------------------------------------------------------------------

create or replace function commercial_engine.get_policy(
  p_actor_user_id uuid,
  p_engine_key text,
  p_requested_mode text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_required_permission text;
  v_result jsonb;
  v_runtime_login_enabled boolean := false;
  v_runtime_role_isolated boolean := false;
begin
  select coalesce(role.rolcanlogin, false)
  into v_runtime_login_enabled
  from pg_catalog.pg_roles role
  where role.rolname = 'crm_commercial_engine';

  if v_runtime_login_enabled
     and session_user in ('postgres', 'crm_commercial_engine') then
    v_runtime_role_isolated := private.crm_commercial_engine_role_isolated();
  end if;

  if (v_runtime_login_enabled and not v_runtime_role_isolated)
     or (
       session_user <> 'postgres'
       and (
         session_user <> 'crm_commercial_engine'
         or not v_runtime_login_enabled
       )
     ) then
    raise exception 'forbidden: commercial engine role is not isolated'
      using errcode = '42501';
  end if;
  if p_actor_user_id is null
     or p_engine_key is null
     or length(p_engine_key) not between 1 and 100
     or p_requested_mode not in ('shadow', 'active') then
    return null;
  end if;

  select catalog.required_permission_key into v_required_permission
  from private.crm_commercial_engine_catalog catalog
  where catalog.engine_key = p_engine_key
    and catalog.interactive;

  if v_required_permission is null
     or not coalesce(public._internal_has_permission(
       p_actor_user_id,
       v_required_permission
     ), false) then
    return null;
  end if;

  select jsonb_build_object(
    'policyId', policy.id,
    'engineKey', policy.engine_key,
    'version', policy.version,
    'policyHash', policy.runtime_policy_hash,
    'goldenReportHash', policy.golden_report_hash,
    'gateState', gate.state,
    'effectiveFrom', policy.effective_from,
    'effectiveUntil', policy.effective_until,
    'policy', policy.policy_document
  ) into v_result
  from private.crm_commercial_engine_gates gate
  join private.crm_commercial_policy_versions policy
    on policy.id = gate.policy_id
    and policy.engine_key = gate.engine_key
  join private.crm_integration_owners owner
    on owner.id = policy.owner_id and owner.is_active
  join private.crm_integration_owners backup_owner
    on backup_owner.id = policy.backup_owner_id and backup_owner.is_active
  where gate.engine_key = p_engine_key
    and gate.state = p_requested_mode
    and policy.effective_from <= now()
    and (policy.effective_until is null or policy.effective_until > now());

  return v_result;
end;
$$;

create or replace function commercial_engine.record_execution(
  p_actor_user_id uuid,
  p_engine_key text,
  p_mode text,
  p_policy_hash text,
  p_request_id uuid,
  p_input_hash text,
  p_output_hash text,
  p_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_required_permission text;
  v_policy_id uuid;
  v_existing private.crm_commercial_engine_executions%rowtype;
  v_execution_id uuid;
  v_runtime_login_enabled boolean := false;
  v_runtime_role_isolated boolean := false;
begin
  select coalesce(role.rolcanlogin, false)
  into v_runtime_login_enabled
  from pg_catalog.pg_roles role
  where role.rolname = 'crm_commercial_engine';

  if v_runtime_login_enabled
     and session_user in ('postgres', 'crm_commercial_engine') then
    v_runtime_role_isolated := private.crm_commercial_engine_role_isolated();
  end if;

  if (v_runtime_login_enabled and not v_runtime_role_isolated)
     or (
       session_user <> 'postgres'
       and (
         session_user <> 'crm_commercial_engine'
         or not v_runtime_login_enabled
       )
     ) then
    raise exception 'forbidden: commercial engine role is not isolated'
      using errcode = '42501';
  end if;
  if p_actor_user_id is null
     or p_engine_key is null
     or length(p_engine_key) not between 1 and 100
     or p_mode not in ('shadow', 'active')
     or p_policy_hash is null
     or p_policy_hash !~ '^[0-9a-f]{64}$'
     or p_request_id is null
     or p_input_hash is null
     or p_input_hash !~ '^[0-9a-f]{64}$'
     or p_output_hash is null
     or p_output_hash !~ '^[0-9a-f]{64}$'
     or p_duration_ms is null
     or p_duration_ms not between 0 and 600000 then
    raise exception 'invalid_argument: invalid commercial execution evidence'
      using errcode = '22023';
  end if;

  perform private.lock_and_assert_actor(p_actor_user_id);

  select catalog.required_permission_key into v_required_permission
  from private.crm_commercial_engine_catalog catalog
  where catalog.engine_key = p_engine_key
    and catalog.interactive;

  if v_required_permission is null
     or not coalesce(public._internal_has_permission(
       p_actor_user_id,
       v_required_permission
     ), false) then
    raise exception 'forbidden: commercial execution is not permitted'
      using errcode = '42501';
  end if;

  -- Serialize the final gate check with every transition. The application
  -- returns a result only after this evidence write succeeds.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-engine-gate:' || p_engine_key,
    0
  ));

  -- Keep official owner and backup authority stable through the final gate
  -- check and append-only evidence write.
  lock table private.crm_integration_owners in share mode;

  select policy.id into v_policy_id
  from private.crm_commercial_engine_gates gate
  join private.crm_commercial_policy_versions policy
    on policy.id = gate.policy_id
    and policy.engine_key = gate.engine_key
  join private.crm_integration_owners owner
    on owner.id = policy.owner_id and owner.is_active
  join private.crm_integration_owners backup_owner
    on backup_owner.id = policy.backup_owner_id and backup_owner.is_active
  where gate.engine_key = p_engine_key
    and gate.state = p_mode
    and policy.runtime_policy_hash = p_policy_hash
    and policy.effective_from <= now()
    and (policy.effective_until is null or policy.effective_until > now());

  if v_policy_id is null then
    raise exception 'conflict: commercial policy gate is unavailable'
      using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-execution:' || p_engine_key || ':' || p_actor_user_id::text
      || ':' || p_request_id::text,
    0
  ));

  select execution.* into v_existing
  from private.crm_commercial_engine_executions execution
  where execution.engine_key = p_engine_key
    and execution.actor_user_id = p_actor_user_id
    and execution.request_id = p_request_id;

  if v_existing.id is not null then
    if v_existing.policy_id <> v_policy_id
       or v_existing.mode <> p_mode
       or v_existing.input_hash <> p_input_hash
       or v_existing.output_hash <> p_output_hash then
      raise exception 'conflict: commercial execution request id was reused'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'ok', true,
      'replay', true,
      'executionId', v_existing.id
    );
  end if;

  insert into private.crm_commercial_engine_executions (
    engine_key,
    policy_id,
    actor_user_id,
    request_id,
    mode,
    input_hash,
    output_hash,
    duration_ms
  ) values (
    p_engine_key,
    v_policy_id,
    p_actor_user_id,
    p_request_id,
    p_mode,
    p_input_hash,
    p_output_hash,
    p_duration_ms
  ) returning id into v_execution_id;

  return jsonb_build_object(
    'ok', true,
    'replay', false,
    'executionId', v_execution_id
  );
end;
$$;

alter function public.preview_crm_commercial_policy_import(jsonb)
  owner to postgres;
alter function public.apply_crm_commercial_policy_import(jsonb, text)
  owner to postgres;
alter function public.set_crm_commercial_engine_gate(text, text, text, text, text)
  owner to postgres;
alter function commercial_engine.get_policy(uuid, text, text)
  owner to postgres;
alter function commercial_engine.record_execution(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  integer
) owner to postgres;

revoke all privileges on function
  public.preview_crm_commercial_policy_import(jsonb)
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;
revoke all privileges on function
  public.apply_crm_commercial_policy_import(jsonb, text)
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;
revoke all privileges on function
  public.set_crm_commercial_engine_gate(text, text, text, text, text)
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;
revoke all privileges on function
  commercial_engine.get_policy(uuid, text, text)
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;
revoke all privileges on function
  commercial_engine.record_execution(
    uuid,
    text,
    text,
    text,
    uuid,
    text,
    text,
    integer
  )
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;

grant execute on function
  public.preview_crm_commercial_policy_import(jsonb)
to authenticated;
grant execute on function
  public.apply_crm_commercial_policy_import(jsonb, text)
to authenticated;
grant execute on function
  public.set_crm_commercial_engine_gate(text, text, text, text, text)
to authenticated;
grant execute on function
  commercial_engine.get_policy(uuid, text, text)
to crm_commercial_engine;
grant execute on function
  commercial_engine.record_execution(
    uuid,
    text,
    text,
    text,
    uuid,
    text,
    text,
    integer
  )
to crm_commercial_engine;

create or replace function private.crm_commercial_engine_role_isolated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_roles role
    where role.rolname = 'crm_commercial_engine'
      and not role.rolsuper
      and not role.rolcreatedb
      and not role.rolcreaterole
      and not role.rolinherit
      and not role.rolreplication
      and not role.rolbypassrls
      and role.rolconnlimit = 2
  )
  and pg_catalog.current_database() = 'postgres'
  and not has_schema_privilege('crm_commercial_engine', 'net', 'USAGE')
  and exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'commercial_engine'
      and pg_catalog.pg_get_userbyid(namespace.nspowner) = 'postgres'
  )
  and not exists (
    select 1
    from pg_catalog.pg_namespace namespace
    cross join lateral pg_catalog.aclexplode(namespace.nspacl) acl
    where namespace.nspname = 'commercial_engine'
      and (
        acl.grantee not in (
          (select role.oid from pg_catalog.pg_roles role
           where role.rolname = 'postgres'),
          (select role.oid from pg_catalog.pg_roles role
           where role.rolname = 'crm_commercial_engine')
        )
        or (
          acl.grantee = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_commercial_engine'
          )
          and (acl.privilege_type <> 'USAGE' or acl.is_grantable)
        )
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_database database_row
    where has_database_privilege(
      'crm_commercial_engine', database_row.oid, 'CREATE'
    )
      or has_database_privilege(
        'crm_commercial_engine', database_row.oid, 'TEMP'
      )
      or (
        database_row.datallowconn
        and database_row.datname <> 'postgres'
        and has_database_privilege(
          'crm_commercial_engine', database_row.oid, 'CONNECT'
        )
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_commercial_engine'
    )
      or (
        membership.roleid = (
          select role.oid from pg_catalog.pg_roles role
          where role.rolname = 'crm_commercial_engine'
        )
        and (
          membership.member <> (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'postgres'
          )
          or membership.inherit_option
          or membership.set_option
        )
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname not in (
        'pg_catalog', 'information_schema', 'public', 'commercial_engine'
      )
      and namespace.nspname !~ '^pg_(toast|temp)_'
      and has_schema_privilege(
        'crm_commercial_engine', namespace.oid, 'USAGE'
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname not in ('pg_catalog', 'information_schema')
      and namespace.nspname !~ '^pg_(toast|temp)_'
      and has_schema_privilege(
        'crm_commercial_engine', namespace.oid, 'CREATE'
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace
      on namespace.oid = class.relnamespace
    where class.relkind in ('r', 'p', 'v', 'm', 'f')
      and namespace.nspname not in ('pg_catalog', 'information_schema')
      and has_schema_privilege(
        'crm_commercial_engine', namespace.oid, 'USAGE'
      )
      and (
        has_table_privilege('crm_commercial_engine', class.oid, 'SELECT')
        or has_table_privilege('crm_commercial_engine', class.oid, 'INSERT')
        or has_table_privilege('crm_commercial_engine', class.oid, 'UPDATE')
        or has_table_privilege('crm_commercial_engine', class.oid, 'DELETE')
        or has_table_privilege('crm_commercial_engine', class.oid, 'TRUNCATE')
        or has_table_privilege('crm_commercial_engine', class.oid, 'REFERENCES')
        or has_table_privilege('crm_commercial_engine', class.oid, 'TRIGGER')
        or has_table_privilege('crm_commercial_engine', class.oid, 'MAINTAIN')
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace
      on namespace.oid = class.relnamespace
    where class.relkind = 'S'
      and namespace.nspname not in ('pg_catalog', 'information_schema')
      and has_schema_privilege(
        'crm_commercial_engine', namespace.oid, 'USAGE'
      )
      and (
        has_sequence_privilege('crm_commercial_engine', class.oid, 'USAGE')
        or has_sequence_privilege('crm_commercial_engine', class.oid, 'SELECT')
        or has_sequence_privilege('crm_commercial_engine', class.oid, 'UPDATE')
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_row.pronamespace
    where namespace.nspname not in ('pg_catalog', 'information_schema')
      and has_schema_privilege(
        'crm_commercial_engine', namespace.oid, 'USAGE'
      )
      and has_function_privilege(
        'crm_commercial_engine', function_row.oid, 'EXECUTE'
      )
      and not (
        namespace.nspname = 'commercial_engine'
        and (
          (
            function_row.proname = 'get_policy'
            and pg_catalog.pg_get_function_identity_arguments(function_row.oid) =
              'p_actor_user_id uuid, p_engine_key text, p_requested_mode text'
          )
          or (
            function_row.proname = 'record_execution'
            and pg_catalog.pg_get_function_identity_arguments(function_row.oid) =
              'p_actor_user_id uuid, p_engine_key text, p_mode text, p_policy_hash text, p_request_id uuid, p_input_hash text, p_output_hash text, p_duration_ms integer'
          )
        )
        and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
        and function_row.prosecdef
        and coalesce(function_row.proconfig, array[]::text[]) @>
          array['search_path=""', 'statement_timeout=10s']::text[]
        and cardinality(coalesce(function_row.proconfig, array[]::text[])) = 2
      )
  )
  and (
    select count(*)
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'commercial_engine'
      and has_function_privilege(
        'crm_commercial_engine', function_row.oid, 'EXECUTE'
      )
  ) = 2
  and not exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_row.pronamespace
    cross join lateral pg_catalog.aclexplode(coalesce(
      function_row.proacl,
      pg_catalog.acldefault('f', function_row.proowner)
    )) acl
    where namespace.nspname = 'commercial_engine'
      and (
        acl.grantee not in (
          (select role.oid from pg_catalog.pg_roles role
           where role.rolname = 'postgres'),
          (select role.oid from pg_catalog.pg_roles role
           where role.rolname = 'crm_commercial_engine')
        )
        or (
          acl.grantee = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_commercial_engine'
          )
          and (acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
        )
      )
  );
$$;

alter function private.crm_commercial_engine_role_isolated() owner to postgres;
revoke all privileges on function private.crm_commercial_engine_role_isolated()
from public, anon, authenticated, service_role, crm_qlik_relay,
  crm_commercial_engine;

comment on table private.crm_commercial_engine_catalog is
  'Structural commercial engine keys only; contains no commercial rule or value.';
comment on table private.crm_commercial_policy_versions is
  'Immutable approved policy documents. Every row requires owners, evidence and one or more golden cases.';
comment on table private.crm_commercial_policy_imports is
  'Append-only idempotency ledger for preview/apply policy imports.';
comment on table private.crm_commercial_engine_gates is
  'Database half of the two-key runtime gate. Absence, disabled and rolled_back deny execution.';
comment on table private.crm_commercial_engine_executions is
  'Hashes-only runtime evidence. Raw commercial inputs and outputs are never persisted here.';
comment on function public.preview_crm_commercial_policy_import(jsonb) is
  'Master-only deterministic dry-run. It validates governance and reports conflicts without mutation.';
comment on function public.apply_crm_commercial_policy_import(jsonb, text) is
  'Master-only idempotent import bound to a previously reviewed deterministic plan hash.';
comment on function public.set_crm_commercial_engine_gate(text, text, text, text, text) is
  'Master-only gate transition. Active requires a prior shadow state on the same approved policy.';
comment on function commercial_engine.get_policy(uuid, text, text) is
  'Server-only policy lookup for one previously authenticated actor with the engine permission.';
comment on function commercial_engine.record_execution(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  integer
) is
  'Server-only idempotent hashes-only execution evidence for a previously authenticated actor.';
