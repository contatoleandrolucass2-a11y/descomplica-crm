begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Expand only: the legacy singleton remains unchanged and available for rollback.
create table public.crm_forecast_periods (
  weekend_start date not null check (extract(isodow from weekend_start) = 5),
  segment text not null check (segment in ('house', 'imob')),
  manager_key text not null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (weekend_start, segment, manager_key),
  check (
    (segment = 'house' and manager_key in ('amanda','cleber','messias','sidnei','stephanie'))
    or
    (segment = 'imob' and manager_key in ('alvaro','fabricio','gustavo','jonathan','richard','thiago','thiago-tg'))
  )
);
alter table public.crm_forecast_periods enable row level security;
alter table public.crm_forecast_periods force row level security;
revoke all privileges on table public.crm_forecast_periods from public, anon, authenticated, service_role;

create function private._internal_validate_crm_forecast_document(p_document jsonb)
returns void language plpgsql immutable security invoker
set search_path = ''
as $$
declare
  v_column jsonb;
  v_row jsonb;
  v_pair jsonb;
  v_ids text[] := array[]::text[];
  v_row_ids text[] := array[]::text[];
  v_index integer;
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or not (p_document ?& array['title','columns','rows'])
    or (select count(*) from jsonb_object_keys(p_document)) <> 3
    or jsonb_typeof(p_document->'title') <> 'string'
    or jsonb_typeof(p_document->'columns') <> 'array'
    or jsonb_typeof(p_document->'rows') <> 'array'
    or char_length(p_document->>'title') + char_length(regexp_replace(p_document->>'title', U&'[^\+010000-\+10FFFF]', '', 'g')) > 120
    or octet_length(p_document::text) > 2000000 then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  if jsonb_array_length(p_document->'columns') not between 4 and 30
    or jsonb_array_length(p_document->'columns') % 2 <> 0
    or jsonb_array_length(p_document->'rows') > 200 then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  for v_column in select value from jsonb_array_elements(p_document->'columns') loop
    if jsonb_typeof(v_column) <> 'object'
      or not (v_column ?& array['id','label'])
      or (select count(*) from jsonb_object_keys(v_column)) <> 2
      or jsonb_typeof(v_column->'id') <> 'string'
      or jsonb_typeof(v_column->'label') <> 'string'
      or (v_column->>'id') !~ '^[A-Za-z0-9_-]{1,64}$'
      or (v_column->>'id') = any(v_ids)
      or (v_column->>'id') in ('__proto__','prototype','constructor')
      or btrim(v_column->>'label', v_whitespace) = ''
      or char_length(v_column->>'label') + char_length(regexp_replace(v_column->>'label', U&'[^\+010000-\+10FFFF]', '', 'g')) > 120 then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_column->>'id');
  end loop;
  if v_ids[1] <> 'broker' or v_ids[cardinality(v_ids)] <> 'action_plan'
    or p_document#>>'{columns,0,label}' is null
    or p_document#>>array['columns',(cardinality(v_ids)-1)::text,'label'] <> 'Plano de ação' then
    raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
  end if;
  for v_index in 1..(cardinality(v_ids) - 2) by 2 loop
    v_column := p_document->'columns'->v_index;
    v_pair := p_document->'columns'->(v_index + 1);
    if (v_column->>'id') !~ '^f_[A-Za-z0-9_-]{1,62}$'
      or (v_pair->>'id') <> 'a_' || substring(v_column->>'id' from 3)
      or btrim(v_column->>'label', v_whitespace) <> btrim(v_pair->>'label', v_whitespace) then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from jsonb_array_elements(p_document->'rows') loop
    if jsonb_typeof(v_row) <> 'object'
      or not (v_row ?& array['id','cells'])
      or (select count(*) from jsonb_object_keys(v_row)) <> 2
      or jsonb_typeof(v_row->'id') <> 'string'
      or jsonb_typeof(v_row->'cells') <> 'object'
      or (v_row->>'id') !~ '^[A-Za-z0-9_-]{1,64}$'
      or (v_row->>'id') = any(v_row_ids)
      or (v_row->>'id') in ('__proto__','prototype','constructor')
      or not ((v_row->'cells') ?& v_ids)
      or (select count(*) from jsonb_object_keys(v_row->'cells')) <> cardinality(v_ids)
      or exists (select 1 from jsonb_each(v_row->'cells') cell
        where jsonb_typeof(cell.value) <> 'string'
          or char_length(cell.value #>> '{}')
            + char_length(regexp_replace(cell.value #>> '{}', U&'[^\+010000-\+10FFFF]', '', 'g')) > 4000)
      or exists (select 1 from jsonb_each_text(v_row->'cells') cell
        where cell.key not in ('broker','action_plan') and cell.value <> ''
          and cell.value !~ '^[0-9]{1,9}([.,][0-9]{0,2})?$') then
      raise exception 'invalid_argument: invalid forecast' using errcode = '22023';
    end if;
    v_row_ids := array_append(v_row_ids, v_row->>'id');
  end loop;
end;
$$;

create function public.get_crm_forecast_period(
  p_weekend_start date,
  p_segment text,
  p_manager_key text default null
)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_forecasts jsonb;
  v_template jsonb;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.forecast.view')
     or not exists (select 1 from public.app_pages where key = 'crm.management.forecast' and is_active) then
    raise exception 'forbidden: forecast page unavailable' using errcode = '42501';
  end if;
  if p_weekend_start is null or extract(isodow from p_weekend_start) <> 5
    or p_segment is null or p_segment not in ('general','house','imob')
    or (p_segment = 'general' and p_manager_key is not null)
    or (p_segment = 'house' and (p_manager_key is null or p_manager_key not in ('amanda','cleber','messias','sidnei','stephanie')))
    or (p_segment = 'imob' and (p_manager_key is null or p_manager_key not in ('alvaro','fabricio','gustavo','jonathan','richard','thiago','thiago-tg'))) then
    raise exception 'invalid_argument: invalid forecast selection' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'segment', f.segment,
    'manager', f.manager_key,
    'forecast', f.document || jsonb_build_object('revision', f.revision, 'updated_at', f.updated_at)
  ) order by
    case f.segment when 'house' then 0 else 1 end,
    case f.manager_key
      when 'amanda' then 1 when 'alvaro' then 1
      when 'cleber' then 2 when 'fabricio' then 2
      when 'messias' then 3 when 'gustavo' then 3
      when 'sidnei' then 4 when 'jonathan' then 4
      when 'stephanie' then 5 when 'richard' then 5
      when 'thiago' then 6 when 'thiago-tg' then 7
    end
  ), '[]'::jsonb)
  into v_forecasts
  from public.crm_forecast_periods f
  where f.weekend_start = p_weekend_start
    and (p_segment = 'general' or (f.segment = p_segment and f.manager_key = p_manager_key));

  select candidate.document into v_template
  from (
    select f.document, f.updated_at from public.crm_forecast_periods f
    union all
    select legacy.document, legacy.updated_at from public.crm_forecasts legacy where legacy.singleton
  ) candidate
  order by candidate.updated_at desc
  limit 1;

  return jsonb_build_object(
    'forecasts', v_forecasts,
    'template', v_template,
    'can_edit', p_segment <> 'general' and public._internal_has_permission(v_actor, 'crm.settings.manage')
  );
end;
$$;

create function public.save_crm_forecast_period(
  p_weekend_start date,
  p_segment text,
  p_manager_key text,
  p_document jsonb,
  p_expected_revision bigint
)
returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout = '10s' set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_saved public.crm_forecast_periods%rowtype;
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
  if p_weekend_start is null or extract(isodow from p_weekend_start) <> 5
    or p_segment is null or p_segment not in ('house','imob')
    or p_manager_key is null
    or (p_segment = 'house' and p_manager_key not in ('amanda','cleber','messias','sidnei','stephanie'))
    or (p_segment = 'imob' and p_manager_key not in ('alvaro','fabricio','gustavo','jonathan','richard','thiago','thiago-tg')) then
    raise exception 'invalid_argument: invalid forecast selection' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991 then
    raise exception 'invalid_argument: invalid expected revision' using errcode = '22023';
  end if;
  perform private._internal_validate_crm_forecast_document(p_document);

  if p_expected_revision = 0 then
    insert into public.crm_forecast_periods
      (weekend_start, segment, manager_key, document, revision, updated_at, updated_by)
    values (p_weekend_start, p_segment, p_manager_key, p_document, 1, clock_timestamp(), v_actor)
    on conflict (weekend_start, segment, manager_key) do nothing returning * into v_saved;
  else
    update public.crm_forecast_periods set
      document = p_document,
      revision = revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_actor
    where weekend_start = p_weekend_start and segment = p_segment
      and manager_key = p_manager_key and revision = p_expected_revision
    returning * into v_saved;
  end if;
  if not found then
    raise exception 'conflict: forecast revision changed' using errcode = '40001';
  end if;
  insert into public.audit_logs (actor_id, action, before, after)
  values (v_actor, 'crm.forecast.period.saved',
    jsonb_build_object('weekend_start', p_weekend_start, 'segment', p_segment,
      'manager', p_manager_key, 'revision', p_expected_revision),
    jsonb_build_object('weekend_start', p_weekend_start, 'segment', p_segment,
      'manager', p_manager_key, 'revision', v_saved.revision,
      'row_count', jsonb_array_length(p_document->'rows'),
      'column_count', jsonb_array_length(p_document->'columns'),
      'updated_at', v_saved.updated_at));
  return v_saved.document || jsonb_build_object('revision', v_saved.revision, 'updated_at', v_saved.updated_at);
end;
$$;

alter function private._internal_validate_crm_forecast_document(jsonb) owner to postgres;
alter function public.get_crm_forecast_period(date,text,text) owner to postgres;
alter function public.save_crm_forecast_period(date,text,text,jsonb,bigint) owner to postgres;
revoke all privileges on function private._internal_validate_crm_forecast_document(jsonb) from public, anon, authenticated, service_role;
revoke all privileges on function public.get_crm_forecast_period(date,text,text) from public, anon, authenticated, service_role;
revoke all privileges on function public.save_crm_forecast_period(date,text,text,jsonb,bigint) from public, anon, authenticated, service_role;
grant execute on function public.get_crm_forecast_period(date,text,text) to authenticated;
grant execute on function public.save_crm_forecast_period(date,text,text,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
