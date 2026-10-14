begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.crm_routine_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  role_key text not null check (role_key in (
    'regional-house', 'regional-imob', 'gerente-house',
    'coordenador-vendas', 'coordenador-parcerias', 'corretor'
  )),
  row_index integer not null check (row_index between 0 and 199),
  day text not null check (day in (
    'Segunda-feira', U&'Ter\00E7a-feira', 'Quarta-feira', 'Quinta-feira',
    'Sexta-feira', U&'S\00E1bado', 'Domingo'
  )),
  activity_text text not null check (
    btrim(activity_text, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''
    and char_length(activity_text) <= 4000
  ),
  completed_at timestamptz not null,
  primary key (user_id, week_start, role_key, row_index, day)
);

alter table public.crm_routine_completions enable row level security;
alter table public.crm_routine_completions force row level security;
create policy authenticated_session_mfa_gate on public.crm_routine_completions
  as restrictive for all to authenticated
  using (user_id = (select auth.uid()) and (select private.current_session_satisfies_mfa()))
  with check (user_id = (select auth.uid()) and (select private.current_session_satisfies_mfa()));
revoke all privileges on table public.crm_routine_completions
  from public, anon, authenticated, service_role;

create function private.crm_routine_week_start(p_now timestamptz)
returns date
language sql immutable strict
set search_path = ''
as $$
  select date_trunc('week', p_now at time zone 'America/Sao_Paulo')::date;
$$;

-- Only guarded RPCs may supply the actor and observation time to this helper.
create function private.crm_routine_completion_snapshot(p_actor uuid, p_now timestamptz)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'week_start', to_char(private.crm_routine_week_start(p_now), 'YYYY-MM-DD'),
    'resets_at', (private.crm_routine_week_start(p_now) + 7)::timestamp
      at time zone 'America/Sao_Paulo',
    'server_now', p_now,
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_key', c.role_key, 'row_index', c.row_index,
        'day', c.day, 'activity_text', c.activity_text
      ) order by c.role_key, c.row_index, c.day)
      from public.crm_routine_completions c
      join public.crm_routines r on r.role_key = c.role_key
      where c.user_id = p_actor
        and c.week_start = private.crm_routine_week_start(p_now)
        and c.activity_text = r.rows #>> array[c.row_index::text, c.day]
    ), '[]'::jsonb)
  );
$$;

create function public.get_crm_routine_completions()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.dashboard.view') then
    raise exception 'forbidden: missing routine read permission' using errcode = '42501';
  end if;
  return private.crm_routine_completion_snapshot(v_actor, clock_timestamp());
end;
$$;

create function public.set_crm_routine_completion(
  p_role_key text,
  p_row_index integer,
  p_day text,
  p_activity_text text,
  p_expected_week_start date,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_rows jsonb;
  v_now timestamptz;
  v_week date;
  v_activity text;
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.dashboard.view') then
    raise exception 'forbidden: missing routine read permission' using errcode = '42501';
  end if;
  if p_role_key is null or p_role_key not in (
    'regional-house', 'regional-imob', 'gerente-house',
    'coordenador-vendas', 'coordenador-parcerias', 'corretor'
  ) or p_row_index is null or p_row_index not between 0 and 199
    or p_day is null or p_day not in (
      'Segunda-feira', U&'Ter\00E7a-feira', 'Quarta-feira', 'Quinta-feira',
      'Sexta-feira', U&'S\00E1bado', 'Domingo'
    ) or p_activity_text is null or btrim(p_activity_text, v_whitespace) = ''
    or char_length(p_activity_text)
      + char_length(regexp_replace(p_activity_text, U&'[^\+010000-\+10FFFF]', '', 'g')) > 4000
    or p_expected_week_start is null or not isfinite(p_expected_week_start)
    or p_completed is null then
    raise exception 'invalid_argument: invalid completion' using errcode = '22023';
  end if;

  -- Shares the row lock used by save_crm_routine's UPDATE. Read the clock only
  -- after waiting: a request queued on Sunday must not write the expired week.
  select r.rows into v_rows from public.crm_routines r
  where r.role_key = p_role_key for update;
  if not found then
    raise exception 'conflict: routine must be saved before completion' using errcode = 'RC003';
  end if;
  v_now := clock_timestamp();
  v_week := private.crm_routine_week_start(v_now);
  if p_expected_week_start <> v_week then
    raise exception 'conflict: routine completion week changed' using errcode = 'RC001';
  end if;
  v_activity := v_rows #>> array[p_row_index::text, p_day];
  if v_activity is null or v_activity <> p_activity_text then
    raise exception 'conflict: routine activity changed' using errcode = 'RC002';
  end if;

  if p_completed then
    insert into public.crm_routine_completions
      (user_id, week_start, role_key, row_index, day, activity_text, completed_at)
    values (v_actor, v_week, p_role_key, p_row_index, p_day, v_activity, v_now)
    on conflict (user_id, week_start, role_key, row_index, day)
    do update set activity_text = excluded.activity_text, completed_at = excluded.completed_at
    where crm_routine_completions.activity_text is distinct from excluded.activity_text;
  else
    delete from public.crm_routine_completions
    where user_id = v_actor and week_start = v_week and role_key = p_role_key
      and row_index = p_row_index and day = p_day;
  end if;

  -- A rollover during the write also aborts the mutation. The returned clock
  -- and week describe the same final database observation, including lock waits.
  v_now := clock_timestamp();
  if private.crm_routine_week_start(v_now) <> v_week then
    raise exception 'conflict: routine completion week changed' using errcode = 'RC001';
  end if;
  return private.crm_routine_completion_snapshot(v_actor, v_now);
end;
$$;

alter function private.crm_routine_week_start(timestamptz) owner to postgres;
alter function private.crm_routine_completion_snapshot(uuid, timestamptz) owner to postgres;
alter function public.get_crm_routine_completions() owner to postgres;
alter function public.set_crm_routine_completion(text, integer, text, text, date, boolean) owner to postgres;
revoke all privileges on function private.crm_routine_week_start(timestamptz),
  private.crm_routine_completion_snapshot(uuid, timestamptz),
  public.get_crm_routine_completions(),
  public.set_crm_routine_completion(text, integer, text, text, date, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.get_crm_routine_completions(),
  public.set_crm_routine_completion(text, integer, text, text, date, boolean) to authenticated;

commit;
