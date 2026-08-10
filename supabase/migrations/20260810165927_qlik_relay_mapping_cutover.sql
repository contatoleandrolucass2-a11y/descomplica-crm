-- Local-only foundation for the authenticated Qlik relay, mapping import
-- reconciliation, shadow comparison, canary evidence and logical rollback.
-- Every activation surface is empty/disabled by default. This migration does
-- not create a LOGIN credential, owner, mapping, cutover gate or source fact.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'crm_qlik_relay'
  ) then
    create role crm_qlik_relay
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
    where role.rolname = 'crm_qlik_relay'
      and (
        role.rolsuper or role.rolcreatedb or role.rolcreaterole
        or role.rolinherit or role.rolcanlogin or role.rolreplication
        or role.rolbypassrls or role.rolconnlimit <> 2
      )
  ) then
    raise exception 'unsafe existing crm_qlik_relay role attributes'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_qlik_relay'
    )
  ) or exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_qlik_relay'
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
    raise exception 'unsafe existing crm_qlik_relay role membership'
      using errcode = '42501';
  end if;
end;
$$;
alter role crm_qlik_relay set statement_timeout = '35s';
alter role crm_qlik_relay set lock_timeout = '5s';
alter role crm_qlik_relay set idle_in_transaction_session_timeout = '10s';
alter role crm_qlik_relay set search_path = pg_catalog;

-- A schema-specific default REVOKE cannot override PostgreSQL's global
-- PUBLIC EXECUTE default. Close it globally for functions subsequently
-- created by the migration role; every callable API is granted explicitly.
alter default privileges for role postgres
  revoke execute on functions from public;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'qlik_relay'
      and pg_catalog.pg_get_userbyid(namespace.nspowner) <> 'postgres'
  ) then
    raise exception 'unsafe existing qlik_relay schema owner'
      using errcode = '42501';
  end if;
end;
$$;

create schema if not exists qlik_relay authorization postgres;
revoke all on schema qlik_relay from public, anon, authenticated, service_role;
revoke all on schema qlik_relay from crm_qlik_relay;
grant usage on schema qlik_relay to crm_qlik_relay;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_namespace namespace
    cross join lateral pg_catalog.aclexplode(namespace.nspacl) acl
    where namespace.nspname = 'qlik_relay'
      and (
        acl.grantee not in (
          (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
          (select role.oid from pg_catalog.pg_roles role where role.rolname = 'crm_qlik_relay')
        )
        or (
          acl.grantee = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_qlik_relay'
          )
          and (acl.privilege_type <> 'USAGE' or acl.is_grantable)
        )
      )
  ) then
    raise exception 'unsafe qlik_relay schema ACL'
      using errcode = '42501';
  end if;
end;
$$;

revoke all privileges on all tables in schema public from crm_qlik_relay;
revoke all privileges on all sequences in schema public from crm_qlik_relay;
revoke all privileges on all functions in schema public from crm_qlik_relay;
revoke all privileges on all tables in schema private from crm_qlik_relay;
revoke all privileges on all sequences in schema private from crm_qlik_relay;
revoke all privileges on all functions in schema private from crm_qlik_relay;

create table private.crm_qlik_relay_credentials (
  key_id text primary key,
  owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  backup_owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  enabled boolean not null default false,
  valid_from timestamptz not null,
  valid_until timestamptz,
  max_requests_per_minute smallint not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  evidence_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_qlik_relay_credentials_key_check
    check (
      length(key_id) between 1 and 100
      and key_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    ),
  constraint crm_qlik_relay_credentials_owners_check
    check (owner_id <> backup_owner_id),
  constraint crm_qlik_relay_credentials_window_check check (
    pg_catalog.isfinite(valid_from)
    and pg_catalog.isfinite(approved_at)
    and (valid_until is null or (
      pg_catalog.isfinite(valid_until) and valid_until > valid_from
    ))
  ),
  constraint crm_qlik_relay_credentials_rate_check
    check (max_requests_per_minute between 1 and 60),
  constraint crm_qlik_relay_credentials_evidence_check
    check (nullif(btrim(evidence_reference), '') is not null)
);

