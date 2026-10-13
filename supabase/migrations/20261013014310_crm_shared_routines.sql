begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Missing catalog entries remain owned by the application's navigation fallback.
update public.app_pages
set permission_key = 'crm.dashboard.view'
where key in ('crm.management', 'crm.management.routine')
  and permission_key is distinct from 'crm.dashboard.view';

create table public.crm_routines (
  role_key text primary key check (role_key in (
    'regional-house', 'regional-imob', 'gerente-house',
    'coordenador-vendas', 'coordenador-parcerias', 'corretor'
  )),
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.crm_routines enable row level security;
alter table public.crm_routines force row level security;
create policy authenticated_session_mfa_gate on public.crm_routines
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));
revoke all privileges on table public.crm_routines
  from public, anon, authenticated, service_role;

create function public.get_crm_routines()
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
  v_can_edit := public._internal_has_permission(v_actor, 'crm.settings.manage');
  if not public._internal_has_permission(v_actor, 'crm.dashboard.view') then
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

create function public.save_crm_routine(
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

alter function public.get_crm_routines() owner to postgres;
alter function public.save_crm_routine(text, jsonb, bigint) owner to postgres;
revoke all privileges on function public.get_crm_routines()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.save_crm_routine(text, jsonb, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.get_crm_routines() to authenticated;
grant execute on function public.save_crm_routine(text, jsonb, bigint) to authenticated;

commit;
