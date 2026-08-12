-- Stage the local Qlik contract convergence without exposing ranking data.
--
-- IMPORTANT: this migration must not be applied remotely until the active
-- anonymous caller of publish_crm_imob_ranking(jsonb, text) has been migrated
-- to a CRM-owned server-side relay. External n8n may hold only a dedicated,
-- limited M2M credential for that relay; service_role/secret credentials must
-- never enter n8n, its nodes, exports, logs, or process arguments. Only the
-- internal relay may hold service_role server-side and invoke the single RPC.
-- The relay/gateway must reject raw HTTP bodies above 8 MiB before JSON
-- parsing; pg_column_size below is database defense in depth after parsing.
-- Applying this migration earlier intentionally fails the legacy integration
-- closed.

alter table public.crm_imob_ranking_runs
  add column if not exists development_row_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraints
    where constraints.conrelid = 'public.crm_imob_ranking_runs'::regclass
      and constraints.conname = 'crm_imob_ranking_runs_development_row_count_check'
  ) then
    alter table public.crm_imob_ranking_runs
      add constraint crm_imob_ranking_runs_development_row_count_check
      check (development_row_count >= 0);
  end if;
end;
$$;

create table if not exists public.crm_imob_ranking_developments (
  run_id uuid not null,
  period_month date not null,
  business_unit text not null,
  development_key text not null,
  development_name text not null,
  vgv numeric not null default 0,
  contracts integer not null default 0,
  source_rank_vgv integer,
  source_rank_contracts integer,
  created_at timestamptz not null default now(),
  constraint crm_imob_ranking_developments_pkey
    primary key (run_id, period_month, business_unit, development_key),
  constraint crm_imob_ranking_developments_run_id_fkey
    foreign key (run_id)
    references public.crm_imob_ranking_runs(id)
    on delete cascade,
  constraint crm_imob_ranking_developments_period_month_check
    check (
      period_month = date_trunc(
        'month',
        period_month::timestamp without time zone
      )::date
    ),
  constraint crm_imob_ranking_developments_business_unit_check
    check (btrim(business_unit) <> ''),
  constraint crm_imob_ranking_developments_development_key_check
    check (development_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_imob_ranking_developments_development_name_check
    check (btrim(development_name) <> ''),
  constraint crm_imob_ranking_developments_vgv_check
    check (vgv >= 0),
  constraint crm_imob_ranking_developments_contracts_check
    check (contracts >= 0),
  constraint crm_imob_ranking_developments_source_rank_vgv_check
    check (source_rank_vgv is null or source_rank_vgv > 0),
  constraint crm_imob_ranking_developments_source_rank_contracts_check
    check (source_rank_contracts is null or source_rank_contracts > 0)
);

-- The remote-only migration created this check through a timezone-dependent
-- implicit date cast. Recreate it deterministically without changing rows.
alter table public.crm_imob_ranking_developments
  drop constraint if exists crm_imob_ranking_developments_period_month_check;
alter table public.crm_imob_ranking_developments
  add constraint crm_imob_ranking_developments_period_month_check
  check (
    period_month = date_trunc(
      'month',
      period_month::timestamp without time zone
    )::date
  );

create index if not exists crm_imob_ranking_developments_month_vgv_idx
  on public.crm_imob_ranking_developments (
    run_id,
    period_month,
    business_unit,
    vgv desc
  );

create index if not exists crm_imob_ranking_developments_month_contracts_idx
  on public.crm_imob_ranking_developments (
    run_id,
    period_month,
    business_unit,
    contracts desc
  );

create index if not exists crm_imob_ranking_entries_imob_key_run_idx
  on public.crm_imob_ranking_entries (imob_key, run_id, period_month);

alter table public.crm_imob_ranking_developments owner to postgres;

comment on table public.crm_imob_ranking_developments is
  'Monthly development ranking rows from the same Qlik run and filters as the IMOB ranking.';
comment on column public.crm_imob_ranking_runs.development_row_count is
  'Number of validated development rows stored for the Qlik run.';

alter table public.crm_imob_ranking_runs enable row level security;
alter table public.crm_imob_ranking_runs force row level security;
alter table public.crm_imob_ranking_entries enable row level security;
alter table public.crm_imob_ranking_entries force row level security;
alter table public.crm_imob_ranking_developments enable row level security;
alter table public.crm_imob_ranking_developments force row level security;

-- No direct-table scoped read contract exists. Remove SELECT and ALL policies
-- rather than treating authentication alone as row-level authorization; the
-- scoped RPC below becomes the only authenticated read path.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policies.tablename, policies.policyname
    from pg_catalog.pg_policies policies
    where policies.schemaname = 'public'
      and policies.tablename in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and policies.cmd in ('SELECT', 'ALL')
  loop
    execute pg_catalog.format(
      'drop policy %I on public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  end loop;
end;
$$;

revoke all privileges on table
  public.crm_imob_ranking_runs,
  public.crm_imob_ranking_entries,
  public.crm_imob_ranking_developments
from public, anon, authenticated, service_role;

-- Reading partnership facts requires both a dedicated permission and an
-- organization mapping enforced by the reporting-scope foundation. Only
-- Master receives the new permission automatically; all other access needs an
-- explicit, audited permission grant and an active scope grant.
insert into public.permissions (key, description, min_level)
values (
  'crm.partnerships.view',
  'View organization-scoped Qlik partnership ranking facts',
  10
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.partnerships.view')
on conflict (role_key, permission_key) do nothing;

update public.app_pages
set permission_key = 'crm.partnerships.view'
where key = 'crm.partnerships';

-- Remove the legacy token-in-argument SECURITY DEFINER endpoint. DROP without
-- CASCADE intentionally blocks if an undeclared database dependency exists.
do $$
begin
  if pg_catalog.to_regprocedure(
    'public.publish_crm_imob_ranking(jsonb,text)'
  ) is not null then
    execute 'revoke all privileges on function public.publish_crm_imob_ranking(jsonb, text) from public, anon, authenticated, service_role';
    execute 'drop function public.publish_crm_imob_ranking(jsonb, text)';
  end if;
end;
$$;

-- Preserve schemaVersion 1 for existing safe callers. `developments` is an
-- optional, backward-compatible array; omitted means zero development rows.
-- The function validates and stores supplied facts without deriving commercial
-- totals, ranks, formulas, or other business rules.
create or replace function public.ingest_crm_imob_ranking_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_entries jsonb := p_payload->'entries';
  v_developments jsonb := coalesce(
    p_payload->'developments',
    '[]'::jsonb
  );
  v_run_id uuid;
  v_reference_year smallint;
  v_generated_at timestamptz;
  v_source_updated_at timestamptz;
  v_entry_count integer;
  v_development_count integer;
  v_existing public.crm_imob_ranking_runs%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) is distinct from 'object'
     or pg_column_size(p_payload) > 8 * 1024 * 1024
     or p_payload->>'schemaVersion' is distinct from '1'
     or jsonb_typeof(v_entries) is distinct from 'array'
     or jsonb_array_length(v_entries) < 1
     or jsonb_array_length(v_entries) > 5000
     or jsonb_typeof(v_developments) is distinct from 'array'
     or jsonb_array_length(v_developments) > 5000 then
    raise exception 'invalid Qlik ingestion envelope' using errcode = '22023';
  end if;

  begin
    v_run_id := (p_payload->>'requestId')::uuid;
    v_reference_year := (p_payload->>'referenceYear')::smallint;
    v_generated_at := (p_payload->>'generatedAt')::timestamptz;
    v_source_updated_at := coalesce(
      (p_payload->>'sourceUpdatedAt')::timestamptz,
      v_generated_at
    );
  exception when others then
    raise exception 'invalid Qlik ingestion metadata' using errcode = '22023';
  end;

  if v_run_id is null
     or v_reference_year is null
     or v_generated_at is null
     or v_source_updated_at is null
     or v_reference_year not between 2020 and 2100
     or v_generated_at > now() + interval '5 minutes'
     or v_source_updated_at > now() + interval '5 minutes' then
    raise exception 'invalid Qlik ingestion metadata' using errcode = '22023';
  end if;

  begin
    if exists (
      select 1
      from jsonb_to_recordset(v_entries) as entry(
        "periodMonth" date,
        "imobKey" text,
        "imobName" text,
        vgv numeric,
        contracts integer,
        "sourceRankVgv" integer,
        "sourceRankContracts" integer
      )
      where entry."periodMonth" is null
         or extract(year from entry."periodMonth")::smallint <> v_reference_year
         or entry."periodMonth" <> date_trunc(
           'month',
           entry."periodMonth"::timestamp without time zone
         )::date
         or entry."imobKey" is null
         or char_length(entry."imobKey") > 128
         or entry."imobKey" !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
         or btrim(coalesce(entry."imobName", '')) = ''
         or char_length(entry."imobName") > 256
         or entry.vgv is null
         or entry.vgv < 0
         or entry.vgv > 9999999999999999.99::numeric
         or scale(entry.vgv) > 2
         or entry.contracts is null
         or entry.contracts < 0
         or (entry."sourceRankVgv" is not null and entry."sourceRankVgv" < 1)
         or (
           entry."sourceRankContracts" is not null
           and entry."sourceRankContracts" < 1
         )
    ) then
      raise exception 'invalid Qlik ranking entry' using errcode = '22023';
    end if;
  exception
    when sqlstate '22023' then
      raise;
    when others then
      raise exception 'invalid Qlik ranking entry' using errcode = '22023';
  end;

  begin
    if exists (
      select 1
      from jsonb_to_recordset(v_developments) as development(
        "periodMonth" date,
        "businessUnit" text,
        "developmentKey" text,
        "developmentName" text,
        vgv numeric,
        contracts integer,
        "sourceRankVgv" integer,
        "sourceRankContracts" integer
      )
      where development."periodMonth" is null
         or extract(year from development."periodMonth")::smallint
            <> v_reference_year
         or development."periodMonth" <> date_trunc(
           'month',
           development."periodMonth"::timestamp without time zone
         )::date
         or btrim(coalesce(development."businessUnit", '')) = ''
         or char_length(development."businessUnit") > 128
         or octet_length(development."businessUnit") > 512
         or development."developmentKey" is null
         or char_length(development."developmentKey") > 128
         or development."developmentKey"
            !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
         or btrim(coalesce(development."developmentName", '')) = ''
         or char_length(development."developmentName") > 256
         or development.vgv is null
         or development.vgv < 0
         or development.vgv > 9999999999999999.99::numeric
         or scale(development.vgv) > 2
         or development.contracts is null
         or development.contracts < 0
         or (
           development."sourceRankVgv" is not null
           and development."sourceRankVgv" < 1
         )
         or (
           development."sourceRankContracts" is not null
           and development."sourceRankContracts" < 1
         )
    ) then
      raise exception 'invalid Qlik development entry' using errcode = '22023';
    end if;
  exception
    when sqlstate '22023' then
      raise;
    when others then
      raise exception 'invalid Qlik development entry' using errcode = '22023';
  end;

  v_entry_count := jsonb_array_length(v_entries);
  v_development_count := jsonb_array_length(v_developments);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_run_id::text, 20260807)
  );

  select * into v_existing
  from public.crm_imob_ranking_runs
  where id = v_run_id;

  if found then
    if v_existing.status = 'succeeded'
       and v_existing.reference_year = v_reference_year
       and v_existing.generated_at = v_generated_at
       and v_existing.source_updated_at is not distinct from v_source_updated_at
       and v_existing.source = 'qlik'
       and v_existing.regional = 'SP CAPITAL'
       and v_existing.company = 'Direcional'
       and v_existing.row_count = v_entry_count
       and v_existing.development_row_count = v_development_count
       and (
         select count(*)
         from public.crm_imob_ranking_entries stored
         where stored.run_id = v_run_id
       ) = v_entry_count
       and (
         select count(*)
         from public.crm_imob_ranking_developments stored
         where stored.run_id = v_run_id
       ) = v_development_count
       and not exists (
         (
           select
             stored.period_month,
             stored.imob_key,
             stored.imob_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_entries stored
           where stored.run_id = v_run_id
           except
           select
             incoming."periodMonth",
             incoming."imobKey",
             incoming."imobName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_entries) as incoming(
             "periodMonth" date,
             "imobKey" text,
             "imobName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
         )
         union all
         (
           select
             incoming."periodMonth",
             incoming."imobKey",
             incoming."imobName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_entries) as incoming(
             "periodMonth" date,
             "imobKey" text,
             "imobName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
           except
           select
             stored.period_month,
             stored.imob_key,
             stored.imob_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_entries stored
           where stored.run_id = v_run_id
         )
       )
       and not exists (
         (
           select
             stored.period_month,
             stored.business_unit,
             stored.development_key,
             stored.development_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_developments stored
           where stored.run_id = v_run_id
           except
           select
             incoming."periodMonth",
             incoming."businessUnit",
             incoming."developmentKey",
             incoming."developmentName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_developments) as incoming(
             "periodMonth" date,
             "businessUnit" text,
             "developmentKey" text,
             "developmentName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
         )
         union all
         (
           select
             incoming."periodMonth",
             incoming."businessUnit",
             incoming."developmentKey",
             incoming."developmentName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_developments) as incoming(
             "periodMonth" date,
             "businessUnit" text,
             "developmentKey" text,
             "developmentName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
           except
           select
             stored.period_month,
             stored.business_unit,
             stored.development_key,
             stored.development_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_developments stored
           where stored.run_id = v_run_id
         )
       ) then
      return jsonb_build_object(
        'ok', true,
        'status', 'succeeded',
        'runId', v_run_id,
        'recordCount', v_entry_count,
        'developmentRecordCount', v_development_count,
        'idempotent', true
      );
    end if;

    raise exception 'Qlik request ID conflict' using errcode = '23505';
  end if;

  insert into public.crm_imob_ranking_runs (
    id,
    status,
    reference_year,
    generated_at,
    source_updated_at,
    source,
    regional,
    company,
    row_count,
    development_row_count,
    started_at
  ) values (
    v_run_id,
    'running',
    v_reference_year,
    v_generated_at,
    v_source_updated_at,
    'qlik',
    'SP CAPITAL',
    'Direcional',
    v_entry_count,
    v_development_count,
    now()
  );

  insert into public.crm_imob_ranking_entries (
    run_id,
    period_month,
    imob_key,
    imob_name,
    vgv,
    contracts,
    source_rank_vgv,
    source_rank_contracts
  )
  select
    v_run_id,
    entry."periodMonth",
    entry."imobKey",
    entry."imobName",
    entry.vgv,
    entry.contracts,
    entry."sourceRankVgv",
    entry."sourceRankContracts"
  from jsonb_to_recordset(v_entries) as entry(
    "periodMonth" date,
    "imobKey" text,
    "imobName" text,
    vgv numeric,
    contracts integer,
    "sourceRankVgv" integer,
    "sourceRankContracts" integer
  );

  insert into public.crm_imob_ranking_developments (
    run_id,
    period_month,
    business_unit,
    development_key,
    development_name,
    vgv,
    contracts,
    source_rank_vgv,
    source_rank_contracts
  )
  select
    v_run_id,
    development."periodMonth",
    development."businessUnit",
    development."developmentKey",
    development."developmentName",
    development.vgv,
    development.contracts,
    development."sourceRankVgv",
    development."sourceRankContracts"
  from jsonb_to_recordset(v_developments) as development(
    "periodMonth" date,
    "businessUnit" text,
    "developmentKey" text,
    "developmentName" text,
    vgv numeric,
    contracts integer,
    "sourceRankVgv" integer,
    "sourceRankContracts" integer
  );

  update public.crm_imob_ranking_runs
  set status = 'succeeded', completed_at = now()
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'succeeded',
    'runId', v_run_id,
    'recordCount', v_entry_count,
    'developmentRecordCount', v_development_count,
    'idempotent', false
  );
