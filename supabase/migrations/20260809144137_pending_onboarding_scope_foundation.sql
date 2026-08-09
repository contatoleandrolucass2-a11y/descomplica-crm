-- Stage-only foundation for pending onboarding and scoped authorization.
--
-- This migration is intentionally fail-closed. Existing non-Master accounts
-- become legacy_review until identities and reporting scopes are reconciled.
-- It does not scope the current global v2 dashboard/ranking read models; those
-- remain behind a later v3 cutover gate rather than being filtered by names.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;

insert into public.roles (key, name, level, is_system) values
  ('manager', 'Manager', 55, true),
  ('house', 'House', 45, true),
  ('partnership_channel', 'Partnership Channel', 35, true),
  ('pending', 'Pending approval', 1, true)
on conflict (key) do update
set name = excluded.name,
    level = excluded.level,
    is_system = excluded.is_system;

-- Global v2 commercial read models cannot enforce reporting scopes. Until a
-- v3 snapshot carries reporting_scope_id, only Master may inherit these
-- permissions. Scoped roles keep administrative metadata and visual-only
-- simulator access, but commercial facts remain fail-closed.
delete from public.role_permissions
where role_key <> 'master'
  and permission_key in (
    'crm.dashboard.view',
    'crm.stages.view',
    'crm.ranking.view',
    'pages.manage',
    'crm.settings.view',
    'crm.settings.manage',
    'crm.salesforce.refresh',
    'crm.ingest.manage'
  );

alter table public.profiles
  add column if not exists access_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_access_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_access_status_check
      check (access_status in ('pending', 'approved', 'suspended', 'legacy_review'));
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_approved_by_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_approved_by_fkey
      foreign key (approved_by) references auth.users(id) on delete set null;
  end if;
end;
$$;

update public.profiles profiles
set is_active = case
      when exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profiles.user_id
          and user_role.role_key = 'master'
      ) then profiles.is_active
      else false
    end,
    access_status = case
      when exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profiles.user_id
          and user_role.role_key = 'master'
      ) then case
        when profiles.is_active then 'approved'
        else 'suspended'
      end
      else 'legacy_review'
    end,
    approved_at = case
      when exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profiles.user_id
          and user_role.role_key = 'master'
      ) and profiles.is_active then coalesce(profiles.approved_at, now())
      when exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profiles.user_id
          and user_role.role_key = 'master'
      ) then profiles.approved_at
      else null
    end,
    approved_by = case
      when exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profiles.user_id
          and user_role.role_key = 'master'
      ) then profiles.approved_by
      else null
    end;

do $$
begin
  if exists (
    select 1
    from public.profiles profile
    where not exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profile.user_id
          and user_role.role_key = 'master'
      )
      and (
        profile.is_active
        or profile.access_status is distinct from 'legacy_review'
        or profile.approved_at is not null
        or profile.approved_by is not null
      )
  ) then
    raise exception 'migration invariant: non-Master profile escaped legacy review'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.profiles profile
    where exists (
        select 1
        from public.user_roles user_role
        where user_role.user_id = profile.user_id
          and user_role.role_key = 'master'
      )
      and profile.access_status is distinct from case
        when profile.is_active then 'approved'
        else 'suspended'
      end
  ) then
    raise exception 'migration invariant: Master profile status is inconsistent'
      using errcode = '23514';
  end if;
end;
$$;

create index if not exists profiles_access_status_idx
  on public.profiles (access_status, is_active);
create index if not exists profiles_approved_by_idx
  on public.profiles (approved_by)
  where approved_by is not null;

create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_key text not null unique,
  name text not null,
  kind text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_organizations_key_check
    check (organization_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_organizations_name_check check (btrim(name) <> ''),
  constraint crm_organizations_kind_check
    check (kind in ('internal', 'real_estate', 'house', 'partner'))
);

create table if not exists public.crm_people (
  id uuid primary key default gen_random_uuid(),
  person_key text not null unique,
  display_name text not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_people_key_check
    check (person_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_people_name_check check (btrim(display_name) <> '')
);

create table if not exists public.crm_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.crm_organizations(id) on delete restrict,
  team_key text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, team_key),
  constraint crm_teams_key_check
    check (team_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_teams_name_check check (btrim(name) <> '')
);

create table if not exists public.crm_team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,
  membership_role text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_team_memberships_role_check
    check (membership_role in ('coordinator', 'manager', 'broker', 'member')),
  constraint crm_team_memberships_window_check
    check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists crm_team_memberships_active_unique
  on public.crm_team_memberships (team_id, person_id)
  where valid_until is null;
create index if not exists crm_team_memberships_team_idx
  on public.crm_team_memberships (team_id);
create index if not exists crm_team_memberships_person_window_idx
  on public.crm_team_memberships (person_id, valid_from, valid_until);

create table if not exists public.crm_portfolios (
  id uuid primary key default gen_random_uuid(),
  portfolio_key text not null unique,
  name text not null,
  kind text not null default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_portfolios_key_check
    check (portfolio_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_portfolios_name_check check (btrim(name) <> ''),
  constraint crm_portfolios_kind_check
    check (kind in ('general', 'partnership'))
);

create table if not exists public.crm_portfolio_organizations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.crm_portfolios(id) on delete cascade,
  organization_id uuid not null
    references public.crm_organizations(id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_portfolio_organizations_window_check
    check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists crm_portfolio_organizations_active_unique
  on public.crm_portfolio_organizations (portfolio_id, organization_id)
  where valid_until is null;
create index if not exists crm_portfolio_organizations_portfolio_idx
  on public.crm_portfolio_organizations (portfolio_id);
create index if not exists crm_portfolio_organizations_org_window_idx
  on public.crm_portfolio_organizations (organization_id, valid_from, valid_until);

create table if not exists public.crm_source_identities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  entity_kind text not null,
  external_id text not null,
  person_id uuid references public.crm_people(id) on delete cascade,
  organization_id uuid references public.crm_organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source, entity_kind, external_id),
  constraint crm_source_identities_source_check
    check (source ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_source_identities_external_id_check check (btrim(external_id) <> ''),
  constraint crm_source_identities_target_check check (
    (entity_kind = 'person' and person_id is not null and organization_id is null)
    or
    (entity_kind = 'organization' and organization_id is not null and person_id is null)
  )
);

create index if not exists crm_source_identities_person_idx
  on public.crm_source_identities (person_id)
  where person_id is not null;
create index if not exists crm_source_identities_organization_idx
  on public.crm_source_identities (organization_id)
  where organization_id is not null;

create table if not exists public.crm_reporting_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  scope_type text not null,
  organization_id uuid references public.crm_organizations(id) on delete restrict,
  team_id uuid references public.crm_teams(id) on delete restrict,
  portfolio_id uuid references public.crm_portfolios(id) on delete restrict,
  person_id uuid references public.crm_people(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint crm_reporting_scopes_key_check
    check (scope_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_reporting_scopes_type_check
    check (scope_type in ('global', 'organization', 'team', 'portfolio', 'person')),
  constraint crm_reporting_scopes_target_check check (
    (scope_type = 'global'
      and num_nonnulls(organization_id, team_id, portfolio_id, person_id) = 0)
    or
    (scope_type = 'organization'
      and organization_id is not null
      and num_nonnulls(organization_id, team_id, portfolio_id, person_id) = 1)
    or
    (scope_type = 'team'
      and team_id is not null
      and num_nonnulls(organization_id, team_id, portfolio_id, person_id) = 1)
    or
    (scope_type = 'portfolio'
      and portfolio_id is not null
      and num_nonnulls(organization_id, team_id, portfolio_id, person_id) = 1)
    or
    (scope_type = 'person'
      and person_id is not null
      and num_nonnulls(organization_id, team_id, portfolio_id, person_id) = 1)
  )
);

create unique index if not exists crm_reporting_scopes_global_unique
  on public.crm_reporting_scopes (scope_type)
  where scope_type = 'global';
create unique index if not exists crm_reporting_scopes_organization_unique
  on public.crm_reporting_scopes (organization_id)
  where scope_type = 'organization';
create unique index if not exists crm_reporting_scopes_team_unique
  on public.crm_reporting_scopes (team_id)
  where scope_type = 'team';
create unique index if not exists crm_reporting_scopes_portfolio_unique
  on public.crm_reporting_scopes (portfolio_id)
  where scope_type = 'portfolio';
create unique index if not exists crm_reporting_scopes_person_unique
  on public.crm_reporting_scopes (person_id)
  where scope_type = 'person';

create table if not exists public.crm_role_scope_types (
  role_key text not null references public.roles(key) on delete cascade,
  scope_type text not null,
  primary key (role_key, scope_type),
  constraint crm_role_scope_types_type_check
    check (scope_type in ('global', 'organization', 'team', 'portfolio', 'person'))
);

create table if not exists public.crm_user_reporting_scope_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reporting_scope_id uuid not null
    references public.crm_reporting_scopes(id) on delete restrict,
  granted_by uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint crm_user_reporting_scope_grants_reason_check
    check (nullif(btrim(reason), '') is not null),
  constraint crm_user_reporting_scope_grants_window_check
    check (valid_until is null or valid_until > valid_from),
  constraint crm_user_reporting_scope_grants_revocation_check check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or
    (
      revoked_at is not null
      and revoked_by is not null
      and nullif(btrim(coalesce(revocation_reason, '')), '') is not null
    )
  )
);

create unique index if not exists crm_user_reporting_scope_grants_active_unique
  on public.crm_user_reporting_scope_grants (user_id, reporting_scope_id)
  where valid_until is null and revoked_at is null;
create index if not exists crm_user_reporting_scope_grants_user_window_idx
  on public.crm_user_reporting_scope_grants (user_id, valid_from, valid_until);
create index if not exists crm_user_reporting_scope_grants_granted_by_idx
  on public.crm_user_reporting_scope_grants (granted_by);
create index if not exists crm_user_reporting_scope_grants_revoked_by_idx
  on public.crm_user_reporting_scope_grants (revoked_by)
  where revoked_by is not null;
