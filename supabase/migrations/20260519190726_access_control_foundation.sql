-- Milestone 5.1 — Access Control Foundation
-- Creates the authorization base: profiles, roles, permissions, role_permissions,
-- user_roles, user_permission_overrides, audit_logs + helper functions + RLS.
-- Does not bootstrap the Master Developer (deferred to a later step that consumes MASTER_USER_ID from env).
-- Does not create UI, page-specific permissions, or business tables.

-- ============================================================================
-- profiles (minimal — no CPF in M5)
-- ============================================================================
create table public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  email              text,
  is_active          boolean not null default true,
  profile_completed  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- roles (catalog; level is the hierarchy anchor)
-- ============================================================================
create table public.roles (
  key         text primary key,
  name        text not null,
  level       integer not null,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint roles_level_positive check (level > 0),
  constraint roles_level_unique   unique (level)
);

insert into public.roles (key, name, level, is_system) values
  ('master',      'Master Developer', 100, true),
  ('admin',       'Administrator',     80, true),
  ('coordinator', 'Coordinator',       60, true),
  ('supervisor',  'Supervisor',        50, true),
  ('real_estate', 'Real Estate',       40, true),
  ('broker_lead', 'Broker Lead',       30, true),
  ('broker',      'Broker',            20, true),
  ('user',        'User',              10, true);

-- ============================================================================
-- permissions (catalog; min_level guards grant operations)
-- ============================================================================
create table public.permissions (
  key         text primary key,
  description text not null,
  min_level   integer not null default 10,
  created_at  timestamptz not null default now()
);

insert into public.permissions (key, description, min_level) values
  ('users.view',         'View users',                  10),
  ('users.manage',       'Create/update/disable users', 80),
  ('permissions.view',   'View permissions catalog',    10),
  ('permissions.manage', 'Grant/revoke permissions',    80),
  ('roles.view',         'View roles catalog',          10),
  ('roles.manage',       'Assign/change user roles',    80),
  ('audit.view',         'View audit log',              80),
  ('admin.access',       'Access admin surfaces',       80);

-- ============================================================================
-- role_permissions (which permissions each role implicitly grants)
-- ============================================================================
create table public.role_permissions (
  role_key       text not null references public.roles(key)       on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into public.role_permissions (role_key, permission_key)
select 'master', p.key from public.permissions p;

insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'users.view'),
  ('admin', 'users.manage'),
  ('admin', 'permissions.view'),
  ('admin', 'permissions.manage'),
  ('admin', 'roles.view'),
  ('admin', 'roles.manage'),
  ('admin', 'audit.view'),
  ('admin', 'admin.access');

-- Other roles intentionally receive no permissions in M5.
-- Page-level permission keys are declared when those features are built.

-- ============================================================================
-- user_roles (single primary role per user in M5)
-- ============================================================================
create table public.user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role_key     text not null references public.roles(key),
  assigned_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- user_permission_overrides (per-user allow/deny; deny wins)
-- ============================================================================
create table public.user_permission_overrides (
  user_id        uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  effect         text not null check (effect in ('allow','deny')),
  reason         text,
  granted_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  primary key (user_id, permission_key)
);

-- ============================================================================
-- audit_logs (append-only — see RLS below)
-- ============================================================================
create table public.audit_logs (
  id              bigserial primary key,
  actor_id        uuid,
  target_user_id  uuid,
  action          text not null,
  before          jsonb,
  after           jsonb,
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index audit_logs_actor_idx  on public.audit_logs (actor_id,       created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_user_id, created_at desc);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Authorization helper functions
--
-- Layered design:
--   * _internal_*  — SECURITY DEFINER, never granted to authenticated. Used by
--                    other SECURITY DEFINER functions in this migration. RLS
--                    policies and clients call the public wrappers below.
--   * public API   — SECURITY DEFINER wrappers that enforce a "self or
--                    users.view" rule so an authenticated caller cannot
--                    enumerate another user's role/permissions.
-- ============================================================================

-- Internal: unchecked level lookup.
create or replace function public._internal_get_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select r.level
  from public.user_roles ur
  join public.roles r on r.key = ur.role_key
  where ur.user_id = user_uuid;
$$;

-- Internal: unchecked permission resolution.
-- Order: explicit deny override > explicit allow override > role grant.
create or replace function public._internal_has_permission(user_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'deny'
    ) then false
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'allow'
    ) then true
    when exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_key = ur.role_key
      where ur.user_id = user_uuid
        and rp.permission_key = _internal_has_permission.permission_key
    ) then true
    else false
  end;
$$;

-- Public wrapper: returns the role level for the caller themselves, or — if
-- the caller holds users.view — for any user. Otherwise null.
create or replace function public.get_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when user_uuid = (select auth.uid())
      then public._internal_get_role_level(user_uuid)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      then public._internal_get_role_level(user_uuid)
    else null
  end;
$$;

