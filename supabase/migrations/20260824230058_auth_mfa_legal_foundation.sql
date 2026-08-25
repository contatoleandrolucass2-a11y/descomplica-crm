-- Authentication hardening foundation:
--   * bind every authenticated data read/write to a live auth.sessions row;
--   * require AAL2 whenever the user has a verified MFA factor;
--   * keep the legal-acceptance ledger private and append-only;
--   * prevent newly registered users from being approved without the exact
--     versioned Terms and Privacy acceptance required at registration.
--
-- This migration does not enable MFA remotely and does not change any
-- commercial/integration feature flag.

create or replace function private.current_session_is_live()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_claims jsonb := (select auth.jwt());
  v_session_id text;
begin
  if v_user_id is null then
    return false;
  end if;

  v_session_id := nullif(v_claims ->> 'session_id', '');

  -- Existing pgTAP files historically model auth.uid() with the legacy
  -- per-claim GUCs while connected as postgres. That privileged, local-only
  -- harness is already able to bypass RLS. Real PostgREST requests run under
  -- session_user=authenticator and must always carry a session_id claim.
  if v_session_id is null then
    return session_user = 'postgres'
      and nullif(current_setting('request.jwt.claims', true), '') is null;
  end if;

  return exists (
    select 1
    from auth.sessions session
    where session.id::text = v_session_id
      and session.user_id = v_user_id
      and (session.not_after is null or session.not_after > now())
  );
end;
$$;

revoke all privileges on function private.current_session_is_live()
  from public, anon, authenticated, service_role;

create or replace function private.current_session_satisfies_mfa()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_claims jsonb := (select auth.jwt());
  v_session_id text := nullif(v_claims ->> 'session_id', '');
  v_session_aal text;
begin
  if not private.current_session_is_live() then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_claims -> 'amr') = 'array' then v_claims -> 'amr'
        else '[]'::jsonb
      end
    ) as method(value)
    where method.value #>> '{}' in ('recovery', 'otp')
       or method.value ->> 'method' in ('recovery', 'otp')
  ) then
    return false;
  end if;

  if v_session_id is null then
    return true;
  end if;

  select session.aal::text
    into v_session_aal
  from auth.sessions session
  where session.id::text = v_session_id
    and session.user_id = v_user_id;

  if exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = v_user_id
      and factor.status = 'verified'
  ) then
    return coalesce(v_claims ->> 'aal', '') = 'aal2'
      and v_session_aal = 'aal2';
  end if;

  return true;
end;
$$;

revoke all privileges on function private.current_session_satisfies_mfa()
  from public, anon, authenticated, service_role;
grant execute on function private.current_session_satisfies_mfa()
  to authenticated;

create or replace function public.current_session_is_live()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_session_is_live();
$$;

revoke all privileges on function public.current_session_is_live()
  from public, anon, authenticated, service_role;
grant execute on function public.current_session_is_live()
  to authenticated;

create or replace function private.current_session_is_fresh_password_recovery()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_session_is_live()
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof((select auth.jwt()) -> 'amr') = 'array'
            then (select auth.jwt()) -> 'amr'
          else '[]'::jsonb
        end
      ) as method(value)
      where method.value ->> 'method' in ('recovery', 'otp')
        and jsonb_typeof(method.value -> 'timestamp') = 'number'
        and method.value ->> 'timestamp' ~ '^[0-9]{1,12}$'
        and extract(epoch from now())::bigint - (method.value ->> 'timestamp')::bigint
          between -60 and 900
    );
$$;

revoke all privileges on function private.current_session_is_fresh_password_recovery()
  from public, anon, authenticated, service_role;

create or replace function public.revoke_current_user_sessions_after_password_recovery()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
     or not private.current_session_is_fresh_password_recovery() then
    raise exception 'unauthorized: fresh password recovery required'
      using errcode = '28000';
  end if;

  delete from auth.sessions session
  where session.user_id = v_user_id;

  return true;
end;
$$;

revoke all privileges on function public.revoke_current_user_sessions_after_password_recovery()
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_current_user_sessions_after_password_recovery()
  to authenticated;

