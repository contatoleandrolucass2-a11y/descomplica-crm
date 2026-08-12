-- Canonical read model v3.
-- Facts are immutable, integrations write only through a bounded RPC, and
-- browser reads require both a dedicated permission and explicit scope.

set lock_timeout = '5s';
set statement_timeout = '60s';

insert into public.permissions (key, description, min_level)
values (
  'crm.read_model_v3.view',
  'View canonical CRM v3 facts through explicitly scoped RPCs',
  10
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

insert into public.permissions (key, description, min_level)
values
  (
    'crm.read_model_v3.ranking.view',
    'View only the canonical CRM v3 ranking dataset',
    10
  ),
  (
    'crm.read_model_v3.partnerships.view',
    'View only the canonical CRM v3 partnerships dataset',
    10
  ),
  (
    'crm.read_model_v3.stock.view',
    'View only the canonical CRM v3 stock dataset',
    10
  )
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

create table if not exists private.crm_read_model_v3_sources (
  dataset_key text not null,
  source_key text not null,
  workflow_key text not null,
  producer_key text not null,
  owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  is_active boolean not null default false,
  require_complete_coverage boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dataset_key, source_key, workflow_key, producer_key),
  constraint crm_read_model_v3_sources_dataset_check
    check (dataset_key in ('funnel', 'ranking', 'partnerships', 'stock')),
  constraint crm_read_model_v3_sources_key_check check (
    source_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and workflow_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and producer_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and length(source_key) <= 100
    and length(workflow_key) <= 100
    and length(producer_key) <= 100
  ),
  constraint crm_read_model_v3_sources_approval_check check (
    not is_active
    or (
      approved_at is not null
      and approved_by is not null
      and nullif(btrim(coalesce(evidence_reference, '')), '') is not null
    )
  )
);

create unique index if not exists crm_read_model_v3_sources_active_dataset_unique
  on private.crm_read_model_v3_sources (dataset_key)
  where is_active;

create table if not exists public.crm_read_model_v3_runs (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 3,
  request_id uuid not null unique,
  payload_hash text not null,
  dataset_key text not null,
  source_key text not null,
  workflow_key text not null,
  producer_key text not null,
  source_snapshot_id text not null,
  reference_date date not null,
  timezone text not null,
  generated_at timestamptz not null,
  source_updated_at timestamptz,
  coverage_start date,
  coverage_end date,
  coverage_status text not null,
  source_status text not null,
  status_reason text,
  quality_status text not null,
  quality_issues text[] not null default '{}',
  available_measures text[] not null default '{}',
  publication_status text not null,
  rejection_reason text,
  record_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dataset_key, source_key, source_snapshot_id),
  constraint crm_read_model_v3_runs_schema_check check (schema_version = 3),
  constraint crm_read_model_v3_runs_hash_check check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint crm_read_model_v3_runs_dataset_check
    check (dataset_key in ('funnel', 'ranking', 'partnerships', 'stock')),
  constraint crm_read_model_v3_runs_key_check check (
    source_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and workflow_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and producer_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and length(source_key) <= 100
    and length(workflow_key) <= 100
    and length(producer_key) <= 100
  ),
  constraint crm_read_model_v3_runs_snapshot_check
    check (nullif(btrim(source_snapshot_id), '') is not null),
  constraint crm_read_model_v3_runs_temporal_values_check check (
    pg_catalog.isfinite(reference_date)
    and pg_catalog.isfinite(generated_at)
    and (source_updated_at is null or pg_catalog.isfinite(source_updated_at))
    and (coverage_start is null or pg_catalog.isfinite(coverage_start))
    and (coverage_end is null or pg_catalog.isfinite(coverage_end))
  ),
  constraint crm_read_model_v3_runs_coverage_check check (
    coverage_status in ('complete', 'partial', 'unknown')
    and (
      (coverage_start is null and coverage_end is null and coverage_status = 'unknown')
      or
      (coverage_start is not null and coverage_end is not null
        and coverage_end >= coverage_start)
    )
  ),
  constraint crm_read_model_v3_runs_source_status_check
    check (source_status in ('ready', 'stale', 'unavailable', 'error')),
  constraint crm_read_model_v3_runs_status_reason_check check (
    (
      status_reason is null
      or (
        status_reason ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
        and length(status_reason) <= 100
      )
    )
    and (
      (source_status = 'ready' and status_reason is null)
      or
      (source_status <> 'ready' and status_reason is not null)
    )
  ),
  constraint crm_read_model_v3_runs_quality_check
    check (quality_status in ('verified', 'warning', 'blocked')),
  constraint crm_read_model_v3_runs_measure_check
    check (available_measures <@ array['counts', 'sales_amount']::text[]),
  constraint crm_read_model_v3_runs_publication_check check (
    (publication_status = 'published' and published_at is not null
      and rejection_reason is null and quality_status <> 'blocked')
    or
    (publication_status = 'rejected' and published_at is null
      and nullif(btrim(coalesce(rejection_reason, '')), '') is not null)
  ),
  constraint crm_read_model_v3_runs_record_count_check check (record_count >= 0),
  constraint crm_read_model_v3_runs_unavailable_records_check check (
    source_status not in ('unavailable', 'error') or record_count = 0
  )
);

create index if not exists crm_read_model_v3_runs_dataset_published_idx
  on public.crm_read_model_v3_runs
    (dataset_key, published_at desc, id)
  where publication_status = 'published';
create index if not exists crm_read_model_v3_runs_source_generated_idx
  on public.crm_read_model_v3_runs
    (source_key, generated_at desc, id);

create table if not exists public.crm_read_model_v3_events (
  run_id uuid not null
    references public.crm_read_model_v3_runs(id) on delete restrict,
  stage_key text not null,
  source_record_id text not null,
  occurred_at timestamptz not null,
  commercial_date date not null,
  amount numeric(18, 2),
  reporting_scope_id uuid not null
    references public.crm_reporting_scopes(id) on delete restrict,
  reporting_scope_identity_id uuid not null
    references public.crm_source_identities(id) on delete restrict,
  organization_id uuid not null
    references public.crm_organizations(id) on delete restrict,
  organization_identity_id uuid not null
    references public.crm_source_identities(id) on delete restrict,
  team_id uuid references public.crm_teams(id) on delete restrict,
  team_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  portfolio_id uuid references public.crm_portfolios(id) on delete restrict,
  portfolio_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  coordinator_id uuid references public.crm_people(id) on delete restrict,
  coordinator_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  manager_id uuid references public.crm_people(id) on delete restrict,
  manager_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  broker_id uuid references public.crm_people(id) on delete restrict,
  broker_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  origin_id uuid references public.crm_origins(id) on delete restrict,
  origin_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  development_id uuid references public.crm_developments(id) on delete restrict,
  development_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  location_id uuid references public.crm_locations(id) on delete restrict,
  location_identity_id uuid references public.crm_source_identities(id) on delete restrict,
  record_hash text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, stage_key, source_record_id),
  constraint crm_read_model_v3_events_stage_check check (
    stage_key in ('opportunities', 'appointments', 'visits', 'folders', 'sales')
  ),
  constraint crm_read_model_v3_events_source_record_check
    check (nullif(btrim(source_record_id), '') is not null),
  constraint crm_read_model_v3_events_temporal_values_check check (
    pg_catalog.isfinite(occurred_at) and pg_catalog.isfinite(commercial_date)
  ),
  constraint crm_read_model_v3_events_amount_check check (
    amount is null
    or (amount >= 0 and amount::text ~ '^[0-9]{1,16}[.][0-9]{2}$')
  ),
  constraint crm_read_model_v3_events_record_hash_check
    check (record_hash ~ '^[0-9a-f]{64}$'),
  constraint crm_read_model_v3_events_team_identity_check
    check ((team_id is null) = (team_identity_id is null)),
  constraint crm_read_model_v3_events_portfolio_identity_check
    check ((portfolio_id is null) = (portfolio_identity_id is null)),
  constraint crm_read_model_v3_events_coordinator_identity_check
    check ((coordinator_id is null) = (coordinator_identity_id is null)),
  constraint crm_read_model_v3_events_manager_identity_check
    check ((manager_id is null) = (manager_identity_id is null)),
  constraint crm_read_model_v3_events_broker_identity_check
    check ((broker_id is null) = (broker_identity_id is null)),
  constraint crm_read_model_v3_events_origin_identity_check
    check ((origin_id is null) = (origin_identity_id is null)),
  constraint crm_read_model_v3_events_development_identity_check
    check ((development_id is null) = (development_identity_id is null)),
  constraint crm_read_model_v3_events_location_identity_check
    check ((location_id is null) = (location_identity_id is null))
);

create index if not exists crm_read_model_v3_events_scope_date_stage_idx
  on public.crm_read_model_v3_events
    (reporting_scope_id, commercial_date, stage_key, run_id);
create index if not exists crm_read_model_v3_events_run_date_stage_idx
  on public.crm_read_model_v3_events
    (run_id, commercial_date, stage_key);
create index if not exists crm_read_model_v3_events_run_org_team_idx
  on public.crm_read_model_v3_events
    (run_id, organization_id, team_id, commercial_date);
create index if not exists crm_read_model_v3_events_run_portfolio_idx
  on public.crm_read_model_v3_events
    (run_id, portfolio_id, commercial_date)
  where portfolio_id is not null;
create index if not exists crm_read_model_v3_events_run_people_idx
  on public.crm_read_model_v3_events
    (run_id, manager_id, broker_id, commercial_date);
create index if not exists crm_read_model_v3_events_run_commercial_dims_idx
  on public.crm_read_model_v3_events
    (run_id, origin_id, development_id, location_id, commercial_date);

create table if not exists public.crm_read_model_v3_scope_coverage (
  run_id uuid not null
    references public.crm_read_model_v3_runs(id) on delete restrict,
  reporting_scope_id uuid not null
    references public.crm_reporting_scopes(id) on delete restrict,
  reporting_scope_identity_id uuid not null
    references public.crm_source_identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (run_id, reporting_scope_id),
  unique (run_id, reporting_scope_identity_id)
);

