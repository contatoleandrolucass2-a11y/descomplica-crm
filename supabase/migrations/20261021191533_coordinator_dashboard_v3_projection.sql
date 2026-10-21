-- Keep the dashboard projection compatible with v3/v4 snapshots when ranking is
-- not authorized. The protected dimensions are collapsed before the payload
-- crosses the security-definer boundary, including operational account fields.
create or replace function public.read_crm_dashboard_analysis(
  p_snapshot_id bigint,
  p_view_keys text[]
)
returns table(view_key text, payload jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_can_rank boolean;
  v_row record;
  v_facts jsonb;
  v_has_store boolean;
begin
  if v_user_id is null
     or not coalesce(public.has_permission(v_user_id, 'crm.dashboard.view'), false) then
    return;
  end if;
  v_can_rank := coalesce(public.has_permission(v_user_id, 'crm.ranking.view'), false);

  for v_row in
    select a.view_key, a.payload
    from public.crm_dashboard_analysis a
    where a.snapshot_id = p_snapshot_id
      and a.view_key = any(p_view_keys)
      and case a.view_key
        when 'all' then public.has_permission(v_user_id, 'crm.dashboard.all.view')
        when 'with_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.with_canal_imob.view')
        when 'without_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.without_canal_imob.view')
        else false
      end
    order by a.view_key
  loop
    view_key := v_row.view_key;
    payload := v_row.payload;
    if not v_can_rank then
      v_has_store := v_row.payload->'version' in ('2'::jsonb, '3'::jsonb, '4'::jsonb);

      -- Removing labels alone would leave reconstructable protected series.
      -- Reaggregate every row after replacing development and store with -1.
      select coalesce(jsonb_agg(
        aggregate.fact_key
          || jsonb_build_array(aggregate.fact_count, aggregate.amount, aggregate.approved_count)
          || case when v_has_store then '[-1]'::jsonb else '[]'::jsonb end
        order by aggregate.fact_key
      ), '[]'::jsonb)
      into v_facts
      from (
        select jsonb_build_array(fact->0, fact->1, fact->2, fact->3, fact->4, fact->5, -1)
            as fact_key,
          sum((fact->>7)::numeric) as fact_count,
          sum((fact->>8)::numeric) as amount,
          sum((fact->>9)::numeric) as approved_count
        from jsonb_array_elements(v_row.payload->'facts') fact
        group by jsonb_build_array(
          fact->0, fact->1, fact->2, fact->3, fact->4, fact->5, -1
        )
      ) aggregate;

      if exists (
        select 1
        from jsonb_array_elements(v_facts) fact
        where (fact->>7)::numeric > 1000000000
           or (fact->>8)::numeric > 1000000000000000
      ) then
        raise exception 'dashboard analysis aggregate exceeds contract bounds'
          using errcode = '22023';
      end if;

      payload := jsonb_set(
        jsonb_set(payload, '{dimensions,developments}', '[]'::jsonb),
        '{facts}',
        v_facts
      );
      if v_has_store then
        payload := jsonb_set(payload, '{dimensions,stores}', '[]'::jsonb);
      end if;
      if v_row.payload->'version' in ('3'::jsonb, '4'::jsonb) then
        select jsonb_set(payload, '{appointments}', coalesce(jsonb_agg(
          jsonb_set(
            jsonb_set(appointment, '{accountName}', '""'::jsonb),
            '{accountRanking}',
            '""'::jsonb
          )
          order by appointment->>'createdAt'
        ), '[]'::jsonb))
        into payload
        from jsonb_array_elements(payload->'appointments') appointment;
      end if;
    end if;
    return next;
  end loop;
end;
$$;

alter function public.read_crm_dashboard_analysis(bigint, text[]) owner to postgres;
revoke all on function public.read_crm_dashboard_analysis(bigint, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_dashboard_analysis(bigint, text[]) to authenticated;