create index if not exists crm_user_reporting_scope_grants_scope_window_idx
  on public.crm_user_reporting_scope_grants
    (reporting_scope_id, user_id, valid_from, valid_until);

alter table public.audit_logs
  add column if not exists reporting_scope_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_reporting_scope_id_fkey'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_reporting_scope_id_fkey
      foreign key (reporting_scope_id)
      references public.crm_reporting_scopes(id) on delete restrict;
  end if;
end;
$$;

create index if not exists audit_logs_reporting_scope_idx
  on public.audit_logs (reporting_scope_id, created_at desc)
  where reporting_scope_id is not null;

insert into public.crm_role_scope_types (role_key, scope_type) values
  ('master', 'global'),
  ('admin', 'organization'),
  ('coordinator', 'portfolio'),
  ('coordinator', 'team'),
  ('manager', 'team'),
  ('broker', 'person'),
  ('real_estate', 'organization'),
  ('house', 'organization'),
  ('partnership_channel', 'portfolio')
on conflict do nothing;

-- There is exactly one break-glass Master identity. The partial uniqueness
-- closes concurrent bootstrap races at the storage layer as well as in the RPC.
create unique index if not exists user_roles_single_master_unique
  on public.user_roles (role_key)
  where role_key = 'master';

insert into public.crm_reporting_scopes (id, scope_key, scope_type)
values ('00000000-0000-4000-8000-000000000001', 'global', 'global')
on conflict (scope_key) do nothing;

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
select
  user_role.user_id,
  reporting_scope.id,
  user_role.user_id,
  'Existing Master global scope baseline'
from public.user_roles user_role
join public.crm_reporting_scopes reporting_scope
  on reporting_scope.scope_key = 'global'
where user_role.role_key = 'master'
on conflict (user_id, reporting_scope_id)
  where valid_until is null and revoked_at is null
do nothing;

create trigger crm_organizations_set_updated_at
  before update on public.crm_organizations
  for each row execute function public.set_updated_at();
create trigger crm_people_set_updated_at
  before update on public.crm_people
  for each row execute function public.set_updated_at();
create trigger crm_teams_set_updated_at
  before update on public.crm_teams
  for each row execute function public.set_updated_at();
create trigger crm_portfolios_set_updated_at
  before update on public.crm_portfolios
  for each row execute function public.set_updated_at();

create or replace function private.is_approved_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and profile.is_active
        and profile.access_status = 'approved'
    );
$$;

create or replace function private.user_role_scope_is_valid(
  p_user_id uuid,
  p_role_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with active_grants as (
    select reporting_scope.*
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where scope_grant.user_id = p_user_id
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and (scope_grant.valid_until is null or scope_grant.valid_until > now())
      and reporting_scope.is_active
  ),
  validated_grants as (
    select
      active_grant.*,
      case active_grant.scope_type
        when 'global' then true
        when 'organization' then exists (
          select 1
          from public.crm_organizations organization
          where organization.id = active_grant.organization_id
            and organization.is_active
        )
        when 'team' then exists (
          select 1
          from public.crm_teams team
          join public.crm_organizations organization
            on organization.id = team.organization_id
           and organization.is_active
          where team.id = active_grant.team_id
            and team.is_active
        )
        when 'portfolio' then exists (
          select 1
          from public.crm_portfolios portfolio
          where portfolio.id = active_grant.portfolio_id
            and portfolio.is_active
        )
        when 'person' then exists (
          select 1
          from public.crm_people person
          join public.crm_team_memberships membership
            on membership.person_id = person.id
           and membership.valid_from <= now()
           and (membership.valid_until is null or membership.valid_until > now())
          join public.crm_teams team
            on team.id = membership.team_id
           and team.is_active
          join public.crm_organizations organization
            on organization.id = team.organization_id
           and organization.is_active
          where person.id = active_grant.person_id
            and person.is_active
        )
        else false
      end as target_is_active
    from active_grants active_grant
  )
  select p_user_id is not null
    and p_role_key is not null
    and p_role_key <> 'pending'
    and exists (select 1 from validated_grants)
    and not exists (
      select 1 from validated_grants where not target_is_active
    )
    and not exists (
      select 1
      from validated_grants active_grant
      where not exists (
        select 1
        from public.crm_role_scope_types allowed_scope
        where allowed_scope.role_key = p_role_key
          and allowed_scope.scope_type = active_grant.scope_type
        )
    )
    and (
      p_role_key not in ('manager', 'broker', 'real_estate', 'house')
      or (select count(*) from validated_grants) = 1
    )
    and (
      p_role_key <> 'broker'
      or not exists (
        select 1
        from validated_grants active_grant
        left join public.crm_people person
          on person.id = active_grant.person_id
        where active_grant.scope_type <> 'person'
          or person.auth_user_id is distinct from p_user_id
      )
    )
    and (
      p_role_key <> 'real_estate'
      or not exists (
        select 1
        from validated_grants active_grant
        left join public.crm_organizations organization
          on organization.id = active_grant.organization_id
        where active_grant.scope_type <> 'organization'
          or organization.kind <> 'real_estate'
      )
    )
    and (
      p_role_key <> 'house'
      or not exists (
        select 1
        from validated_grants active_grant
        left join public.crm_organizations organization
          on organization.id = active_grant.organization_id
        where active_grant.scope_type <> 'organization'
          or organization.kind <> 'house'
      )
    )
    and (
      p_role_key <> 'partnership_channel'
      or not exists (
        select 1
        from validated_grants active_grant
        left join public.crm_portfolios portfolio
          on portfolio.id = active_grant.portfolio_id
        where active_grant.scope_type <> 'portfolio'
          or portfolio.kind <> 'partnership'
      )
    );
$$;

create or replace function private.user_has_valid_role_scope(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_approved_user(p_user_id)
    and exists (
      select 1
      from public.user_roles user_role
      where user_role.user_id = p_user_id
        and private.user_role_scope_is_valid(p_user_id, user_role.role_key)
    );
$$;

create or replace function private.current_user_is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_has_valid_role_scope((select auth.uid()))
    and exists (
      select 1
      from public.user_roles user_role
      join public.crm_user_reporting_scope_grants scope_grant
        on scope_grant.user_id = user_role.user_id
      join public.crm_reporting_scopes reporting_scope
        on reporting_scope.id = scope_grant.reporting_scope_id
      where user_role.user_id = (select auth.uid())
        and user_role.role_key = 'master'
        and scope_grant.revoked_at is null
        and scope_grant.valid_from <= now()
        and (scope_grant.valid_until is null or scope_grant.valid_until > now())
        and reporting_scope.scope_type = 'global'
        and reporting_scope.is_active
    )
    and not exists (
      select 1
      from public.crm_user_reporting_scope_grants scope_grant
      join public.crm_reporting_scopes reporting_scope
        on reporting_scope.id = scope_grant.reporting_scope_id
      where scope_grant.user_id = (select auth.uid())
        and scope_grant.revoked_at is null
        and scope_grant.valid_from <= now()
        and (scope_grant.valid_until is null or scope_grant.valid_until > now())
        and reporting_scope.is_active
        and reporting_scope.scope_type <> 'global'
    );
$$;

create or replace function private.can_read_reporting_scope(p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_has_valid_role_scope((select auth.uid()))
    and (
      private.current_user_is_master()
      or exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        join public.crm_reporting_scopes reporting_scope
          on reporting_scope.id = scope_grant.reporting_scope_id
        where scope_grant.user_id = (select auth.uid())
          and scope_grant.reporting_scope_id = p_scope_id
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
          and reporting_scope.is_active
      )
    );
$$;

create or replace function private.can_read_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null
    and exists (
      select 1
      from public.crm_organizations target_organization
      where target_organization.id = p_organization_id
        and target_organization.is_active
    )
    and private.user_has_valid_role_scope((select auth.uid()))
    and (
      private.current_user_is_master()
      or exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        join public.crm_reporting_scopes reporting_scope
          on reporting_scope.id = scope_grant.reporting_scope_id
        where scope_grant.user_id = (select auth.uid())
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
          and reporting_scope.is_active
          and (
            reporting_scope.organization_id = p_organization_id
            or exists (
              select 1
              from public.crm_teams team
              where team.id = reporting_scope.team_id
                and team.organization_id = p_organization_id
                and team.is_active
            )
            or exists (
              select 1
              from public.crm_portfolio_organizations portfolio_organization
              join public.crm_portfolios portfolio
                on portfolio.id = portfolio_organization.portfolio_id
               and portfolio.is_active
              where portfolio_organization.portfolio_id = reporting_scope.portfolio_id
                and portfolio_organization.organization_id = p_organization_id
                and portfolio_organization.valid_from <= now()
                and (
                  portfolio_organization.valid_until is null
                  or portfolio_organization.valid_until > now()
                )
            )
            or exists (
              select 1
              from public.crm_team_memberships membership
              join public.crm_people scope_person
                on scope_person.id = membership.person_id
               and scope_person.is_active
              join public.crm_teams team on team.id = membership.team_id
              where membership.person_id = reporting_scope.person_id
                and team.organization_id = p_organization_id
                and membership.valid_from <= now()
                and (membership.valid_until is null or membership.valid_until > now())
                and team.is_active
            )
          )
      )
    );
$$;

create or replace function private.can_read_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_team_id is not null
    and exists (
      select 1
      from public.crm_teams target_team
      join public.crm_organizations target_organization
        on target_organization.id = target_team.organization_id
       and target_organization.is_active
      where target_team.id = p_team_id
        and target_team.is_active
    )
    and private.user_has_valid_role_scope((select auth.uid()))
    and (
      private.current_user_is_master()
      or exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        join public.crm_reporting_scopes reporting_scope
          on reporting_scope.id = scope_grant.reporting_scope_id
        join public.crm_teams target_team on target_team.id = p_team_id
        join public.crm_organizations target_organization
          on target_organization.id = target_team.organization_id
         and target_organization.is_active
        where scope_grant.user_id = (select auth.uid())
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
          and reporting_scope.is_active
          and target_team.is_active
          and (
            reporting_scope.team_id = p_team_id
            or reporting_scope.organization_id = target_team.organization_id
            or exists (
              select 1
              from public.crm_portfolio_organizations portfolio_organization
              join public.crm_portfolios portfolio
                on portfolio.id = portfolio_organization.portfolio_id
               and portfolio.is_active
              where portfolio_organization.portfolio_id = reporting_scope.portfolio_id
                and portfolio_organization.organization_id = target_team.organization_id
                and portfolio_organization.valid_from <= now()
                and (
                  portfolio_organization.valid_until is null
                  or portfolio_organization.valid_until > now()
                )
            )
            or exists (
              select 1
              from public.crm_team_memberships membership
              join public.crm_people scope_person
                on scope_person.id = membership.person_id
               and scope_person.is_active
              where membership.person_id = reporting_scope.person_id
                and membership.team_id = p_team_id
                and membership.valid_from <= now()
                and (membership.valid_until is null or membership.valid_until > now())
            )
          )
      )
    );
