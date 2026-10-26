begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.meta_ads_canvas_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('macro', 'micro-sets', 'micro-ads')),
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and pg_column_size(state) <= 524288
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, scope)
);

comment on table public.meta_ads_canvas_profiles is
  'Private per-user Meta Ads canvas profiles. Browser storage is only a local cache.';

alter table public.meta_ads_canvas_profiles enable row level security;
alter table public.meta_ads_canvas_profiles force row level security;

create policy authenticated_session_mfa_gate on public.meta_ads_canvas_profiles
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));

create policy meta_ads_canvas_profiles_owner on public.meta_ads_canvas_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all privileges on table public.meta_ads_canvas_profiles
  from public, anon, authenticated, service_role;

create function public.get_meta_ads_canvas_profile(p_scope text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile jsonb;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  if not (select private.current_session_satisfies_mfa()) then
    raise exception 'unauthorized: current session required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if p_scope is null or p_scope not in ('macro', 'micro-sets', 'micro-ads') then
    raise exception 'invalid_argument: unknown canvas scope' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'scope', profile.scope,
    'state', profile.state,
    'revision', profile.revision,
    'updated_at', profile.updated_at
  ) into v_profile
  from public.meta_ads_canvas_profiles profile
  where profile.user_id = v_actor and profile.scope = p_scope;

  return v_profile;
end;
$$;

create function public.save_meta_ads_canvas_profile(p_scope text, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_saved public.meta_ads_canvas_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  if not (select private.current_session_satisfies_mfa()) then
    raise exception 'unauthorized: current session required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if p_scope is null or p_scope not in ('macro', 'micro-sets', 'micro-ads') then
    raise exception 'invalid_argument: unknown canvas scope' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
     or pg_column_size(p_state) > 524288 then
    raise exception 'invalid_argument: invalid canvas state' using errcode = '22023';
  end if;

  insert into public.meta_ads_canvas_profiles (user_id, scope, state)
  values (v_actor, p_scope, p_state)
  on conflict (user_id, scope) do update
    set state = excluded.state,
        revision = meta_ads_canvas_profiles.revision + 1,
        updated_at = clock_timestamp()
  returning * into v_saved;

  return jsonb_build_object(
    'scope', v_saved.scope,
    'state', v_saved.state,
    'revision', v_saved.revision,
    'updated_at', v_saved.updated_at
  );
end;
$$;

alter function public.get_meta_ads_canvas_profile(text) owner to postgres;
alter function public.save_meta_ads_canvas_profile(text, jsonb) owner to postgres;
revoke all privileges on function public.get_meta_ads_canvas_profile(text),
  public.save_meta_ads_canvas_profile(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.get_meta_ads_canvas_profile(text),
  public.save_meta_ads_canvas_profile(text, jsonb) to authenticated;

commit;