create index if not exists crm_read_model_v3_scope_coverage_scope_run_idx
  on public.crm_read_model_v3_scope_coverage (reporting_scope_id, run_id);

create table if not exists public.crm_read_model_v3_closed_months (
  run_id uuid not null
    references public.crm_read_model_v3_runs(id) on delete restrict,
  month_start date not null,
  source_watermark timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (run_id, month_start),
  constraint crm_read_model_v3_closed_months_first_day_check
    check (
      pg_catalog.isfinite(month_start)
      and month_start = date_trunc('month', month_start)::date
    ),
  constraint crm_read_model_v3_closed_months_watermark_check
    check (pg_catalog.isfinite(source_watermark))
);

create index if not exists crm_read_model_v3_closed_months_run_idx
  on public.crm_read_model_v3_closed_months (run_id, month_start desc);

create table if not exists public.crm_read_model_v3_active_runs (
  dataset_key text primary key,
  run_id uuid not null unique
    references public.crm_read_model_v3_runs(id) on delete restrict,
  activated_at timestamptz not null default now(),
  constraint crm_read_model_v3_active_runs_dataset_check
    check (dataset_key in ('funnel', 'ranking', 'partnerships', 'stock'))
);

create or replace function private.prevent_crm_read_model_v3_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'conflict: published read-model records are immutable'
    using errcode = '55000';
end;
$$;

create trigger crm_read_model_v3_runs_immutable
  before update or delete on public.crm_read_model_v3_runs
  for each row execute function private.prevent_crm_read_model_v3_mutation();
create trigger crm_read_model_v3_events_immutable
  before update or delete on public.crm_read_model_v3_events
  for each row execute function private.prevent_crm_read_model_v3_mutation();
create trigger crm_read_model_v3_scope_coverage_immutable
  before update or delete on public.crm_read_model_v3_scope_coverage
  for each row execute function private.prevent_crm_read_model_v3_mutation();
create trigger crm_read_model_v3_closed_months_immutable
  before update or delete on public.crm_read_model_v3_closed_months
  for each row execute function private.prevent_crm_read_model_v3_mutation();

create or replace function private.resolve_verified_source_identity(
  p_source text,
  p_entity_kind text,
  p_external_id text,
  p_at timestamptz
)
returns public.crm_source_identities
language sql
volatile
security definer
set search_path = ''
as $$
  select identity.*
  from public.crm_source_identities identity
  join private.crm_integration_owners owner
    on owner.id = identity.mapping_owner_id and owner.is_active
  where identity.source = p_source
    and identity.entity_kind = p_entity_kind
    and identity.external_id = p_external_id
    and identity.mapping_status = 'verified'
    and identity.valid_from <= p_at
    and (identity.valid_until is null or identity.valid_until > p_at)
    and case identity.entity_kind
      when 'person' then exists (
        select 1 from public.crm_people target
        where target.id = identity.person_id and target.is_active
      )
      when 'organization' then exists (
        select 1 from public.crm_organizations target
        where target.id = identity.organization_id and target.is_active
      )
      when 'team' then exists (
        select 1 from public.crm_teams target
        where target.id = identity.team_id and target.is_active
      )
      when 'portfolio' then exists (
        select 1 from public.crm_portfolios target
        where target.id = identity.portfolio_id and target.is_active
      )
      when 'reporting_scope' then exists (
        select 1 from public.crm_reporting_scopes target
        where target.id = identity.reporting_scope_id and target.is_active
      )
      when 'origin' then exists (
        select 1 from public.crm_origins target
        where target.id = identity.origin_id and target.is_active
      )
      when 'development' then exists (
        select 1 from public.crm_developments target
        where target.id = identity.development_id and target.is_active
      )
      when 'location' then exists (
        select 1 from public.crm_locations target
        where target.id = identity.location_id and target.is_active
      )
      else false
    end
  order by identity.valid_from desc, identity.id
  limit 1;
$$;

create or replace function private.can_read_crm_read_model_v3_scope(p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_scope_id is not null
    and private.user_has_valid_role_scope((select auth.uid()))
    and exists (
      select 1
      from public.crm_user_reporting_scope_grants grant_row
      where grant_row.user_id = (select auth.uid())
        and grant_row.reporting_scope_id = p_scope_id
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and private.reporting_scope_grant_lineage_is_effective(grant_row.id, now())
    );
$$;

create or replace function private.can_read_crm_read_model_v3_dataset(p_dataset_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_dataset_key
    when 'funnel' then coalesce(
      public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.view'
      ), false
    )
    when 'ranking' then coalesce(
      public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.ranking.view'
      ), false
    )
    when 'partnerships' then coalesce(
      public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.partnerships.view'
      ), false
    )
    when 'stock' then coalesce(
      public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.stock.view'
      ), false
    )
    else false
  end;
$$;

create or replace function private.crm_read_model_v3_uuid_filter(
  p_filters jsonb,
  p_key text
)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result uuid[];
begin
  if not (p_filters ? p_key) then
    return null;
  end if;
  if jsonb_typeof(p_filters -> p_key) <> 'array'
     or jsonb_array_length(p_filters -> p_key) not between 1 and 100 then
    raise exception 'invalid_argument: invalid dimensional filter'
      using errcode = '22023';
  end if;
  begin
    select array_agg(value::uuid order by value::uuid)
    into v_result
    from jsonb_array_elements_text(p_filters -> p_key) item(value);
  exception when others then
    raise exception 'invalid_argument: invalid dimensional filter'
      using errcode = '22023';
  end;
  if cardinality(v_result) <> (
    select count(distinct value)::integer
    from jsonb_array_elements_text(p_filters -> p_key) item(value)
  ) then
    raise exception 'invalid_argument: duplicate dimensional filter'
      using errcode = '22023';
  end if;
  return v_result;
end;
$$;

create or replace function public.ingest_crm_read_model_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_iso_date_pattern constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
  v_iso_timestamp_pattern constant text :=
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]+)?)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$';
  v_run_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_payload_hash text;
  v_canonical_payload jsonb;
  v_existing_run public.crm_read_model_v3_runs%rowtype;
  v_dataset_key text;
  v_source_key text;
  v_workflow_key text;
  v_producer_key text;
  v_source_snapshot_id text;
  v_reference_date date;
  v_timezone text;
  v_generated_at timestamptz;
  v_source_updated_at timestamptz;
  v_coverage_start date;
  v_coverage_end date;
  v_coverage_status text;
  v_source_status text;
  v_status_reason text;
  v_quality_status text;
  v_quality_issues text[];
  v_available_measures text[];
  v_covered_scope_external_ids text[];
  v_covered_scope_ids uuid[] := '{}';
  v_covered_scope_identity_ids uuid[] := '{}';
  v_record_count integer;
  v_record jsonb;
  v_dimensions jsonb;
  v_source_record_id text;
  v_stage_key text;
  v_occurred_at timestamptz;
  v_commercial_date date;
  v_amount numeric(18, 2);
  v_external_id text;
  v_unresolved boolean := false;
  v_scope_identity public.crm_source_identities%rowtype;
  v_organization_identity public.crm_source_identities%rowtype;
  v_team_identity public.crm_source_identities%rowtype;
  v_portfolio_identity public.crm_source_identities%rowtype;
  v_coordinator_identity public.crm_source_identities%rowtype;
  v_manager_identity public.crm_source_identities%rowtype;
  v_broker_identity public.crm_source_identities%rowtype;
  v_origin_identity public.crm_source_identities%rowtype;
  v_development_identity public.crm_source_identities%rowtype;
  v_location_identity public.crm_source_identities%rowtype;
  v_scope public.crm_reporting_scopes%rowtype;
  v_team public.crm_teams%rowtype;
  v_origin public.crm_origins%rowtype;
  v_development public.crm_developments%rowtype;
  v_location public.crm_locations%rowtype;
