begin;

-- Same maximum coverage as dashboardAnalysisSliceSchema: sixteen calendar months.
-- One statement gives all policy reads the same MVCC snapshot, with the current
-- month's exact reference date and historical month-specific effective policies.
create function public.read_crm_appointments_goals_range(
  p_start_date date, p_reference_date date
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_start_date is null or p_reference_date is null
    or p_start_date <> date_trunc('month', p_start_date)::date
    or p_start_date > p_reference_date
    or (extract(year from p_reference_date)::int * 12 + extract(month from p_reference_date)::int)
      - (extract(year from p_start_date)::int * 12 + extract(month from p_start_date)::int) > 15 then
    raise exception 'invalid appointments policy coverage' using errcode = '22023';
  end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'month', to_char(month, 'YYYY-MM'),
      'individualGoal', public.read_crm_appointments_goal(reference_date),
      'conversionGoals', public.read_crm_appointments_conversion_goals(reference_date)
    ) order by month)
    from (
      select month, case when date_trunc('month', p_reference_date) = month
        then p_reference_date else month::date end as reference_date
      from generate_series(p_start_date::timestamp,
        date_trunc('month', p_reference_date)::timestamp, interval '1 month') month
    ) dates
  );
end;
$$;

alter function public.read_crm_appointments_goals_range(date,date) owner to postgres;
revoke all on function public.read_crm_appointments_goals_range(date,date)
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_appointments_goals_range(date,date) to authenticated;

commit;
