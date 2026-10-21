begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.get_crm_forecast_brokers(
  p_segment text,
  p_manager_key text
)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_view_key text;
  v_payload jsonb;
  v_manager_index integer;
  v_brokers jsonb;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.management.forecast.view')
     or not exists (select 1 from public.app_pages where key = 'crm.management.forecast' and is_active) then
    raise exception 'forbidden: forecast page unavailable' using errcode = '42501';
  end if;
  if p_segment is null or p_segment not in ('house','imob')
    or p_manager_key is null
    or (p_segment = 'house' and p_manager_key not in ('amanda','cleber','messias','sidnei','stephanie'))
    or (p_segment = 'imob' and p_manager_key not in ('alvaro','fabricio','gustavo','jonathan','richard','thiago','thiago-tg')) then
    raise exception 'invalid_argument: invalid forecast selection' using errcode = '22023';
  end if;

  v_view_key := case p_segment
    when 'house' then 'without_canal_imob'
    else 'with_canal_imob'
  end;

  select analysis.payload into v_payload
  from public.crm_dashboard_analysis analysis
  join public.crm_dashboard_snapshots snapshot on snapshot.id = analysis.snapshot_id
  where analysis.view_key = v_view_key
  order by snapshot.generated_at desc, snapshot.id desc
  limit 1;

  if v_payload is null then
    return '[]'::jsonb;
  end if;

  select manager.ordinality::integer - 1 into v_manager_index
  from (
    select
      source.ordinality,
      translate(
        upper(source.name),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ) as normalized_name
    from jsonb_array_elements_text(v_payload#>'{dimensions,managers}')
      with ordinality source(name, ordinality)
  ) manager
  where case p_manager_key
    when 'amanda' then manager.normalized_name like '%AMANDA%'
    when 'cleber' then manager.normalized_name like '%CLEBER%'
    when 'messias' then manager.normalized_name like '%MESSIAS%'
    when 'sidnei' then manager.normalized_name like '%SIDNEI%'
    when 'stephanie' then manager.normalized_name like '%STEPHANI%'
    when 'alvaro' then manager.normalized_name like '%ALVARO%'
    when 'fabricio' then manager.normalized_name like '%FABRICIO%'
    when 'gustavo' then manager.normalized_name like '%GUSTAVO%'
    when 'jonathan' then manager.normalized_name like any (array['%JONATHAN%','%JHONNATA%'])
    when 'richard' then manager.normalized_name like '%RICHARD%'
    when 'thiago' then manager.normalized_name like '%THIAGO DE ARAUJO%'
    when 'thiago-tg' then manager.normalized_name like '%THIAGO FERNANDO%'
    else false
  end
  order by manager.ordinality
  limit 1;

  if v_manager_index is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(owner.name order by owner.name), '[]'::jsonb) into v_brokers
  from (
    select distinct v_payload#>>array['dimensions','owners',(fact.value->>3)::integer::text] as name
    from jsonb_array_elements(v_payload->'facts') fact(value)
    where (fact.value->>2)::integer = v_manager_index
      and (fact.value->>3)::integer >= 0
    order by name
    limit 200
  ) owner
  where nullif(btrim(owner.name), '') is not null;

  return v_brokers;
end;
$$;

alter function public.get_crm_forecast_brokers(text,text) owner to postgres;
revoke all privileges on function public.get_crm_forecast_brokers(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_crm_forecast_brokers(text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
