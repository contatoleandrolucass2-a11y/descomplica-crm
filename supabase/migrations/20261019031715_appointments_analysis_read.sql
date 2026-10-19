-- Isolate appointment facts AND dictionaries before they cross the server boundary.
create function private.project_crm_appointments_analysis(p_payload jsonb, p_can_rank boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_payload jsonb := p_payload;
  v_facts jsonb;
  v_dictionary jsonb;
  v_mapping jsonb;
  v_key text;
  v_position int;
  v_v2 boolean := p_payload->'version' = '2'::jsonb;
begin
  select coalesce(jsonb_agg(f order by f), '[]'::jsonb) into v_facts
  from jsonb_array_elements(p_payload->'facts') f where f->0 = '1'::jsonb;

  for v_key, v_position in select * from (values
    ('managers',2),('owners',3),('companies',4),('developments',6),('stores',10)
  ) d(key,position) loop
    if v_key = 'stores' and not v_v2 then continue; end if;
    select coalesce(jsonb_agg(label order by original), '[]'::jsonb),
      coalesce(jsonb_object_agg(original::text, new_index), '{}'::jsonb)
    into v_dictionary, v_mapping
    from (
      select labels.label, labels.ordinality - 1 as original,
        row_number() over (order by labels.ordinality) - 1 as new_index
      from jsonb_array_elements(p_payload#>array['dimensions',v_key])
        with ordinality labels(label,ordinality)
      where (p_can_rank or v_key not in ('developments','stores'))
        and exists (select 1 from jsonb_array_elements(v_facts) f
          where (f->>v_position)::int = labels.ordinality - 1)
    ) relevant;
    v_payload := jsonb_set(v_payload, array['dimensions',v_key], v_dictionary);
    select coalesce(jsonb_agg(jsonb_set(f, array[v_position::text],
      coalesce(v_mapping->(f->>v_position), '-1'::jsonb)) order by f), '[]'::jsonb)
      into v_facts from jsonb_array_elements(v_facts) f;
  end loop;

  -- Redaction can merge rows that differed only by a protected label.
  select coalesce(jsonb_agg(g.key || jsonb_build_array(g.count,g.amount,g.approved)
    || case when v_v2 then jsonb_build_array(g.store) else '[]'::jsonb end order by g.key,g.store), '[]'::jsonb)
  into v_facts
  from (
    select jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6) as key,
      f->10 as store, sum((f->>7)::numeric) as count,
      sum((f->>8)::numeric) as amount, sum((f->>9)::numeric) as approved
    from jsonb_array_elements(v_facts) f
    group by jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6),f->10
  ) g;
  if exists (select 1 from jsonb_array_elements(v_facts) f
    where (f->>7)::numeric > 1000000000 or (f->>8)::numeric > 1000000000000000) then
    raise exception 'dashboard analysis aggregate exceeds contract bounds' using errcode = '22023';
  end if;
  return jsonb_set(v_payload, '{facts}', v_facts);
end;
$$;
alter function private.project_crm_appointments_analysis(jsonb,boolean) owner to postgres;
revoke all on function private.project_crm_appointments_analysis(jsonb,boolean)
  from public, anon, authenticated, service_role;

create function public.read_crm_appointments_analysis(p_snapshot_id bigint, p_view_keys text[])
returns table(view_key text, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not coalesce(
    public.has_permission(v_user_id, 'crm.stage.appointments.view'), false) then
    return;
  end if;
  return query
    select a.view_key, private.project_crm_appointments_analysis(a.payload,
      coalesce(public.has_permission(v_user_id, 'crm.ranking.view'), false))
    from public.crm_dashboard_analysis a
    where a.snapshot_id = p_snapshot_id and a.view_key = any(p_view_keys)
      and case a.view_key
        when 'all' then public.has_permission(v_user_id, 'crm.dashboard.all.view')
        when 'with_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.with_canal_imob.view')
        when 'without_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.without_canal_imob.view')
        else false end
    order by a.view_key;
end;
$$;
alter function public.read_crm_appointments_analysis(bigint,text[]) owner to postgres;
revoke all on function public.read_crm_appointments_analysis(bigint,text[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_appointments_analysis(bigint,text[]) to authenticated;