end;
$$;

alter function public.ingest_crm_imob_ranking_snapshot(jsonb)
  owner to postgres;

comment on function public.ingest_crm_imob_ranking_snapshot(jsonb) is
  'Atomically stores one validated Qlik ranking snapshot for the CRM-owned server-side relay; service_role must never be delegated to the external n8n caller.';

revoke all privileges on function public.ingest_crm_imob_ranking_snapshot(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_crm_imob_ranking_snapshot(jsonb)
  to service_role;

create or replace function public.list_scoped_crm_imob_ranking_entries(
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  organization_id uuid,
  run_id uuid,
  reference_year smallint,
  generated_at timestamptz,
  source_updated_at timestamptz,
  period_month date,
  imob_key text,
  imob_name text,
  vgv numeric(18, 2),
  contracts integer,
  source_rank_vgv integer,
  source_rank_contracts integer
)
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
begin
  if p_limit is null
     or p_limit < 1
     or p_limit > 500
     or p_offset is null
     or p_offset < 0
     or p_offset > 50000 then
    raise exception 'invalid Qlik read pagination' using errcode = '22023';
  end if;

  if not public.has_permission(
    (select auth.uid()),
    'crm.partnerships.view'
  ) then
    return;
  end if;

  return query
  select
    source_identity.organization_id,
    entry.run_id,
    run.reference_year,
    run.generated_at,
    run.source_updated_at,
    entry.period_month,
    entry.imob_key,
    entry.imob_name,
    entry.vgv,
    entry.contracts,
    entry.source_rank_vgv,
    entry.source_rank_contracts
  from public.crm_imob_ranking_entries entry
  join public.crm_source_identities source_identity
    on source_identity.source = 'qlik'
   and source_identity.entity_kind = 'organization'
   and source_identity.external_id = entry.imob_key
   and source_identity.organization_id is not null
  join public.crm_imob_ranking_runs run on run.id = entry.run_id
  where run.status = 'succeeded'
    and private.can_read_organization(source_identity.organization_id)
  order by
    run.generated_at desc,
    entry.period_month desc,
    entry.source_rank_vgv asc nulls last,
    entry.imob_key asc
  limit p_limit
  offset p_offset;
end;
$$;

alter function public.list_scoped_crm_imob_ranking_entries(integer, integer)
  owner to postgres;

comment on function public.list_scoped_crm_imob_ranking_entries(integer, integer) is
  'Returns only succeeded Qlik partner rows mapped to organizations inside the approved caller reporting scope; unmapped rows remain unavailable.';

revoke all privileges on function
  public.list_scoped_crm_imob_ranking_entries(integer, integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.list_scoped_crm_imob_ranking_entries(integer, integer)
to authenticated;

-- Qlik run totals span organizations, while development rows have no approved
-- organization identity. Neither receives a read RPC until a source-backed,
-- scope-enforceable mapping exists.

notify pgrst, 'reload schema';
