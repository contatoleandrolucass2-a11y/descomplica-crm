begin;

-- Preserve the complete six-stage funnel in the appointments-only projection.
-- The source payload remains unchanged; this projection keeps its aggregate
-- privacy boundary and the existing permission checks.
create or replace function private.project_crm_appointments_analysis(
  p_payload jsonb, p_can_rank boolean
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
  if p_payload->'version' is distinct from '4'::jsonb then
    return private.project_crm_appointments_analysis_v3_base(p_payload, p_can_rank);
  end if;
  select coalesce(jsonb_agg(f order by f), '[]'::jsonb) into v_facts
  from jsonb_array_elements(p_payload->'facts') f
  where (f->>0)::int in (0,1,2,3,4);
  for v_key, v_position in select * from (values
    ('managers',2),('owners',3),('companies',4),('developments',6),('stores',10)
  ) d(key,position) loop
    select coalesce(jsonb_agg(label order by original), '[]'::jsonb),
      coalesce(jsonb_object_agg(original,new_index), '{}'::jsonb)
      into v_dictionary,v_mapping
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
  select coalesce(jsonb_agg(g.key || jsonb_build_array(g.count,g.amount,g.approved,g.store)
    order by g.key,g.store), '[]'::jsonb)
  into v_facts
  from (
    select jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6) as key,
      f->10 as store,
      sum((f->>7)::numeric) as count,
      sum((f->>8)::numeric) as amount,
      sum((f->>9)::numeric) as approved
    from jsonb_array_elements(v_facts) f
    group by jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6),f->10
  ) g;
  if exists (select 1 from jsonb_array_elements(v_facts) f
    where (f->>7)::numeric > 1000000000
       or (f->>8)::numeric > 1000000000000000
       or (f->>9)::numeric > 1000000000) then
    raise exception 'dashboard analysis aggregate exceeds contract bounds' using errcode = '22023';
  end if;
  v_payload := jsonb_set(v_payload, '{facts}', v_facts);
  if not p_can_rank then
    select jsonb_set(v_payload, '{appointments}', coalesce(jsonb_agg(
      jsonb_set(jsonb_set(row, '{accountName}', '""'::jsonb),
        '{accountRanking}', '""'::jsonb) order by row->>'createdAt'
    ), '[]'::jsonb)) into v_payload
    from jsonb_array_elements(v_payload->'appointments') row;
  end if;
  return v_payload;
end;
$$;

alter function private.project_crm_appointments_analysis(jsonb,boolean) owner to postgres;
revoke all on function private.project_crm_appointments_analysis(jsonb,boolean)
  from public, anon, authenticated, service_role;

-- Return the complete funnel goal needed by this page without exposing the
-- goals table directly to the browser.
create or replace function public.read_crm_appointments_conversion_goals(p_reference_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goals jsonb;
begin
  if v_user_id is null or not coalesce(
    public.has_permission(v_user_id, 'crm.stage.appointments.view'), false
  ) then
    return null;
  end if;

  select coalesce(
    jsonb_object_agg(
      profile.profile_key,
      case
        when goal.id is null then null
        else jsonb_build_object(
          'opportunityAppointment', case when goal.opportunities > 0 and goal.appointments > 0
            then goal.opportunities::numeric / goal.appointments else null end,
          'appointmentVisit', case when goal.appointments > 0 and goal.visits > 0
            then goal.appointments::numeric / goal.visits else null end,
          'appointmentFolder', case when goal.appointments > 0 and goal.folders > 0
            then goal.appointments::numeric / goal.folders else null end,
          'appointmentApprovedFolder', case when goal.appointments > 0 and goal.approved_folders > 0
            then goal.appointments::numeric / goal.approved_folders else null end,
          'appointmentSale', case when goal.appointments > 0 and goal.sales > 0
            then goal.appointments::numeric / goal.sales else null end,
          'monthlyFunnel', jsonb_build_object(
            'opportunities', goal.opportunities,
            'appointments', goal.appointments,
            'visits', goal.visits,
            'folders', goal.folders,
            'approvedFolders', goal.approved_folders,
            'sales', goal.sales
          )
        )
      end
    ),
    '{}'::jsonb
  ) into v_goals
  from (values ('dv'::text), ('partnerships'::text)) profile(profile_key)
  left join lateral (
    select g.id, g.opportunities, g.appointments, g.visits, g.folders,
      g.approved_folders, g.sales
    from public.crm_funnel_goals g
    where g.profile_key = profile.profile_key
      and g.effective_month <= date_trunc('month', p_reference_date)::date
    order by g.effective_month desc
    limit 1
  ) goal on true;

  return v_goals;
end;
$$;

alter function public.read_crm_appointments_conversion_goals(date) owner to postgres;
revoke all on function public.read_crm_appointments_conversion_goals(date)
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_appointments_conversion_goals(date) to authenticated;

commit;