$$;

create or replace function private.can_read_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_person_id is not null
    and exists (
      select 1
      from public.crm_people target_person
      where target_person.id = p_person_id
        and target_person.is_active
    )
    and private.user_has_valid_role_scope((select auth.uid()))
    and (
      private.current_user_is_master()
      or exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        join public.crm_reporting_scopes reporting_scope
          on reporting_scope.id = scope_grant.reporting_scope_id
        where scope_grant.user_id = (select auth.uid())
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
          and reporting_scope.is_active
          and (
            reporting_scope.person_id = p_person_id
            or exists (
              select 1
              from public.crm_team_memberships membership
              join public.crm_teams team on team.id = membership.team_id
              join public.crm_organizations organization
                on organization.id = team.organization_id
               and organization.is_active
              where membership.person_id = p_person_id
                and membership.valid_from <= now()
                and (membership.valid_until is null or membership.valid_until > now())
                and team.is_active
                and (
                  reporting_scope.team_id = membership.team_id
                  or reporting_scope.organization_id = team.organization_id
                  or exists (
                    select 1
                    from public.crm_portfolio_organizations portfolio_organization
                    join public.crm_portfolios portfolio
                      on portfolio.id = portfolio_organization.portfolio_id
                     and portfolio.is_active
                    where portfolio_organization.portfolio_id = reporting_scope.portfolio_id
                      and portfolio_organization.organization_id = team.organization_id
                      and portfolio_organization.valid_from <= now()
                      and (
                        portfolio_organization.valid_until is null
                        or portfolio_organization.valid_until > now()
                      )
                  )
                )
            )
          )
      )
    );
$$;

create or replace function private.can_read_portfolio(p_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_portfolio_id is not null
    and exists (
      select 1
      from public.crm_portfolios target_portfolio
      where target_portfolio.id = p_portfolio_id
        and target_portfolio.is_active
    )
    and private.user_has_valid_role_scope((select auth.uid()))
    and (
      private.current_user_is_master()
      or exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        join public.crm_reporting_scopes reporting_scope
          on reporting_scope.id = scope_grant.reporting_scope_id
        where scope_grant.user_id = (select auth.uid())
          and reporting_scope.portfolio_id = p_portfolio_id
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
          and reporting_scope.is_active
      )
    );
$$;

