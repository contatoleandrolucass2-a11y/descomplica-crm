-- The independent Rotina access also gates direct RPC calls.
-- Existing authentication, MFA, account, revision and write-permission checks remain.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.get_crm_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_can_edit boolean;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view')
     or not exists (select 1 from public.app_pages where key='crm.management.routine' and is_active) then
    raise exception 'forbidden: routine page unavailable' using errcode = '42501';
  end if;
  v_can_edit := public._internal_has_permission(v_actor, 'crm.settings.manage');
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view') then
    raise exception 'forbidden: missing routine read permission' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'routines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_key', r.role_key, 'rows', r.rows,
        'revision', r.revision, 'updated_at', r.updated_at
      ) order by r.role_key)
      from public.crm_routines r
    ), '[]'::jsonb),
    'can_edit', v_can_edit
  );
end;
$$;

create or replace function public.save_crm_routine(
  p_role_key text,
  p_rows jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_days constant text[] := array[
    'Segunda-feira', U&'Ter\00E7a-feira', 'Quarta-feira', 'Quinta-feira',
    'Sexta-feira', U&'S\00E1bado', 'Domingo'
  ];
  v_row jsonb;
  v_saved public.crm_routines%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view')
     or not exists (select 1 from public.app_pages where key='crm.management.routine' and is_active) then
    raise exception 'forbidden: routine page unavailable' using errcode = '42501';
  end if;
  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage' using errcode = '42501';
  end if;

  if p_role_key is null or p_role_key not in (
    'regional-house', 'regional-imob', 'gerente-house',
    'coordenador-vendas', 'coordenador-parcerias', 'corretor'
  ) then
    raise exception 'invalid_argument: unknown routine role' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or p_expected_revision >= 9007199254740991 then
    raise exception 'invalid_argument: invalid expected revision' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_argument: rows must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 200 or octet_length(p_rows::text) > 1048576 then
    raise exception 'invalid_argument: routine payload limit exceeded' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'invalid_argument: row must be an object' using errcode = '22023';
    end if;
    if not (v_row ?& v_days) or (select count(*) from jsonb_object_keys(v_row)) <> 7 then
      raise exception 'invalid_argument: row must contain exactly seven weekdays' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_each(v_row) cell
      where jsonb_typeof(cell.value) <> 'string'
        -- Match JavaScript/textarea UTF-16 length, including supplementary characters.
        or char_length(cell.value #>> '{}')
          + char_length(regexp_replace(cell.value #>> '{}', U&'[^\+010000-\+10FFFF]', '', 'g')) > 4000
    ) then
      raise exception 'invalid_argument: weekday must be a string of at most 4000 characters'
        using errcode = '22023';
    end if;
  end loop;

  -- Unique-index arbitration handles concurrent creates; conditional UPDATE
  -- rechecks revision after waiting for a concurrent writer's row lock.
  if p_expected_revision = 0 then
    insert into public.crm_routines (role_key, rows, revision, updated_at, updated_by)
    values (p_role_key, p_rows, 1, clock_timestamp(), v_actor)
    on conflict (role_key) do nothing
    returning * into v_saved;
  else
    update public.crm_routines
    set rows = p_rows, revision = revision + 1,
        updated_at = clock_timestamp(), updated_by = v_actor
    where role_key = p_role_key and revision = p_expected_revision
    returning * into v_saved;
  end if;
  if not found then
    raise exception 'conflict: routine revision changed' using errcode = '40001';
  end if;

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor, 'crm.routine.saved',
    jsonb_build_object('role_key', p_role_key, 'revision', p_expected_revision),
    jsonb_build_object('role_key', p_role_key, 'revision', v_saved.revision,
      'row_count', jsonb_array_length(p_rows), 'updated_at', v_saved.updated_at)
  );

  return jsonb_build_object('role_key', v_saved.role_key, 'rows', v_saved.rows,
    'revision', v_saved.revision, 'updated_at', v_saved.updated_at);
end;
$$;

create or replace function public.get_crm_routine_completions()
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
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view')
     or not exists (select 1 from public.app_pages where key='crm.management.routine' and is_active) then
    raise exception 'forbidden: routine page unavailable' using errcode = '42501';
  end if;
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view') then
    raise exception 'forbidden: missing routine read permission' using errcode = '42501';
  end if;
  return private.crm_routine_completion_snapshot(v_actor, clock_timestamp());
end;
$$;

create or replace function public.set_crm_routine_completion(
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
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view')
     or not exists (select 1 from public.app_pages where key='crm.management.routine' and is_active) then
    raise exception 'forbidden: routine page unavailable' using errcode = '42501';
  end if;
  if not public._internal_has_permission(v_actor, 'crm.management.routine.view') then
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

notify pgrst, 'reload schema';
commit;