begin
  -- Caller authentication is enforced by EXECUTE ACL below. Inside this
  -- SECURITY DEFINER body current_user is always the postgres owner, so it is
  -- not a meaningful caller check. PUBLIC, anon and authenticated stay revoked.

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 8 * 1024 * 1024
     or not (p_payload ?& array[
       'schemaVersion', 'requestId', 'datasetKey', 'sourceKey',
       'workflowKey', 'producerKey', 'sourceSnapshotId', 'referenceDate',
       'timezone', 'generatedAt', 'sourceUpdatedAt', 'coverage',
       'sourceStatus', 'statusReason', 'qualityStatus', 'qualityIssues',
       'availableMeasures', 'coveredReportingScopeExternalIds',
       'closedMonths', 'records'
     ])
     or exists (
       select 1 from jsonb_object_keys(p_payload) key
       where key not in (
         'schemaVersion', 'requestId', 'datasetKey', 'sourceKey',
         'workflowKey', 'producerKey', 'sourceSnapshotId', 'referenceDate',
         'timezone', 'generatedAt', 'sourceUpdatedAt', 'coverage',
         'sourceStatus', 'statusReason', 'qualityStatus', 'qualityIssues',
         'availableMeasures', 'coveredReportingScopeExternalIds',
         'closedMonths', 'records'
       )
     ) then
    raise exception 'invalid_argument: invalid CRM v3 payload' using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'referenceDate', '') !~ v_iso_date_pattern
     or coalesce(p_payload ->> 'generatedAt', '') !~ v_iso_timestamp_pattern
     or (
       p_payload -> 'sourceUpdatedAt' <> 'null'::jsonb
       and coalesce(p_payload ->> 'sourceUpdatedAt', '') !~ v_iso_timestamp_pattern
     )
     or (
       p_payload #> '{coverage,start}' <> 'null'::jsonb
       and coalesce(p_payload #>> '{coverage,start}', '') !~ v_iso_date_pattern
     )
     or (
       p_payload #> '{coverage,end}' <> 'null'::jsonb
       and coalesce(p_payload #>> '{coverage,end}', '') !~ v_iso_date_pattern
     ) then
    raise exception 'invalid_argument: invalid CRM v3 envelope values'
      using errcode = '22023';
  end if;

  begin
    if (p_payload ->> 'schemaVersion')::integer <> 3 then
      raise exception 'invalid schema';
    end if;
    v_request_id := (p_payload ->> 'requestId')::uuid;
    v_reference_date := (p_payload ->> 'referenceDate')::date;
    v_generated_at := (p_payload ->> 'generatedAt')::timestamptz;
    v_source_updated_at := nullif(p_payload ->> 'sourceUpdatedAt', '')::timestamptz;
    v_coverage_start := nullif(p_payload #>> '{coverage,start}', '')::date;
    v_coverage_end := nullif(p_payload #>> '{coverage,end}', '')::date;
  exception when others then
    raise exception 'invalid_argument: invalid CRM v3 envelope values'
      using errcode = '22023';
  end;

  v_dataset_key := btrim(coalesce(p_payload ->> 'datasetKey', ''));
  v_source_key := btrim(coalesce(p_payload ->> 'sourceKey', ''));
  v_workflow_key := btrim(coalesce(p_payload ->> 'workflowKey', ''));
  v_producer_key := btrim(coalesce(p_payload ->> 'producerKey', ''));
  v_source_snapshot_id := btrim(coalesce(p_payload ->> 'sourceSnapshotId', ''));
  v_timezone := btrim(coalesce(p_payload ->> 'timezone', ''));
  v_coverage_status := btrim(coalesce(p_payload #>> '{coverage,status}', ''));
  v_source_status := btrim(coalesce(p_payload ->> 'sourceStatus', ''));
  v_status_reason := nullif(btrim(coalesce(p_payload ->> 'statusReason', '')), '');
  v_quality_status := btrim(coalesce(p_payload ->> 'qualityStatus', ''));

  if jsonb_typeof(p_payload -> 'coverage') <> 'object'
     or not (p_payload -> 'coverage' ?& array['start', 'end', 'status'])
     or exists (
       select 1 from jsonb_object_keys(p_payload -> 'coverage') key
       where key not in ('start', 'end', 'status')
     )
     or v_dataset_key not in ('funnel', 'ranking', 'partnerships', 'stock')
     or v_request_id is null
     or v_reference_date is null
     or v_generated_at is null
     or v_source_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or v_workflow_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or v_producer_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or length(v_source_key) > 100
     or length(v_workflow_key) > 100
     or length(v_producer_key) > 100
     or v_source_snapshot_id = '' or length(v_source_snapshot_id) > 300
     or length(v_timezone) > 100
     or v_coverage_status not in ('complete', 'partial', 'unknown')
     or v_source_status not in ('ready', 'stale', 'unavailable', 'error')
     or v_quality_status not in ('verified', 'warning', 'blocked')
     or not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = v_timezone)
     -- Intl.DateTimeFormat supports canonical IANA region/alias families and
     -- UTC; PostgreSQL-only POSIX names such as Factory are intentionally out.
     or not (
       v_timezone = 'UTC'
       or v_timezone ~ '^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Brazil|Canada|Chile|Etc|Europe|Indian|Mexico|Pacific|US)/[A-Za-z0-9._+-]+(/[A-Za-z0-9._+-]+)?$'
     )
     or not pg_catalog.isfinite(v_reference_date)
     or not pg_catalog.isfinite(v_generated_at)
     or (v_source_updated_at is not null and not pg_catalog.isfinite(v_source_updated_at))
     or (v_coverage_start is not null and not pg_catalog.isfinite(v_coverage_start))
     or (v_coverage_end is not null and not pg_catalog.isfinite(v_coverage_end))
     or v_generated_at > now() + interval '5 minutes'
     or (v_source_updated_at is not null and v_source_updated_at > now() + interval '5 minutes')
     or (v_source_updated_at is not null and v_source_updated_at > v_generated_at)
     or (v_source_status = 'ready' and v_status_reason is not null)
     or (v_source_status <> 'ready' and v_status_reason is null)
     or (
       p_payload -> 'statusReason' <> 'null'::jsonb
       and (
         jsonb_typeof(p_payload -> 'statusReason') <> 'string'
         or v_status_reason is null
         or v_status_reason !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
         or length(v_status_reason) > 100
       )
     )
     or (
       v_coverage_status = 'unknown'
       and (v_coverage_start is not null or v_coverage_end is not null)
     )
     or (
       v_coverage_status <> 'unknown'
       and (
         v_coverage_start is null or v_coverage_end is null
         or v_coverage_end < v_coverage_start
         or v_reference_date < v_coverage_start
         or v_reference_date > v_coverage_end
       )
     ) then
    raise exception 'invalid_argument: inconsistent CRM v3 envelope'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload -> 'qualityIssues') <> 'array'
     or jsonb_array_length(p_payload -> 'qualityIssues') > 100
     or jsonb_typeof(p_payload -> 'availableMeasures') <> 'array'
     or jsonb_array_length(p_payload -> 'availableMeasures') > 2
     or jsonb_typeof(p_payload -> 'coveredReportingScopeExternalIds') <> 'array'
     or jsonb_array_length(p_payload -> 'coveredReportingScopeExternalIds') > 1000
     or jsonb_typeof(p_payload -> 'closedMonths') <> 'array'
     or jsonb_array_length(p_payload -> 'closedMonths') > 60
     or jsonb_typeof(p_payload -> 'records') <> 'array'
     or jsonb_array_length(p_payload -> 'records') > 10000 then
    raise exception 'invalid_argument: invalid CRM v3 arrays' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      p_payload -> 'coveredReportingScopeExternalIds'
    ) item(value)
    where jsonb_typeof(value) <> 'string'
      or nullif(btrim(value #>> '{}'), '') is null
      or length(btrim(value #>> '{}')) > 300
  ) then
    raise exception 'invalid_argument: invalid covered reporting scopes'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(btrim(value) order by btrim(value)), '{}')
  into v_covered_scope_external_ids
  from jsonb_array_elements_text(
    p_payload -> 'coveredReportingScopeExternalIds'
  ) item(value);

  if cardinality(v_covered_scope_external_ids) <> (
    select count(distinct btrim(value))::integer
    from jsonb_array_elements_text(
      p_payload -> 'coveredReportingScopeExternalIds'
    ) item(value)
  ) then
    raise exception 'invalid_argument: duplicate covered reporting scope'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from private.crm_read_model_v3_sources authority
    join private.crm_integration_owners owner
      on owner.id = authority.owner_id and owner.is_active
    where authority.dataset_key = v_dataset_key
      and authority.source_key = v_source_key
      and authority.workflow_key = v_workflow_key
      and authority.producer_key = v_producer_key
      and authority.is_active
      and (
        v_source_status not in ('ready', 'stale')
        or not authority.require_complete_coverage
        or v_coverage_status = 'complete'
      )
  ) then
    raise exception 'forbidden: dataset source authority is unavailable'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(value order by value), '{}')
  into v_quality_issues
  from jsonb_array_elements_text(p_payload -> 'qualityIssues') item(value);
  select coalesce(array_agg(value order by value), '{}')
  into v_available_measures
  from jsonb_array_elements_text(p_payload -> 'availableMeasures') item(value);
  v_record_count := jsonb_array_length(p_payload -> 'records');

  if exists (
       select 1 from unnest(v_quality_issues) issue
       where issue !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' or length(issue) > 100
     )
     or cardinality(v_quality_issues) <> (
       select count(distinct issue)::integer from unnest(v_quality_issues) issue
     )
     or exists (
       select 1 from unnest(v_available_measures) measure
       where measure not in ('counts', 'sales_amount')
     )
     or cardinality(v_available_measures) <> (
       select count(distinct measure)::integer from unnest(v_available_measures) measure
     )
     or (
       v_source_status in ('ready', 'stale')
       and not ('counts' = any(v_available_measures))
     )
     or (v_source_status in ('unavailable', 'error') and v_record_count <> 0)
     or (v_source_status in ('ready', 'stale') and v_source_updated_at is null)
     or (
       v_source_status in ('ready', 'stale')
       and cardinality(v_covered_scope_external_ids) = 0
     )
     or (v_quality_status = 'verified' and cardinality(v_quality_issues) <> 0)
     or (v_quality_status <> 'verified' and cardinality(v_quality_issues) = 0) then
    raise exception 'invalid_argument: inconsistent CRM v3 quality contract'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_payload -> 'closedMonths') item(value)
    where value !~ '^\d{4}-\d{2}-01$'
       or value::date >= date_trunc('month', v_reference_date)::date
       or v_coverage_status <> 'complete'
       or value::date < v_coverage_start
       or (value::date + interval '1 month - 1 day')::date > v_coverage_end
  ) or (
    select count(*) from jsonb_array_elements_text(p_payload -> 'closedMonths')
  ) <> (
    select count(distinct value)
    from jsonb_array_elements_text(p_payload -> 'closedMonths') item(value)
  ) or (
    jsonb_array_length(p_payload -> 'closedMonths') > 0
    and v_source_updated_at is null
  ) then
    raise exception 'invalid_argument: closed months require explicit complete coverage'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_payload -> 'records') item(record)
  ) <> (
    select count(distinct concat(record ->> 'stageKey', ':', record ->> 'sourceRecordId'))
    from jsonb_array_elements(p_payload -> 'records') item(record)
  ) then
    raise exception 'invalid_argument: duplicate source record grain'
      using errcode = '22023';
  end if;

  v_canonical_payload := p_payload || jsonb_build_object(
    'qualityIssues', coalesce((
      select jsonb_agg(value order by value)
      from jsonb_array_elements_text(p_payload -> 'qualityIssues') item(value)
    ), '[]'::jsonb),
    'availableMeasures', coalesce((
      select jsonb_agg(value order by value)
      from jsonb_array_elements_text(p_payload -> 'availableMeasures') item(value)
    ), '[]'::jsonb),
    'coveredReportingScopeExternalIds', coalesce((
      select jsonb_agg(btrim(value) order by btrim(value))
      from jsonb_array_elements_text(
        p_payload -> 'coveredReportingScopeExternalIds'
      ) item(value)
    ), '[]'::jsonb),
    'closedMonths', coalesce((
      select jsonb_agg(value order by value)
      from jsonb_array_elements_text(p_payload -> 'closedMonths') item(value)
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        record order by record ->> 'stageKey', record ->> 'sourceRecordId', record::text
      )
      from jsonb_array_elements(p_payload -> 'records') item(record)
    ), '[]'::jsonb)
  );
  v_payload_hash := encode(
    extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-read-model-v3-request:' || v_request_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-read-model-v3:' || v_dataset_key, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-source-identities:' || v_source_key, 0)
  );

  select run.* into v_existing_run
  from public.crm_read_model_v3_runs run
  where run.request_id = v_request_id;

  if found then
    if v_existing_run.payload_hash <> v_payload_hash then
      raise exception 'conflict: request id was reused with different content'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'ok', v_existing_run.publication_status = 'published',
      'noop', true,
      'runId', v_existing_run.id,
      'publicationStatus', v_existing_run.publication_status,
      'rejectionReason', v_existing_run.rejection_reason
    );
  end if;

  if exists (
    select 1
    from public.crm_read_model_v3_runs run
    where run.dataset_key = v_dataset_key
      and run.source_key = v_source_key
      and run.source_snapshot_id = v_source_snapshot_id
  ) then
    raise exception 'conflict: source snapshot id already exists'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.crm_read_model_v3_active_runs active_run
    join public.crm_read_model_v3_runs active_snapshot
      on active_snapshot.id = active_run.run_id
    where active_run.dataset_key = v_dataset_key
      and active_snapshot.generated_at >= v_generated_at
  ) then
    raise exception 'conflict: source snapshot is not newer than the active run'
      using errcode = '23505';
  end if;

  foreach v_external_id in array v_covered_scope_external_ids
  loop
    v_scope_identity := null;
    select * into v_scope_identity
    from private.resolve_verified_source_identity(
      v_source_key, 'reporting_scope', v_external_id, v_generated_at
    );
    if v_scope_identity.id is null then
      perform private.record_identity_reconciliation(
        v_source_key, 'reporting_scope', v_external_id, null, null,
        'scope_coverage_mapping_missing', v_run_id
      );
      v_unresolved := true;
    else
      v_covered_scope_ids := array_append(
        v_covered_scope_ids, v_scope_identity.reporting_scope_id
      );
      v_covered_scope_identity_ids := array_append(
        v_covered_scope_identity_ids, v_scope_identity.id
      );
    end if;
  end loop;

  if not v_unresolved
     and cardinality(v_covered_scope_ids) <> (
       select count(distinct scope_id)::integer
       from unnest(v_covered_scope_ids) item(scope_id)
     ) then
    raise exception 'invalid_argument: covered reporting scopes resolve ambiguously'
      using errcode = '22023';
  end if;

  for v_record in
    select record from jsonb_array_elements(p_payload -> 'records') item(record)
  loop
    v_scope_identity := null;
    v_organization_identity := null;
    v_team_identity := null;
    v_portfolio_identity := null;
    v_coordinator_identity := null;
    v_manager_identity := null;
    v_broker_identity := null;
    v_origin_identity := null;
    v_development_identity := null;
    v_location_identity := null;

    if jsonb_typeof(v_record) <> 'object'
       or not (v_record ?& array[
         'sourceRecordId', 'stageKey', 'occurredAt', 'commercialDate',
         'amount', 'dimensions'
       ])
       or exists (
         select 1 from jsonb_object_keys(v_record) key
         where key not in (
           'sourceRecordId', 'stageKey', 'occurredAt', 'commercialDate',
           'amount', 'dimensions'
         )
       )
       or jsonb_typeof(v_record -> 'dimensions') <> 'object'
       or not (v_record -> 'dimensions' ?& array[
         'reportingScopeExternalId', 'organizationExternalId'
       ])
       or (
         v_record -> 'amount' <> 'null'::jsonb
         and jsonb_typeof(v_record -> 'amount') <> 'string'
       )
       or coalesce(v_record ->> 'occurredAt', '') !~ v_iso_timestamp_pattern
       or coalesce(v_record ->> 'commercialDate', '') !~ v_iso_date_pattern
       or exists (
         select 1 from jsonb_object_keys(v_record -> 'dimensions') key
         where key not in (
           'reportingScopeExternalId', 'organizationExternalId', 'teamExternalId',
           'portfolioExternalId', 'coordinatorExternalId', 'managerExternalId',
           'brokerExternalId', 'originExternalId', 'developmentExternalId',
           'locationExternalId'
         )
       ) then
      raise exception 'invalid_argument: invalid CRM v3 record shape'
        using errcode = '22023';
    end if;

    if v_record -> 'amount' <> 'null'::jsonb
       and coalesce(v_record ->> 'amount', '')
         !~ '^(0|[1-9][0-9]{0,15})([.][0-9]{1,2})?$' then
      raise exception 'invalid_argument: inconsistent CRM v3 record'
        using errcode = '22023';
    end if;

    v_dimensions := v_record -> 'dimensions';
    v_source_record_id := btrim(coalesce(v_record ->> 'sourceRecordId', ''));
    v_stage_key := btrim(coalesce(v_record ->> 'stageKey', ''));
    begin
      v_occurred_at := (v_record ->> 'occurredAt')::timestamptz;
      v_commercial_date := (v_record ->> 'commercialDate')::date;
      v_amount := nullif(v_record ->> 'amount', '')::numeric(18, 2);
    exception when others then
      raise exception 'invalid_argument: invalid CRM v3 record values'
        using errcode = '22023';
    end;

    if v_source_record_id = '' or length(v_source_record_id) > 300
       or v_stage_key not in ('opportunities', 'appointments', 'visits', 'folders', 'sales')
       or v_occurred_at > v_generated_at
       or not pg_catalog.isfinite(v_occurred_at)
       or not pg_catalog.isfinite(v_commercial_date)
       or v_commercial_date <> (v_occurred_at at time zone v_timezone)::date
       or (v_amount is not null and v_amount < 0)
       or (
         'sales_amount' = any(v_available_measures)
         and v_stage_key = 'sales' and v_amount is null
       )
       or (
         not ('sales_amount' = any(v_available_measures)) and v_amount is not null
       ) then
      raise exception 'invalid_argument: inconsistent CRM v3 record'
        using errcode = '22023';
    end if;

    v_external_id := btrim(coalesce(v_dimensions ->> 'reportingScopeExternalId', ''));
    select * into v_scope_identity
    from private.resolve_verified_source_identity(
      v_source_key, 'reporting_scope', v_external_id, v_occurred_at
    );
    if v_external_id = '' or v_scope_identity.id is null then
      perform private.record_identity_reconciliation(
        v_source_key, 'reporting_scope', coalesce(nullif(v_external_id, ''), '<missing>'),
        null, v_source_record_id, 'verified_mapping_missing', v_run_id
      );
      v_unresolved := true;
    end if;

    if v_scope_identity.id is not null
       and not v_unresolved
       and not exists (
         select 1
         from unnest(v_covered_scope_ids) manifest(reporting_scope_id)
         where private.reporting_scope_contains(
           manifest.reporting_scope_id,
           v_scope_identity.reporting_scope_id,
           v_occurred_at
         )
       ) then
      raise exception 'conflict: event scope is outside declared scope coverage'
        using errcode = '23514';
    end if;

    v_external_id := btrim(coalesce(v_dimensions ->> 'organizationExternalId', ''));
    select * into v_organization_identity
    from private.resolve_verified_source_identity(
      v_source_key, 'organization', v_external_id, v_occurred_at
    );
    if v_external_id = '' or v_organization_identity.id is null then
      perform private.record_identity_reconciliation(
        v_source_key, 'organization', coalesce(nullif(v_external_id, ''), '<missing>'),
        null, v_source_record_id, 'verified_mapping_missing', v_run_id
      );
      v_unresolved := true;
    end if;

    foreach v_external_id in array array[
      nullif(btrim(coalesce(v_dimensions ->> 'teamExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'portfolioExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'coordinatorExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'managerExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'brokerExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'originExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'developmentExternalId', '')), ''),
      nullif(btrim(coalesce(v_dimensions ->> 'locationExternalId', '')), '')
    ]
    loop
      if v_external_id is not null and length(v_external_id) > 300 then
        raise exception 'invalid_argument: external identity is too long'
          using errcode = '22023';
      end if;
    end loop;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'teamExternalId', '')), '');
    if v_external_id is not null then
      select * into v_team_identity from private.resolve_verified_source_identity(
        v_source_key, 'team', v_external_id, v_occurred_at
      );
      if v_team_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'team', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'portfolioExternalId', '')), '');
    if v_external_id is not null then
      select * into v_portfolio_identity from private.resolve_verified_source_identity(
        v_source_key, 'portfolio', v_external_id, v_occurred_at
      );
      if v_portfolio_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'portfolio', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'coordinatorExternalId', '')), '');
    if v_external_id is not null then
      select * into v_coordinator_identity from private.resolve_verified_source_identity(
        v_source_key, 'person', v_external_id, v_occurred_at
      );
      if v_coordinator_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'person', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'managerExternalId', '')), '');
    if v_external_id is not null then
      select * into v_manager_identity from private.resolve_verified_source_identity(
        v_source_key, 'person', v_external_id, v_occurred_at
      );
      if v_manager_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'person', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'brokerExternalId', '')), '');
    if v_external_id is not null then
      select * into v_broker_identity from private.resolve_verified_source_identity(
        v_source_key, 'person', v_external_id, v_occurred_at
      );
      if v_broker_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'person', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'originExternalId', '')), '');
    if v_external_id is not null then
      select * into v_origin_identity from private.resolve_verified_source_identity(
        v_source_key, 'origin', v_external_id, v_occurred_at
      );
      if v_origin_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'origin', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'developmentExternalId', '')), '');
    if v_external_id is not null then
      select * into v_development_identity from private.resolve_verified_source_identity(
        v_source_key, 'development', v_external_id, v_occurred_at
      );
      if v_development_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'development', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;

    v_external_id := nullif(btrim(coalesce(v_dimensions ->> 'locationExternalId', '')), '');
    if v_external_id is not null then
      select * into v_location_identity from private.resolve_verified_source_identity(
        v_source_key, 'location', v_external_id, v_occurred_at
      );
      if v_location_identity.id is null then
        perform private.record_identity_reconciliation(
          v_source_key, 'location', v_external_id, null, v_source_record_id,
          'verified_mapping_missing', v_run_id
        );
        v_unresolved := true;
      end if;
    end if;
  end loop;

  if v_unresolved or v_quality_status = 'blocked' then
    insert into public.crm_read_model_v3_runs (
      id, request_id, payload_hash, dataset_key, source_key, workflow_key,
      producer_key, source_snapshot_id, reference_date, timezone,
      generated_at, source_updated_at, coverage_start, coverage_end,
      coverage_status, source_status, status_reason, quality_status,
      quality_issues, available_measures, publication_status,
      rejection_reason, record_count
    ) values (
      v_run_id, v_request_id, v_payload_hash, v_dataset_key, v_source_key,
      v_workflow_key, v_producer_key, v_source_snapshot_id, v_reference_date,
      v_timezone, v_generated_at, v_source_updated_at, v_coverage_start,
      v_coverage_end, v_coverage_status, v_source_status, v_status_reason,
      'blocked',
      case when v_unresolved
        and not ('unresolved_source_identity' = any(v_quality_issues))
        then array_append(v_quality_issues, 'unresolved_source_identity')
        else v_quality_issues end,
      v_available_measures, 'rejected',
      case when v_unresolved then 'unresolved_mappings' else 'quality_blocked' end,
      0
    );

    return jsonb_build_object(
      'ok', false, 'noop', false, 'runId', v_run_id,
      'publicationStatus', 'rejected',
      'rejectionReason', case when v_unresolved
        then 'unresolved_mappings' else 'quality_blocked' end
    );
  end if;

  insert into public.crm_read_model_v3_runs (
    id, request_id, payload_hash, dataset_key, source_key, workflow_key,
    producer_key, source_snapshot_id, reference_date, timezone,
    generated_at, source_updated_at, coverage_start, coverage_end,
    coverage_status, source_status, status_reason, quality_status,
    quality_issues, available_measures, publication_status,
    record_count, published_at
  ) values (
    v_run_id, v_request_id, v_payload_hash, v_dataset_key, v_source_key,
    v_workflow_key, v_producer_key, v_source_snapshot_id, v_reference_date,
    v_timezone, v_generated_at, v_source_updated_at, v_coverage_start,
    v_coverage_end, v_coverage_status, v_source_status, v_status_reason,
    v_quality_status, v_quality_issues, v_available_measures, 'published',
    v_record_count, now()
  );

  insert into public.crm_read_model_v3_scope_coverage (
    run_id, reporting_scope_id, reporting_scope_identity_id
  )
  select v_run_id, manifest.reporting_scope_id, manifest.source_identity_id
  from unnest(
    v_covered_scope_ids, v_covered_scope_identity_ids
  ) manifest(reporting_scope_id, source_identity_id);

  insert into public.crm_read_model_v3_closed_months (
    run_id, month_start, source_watermark
  )
  select v_run_id, value::date, v_source_updated_at
  from jsonb_array_elements_text(p_payload -> 'closedMonths') item(value);

  for v_record in
    select record from jsonb_array_elements(p_payload -> 'records') item(record)
  loop
    v_dimensions := v_record -> 'dimensions';
    v_source_record_id := btrim(v_record ->> 'sourceRecordId');
    v_stage_key := btrim(v_record ->> 'stageKey');
    v_occurred_at := (v_record ->> 'occurredAt')::timestamptz;
    v_commercial_date := (v_record ->> 'commercialDate')::date;
    v_amount := nullif(v_record ->> 'amount', '')::numeric(18, 2);

    v_scope_identity := null;
    v_organization_identity := null;
    v_team_identity := null;
    v_portfolio_identity := null;
    v_coordinator_identity := null;
    v_manager_identity := null;
    v_broker_identity := null;
    v_origin_identity := null;
    v_development_identity := null;
    v_location_identity := null;

    select * into strict v_scope_identity from private.resolve_verified_source_identity(
      v_source_key, 'reporting_scope',
      btrim(coalesce(v_dimensions ->> 'reportingScopeExternalId', '')), v_occurred_at
    );
    select * into strict v_organization_identity from private.resolve_verified_source_identity(
      v_source_key, 'organization',
      btrim(coalesce(v_dimensions ->> 'organizationExternalId', '')), v_occurred_at
    );

    if nullif(btrim(coalesce(v_dimensions ->> 'teamExternalId', '')), '') is not null then
      select * into strict v_team_identity from private.resolve_verified_source_identity(
        v_source_key, 'team',
        btrim(coalesce(v_dimensions ->> 'teamExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'portfolioExternalId', '')), '') is not null then
      select * into strict v_portfolio_identity from private.resolve_verified_source_identity(
        v_source_key, 'portfolio',
        btrim(coalesce(v_dimensions ->> 'portfolioExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'coordinatorExternalId', '')), '') is not null then
      select * into strict v_coordinator_identity from private.resolve_verified_source_identity(
        v_source_key, 'person',
        btrim(coalesce(v_dimensions ->> 'coordinatorExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'managerExternalId', '')), '') is not null then
      select * into strict v_manager_identity from private.resolve_verified_source_identity(
        v_source_key, 'person',
        btrim(coalesce(v_dimensions ->> 'managerExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'brokerExternalId', '')), '') is not null then
      select * into strict v_broker_identity from private.resolve_verified_source_identity(
        v_source_key, 'person',
        btrim(coalesce(v_dimensions ->> 'brokerExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'originExternalId', '')), '') is not null then
      select * into strict v_origin_identity from private.resolve_verified_source_identity(
        v_source_key, 'origin',
        btrim(coalesce(v_dimensions ->> 'originExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'developmentExternalId', '')), '') is not null then
      select * into strict v_development_identity from private.resolve_verified_source_identity(
        v_source_key, 'development',
        btrim(coalesce(v_dimensions ->> 'developmentExternalId', '')), v_occurred_at
      );
    end if;
    if nullif(btrim(coalesce(v_dimensions ->> 'locationExternalId', '')), '') is not null then
      select * into strict v_location_identity from private.resolve_verified_source_identity(
        v_source_key, 'location',
        btrim(coalesce(v_dimensions ->> 'locationExternalId', '')), v_occurred_at
      );
    end if;

    select * into strict v_scope from public.crm_reporting_scopes
    where id = v_scope_identity.reporting_scope_id and is_active;

    if v_team_identity.id is not null then
      select * into strict v_team from public.crm_teams
      where id = v_team_identity.team_id and is_active;
    end if;
    if v_origin_identity.id is not null then
      select * into strict v_origin from public.crm_origins
      where id = v_origin_identity.origin_id and is_active;
    end if;
    if v_development_identity.id is not null then
      select * into strict v_development from public.crm_developments
      where id = v_development_identity.development_id and is_active;
    end if;
    if v_location_identity.id is not null then
      select * into strict v_location from public.crm_locations
      where id = v_location_identity.location_id and is_active;
    end if;

    if (v_team_identity.id is not null
          and v_team.organization_id <> v_organization_identity.organization_id)
       or (v_portfolio_identity.id is not null and not exists (
         select 1 from public.crm_portfolio_organizations membership
         where membership.portfolio_id = v_portfolio_identity.portfolio_id
           and membership.organization_id = v_organization_identity.organization_id
           and membership.valid_from <= v_occurred_at
           and (membership.valid_until is null or membership.valid_until > v_occurred_at)
       ))
       or (v_origin_identity.id is not null
          and v_origin.organization_id <> v_organization_identity.organization_id)
       or (v_development_identity.id is not null
          and v_development.organization_id <> v_organization_identity.organization_id)
       or (v_location_identity.id is not null
          and v_location.organization_id <> v_organization_identity.organization_id)
       or ((v_coordinator_identity.id is not null
            or v_manager_identity.id is not null
            or v_broker_identity.id is not null)
          and v_team_identity.id is null)
       or (v_coordinator_identity.id is not null and not exists (
         select 1 from public.crm_team_memberships membership
         where membership.team_id = v_team_identity.team_id
           and membership.person_id = v_coordinator_identity.person_id
           and membership.membership_role = 'coordinator'
           and membership.valid_from <= v_occurred_at
           and (membership.valid_until is null or membership.valid_until > v_occurred_at)
       ))
       or (v_manager_identity.id is not null and not exists (
         select 1 from public.crm_team_memberships membership
         where membership.team_id = v_team_identity.team_id
           and membership.person_id = v_manager_identity.person_id
           and membership.membership_role = 'manager'
           and membership.valid_from <= v_occurred_at
           and (membership.valid_until is null or membership.valid_until > v_occurred_at)
       ))
       or (v_broker_identity.id is not null and not exists (
         select 1 from public.crm_team_memberships membership
         where membership.team_id = v_team_identity.team_id
           and membership.person_id = v_broker_identity.person_id
           and membership.membership_role in ('broker', 'member')
           and membership.valid_from <= v_occurred_at
           and (membership.valid_until is null or membership.valid_until > v_occurred_at)
       ))
       or (
         v_scope.scope_type = 'global'
         or (v_scope.scope_type = 'organization'
           and v_scope.organization_id = v_organization_identity.organization_id)
         or (v_scope.scope_type = 'team'
           and v_scope.team_id = v_team_identity.team_id)
         or (v_scope.scope_type = 'portfolio'
           and v_scope.portfolio_id = v_portfolio_identity.portfolio_id)
         or (v_scope.scope_type = 'person'
           and v_scope.person_id = v_broker_identity.person_id)
       ) is not true then
      raise exception 'conflict: mapped dimensions do not share one canonical scope'
        using errcode = '23514';
    end if;

    insert into public.crm_read_model_v3_events (
      run_id, stage_key, source_record_id, occurred_at, commercial_date, amount,
      reporting_scope_id, reporting_scope_identity_id,
      organization_id, organization_identity_id,
      team_id, team_identity_id, portfolio_id, portfolio_identity_id,
      coordinator_id, coordinator_identity_id, manager_id, manager_identity_id,
      broker_id, broker_identity_id, origin_id, origin_identity_id,
      development_id, development_identity_id, location_id, location_identity_id,
      record_hash
    ) values (
      v_run_id, v_stage_key, v_source_record_id, v_occurred_at,
      v_commercial_date, v_amount,
      v_scope_identity.reporting_scope_id, v_scope_identity.id,
      v_organization_identity.organization_id, v_organization_identity.id,
      v_team_identity.team_id, v_team_identity.id,
      v_portfolio_identity.portfolio_id, v_portfolio_identity.id,
      v_coordinator_identity.person_id, v_coordinator_identity.id,
      v_manager_identity.person_id, v_manager_identity.id,
      v_broker_identity.person_id, v_broker_identity.id,
      v_origin_identity.origin_id, v_origin_identity.id,
      v_development_identity.development_id, v_development_identity.id,
      v_location_identity.location_id, v_location_identity.id,
      encode(extensions.digest(convert_to(v_record::text, 'UTF8'), 'sha256'), 'hex')
    );
  end loop;

  insert into public.crm_read_model_v3_active_runs (dataset_key, run_id, activated_at)
  values (v_dataset_key, v_run_id, now())
  on conflict (dataset_key) do update
  set run_id = excluded.run_id,
      activated_at = excluded.activated_at;

  return jsonb_build_object(
    'ok', true, 'noop', false, 'runId', v_run_id,
    'publicationStatus', 'published', 'recordCount', v_record_count
  );
end;
$$;

create or replace function public.list_crm_read_model_v3_scopes()
returns table (
  scope_id uuid,
  scope_key text,
  scope_type text,
  scope_label text
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
  select
    scope.id,
    scope.scope_key,
    scope.scope_type,
    case scope.scope_type
      when 'global' then 'Geral'
      when 'organization' then organization.name
      when 'team' then team.name
      when 'portfolio' then portfolio.name
      when 'person' then person.display_name
    end
  from public.crm_user_reporting_scope_grants grant_row
  join public.crm_reporting_scopes scope
    on scope.id = grant_row.reporting_scope_id and scope.is_active
  left join public.crm_organizations organization
    on organization.id = scope.organization_id and organization.is_active
  left join public.crm_teams team
    on team.id = scope.team_id and team.is_active
  left join public.crm_portfolios portfolio
    on portfolio.id = scope.portfolio_id and portfolio.is_active
  left join public.crm_people person
    on person.id = scope.person_id and person.is_active
  where grant_row.user_id = (select auth.uid())
    and (
      coalesce(public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.view'
      ), false)
      or coalesce(public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.ranking.view'
      ), false)
      or coalesce(public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.partnerships.view'
      ), false)
      or coalesce(public._internal_has_permission(
        (select auth.uid()), 'crm.read_model_v3.stock.view'
      ), false)
    )
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and private.can_read_crm_read_model_v3_scope(scope.id)
  order by
    case scope.scope_type
      when 'global' then 0
      when 'portfolio' then 1
      when 'organization' then 2
      when 'team' then 3
      when 'person' then 4
      else 5
    end,
    scope.scope_key,
    scope.id;
$$;

create or replace function public.get_crm_read_model_v3(
  p_dataset_key text,
  p_reporting_scope_id uuid,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_run public.crm_read_model_v3_runs%rowtype;
  v_period text;
  v_period_start date;
  v_period_end date;
  v_period_coverage_proven boolean;
  v_scope_coverage_proven boolean;
  v_organization_ids uuid[];
  v_team_ids uuid[];
  v_portfolio_ids uuid[];
  v_coordinator_ids uuid[];
  v_manager_ids uuid[];
  v_broker_ids uuid[];
  v_origin_ids uuid[];
  v_development_ids uuid[];
  v_location_ids uuid[];
  v_result jsonb;
begin
  if p_dataset_key not in ('funnel', 'ranking', 'partnerships', 'stock')
     or not private.can_read_crm_read_model_v3_dataset(p_dataset_key) then
    raise exception 'forbidden: read-model dataset is unavailable'
      using errcode = '42501';
  end if;

  if p_reporting_scope_id is null
     or not coalesce(
       private.can_read_crm_read_model_v3_scope(p_reporting_scope_id), false
     ) then
    raise exception 'forbidden: read-model scope is unavailable'
      using errcode = '42501';
  end if;

  if p_filters is null or jsonb_typeof(p_filters) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(p_filters) key
       where key not in (
         'period', 'from', 'to', 'organizationIds', 'teamIds',
         'portfolioIds', 'coordinatorIds', 'managerIds', 'brokerIds',
         'originIds', 'developmentIds', 'locationIds'
       )
     ) then
    raise exception 'invalid_argument: invalid read-model filters'
      using errcode = '22023';
  end if;

  v_period := coalesce(nullif(btrim(p_filters ->> 'period'), ''), 'month');
  if v_period not in ('month', 'week', 'today', 'custom') then
    raise exception 'invalid_argument: invalid period filter' using errcode = '22023';
  end if;

  if v_period = 'custom' then
    if not (p_filters ? 'from') or not (p_filters ? 'to') then
      raise exception 'invalid_argument: custom period requires both bounds'
        using errcode = '22023';
    end if;
    if coalesce(p_filters ->> 'from', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or coalesce(p_filters ->> 'to', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid_argument: custom period requires valid dates'
        using errcode = '22023';
    end if;
    begin
      v_period_start := (p_filters ->> 'from')::date;
      v_period_end := (p_filters ->> 'to')::date;
    exception when others then
      raise exception 'invalid_argument: custom period requires valid dates'
        using errcode = '22023';
    end;
    if v_period_start is null or v_period_end is null
       or v_period_end <= v_period_start
       or v_period_end - v_period_start > 366 * 5 then
      raise exception 'invalid_argument: invalid custom period range'
        using errcode = '22023';
    end if;
  elsif p_filters ? 'from' or p_filters ? 'to' then
    raise exception 'invalid_argument: preset periods do not accept custom dates'
      using errcode = '22023';
  end if;

  v_organization_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'organizationIds');
  v_team_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'teamIds');
  v_portfolio_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'portfolioIds');
  v_coordinator_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'coordinatorIds');
  v_manager_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'managerIds');
  v_broker_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'brokerIds');
  v_origin_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'originIds');
  v_development_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'developmentIds');
  v_location_ids := private.crm_read_model_v3_uuid_filter(p_filters, 'locationIds');

  select run.* into v_run
  from public.crm_read_model_v3_active_runs active_run
  join public.crm_read_model_v3_runs run on run.id = active_run.run_id
  where active_run.dataset_key = p_dataset_key
    and run.publication_status = 'published';

  if not found then
    return jsonb_build_object(
      'schemaVersion', 3,
      'dataStatus', 'unavailable',
      'reasonCode', 'official_source_not_published',
      'scopeId', p_reporting_scope_id,
      'datasetKey', p_dataset_key,
      'source', null,
      'filters', jsonb_build_object('period', v_period),
      'truncatedOptions', '[]'::jsonb,
      'options', jsonb_build_object(
        'organizations', '[]'::jsonb, 'teams', '[]'::jsonb,
        'portfolios', '[]'::jsonb, 'coordinators', '[]'::jsonb,
        'managers', '[]'::jsonb, 'brokers', '[]'::jsonb,
        'origins', '[]'::jsonb, 'developments', '[]'::jsonb,
        'locations', '[]'::jsonb
      ),
      'metrics', null,
      'breakdowns', null
    );
  end if;

  if v_period = 'month' then
    v_period_start := date_trunc('month', v_run.reference_date)::date;
    v_period_end := v_run.reference_date + 1;
  elsif v_period = 'week' then
    v_period_start := date_trunc('week', v_run.reference_date)::date;
    v_period_end := v_run.reference_date + 1;
  elsif v_period = 'today' then
    v_period_start := v_run.reference_date;
    v_period_end := v_run.reference_date + 1;
  end if;

  v_period_coverage_proven :=
    v_run.coverage_status = 'complete'
    and v_run.coverage_start is not null
    and v_run.coverage_end is not null
    and v_period_start >= v_run.coverage_start
    and v_period_end <= v_run.coverage_end + 1;

  if v_period = 'custom' and not v_period_coverage_proven then
    raise exception 'invalid_argument: custom period exceeds certified coverage'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.crm_read_model_v3_scope_coverage coverage
    where coverage.run_id = v_run.id
      and coverage.reporting_scope_id = p_reporting_scope_id
  ) into v_scope_coverage_proven;

  if exists (
    select 1
    from (
      select 'organization' as dimension, value as id from unnest(v_organization_ids) value
      union all select 'team', value from unnest(v_team_ids) value
      union all select 'portfolio', value from unnest(v_portfolio_ids) value
      union all select 'coordinator', value from unnest(v_coordinator_ids) value
      union all select 'manager', value from unnest(v_manager_ids) value
      union all select 'broker', value from unnest(v_broker_ids) value
      union all select 'origin', value from unnest(v_origin_ids) value
      union all select 'development', value from unnest(v_development_ids) value
      union all select 'location', value from unnest(v_location_ids) value
    ) requested
    where not exists (
      select 1
      from public.crm_read_model_v3_events event
      where event.run_id = v_run.id
        and event.commercial_date >= v_period_start
        and event.commercial_date < v_period_end
        and private.reporting_scope_contains(
          p_reporting_scope_id, event.reporting_scope_id, event.occurred_at
        )
        and case requested.dimension
          when 'organization' then event.organization_id = requested.id
          when 'team' then event.team_id = requested.id
          when 'portfolio' then event.portfolio_id = requested.id
          when 'coordinator' then event.coordinator_id = requested.id
          when 'manager' then event.manager_id = requested.id
          when 'broker' then event.broker_id = requested.id
          when 'origin' then event.origin_id = requested.id
          when 'development' then event.development_id = requested.id
          when 'location' then event.location_id = requested.id
          else false
        end
    )
  ) then
    raise exception 'invalid_argument: filter value is unavailable in the selected scope'
      using errcode = '22023';
  end if;

  with
  stage_catalog(stage_key, position) as (
    values
      ('opportunities'::text, 1), ('appointments', 2), ('visits', 3),
      ('folders', 4), ('sales', 5)
  ),
  visible_period as (
    select event.*
    from public.crm_read_model_v3_events event
    where event.run_id = v_run.id
      and event.commercial_date >= v_period_start
      and event.commercial_date < v_period_end
      and private.reporting_scope_contains(
        p_reporting_scope_id, event.reporting_scope_id, event.occurred_at
      )
  ),
  filtered as (
    select event.*
    from visible_period event
    where (v_organization_ids is null or event.organization_id = any(v_organization_ids))
      and (v_team_ids is null or event.team_id = any(v_team_ids))
      and (v_portfolio_ids is null or event.portfolio_id = any(v_portfolio_ids))
      and (v_coordinator_ids is null or event.coordinator_id = any(v_coordinator_ids))
      and (v_manager_ids is null or event.manager_id = any(v_manager_ids))
      and (v_broker_ids is null or event.broker_id = any(v_broker_ids))
      and (v_origin_ids is null or event.origin_id = any(v_origin_ids))
      and (v_development_ids is null or event.development_id = any(v_development_ids))
      and (v_location_ids is null or event.location_id = any(v_location_ids))
  ),
  visibility_state as (
    select exists (select 1 from filtered) as filtered_has_facts
  ),
  stage_counts as (
    select catalog.stage_key, catalog.position, count(event.stage_key)::bigint as total
    from stage_catalog catalog
    left join filtered event on event.stage_key = catalog.stage_key
    group by catalog.stage_key, catalog.position
  ),
  stage_with_previous as (
    select counts.*,
      lag(counts.total) over (order by counts.position) as previous_total
    from stage_counts counts
  ),
  all_scoped as (
    select event.*
    from public.crm_read_model_v3_events event
    where event.run_id = v_run.id
      and private.reporting_scope_contains(
        p_reporting_scope_id, event.reporting_scope_id, event.occurred_at
      )
      and (v_organization_ids is null or event.organization_id = any(v_organization_ids))
      and (v_team_ids is null or event.team_id = any(v_team_ids))
      and (v_portfolio_ids is null or event.portfolio_id = any(v_portfolio_ids))
      and (v_coordinator_ids is null or event.coordinator_id = any(v_coordinator_ids))
      and (v_manager_ids is null or event.manager_id = any(v_manager_ids))
      and (v_broker_ids is null or event.broker_id = any(v_broker_ids))
      and (v_origin_ids is null or event.origin_id = any(v_origin_ids))
      and (v_development_ids is null or event.development_id = any(v_development_ids))
      and (v_location_ids is null or event.location_id = any(v_location_ids))
  ),
  closed_month_stage_counts as (
    select closed_month.month_start, catalog.stage_key,
      count(event.stage_key)::numeric as total
    from public.crm_read_model_v3_closed_months closed_month
    cross join stage_catalog catalog
    left join all_scoped event
      on event.stage_key = catalog.stage_key
     and event.commercial_date >= closed_month.month_start
     and event.commercial_date < (closed_month.month_start + interval '1 month')::date
    where closed_month.run_id = v_run.id
    group by closed_month.month_start, catalog.stage_key
  ),
  closed_averages as (
    select stage_key, avg(total) as average
    from closed_month_stage_counts
    group by stage_key
  ),
  monthly_series as (
    select closed_month.month_start,
      jsonb_object_agg(catalog.stage_key, coalesce(counts.total, 0)) as stages
    from public.crm_read_model_v3_closed_months closed_month
    cross join stage_catalog catalog
    left join closed_month_stage_counts counts
      on counts.month_start = closed_month.month_start
     and counts.stage_key = catalog.stage_key
    where closed_month.run_id = v_run.id
    group by closed_month.month_start
    order by closed_month.month_start
  ),
  organization_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct organization.id, organization.name
      from visible_period event
      join public.crm_organizations organization on organization.id = event.organization_id
    ) candidate
    order by coalesce(candidate.id = any(v_organization_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  team_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct team.id, team.name
      from visible_period event
      join public.crm_teams team on team.id = event.team_id
    ) candidate
    order by coalesce(candidate.id = any(v_team_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  portfolio_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct portfolio.id, portfolio.name
      from visible_period event
      join public.crm_portfolios portfolio on portfolio.id = event.portfolio_id
    ) candidate
    order by coalesce(candidate.id = any(v_portfolio_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  coordinator_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct person.id, person.display_name as name
      from visible_period event
      join public.crm_people person on person.id = event.coordinator_id
    ) candidate
    order by coalesce(candidate.id = any(v_coordinator_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  manager_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct person.id, person.display_name as name
      from visible_period event
      join public.crm_people person on person.id = event.manager_id
    ) candidate
    order by coalesce(candidate.id = any(v_manager_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  broker_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct person.id, person.display_name as name
      from visible_period event
      join public.crm_people person on person.id = event.broker_id
    ) candidate
    order by coalesce(candidate.id = any(v_broker_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  origin_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct origin.id, origin.name
      from visible_period event
      join public.crm_origins origin on origin.id = event.origin_id
    ) candidate
    order by coalesce(candidate.id = any(v_origin_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  development_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct development.id, development.name
      from visible_period event
      join public.crm_developments development on development.id = event.development_id
    ) candidate
    order by coalesce(candidate.id = any(v_development_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  location_options as (
    select candidate.*, count(*) over () as option_count
    from (
      select distinct location.id, location.name
      from visible_period event
      join public.crm_locations location on location.id = event.location_id
    ) candidate
    order by coalesce(candidate.id = any(v_location_ids), false) desc,
      candidate.name, candidate.id
    limit 100
  ),
  options_truncation as (
    select coalesce(array_agg(dimension order by dimension), '{}'::text[])
      as truncated_options
    from (values
      ('organizations', coalesce((select max(option_count) > 100 from organization_options), false)),
      ('teams', coalesce((select max(option_count) > 100 from team_options), false)),
      ('portfolios', coalesce((select max(option_count) > 100 from portfolio_options), false)),
      ('coordinators', coalesce((select max(option_count) > 100 from coordinator_options), false)),
      ('managers', coalesce((select max(option_count) > 100 from manager_options), false)),
      ('brokers', coalesce((select max(option_count) > 100 from broker_options), false)),
      ('origins', coalesce((select max(option_count) > 100 from origin_options), false)),
      ('developments', coalesce((select max(option_count) > 100 from development_options), false)),
      ('locations', coalesce((select max(option_count) > 100 from location_options), false))
    ) dimensions(dimension, is_truncated)
    where is_truncated
  ),
  broker_breakdown as (
    select person.id, person.display_name as name, count(*)::bigint as total
    from filtered event
    join public.crm_people person on person.id = event.broker_id
    group by person.id, person.display_name
    order by total desc, person.display_name, person.id
    limit 100
  ),
  organization_breakdown as (
    select organization.id, organization.name, count(*)::bigint as total
    from filtered event
    join public.crm_organizations organization on organization.id = event.organization_id
    group by organization.id, organization.name
    order by total desc, organization.name, organization.id
    limit 100
  ),
  manager_breakdown as (
    select person.id, person.display_name as name, count(*)::bigint as total
    from filtered event
    join public.crm_people person on person.id = event.manager_id
    group by person.id, person.display_name
    order by total desc, person.display_name, person.id
    limit 100
  ),
  development_breakdown as (
    select development.id, development.name, count(*)::bigint as total
    from filtered event
    join public.crm_developments development on development.id = event.development_id
    group by development.id, development.name
    order by total desc, development.name, development.id
    limit 100
  )
  select jsonb_build_object(
    'schemaVersion', 3,
    'dataStatus', case
      when v_run.source_status in ('unavailable', 'error') then v_run.source_status
      when not v_period_coverage_proven then 'unavailable'
      when not v_scope_coverage_proven then 'unavailable'
      when v_run.source_status = 'ready'
        and (select filtered_has_facts from visibility_state) then 'ready'
      when v_run.source_status = 'ready' then 'empty'
      else v_run.source_status
    end,
    'reasonCode', case
      when v_run.source_status in ('unavailable', 'error') then v_run.status_reason
      when not v_period_coverage_proven then 'period_coverage_not_proven'
      when not v_scope_coverage_proven
        then 'scope_coverage_not_proven'
      else v_run.status_reason
    end,
    'scopeId', p_reporting_scope_id,
    'datasetKey', p_dataset_key,
    'source', jsonb_build_object(
      'sourceKey', v_run.source_key,
      'workflowKey', v_run.workflow_key,
      'producerKey', v_run.producer_key,
      'referenceDate', v_run.reference_date,
      'generatedAt', v_run.generated_at,
      'sourceUpdatedAt', v_run.source_updated_at,
      'timezone', v_run.timezone,
      'coverageStart', v_run.coverage_start,
      'coverageEnd', v_run.coverage_end,
      'coverageStatus', v_run.coverage_status,
      'sourceStatus', v_run.source_status,
      'qualityStatus', case
        when v_run.coverage_status <> 'complete'
          or not v_period_coverage_proven
          or not v_scope_coverage_proven
          or (select cardinality(truncated_options) > 0 from options_truncation)
          then 'warning'
        else v_run.quality_status
      end,
      'qualityIssues', to_jsonb((
        select coalesce(array_agg(distinct issue order by issue), '{}'::text[])
        from unnest(
          v_run.quality_issues
          || case when v_run.coverage_status <> 'complete'
            then array['coverage_not_complete']::text[] else '{}'::text[] end
          || case when not v_period_coverage_proven
            then array['period_coverage_not_proven']::text[] else '{}'::text[] end
          || case when not v_scope_coverage_proven
            then array['scope_coverage_not_proven']::text[] else '{}'::text[] end
          || case when (
            select cardinality(truncated_options) > 0 from options_truncation
          )
            then array['filter_options_truncated']::text[] else '{}'::text[] end
        ) item(issue)
      ))
    ),
    'filters', jsonb_build_object(
      'period', v_period, 'from', v_period_start, 'to', v_period_end,
      'organizationIds', to_jsonb(v_organization_ids),
      'teamIds', to_jsonb(v_team_ids),
      'portfolioIds', to_jsonb(v_portfolio_ids),
      'coordinatorIds', to_jsonb(v_coordinator_ids),
      'managerIds', to_jsonb(v_manager_ids),
      'brokerIds', to_jsonb(v_broker_ids),
      'originIds', to_jsonb(v_origin_ids),
      'developmentIds', to_jsonb(v_development_ids),
      'locationIds', to_jsonb(v_location_ids)
    ),
    'truncatedOptions', to_jsonb((
      select truncated_options from options_truncation
    )),
    'options', jsonb_build_object(
      'organizations', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_organization_ids), false) desc, name, id
        )
        from organization_options
      ), '[]'::jsonb),
      'teams', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_team_ids), false) desc, name, id
        )
        from team_options
      ), '[]'::jsonb),
      'portfolios', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_portfolio_ids), false) desc, name, id
        )
        from portfolio_options
      ), '[]'::jsonb),
      'coordinators', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_coordinator_ids), false) desc, name, id
        )
        from coordinator_options
      ), '[]'::jsonb),
      'managers', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_manager_ids), false) desc, name, id
        )
        from manager_options
      ), '[]'::jsonb),
      'brokers', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_broker_ids), false) desc, name, id
        )
        from broker_options
      ), '[]'::jsonb),
      'origins', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_origin_ids), false) desc, name, id
        )
        from origin_options
      ), '[]'::jsonb),
      'developments', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_development_ids), false) desc, name, id
        )
        from development_options
      ), '[]'::jsonb),
      'locations', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', id, 'label', name)
          order by coalesce(id = any(v_location_ids), false) desc, name, id
        )
        from location_options
      ), '[]'::jsonb)
    ),
    'metrics', case
      when v_run.source_status in ('unavailable', 'error')
        or not v_period_coverage_proven
        or not v_scope_coverage_proven then null
      else
      jsonb_build_object(
        'stageTotals', (
          select jsonb_agg(jsonb_build_object(
            'stageKey', stage_key,
            'value', case when 'counts' = any(v_run.available_measures) then total else null end,
            'conversion', case
              when previous_total is null or previous_total = 0 then null
              else total::numeric / previous_total
            end,
            'closedMonthsAverage', (
              select average from closed_averages average_row
              where average_row.stage_key = stage_with_previous.stage_key
            )
          ) order by position)
          from stage_with_previous
        ),
        'salesAmount', case
          when 'sales_amount' = any(v_run.available_measures)
          then coalesce(
            (select sum(amount) from filtered where stage_key = 'sales'), 0
          )::text
          else null
        end,
        'goalsAvailable', false,
        'goal', null,
        'planningAvailable', false,
        'monthlySeries', coalesce((
          select jsonb_agg(jsonb_build_object('monthStart', month_start, 'stages', stages)
            order by month_start)
          from monthly_series
        ), '[]'::jsonb)
      )
    end,
    'breakdowns', case
      when v_run.source_status in ('unavailable', 'error')
        or not v_period_coverage_proven
        or not v_scope_coverage_proven then null
      else jsonb_build_object(
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'total', total)
          order by total desc, name, id)
        from organization_breakdown
      ), '[]'::jsonb),
      'brokers', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'total', total)
          order by total desc, name, id)
        from broker_breakdown
      ), '[]'::jsonb),
      'managers', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'total', total)
          order by total desc, name, id)
        from manager_breakdown
      ), '[]'::jsonb),
      'developments', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'label', name, 'total', total)
          order by total desc, name, id)
        from development_breakdown
      ), '[]'::jsonb)
    ) end
  ) into v_result;

  return v_result;
