begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- One deliberately global manual grid. No commercial integration owns these cells.
create table public.crm_forecasts (
  singleton boolean primary key default true check (singleton),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.crm_forecasts enable row level security;
alter table public.crm_forecasts force row level security;
create policy authenticated_session_mfa_gate on public.crm_forecasts
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));
revoke all privileges on table public.crm_forecasts from public, anon, authenticated, service_role;

create function public.get_crm_forecast()
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.forecast.view')
     or not exists (select 1 from public.app_pages where key = 'crm.management.forecast' and is_active) then
    raise exception 'forbidden: forecast page unavailable' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'forecast', (select f.document || jsonb_build_object('revision', f.revision, 'updated_at', f.updated_at)
      from public.crm_forecasts f where singleton),
    'can_edit', public._internal_has_permission(v_actor, 'crm.settings.manage')
  );
end;
$$;

create function public.save_crm_forecast(p_document jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout = '10s' set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_column jsonb;
  v_row jsonb;
  v_ids text[] := array[]::text[];
  v_row_ids text[] := array[]::text[];
  v_saved public.crm_forecasts%rowtype;
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.forecast.view')
     or not exists (select 1 from public.app_pages where key = 'crm.management.forecast' and is_active) then
    raise exception 'forbidden: forecast page unavailable' using errcode = '42501';
  end if;
  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991 then
    raise exception 'invalid_argument: invalid expected revision' using errcode = '22023';
  end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  if not (p_document ?& array['title','columns','rows'])
    or (select count(*) from jsonb_object_keys(p_document)) <> 3
    or jsonb_typeof(p_document->'title') <> 'string'
    or jsonb_typeof(p_document->'columns') <> 'array'
    or jsonb_typeof(p_document->'rows') <> 'array'
    or char_length(p_document->>'title') + char_length(regexp_replace(p_document->>'title', U&'[^\+010000-\+10FFFF]', '', 'g')) > 120
    or octet_length(p_document::text) > 2000000 then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  if jsonb_array_length(p_document->'columns') not between 1 and 30
    or jsonb_array_length(p_document->'rows') > 200 then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  for v_column in select value from jsonb_array_elements(p_document->'columns') loop
    if jsonb_typeof(v_column) <> 'object' then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    if not (v_column ?& array['id','label']) or (select count(*) from jsonb_object_keys(v_column)) <> 2
      or jsonb_typeof(v_column->'id') <> 'string' or jsonb_typeof(v_column->'label') <> 'string'
      or (v_column->>'id') !~ '^[A-Za-z0-9_-]{1,64}$' or (v_column->>'id') = any(v_ids)
      or (v_column->>'id') in ('__proto__','prototype','constructor')
      or btrim(v_column->>'label', v_whitespace) = ''
      or char_length(v_column->>'label') + char_length(regexp_replace(v_column->>'label', U&'[^\+010000-\+10FFFF]', '', 'g')) > 120 then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_column->>'id');
  end loop;
  for v_row in select value from jsonb_array_elements(p_document->'rows') loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    if not (v_row ?& array['id','cells']) or (select count(*) from jsonb_object_keys(v_row)) <> 2
      or jsonb_typeof(v_row->'id') <> 'string' or jsonb_typeof(v_row->'cells') <> 'object'
      or (v_row->>'id') !~ '^[A-Za-z0-9_-]{1,64}$' or (v_row->>'id') = any(v_row_ids)
      or (v_row->>'id') in ('__proto__','prototype','constructor') then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    if not ((v_row->'cells') ?& v_ids)
      or (select count(*) from jsonb_object_keys(v_row->'cells')) <> cardinality(v_ids)
      or exists (select 1 from jsonb_each(v_row->'cells') cell
        where jsonb_typeof(cell.value) <> 'string'
          or char_length(cell.value #>> '{}')
            + char_length(regexp_replace(cell.value #>> '{}', U&'[^\+010000-\+10FFFF]', '', 'g')) > 4000) then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    v_row_ids := array_append(v_row_ids, v_row->>'id');
  end loop;

  if p_expected_revision = 0 then
    insert into public.crm_forecasts (singleton, document, revision, updated_at, updated_by)
    values (true, p_document, 1, clock_timestamp(), v_actor)
    on conflict (singleton) do nothing returning * into v_saved;
  else
    update public.crm_forecasts set document = p_document, revision = revision + 1,
      updated_at = clock_timestamp(), updated_by = v_actor
    where singleton and revision = p_expected_revision returning * into v_saved;
  end if;
  if not found then
    raise exception 'conflict: forecast revision changed' using errcode = '40001';
  end if;
  insert into public.audit_logs (actor_id, action, before, after)
  values (v_actor, 'crm.forecast.saved', jsonb_build_object('revision', p_expected_revision),
    jsonb_build_object('revision', v_saved.revision, 'row_count', cardinality(v_row_ids),
      'column_count', cardinality(v_ids), 'updated_at', v_saved.updated_at));
  return v_saved.document || jsonb_build_object('revision', v_saved.revision, 'updated_at', v_saved.updated_at);
end;
$$;

alter function public.get_crm_forecast() owner to postgres;
alter function public.save_crm_forecast(jsonb,bigint) owner to postgres;
revoke all privileges on function public.get_crm_forecast() from public, anon, authenticated, service_role;
revoke all privileges on function public.save_crm_forecast(jsonb,bigint) from public, anon, authenticated, service_role;
grant execute on function public.get_crm_forecast() to authenticated;
grant execute on function public.save_crm_forecast(jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
