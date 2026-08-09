-- Integration identity governance and reporting-grant lineage.
-- Additive/local only: no remote caller cutover is performed by this migration.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists private.crm_integration_owners (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null unique,
  display_name text not null,
  owner_kind text not null,
  auth_user_id uuid references auth.users(id) on delete restrict,
  process_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_integration_owners_key_check
    check (owner_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_integration_owners_name_check
    check (nullif(btrim(display_name), '') is not null),
  constraint crm_integration_owners_kind_check
    check (owner_kind in ('user', 'team', 'process', 'vendor')),
  constraint crm_integration_owners_target_check check (
    (owner_kind = 'user' and auth_user_id is not null and process_key is null)
    or
    (owner_kind = 'process' and auth_user_id is null
      and process_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$')
    or
    (owner_kind in ('team', 'vendor') and auth_user_id is null)
  )
);

create table if not exists public.crm_origins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.crm_organizations(id) on delete restrict,
  origin_key text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, origin_key),
  constraint crm_origins_key_check
    check (origin_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_origins_name_check check (nullif(btrim(name), '') is not null)
);

create index if not exists crm_origins_organization_active_idx
  on public.crm_origins (organization_id, is_active, id);

create table if not exists public.crm_developments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.crm_organizations(id) on delete restrict,
  development_key text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, development_key),
  constraint crm_developments_key_check
    check (development_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_developments_name_check
    check (nullif(btrim(name), '') is not null)
);

create index if not exists crm_developments_organization_active_idx
  on public.crm_developments (organization_id, is_active, id);

create table if not exists public.crm_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.crm_organizations(id) on delete restrict,
  location_key text not null,
  name text not null,
  location_kind text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, location_key),
  constraint crm_locations_key_check
    check (location_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_locations_name_check check (nullif(btrim(name), '') is not null),
  constraint crm_locations_kind_check check (location_kind in ('region', 'stand'))
);

create index if not exists crm_locations_organization_active_idx
  on public.crm_locations (organization_id, location_kind, is_active, id);

alter table public.crm_source_identities
  add column if not exists team_id uuid
    references public.crm_teams(id) on delete restrict,
  add column if not exists portfolio_id uuid
    references public.crm_portfolios(id) on delete restrict,
  add column if not exists reporting_scope_id uuid
    references public.crm_reporting_scopes(id) on delete restrict,
  add column if not exists origin_id uuid
    references public.crm_origins(id) on delete restrict,
  add column if not exists development_id uuid
    references public.crm_developments(id) on delete restrict,
  add column if not exists location_id uuid
    references public.crm_locations(id) on delete restrict,
  add column if not exists mapping_status text not null default 'pending',
  add column if not exists mapping_owner_id uuid
    references private.crm_integration_owners(id) on delete restrict,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete restrict,
  add column if not exists evidence_reference text,
  add column if not exists rejection_reason text,
  add column if not exists reconciliation_request_id uuid,
  add column if not exists updated_at timestamptz not null default now();

update public.crm_source_identities
set valid_from = created_at
where valid_from is null;

alter table public.crm_source_identities
  alter column valid_from set default now(),
  alter column valid_from set not null;

