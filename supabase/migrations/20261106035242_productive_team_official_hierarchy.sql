-- Versioned read keeps v1 strict clients compatible during rollout.
-- The roster hierarchy is the official report pair, not activity-derived labels.
-- Apply before deploying the v2 reader; no ingestion or stored rows are changed.
create function public.read_crm_productive_team_v2(p_view_key text)
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
    select case when count(*) <= 1000 and bool_and(p.roster_manager_name is not null) is not false then coalesce(jsonb_agg(jsonb_build_object(
      'key',p.broker_key,'owner',p.broker_name,'manager',p.roster_manager_name,
      'regionalManager',p.regional_manager_name
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
alter function public.read_crm_productive_team_v2(text) owner to postgres;
revoke all on function public.read_crm_productive_team_v2(text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_productive_team_v2(text) to authenticated;
notify pgrst, 'reload schema';
