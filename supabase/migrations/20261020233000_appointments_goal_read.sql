begin;

-- Expose only the active projected appointment volume needed by the appointments page.
-- The caller never receives the commercial policy row or its other fields.
create function public.read_crm_appointments_goal(p_reference_date date)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal bigint;
begin
  if v_user_id is null or not coalesce(
    public.has_permission(v_user_id, 'crm.stage.appointments.view'), false
  ) then
    return null;
  end if;

  -- Same projected funnel volume rendered by GoalPlanning: start at Sales and
  -- walk backwards through Approved folders, Folders, Visits and Appointments.
  select round(
    g.sales::numeric
    * (g.approved_folders_rate / 100)
    * (g.folders_rate / 100)
    * (g.visits_rate / 100)
    * (g.appointments_rate / 100)
  )::bigint
    into v_goal
    from public.crm_funnel_goals g
   where g.profile_key = 'dv'
     and g.effective_month <= date_trunc('month', p_reference_date)::date
   order by g.effective_month desc
   limit 1;

  return v_goal;
end;
$$;

alter function public.read_crm_appointments_goal(date) owner to postgres;
revoke all on function public.read_crm_appointments_goal(date)
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_appointments_goal(date) to authenticated;

commit;