create table private.crm_integration_cutover_gates (
  integration_key text primary key,
  state text not null default 'disabled',
  owner_id uuid references private.crm_integration_owners(id) on delete restrict,
  backup_owner_id uuid references private.crm_integration_owners(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  evidence_reference text,
  rollback_reference text,
  matched_window_count integer not null default 0,
  last_matched_request_id uuid,
  last_matched_at timestamptz,
  last_matched_generated_at timestamptz,
  canary_window_count integer not null default 0,
  last_canary_request_id uuid,
  last_canary_at timestamptz,
  last_canary_generated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint crm_integration_cutover_gates_key_check
    check (integration_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_integration_cutover_gates_state_check
    check (state in ('disabled', 'shadow', 'canary', 'cutover', 'rolled_back')),
  constraint crm_integration_cutover_gates_windows_check
    check (matched_window_count >= 0 and canary_window_count >= 0),
  constraint crm_integration_cutover_gates_approval_check check (
    state in ('disabled', 'rolled_back')
    or (
      owner_id is not null
      and backup_owner_id is not null
      and owner_id <> backup_owner_id
      and approved_by is not null
      and approved_at is not null
      and pg_catalog.isfinite(approved_at)
      and nullif(btrim(coalesce(evidence_reference, '')), '') is not null
      and nullif(btrim(coalesce(rollback_reference, '')), '') is not null
    )
  ),
  constraint crm_integration_cutover_gates_window_evidence_check check (
    (matched_window_count = 0 and last_matched_request_id is null
      and last_matched_at is null and last_matched_generated_at is null)
    or
    (matched_window_count > 0 and last_matched_request_id is not null
      and last_matched_at is not null and pg_catalog.isfinite(last_matched_at)
      and last_matched_generated_at is not null
      and pg_catalog.isfinite(last_matched_generated_at))
  ),
  constraint crm_integration_cutover_gates_canary_evidence_check check (
    (canary_window_count = 0 and last_canary_request_id is null
      and last_canary_at is null and last_canary_generated_at is null)
    or
    (canary_window_count > 0 and last_canary_request_id is not null
      and last_canary_at is not null and pg_catalog.isfinite(last_canary_at)
      and last_canary_generated_at is not null
      and pg_catalog.isfinite(last_canary_generated_at))
  ),
  constraint crm_integration_cutover_gates_progress_check check (
    (state in ('disabled', 'rolled_back')
      and matched_window_count = 0 and canary_window_count = 0)
    or (state = 'shadow' and canary_window_count = 0)
    or (state = 'canary' and matched_window_count >= 2)
    or (state = 'cutover'
      and matched_window_count >= 2 and canary_window_count >= 2)
  )
);

create table private.crm_qlik_relay_requests (
  id uuid primary key default gen_random_uuid(),
  key_id text not null
    references private.crm_qlik_relay_credentials(key_id) on delete restrict,
  request_id uuid not null,
  nonce_hash text not null,
  body_sha256 text not null,
  relay_mode text not null,
  requested_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  result_status text not null default 'received',
  comparison_status text,
  run_id uuid references public.crm_imob_ranking_runs(id) on delete restrict,
  record_count integer,
  development_record_count integer,
  idempotent boolean not null default false,
  processing_ms integer,
  reason_code text,
  unique (key_id, nonce_hash),
  constraint crm_qlik_relay_requests_hash_check check (
    nonce_hash ~ '^[0-9a-f]{64}$' and body_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_qlik_relay_requests_mode_check
    check (relay_mode in ('shadow', 'canary', 'active')),
  constraint crm_qlik_relay_requests_status_check
    check (result_status in ('received', 'shadow_compared', 'succeeded', 'rejected')),
  constraint crm_qlik_relay_requests_comparison_check
    check (comparison_status is null
      or comparison_status in ('matched', 'mismatch', 'legacy_run_missing')),
  constraint crm_qlik_relay_requests_count_check check (
    (record_count is null or record_count >= 0)
    and (development_record_count is null or development_record_count >= 0)
    and (processing_ms is null or processing_ms >= 0)
  ),
  constraint crm_qlik_relay_requests_temporal_check check (
    pg_catalog.isfinite(requested_at)
    and pg_catalog.isfinite(received_at)
    and (completed_at is null or (
      pg_catalog.isfinite(completed_at) and completed_at >= received_at
    ))
  )
);

create index crm_qlik_relay_requests_health_idx
  on private.crm_qlik_relay_requests (received_at desc, result_status, comparison_status);
create index crm_qlik_relay_requests_key_rate_idx
  on private.crm_qlik_relay_requests (key_id, received_at desc);

create table private.crm_mapping_source_authorities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  entity_kind text not null,
  owner_id uuid not null
    references private.crm_integration_owners(id) on delete restrict,
  apply_enabled boolean not null default false,
  valid_from timestamptz not null,
  valid_until timestamptz,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  evidence_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, entity_kind, owner_id),
  constraint crm_mapping_source_authorities_source_check
    check (source ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_mapping_source_authorities_kind_check check (
    entity_kind in (
      'person', 'organization', 'team', 'portfolio', 'reporting_scope',
      'origin', 'development', 'location'
    )
  ),
  constraint crm_mapping_source_authorities_window_check check (
    pg_catalog.isfinite(valid_from)
    and pg_catalog.isfinite(approved_at)
    and (valid_until is null or (
      pg_catalog.isfinite(valid_until) and valid_until > valid_from
    ))
  ),
  constraint crm_mapping_source_authorities_evidence_check
    check (nullif(btrim(evidence_reference), '') is not null)
);

create table private.crm_mapping_import_batches (
  batch_request_id uuid primary key,
  manifest_hash text not null,
  plan_hash text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  evidence_reference text not null,
  mapping_count integer not null,
  applied_count integer not null,
  created_at timestamptz not null default now(),
  constraint crm_mapping_import_batches_hash_check check (
    manifest_hash ~ '^[0-9a-f]{64}$' and plan_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_mapping_import_batches_count_check check (
    mapping_count > 0 and applied_count between 0 and mapping_count
  ),
  constraint crm_mapping_import_batches_evidence_check
    check (nullif(btrim(evidence_reference), '') is not null)
);

create table private.crm_mapping_import_items (
  batch_request_id uuid not null
    references private.crm_mapping_import_batches(batch_request_id) on delete restrict,
  item_index integer not null,
  command_request_id uuid not null
    references private.crm_mapping_commands(request_id) on delete restrict,
  source_identity_id uuid
    references public.crm_source_identities(id) on delete restrict,
  reconciliation_item_id uuid
    references private.crm_identity_reconciliation_items(id) on delete restrict,
  source text not null,
  entity_kind text not null,
  external_id text not null,
  disposition text not null,
  created_at timestamptz not null default now(),
  primary key (batch_request_id, item_index),
  constraint crm_mapping_import_items_index_check check (item_index > 0),
  constraint crm_mapping_import_items_disposition_check check (
    disposition in (
      'create_verified', 'promote_pending',
      'record_rejection', 'reject_pending', 'close_verified'
    )
  ),
  constraint crm_mapping_import_items_source_check
    check (source ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_mapping_import_items_kind_check check (
    entity_kind in (
      'person', 'organization', 'team', 'portfolio', 'reporting_scope',
      'origin', 'development', 'location'
    )
  ),
  constraint crm_mapping_import_items_external_check
    check (nullif(btrim(external_id), '') is not null)
);

alter table private.crm_qlik_relay_credentials enable row level security;
alter table private.crm_qlik_relay_credentials force row level security;
alter table private.crm_integration_cutover_gates enable row level security;
alter table private.crm_integration_cutover_gates force row level security;
alter table private.crm_qlik_relay_requests enable row level security;
alter table private.crm_qlik_relay_requests force row level security;
alter table private.crm_mapping_source_authorities enable row level security;
alter table private.crm_mapping_source_authorities force row level security;
alter table private.crm_mapping_import_batches enable row level security;
alter table private.crm_mapping_import_batches force row level security;
alter table private.crm_mapping_import_items enable row level security;
alter table private.crm_mapping_import_items force row level security;

revoke all on table
  private.crm_qlik_relay_credentials,
  private.crm_integration_cutover_gates,
  private.crm_qlik_relay_requests,
  private.crm_mapping_source_authorities,
  private.crm_mapping_import_batches,
  private.crm_mapping_import_items
from public, anon, authenticated, service_role, crm_qlik_relay;
revoke all on all sequences in schema private
from public, anon, authenticated, service_role, crm_qlik_relay;

create or replace function private.crm_qlik_relay_role_attributes_safe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_roles role
    where role.rolname = 'crm_qlik_relay'
      and not role.rolsuper
      and not role.rolcreatedb
      and not role.rolcreaterole
      and not role.rolinherit
      and not role.rolreplication
      and not role.rolbypassrls
      and role.rolconnlimit = 2
  );
$$;

alter function private.crm_qlik_relay_role_attributes_safe() owner to postgres;
revoke all privileges on function private.crm_qlik_relay_role_attributes_safe()
from public, anon, authenticated, service_role, crm_qlik_relay;

create or replace function private.crm_qlik_relay_role_isolated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.crm_qlik_relay_role_attributes_safe()
    and not has_schema_privilege('crm_qlik_relay', 'net', 'USAGE')
    and pg_catalog.current_database() = 'postgres'
    and exists (
      select 1
      from pg_catalog.pg_namespace namespace
      where namespace.nspname = 'qlik_relay'
        and pg_catalog.pg_get_userbyid(namespace.nspowner) = 'postgres'
    )
    and not exists (
      select 1
      from pg_catalog.pg_namespace namespace
      cross join lateral pg_catalog.aclexplode(namespace.nspacl) acl
      where namespace.nspname = 'qlik_relay'
        and (
          acl.grantee not in (
            (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
            (select role.oid from pg_catalog.pg_roles role
             where role.rolname = 'crm_qlik_relay')
          )
          or (
            acl.grantee = (
              select role.oid from pg_catalog.pg_roles role
              where role.rolname = 'crm_qlik_relay'
            )
            and (acl.privilege_type <> 'USAGE' or acl.is_grantable)
          )
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_database database_row
      where has_database_privilege('crm_qlik_relay', database_row.oid, 'CREATE')
        or has_database_privilege('crm_qlik_relay', database_row.oid, 'TEMP')
        or (
          database_row.datallowconn
          and database_row.datname <> 'postgres'
          and has_database_privilege('crm_qlik_relay', database_row.oid, 'CONNECT')
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_auth_members membership
      where membership.member = (
        select role.oid from pg_catalog.pg_roles role
        where role.rolname = 'crm_qlik_relay'
      )
        or (
          membership.roleid = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_qlik_relay'
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
          'pg_catalog', 'information_schema', 'public', 'qlik_relay'
        )
        and namespace.nspname !~ '^pg_(toast|temp)_'
        and has_schema_privilege('crm_qlik_relay', namespace.oid, 'USAGE')
    )
    and not exists (
      select 1
      from pg_catalog.pg_namespace namespace
      where namespace.nspname not in ('pg_catalog', 'information_schema')
        and namespace.nspname !~ '^pg_(toast|temp)_'
        and has_schema_privilege('crm_qlik_relay', namespace.oid, 'CREATE')
    )
    and not exists (
      select 1
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace
        on namespace.oid = class.relnamespace
      where class.relkind in ('r', 'p', 'v', 'm', 'f')
        and namespace.nspname not in ('pg_catalog', 'information_schema')
        and has_schema_privilege('crm_qlik_relay', namespace.oid, 'USAGE')
        and (
          has_table_privilege('crm_qlik_relay', class.oid, 'SELECT')
          or has_table_privilege('crm_qlik_relay', class.oid, 'INSERT')
          or has_table_privilege('crm_qlik_relay', class.oid, 'UPDATE')
          or has_table_privilege('crm_qlik_relay', class.oid, 'DELETE')
          or has_table_privilege('crm_qlik_relay', class.oid, 'TRUNCATE')
          or has_table_privilege('crm_qlik_relay', class.oid, 'REFERENCES')
          or has_table_privilege('crm_qlik_relay', class.oid, 'TRIGGER')
          or has_table_privilege('crm_qlik_relay', class.oid, 'MAINTAIN')
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace
        on namespace.oid = class.relnamespace
      where class.relkind = 'S'
        and namespace.nspname not in ('pg_catalog', 'information_schema')
        and has_schema_privilege('crm_qlik_relay', namespace.oid, 'USAGE')
        and (
          has_sequence_privilege('crm_qlik_relay', class.oid, 'USAGE')
          or has_sequence_privilege('crm_qlik_relay', class.oid, 'SELECT')
          or has_sequence_privilege('crm_qlik_relay', class.oid, 'UPDATE')
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_proc function_row
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function_row.pronamespace
      where namespace.nspname not in ('pg_catalog', 'information_schema')
        and has_schema_privilege('crm_qlik_relay', namespace.oid, 'USAGE')
        and has_function_privilege('crm_qlik_relay', function_row.oid, 'EXECUTE')
        and not (
          namespace.nspname = 'qlik_relay'
          and function_row.proname = 'ingest_snapshot'
          and pg_catalog.pg_get_function_identity_arguments(function_row.oid) =
            'p_payload jsonb, p_relay_mode text, p_key_id text, p_requested_at timestamp with time zone, p_nonce_hash text, p_body_sha256 text'
        )
    )
    and pg_catalog.pg_get_userbyid((
      select function_row.proowner
      from pg_catalog.pg_proc function_row
      where function_row.oid = pg_catalog.to_regprocedure(
        'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'
      )
    )) = 'postgres'
    and has_function_privilege(
      'crm_qlik_relay',
      'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)',
      'EXECUTE'
    )
    and not exists (
      select 1
      from pg_catalog.pg_proc function_row
      cross join lateral pg_catalog.aclexplode(function_row.proacl) acl
      where function_row.oid = pg_catalog.to_regprocedure(
          'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'
        )
        and (
          acl.grantee not in (
            (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
            (select role.oid from pg_catalog.pg_roles role
             where role.rolname = 'crm_qlik_relay')
          )
          or (
            acl.grantee = (
              select role.oid from pg_catalog.pg_roles role
              where role.rolname = 'crm_qlik_relay'
            )
            and (acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
          )
        )
    );
$$;

alter function private.crm_qlik_relay_role_isolated() owner to postgres;
revoke all privileges on function private.crm_qlik_relay_role_isolated()
from public, anon, authenticated, service_role, crm_qlik_relay;

create or replace function qlik_relay.ingest_snapshot(
  p_payload jsonb,
  p_relay_mode text,
  p_key_id text,
  p_requested_at timestamptz,
  p_nonce_hash text,
  p_body_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '35s'
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_now timestamptz := clock_timestamp();
  v_credential private.crm_qlik_relay_credentials%rowtype;
  v_gate private.crm_integration_cutover_gates%rowtype;
  v_existing private.crm_qlik_relay_requests%rowtype;
  v_request_id uuid;
  v_reference_year smallint;
  v_generated_at timestamptz;
  v_source_updated_at timestamptz;
  v_record_count integer;
  v_development_count integer;
  v_recent_count integer;
  v_ledger_id uuid;
  v_run public.crm_imob_ranking_runs%rowtype;
  v_incoming_entries_hash text;
  v_stored_entries_hash text;
  v_incoming_developments_hash text;
  v_stored_developments_hash text;
  v_comparison_status text;
  v_request_already_matched boolean;
  v_result jsonb;
  v_reason text;
  v_processing_ms integer;
  v_relay_login_enabled boolean := false;
  v_relay_role_isolated boolean := false;
begin
  select coalesce(role.rolcanlogin, false)
  into v_relay_login_enabled
  from pg_catalog.pg_roles role
  where role.rolname = 'crm_qlik_relay';

  if v_relay_login_enabled
     and session_user in ('postgres', 'crm_qlik_relay') then
    v_relay_role_isolated := private.crm_qlik_relay_role_isolated();
  end if;

  if (v_relay_login_enabled and not v_relay_role_isolated)
     or (
       session_user <> 'postgres'
       and (
         session_user <> 'crm_qlik_relay'
         or not v_relay_login_enabled
       )
     ) then
    return jsonb_build_object(
      'ok', false,
      'status', 'gate_blocked',
      'reason', 'relay_role_not_isolated'
    );
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or pg_column_size(p_payload) > 1000000
     or p_relay_mode is null
     or p_relay_mode not in ('shadow', 'canary', 'active')
     or p_key_id is null
     or length(p_key_id) > 100
     or p_key_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or p_requested_at is null
     or p_nonce_hash is null
     or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_body_sha256 is null
     or p_body_sha256 !~ '^[0-9a-f]{64}$'
     or not pg_catalog.isfinite(p_requested_at) then
    raise exception 'invalid relay metadata' using errcode = '22023';
  end if;

  begin
    v_request_id := (p_payload ->> 'requestId')::uuid;
    v_reference_year := (p_payload ->> 'referenceYear')::smallint;
    v_generated_at := (p_payload ->> 'generatedAt')::timestamptz;
    v_source_updated_at := coalesce(
      (p_payload ->> 'sourceUpdatedAt')::timestamptz,
      v_generated_at
    );
    v_record_count := jsonb_array_length(p_payload -> 'entries');
    v_development_count := jsonb_array_length(
      coalesce(p_payload -> 'developments', '[]'::jsonb)
    );
  exception when others then
    raise exception 'invalid relay payload metadata' using errcode = '22023';
  end;

  if v_request_id is null
     or v_reference_year not between 2020 and 2100
     or not pg_catalog.isfinite(v_generated_at)
     or not pg_catalog.isfinite(v_source_updated_at)
     or v_generated_at > v_now + interval '5 minutes'
     or v_source_updated_at > v_now + interval '5 minutes'
     or v_record_count not between 1 and 5000
     or v_development_count not between 0 and 5000 then
    raise exception 'invalid relay payload metadata' using errcode = '22023';
  end if;

  select credential.* into v_credential
  from private.crm_qlik_relay_credentials credential
  join private.crm_integration_owners owner
    on owner.id = credential.owner_id and owner.is_active
  join private.crm_integration_owners backup_owner
    on backup_owner.id = credential.backup_owner_id and backup_owner.is_active
  where credential.key_id = p_key_id
    and credential.enabled
    and credential.valid_from <= v_now
    and (credential.valid_until is null or credential.valid_until > v_now)
  for update of credential;

  if v_credential.key_id is null
     or abs(extract(epoch from (v_now - p_requested_at)))
       > 300 then
    return jsonb_build_object(
      'ok', false,
      'status', 'gate_blocked',
      'reason', 'cutover_gate_closed'
    );
  end if;

  select request.* into v_existing
  from private.crm_qlik_relay_requests request
  where request.key_id = p_key_id and request.nonce_hash = p_nonce_hash;

  if v_existing.id is not null then
    if v_existing.request_id <> v_request_id
       or v_existing.body_sha256 <> p_body_sha256 then
      if p_relay_mode = 'canary' then
        update private.crm_integration_cutover_gates gate
        set canary_window_count = 0,
            last_canary_request_id = null,
            last_canary_at = null,
            last_canary_generated_at = null,
            updated_at = v_now
        where gate.integration_key = 'qlik_ranking'
          and gate.state = 'canary';
      end if;
      return jsonb_build_object(
        'ok', false,
        'status', 'rejected',
        'reason', 'replay_conflict'
      );
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
      'ok', v_existing.result_status in ('shadow_compared', 'succeeded'),
      'status', v_existing.result_status,
      'runId', v_existing.run_id,
      'recordCount', v_existing.record_count,
      'developmentRecordCount', v_existing.development_record_count,
      'idempotent', v_existing.idempotent,
      'replay', true,
      'comparisonStatus', v_existing.comparison_status,
      'reason', v_existing.reason_code
    ));
  end if;

  select count(*)::integer into v_recent_count
  from private.crm_qlik_relay_requests request
  where request.key_id = p_key_id
    and request.received_at >= v_now - interval '1 minute';

  if v_recent_count >= v_credential.max_requests_per_minute then
    if p_relay_mode = 'canary' then
      update private.crm_integration_cutover_gates gate
      set canary_window_count = 0,
          last_canary_request_id = null,
          last_canary_at = null,
          last_canary_generated_at = null,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking'
        and gate.state = 'canary';
    end if;
    return jsonb_build_object(
      'ok', false,
      'status', 'rejected',
      'reason', 'rate_limited'
    );
  end if;

  select gate.* into v_gate
  from private.crm_integration_cutover_gates gate
  join private.crm_integration_owners owner
    on owner.id = gate.owner_id and owner.is_active
  join private.crm_integration_owners backup_owner
    on backup_owner.id = gate.backup_owner_id and backup_owner.is_active
  where gate.integration_key = 'qlik_ranking'
  for update of gate;

  insert into private.crm_qlik_relay_requests (
    key_id, request_id, nonce_hash, body_sha256, relay_mode,
    requested_at, record_count, development_record_count
  ) values (
    p_key_id, v_request_id, p_nonce_hash, p_body_sha256, p_relay_mode,
    p_requested_at, v_record_count, v_development_count
  ) returning id into v_ledger_id;

  if v_gate.integration_key is null
     or (p_relay_mode = 'shadow' and v_gate.state <> 'shadow')
     or (p_relay_mode = 'canary' and (
       v_gate.state <> 'canary' or v_gate.matched_window_count < 2
     ))
     or (p_relay_mode = 'active' and (
       v_gate.state <> 'cutover' or v_gate.matched_window_count < 2
       or v_gate.canary_window_count < 2
     )) then
    update private.crm_qlik_relay_requests request
    set result_status = 'rejected',
        completed_at = clock_timestamp(),
        processing_ms = greatest(
          0,
          round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::integer
        ),
        reason_code = 'cutover_gate_closed'
    where request.id = v_ledger_id;

    return jsonb_build_object(
      'ok', false,
      'status', 'gate_blocked',
      'reason', 'cutover_gate_closed'
    );
  end if;

  if p_relay_mode = 'shadow' then
    begin
      select run.* into v_run
      from public.crm_imob_ranking_runs run
      where run.id = v_request_id;

      if v_run.id is null then
        v_comparison_status := 'legacy_run_missing';
      else
        select encode(extensions.digest(convert_to(coalesce(jsonb_agg(
          jsonb_build_array(
            entry."periodMonth", entry."imobKey", entry."imobName",
            entry.vgv, entry.contracts,
            entry."sourceRankVgv", entry."sourceRankContracts"
          ) order by entry."periodMonth", entry."imobKey"
        ), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
        into v_incoming_entries_hash
        from jsonb_to_recordset(p_payload -> 'entries') as entry(
          "periodMonth" date,
          "imobKey" text,
          "imobName" text,
          vgv numeric,
          contracts integer,
          "sourceRankVgv" integer,
          "sourceRankContracts" integer
        );

        select encode(extensions.digest(convert_to(coalesce(jsonb_agg(
          jsonb_build_array(
            entry.period_month, entry.imob_key, entry.imob_name,
            entry.vgv, entry.contracts,
            entry.source_rank_vgv, entry.source_rank_contracts
          ) order by entry.period_month, entry.imob_key
        ), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
        into v_stored_entries_hash
        from public.crm_imob_ranking_entries entry
        where entry.run_id = v_request_id;

        select encode(extensions.digest(convert_to(coalesce(jsonb_agg(
          jsonb_build_array(
            development."periodMonth", development."businessUnit",
            development."developmentKey", development."developmentName",
            development.vgv, development.contracts,
            development."sourceRankVgv", development."sourceRankContracts"
          ) order by development."periodMonth", development."businessUnit",
            development."developmentKey"
        ), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
        into v_incoming_developments_hash
        from jsonb_to_recordset(
          coalesce(p_payload -> 'developments', '[]'::jsonb)
        ) as development(
          "periodMonth" date,
          "businessUnit" text,
          "developmentKey" text,
          "developmentName" text,
          vgv numeric,
          contracts integer,
          "sourceRankVgv" integer,
          "sourceRankContracts" integer
        );

        select encode(extensions.digest(convert_to(coalesce(jsonb_agg(
          jsonb_build_array(
            development.period_month, development.business_unit,
            development.development_key, development.development_name,
            development.vgv, development.contracts,
            development.source_rank_vgv, development.source_rank_contracts
          ) order by development.period_month, development.business_unit,
            development.development_key
        ), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
        into v_stored_developments_hash
        from public.crm_imob_ranking_developments development
        where development.run_id = v_request_id;

        v_comparison_status := case when
          v_run.reference_year = v_reference_year
          and v_run.generated_at = v_generated_at
          and v_run.source_updated_at is not distinct from v_source_updated_at
          and v_run.status = 'succeeded'
          and v_run.row_count = v_record_count
          and v_run.development_row_count = v_development_count
          and v_incoming_entries_hash = v_stored_entries_hash
          and v_incoming_developments_hash = v_stored_developments_hash
        then 'matched' else 'mismatch' end;
      end if;
    exception when others then
      v_comparison_status := 'mismatch';
    end;

    select exists (
      select 1
      from private.crm_qlik_relay_requests request
      where request.key_id = p_key_id
        and request.request_id = v_request_id
        and request.id <> v_ledger_id
        and request.result_status = 'shadow_compared'
        and request.comparison_status = 'matched'
    ) into v_request_already_matched;

    if v_comparison_status = 'matched'
       and not v_request_already_matched
       and (
         v_gate.matched_window_count = 0
         or v_generated_at > v_gate.last_matched_generated_at
       ) then
      update private.crm_integration_cutover_gates gate
      set matched_window_count = gate.matched_window_count + 1,
          last_matched_request_id = v_request_id,
          last_matched_at = v_now,
          last_matched_generated_at = v_generated_at,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking';
    elsif v_comparison_status <> 'matched' then
      update private.crm_integration_cutover_gates gate
      set matched_window_count = 0,
          last_matched_request_id = null,
          last_matched_at = null,
          last_matched_generated_at = null,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking';
    end if;

    v_processing_ms := greatest(
      0, round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::integer
    );
    update private.crm_qlik_relay_requests request
    set result_status = 'shadow_compared',
        comparison_status = v_comparison_status,
        run_id = v_run.id,
        completed_at = clock_timestamp(),
        processing_ms = v_processing_ms
    where request.id = v_ledger_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'shadow_compared',
      'runId', v_run.id,
      'recordCount', v_record_count,
      'developmentRecordCount', v_development_count,
      'idempotent', false,
      'replay', false,
      'comparisonStatus', v_comparison_status
    );
  end if;

  begin
    v_result := public.ingest_crm_imob_ranking_snapshot(p_payload);
  exception
    when sqlstate '23505' then v_reason := 'request_conflict';
    when sqlstate '22023' then v_reason := 'invalid_payload';
    when others then v_reason := 'database_unavailable';
  end;

  v_processing_ms := greatest(
    0, round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::integer
  );
  if v_reason is not null then
    if p_relay_mode = 'canary' then
      update private.crm_integration_cutover_gates gate
      set canary_window_count = 0,
          last_canary_request_id = null,
          last_canary_at = null,
          last_canary_generated_at = null,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking'
        and gate.state = 'canary';
    end if;

    update private.crm_qlik_relay_requests request
    set result_status = 'rejected',
        completed_at = clock_timestamp(),
        processing_ms = v_processing_ms,
        reason_code = v_reason
    where request.id = v_ledger_id;

    return jsonb_build_object(
      'ok', false,
      'status', 'rejected',
      'reason', v_reason
    );
  end if;

  update private.crm_qlik_relay_requests request
  set result_status = 'succeeded',
      run_id = (v_result ->> 'runId')::uuid,
      record_count = (v_result ->> 'recordCount')::integer,
      development_record_count = coalesce(
        (v_result ->> 'developmentRecordCount')::integer,
        v_development_count
      ),
      idempotent = coalesce((v_result ->> 'idempotent')::boolean, false),
      completed_at = clock_timestamp(),
      processing_ms = v_processing_ms
  where request.id = v_ledger_id;

  if p_relay_mode = 'canary' then
    if not coalesce((v_result ->> 'idempotent')::boolean, false)
       and (
         v_gate.canary_window_count = 0
         or v_generated_at > v_gate.last_canary_generated_at
       ) then
      update private.crm_integration_cutover_gates gate
      set canary_window_count = gate.canary_window_count + 1,
          last_canary_request_id = v_request_id,
          last_canary_at = v_now,
          last_canary_generated_at = v_generated_at,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking'
        and gate.state = 'canary';
    else
      update private.crm_integration_cutover_gates gate
      set canary_window_count = 0,
          last_canary_request_id = null,
          last_canary_at = null,
          last_canary_generated_at = null,
          updated_at = v_now
      where gate.integration_key = 'qlik_ranking'
        and gate.state = 'canary';
    end if;
  end if;

  return v_result || jsonb_build_object('replay', false);
end;
$$;

alter function qlik_relay.ingest_snapshot(jsonb, text, text, timestamptz, text, text)
  owner to postgres;
revoke all privileges on function
  qlik_relay.ingest_snapshot(jsonb, text, text, timestamptz, text, text)
from public, anon, authenticated, service_role, crm_qlik_relay;
grant execute on function
  qlik_relay.ingest_snapshot(jsonb, text, text, timestamptz, text, text)
to crm_qlik_relay;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(function_row.proacl) acl
    where function_row.oid =
      'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
      and (
        acl.grantee not in (
          (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
          (select role.oid from pg_catalog.pg_roles role
           where role.rolname = 'crm_qlik_relay')
        )
        or (
          acl.grantee = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_qlik_relay'
          )
          and (acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
        )
      )
  ) then
    raise exception 'unsafe qlik relay wrapper ACL'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.get_qlik_relay_health(p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null
     or not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(v_actor, 'crm.ingest.manage'), false) then
    raise exception 'forbidden: relay health is not permitted' using errcode = '42501';
  end if;
  if p_since is null
     or not pg_catalog.isfinite(p_since)
     or p_since < now() - interval '7 days'
     or p_since > now() then
    raise exception 'invalid_argument: unsupported relay health window'
      using errcode = '22023';
  end if;

  return (
    select jsonb_build_object(
      'since', p_since,
      'requestCount', count(*),
      'shadowMatchedCount', count(*) filter (
        where request.result_status = 'shadow_compared'
          and request.comparison_status = 'matched'
      ),
      'shadowMismatchCount', count(*) filter (
        where request.result_status = 'shadow_compared'
          and request.comparison_status <> 'matched'
      ),
      'canarySucceededCount', count(*) filter (
        where request.relay_mode = 'canary'
          and request.result_status = 'succeeded'
          and not request.idempotent
      ),
      'succeededCount', count(*) filter (where request.result_status = 'succeeded'),
      'rejectedCount', count(*) filter (where request.result_status = 'rejected'),
      'lastRequestAt', max(request.received_at),
      'lastSuccessAt', max(request.completed_at) filter (
        where request.result_status = 'succeeded'
      ),
      'relayRoleLoginEnabled', (
        select role.rolcanlogin from pg_catalog.pg_roles role
        where role.rolname = 'crm_qlik_relay'
      ),
      'relayRoleIsolated', private.crm_qlik_relay_role_isolated()
    )
    from private.crm_qlik_relay_requests request
    where request.received_at >= p_since
  );
end;
$$;

alter function public.get_qlik_relay_health(timestamptz) owner to postgres;
revoke all privileges on function public.get_qlik_relay_health(timestamptz)
from public, anon, authenticated, service_role, crm_qlik_relay;
grant execute on function public.get_qlik_relay_health(timestamptz)
to authenticated;

create or replace function private.canonical_crm_mapping_import_manifest(p_payload jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_mapping_text text;
  v_mappings_text text := '';
  v_separator text := '';
begin
  for v_item in
    select item.value
    from jsonb_array_elements(p_payload -> 'mappings') item(value)
    order by convert_to(
      '['
      || to_jsonb(item.value ->> 'source')::text || ','
      || to_jsonb(item.value ->> 'entityKind')::text || ','
      || to_jsonb(item.value ->> 'externalId')::text || ','
      || to_jsonb(item.value ->> 'requestId')::text || ']',
      'UTF8'
    )
  loop
    v_mapping_text :=
      '{"requestId":' || to_jsonb(v_item ->> 'requestId')::text
      || ',"source":' || to_jsonb(v_item ->> 'source')::text
      || ',"entityKind":' || to_jsonb(v_item ->> 'entityKind')::text
      || ',"externalId":' || to_jsonb(v_item ->> 'externalId')::text;

    if v_item ->> 'decision' = 'verify' then
      v_mapping_text := v_mapping_text
        || ',"ownerKey":' || to_jsonb(v_item ->> 'ownerKey')::text
        || ',"targetId":' || to_jsonb(v_item ->> 'targetId')::text
        || ',"decision":"verify"'
        || ',"effectiveFrom":' || to_jsonb(v_item ->> 'effectiveFrom')::text
        || ',"evidenceReference":'
        || to_jsonb(v_item ->> 'evidenceReference')::text;
    else
      v_mapping_text := v_mapping_text || ',"decision":"reject"';
      if v_item ? 'evidenceReference' then
        v_mapping_text := v_mapping_text || ',"evidenceReference":'
          || to_jsonb(v_item ->> 'evidenceReference')::text;
      end if;
    end if;

    v_mapping_text := v_mapping_text
      || ',"reason":' || to_jsonb(v_item ->> 'reason')::text || '}';
    v_mappings_text := v_mappings_text || v_separator || v_mapping_text;
    v_separator := ',';
  end loop;

  return '{"schemaVersion":1'
    || ',"batchRequestId":' || to_jsonb(p_payload ->> 'batchRequestId')::text
    || ',"generatedAt":' || to_jsonb(p_payload ->> 'generatedAt')::text
    || ',"evidenceReference":'
    || to_jsonb(p_payload ->> 'evidenceReference')::text
    || ',"mappings":[' || v_mappings_text || ']}';
end;
$$;

create or replace function private.build_crm_mapping_import_plan(
  p_payload jsonb,
  p_manifest_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_batch_request_id uuid;
  v_generated_at timestamptz;
  v_calculated_manifest_hash text;
  v_plan_hash text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_request_id uuid;
  v_source text;
  v_entity_kind text;
  v_external_id text;
  v_decision text;
  v_owner_key text;
  v_owner_id uuid;
  v_target_id uuid;
  v_effective_from timestamptz;
  v_existing_command private.crm_mapping_commands%rowtype;
  v_existing_identity public.crm_source_identities%rowtype;
  v_existing_target_id uuid;
  v_reconciliation_item_id uuid;
  v_disposition text;
  v_reason_code text;
  v_authority_count integer;
  v_target_available boolean;
  v_item_index integer := 0;
  v_conflict_count integer := 0;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array[
       'schemaVersion', 'batchRequestId', 'generatedAt',
       'evidenceReference', 'mappings'
     ])
     or (select count(*) from jsonb_object_keys(p_payload)) <> 5
     or jsonb_typeof(p_payload -> 'schemaVersion') <> 'number'
     or p_payload ->> 'schemaVersion' <> '1'
     or jsonb_typeof(p_payload -> 'batchRequestId') <> 'string'
     or jsonb_typeof(p_payload -> 'generatedAt') <> 'string'
     or jsonb_typeof(p_payload -> 'evidenceReference') <> 'string'
     or jsonb_typeof(p_payload -> 'mappings') <> 'array'
     or jsonb_array_length(p_payload -> 'mappings') not between 1 and 500
     or nullif(btrim(coalesce(p_payload ->> 'evidenceReference', '')), '') is null
     or p_payload ->> 'evidenceReference' <>
       btrim(p_payload ->> 'evidenceReference')
     or length(p_payload ->> 'evidenceReference') > 1000
     or (p_payload ->> 'evidenceReference') ~ '[[:cntrl:]]'
     or p_manifest_hash is null
     or p_manifest_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_argument: invalid mapping import manifest'
      using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'generatedAt', '') !~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'invalid_argument: invalid mapping import timestamp'
      using errcode = '22023';
  end if;

  begin
    v_batch_request_id := (p_payload ->> 'batchRequestId')::uuid;
    v_generated_at := (p_payload ->> 'generatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_argument: invalid mapping import identifiers'
      using errcode = '22023';
  end;

  if v_batch_request_id is null
     or p_payload ->> 'batchRequestId' <> v_batch_request_id::text then
    raise exception 'invalid_argument: invalid mapping import identifiers'
      using errcode = '22023';
  end if;

  if not pg_catalog.isfinite(v_generated_at)
     or v_generated_at > now() + interval '5 minutes' then
    raise exception 'invalid_argument: invalid mapping import timestamp'
      using errcode = '22023';
  end if;

  -- Validate the complete JSON shape before canonicalization. PostgreSQL text
  -- concatenation propagates NULL, so canonical hashing must never receive a
  -- nullable or non-string field that the TypeScript contract rejects.
  for v_item in
    select item.value
    from jsonb_array_elements(p_payload -> 'mappings') item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_argument: invalid mapping import item shape'
        using errcode = '22023';
    end if;

    v_decision := v_item ->> 'decision';
    if not (v_item ?& array[
         'requestId', 'source', 'entityKind', 'externalId', 'decision', 'reason'
       ])
       or jsonb_typeof(v_item -> 'requestId') <> 'string'
       or jsonb_typeof(v_item -> 'source') <> 'string'
       or jsonb_typeof(v_item -> 'entityKind') <> 'string'
       or jsonb_typeof(v_item -> 'externalId') <> 'string'
       or jsonb_typeof(v_item -> 'decision') <> 'string'
       or jsonb_typeof(v_item -> 'reason') <> 'string'
       or (
         v_decision = 'verify'
         and (
           not (v_item ?& array[
             'ownerKey', 'targetId', 'effectiveFrom', 'evidenceReference'
           ])
           or (select count(*) from jsonb_object_keys(v_item)) <> 10
           or jsonb_typeof(v_item -> 'ownerKey') <> 'string'
           or jsonb_typeof(v_item -> 'targetId') <> 'string'
           or jsonb_typeof(v_item -> 'effectiveFrom') <> 'string'
           or jsonb_typeof(v_item -> 'evidenceReference') <> 'string'
         )
       )
       or (
         v_decision = 'reject'
         and (
           (select count(*) from jsonb_object_keys(v_item)) not between 6 and 7
           or exists (
             select 1 from jsonb_object_keys(v_item) key
             where key not in (
               'requestId', 'source', 'entityKind', 'externalId',
               'decision', 'evidenceReference', 'reason'
             )
           )
           or (
             v_item ? 'evidenceReference'
             and (
               jsonb_typeof(v_item -> 'evidenceReference') <> 'string'
               or nullif(btrim(v_item ->> 'evidenceReference'), '') is null
             )
           )
         )
       )
       or v_decision not in ('verify', 'reject') then
      raise exception 'invalid_argument: invalid mapping import item shape'
        using errcode = '22023';
    end if;
  end loop;

  v_calculated_manifest_hash := encode(extensions.digest(
    convert_to(private.canonical_crm_mapping_import_manifest(p_payload), 'UTF8'),
    'sha256'
  ), 'hex');
  if v_calculated_manifest_hash is null
     or v_calculated_manifest_hash <> p_manifest_hash then
    raise exception 'conflict: mapping manifest hash mismatch' using errcode = '23505';
  end if;

  if exists (
       select 1
       from jsonb_array_elements(p_payload -> 'mappings') item(value)
       group by item.value ->> 'requestId'
       having count(*) > 1
     )
     or exists (
       select 1
       from jsonb_array_elements(p_payload -> 'mappings') item(value)
       group by item.value ->> 'source', item.value ->> 'entityKind',
         item.value ->> 'externalId'
       having count(*) > 1
     ) then
    raise exception 'invalid_argument: duplicate mapping import identities'
      using errcode = '22023';
  end if;

  for v_item in
    select item.value
    from jsonb_array_elements(p_payload -> 'mappings') item(value)
    order by convert_to(
      '['
      || to_jsonb(item.value ->> 'source')::text || ','
      || to_jsonb(item.value ->> 'entityKind')::text || ','
      || to_jsonb(item.value ->> 'externalId')::text || ','
      || to_jsonb(item.value ->> 'requestId')::text || ']',
      'UTF8'
    )
  loop
    v_item_index := v_item_index + 1;
    v_decision := btrim(coalesce(v_item ->> 'decision', ''));
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array[
         'requestId', 'source', 'entityKind', 'externalId', 'decision', 'reason'
       ])
       or (
         v_decision = 'verify'
         and (
           not (v_item ?& array[
             'ownerKey', 'targetId', 'effectiveFrom', 'evidenceReference'
           ])
           or (select count(*) from jsonb_object_keys(v_item)) <> 10
         )
       )
       or (
         v_decision = 'reject'
         and (
           (select count(*) from jsonb_object_keys(v_item)) not between 6 and 7
           or exists (
             select 1 from jsonb_object_keys(v_item) key
             where key not in (
               'requestId', 'source', 'entityKind', 'externalId',
               'decision', 'evidenceReference', 'reason'
             )
           )
           or (
             v_item ? 'evidenceReference'
             and (
               jsonb_typeof(v_item -> 'evidenceReference') <> 'string'
               or nullif(btrim(v_item ->> 'evidenceReference'), '') is null
             )
           )
         )
       )
       or v_decision not in ('verify', 'reject') then
      raise exception 'invalid_argument: invalid mapping import item shape'
        using errcode = '22023';
    end if;

    v_source := btrim(coalesce(v_item ->> 'source', ''));
    v_entity_kind := btrim(coalesce(v_item ->> 'entityKind', ''));
    v_external_id := btrim(coalesce(v_item ->> 'externalId', ''));
    v_owner_key := nullif(btrim(coalesce(v_item ->> 'ownerKey', '')), '');

    begin
      v_request_id := (v_item ->> 'requestId')::uuid;
      v_target_id := nullif(v_item ->> 'targetId', '')::uuid;
      v_effective_from := nullif(v_item ->> 'effectiveFrom', '')::timestamptz;
    exception when others then
      raise exception 'invalid_argument: invalid mapping import item identifiers'
        using errcode = '22023';
    end;

    if v_request_id is null
       or v_item ->> 'requestId' <> v_request_id::text
       or v_item ->> 'source' <> v_source
       or v_item ->> 'entityKind' <> v_entity_kind
       or v_item ->> 'externalId' <> v_external_id
       or v_item ->> 'reason' <> btrim(v_item ->> 'reason')
       or (
         v_item ? 'evidenceReference'
         and v_item ->> 'evidenceReference' <>
           btrim(v_item ->> 'evidenceReference')
       )
       or v_source !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
       or length(v_source) > 100
       or v_entity_kind not in (
         'person', 'organization', 'team', 'portfolio', 'reporting_scope',
         'origin', 'development', 'location'
       )
       or v_external_id = '' or length(v_external_id) > 300
       or v_external_id ~ '[[:cntrl:]]'
       or nullif(btrim(coalesce(v_item ->> 'reason', '')), '') is null
       or length(v_item ->> 'reason') > 300
       or (v_item ->> 'reason') ~ '[[:cntrl:]]'
       or length(coalesce(v_item ->> 'evidenceReference', '')) > 1000
       or coalesce(v_item ->> 'evidenceReference', '') ~ '[[:cntrl:]]'
       or (
         v_decision = 'verify' and (
           v_owner_key is null or v_owner_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
           or v_item ->> 'ownerKey' <> v_owner_key
           or length(v_owner_key) > 100
           or v_target_id is null
           or v_item ->> 'targetId' <> v_target_id::text
           or v_effective_from is null
           or coalesce(v_item ->> 'effectiveFrom', '') !~
             '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
           or not pg_catalog.isfinite(v_effective_from)
           or v_effective_from > now() + interval '5 minutes'
           or nullif(btrim(coalesce(v_item ->> 'evidenceReference', '')), '') is null
         )
       )
       or (
         v_decision = 'reject'
         and (v_target_id is not null or v_effective_from is not null or v_owner_key is not null)
       ) then
      raise exception 'invalid_argument: incomplete mapping import item'
        using errcode = '22023';
    end if;

    v_disposition := null;
    v_reason_code := null;
    v_owner_id := null;
    v_existing_command := null;
    v_existing_identity := null;
    v_existing_target_id := null;
    v_reconciliation_item_id := null;

    select command.* into v_existing_command
    from private.crm_mapping_commands command
    where command.request_id = v_request_id;

    if v_existing_command.request_id is not null then
      v_disposition := 'conflict';
      v_reason_code := 'request_id_reused';
    else
      select identity.* into v_existing_identity
      from public.crm_source_identities identity
      where identity.source = v_source
        and identity.entity_kind = v_entity_kind
        and identity.external_id = v_external_id
        and identity.valid_until is null;

      v_existing_target_id := case v_entity_kind
        when 'person' then v_existing_identity.person_id
        when 'organization' then v_existing_identity.organization_id
        when 'team' then v_existing_identity.team_id
        when 'portfolio' then v_existing_identity.portfolio_id
        when 'reporting_scope' then v_existing_identity.reporting_scope_id
        when 'origin' then v_existing_identity.origin_id
        when 'development' then v_existing_identity.development_id
        when 'location' then v_existing_identity.location_id
      end;

      select item.id into v_reconciliation_item_id
      from private.crm_identity_reconciliation_items item
      where item.source = v_source
        and item.entity_kind = v_entity_kind
        and item.external_id = v_external_id;

      if v_decision = 'verify' then
        select owner.id into v_owner_id
        from private.crm_integration_owners owner
        where owner.owner_key = v_owner_key and owner.is_active;

        v_target_available := case v_entity_kind
          when 'person' then exists (
            select 1 from public.crm_people target
            where target.id = v_target_id and target.is_active
          )
          when 'organization' then exists (
            select 1 from public.crm_organizations target
            where target.id = v_target_id and target.is_active
          )
          when 'team' then exists (
            select 1 from public.crm_teams target
            where target.id = v_target_id and target.is_active
          )
          when 'portfolio' then exists (
            select 1 from public.crm_portfolios target
            where target.id = v_target_id and target.is_active
          )
          when 'reporting_scope' then exists (
            select 1 from public.crm_reporting_scopes target
            where target.id = v_target_id and target.is_active
          )
          when 'origin' then exists (
            select 1 from public.crm_origins target
            where target.id = v_target_id and target.is_active
          )
          when 'development' then exists (
            select 1 from public.crm_developments target
            where target.id = v_target_id and target.is_active
          )
          when 'location' then exists (
            select 1 from public.crm_locations target
            where target.id = v_target_id and target.is_active
          )
          else false
        end;

        select count(*)::integer into v_authority_count
        from private.crm_mapping_source_authorities authority
        where authority.source = v_source
          and authority.entity_kind = v_entity_kind
          and authority.owner_id = v_owner_id
          and authority.apply_enabled
          and authority.valid_from <= now()
          and (authority.valid_until is null or authority.valid_until > now());

        if v_owner_id is null then
          v_disposition := 'conflict';
          v_reason_code := 'mapping_owner_missing';
        elsif not v_target_available then
          v_disposition := 'conflict';
          v_reason_code := 'mapping_target_unavailable';
        elsif v_authority_count <> 1 then
          v_disposition := 'conflict';
          v_reason_code := 'mapping_authority_missing';
        elsif v_existing_identity.id is null then
          if exists (
            select 1 from public.crm_source_identities identity
            where identity.source = v_source
              and identity.entity_kind = v_entity_kind
              and identity.external_id = v_external_id
              and tstzrange(identity.valid_from, identity.valid_until, '[)')
                && tstzrange(v_effective_from, null, '[)')
          ) then
            v_disposition := 'conflict';
            v_reason_code := 'mapping_window_conflict';
          else
            v_disposition := 'create_verified';
          end if;
        elsif v_existing_identity.mapping_status = 'pending'
              and v_existing_target_id = v_target_id then
          if exists (
            select 1 from public.crm_source_identities identity
            where identity.id <> v_existing_identity.id
              and identity.source = v_source
              and identity.entity_kind = v_entity_kind
              and identity.external_id = v_external_id
              and tstzrange(identity.valid_from, identity.valid_until, '[)')
                && tstzrange(v_effective_from, v_existing_identity.valid_until, '[)')
          ) then
            v_disposition := 'conflict';
            v_reason_code := 'mapping_window_conflict';
          else
            v_disposition := 'promote_pending';
          end if;
        else
          v_disposition := 'conflict';
          v_reason_code := 'active_mapping_conflict';
        end if;
      else
        select count(*)::integer into v_authority_count
        from private.crm_mapping_source_authorities authority
        join private.crm_integration_owners owner
          on owner.id = authority.owner_id and owner.is_active
        where authority.source = v_source
          and authority.entity_kind = v_entity_kind
          and authority.apply_enabled
          and authority.valid_from <= now()
          and (authority.valid_until is null or authority.valid_until > now())
          and (
            v_existing_identity.mapping_owner_id is null
            or authority.owner_id = v_existing_identity.mapping_owner_id
          );

        if v_authority_count <> 1 then
          v_disposition := 'conflict';
          v_reason_code := case when v_authority_count = 0
            then 'mapping_authority_missing' else 'mapping_authority_ambiguous' end;
        elsif v_existing_identity.id is null then
          v_disposition := 'record_rejection';
        elsif v_existing_identity.mapping_status = 'verified' then
          v_disposition := 'close_verified';
        else
          v_disposition := 'reject_pending';
        end if;
      end if;
    end if;

    if v_disposition = 'conflict' then
      v_conflict_count := v_conflict_count + 1;
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'requestId', v_request_id,
      'source', v_source,
      'entityKind', v_entity_kind,
      'externalId', v_external_id,
      'disposition', v_disposition,
      'reasonCode', v_reason_code,
      'sourceIdentityId', coalesce(
        v_existing_command.source_identity_id, v_existing_identity.id
      ),
      'reconciliationItemId', coalesce(
        v_existing_command.reconciliation_item_id, v_reconciliation_item_id
      )
    ));
  end loop;

  v_plan_hash := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'manifestHash', p_manifest_hash,
      'items', v_items
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  return jsonb_build_object(
    'ok', v_conflict_count = 0,
    'mode', 'preview',
    'ready', v_conflict_count = 0,
    'manifestHash', p_manifest_hash,
    'planHash', v_plan_hash,
    'mappingCount', v_item_index,
    'conflictCount', v_conflict_count,
    'appliedCount', 0,
    'noop', false,
    'items', v_items
  );
end;
$$;

revoke all privileges on function private.canonical_crm_mapping_import_manifest(jsonb)
from public, anon, authenticated, service_role, crm_qlik_relay;
revoke all privileges on function private.build_crm_mapping_import_plan(jsonb, text)
from public, anon, authenticated, service_role, crm_qlik_relay;
revoke all privileges on function public.review_crm_source_identity_mapping(jsonb)
from public, anon, authenticated, service_role, crm_qlik_relay;
comment on function public.review_crm_source_identity_mapping(jsonb) is
  'Owner-only mapping mutation primitive. Data API callers must use the authority-gated preview/apply import contract.';

create or replace function public.preview_crm_source_identity_mapping_import(
  p_payload jsonb,
  p_manifest_hash text
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
begin
  if v_actor is null
     or not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(v_actor, 'crm.ingest.manage'), false) then
    raise exception 'forbidden: mapping import preview is not permitted'
      using errcode = '42501';
  end if;

  return private.build_crm_mapping_import_plan(p_payload, p_manifest_hash);
end;
$$;

create or replace function public.apply_crm_source_identity_mapping_import(
  p_payload jsonb,
  p_manifest_hash text,
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
  v_batch_request_id uuid;
  v_existing_batch private.crm_mapping_import_batches%rowtype;
  v_plan jsonb;
  v_item jsonb;
  v_plan_item jsonb;
  v_review_result jsonb;
  v_result_items jsonb := '[]'::jsonb;
  v_item_index integer := 0;
  v_applied_count integer := 0;
  v_source_identity_id uuid;
  v_reconciliation_item_id uuid;
  v_request_lock text;
  v_source_lock text;
begin
  if v_actor is null
     or not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(v_actor, 'crm.ingest.manage'), false) then
    raise exception 'forbidden: mapping import apply is not permitted'
      using errcode = '42501';
  end if;
  if p_expected_plan_hash is null
     or p_expected_plan_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_argument: invalid expected mapping plan hash'
      using errcode = '22023';
  end if;

  begin
    v_batch_request_id := (p_payload ->> 'batchRequestId')::uuid;
  exception when others then
    raise exception 'invalid_argument: invalid mapping batch request id'
      using errcode = '22023';
  end;
  if v_batch_request_id is null then
    raise exception 'invalid_argument: invalid mapping batch request id'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'crm-mapping-import-batch:' || v_batch_request_id::text, 0
    )
  );

  select batch.* into v_existing_batch
  from private.crm_mapping_import_batches batch
  where batch.batch_request_id = v_batch_request_id;

  if v_existing_batch.batch_request_id is not null then
    -- A historical batch may return its recorded result even after mapping
    -- state changes, but never for a different or malformed supplied body.
    v_plan := private.build_crm_mapping_import_plan(p_payload, p_manifest_hash);
    if v_existing_batch.manifest_hash <> p_manifest_hash
       or v_existing_batch.plan_hash <> p_expected_plan_hash then
      raise exception 'conflict: mapping batch request id was reused'
        using errcode = '23505';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'requestId', item.command_request_id,
      'source', item.source,
      'entityKind', item.entity_kind,
      'externalId', item.external_id,
      'disposition', item.disposition,
      'reasonCode', null,
      'sourceIdentityId', item.source_identity_id,
      'reconciliationItemId', item.reconciliation_item_id
    ) order by item.item_index), '[]'::jsonb)
    into v_result_items
    from private.crm_mapping_import_items item
    where item.batch_request_id = v_batch_request_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'apply',
      'ready', true,
      'manifestHash', v_existing_batch.manifest_hash,
      'planHash', v_existing_batch.plan_hash,
      'mappingCount', v_existing_batch.mapping_count,
      'conflictCount', 0,
      'appliedCount', v_existing_batch.applied_count,
      'noop', true,
      'items', v_result_items
    );
  end if;

  for v_request_lock in
    select request_row.request_value
    from (
      select distinct item.value ->> 'requestId' as request_value
      from jsonb_array_elements(p_payload -> 'mappings') item(value)
    ) request_row
    order by request_row.request_value collate "C"
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'crm-mapping-request:' || v_request_lock, 0
      )
    );
  end loop;

  for v_source_lock in
    select source_row.source_value
    from (
      select distinct item.value ->> 'source' as source_value
      from jsonb_array_elements(p_payload -> 'mappings') item(value)
    ) source_row
    order by source_row.source_value collate "C"
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'crm-source-identities:' || v_source_lock, 0
      )
    );
  end loop;

  for v_item in
    select item.value
    from jsonb_array_elements(p_payload -> 'mappings') item(value)
    order by convert_to(
      '['
      || to_jsonb(item.value ->> 'source')::text || ','
      || to_jsonb(item.value ->> 'entityKind')::text || ','
      || to_jsonb(item.value ->> 'externalId')::text || ','
      || to_jsonb(item.value ->> 'requestId')::text || ']',
      'UTF8'
    )
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'crm-source-identity:' || (v_item ->> 'source') || ':'
        || (v_item ->> 'entityKind') || ':' || (v_item ->> 'externalId'),
        0
      )
    );
  end loop;

  lock table
    private.crm_mapping_source_authorities,
    private.crm_integration_owners,
    public.crm_people,
    public.crm_organizations,
    public.crm_teams,
    public.crm_portfolios,
    public.crm_reporting_scopes,
    public.crm_origins,
    public.crm_developments,
    public.crm_locations
  in share mode;

  v_plan := private.build_crm_mapping_import_plan(p_payload, p_manifest_hash);
  if v_plan ->> 'planHash' <> p_expected_plan_hash then
    raise exception 'conflict: mapping import plan is stale' using errcode = '23505';
  end if;
  if coalesce((v_plan ->> 'ready')::boolean, false) is not true then
    raise exception 'conflict: mapping import plan contains conflicts'
      using errcode = '23505';
  end if;

  insert into private.crm_mapping_import_batches (
    batch_request_id, manifest_hash, plan_hash, actor_user_id,
    evidence_reference, mapping_count, applied_count
  ) values (
    v_batch_request_id,
    p_manifest_hash,
    p_expected_plan_hash,
    v_actor,
    p_payload ->> 'evidenceReference',
    (v_plan ->> 'mappingCount')::integer,
    0
  );

  for v_item in
    select item.value
    from jsonb_array_elements(p_payload -> 'mappings') item(value)
    order by convert_to(
      '['
      || to_jsonb(item.value ->> 'source')::text || ','
      || to_jsonb(item.value ->> 'entityKind')::text || ','
      || to_jsonb(item.value ->> 'externalId')::text || ','
      || to_jsonb(item.value ->> 'requestId')::text || ']',
      'UTF8'
    )
  loop
    v_item_index := v_item_index + 1;
    select plan_item.value into strict v_plan_item
    from jsonb_array_elements(v_plan -> 'items') plan_item(value)
    where plan_item.value ->> 'requestId' = v_item ->> 'requestId';

    v_review_result := public.review_crm_source_identity_mapping(v_item);
    v_source_identity_id := nullif(
      v_review_result ->> 'sourceIdentityId', ''
    )::uuid;
    v_reconciliation_item_id := nullif(
      v_review_result ->> 'reconciliationItemId', ''
    )::uuid;

    v_applied_count := v_applied_count + 1;

    insert into private.crm_mapping_import_items (
      batch_request_id, item_index, command_request_id,
      source_identity_id, reconciliation_item_id,
      source, entity_kind, external_id, disposition
    ) values (
      v_batch_request_id,
      v_item_index,
      (v_item ->> 'requestId')::uuid,
      v_source_identity_id,
      v_reconciliation_item_id,
      v_item ->> 'source',
      v_item ->> 'entityKind',
      v_item ->> 'externalId',
      v_plan_item ->> 'disposition'
    );

    v_result_items := v_result_items || jsonb_build_array(jsonb_build_object(
      'requestId', v_item ->> 'requestId',
      'source', v_item ->> 'source',
      'entityKind', v_item ->> 'entityKind',
      'externalId', v_item ->> 'externalId',
      'disposition', v_plan_item ->> 'disposition',
      'reasonCode', null,
      'sourceIdentityId', v_source_identity_id,
      'reconciliationItemId', v_reconciliation_item_id
    ));
  end loop;

  update private.crm_mapping_import_batches batch
  set applied_count = v_applied_count
  where batch.batch_request_id = v_batch_request_id;

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'integration.mapping_import_apply',
    jsonb_build_object('batch_request_id', v_batch_request_id),
    jsonb_build_object(
      'manifest_hash', p_manifest_hash,
      'plan_hash', p_expected_plan_hash,
      'mapping_count', v_item_index,
      'applied_count', v_applied_count
    )
  );

  return jsonb_build_object(
    'ok', true,
    'mode', 'apply',
    'ready', true,
    'manifestHash', p_manifest_hash,
    'planHash', p_expected_plan_hash,
    'mappingCount', v_item_index,
    'conflictCount', 0,
    'appliedCount', v_applied_count,
    'noop', false,
    'items', v_result_items
  );
end;
$$;

alter function public.preview_crm_source_identity_mapping_import(jsonb, text)
  owner to postgres;
alter function public.apply_crm_source_identity_mapping_import(jsonb, text, text)
  owner to postgres;
revoke all privileges on function
  public.preview_crm_source_identity_mapping_import(jsonb, text)
from public, anon, authenticated, service_role, crm_qlik_relay;
revoke all privileges on function
  public.apply_crm_source_identity_mapping_import(jsonb, text, text)
from public, anon, authenticated, service_role, crm_qlik_relay;
grant execute on function
  public.preview_crm_source_identity_mapping_import(jsonb, text)
to authenticated;
grant execute on function
  public.apply_crm_source_identity_mapping_import(jsonb, text, text)
to authenticated;

comment on role crm_qlik_relay is
  'NOLOGIN least-privilege role for the CRM-owned Qlik relay. Credential provisioning is a separate authorized operation.';
comment on table private.crm_qlik_relay_credentials is
  'Empty-by-default relay credential registry. Activation requires two active owners, evidence, validity and an explicit technical rate cap.';
comment on table private.crm_integration_cutover_gates is
  'Fail-closed operational gate for shadow, canary, cutover and rollback evidence. No real gate is seeded.';
comment on table private.crm_qlik_relay_requests is
  'Sanitized nonce/body hashes and outcomes for distributed replay control and relay health; raw payloads, credentials and signatures are never stored.';
comment on function qlik_relay.ingest_snapshot(jsonb, text, text, timestamptz, text, text) is
  'Single RPC executable by crm_qlik_relay: any LOGIN fails closed until inherited platform privileges are removed; shadow compares without facts and canary/active require a separately approved cutover gate.';
comment on table private.crm_mapping_source_authorities is
  'Empty-by-default allowlist for source/entity/owner mapping imports. apply_enabled is a database kill switch.';
comment on function public.preview_crm_source_identity_mapping_import(jsonb, text) is
  'Master-only, read-only mapping batch preview with deterministic manifest/plan hashes and typed conflicts.';
comment on function public.apply_crm_source_identity_mapping_import(jsonb, text, text) is
  'Master-only atomic mapping batch apply. Requires an unchanged plan plus active source authorities; no canonical targets or owners are created.';