alter table public.crm_source_identities
  drop constraint if exists crm_source_identities_person_id_fkey,
  drop constraint if exists crm_source_identities_organization_id_fkey,
  add constraint crm_source_identities_person_id_fkey
    foreign key (person_id) references public.crm_people(id) on delete restrict,
  add constraint crm_source_identities_organization_id_fkey
    foreign key (organization_id) references public.crm_organizations(id) on delete restrict,
  drop constraint if exists crm_source_identities_source_entity_kind_external_id_key,
  drop constraint if exists crm_source_identities_target_check,
  add constraint crm_source_identities_status_check
    check (mapping_status in ('pending', 'verified', 'rejected')),
  add constraint crm_source_identities_window_check check (
    pg_catalog.isfinite(valid_from)
    and (
      valid_until is null
      or (pg_catalog.isfinite(valid_until) and valid_until > valid_from)
    )
  ),
  add constraint crm_source_identities_target_check check (
    (entity_kind = 'person' and person_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'organization' and organization_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'team' and team_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'portfolio' and portfolio_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'reporting_scope' and reporting_scope_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'origin' and origin_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'development' and development_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
    or
    (entity_kind = 'location' and location_id is not null
      and num_nonnulls(
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id
      ) = 1)
  ),
  add constraint crm_source_identities_verification_check check (
    (mapping_status <> 'verified')
    or (
      mapping_owner_id is not null
      and verified_at is not null
      and verified_by is not null
      and nullif(btrim(coalesce(evidence_reference, '')), '') is not null
      and rejection_reason is null
    )
  ),
  add constraint crm_source_identities_rejection_check check (
    mapping_status <> 'rejected'
    or nullif(btrim(coalesce(rejection_reason, '')), '') is not null
  );

create unique index if not exists crm_source_identities_active_external_unique
  on public.crm_source_identities (source, entity_kind, external_id)
  where valid_until is null;
create index if not exists crm_source_identities_verified_lookup_idx
  on public.crm_source_identities (source, entity_kind, external_id, valid_from, valid_until)
  where mapping_status = 'verified';
create index if not exists crm_source_identities_team_idx
  on public.crm_source_identities (team_id) where team_id is not null;
create index if not exists crm_source_identities_portfolio_idx
  on public.crm_source_identities (portfolio_id) where portfolio_id is not null;
create index if not exists crm_source_identities_reporting_scope_idx
  on public.crm_source_identities (reporting_scope_id)
  where reporting_scope_id is not null;
create index if not exists crm_source_identities_origin_idx
  on public.crm_source_identities (origin_id) where origin_id is not null;
create index if not exists crm_source_identities_development_idx
  on public.crm_source_identities (development_id) where development_id is not null;
create index if not exists crm_source_identities_location_idx
  on public.crm_source_identities (location_id) where location_id is not null;

create table if not exists private.crm_source_identity_history (
  id bigint generated always as identity primary key,
  source_identity_id uuid not null
    references public.crm_source_identities(id) on delete restrict,
  event_type text not null,
  previous_record jsonb,
  current_record jsonb,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_process text not null,
  created_at timestamptz not null default now(),
  constraint crm_source_identity_history_event_check
    check (event_type in ('created', 'updated', 'closed')),
  constraint crm_source_identity_history_process_check
    check (nullif(btrim(actor_process), '') is not null)
);

create index if not exists crm_source_identity_history_identity_idx
  on private.crm_source_identity_history (source_identity_id, created_at desc, id desc);

insert into private.crm_source_identity_history (
  source_identity_id, event_type, current_record, actor_process
)
select
  identity.id,
  'created',
  to_jsonb(identity),
  'migration:20260809181422_integration_identity_governance'
from public.crm_source_identities identity
where not exists (
  select 1
  from private.crm_source_identity_history history
  where history.source_identity_id = identity.id
)
order by identity.created_at, identity.id;

create table if not exists private.crm_identity_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  entity_kind text not null,
  external_id text not null,
  observed_label text,
  source_record_id text,
  status text not null default 'pending',
  reason_code text not null,
  owner_id uuid references private.crm_integration_owners(id) on delete restrict,
  source_identity_id uuid
    references public.crm_source_identities(id) on delete restrict,
  reconciliation_run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  unique (source, entity_kind, external_id),
  constraint crm_identity_reconciliation_source_check
    check (source ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_identity_reconciliation_external_check
    check (nullif(btrim(external_id), '') is not null),
  constraint crm_identity_reconciliation_status_check
    check (status in ('pending', 'assigned', 'resolved', 'rejected')),
  constraint crm_identity_reconciliation_count_check check (occurrence_count > 0),
  constraint crm_identity_reconciliation_resolution_check check (
    (status in ('pending', 'assigned') and resolved_at is null
      and resolved_by is null and source_identity_id is null)
    or
    (status in ('resolved', 'rejected') and resolved_at is not null
      and resolved_by is not null)
  )
);

create index if not exists crm_identity_reconciliation_work_queue_idx
  on private.crm_identity_reconciliation_items
    (status, owner_id, last_seen_at, id)
  where status in ('pending', 'assigned');

create table if not exists private.crm_mapping_commands (
  request_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_hash text not null,
  source_identity_id uuid
    references public.crm_source_identities(id) on delete restrict,
  reconciliation_item_id uuid
    references private.crm_identity_reconciliation_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint crm_mapping_commands_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists private.crm_reporting_scope_grant_lineage (
  grant_id uuid primary key
    references public.crm_user_reporting_scope_grants(id) on delete restrict,
  parent_grant_id uuid
    references public.crm_user_reporting_scope_grants(id) on delete restrict,
  root_grant_id uuid not null
    references public.crm_user_reporting_scope_grants(id) on delete restrict,
  depth smallint not null,
  request_id uuid not null default gen_random_uuid(),
  beneficiary_role_key text references public.roles(key) on delete restrict,
  grant_origin text not null,
  purpose text not null,
  consumer text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_migration text,
  maintenance_action text not null default 'retain',
  rollback_plan text not null,
  requires_reconciliation boolean not null default false,
  created_at timestamptz not null default now(),
  constraint crm_reporting_scope_grant_lineage_depth_check check (depth between 0 and 8),
  constraint crm_reporting_scope_grant_lineage_parent_check check (
    (parent_grant_id is null and root_grant_id = grant_id and depth = 0)
    or
    (parent_grant_id is not null and parent_grant_id <> grant_id
      and root_grant_id <> grant_id and depth > 0)
  ),
  constraint crm_reporting_scope_grant_lineage_origin_check check (
    grant_origin in ('bootstrap', 'migration', 'delegated', 'historical_backfill')
  ),
  constraint crm_reporting_scope_grant_lineage_maintenance_check check (
    maintenance_action in ('retain', 'review', 'replace', 'remove')
  ),
  constraint crm_reporting_scope_grant_lineage_text_check check (
    nullif(btrim(purpose), '') is not null
    and nullif(btrim(consumer), '') is not null
    and nullif(btrim(rollback_plan), '') is not null
  )
);

create index if not exists crm_reporting_scope_grant_lineage_parent_idx
  on private.crm_reporting_scope_grant_lineage (parent_grant_id, grant_id)
  where parent_grant_id is not null;
create index if not exists crm_reporting_scope_grant_lineage_root_idx
  on private.crm_reporting_scope_grant_lineage (root_grant_id, depth, grant_id);

create or replace function private.reporting_scope_contains(
  p_parent_scope_id uuid,
  p_child_scope_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with parent_scope as (
    select scope.*
    from public.crm_reporting_scopes scope
    where scope.id = p_parent_scope_id and scope.is_active
  ),
  child_scope as (
    select scope.*
    from public.crm_reporting_scopes scope
    where scope.id = p_child_scope_id and scope.is_active
  )
  select p_parent_scope_id is not null
    and p_child_scope_id is not null
    and exists (
      select 1
      from parent_scope parent
      cross join child_scope child
      where parent.id = child.id
        or parent.scope_type = 'global'
        or (
          parent.scope_type = 'organization'
          and (
            child.organization_id = parent.organization_id
            or exists (
              select 1 from public.crm_teams team
              where team.id = child.team_id
                and team.organization_id = parent.organization_id
                and team.is_active
            )
            or exists (
              select 1
              from public.crm_team_memberships membership
              join public.crm_teams team on team.id = membership.team_id
              where child.person_id = membership.person_id
                and team.organization_id = parent.organization_id
                and membership.valid_from <= p_at
                and (membership.valid_until is null or membership.valid_until > p_at)
                and team.is_active
            )
          )
        )
        or (
          parent.scope_type = 'team'
          and (
            child.team_id = parent.team_id
            or exists (
              select 1 from public.crm_team_memberships membership
              where child.person_id = membership.person_id
                and membership.team_id = parent.team_id
                and membership.valid_from <= p_at
                and (membership.valid_until is null or membership.valid_until > p_at)
            )
          )
        )
        or (
          parent.scope_type = 'portfolio'
          and (
            child.portfolio_id = parent.portfolio_id
            or exists (
              select 1
              from public.crm_portfolio_organizations portfolio_organization
              where portfolio_organization.portfolio_id = parent.portfolio_id
                and portfolio_organization.organization_id = child.organization_id
                and portfolio_organization.valid_from <= p_at
                and (
                  portfolio_organization.valid_until is null
                  or portfolio_organization.valid_until > p_at
                )
            )
            or exists (
              select 1
              from public.crm_teams team
              join public.crm_portfolio_organizations portfolio_organization
                on portfolio_organization.organization_id = team.organization_id
              where team.id = child.team_id
                and portfolio_organization.portfolio_id = parent.portfolio_id
                and portfolio_organization.valid_from <= p_at
                and (
                  portfolio_organization.valid_until is null
                  or portfolio_organization.valid_until > p_at
                )
                and team.is_active
            )
            or exists (
              select 1
              from public.crm_team_memberships membership
              join public.crm_teams team on team.id = membership.team_id
              join public.crm_portfolio_organizations portfolio_organization
                on portfolio_organization.organization_id = team.organization_id
              where child.person_id = membership.person_id
                and portfolio_organization.portfolio_id = parent.portfolio_id
                and membership.valid_from <= p_at
                and (membership.valid_until is null or membership.valid_until > p_at)
                and portfolio_organization.valid_from <= p_at
                and (
                  portfolio_organization.valid_until is null
                  or portfolio_organization.valid_until > p_at
                )
                and team.is_active
            )
          )
        )
    );
$$;

create or replace function private.capture_reporting_scope_grant_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope_type text;
  v_role_key text;
  v_parent record;
  v_origin text;
  v_requires_reconciliation boolean := false;
begin
  select scope.scope_type into v_scope_type
  from public.crm_reporting_scopes scope
  where scope.id = new.reporting_scope_id;

  select user_role.role_key into v_role_key
  from public.user_roles user_role
  where user_role.user_id = new.user_id;

  if new.user_id = new.granted_by and v_scope_type = 'global' then
    v_origin := case
      when new.reason = 'Master bootstrap global scope' then 'bootstrap'
      else 'migration'
    end;

    insert into private.crm_reporting_scope_grant_lineage (
      grant_id, parent_grant_id, root_grant_id, depth,
      beneficiary_role_key, grant_origin, purpose, consumer,
      owner_user_id, created_by_migration, maintenance_action,
      rollback_plan, requires_reconciliation
    ) values (
      new.id, null, new.id, 0,
      v_role_key, v_origin, new.reason, 'authorization-scope',
      new.granted_by,
      case when v_origin = 'migration'
        then '20260809181422_integration_identity_governance' else null end,
      'retain', 'Revoke the root only through an audited replacement or suspension.', false
    )
    on conflict (grant_id) do nothing;
    return new;
  end if;

  select
    parent_grant.id,
    parent_lineage.root_grant_id,
    parent_lineage.depth
  into v_parent
  from public.crm_user_reporting_scope_grants parent_grant
  join private.crm_reporting_scope_grant_lineage parent_lineage
    on parent_lineage.grant_id = parent_grant.id
  where parent_grant.user_id = new.granted_by
    and parent_grant.revoked_at is null
    and parent_grant.valid_from <= new.valid_from
    and (
      parent_grant.valid_until is null
      or (
        new.valid_until is not null
        and new.valid_until <= parent_grant.valid_until
      )
    )
    and not parent_lineage.requires_reconciliation
    and private.reporting_scope_contains(
      parent_grant.reporting_scope_id,
      new.reporting_scope_id,
      new.valid_from
    )
  order by
    (parent_grant.reporting_scope_id = new.reporting_scope_id) desc,
    parent_lineage.depth desc,
    parent_grant.created_at desc,
    parent_grant.id
  limit 1;

  if v_parent.id is null then
    if (select auth.uid()) is not null then
      raise exception 'forbidden: reporting grant requires an effective parent lineage'
        using errcode = '42501';
    end if;
    v_origin := 'historical_backfill';
    v_requires_reconciliation := true;
  else
    v_origin := 'delegated';
  end if;

  insert into private.crm_reporting_scope_grant_lineage (
    grant_id, parent_grant_id, root_grant_id, depth,
    beneficiary_role_key, grant_origin, purpose, consumer,
    owner_user_id, maintenance_action, rollback_plan,
    requires_reconciliation
  ) values (
    new.id,
    v_parent.id,
    coalesce(v_parent.root_grant_id, new.id),
    coalesce(v_parent.depth + 1, 0),
    v_role_key,
    v_origin,
    new.reason,
    'authorization-scope',
    new.granted_by,
    case when v_requires_reconciliation then 'review' else 'retain' end,
    'Revoke the leaf grant; revoke descendants before revoking an ancestor.',
    v_requires_reconciliation
  )
  on conflict (grant_id) do nothing;

  return new;
end;
$$;

create or replace function private.refresh_reporting_scope_grant_role_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.crm_reporting_scope_grant_lineage lineage
  set beneficiary_role_key = new.role_key
  where lineage.grant_id in (
    select grant_row.id
    from public.crm_user_reporting_scope_grants grant_row
    where grant_row.user_id = new.user_id
  );
  return new;
end;
$$;

create or replace function private.audit_crm_source_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into private.crm_source_identity_history (
      source_identity_id, event_type, current_record, actor_user_id, actor_process
    ) values (
      new.id, 'created', to_jsonb(new), (select auth.uid()), session_user
    );
    return new;
  end if;

  if old.source is distinct from new.source
     or old.entity_kind is distinct from new.entity_kind
     or old.external_id is distinct from new.external_id
     or old.person_id is distinct from new.person_id
     or old.organization_id is distinct from new.organization_id
     or old.team_id is distinct from new.team_id
     or old.portfolio_id is distinct from new.portfolio_id
     or old.reporting_scope_id is distinct from new.reporting_scope_id
     or old.origin_id is distinct from new.origin_id
     or old.development_id is distinct from new.development_id
     or old.location_id is distinct from new.location_id
     or (
       old.valid_from is distinct from new.valid_from
       and not (old.mapping_status = 'pending' and new.mapping_status = 'verified')
     ) then
    raise exception 'conflict: source identity is immutable; close and version the mapping'
      using errcode = '55000';
  end if;

  if old.valid_until is not null and new is distinct from old then
    raise exception 'conflict: closed source identity is immutable'
      using errcode = '55000';
  end if;

  insert into private.crm_source_identity_history (
    source_identity_id, event_type, previous_record, current_record,
    actor_user_id, actor_process
  ) values (
    new.id,
    case when old.valid_until is null and new.valid_until is not null
      then 'closed' else 'updated' end,
    to_jsonb(old), to_jsonb(new), (select auth.uid()), session_user
  );
  return new;
end;
$$;

create or replace function private.prevent_crm_source_identity_window_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.valid_until is not null and new.valid_until <= new.valid_from then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'crm-source-identity:' || new.source || ':' || new.entity_kind || ':' || new.external_id,
      0
    )
  );

  if exists (
    select 1
    from public.crm_source_identities identity
    where identity.id <> new.id
      and identity.source = new.source
      and identity.entity_kind = new.entity_kind
      and identity.external_id = new.external_id
      and tstzrange(identity.valid_from, identity.valid_until, '[)')
        && tstzrange(new.valid_from, new.valid_until, '[)')
  ) then
    raise exception 'conflict: source identity validity windows overlap'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function private.reporting_scope_grant_lineage_is_effective(
  p_grant_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select
      grant_row.id,
      grant_row.user_id,
      grant_row.reporting_scope_id,
      grant_row.valid_from,
      grant_row.valid_until,
      grant_row.revoked_at,
      lineage.parent_grant_id,
      lineage.root_grant_id,
      lineage.depth,
      lineage.requires_reconciliation,
      0 as hops
    from public.crm_user_reporting_scope_grants grant_row
    join private.crm_reporting_scope_grant_lineage lineage
      on lineage.grant_id = grant_row.id
    where grant_row.id = p_grant_id
    union all
    select
      parent_grant.id,
      parent_grant.user_id,
      parent_grant.reporting_scope_id,
      parent_grant.valid_from,
      parent_grant.valid_until,
      parent_grant.revoked_at,
      parent_lineage.parent_grant_id,
      parent_lineage.root_grant_id,
      parent_lineage.depth,
      parent_lineage.requires_reconciliation,
      chain.hops + 1
    from chain
    join public.crm_user_reporting_scope_grants parent_grant
      on parent_grant.id = chain.parent_grant_id
    join private.crm_reporting_scope_grant_lineage parent_lineage
      on parent_lineage.grant_id = parent_grant.id
    where chain.hops < 8
      and private.reporting_scope_contains(
        parent_grant.reporting_scope_id,
        chain.reporting_scope_id,
        p_at
      )
  )
  select exists (select 1 from chain where id = p_grant_id)
    and not exists (
      select 1
      from chain
      left join public.profiles profile on profile.user_id = chain.user_id
      left join public.user_roles user_role on user_role.user_id = chain.user_id
      left join public.crm_reporting_scopes scope
        on scope.id = chain.reporting_scope_id
      where chain.revoked_at is not null
        or chain.valid_from > p_at
        or (chain.valid_until is not null and chain.valid_until <= p_at)
        or chain.requires_reconciliation
        or scope.id is null
        or not scope.is_active
        or user_role.role_key is null
        or not exists (
          select 1
          from public.crm_role_scope_types allowed
          where allowed.role_key = user_role.role_key
            and allowed.scope_type = scope.scope_type
        )
        or (
          chain.id <> p_grant_id
          and (
            profile.user_id is null
            or not profile.is_active
            or profile.access_status <> 'approved'
          )
        )
    )
    and (select count(*) from chain) <= 9
    and exists (
      select 1 from chain
      where parent_grant_id is null
        and id = root_grant_id
        and depth = 0
    );
$$;

create or replace function private.record_identity_reconciliation(
  p_source text,
  p_entity_kind text,
  p_external_id text,
  p_observed_label text,
  p_source_record_id text,
  p_reason_code text,
  p_reconciliation_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.crm_identity_reconciliation_items (
    source, entity_kind, external_id, observed_label, source_record_id,
    reason_code, reconciliation_run_id
  ) values (
    p_source, p_entity_kind, p_external_id,
    nullif(btrim(coalesce(p_observed_label, '')), ''),
    nullif(btrim(coalesce(p_source_record_id, '')), ''),
    p_reason_code, p_reconciliation_run_id
  )
  on conflict (source, entity_kind, external_id) do update
  set status = 'pending',
      owner_id = null,
      source_identity_id = null,
      resolved_at = null,
      resolved_by = null,
      last_seen_at = now(),
      occurrence_count = private.crm_identity_reconciliation_items.occurrence_count + 1,
      observed_label = coalesce(
        excluded.observed_label,
        private.crm_identity_reconciliation_items.observed_label
      ),
      source_record_id = coalesce(
        excluded.source_record_id,
        private.crm_identity_reconciliation_items.source_record_id
      ),
      reason_code = excluded.reason_code,
      reconciliation_run_id = excluded.reconciliation_run_id
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_crm_source_identity_mapping(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request_id uuid;
  v_payload_hash text;
  v_source text;
  v_entity_kind text;
  v_external_id text;
  v_owner_id uuid;
  v_target_id uuid;
  v_decision text;
  v_evidence text;
  v_reason text;
  v_identity_id uuid;
  v_existing_command record;
  v_reconciliation_id uuid;
  v_effective_from_text text;
  v_effective_from timestamptz;
  v_existing_identity public.crm_source_identities%rowtype;
  v_existing_target_id uuid;
begin
  if v_actor is null
     or not private.current_user_is_master()
     or not coalesce(public._internal_has_permission(v_actor, 'crm.ingest.manage'), false) then
    raise exception 'forbidden: mapping review is not permitted' using errcode = '42501';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(p_payload) key
       where key not in (
         'requestId', 'source', 'entityKind', 'externalId', 'ownerKey',
         'targetId', 'decision', 'effectiveFrom', 'evidenceReference', 'reason'
       )
     ) then
    raise exception 'invalid_argument: invalid mapping review payload' using errcode = '22023';
  end if;

  v_effective_from_text := nullif(p_payload ->> 'effectiveFrom', '');

  if v_effective_from_text is not null
     and v_effective_from_text !~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'invalid_argument: invalid mapping review identifiers'
      using errcode = '22023';
  end if;

  begin
    v_request_id := (p_payload ->> 'requestId')::uuid;
    v_target_id := nullif(p_payload ->> 'targetId', '')::uuid;
    v_effective_from := v_effective_from_text::timestamptz;
  exception when others then
    raise exception 'invalid_argument: invalid mapping review identifiers'
      using errcode = '22023';
  end;

  v_payload_hash := encode(extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex');
  v_source := btrim(coalesce(p_payload ->> 'source', ''));
  v_entity_kind := btrim(coalesce(p_payload ->> 'entityKind', ''));
  v_external_id := btrim(coalesce(p_payload ->> 'externalId', ''));
  v_decision := btrim(coalesce(p_payload ->> 'decision', ''));
  v_evidence := btrim(coalesce(p_payload ->> 'evidenceReference', ''));
  v_reason := btrim(coalesce(p_payload ->> 'reason', ''));

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-mapping-request:' || v_request_id::text, 0)
  );

  select command.* into v_existing_command
  from private.crm_mapping_commands command
  where command.request_id = v_request_id;

  if found then
    if v_existing_command.payload_hash <> v_payload_hash then
      raise exception 'conflict: mapping request id was reused with different content'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'ok', true,
      'noop', true,
      'sourceIdentityId', v_existing_command.source_identity_id,
      'reconciliationItemId', v_existing_command.reconciliation_item_id
    );
  end if;

  if v_source !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or v_request_id is null
     or v_entity_kind not in (
       'person', 'organization', 'team', 'portfolio', 'reporting_scope',
       'origin', 'development', 'location'
     )
     or v_external_id = '' or length(v_external_id) > 300
     or v_decision not in ('verify', 'reject')
     or v_reason = '' or length(v_reason) > 300
     or length(v_evidence) > 1000
     or (
       v_decision = 'verify'
       and (
         v_target_id is null or v_effective_from is null or v_evidence = ''
         or not pg_catalog.isfinite(v_effective_from)
         or v_effective_from > now() + interval '5 minutes'
       )
     )
     or (
       v_decision = 'reject'
       and (v_target_id is not null or v_effective_from is not null)
     ) then
    raise exception 'invalid_argument: incomplete mapping review payload'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('crm-source-identities:' || v_source, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'crm-source-identity:' || v_source || ':' || v_entity_kind || ':' || v_external_id,
      0
    )
  );

  select identity.* into v_existing_identity
  from public.crm_source_identities identity
  where identity.source = v_source
    and identity.entity_kind = v_entity_kind
    and identity.external_id = v_external_id
    and identity.valid_until is null
  for update;

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

  if v_decision = 'reject' then
    if v_existing_identity.id is not null then
      v_identity_id := v_existing_identity.id;
      if v_existing_identity.mapping_status = 'verified' then
        update public.crm_source_identities identity
        set valid_until = greatest(
              now(), identity.valid_from + interval '1 microsecond'
            ),
            updated_at = now()
        where identity.id = v_existing_identity.id;
      else
        update public.crm_source_identities identity
        set mapping_status = 'rejected', rejection_reason = v_reason,
            valid_until = greatest(
              now(), identity.valid_from + interval '1 microsecond'
            ),
            updated_at = now()
        where identity.id = v_existing_identity.id;
      end if;
    end if;

    insert into private.crm_identity_reconciliation_items (
      source, entity_kind, external_id, status, reason_code,
      owner_id, source_identity_id, resolved_at, resolved_by
    ) values (
      v_source, v_entity_kind, v_external_id, 'rejected', v_reason,
      v_existing_identity.mapping_owner_id, v_identity_id, now(), v_actor
    )
    on conflict (source, entity_kind, external_id) do update
    set status = 'rejected', reason_code = excluded.reason_code,
        owner_id = excluded.owner_id,
        source_identity_id = excluded.source_identity_id,
        resolved_at = now(), resolved_by = v_actor
    returning id into v_reconciliation_id;
  else
    select owner.id into v_owner_id
    from private.crm_integration_owners owner
    where owner.owner_key = p_payload ->> 'ownerKey' and owner.is_active;

    if v_owner_id is null then
      raise exception 'invalid_argument: active mapping owner is required'
        using errcode = '22023';
    end if;

    if (v_entity_kind = 'person' and not exists (
      select 1 from public.crm_people target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'organization' and not exists (
      select 1 from public.crm_organizations target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'team' and not exists (
      select 1 from public.crm_teams target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'portfolio' and not exists (
      select 1 from public.crm_portfolios target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'reporting_scope' and not exists (
      select 1 from public.crm_reporting_scopes target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'origin' and not exists (
      select 1 from public.crm_origins target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'development' and not exists (
      select 1 from public.crm_developments target where target.id = v_target_id and target.is_active
    )) or (v_entity_kind = 'location' and not exists (
      select 1 from public.crm_locations target where target.id = v_target_id and target.is_active
    )) then
      raise exception 'invalid_argument: mapping target is unavailable'
        using errcode = '22023';
    end if;

    if v_existing_identity.id is not null then
      if v_existing_identity.mapping_status <> 'pending'
         or v_existing_target_id is distinct from v_target_id then
        raise exception 'conflict: active source identity requires explicit closure or matching pending promotion'
          using errcode = '23505';
      end if;

      update public.crm_source_identities identity
      set mapping_status = 'verified', mapping_owner_id = v_owner_id,
          valid_from = v_effective_from, verified_at = now(),
          verified_by = v_actor, evidence_reference = v_evidence,
          rejection_reason = null, reconciliation_request_id = v_request_id,
          updated_at = now()
      where identity.id = v_existing_identity.id
      returning identity.id into v_identity_id;
    else
      insert into public.crm_source_identities (
        source, entity_kind, external_id,
        person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
        origin_id, development_id, location_id,
        mapping_status, mapping_owner_id, valid_from, verified_at, verified_by,
        evidence_reference, reconciliation_request_id
      ) values (
        v_source, v_entity_kind, v_external_id,
        case when v_entity_kind = 'person' then v_target_id end,
        case when v_entity_kind = 'organization' then v_target_id end,
        case when v_entity_kind = 'team' then v_target_id end,
        case when v_entity_kind = 'portfolio' then v_target_id end,
        case when v_entity_kind = 'reporting_scope' then v_target_id end,
        case when v_entity_kind = 'origin' then v_target_id end,
        case when v_entity_kind = 'development' then v_target_id end,
        case when v_entity_kind = 'location' then v_target_id end,
        'verified', v_owner_id, v_effective_from, now(), v_actor,
        v_evidence, v_request_id
      ) returning id into v_identity_id;
    end if;

    update private.crm_identity_reconciliation_items item
    set status = 'resolved', source_identity_id = v_identity_id,
        owner_id = v_owner_id, reason_code = v_reason,
        resolved_at = now(), resolved_by = v_actor
    where item.source = v_source
      and item.entity_kind = v_entity_kind
      and item.external_id = v_external_id
    returning id into v_reconciliation_id;
  end if;

  insert into private.crm_mapping_commands (
    request_id, actor_user_id, payload_hash,
    source_identity_id, reconciliation_item_id
  ) values (
    v_request_id, v_actor, v_payload_hash, v_identity_id, v_reconciliation_id
  );

  insert into public.audit_logs (
    actor_id, action, before, after
  ) values (
    v_actor,
    'integration.mapping_' || v_decision,
    jsonb_build_object('source', v_source, 'entity_kind', v_entity_kind),
    jsonb_build_object(
      'source_identity_id', v_identity_id,
      'reconciliation_item_id', v_reconciliation_id,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'ok', true, 'noop', false,
    'sourceIdentityId', v_identity_id,
    'reconciliationItemId', v_reconciliation_id
  );
end;
$$;

insert into private.crm_reporting_scope_grant_lineage (
  grant_id, parent_grant_id, root_grant_id, depth,
  beneficiary_role_key, grant_origin, purpose, consumer,
  owner_user_id, created_by_migration, maintenance_action,
  rollback_plan, requires_reconciliation
)
select
  grant_row.id,
  null,
  grant_row.id,
  0,
  user_role.role_key,
  case when user_role.role_key = 'master'
      and scope.scope_type = 'global'
      and grant_row.user_id = grant_row.granted_by
      and grant_row.reason = 'Master bootstrap global scope'
    then 'bootstrap' else 'historical_backfill' end,
  grant_row.reason,
  'authorization-scope',
  grant_row.granted_by,
  '20260809181422_integration_identity_governance',
  case when user_role.role_key = 'master'
      and scope.scope_type = 'global'
      and grant_row.user_id = grant_row.granted_by
      and grant_row.reason = 'Master bootstrap global scope'
    then 'retain' else 'review' end,
  'Preserve audit evidence; replace through an approved scoped grant.',
  not (
    user_role.role_key = 'master'
    and scope.scope_type = 'global'
    and grant_row.user_id = grant_row.granted_by
    and grant_row.reason = 'Master bootstrap global scope'
  )
from public.crm_user_reporting_scope_grants grant_row
join public.crm_reporting_scopes scope on scope.id = grant_row.reporting_scope_id
left join public.user_roles user_role on user_role.user_id = grant_row.user_id
on conflict (grant_id) do nothing;

create trigger crm_source_identities_audit_insert
  after insert on public.crm_source_identities
  for each row execute function private.audit_crm_source_identity();
create trigger crm_source_identities_immutable_update
  before update on public.crm_source_identities
  for each row execute function private.audit_crm_source_identity();
create trigger crm_source_identities_window_overlap
  before insert or update on public.crm_source_identities
  for each row execute function private.prevent_crm_source_identity_window_overlap();
create trigger crm_reporting_scope_grant_lineage_insert
  after insert on public.crm_user_reporting_scope_grants
  for each row execute function private.capture_reporting_scope_grant_lineage();
create trigger crm_reporting_scope_grant_role_snapshot
  after insert or update of role_key on public.user_roles
  for each row execute function private.refresh_reporting_scope_grant_role_snapshot();

create trigger crm_origins_set_updated_at
  before update on public.crm_origins
  for each row execute function public.set_updated_at();
create trigger crm_developments_set_updated_at
  before update on public.crm_developments
  for each row execute function public.set_updated_at();
create trigger crm_locations_set_updated_at
  before update on public.crm_locations
  for each row execute function public.set_updated_at();

alter table public.crm_origins enable row level security;
alter table public.crm_origins force row level security;
alter table public.crm_developments enable row level security;
alter table public.crm_developments force row level security;
alter table public.crm_locations enable row level security;
alter table public.crm_locations force row level security;

revoke all on table public.crm_origins from public, anon, authenticated, service_role;
revoke all on table public.crm_developments from public, anon, authenticated, service_role;
revoke all on table public.crm_locations from public, anon, authenticated, service_role;
revoke all on table private.crm_integration_owners from public, anon, authenticated, service_role;
revoke all on table private.crm_source_identity_history from public, anon, authenticated, service_role;
revoke all on table private.crm_identity_reconciliation_items from public, anon, authenticated, service_role;
revoke all on table private.crm_mapping_commands from public, anon, authenticated, service_role;
revoke all on table private.crm_reporting_scope_grant_lineage
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema private from public, anon, authenticated, service_role;

revoke all privileges on function private.reporting_scope_contains(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.capture_reporting_scope_grant_lineage()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.refresh_reporting_scope_grant_role_snapshot()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_crm_source_identity()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.prevent_crm_source_identity_window_overlap()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.reporting_scope_grant_lineage_is_effective(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.record_identity_reconciliation(text, text, text, text, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.review_crm_source_identity_mapping(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.review_crm_source_identity_mapping(jsonb) to authenticated;

comment on table private.crm_integration_owners is
  'Explicit accountable owners for verified external-identity mappings; never exposed through Data API roles.';
comment on table public.crm_source_identities is
  'Versioned external identities. Only verified, owned, evidenced mappings may authorize v3 ingestion; names are never matching keys.';
comment on table private.crm_identity_reconciliation_items is
  'Owner-only queue for unresolved source identifiers. Ingestion records unknown IDs here and does not publish their batch.';
comment on table private.crm_reporting_scope_grant_lineage is
  'Parent/root lineage and operational purpose for reporting-scope grants. Historical non-Master ancestry remains fail-closed until reconciled.';
comment on function public.review_crm_source_identity_mapping(jsonb) is
  'Master-only, idempotent mapping review. Verified mappings require an active owner and evidence; direct table access remains revoked.';
