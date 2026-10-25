begin;

-- Expose only the three configured conversion limits consumed by the
-- appointments indicators. The commercial goal rows remain private.
create function public.read_crm_appointments_conversion_goals(p_reference_date date)
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
          'opportunityAppointment',
            case when goal.opportunities > 0 and goal.appointments > 0
              then goal.opportunities::numeric / goal.appointments
              else null end,
          'appointmentVisit',
            case when goal.appointments > 0 and goal.visits > 0
              then goal.appointments::numeric / goal.visits
              else null end,
          'appointmentSale',
            case when goal.appointments > 0 and goal.sales > 0
              then goal.appointments::numeric / goal.sales
              else null end
        )
      end
    ),
    '{}'::jsonb
  )
    into v_goals
    from (values ('dv'::text), ('partnerships'::text)) profile(profile_key)
    left join lateral (
      select g.id, g.opportunities, g.appointments, g.visits, g.sales
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
