-- Presence stores one server-observed heartbeat per user, without activity
-- history, client timestamps, routes, addresses, or other session metadata.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  -- This existing guard locks the account and enforces active/approved status,
  -- a valid role and reporting scope, and the current session MFA requirement.
  perform private.lock_and_assert_actor(v_actor);
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

  -- The table is private and has no direct grants. As a SECURITY DEFINER read,
  -- this query explicitly repeats the current profiles SELECT policy. Keeping
  -- the same can_manage_user helper preserves its live scope and account checks.
  return query
  select
    profile.user_id,
    presence.last_seen_at,
    coalesce(
      presence.last_seen_at > v_observed_at - interval '2 minutes'
      and presence.last_seen_at <= v_observed_at
      and private.user_has_valid_role_scope(profile.user_id),
      false
    ),
    v_observed_at
  from public.profiles profile
  left join private.user_presence presence on presence.user_id = profile.user_id
  where profile.user_id = v_actor
    or private.can_manage_user(profile.user_id);
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
  'Records the authenticated approved user only, using server time and a twenty-second write interval.';
comment on function public.get_user_presence() is
  'Users viewers receive presence only for profiles visible through the existing self-or-scoped-manager policy; online requires an eligible account and a heartbeat newer than two minutes.';

notify pgrst, 'reload schema';

commit;