create or replace function private.can_delegate_reporting_scope(p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with requested_scope as (
    select reporting_scope.*
    from public.crm_reporting_scopes reporting_scope
    where reporting_scope.id = p_scope_id
      and reporting_scope.is_active
      and case reporting_scope.scope_type
        when 'global' then true
        when 'organization' then exists (
          select 1
          from public.crm_organizations organization
          where organization.id = reporting_scope.organization_id
            and organization.is_active
        )
        when 'team' then exists (
          select 1
          from public.crm_teams team
          join public.crm_organizations organization
            on organization.id = team.organization_id
           and organization.is_active
          where team.id = reporting_scope.team_id
            and team.is_active
        )
        when 'portfolio' then exists (
          select 1
          from public.crm_portfolios portfolio
          where portfolio.id = reporting_scope.portfolio_id
            and portfolio.is_active
        )
        when 'person' then exists (
          select 1
          from public.crm_people person
          join public.crm_team_memberships membership
            on membership.person_id = person.id
           and membership.valid_from <= now()
           and (membership.valid_until is null or membership.valid_until > now())
          join public.crm_teams team
            on team.id = membership.team_id
           and team.is_active
          join public.crm_organizations organization
            on organization.id = team.organization_id
           and organization.is_active
          where person.id = reporting_scope.person_id
            and person.is_active
        )
        else false
      end
  ),
  actor_scopes as (
    select reporting_scope.*
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
     and reporting_scope.is_active
    where scope_grant.user_id = (select auth.uid())
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and scope_grant.valid_until is null
  )
  select private.user_has_valid_role_scope((select auth.uid()))
    and exists (select 1 from requested_scope)
    and (
      private.current_user_is_master()
      or (
        exists (
          select 1
          from actor_scopes actor_scope
          cross join requested_scope requested
          where
          (
            actor_scope.scope_type = 'portfolio'
            and (
              (
                requested.scope_type = 'portfolio'
                and requested.portfolio_id = actor_scope.portfolio_id
              )
              or (
                requested.scope_type = 'organization'
                and exists (
                  select 1
                  from public.crm_portfolio_organizations membership
                  where membership.portfolio_id = actor_scope.portfolio_id
                    and membership.organization_id = requested.organization_id
                    and membership.valid_from <= now()
                    and membership.valid_until is null
                )
              )
              or (
                requested.scope_type = 'team'
                and exists (
                  select 1
                  from public.crm_teams team
                  join public.crm_portfolio_organizations membership
                    on membership.organization_id = team.organization_id
                  where team.id = requested.team_id
                    and membership.portfolio_id = actor_scope.portfolio_id
                    and membership.valid_from <= now()
                    and membership.valid_until is null
                )
              )
              or (
                requested.scope_type = 'person'
                and exists (
                  select 1
                  from public.crm_team_memberships team_membership
                  join public.crm_teams team
                    on team.id = team_membership.team_id
                   and team.is_active
                  join public.crm_organizations organization
                    on organization.id = team.organization_id
                   and organization.is_active
                  join public.crm_portfolio_organizations portfolio_membership
                    on portfolio_membership.organization_id = team.organization_id
                  where team_membership.person_id = requested.person_id
                    and portfolio_membership.portfolio_id = actor_scope.portfolio_id
                    and team_membership.valid_from <= now()
                    and team_membership.valid_until is null
                    and portfolio_membership.valid_from <= now()
                    and portfolio_membership.valid_until is null
                )
              )
            )
          )
          or (
            actor_scope.scope_type = 'organization'
            and (
              (
                requested.scope_type = 'organization'
                and requested.organization_id = actor_scope.organization_id
              )
              or (
                requested.scope_type = 'team'
                and exists (
                  select 1
                  from public.crm_teams team
                  where team.id = requested.team_id
                    and team.organization_id = actor_scope.organization_id
                )
              )
              or (
                requested.scope_type = 'person'
                and exists (
                  select 1
                  from public.crm_team_memberships membership
                  join public.crm_teams team on team.id = membership.team_id
                  where membership.person_id = requested.person_id
                    and team.organization_id = actor_scope.organization_id
                    and team.is_active
                    and membership.valid_from <= now()
                    and membership.valid_until is null
                )
              )
            )
          )
          or (
            actor_scope.scope_type = 'team'
            and (
              (
                requested.scope_type = 'team'
                and requested.team_id = actor_scope.team_id
              )
              or (
                requested.scope_type = 'person'
                and exists (
                  select 1
                  from public.crm_team_memberships membership
                  where membership.team_id = actor_scope.team_id
                    and membership.person_id = requested.person_id
                    and membership.valid_from <= now()
                    and membership.valid_until is null
                )
              )
            )
          )
          or (
            actor_scope.scope_type = 'person'
            and requested.scope_type = 'person'
            and requested.person_id = actor_scope.person_id
          )
        )
        and not exists (
          select 1
          from requested_scope requested
          join public.crm_team_memberships target_membership
            on target_membership.person_id = requested.person_id
          join public.crm_teams target_team
            on target_team.id = target_membership.team_id
          where requested.scope_type = 'person'
            and (
              target_membership.valid_until is null
              or target_membership.valid_until > now()
            )
            and not exists (
              select 1
              from actor_scopes actor_scope
              where (
                actor_scope.scope_type = 'portfolio'
                and exists (
                  select 1
                  from public.crm_portfolio_organizations portfolio_membership
                  where portfolio_membership.portfolio_id = actor_scope.portfolio_id
                    and portfolio_membership.organization_id = target_team.organization_id
                    and portfolio_membership.valid_from <= now()
                    and portfolio_membership.valid_until is null
                )
              )
              or (
                actor_scope.scope_type = 'organization'
                and actor_scope.organization_id = target_team.organization_id
              )
              or (
                actor_scope.scope_type = 'team'
                and actor_scope.team_id = target_membership.team_id
              )
              or (
                actor_scope.scope_type = 'person'
                and actor_scope.person_id = requested.person_id
              )
            )
        )
      )
    );
$$;

create or replace function private.can_approve_reporting_scopes(
  p_role_key text,
  p_scope_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role_key is not null
    and p_scope_ids is not null
    and not exists (
      select 1
      from unnest(p_scope_ids) requested(scope_id)
      left join public.crm_reporting_scopes reporting_scope
        on reporting_scope.id = requested.scope_id
       and reporting_scope.is_active
      where not coalesce(
          private.can_delegate_reporting_scope(requested.scope_id),
          false
        )
        or reporting_scope.id is null
        or not exists (
          select 1
          from public.crm_role_scope_types allowed_scope
          where allowed_scope.role_key = p_role_key
            and allowed_scope.scope_type = reporting_scope.scope_type
        )
        or (
          p_role_key = 'house'
          and not exists (
            select 1
            from public.crm_organizations organization
            where organization.id = reporting_scope.organization_id
              and organization.kind = 'house'
          )
        )
        or (
          p_role_key = 'real_estate'
          and not exists (
            select 1
            from public.crm_organizations organization
            where organization.id = reporting_scope.organization_id
              and organization.kind = 'real_estate'
          )
        )
        or (
          p_role_key = 'partnership_channel'
          and not exists (
            select 1
            from public.crm_portfolios portfolio
            where portfolio.id = reporting_scope.portfolio_id
              and portfolio.kind = 'partnership'
          )
        )
    );
$$;

create or replace function private.lock_reporting_scope_topology(
  p_scope_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lock_key text;
begin
  for v_lock_key in
    select distinct topology.lock_key
    from (
      select case reporting_scope.scope_type
        when 'person'
          then 'crm-person-topology:' || reporting_scope.person_id::text
        when 'portfolio'
          then 'crm-portfolio-topology:' || reporting_scope.portfolio_id::text
        else null
      end as lock_key
      from public.crm_reporting_scopes reporting_scope
      where reporting_scope.id = any(coalesce(p_scope_ids, '{}'::uuid[]))
    ) topology
    where topology.lock_key is not null
    order by topology.lock_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_lock_key, 0)
    );
  end loop;
end;
$$;

create or replace function private.can_manage_user(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_target_user_id is not null
    and p_target_user_id <> (select auth.uid())
    and private.user_has_valid_role_scope((select auth.uid()))
    and coalesce(
      public._internal_has_permission((select auth.uid()), 'users.manage'),
      false
    )
    and (
      private.current_user_is_master()
      or (
        (
          exists (
            select 1
            from public.crm_user_reporting_scope_grants target_grant
            where target_grant.user_id = p_target_user_id
              and target_grant.revoked_at is null
              and target_grant.valid_from <= now()
              and (target_grant.valid_until is null or target_grant.valid_until > now())
          )
          and not exists (
            select 1
            from public.crm_user_reporting_scope_grants target_grant
            where target_grant.user_id = p_target_user_id
              and target_grant.revoked_at is null
              and (target_grant.valid_until is null or target_grant.valid_until > now())
              and not coalesce(
                private.can_delegate_reporting_scope(target_grant.reporting_scope_id),
                false
              )
          )
        )
        or exists (
          select 1
          from public.crm_people target_person
          where target_person.auth_user_id = p_target_user_id
            and target_person.is_active
            and private.can_read_person(target_person.id)
            and exists (
              select 1
              from public.profiles target_profile
              join public.user_roles target_role
                on target_role.user_id = target_profile.user_id
              where target_profile.user_id = p_target_user_id
                and not target_profile.is_active
                and target_profile.access_status = 'pending'
                and target_role.role_key = 'pending'
            )
            and not exists (
              select 1
              from public.crm_user_reporting_scope_grants target_grant
              where target_grant.user_id = p_target_user_id
                and target_grant.revoked_at is null
                and (
                  target_grant.valid_until is null
                  or target_grant.valid_until > now()
                )
            )
        )
      )
    );
$$;

revoke all privileges on function private.is_approved_user(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.current_user_is_master()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_reporting_scope(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_organization(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_team(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_person(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_portfolio(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_approve_reporting_scopes(text, uuid[])
  from public, anon, authenticated, service_role;
revoke all privileges on function private.lock_reporting_scope_topology(uuid[])
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_delegate_reporting_scope(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.can_manage_user(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.user_role_scope_is_valid(uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.user_has_valid_role_scope(uuid)
  from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.current_user_is_master() to authenticated;
grant execute on function private.can_read_reporting_scope(uuid) to authenticated;
grant execute on function private.can_read_organization(uuid) to authenticated;
grant execute on function private.can_read_team(uuid) to authenticated;
grant execute on function private.can_read_person(uuid) to authenticated;
grant execute on function private.can_read_portfolio(uuid) to authenticated;
grant execute on function private.can_delegate_reporting_scope(uuid) to authenticated;
grant execute on function private.can_manage_user(uuid) to authenticated;

alter table public.crm_organizations enable row level security;
alter table public.crm_organizations force row level security;
alter table public.crm_people enable row level security;
alter table public.crm_people force row level security;
alter table public.crm_teams enable row level security;
alter table public.crm_teams force row level security;
alter table public.crm_team_memberships enable row level security;
alter table public.crm_team_memberships force row level security;
alter table public.crm_portfolios enable row level security;
alter table public.crm_portfolios force row level security;
alter table public.crm_portfolio_organizations enable row level security;
alter table public.crm_portfolio_organizations force row level security;
alter table public.crm_source_identities enable row level security;
alter table public.crm_source_identities force row level security;
alter table public.crm_reporting_scopes enable row level security;
alter table public.crm_reporting_scopes force row level security;
alter table public.crm_role_scope_types enable row level security;
alter table public.crm_role_scope_types force row level security;
alter table public.crm_user_reporting_scope_grants enable row level security;
alter table public.crm_user_reporting_scope_grants force row level security;

create policy crm_organizations_select_scoped
  on public.crm_organizations for select to authenticated
  using (private.can_read_organization(id));
create policy crm_people_select_scoped
  on public.crm_people for select to authenticated
  using (private.can_read_person(id));
create policy crm_teams_select_scoped
  on public.crm_teams for select to authenticated
  using (private.can_read_team(id));
create policy crm_team_memberships_select_scoped
  on public.crm_team_memberships for select to authenticated
  using (
    private.can_read_team(team_id)
    and private.can_read_person(person_id)
  );
create policy crm_portfolios_select_scoped
  on public.crm_portfolios for select to authenticated
  using (private.can_read_portfolio(id));
create policy crm_portfolio_organizations_select_scoped
  on public.crm_portfolio_organizations for select to authenticated
  using (
    private.can_read_portfolio(portfolio_id)
    and private.can_read_organization(organization_id)
  );
create policy crm_reporting_scopes_select_scoped
  on public.crm_reporting_scopes for select to authenticated
  using (private.can_delegate_reporting_scope(id));
create policy crm_user_reporting_scope_grants_select_self_or_scoped_manager
  on public.crm_user_reporting_scope_grants for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_id)
    )
  );

revoke all privileges on table
  public.crm_organizations,
  public.crm_people,
  public.crm_teams,
  public.crm_team_memberships,
  public.crm_portfolios,
  public.crm_portfolio_organizations,
  public.crm_source_identities,
  public.crm_reporting_scopes,
  public.crm_role_scope_types,
  public.crm_user_reporting_scope_grants
from public, anon, authenticated, service_role;

grant select on table
  public.crm_organizations,
  public.crm_people,
  public.crm_teams,
  public.crm_team_memberships,
  public.crm_portfolios,
  public.crm_portfolio_organizations,
  public.crm_reporting_scopes,
  public.crm_user_reporting_scope_grants
to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    is_active,
    profile_completed,
    access_status
  ) values (
    new.id,
    new.email,
    false,
    false,
    'pending'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_key)
  values (new.id, 'pending')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public._internal_has_permission(
  user_uuid uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_approved_user(user_uuid) then false
    when not exists (
      select 1
      from public.user_roles user_role
      where user_role.user_id = user_uuid
        and private.user_role_scope_is_valid(user_uuid, user_role.role_key)
    ) then false
    when exists (
      select 1
      from public.user_permission_overrides permission_override
      where permission_override.user_id = user_uuid
        and permission_override.permission_key = _internal_has_permission.permission_key
        and permission_override.effect = 'deny'
    ) then false
    when exists (
      select 1
      from public.user_permission_overrides permission_override
      where permission_override.user_id = user_uuid
        and permission_override.permission_key = _internal_has_permission.permission_key
        and permission_override.effect = 'allow'
    ) then true
    when exists (
      select 1
      from public.user_roles user_role
      join public.role_permissions role_permission
        on role_permission.role_key = user_role.role_key
      where user_role.user_id = user_uuid
        and role_permission.permission_key = _internal_has_permission.permission_key
    ) then true
    else false
  end;
$$;

create or replace function public._internal_list_permissions(user_uuid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_role as (
    select user_role.role_key
    from public.user_roles user_role
    where user_role.user_id = user_uuid
      and private.is_approved_user(user_uuid)
      and private.user_role_scope_is_valid(user_uuid, user_role.role_key)
  ),
  role_permissions as (
    select role_permission.permission_key
    from eligible_role user_role
    join public.role_permissions role_permission
      on role_permission.role_key = user_role.role_key
  ),
  allowed_overrides as (
    select permission_override.permission_key
    from public.user_permission_overrides permission_override
    where permission_override.user_id = user_uuid
      and permission_override.effect = 'allow'
      and exists (select 1 from eligible_role)
  ),
  combined as (
    select permission_key from role_permissions
    union
    select permission_key from allowed_overrides
  )
  select coalesce(array_agg(combined.permission_key order by combined.permission_key), array[]::text[])
  from combined
  where not exists (
    select 1
    from public.user_permission_overrides denied_override
    where denied_override.user_id = user_uuid
      and denied_override.permission_key = combined.permission_key
      and denied_override.effect = 'deny'
  );
$$;

create or replace function public.has_permission(
  user_uuid uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when user_uuid = (select auth.uid())
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_uuid)
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    else false
  end;
$$;

create or replace function public._internal_assert_actor_active(actor_uuid uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level integer;
begin
  if actor_uuid is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  if not private.is_approved_user(actor_uuid) then
    raise exception 'forbidden: actor is not approved'
      using errcode = '42501';
  end if;

  v_level := public._internal_get_role_level(actor_uuid);
  if v_level is null then
    raise exception 'unauthorized: actor has no role'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles user_role
    where user_role.user_id = actor_uuid
      and private.user_role_scope_is_valid(actor_uuid, user_role.role_key)
  ) then
    raise exception 'forbidden: actor has no active compatible reporting scope'
      using errcode = '42501';
  end if;

  return v_level;
end;
$$;

create or replace function private.lock_and_assert_actor(p_actor uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.profiles profile
  where profile.user_id = p_actor
  for update;

  return public._internal_assert_actor_active(p_actor);
end;
$$;

create or replace function public.get_user_authorization_context(user_uuid uuid)
returns table (
  user_id uuid,
  role_key text,
  level integer,
  permissions text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null or user_uuid is null then
    return;
  end if;

  if user_uuid <> v_caller
     and (
       not coalesce(public._internal_has_permission(v_caller, 'users.view'), false)
       or not coalesce(private.can_manage_user(user_uuid), false)
     ) then
    return;
  end if;

  return query
    select
      user_role.user_id,
      user_role.role_key,
      role.level,
      public._internal_list_permissions(user_role.user_id)
    from public.user_roles user_role
    join public.roles role on role.key = user_role.role_key
    join public.profiles profile
      on profile.user_id = user_role.user_id
     and profile.is_active
     and profile.access_status = 'approved'
    where user_role.user_id = user_uuid;
end;
$$;

revoke all privileges on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;
revoke all privileges on function public._internal_has_permission(uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public._internal_list_permissions(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public._internal_assert_actor_active(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function private.lock_and_assert_actor(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.has_permission(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.has_permission(uuid, text) to authenticated;
revoke all privileges on function public.get_user_authorization_context(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_user_authorization_context(uuid)
  to authenticated;

create or replace function private.enforce_authorization_target_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target uuid;
begin
  v_target := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  if tg_table_name = 'user_roles' then
    if tg_op <> 'DELETE' then
      if new.role_key = 'pending'
         and exists (
           select 1
           from public.profiles profile
           where profile.user_id = v_target
             and (profile.access_status <> 'pending' or profile.is_active)
         ) then
        raise exception 'conflict: pending role is reserved for inactive onboarding'
          using errcode = '23505';
      end if;

      if new.role_key <> 'pending'
         and exists (
           select 1
           from public.profiles profile
           where profile.user_id = v_target
             and profile.access_status = 'approved'
             and profile.is_active
         )
         and not private.user_role_scope_is_valid(v_target, new.role_key) then
        raise exception 'conflict: role is incompatible with active reporting scopes'
          using errcode = '23505';
      end if;
    end if;
  elsif tg_table_name = 'profiles' then
    if new.is_active
       and new.access_status = 'approved'
       and not exists (
         select 1
         from public.user_roles user_role
         where user_role.user_id = v_target
           and private.user_role_scope_is_valid(v_target, user_role.role_key)
       ) then
      raise exception 'conflict: approved profile requires compatible active scope'
        using errcode = '23505';
    end if;
  elsif tg_table_name = 'user_permission_overrides' then
    if tg_op <> 'DELETE'
       and new.effect = 'allow'
       and new.permission_key in (
         'crm.dashboard.view',
         'crm.stages.view',
         'crm.ranking.view',
         'pages.manage',
         'crm.settings.view',
         'crm.settings.manage',
         'crm.salesforce.refresh',
         'crm.ingest.manage'
       ) then
      raise exception 'conflict: global commercial allow requires scoped v3 read models'
        using errcode = '23505';
    end if;
  end if;

  if v_actor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not private.can_manage_user(v_target) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_scope_grant_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target uuid;
  v_scope_id uuid;
  v_actor_is_master boolean;
begin
  if tg_op = 'UPDATE'
     and (
       old.user_id is distinct from new.user_id
       or old.reporting_scope_id is distinct from new.reporting_scope_id
     ) then
    raise exception 'conflict: reporting grant identity is immutable'
      using errcode = '55000';
  end if;

  if v_actor is null then
    v_target := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    v_scope_id := case
      when tg_op = 'DELETE' then old.reporting_scope_id
      else new.reporting_scope_id
    end;
  else
    v_target := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    v_scope_id := case
      when tg_op = 'DELETE' then old.reporting_scope_id
      else new.reporting_scope_id
    end;
  end if;

  perform private.lock_reporting_scope_topology(array[v_scope_id]);
  perform 1
  from public.profiles profile
  where profile.user_id = v_target
  for update;

  if v_actor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.user_id = v_target
      and profile.is_active
      and profile.access_status = 'approved'
  ) then
    raise exception 'conflict: suspend approved user before changing reporting grants'
      using errcode = '55000';
  end if;

  v_actor_is_master := private.current_user_is_master();

  if v_target = v_actor
     or not coalesce(public._internal_has_permission(v_actor, 'users.manage'), false) then
    raise exception 'forbidden: reporting scope cannot be delegated'
      using errcode = '42501';
  end if;

  if not v_actor_is_master then
    if not private.can_manage_user(v_target)
       or not coalesce(private.can_delegate_reporting_scope(v_scope_id), false)
       or (
         tg_op = 'UPDATE'
         and not coalesce(
           private.can_delegate_reporting_scope(old.reporting_scope_id),
           false
         )
       ) then
      raise exception 'forbidden: reporting scope cannot be delegated'
        using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT'
        or (
          tg_op = 'UPDATE'
          and old.reporting_scope_id is distinct from new.reporting_scope_id
        ) then
    if not coalesce(private.can_delegate_reporting_scope(v_scope_id), false) then
      raise exception 'forbidden: new reporting scope is inactive or invalid'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.assert_person_topology_mutable(
  p_person_ids uuid[],
  p_mapped_user_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_user_id uuid;
begin
  for v_person_id in
    select distinct candidate.person_id
    from unnest(coalesce(p_person_ids, '{}'::uuid[])) candidate(person_id)
    where candidate.person_id is not null
    order by candidate.person_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'crm-person-topology:' || v_person_id::text,
        0
      )
    );
  end loop;

  for v_user_id in
    select candidate.user_id
    from (
      select person.auth_user_id as user_id
      from public.crm_people person
      where person.id = any(coalesce(p_person_ids, '{}'::uuid[]))
      union
      select mapped_user.user_id
      from unnest(
        coalesce(p_mapped_user_ids, '{}'::uuid[])
      ) mapped_user(user_id)
      union
      select scope_grant.user_id
      from public.crm_user_reporting_scope_grants scope_grant
      join public.crm_reporting_scopes reporting_scope
        on reporting_scope.id = scope_grant.reporting_scope_id
      where reporting_scope.scope_type = 'person'
        and reporting_scope.person_id = any(coalesce(p_person_ids, '{}'::uuid[]))
        and scope_grant.revoked_at is null
        and (
          scope_grant.valid_until is null
          or scope_grant.valid_until > now()
        )
    ) candidate
    where candidate.user_id is not null
    order by candidate.user_id
  loop
    perform 1
    from public.profiles profile
    where profile.user_id = v_user_id
    for update;
  end loop;

  if exists (
    select 1
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    join public.profiles profile on profile.user_id = scope_grant.user_id
    where reporting_scope.scope_type = 'person'
      and reporting_scope.person_id = any(coalesce(p_person_ids, '{}'::uuid[]))
      and scope_grant.revoked_at is null
      and (
        scope_grant.valid_until is null
        or scope_grant.valid_until > now()
      )
      and profile.is_active
      and profile.access_status = 'approved'
  ) then
    raise exception 'conflict: suspend approved person-scope users before changing topology'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.assert_portfolio_topology_mutable(
  p_portfolio_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_portfolio_id uuid;
  v_user_id uuid;
begin
  for v_portfolio_id in
    select distinct candidate.portfolio_id
    from unnest(coalesce(p_portfolio_ids, '{}'::uuid[])) candidate(portfolio_id)
    where candidate.portfolio_id is not null
    order by candidate.portfolio_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'crm-portfolio-topology:' || v_portfolio_id::text,
        0
      )
    );
  end loop;

  for v_user_id in
    select distinct scope_grant.user_id
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where reporting_scope.scope_type = 'portfolio'
      and reporting_scope.portfolio_id = any(
        coalesce(p_portfolio_ids, '{}'::uuid[])
      )
      and scope_grant.revoked_at is null
      and (
        scope_grant.valid_until is null
        or scope_grant.valid_until > now()
      )
    order by scope_grant.user_id
  loop
    perform 1
    from public.profiles profile
    where profile.user_id = v_user_id
    for update;
  end loop;

  if exists (
    select 1
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    join public.profiles profile on profile.user_id = scope_grant.user_id
    where reporting_scope.scope_type = 'portfolio'
      and reporting_scope.portfolio_id = any(
        coalesce(p_portfolio_ids, '{}'::uuid[])
      )
      and scope_grant.revoked_at is null
      and (
        scope_grant.valid_until is null
        or scope_grant.valid_until > now()
      )
      and profile.is_active
      and profile.access_status = 'approved'
  ) then
    raise exception 'conflict: suspend approved portfolio-scope users before changing topology'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.enforce_team_membership_topology()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_ids uuid[];
begin
  v_person_ids := case tg_op
    when 'INSERT' then array[new.person_id]
    when 'DELETE' then array[old.person_id]
    else array[old.person_id, new.person_id]
  end;

  perform private.assert_person_topology_mutable(v_person_ids);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_person_auth_topology()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.auth_user_id is distinct from new.auth_user_id then
    perform private.assert_person_topology_mutable(
      array[old.id, new.id],
      array[old.auth_user_id, new.auth_user_id]
    );
  end if;
  return new;
end;
$$;

create or replace function private.enforce_portfolio_organization_topology()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_portfolio_ids uuid[];
begin
  v_portfolio_ids := case tg_op
    when 'INSERT' then array[new.portfolio_id]
    when 'DELETE' then array[old.portfolio_id]
    else array[old.portfolio_id, new.portfolio_id]
  end;

  perform private.assert_portfolio_topology_mutable(v_portfolio_ids);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_reporting_scope_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.scope_key is distinct from new.scope_key
     or old.scope_type is distinct from new.scope_type
     or old.organization_id is distinct from new.organization_id
     or old.team_id is distinct from new.team_id
     or old.portfolio_id is distinct from new.portfolio_id
     or old.person_id is distinct from new.person_id then
    raise exception 'conflict: reporting scope identity is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_team_organization_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id then
    raise exception 'conflict: team organization is immutable; create a new team'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all privileges on function private.enforce_authorization_target_scope()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_scope_grant_mutation()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.assert_person_topology_mutable(uuid[], uuid[])
  from public, anon, authenticated, service_role;
revoke all privileges on function private.assert_portfolio_topology_mutable(uuid[])
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_team_membership_topology()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_person_auth_topology()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_portfolio_organization_topology()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_reporting_scope_identity()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_team_organization_identity()
  from public, anon, authenticated, service_role;

create trigger profiles_require_scoped_actor
  before update of is_active, access_status on public.profiles
  for each row execute function private.enforce_authorization_target_scope();
create trigger user_roles_require_scoped_actor
  before insert or update or delete on public.user_roles
  for each row execute function private.enforce_authorization_target_scope();
create trigger user_permission_overrides_require_scoped_actor
  before insert or update or delete on public.user_permission_overrides
  for each row execute function private.enforce_authorization_target_scope();
create trigger user_reporting_scope_grants_require_scoped_actor
  before insert or update or delete on public.crm_user_reporting_scope_grants
  for each row execute function private.enforce_scope_grant_mutation();
create trigger crm_team_memberships_topology_insert_delete
  before insert or delete on public.crm_team_memberships
  for each row execute function private.enforce_team_membership_topology();
create trigger crm_team_memberships_topology_update
  before update of team_id, person_id, valid_from, valid_until
  on public.crm_team_memberships
  for each row execute function private.enforce_team_membership_topology();
create trigger crm_people_auth_topology_update
  before update of auth_user_id on public.crm_people
  for each row execute function private.enforce_person_auth_topology();
create trigger crm_portfolio_organizations_topology_insert_delete
  before insert or delete on public.crm_portfolio_organizations
  for each row execute function private.enforce_portfolio_organization_topology();
create trigger crm_portfolio_organizations_topology_update
  before update of portfolio_id, organization_id, valid_from, valid_until
  on public.crm_portfolio_organizations
  for each row execute function private.enforce_portfolio_organization_topology();
create trigger crm_reporting_scopes_identity_immutable
  before update of scope_key, scope_type, organization_id, team_id, portfolio_id, person_id
  on public.crm_reporting_scopes
  for each row execute function private.enforce_reporting_scope_identity();
create trigger crm_teams_organization_immutable
  before update of organization_id on public.crm_teams
  for each row execute function private.enforce_team_organization_identity();

drop policy if exists profiles_select_self_or_users_view on public.profiles;
create policy profiles_select_self_or_scoped_manager
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_id)
    )
  );

drop policy if exists user_roles_select_self_or_users_view on public.user_roles;
create policy user_roles_select_self_or_scoped_manager
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_id)
    )
  );

drop policy if exists user_permission_overrides_select_self_or_permissions_view
  on public.user_permission_overrides;
create policy user_permission_overrides_select_self_or_scoped_manager
  on public.user_permission_overrides for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.has_permission((select auth.uid()), 'permissions.view')
      and private.can_manage_user(user_id)
    )
  );

drop policy if exists audit_logs_select_with_audit_view on public.audit_logs;
create policy audit_logs_select_scoped
  on public.audit_logs for select to authenticated
  using (
    public.has_permission((select auth.uid()), 'audit.view')
    and (
      private.current_user_is_master()
      or (
        reporting_scope_id is not null
        and private.can_delegate_reporting_scope(reporting_scope_id)
      )
    )
  );

create or replace function public.approve_user_access(
  target_user_id uuid,
  target_role_key text,
  reporting_scope_ids uuid[],
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
#variable_conflict use_variable
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_actor_role text;
  v_actor_is_master boolean := false;
  v_target_role_level integer;
  v_existing_target_level integer;
  v_scope_count integer := coalesce(cardinality(reporting_scope_ids), 0);
  v_profile public.profiles;
  v_primary_scope uuid;
  v_audit_id bigint;
  v_now timestamptz := now();
begin
  v_actor_level := public._internal_assert_actor_active(v_actor);

  select user_role.role_key
  into v_actor_role
  from public.user_roles user_role
  where user_role.user_id = v_actor;

  v_actor_is_master := private.current_user_is_master();

  if (v_actor_role is null or v_actor_role not in ('master', 'admin'))
     or not coalesce(public._internal_has_permission(v_actor, 'users.manage'), false)
     or not coalesce(public._internal_has_permission(v_actor, 'roles.manage'), false) then
    raise exception 'forbidden: actor cannot approve users'
      using errcode = '42501';
  end if;

  if target_user_id is null
     or target_role_key is null
     or nullif(btrim(coalesce(reason, '')), '') is null then
    raise exception 'invalid_argument: target, role and reason are required'
      using errcode = '22023';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-approval is not allowed'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: pending identity is outside actor scope'
      using errcode = '42501';
  end if;

  select role.level
  into v_target_role_level
  from public.roles role
  where role.key = target_role_key;

  if v_target_role_level is null
     or target_role_key in ('master', 'pending', 'user', 'supervisor', 'broker_lead') then
    raise exception 'invalid_argument: role is not available for scoped approval'
      using errcode = '22023';
  end if;

  if v_target_role_level >= v_actor_level
     or not public.can_assign_role(v_actor, target_role_key) then
    raise exception 'forbidden: actor cannot assign requested role'
      using errcode = '42501';
  end if;

  if v_scope_count < 1
     or exists (
       select 1
       from unnest(reporting_scope_ids) requested(scope_id)
       where requested.scope_id is null
     )
     or (
       select count(distinct requested.scope_id)
       from unnest(reporting_scope_ids) requested(scope_id)
     ) <> v_scope_count then
    raise exception 'invalid_argument: reporting scopes are required and must be unique'
      using errcode = '22023';
  end if;

  if not v_actor_is_master
     and not private.can_approve_reporting_scopes(
       target_role_key,
       reporting_scope_ids
     ) then
    raise exception 'forbidden: requested scope is outside actor scope'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(reporting_scope_ids) requested(scope_id)
    left join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = requested.scope_id
     and reporting_scope.is_active
    where reporting_scope.id is null
  ) then
    raise exception 'invalid_argument: unknown or inactive reporting scope'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(reporting_scope_ids) requested(scope_id)
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = requested.scope_id
    where not exists (
      select 1
      from public.crm_role_scope_types allowed_scope
      where allowed_scope.role_key = target_role_key
        and allowed_scope.scope_type = reporting_scope.scope_type
    )
  ) then
    raise exception 'invalid_argument: reporting scope is incompatible with role'
      using errcode = '22023';
  end if;

  if target_role_key in ('manager', 'broker', 'real_estate', 'house')
     and v_scope_count <> 1 then
    raise exception 'invalid_argument: role requires exactly one reporting scope'
      using errcode = '22023';
  end if;

  if target_role_key = 'house'
     and exists (
       select 1
       from unnest(reporting_scope_ids) requested(scope_id)
       join public.crm_reporting_scopes reporting_scope
         on reporting_scope.id = requested.scope_id
       join public.crm_organizations organization
         on organization.id = reporting_scope.organization_id
       where organization.kind <> 'house'
     ) then
    raise exception 'invalid_argument: House requires a House organization'
      using errcode = '22023';
  end if;

  if target_role_key = 'real_estate'
     and exists (
       select 1
       from unnest(reporting_scope_ids) requested(scope_id)
       join public.crm_reporting_scopes reporting_scope
         on reporting_scope.id = requested.scope_id
       join public.crm_organizations organization
         on organization.id = reporting_scope.organization_id
       where organization.kind <> 'real_estate'
     ) then
    raise exception 'invalid_argument: Real Estate requires a real-estate organization'
      using errcode = '22023';
  end if;

  if target_role_key = 'partnership_channel'
     and exists (
       select 1
       from unnest(reporting_scope_ids) requested(scope_id)
       join public.crm_reporting_scopes reporting_scope
         on reporting_scope.id = requested.scope_id
       join public.crm_portfolios portfolio
         on portfolio.id = reporting_scope.portfolio_id
       where portfolio.kind <> 'partnership'
     ) then
    raise exception 'invalid_argument: Partnership Channel requires a partnership portfolio'
      using errcode = '22023';
  end if;

  perform private.lock_reporting_scope_topology(reporting_scope_ids);

  v_actor_level := private.lock_and_assert_actor(v_actor);

  select user_role.role_key
  into v_actor_role
  from public.user_roles user_role
  where user_role.user_id = v_actor;

  v_actor_is_master := private.current_user_is_master();

  if (v_actor_role is null or v_actor_role not in ('master', 'admin'))
     or not coalesce(public._internal_has_permission(v_actor, 'users.manage'), false)
     or not coalesce(public._internal_has_permission(v_actor, 'roles.manage'), false) then
    raise exception 'forbidden: actor cannot approve users'
      using errcode = '42501';
  end if;

  if v_target_role_level >= v_actor_level
     or not public.can_assign_role(v_actor, target_role_key) then
    raise exception 'forbidden: actor cannot assign requested role'
      using errcode = '42501';
  end if;

  select profile.*
  into v_profile
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if not found then
    raise exception 'not_found: user profile does not exist'
      using errcode = 'P0002';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: pending identity is outside actor scope'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not private.can_approve_reporting_scopes(
       target_role_key,
       reporting_scope_ids
     ) then
    raise exception 'forbidden: requested scope is outside actor scope'
      using errcode = '42501';
  end if;

  if v_profile.is_active
     or v_profile.access_status not in ('pending', 'legacy_review') then
    raise exception 'conflict: only pending or legacy-review accounts can be approved'
      using errcode = '23505';
  end if;

  select role.level
  into v_existing_target_level
  from public.user_roles user_role
  join public.roles role on role.key = user_role.role_key
  where user_role.user_id = target_user_id;

  if not v_actor_is_master
     and (
       v_existing_target_level is null
       or v_existing_target_level >= v_actor_level
     ) then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides permission_override
    where permission_override.user_id = target_user_id
  ) then
    raise exception 'conflict: clear audited permission exceptions before approval'
      using errcode = '23505';
  end if;

  if target_role_key = 'broker'
     and exists (
       select 1
       from unnest(reporting_scope_ids) requested(scope_id)
       join public.crm_reporting_scopes reporting_scope
         on reporting_scope.id = requested.scope_id
       join public.crm_people person
         on person.id = reporting_scope.person_id
       where person.auth_user_id is distinct from target_user_id
     ) then
    raise exception 'invalid_argument: Broker person scope must match target Auth user'
      using errcode = '22023';
  end if;

  update public.crm_user_reporting_scope_grants scope_grant
  set revoked_at = v_now,
      revoked_by = v_actor,
      revocation_reason = 'Replaced during scoped approval: ' || btrim(reason)
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and (scope_grant.valid_until is null or scope_grant.valid_until > v_now);

  insert into public.crm_user_reporting_scope_grants (
    user_id,
    reporting_scope_id,
    granted_by,
    reason,
    valid_from
  )
  select
    target_user_id,
    requested.scope_id,
    v_actor,
    btrim(reason),
    v_now
  from unnest(reporting_scope_ids) requested(scope_id);

  insert into public.user_roles (user_id, role_key, assigned_by)
  values (target_user_id, target_role_key, v_actor)
  on conflict (user_id) do update
  set role_key = excluded.role_key,
      assigned_by = excluded.assigned_by,
      updated_at = now();

  if not private.user_role_scope_is_valid(target_user_id, target_role_key) then
    raise exception 'conflict: approved role requires compatible active scopes'
      using errcode = '23505';
  end if;

  update public.profiles profile
  set is_active = true,
      access_status = 'approved',
      approved_at = v_now,
      approved_by = v_actor
  where profile.user_id = target_user_id;

  v_primary_scope := case
    when v_scope_count = 1 then reporting_scope_ids[1]
    else null
  end;

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after,
    reporting_scope_id
  ) values (
    v_actor,
    target_user_id,
    'authorization.user_approved',
    jsonb_build_object(
      'access_status', v_profile.access_status,
      'is_active', v_profile.is_active,
      'reason', btrim(reason)
    ),
    jsonb_build_object(
      'access_status', 'approved',
      'is_active', true,
      'role_key', target_role_key,
      'reporting_scope_ids', to_jsonb(reporting_scope_ids)
    ),
    v_primary_scope
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', v_audit_id,
    'user_id', target_user_id,
    'role_key', target_role_key,
    'reporting_scope_ids', to_jsonb(reporting_scope_ids)
  );
end;
$$;

create or replace function public.set_user_active(
  target_user_id uuid,
  target_is_active boolean,
  reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_actor_role text;
  v_actor_is_master boolean := false;
  v_target_level integer;
  v_target_role text;
  v_scope_ids uuid[];
  v_before public.profiles;
  v_after public.profiles;
  v_primary_scope uuid;
begin
  v_actor_level := public._internal_assert_actor_active(v_actor);

  select user_role.role_key
  into v_actor_role
  from public.user_roles user_role
  where user_role.user_id = v_actor;

  v_actor_is_master := private.current_user_is_master();

  if not public._internal_has_permission(v_actor, 'users.manage') then
    raise exception 'forbidden: actor cannot manage users'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_is_active is null then
    raise exception 'invalid_argument: target and status are required'
      using errcode = '22023';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if target_is_active
     and (v_actor_role is null or v_actor_role not in ('master', 'admin')) then
    raise exception 'forbidden: actor cannot reactivate users'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  select coalesce(
    array_agg(scope_grant.reporting_scope_id order by scope_grant.reporting_scope_id),
    '{}'::uuid[]
  )
  into v_scope_ids
  from public.crm_user_reporting_scope_grants scope_grant
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and (
      scope_grant.valid_until is null
      or scope_grant.valid_until > now()
    );

  perform private.lock_reporting_scope_topology(v_scope_ids);

  v_actor_level := private.lock_and_assert_actor(v_actor);

  select user_role.role_key
  into v_actor_role
  from public.user_roles user_role
  where user_role.user_id = v_actor;

  v_actor_is_master := private.current_user_is_master();

  if not public._internal_has_permission(v_actor, 'users.manage') then
    raise exception 'forbidden: actor cannot manage users'
      using errcode = '42501';
  end if;

  if target_is_active
     and (v_actor_role is null or v_actor_role not in ('master', 'admin')) then
    raise exception 'forbidden: actor cannot reactivate users'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  select profile.*
  into v_before
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if not found then
    raise exception 'not_found: user profile does not exist'
      using errcode = 'P0002';
  end if;

  select user_role.role_key
  into v_actor_role
  from public.user_roles user_role
  where user_role.user_id = v_actor;

  v_actor_is_master := private.current_user_is_master();

  if target_is_active
     and (v_actor_role is null or v_actor_role not in ('master', 'admin')) then
    raise exception 'forbidden: actor cannot reactivate users'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if v_before.access_status in ('pending', 'legacy_review') then
    raise exception 'conflict: onboarding account requires scoped approval'
      using errcode = '23505';
  end if;

  select user_role.role_key
  into v_target_role
  from public.user_roles user_role
  where user_role.user_id = target_user_id;

  if target_is_active
     and (
       v_target_role is null
       or not private.user_role_scope_is_valid(target_user_id, v_target_role)
     ) then
    raise exception 'conflict: reactivation requires a compatible active reporting scope'
      using errcode = '23505';
  end if;

  if target_is_active
     and exists (
       select 1
       from public.user_permission_overrides permission_override
       where permission_override.user_id = target_user_id
     ) then
    raise exception 'conflict: reconcile audited permission exceptions before reactivation'
      using errcode = '23505';
  end if;

  update public.profiles profile
  set is_active = target_is_active,
      access_status = case
        when target_is_active then 'approved'
        else 'suspended'
      end
  where profile.user_id = target_user_id
  returning profile.* into v_after;

  select case
    when count(*) = 1
      then (array_agg(scope_grant.reporting_scope_id))[1]
    else null
  end
  into v_primary_scope
  from public.crm_user_reporting_scope_grants scope_grant
  join public.crm_reporting_scopes reporting_scope
    on reporting_scope.id = scope_grant.reporting_scope_id
   and reporting_scope.is_active
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and scope_grant.valid_from <= now()
    and (scope_grant.valid_until is null or scope_grant.valid_until > now());

  if v_before.is_active is distinct from v_after.is_active
     or v_before.access_status is distinct from v_after.access_status then
    insert into public.audit_logs (
      actor_id,
      target_user_id,
      action,
      before,
      after,
      reporting_scope_id
    ) values (
      v_actor,
      target_user_id,
      'authorization.user_status_changed',
      jsonb_build_object(
        'is_active', v_before.is_active,
        'access_status', v_before.access_status
      ),
      jsonb_build_object(
        'is_active', v_after.is_active,
        'access_status', v_after.access_status,
        'reason', nullif(btrim(reason), '')
      ),
      v_primary_scope
    );
  end if;

  return v_after;
end;
$$;

create or replace function public.bootstrap_master_user(master_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_master uuid;
  v_existing_role text;
  v_existing_complete boolean := false;
  v_global_scope uuid;
  v_audit_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.bootstrap_master_user', 0)
  );

  if master_user_id is null then
    raise exception 'invalid_argument: master_user_id is required'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users auth_user where auth_user.id = master_user_id) then
    raise exception 'not_found: master user does not exist in auth.users'
      using errcode = 'P0002';
  end if;

  select user_role.user_id
  into v_existing_master
  from public.user_roles user_role
  where user_role.role_key = 'master'
  for update;

  if v_existing_master is not null and v_existing_master <> master_user_id then
    raise exception 'conflict: a different master user already exists'
      using errcode = '23505';
  end if;

  select user_role.role_key
  into v_existing_role
  from public.user_roles user_role
  where user_role.user_id = master_user_id
  for update;

  select reporting_scope.id
  into v_global_scope
  from public.crm_reporting_scopes reporting_scope
  where reporting_scope.scope_key = 'global'
    and reporting_scope.scope_type = 'global'
    and reporting_scope.is_active;

  if v_global_scope is null then
    raise exception 'conflict: active global reporting scope does not exist'
      using errcode = '23505';
  end if;

  select
    v_existing_master = master_user_id
    and exists (
      select 1
      from public.profiles profile
      where profile.user_id = master_user_id
        and profile.is_active
        and profile.access_status = 'approved'
    )
    and exists (
      select 1
      from public.crm_user_reporting_scope_grants scope_grant
      where scope_grant.user_id = master_user_id
        and scope_grant.reporting_scope_id = v_global_scope
        and scope_grant.revoked_at is null
        and scope_grant.valid_from <= now()
        and (scope_grant.valid_until is null or scope_grant.valid_until > now())
    )
    and private.user_role_scope_is_valid(master_user_id, 'master')
  into v_existing_complete;

  if v_existing_complete then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  insert into public.profiles (
    user_id,
    is_active,
    access_status
  ) values (
    master_user_id,
    false,
    'pending'
  )
  on conflict (user_id) do nothing;

  update public.crm_user_reporting_scope_grants scope_grant
  set revoked_at = now(),
      revoked_by = master_user_id,
      revocation_reason = 'Replaced during Master bootstrap repair'
  where scope_grant.user_id = master_user_id
    and scope_grant.reporting_scope_id = v_global_scope
    and scope_grant.revoked_at is null
    and scope_grant.valid_until is null
    and scope_grant.valid_from > now();

  update public.crm_user_reporting_scope_grants scope_grant
  set revoked_at = now(),
      revoked_by = master_user_id,
      revocation_reason = 'Removed incompatible scope during Master bootstrap repair'
  from public.crm_reporting_scopes reporting_scope
  where reporting_scope.id = scope_grant.reporting_scope_id
    and scope_grant.user_id = master_user_id
    and reporting_scope.scope_type <> 'global'
    and scope_grant.revoked_at is null
    and (scope_grant.valid_until is null or scope_grant.valid_until > now());

  insert into public.crm_user_reporting_scope_grants (
    user_id,
    reporting_scope_id,
    granted_by,
    reason
  ) values (
    master_user_id,
    v_global_scope,
    master_user_id,
    'Master bootstrap global scope'
  )
  on conflict (user_id, reporting_scope_id)
    where valid_until is null and revoked_at is null
  do nothing;

  insert into public.user_roles (user_id, role_key, assigned_by)
  values (master_user_id, 'master', master_user_id)
  on conflict (user_id) do update
  set role_key = 'master',
      assigned_by = master_user_id,
      updated_at = now();

  update public.profiles profile
  set is_active = true,
      access_status = 'approved',
      approved_at = coalesce(profile.approved_at, now()),
      approved_by = master_user_id
  where profile.user_id = master_user_id;

  if not private.user_role_scope_is_valid(master_user_id, 'master') then
    raise exception 'conflict: Master bootstrap requires an active global scope'
      using errcode = '23505';
  end if;

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after,
    reporting_scope_id
  ) values (
    master_user_id,
    master_user_id,
    'authorization.master_bootstrap',
    case
      when v_existing_role is null then null::jsonb
      else jsonb_build_object('role_key', v_existing_role)
    end,
    jsonb_build_object(
      'role_key', 'master',
      'level', 100,
      'access_status', 'approved'
    ),
    v_global_scope
  )
  returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

create or replace function public.assign_user_role(
  target_user_id uuid,
  target_role_key text,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_actor_is_master boolean := false;
  v_target_level integer;
  v_target_role text;
  v_new_level integer;
  v_audit_scope uuid;
  v_audit_id bigint;
begin
  if target_user_id is null
     or target_role_key is null
     or nullif(btrim(coalesce(reason, '')), '') is null then
    raise exception 'invalid_argument: target, role and reason are required'
      using errcode = '22023';
  end if;

  v_actor_level := private.lock_and_assert_actor(v_actor);
  v_actor_is_master := private.current_user_is_master();

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and not coalesce(private.can_manage_user(target_user_id), false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles profile
  where profile.user_id = target_user_id
    and profile.is_active
    and profile.access_status = 'approved'
  for update;

  if not found then
    raise exception 'conflict: pending or inactive account requires scoped approval/reactivation'
      using errcode = '23505';
  end if;

  select role.level
  into v_new_level
  from public.roles role
  where role.key = target_role_key;

  if v_new_level is null or target_role_key in ('master', 'pending') then
    raise exception 'invalid_argument: role is not available for assignment'
      using errcode = '22023';
  end if;

  select user_role.role_key, role.level
  into v_target_role, v_target_level
  from public.user_roles user_role
  join public.roles role on role.key = user_role.role_key
  where user_role.user_id = target_user_id
  for update;

  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if not public.can_assign_role(v_actor, target_role_key) then
    raise exception 'forbidden: actor cannot assign requested role'
      using errcode = '42501';
  end if;

  if not private.user_role_scope_is_valid(target_user_id, target_role_key) then
    raise exception 'conflict: role is incompatible with active reporting scopes'
      using errcode = '23505';
  end if;

  insert into public.user_roles (user_id, role_key, assigned_by)
  values (target_user_id, target_role_key, v_actor)
  on conflict (user_id) do update
  set role_key = excluded.role_key,
      assigned_by = excluded.assigned_by,
      updated_at = now();

  select case
    when count(*) = 1
      then (array_agg(scope_grant.reporting_scope_id))[1]
    else null
  end
  into v_audit_scope
  from public.crm_user_reporting_scope_grants scope_grant
  join public.crm_reporting_scopes reporting_scope
    on reporting_scope.id = scope_grant.reporting_scope_id
   and reporting_scope.is_active
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and scope_grant.valid_from <= now()
    and (scope_grant.valid_until is null or scope_grant.valid_until > now());

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after,
    reporting_scope_id
  ) values (
    v_actor,
    target_user_id,
    'authorization.role_assigned',
    jsonb_build_object(
      'previous', jsonb_build_object(
        'role_key', v_target_role,
        'level', v_target_level
      ),
      'reason', btrim(reason)
    ),
    jsonb_build_object('role_key', target_role_key, 'level', v_new_level),
    v_audit_scope
  )
  returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

revoke all privileges on function public.assign_user_role(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.assign_user_role(uuid, text, text)
  to authenticated;

create or replace function public.set_user_permission_override(
  target_user_id uuid,
  permission_key text,
  effect text,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_previous_effect text;
  v_audit_scope uuid;
  v_audit_id bigint;
begin
  if target_user_id is null
     or permission_key is null
     or nullif(btrim(coalesce(reason, '')), '') is null then
    raise exception 'invalid_argument: target, permission and reason are required'
      using errcode = '22023';
  end if;

  if set_user_permission_override.effect not in ('allow', 'deny') then
    raise exception 'invalid_argument: effect must be allow or deny'
      using errcode = '22023';
  end if;

  v_actor_level := private.lock_and_assert_actor(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  -- Scope denial occurs before any target role/override lookup, preventing
  -- horizontal metadata oracles (including the idempotent no-op path).
  if not private.can_manage_user(target_user_id) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if not private.can_manage_user(target_user_id) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  if not private.is_approved_user(target_user_id) then
    raise exception 'conflict: permission exceptions require an approved target'
      using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.permissions permission
    where permission.key = set_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission'
      using errcode = '22023';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(
    v_actor,
    set_user_permission_override.permission_key
  ) then
    raise exception 'forbidden: actor cannot grant requested permission'
      using errcode = '42501';
  end if;

  select permission_override.effect
  into v_previous_effect
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = set_user_permission_override.permission_key
  for update;

  insert into public.user_permission_overrides (
    user_id,
    permission_key,
    effect,
    reason,
    granted_by
  ) values (
    target_user_id,
    set_user_permission_override.permission_key,
    set_user_permission_override.effect,
    btrim(reason),
    v_actor
  )
  on conflict (user_id, permission_key) do update
  set effect = excluded.effect,
      reason = excluded.reason,
      granted_by = excluded.granted_by;

  select case
    when count(*) = 1
      then (array_agg(scope_grant.reporting_scope_id))[1]
    else null
  end
  into v_audit_scope
  from public.crm_user_reporting_scope_grants scope_grant
  join public.crm_reporting_scopes reporting_scope
    on reporting_scope.id = scope_grant.reporting_scope_id
   and reporting_scope.is_active
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and scope_grant.valid_from <= now()
    and (scope_grant.valid_until is null or scope_grant.valid_until > now());

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after,
    reporting_scope_id
  ) values (
    v_actor,
    target_user_id,
    'authorization.permission_override_set',
    jsonb_build_object(
      'permission_key', set_user_permission_override.permission_key,
      'previous', case
        when v_previous_effect is null then null::jsonb
        else jsonb_build_object('effect', v_previous_effect)
      end,
      'reason', btrim(reason)
    ),
    jsonb_build_object('effect', set_user_permission_override.effect),
    v_audit_scope
  )
  returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

create or replace function public.remove_user_permission_override(
  target_user_id uuid,
  permission_key text,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_previous_effect text;
  v_audit_scope uuid;
  v_audit_id bigint;
begin
  if target_user_id is null
     or permission_key is null
     or nullif(btrim(coalesce(reason, '')), '') is null then
    raise exception 'invalid_argument: target, permission and reason are required'
      using errcode = '22023';
  end if;

  v_actor_level := private.lock_and_assert_actor(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not private.can_manage_user(target_user_id) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if not private.can_manage_user(target_user_id) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.permissions permission
    where permission.key = remove_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission'
      using errcode = '22023';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(
    v_actor,
    remove_user_permission_override.permission_key
  ) then
    raise exception 'forbidden: actor cannot manage requested permission'
      using errcode = '42501';
  end if;

  select permission_override.effect
  into v_previous_effect
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = remove_user_permission_override.permission_key
  for update;

  if v_previous_effect is null then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  delete from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = remove_user_permission_override.permission_key;

  select case
    when count(*) = 1
      then (array_agg(scope_grant.reporting_scope_id))[1]
    else null
  end
  into v_audit_scope
  from public.crm_user_reporting_scope_grants scope_grant
  join public.crm_reporting_scopes reporting_scope
    on reporting_scope.id = scope_grant.reporting_scope_id
   and reporting_scope.is_active
  where scope_grant.user_id = target_user_id
    and scope_grant.revoked_at is null
    and scope_grant.valid_from <= now()
    and (scope_grant.valid_until is null or scope_grant.valid_until > now());

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after,
    reporting_scope_id
  ) values (
    v_actor,
    target_user_id,
    'authorization.permission_override_removed',
    jsonb_build_object(
      'permission_key', remove_user_permission_override.permission_key,
      'effect', v_previous_effect,
      'reason', btrim(reason)
    ),
    null,
    v_audit_scope
  )
  returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

revoke all privileges on function public.set_user_permission_override(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_user_permission_override(uuid, text, text, text)
  to authenticated;
revoke all privileges on function public.remove_user_permission_override(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_user_permission_override(uuid, text, text)
  to authenticated;

revoke all privileges on function public.approve_user_access(uuid, text, uuid[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_user_access(uuid, text, uuid[], text)
  to authenticated;

revoke all privileges on function public.set_user_active(uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_user_active(uuid, boolean, text)
  to authenticated;

revoke all privileges on function public.bootstrap_master_user(uuid)
  from public, anon, authenticated, service_role;

comment on function public.approve_user_access(uuid, text, uuid[], text) is
  'Atomically approves one pending account with an explicit role, scopes and audit reason.';
comment on table public.crm_source_identities is
  'Quarantined stable source identifiers; names never authorize access.';
comment on table public.crm_reporting_scopes is
  'Canonical global, organization, team, portfolio or person reporting scope.';
comment on table public.crm_user_reporting_scope_grants is
  'Audited, time-bounded grants connecting approved Auth users to reporting scopes.';