end;
$$;

drop function if exists public.list_scoped_crm_imob_ranking_entries(integer, integer);

create function public.list_scoped_crm_imob_ranking_entries(
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
  vgv text,
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

  if not public.has_permission((select auth.uid()), 'crm.partnerships.view') then
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
    entry.vgv::text,
    entry.contracts,
    entry.source_rank_vgv,
    entry.source_rank_contracts
  from public.crm_imob_ranking_entries entry
  join public.crm_imob_ranking_runs run on run.id = entry.run_id
  join public.crm_source_identities source_identity
    on source_identity.source = 'qlik'
   and source_identity.entity_kind = 'organization'
   and source_identity.external_id = entry.imob_key
   and source_identity.organization_id is not null
   and source_identity.mapping_status = 'verified'
   and source_identity.valid_from <= run.generated_at
   and (source_identity.valid_until is null or source_identity.valid_until > run.generated_at)
  join private.crm_integration_owners mapping_owner
    on mapping_owner.id = source_identity.mapping_owner_id
   and mapping_owner.is_active
  join public.crm_organizations canonical_organization
    on canonical_organization.id = source_identity.organization_id
   and canonical_organization.is_active
  where run.status = 'succeeded'
    and exists (
      select 1
      from public.crm_user_reporting_scope_grants grant_row
      join public.crm_reporting_scopes organization_scope
        on organization_scope.scope_type = 'organization'
       and organization_scope.organization_id = source_identity.organization_id
       and organization_scope.is_active
      where grant_row.user_id = (select auth.uid())
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and private.reporting_scope_grant_lineage_is_effective(grant_row.id, now())
        and private.reporting_scope_contains(
          grant_row.reporting_scope_id, organization_scope.id, now()
        )
    )
  order by
    run.generated_at desc,
    entry.period_month desc,
    entry.source_rank_vgv asc nulls last,
    entry.imob_key asc
  limit p_limit
  offset p_offset;
end;
$$;

alter function public.ingest_crm_read_model_v3(jsonb) owner to postgres;
alter function public.list_crm_read_model_v3_scopes() owner to postgres;
alter function public.get_crm_read_model_v3(text, uuid, jsonb) owner to postgres;
alter function public.list_scoped_crm_imob_ranking_entries(integer, integer)
  owner to postgres;

alter table public.crm_read_model_v3_runs enable row level security;
alter table public.crm_read_model_v3_runs force row level security;
alter table public.crm_read_model_v3_events enable row level security;
alter table public.crm_read_model_v3_events force row level security;
alter table public.crm_read_model_v3_scope_coverage enable row level security;
alter table public.crm_read_model_v3_scope_coverage force row level security;
alter table public.crm_read_model_v3_closed_months enable row level security;
alter table public.crm_read_model_v3_closed_months force row level security;
alter table public.crm_read_model_v3_active_runs enable row level security;
alter table public.crm_read_model_v3_active_runs force row level security;

revoke all on table
  public.crm_read_model_v3_runs,
  public.crm_read_model_v3_events,
  public.crm_read_model_v3_scope_coverage,
  public.crm_read_model_v3_closed_months,
  public.crm_read_model_v3_active_runs
from public, anon, authenticated, service_role;
revoke all on table private.crm_read_model_v3_sources
  from public, anon, authenticated, service_role;

revoke all privileges on function private.prevent_crm_read_model_v3_mutation()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.resolve_verified_source_identity(text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_crm_read_model_v3_scope(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_crm_read_model_v3_dataset(text)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.crm_read_model_v3_uuid_filter(jsonb, text)
  from public, anon, authenticated, service_role;

revoke all privileges on function public.ingest_crm_read_model_v3(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_crm_read_model_v3(jsonb) to service_role;

revoke all privileges on function public.list_crm_read_model_v3_scopes()
  from public, anon, authenticated, service_role;
grant execute on function public.list_crm_read_model_v3_scopes() to authenticated;

revoke all privileges on function public.get_crm_read_model_v3(text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.get_crm_read_model_v3(text, uuid, jsonb) to authenticated;

revoke all privileges on function
  public.list_scoped_crm_imob_ranking_entries(integer, integer)
from public, anon, authenticated, service_role;
grant execute on function
  public.list_scoped_crm_imob_ranking_entries(integer, integer)
to authenticated;

comment on table public.crm_read_model_v3_runs is
  'Immutable source snapshot envelope with semantic payload hash, explicit timezone, coverage, source state, quality and publication outcome.';
comment on table public.crm_read_model_v3_events is
  'Immutable canonical funnel events. Every authorization-bearing dimension stores both its canonical ID and verified source-identity version.';
comment on table public.crm_read_model_v3_scope_coverage is
  'Immutable per-run exact reporting-scope coverage manifest. Empty scopes are explicit facts; descendant inference never proves read completeness.';
comment on table public.crm_read_model_v3_closed_months is
  'Months explicitly certified complete by the official producer. Averages never infer absent months as zero.';
comment on table private.crm_read_model_v3_sources is
  'Owner-approved exact dataset/source/workflow/producer authorities. At most one source may activate each dataset.';
comment on function public.ingest_crm_read_model_v3(jsonb) is
  'Service-role-only atomic v3 ingestion. Unknown mappings are quarantined and the full batch is rejected; names never resolve identity.';
comment on function public.get_crm_read_model_v3(text, uuid, jsonb) is
  'Authenticated read RPC requiring the v3 permission, one explicit effective scope and validated non-broadening dimension filters.';
comment on function public.list_scoped_crm_imob_ranking_entries(integer, integer) is
  'Legacy Qlik read retained for compatibility, now restricted to owned, verified mapping versions effective at each run timestamp.';

notify pgrst, 'reload schema';
