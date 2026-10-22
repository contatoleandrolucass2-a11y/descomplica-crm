begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values (
  'crm.management.forecast.values.edit',
  'Altera valores das células da previsão sem modificar linhas, colunas ou identificações.',
  10
)
on conflict (key) do update set
  description = excluded.description,
  min_level = excluded.min_level;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from (
  values
    ('master'),
    ('admin'),
    ('coordinator'),
    ('manager_house'),
    ('manager_imob'),
    ('broker_house'),
    ('broker_imob')
) roles(role_key)
cross join (
  values
    ('crm.management.forecast.view'),
    ('crm.management.forecast.values.edit')
) permissions(permission_key)
on conflict (role_key, permission_key) do nothing;

create or replace function private._internal_crm_forecast_same_structure(
  p_candidate jsonb,
  p_reference jsonb
)
returns boolean language sql immutable security invoker
set search_path = ''
as $$
  select
    p_candidate->'title' = p_reference->'title'
    and p_candidate->'columns' = p_reference->'columns'
    and jsonb_array_length(p_candidate->'rows') = jsonb_array_length(p_reference->'rows')
    and not exists (
      select 1
      from jsonb_array_elements(p_candidate->'rows') with ordinality candidate(row, position)
      join jsonb_array_elements(p_reference->'rows') with ordinality reference(row, position)
        using (position)
      where candidate.row->'id' <> reference.row->'id'
         or candidate.row#>>'{cells,broker}' is distinct from reference.row#>>'{cells,broker}'
    );
$$;

create or replace function public.get_crm_forecast_period(
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
  v_can_manage_structure boolean;
  v_can_edit boolean;
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

  v_can_manage_structure := public._internal_has_permission(v_actor, 'crm.settings.manage');
  v_can_edit := v_can_manage_structure
    or public._internal_has_permission(v_actor, 'crm.management.forecast.values.edit');

  return jsonb_build_object(
    'forecasts', v_forecasts,
    'template', v_template,
    'can_edit', p_segment <> 'general' and v_can_edit,
    'can_manage_structure', p_segment <> 'general' and v_can_manage_structure
  );
end;
$$;

create or replace function public.save_crm_forecast_period(
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
  v_reference jsonb;
  v_template jsonb;
  v_brokers jsonb;
  v_reference_rows jsonb;
  v_default_columns jsonb;
  v_using_default boolean := false;
  v_using_roster boolean := false;
  v_can_manage_structure boolean;
  v_can_edit_values boolean;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.forecast.view')
     or not exists (select 1 from public.app_pages where key = 'crm.management.forecast' and is_active) then
    raise exception 'forbidden: forecast page unavailable' using errcode = '42501';
  end if;
  v_can_manage_structure := public._internal_has_permission(v_actor, 'crm.settings.manage');
  v_can_edit_values := public._internal_has_permission(
    v_actor,
    'crm.management.forecast.values.edit'
  );
  if not v_can_manage_structure and not v_can_edit_values then
    raise exception 'forbidden: missing forecast edit permission' using errcode = '42501';
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

  select period.document into v_reference
  from public.crm_forecast_periods period
  where period.weekend_start = p_weekend_start
    and period.segment = p_segment
    and period.manager_key = p_manager_key
  for update;

  if not v_can_manage_structure and v_reference is null then
    select candidate.document into v_template
    from (
      select period.document, period.updated_at from public.crm_forecast_periods period
      union all
      select legacy.document, legacy.updated_at
      from public.crm_forecasts legacy
      where legacy.singleton
    ) candidate
    order by candidate.updated_at desc
    limit 1;

    v_brokers := public.get_crm_forecast_brokers(p_segment, p_manager_key);
    v_using_roster := jsonb_array_length(v_brokers) > 0;

    if v_template is null then
      v_using_default := true;
      select jsonb_agg(entry.column_value order by entry.position)
      into v_default_columns
      from (
        select 0 as position, jsonb_build_object('id','broker','label','Nome do corretor') as column_value
        union all
        select group_number * 2 - 1,
          jsonb_build_object('id','f_group_' || group_number,'label','Empreendimento ' || group_number)
        from generate_series(1, 7) group_number
        union all
        select group_number * 2,
          jsonb_build_object('id','a_group_' || group_number,'label','Empreendimento ' || group_number)
        from generate_series(1, 7) group_number
        union all
        select 15, jsonb_build_object('id','action_plan','label','Plano de ação')
      ) entry;
      v_template := jsonb_build_object(
        'title', 'Equipe',
        'columns', v_default_columns,
        'rows', '[]'::jsonb
      );
    end if;

    if jsonb_array_length(v_brokers) = 0 and v_using_default then
      select jsonb_agg(to_jsonb('Corretor ' || broker_number) order by broker_number)
      into v_brokers
      from generate_series(1, 10) broker_number;
    elsif jsonb_array_length(v_brokers) = 0 then
      v_brokers := case
        when jsonb_array_length(v_template->'rows') > 0
          then jsonb_build_array(v_template#>>'{rows,0,cells,broker}')
        else jsonb_build_array('Corretor 1')
      end;
    end if;

    select jsonb_agg(
      jsonb_build_object(
        'id', case
          when v_using_roster or v_using_default then 'broker_' || broker.position
          when jsonb_array_length(v_template->'rows') > 0
            then v_template#>>'{rows,0,id}'
          else 'broker_1'
        end,
        'cells', (
          select jsonb_object_agg(
            column_entry.value->>'id',
            case when column_entry.value->>'id' = 'broker' then broker.name else '' end
          )
          from jsonb_array_elements(v_template->'columns') column_entry(value)
        )
      )
      order by broker.position
    )
    into v_reference_rows
    from jsonb_array_elements_text(v_brokers) with ordinality broker(name, position);

    v_reference := jsonb_build_object(
      'title', v_template->'title',
      'columns', v_template->'columns',
      'rows', coalesce(v_reference_rows, '[]'::jsonb)
    );
  end if;

  if not v_can_manage_structure
     and not private._internal_crm_forecast_same_structure(p_document, v_reference) then
    raise exception 'forbidden: forecast structure is read only' using errcode = '42501';
  end if;

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

alter function private._internal_crm_forecast_same_structure(jsonb,jsonb) owner to postgres;
alter function public.get_crm_forecast_period(date,text,text) owner to postgres;
alter function public.save_crm_forecast_period(date,text,text,jsonb,bigint) owner to postgres;
revoke all privileges on function private._internal_crm_forecast_same_structure(jsonb,jsonb)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.get_crm_forecast_period(date,text,text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.save_crm_forecast_period(date,text,text,jsonb,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.get_crm_forecast_period(date,text,text) to authenticated;
grant execute on function public.save_crm_forecast_period(date,text,text,jsonb,bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