-- Public wrapper: resolves whether the caller themselves (or — with
-- users.view — any user) holds a given permission. Otherwise false.
create or replace function public.has_permission(user_uuid uuid, permission_key text)
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
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    else false
  end;
$$;

-- can_assign_role: actor may assign target_role iff actor holds roles.manage
-- AND actor's level is strictly greater than the target role's level.
-- Uses internal helpers to avoid the wrapper's self/users.view guard, which
-- would falsely deny a legitimate admin operation against a target user.
create or replace function public.can_assign_role(actor_uuid uuid, target_role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (select r.level from public.roles r where r.key = target_role_key),
      2147483647
    ) < coalesce(public._internal_get_role_level(actor_uuid), 0);
$$;

-- can_grant_permission: actor must hold permissions.manage AND the permission
-- being granted, AND actor's level must exceed the permission's min_level.
create or replace function public.can_grant_permission(actor_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'permissions.manage'), false)
    and coalesce(public._internal_has_permission(actor_uuid, can_grant_permission.permission_key), false)
    and coalesce(
      (select p.min_level from public.permissions p where p.key = can_grant_permission.permission_key),
      2147483647
    ) < coalesce(public._internal_get_role_level(actor_uuid), 0);
$$;

-- Internal helpers: never executable by anon/authenticated. They are reachable
-- only through the SECURITY DEFINER wrappers above (which run as their owner).
revoke execute on function public._internal_has_permission(uuid, text) from public;
revoke execute on function public._internal_get_role_level(uuid)       from public;

-- Public API: anon cannot call; authenticated can, subject to the
-- self-or-users.view rule embedded in each wrapper.
revoke execute on function public.has_permission(uuid, text)       from public;
revoke execute on function public.get_role_level(uuid)             from public;
revoke execute on function public.can_assign_role(uuid, text)      from public;
revoke execute on function public.can_grant_permission(uuid, text) from public;

grant execute on function public.has_permission(uuid, text)       to authenticated;
grant execute on function public.get_role_level(uuid)             to authenticated;
grant execute on function public.can_assign_role(uuid, text)      to authenticated;
grant execute on function public.can_grant_permission(uuid, text) to authenticated;

-- ============================================================================
-- RLS — deny-by-default; only explicit SELECT policies are added in M5.1.
-- All state-changing operations (INSERT/UPDATE/DELETE) on authorization tables
-- are deliberately blocked here. They will be exposed in a later step via
-- SECURITY DEFINER admin functions that enforce can_assign_role /
-- can_grant_permission and append an audit_logs row atomically.
-- Service Role retains full access (used only server-side; never in the
-- browser bundle).
-- ============================================================================
alter table public.profiles                  enable row level security;
alter table public.roles                     enable row level security;
alter table public.permissions               enable row level security;
alter table public.role_permissions          enable row level security;
alter table public.user_roles                enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.audit_logs                enable row level security;

-- profiles: SELECT only in M5.1. UPDATE intentionally blocked — a future
-- Server Action with column-level control will own profile mutations. Without
-- that gate, self-UPDATE would let a user re-enable themselves (is_active) or
-- claim profile_completed.
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_select_with_users_view on public.profiles
  for select to authenticated
  using (public.has_permission((select auth.uid()), 'users.view'));

-- roles / permissions / role_permissions: catalog tables, readable to any
-- authenticated caller. Writes are blocked (no INSERT/UPDATE/DELETE policy).
create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

create policy permissions_select_authenticated on public.permissions
  for select to authenticated using (true);

create policy role_permissions_select_authenticated on public.role_permissions
  for select to authenticated using (true);

-- user_roles: user reads own; users.view holders read others. Writes blocked.
create policy user_roles_select_self on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_roles_select_with_users_view on public.user_roles
  for select to authenticated
  using (public.has_permission((select auth.uid()), 'users.view'));

-- user_permission_overrides: user reads own; permissions.view holders read all.
create policy user_permission_overrides_select_self on public.user_permission_overrides
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_permission_overrides_select_with_perm on public.user_permission_overrides
  for select to authenticated
  using (public.has_permission((select auth.uid()), 'permissions.view'));

-- audit_logs: append-only. Reads gated by audit.view. No write policy is
-- declared, so direct INSERT/UPDATE/DELETE from anon/authenticated is denied;
-- audit rows must be inserted by a SECURITY DEFINER function (M5.2+).
create policy audit_logs_select_with_audit_view on public.audit_logs
  for select to authenticated
  using (public.has_permission((select auth.uid()), 'audit.view'));

-- DEFERRED / EXPLICITLY BLOCKED IN M5.1:
--   * INSERT/UPDATE/DELETE on user_roles, user_permission_overrides, audit_logs
--   * INSERT/DELETE on profiles
--   * Any write on roles, permissions, role_permissions (system catalog)
--   * Bootstrap of the Master Developer (consumes MASTER_USER_ID from env in a
--     later step; intentionally not hard-coded here)
