-- Equipe Produtiva has its own read permission. It does not grant access to
-- other stage pages, raw analysis, sales values, accounts or ranking series.
create function private.project_crm_productive_team_analysis(
  p_payload jsonb, p_available_stages text[]
)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_payload jsonb := p_payload;
  v_facts jsonb;
  v_dictionary jsonb;
  v_mapping jsonb;
  v_key text;
  v_position int;
begin
  if p_payload->'version' is distinct from '4'::jsonb then return null; end if;
  -- One presence per broker/day/dimension is sufficient; activity volumes,
  -- financial amounts, approvals and project/store identities are not exposed.
  select coalesce(jsonb_agg(distinct jsonb_build_array(
    f->0,f->1,f->2,f->3,f->4,f->5,-1,1,0,0,-1
  )), '[]'::jsonb) into v_facts
  from jsonb_array_elements(p_payload->'facts') f
  where case (f->>0)::int
    when 1 then 'appointments' when 2 then 'visits'
    when 3 then 'folders' when 4 then 'sales' else null end = any(p_available_stages);
  for v_key, v_position in select * from (values
    ('managers',2),('owners',3),('companies',4)
  ) d(key,position) loop
    select coalesce(jsonb_agg(label order by original), '[]'::jsonb),
      coalesce(jsonb_object_agg(original::text, new_index), '{}'::jsonb)
    into v_dictionary, v_mapping
    from (
      select labels.label, labels.ordinality - 1 as original,
        row_number() over (order by labels.ordinality) - 1 as new_index
      from jsonb_array_elements(p_payload#>array['dimensions',v_key])
        with ordinality labels(label,ordinality)
      where exists (select 1 from jsonb_array_elements(v_facts) f
        where (f->>v_position)::int = labels.ordinality - 1)
    ) relevant;
    v_payload := jsonb_set(v_payload, array['dimensions',v_key], v_dictionary);
    select coalesce(jsonb_agg(jsonb_set(f, array[v_position::text],
      coalesce(v_mapping->(f->>v_position), '-1'::jsonb)) order by f), '[]'::jsonb)
      into v_facts from jsonb_array_elements(v_facts) f;
  end loop;
  v_payload := jsonb_set(jsonb_set(jsonb_set(v_payload,
    '{dimensions,developments}', '[]'::jsonb), '{dimensions,stores}', '[]'::jsonb),
    '{facts}', v_facts);
  select jsonb_set(v_payload, '{appointments}', coalesce(jsonb_agg(
    row || jsonb_build_object('accountName','','accountRanking','',
      'scheduledAt',null,'attendedAt',null,'visitPerformed',false)
    order by row->>'createdAt'
  ), '[]'::jsonb)) into v_payload
  from jsonb_array_elements(p_payload->'appointments') row
  where 'appointments' = any(p_available_stages);
  return v_payload;
end;
$$;
alter function private.project_crm_productive_team_analysis(jsonb,text[]) owner to postgres;
revoke all on function private.project_crm_productive_team_analysis(jsonb,text[])
  from public, anon, authenticated, service_role;

create function public.read_crm_productive_team(p_view_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.crm_dashboard_snapshots%rowtype;
  v_payload jsonb;
  v_roster jsonb := null;
  v_stages text[];
begin
  if v_user_id is null
    or not coalesce(public.has_permission(v_user_id, 'crm.productive_team.view'), false)
    or not exists (select 1 from public.app_pages p
      where p.key = 'crm.productive_team' and p.is_active
        and p.permission_key = 'crm.productive_team.view')
    or not coalesce(case p_view_key
      when 'all' then public.has_permission(v_user_id,'crm.dashboard.all.view')
      when 'with_canal_imob' then public.has_permission(v_user_id,'crm.dashboard.with_canal_imob.view')
      when 'without_canal_imob' then public.has_permission(v_user_id,'crm.dashboard.without_canal_imob.view')
      else false end, false) then return null; end if;

  -- STABLE functions share one MVCC snapshot, including the roster and source
  -- availability checks; no mixed generations can cross this boundary.
  select * into v_snapshot from public.crm_dashboard_snapshots s
    where s.snapshot_key = 'global';
  if not found then return null; end if;
  select a.payload into v_payload from public.crm_dashboard_analysis a
    where a.snapshot_id = v_snapshot.id and a.view_key = p_view_key
      and a.payload->'version' = '4'::jsonb
      and a.payload->>'referenceDate' = v_snapshot.reference_date::text;
  if not found then return null; end if;

  -- A real zero remains available. Missing source rows do not become zeros.
  select coalesce(array_agg(m.stage_key order by m.stage_key), array[]::text[])
  into v_stages from public.crm_dashboard_metrics m
  where m.snapshot_id = v_snapshot.id and m.view_key = p_view_key
    and m.stage_key in ('appointments','visits','folders','sales');

  -- The current roster authority describes House, never the Imob channel.
  -- Preserve the same metadata equality and 1,000-row bound as Agendamentos.
  if p_view_key <> 'with_canal_imob' then
    select case when count(*) <= 1000 then coalesce(jsonb_agg(jsonb_build_object(
      'key',p.broker_key,'owner',p.broker_name,'manager',p.manager_name
    ) order by p.broker_name,p.broker_key), '[]'::jsonb) else null end
    into v_roster
    from public.crm_ranking_snapshots r
    join public.crm_ranking_participants p on p.snapshot_id = r.id and p.period_key = 'month'
    where r.snapshot_key = 'global'
      and r.reference_date = v_snapshot.reference_date
      and r.generated_at = v_snapshot.generated_at
      and r.updated_at = v_snapshot.updated_at;
    if not exists (select 1 from public.crm_ranking_snapshots r
      where r.snapshot_key = 'global' and r.reference_date = v_snapshot.reference_date
        and r.generated_at = v_snapshot.generated_at and r.updated_at = v_snapshot.updated_at)
      then v_roster := null; end if;
  end if;
  return jsonb_build_object(
    'analysis',private.project_crm_productive_team_analysis(v_payload,v_stages),
    'brokerRoster',v_roster,'generatedAt',v_snapshot.generated_at,
    'availableStages',to_jsonb(v_stages)
  );
end;
$$;
alter function public.read_crm_productive_team(text) owner to postgres;
revoke all on function public.read_crm_productive_team(text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_productive_team(text) to authenticated;
notify pgrst, 'reload schema';