-- Permission resolution is the common authorization seam for page guards,
-- API handlers, RLS policies and privileged RPCs. A revoked or under-assured
-- caller must receive no permission even while its signed access JWT has not
-- reached exp.
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
    when user_uuid = (select auth.uid())
      and not (select private.current_session_satisfies_mfa()) then false
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

revoke all privileges on function public._internal_has_permission(uuid, text)
  from public, anon, authenticated, service_role;

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
    when not (select private.current_session_satisfies_mfa()) then false
    when user_uuid = (select auth.uid())
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_uuid)
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    else false
  end;
$$;

revoke all privileges on function public.has_permission(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.has_permission(uuid, text)
  to authenticated;

create or replace function public.get_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when not (select private.current_session_satisfies_mfa()) then null
    when user_uuid = (select auth.uid())
      then public._internal_get_role_level(user_uuid)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      and private.can_manage_user(user_uuid)
      then public._internal_get_role_level(user_uuid)
    else null
  end;
$$;

revoke all privileges on function public.get_role_level(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_role_level(uuid)
  to authenticated;

create or replace function public.can_assign_role(actor_uuid uuid, target_role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null
      or actor_uuid is distinct from (select auth.uid())
      or not (select private.current_session_satisfies_mfa()) then false
    else
      coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
      and coalesce(
        (select role.level from public.roles role where role.key = target_role_key),
        2147483647
      ) < coalesce(public._internal_get_role_level(actor_uuid), 0)
  end;
$$;

revoke all privileges on function public.can_assign_role(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.can_assign_role(uuid, text)
  to authenticated;

create or replace function public.can_grant_permission(actor_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null
      or actor_uuid is distinct from (select auth.uid())
      or not (select private.current_session_satisfies_mfa()) then false
    else
      coalesce(public._internal_has_permission(actor_uuid, 'permissions.manage'), false)
      and coalesce(
        public._internal_has_permission(actor_uuid, can_grant_permission.permission_key),
        false
      )
      and coalesce(
        (
          select permission.min_level
          from public.permissions permission
          where permission.key = can_grant_permission.permission_key
        ),
        2147483647
      ) < coalesce(public._internal_get_role_level(actor_uuid), 0)
  end;
$$;

revoke all privileges on function public.can_grant_permission(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.can_grant_permission(uuid, text)
  to authenticated;

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

  if actor_uuid = (select auth.uid())
     and not (select private.current_session_satisfies_mfa()) then
    raise exception 'unauthorized: session assurance required'
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

revoke all privileges on function public._internal_assert_actor_active(uuid)
  from public, anon, authenticated, service_role;

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

  if not (select private.current_session_satisfies_mfa()) then
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

revoke all privileges on function public.get_user_authorization_context(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_user_authorization_context(uuid)
  to authenticated;

-- A restrictive policy is ANDed with every existing permissive policy. This
-- closes direct self/catalog/scoped reads that do not call has_permission().
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_pages',
    'audit_logs',
    'crm_dashboard_metrics',
    'crm_dashboard_snapshots',
    'crm_dashboard_top_developments',
    'crm_dashboard_views',
    'crm_funnel_goals',
    'crm_organizations',
    'crm_people',
    'crm_point_metrics',
    'crm_point_settings',
    'crm_portfolio_organizations',
    'crm_portfolios',
    'crm_ranking_participants',
    'crm_ranking_snapshots',
    'crm_reporting_scopes',
    'crm_team_memberships',
    'crm_teams',
    'crm_user_reporting_scope_grants',
    'permissions',
    'profiles',
    'role_permissions',
    'roles',
    'user_permission_overrides',
    'user_roles'
  ] loop
    execute format(
      'drop policy if exists authenticated_session_mfa_gate on public.%I',
      v_table
    );
    execute format(
      'create policy authenticated_session_mfa_gate on public.%I as restrictive for all to authenticated using ((select private.current_session_satisfies_mfa())) with check ((select private.current_session_satisfies_mfa()))',
      v_table
    );
  end loop;
end;
$$;

create table private.legal_acceptance_requirements (
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  required_at timestamptz not null default now(),
  constraint legal_acceptance_requirements_user_versions_key
    primary key (user_id, terms_version, privacy_version)
);

create table private.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null,
  constraint legal_acceptances_source_check
    check (source in ('public_registration', 'authenticated_acceptance')),
  constraint legal_acceptances_user_versions_key
    unique (user_id, terms_version, privacy_version)
);

create index legal_acceptances_user_id_idx
  on private.legal_acceptances (user_id);

alter table private.legal_acceptance_requirements enable row level security;
alter table private.legal_acceptance_requirements force row level security;
alter table private.legal_acceptances enable row level security;
alter table private.legal_acceptances force row level security;

revoke all privileges on table
  private.legal_acceptance_requirements,
  private.legal_acceptances
from public, anon, authenticated, service_role;

revoke all privileges on sequence private.legal_acceptances_id_seq
from public, anon, authenticated, service_role;

create or replace function private.prevent_legal_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'legal acceptance ledger is append-only'
    using errcode = '42501';
end;
$$;

revoke all privileges on function private.prevent_legal_ledger_mutation()
  from public, anon, authenticated, service_role;

create trigger legal_acceptance_requirements_append_only
  before update or delete on private.legal_acceptance_requirements
  for each row execute function private.prevent_legal_ledger_mutation();

create trigger legal_acceptances_append_only
  before update or delete on private.legal_acceptances
  for each row execute function private.prevent_legal_ledger_mutation();

create or replace function private.capture_registration_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms_version constant text := 'terms-2026-08-24-draft-1';
  v_privacy_version constant text := 'privacy-2026-08-24-draft-1';
  v_legal jsonb := coalesce(new.raw_user_meta_data -> 'legal_acceptance', '{}'::jsonb);
begin
  -- Legacy pgTAP fixtures insert auth.users directly as postgres and cannot
  -- represent an end-user registration. The privileged local-only harness
  -- supplies the same exact legal metadata as every other registration.
  if session_user = 'postgres' and v_legal = '{}'::jsonb then
    return new;
  end if;

  if v_legal ->> 'termsVersion' is distinct from v_terms_version
     or v_legal ->> 'privacyVersion' is distinct from v_privacy_version
     or v_legal -> 'termsAccepted' is distinct from 'true'::jsonb
     or v_legal -> 'privacyAccepted' is distinct from 'true'::jsonb then
    raise exception 'current legal acceptance required'
      using errcode = '23514';
  end if;

  insert into private.legal_acceptance_requirements (
    user_id,
    terms_version,
    privacy_version
  ) values (
    new.id,
    v_terms_version,
    v_privacy_version
  );

  insert into private.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    source
  ) values (
    new.id,
    v_terms_version,
    v_privacy_version,
    'public_registration'
  );

  return new;
end;
$$;

revoke all privileges on function private.capture_registration_legal_acceptance()
  from public, anon, authenticated, service_role;

drop trigger if exists on_auth_user_legal_acceptance on auth.users;
create trigger on_auth_user_legal_acceptance
  after insert on auth.users
  for each row execute function private.capture_registration_legal_acceptance();

create or replace function private.require_legal_acceptance_before_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.access_status = 'approved'
     and old.access_status is distinct from 'approved'
     and exists (
       select 1
       from private.legal_acceptance_requirements requirement
       where requirement.user_id = new.user_id
         and not exists (
           select 1
           from private.legal_acceptances acceptance
           where acceptance.user_id = requirement.user_id
             and acceptance.terms_version = requirement.terms_version
             and acceptance.privacy_version = requirement.privacy_version
         )
     ) then
    raise exception 'legal acceptance required before approval'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all privileges on function private.require_legal_acceptance_before_approval()
  from public, anon, authenticated, service_role;

drop trigger if exists profiles_require_legal_acceptance on public.profiles;
create trigger profiles_require_legal_acceptance
  before update of access_status on public.profiles
  for each row execute function private.require_legal_acceptance_before_approval();

comment on function private.current_session_satisfies_mfa() is
  'Fail-closed session/AAL gate. Reads only factor existence/status; never factor secrets.';
comment on table private.legal_acceptances is
  'Private append-only ledger for versioned Terms and Privacy acceptance; separate from cookie preferences.';
