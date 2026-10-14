-- Presence stores one server-observed heartbeat per user, without activity
-- history, client timestamps, routes, addresses, or other session metadata.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Presence supports the two authorization contracts already deployed by this
-- application. An unknown or partially installed scoped contract fails closed.
-- The compact branch checks its actual profile policy on every call so a later
-- restriction cannot silently be bypassed by this SECURITY DEFINER read.
create function private.user_presence_uses_scoped_contract()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_approval boolean := exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'access_status' and not attisdropped
  );
  v_has_actor_guard boolean := to_regprocedure('private.lock_and_assert_actor(uuid)') is not null;
  v_has_eligibility boolean := to_regprocedure('private.user_has_valid_role_scope(uuid)') is not null;
  v_has_visibility boolean := to_regprocedure('private.can_manage_user(uuid)') is not null;
begin
  if v_has_approval and v_has_actor_guard and v_has_eligibility and v_has_visibility then
    return true;
  end if;

  if v_has_approval or v_has_actor_guard or v_has_eligibility or v_has_visibility
     or to_regclass('public.crm_user_reporting_scope_grants') is not null
     or to_regprocedure('public._internal_assert_actor_active(uuid)') is null
     or to_regprocedure('private.current_session_satisfies_mfa()') is null
     or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass)
     or (
       select count(*) from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'profiles'
         and cmd in ('SELECT', 'ALL')
     ) <> 2
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'profiles'
         and policyname = 'profiles_select_self_or_users_view'
         and permissive = 'PERMISSIVE' and cmd = 'SELECT'
         and roles = array['authenticated']::name[]
         and regexp_replace(qual, '\s', '', 'g') =
           '((user_id=(SELECTauth.uid()ASuid))ORpublic.has_permission((SELECTauth.uid()ASuid),''users.view''::text))'
     )
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'profiles'
         and policyname = 'authenticated_session_mfa_gate'
         and permissive = 'RESTRICTIVE' and cmd = 'ALL'
         and roles = array['authenticated']::name[]
         and regexp_replace(qual, '\s', '', 'g') =
           '(SELECTprivate.current_session_satisfies_mfa()AScurrent_session_satisfies_mfa)'
     ) then
    raise exception 'User presence requires a recognized profile visibility and account contract'
      using errcode = '55000';
  end if;

  return false;
end;
$$;

alter function private.user_presence_uses_scoped_contract() owner to postgres;
revoke all privileges on function private.user_presence_uses_scoped_contract()
  from public, anon, authenticated, service_role;

do $migration$
begin
  perform private.user_presence_uses_scoped_contract();
end;
$migration$;

create table private.user_presence (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  last_seen_at timestamptz not null
);

alter table private.user_presence owner to postgres;
alter table private.user_presence enable row level security;
alter table private.user_presence force row level security;
revoke all privileges on table private.user_presence
  from public, anon, authenticated, service_role;

create function public.touch_user_presence()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_observed_at timestamptz;
  v_last_seen_at timestamptz;
begin
  if v_actor is null then
    raise exception 'unauthorized: no actor in session' using errcode = '28000';
  end if;

  if private.user_presence_uses_scoped_contract() then
    -- The scoped guard locks the account and checks approval, active status,
    -- role scope and the current session MFA requirement.
    execute 'select private.lock_and_assert_actor($1)' using v_actor;
  else
    -- The compact deployment has no approval/scope columns. Keep its live MFA
    -- and active-account guard, then explicitly require a current role. Locking
    -- the actor profile and role makes concurrent suspension/reassignment wait.
    perform public._internal_assert_actor_active(v_actor);
    perform 1 from public.profiles profile
    where profile.user_id = v_actor and profile.is_active
    for update;
    if not found then
      raise exception 'forbidden: presence requires an active account' using errcode = '42501';
    end if;
    perform 1 from public.user_roles user_role
    join public.roles role_entry on role_entry.key = user_role.role_key
    where user_role.user_id = v_actor
      and role_entry.key in (
        'master', 'admin', 'coordinator', 'manager_house', 'manager_imob',
        'broker_house', 'broker_imob'
      )
      and (role_entry.key = 'master' or role_entry.is_assignable)
    for share of user_role, role_entry;
    if not found then
      raise exception 'forbidden: presence requires a current application role' using errcode = '42501';
    end if;
    perform public._internal_assert_actor_active(v_actor);
  end if;
  v_observed_at := clock_timestamp();

  insert into private.user_presence as presence (user_id, last_seen_at)
  values (v_actor, v_observed_at)
  on conflict (user_id) do update
  set last_seen_at = excluded.last_seen_at
  where presence.last_seen_at <= excluded.last_seen_at - interval '20 seconds'
  returning presence.last_seen_at into v_last_seen_at;

  if not found then
    select presence.last_seen_at into v_last_seen_at
    from private.user_presence presence
    where presence.user_id = v_actor;
  end if;

  return v_last_seen_at;
end;
$$;

create function public.get_user_presence()
returns table (
  user_id uuid,
  last_seen_at timestamptz,
  is_online boolean,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_observed_at timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception 'unauthorized: no actor in session' using errcode = '28000';
  end if;

  if not coalesce(public.has_permission(v_actor, 'users.view'), false) then
    raise exception 'forbidden: actor cannot view user presence' using errcode = '42501';
  end if;

  if private.user_presence_uses_scoped_contract() then
    -- Dynamic SQL permits installation on compact databases where these scoped
    -- helpers do not exist. Its predicate is the scoped profiles SELECT policy.
    return query execute $query$
      select profile.user_id, presence.last_seen_at,
        coalesce(
          presence.last_seen_at > $2 - interval '2 minutes'
          and presence.last_seen_at <= $2
          and private.user_has_valid_role_scope(profile.user_id), false
        ), $2
      from public.profiles profile
      left join private.user_presence presence on presence.user_id = profile.user_id
      where profile.user_id = $1 or private.can_manage_user(profile.user_id)
    $query$ using v_actor, v_observed_at;
  else
    -- The compact contract already exposes all profiles to users.view. The
    -- contract check above verifies that exact policy, including its MFA gate.
    return query
    select profile.user_id, presence.last_seen_at,
      coalesce(
        presence.last_seen_at > v_observed_at - interval '2 minutes'
        and presence.last_seen_at <= v_observed_at
        and profile.is_active
        and exists (
          select 1 from public.user_roles user_role
          join public.roles role_entry on role_entry.key = user_role.role_key
          where user_role.user_id = profile.user_id
            and role_entry.key in (
              'master', 'admin', 'coordinator', 'manager_house', 'manager_imob',
              'broker_house', 'broker_imob'
            )
            and (role_entry.key = 'master' or role_entry.is_assignable)
        ), false
      ), v_observed_at
    from public.profiles profile
    left join private.user_presence presence on presence.user_id = profile.user_id;
  end if;
end;
$$;

alter function public.touch_user_presence() owner to postgres;
alter function public.get_user_presence() owner to postgres;
revoke all privileges on function public.touch_user_presence()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.get_user_presence()
  from public, anon, authenticated, service_role;
grant execute on function public.touch_user_presence() to authenticated;
grant execute on function public.get_user_presence() to authenticated;

comment on table private.user_presence is
  'One latest server-observed heartbeat per user; no presence history or client-provided metadata.';
comment on function public.touch_user_presence() is
  'Records only the authenticated eligible user under the deployed account contract, using server time and a twenty-second write interval.';
comment on function public.get_user_presence() is
  'Users viewers receive presence only for profiles visible through the verified deployed profile policy; online requires an eligible account and a heartbeat newer than two minutes.';

notify pgrst, 'reload schema';

commit;
