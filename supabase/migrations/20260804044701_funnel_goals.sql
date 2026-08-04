-- Gate 2 — Monthly funnel goals
--
-- Replaces the unversioned crm_funnel_goals dependency used by the original
-- application. Browser roles can read authorized rows but cannot mutate the
-- table directly. All writes go through an audited SECURITY DEFINER RPC.

create table public.crm_funnel_goals (
  id bigint generated always as identity primary key,
  profile_key text not null,
  effective_month date not null,
  opportunities bigint not null default 0,
  appointments bigint not null default 0,
  visits bigint not null default 0,
  folders bigint not null default 0,
  approved_folders bigint not null default 0,
  sales bigint not null default 0,
  opportunities_rate numeric(8, 2) not null default 0,
  appointments_rate numeric(8, 2) not null default 0,
  visits_rate numeric(8, 2) not null default 0,
  folders_rate numeric(8, 2) not null default 0,
  approved_folders_rate numeric(8, 2) not null default 0,
  broker_minimum_month_1 integer not null default 0,
  broker_minimum_month_2 integer not null default 0,
  broker_minimum_month_3 integer not null default 0,
  broker_minimum_month_4_plus integer not null default 0,
  broker_weekly_appointments integer not null default 0,
  broker_weekly_visits integer not null default 0,
  broker_weekly_folders integer not null default 0,
  productive_team_appointments smallint not null default 0,
  productive_team_visits smallint not null default 0,
  productive_team_folders smallint not null default 0,
  productive_team_sales smallint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_key, effective_month),
  constraint crm_funnel_goals_profile_key
    check (profile_key in ('dv', 'partnerships')),
  constraint crm_funnel_goals_effective_month_start
    check (effective_month = date_trunc('month', effective_month)::date),
  constraint crm_funnel_goals_stage_values
    check (
      opportunities between 0 and 10000000
      and appointments between 0 and 10000000
      and visits between 0 and 10000000
      and folders between 0 and 10000000
      and approved_folders between 0 and 10000000
      and sales between 0 and 10000000
    ),
  constraint crm_funnel_goals_rates
    check (
      opportunities_rate between 0 and 10000
      and appointments_rate between 0 and 10000
      and visits_rate between 0 and 10000
      and folders_rate between 0 and 10000
      and approved_folders_rate between 0 and 10000
    ),
  constraint crm_funnel_goals_broker_minimums
    check (
      broker_minimum_month_1 between 0 and 100000
      and broker_minimum_month_2 between 0 and 100000
      and broker_minimum_month_3 between 0 and 100000
      and broker_minimum_month_4_plus between 0 and 100000
    ),
  constraint crm_funnel_goals_broker_weekly
    check (
      broker_weekly_appointments between 0 and 100000
      and broker_weekly_visits between 0 and 100000
      and broker_weekly_folders between 0 and 100000
    ),
  constraint crm_funnel_goals_productive_team
    check (
      productive_team_appointments between 0 and 100
      and productive_team_visits between 0 and 100
      and productive_team_folders between 0 and 100
      and productive_team_sales between 0 and 100
    ),
  constraint crm_funnel_goals_partnership_scope
    check (
      profile_key <> 'partnerships'
      or (
        opportunities = 0
        and appointments = 0
        and opportunities_rate = 0
        and appointments_rate = 0
        and broker_weekly_appointments = 0
        and productive_team_appointments = 0
      )
    )
);

create index crm_funnel_goals_profile_month_idx
  on public.crm_funnel_goals (profile_key, effective_month desc);

create trigger crm_funnel_goals_set_updated_at
  before update on public.crm_funnel_goals
  for each row execute function public.set_updated_at();

revoke all on table public.crm_funnel_goals from anon, authenticated;
grant select on table public.crm_funnel_goals to authenticated;
grant all on table public.crm_funnel_goals to service_role;
grant usage, select on sequence public.crm_funnel_goals_id_seq to service_role;

alter table public.crm_funnel_goals enable row level security;

create policy crm_funnel_goals_select_authorized
  on public.crm_funnel_goals
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
  );

revoke insert, update, delete, truncate, references, trigger
  on table public.crm_funnel_goals from anon, authenticated;

create or replace function public.upsert_crm_funnel_goals(
  p_profile_key text,
  p_effective_month date,
  p_sales bigint,
  p_opportunities_rate numeric,
  p_appointments_rate numeric,
  p_visits_rate numeric,
  p_folders_rate numeric,
  p_approved_folders_rate numeric,
  p_broker_minimum_month_1 integer,
  p_broker_minimum_month_2 integer,
  p_broker_minimum_month_3 integer,
  p_broker_minimum_month_4_plus integer,
  p_broker_weekly_appointments integer,
  p_broker_weekly_visits integer,
  p_broker_weekly_folders integer,
  p_productive_team_appointments smallint,
  p_productive_team_visits smallint,
  p_productive_team_folders smallint,
  p_productive_team_sales smallint
)
returns public.crm_funnel_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before jsonb;
  v_after public.crm_funnel_goals;
  v_effective_month date;
  v_opportunities bigint;
  v_appointments bigint;
  v_visits bigint;
  v_folders bigint;
  v_approved_folders bigint;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage'
      using errcode = '42501';
  end if;

  if p_profile_key is null or p_profile_key not in ('dv', 'partnerships') then
    raise exception 'invalid_argument: invalid profile'
      using errcode = '22023';
  end if;

  if p_effective_month is null then
    raise exception 'invalid_argument: effective month is required'
      using errcode = '22023';
  end if;

  v_effective_month := date_trunc('month', p_effective_month)::date;

  if p_sales is null or p_sales < 0 or p_sales > 10000000
     or p_opportunities_rate is null or p_opportunities_rate < 0 or p_opportunities_rate > 10000
     or p_appointments_rate is null or p_appointments_rate < 0 or p_appointments_rate > 10000
     or p_visits_rate is null or p_visits_rate < 0 or p_visits_rate > 10000
     or p_folders_rate is null or p_folders_rate < 0 or p_folders_rate > 10000
     or p_approved_folders_rate is null or p_approved_folders_rate < 0 or p_approved_folders_rate > 10000
     or p_broker_minimum_month_1 is null or p_broker_minimum_month_1 < 0 or p_broker_minimum_month_1 > 100000
     or p_broker_minimum_month_2 is null or p_broker_minimum_month_2 < 0 or p_broker_minimum_month_2 > 100000
     or p_broker_minimum_month_3 is null or p_broker_minimum_month_3 < 0 or p_broker_minimum_month_3 > 100000
     or p_broker_minimum_month_4_plus is null or p_broker_minimum_month_4_plus < 0 or p_broker_minimum_month_4_plus > 100000
     or p_broker_weekly_appointments is null or p_broker_weekly_appointments < 0 or p_broker_weekly_appointments > 100000
     or p_broker_weekly_visits is null or p_broker_weekly_visits < 0 or p_broker_weekly_visits > 100000
     or p_broker_weekly_folders is null or p_broker_weekly_folders < 0 or p_broker_weekly_folders > 100000
     or p_productive_team_appointments is null or p_productive_team_appointments < 0 or p_productive_team_appointments > 100
     or p_productive_team_visits is null or p_productive_team_visits < 0 or p_productive_team_visits > 100
     or p_productive_team_folders is null or p_productive_team_folders < 0 or p_productive_team_folders > 100
     or p_productive_team_sales is null or p_productive_team_sales < 0 or p_productive_team_sales > 100 then
    raise exception 'invalid_argument: goal values are outside accepted ranges'
      using errcode = '22023';
  end if;

  if p_profile_key = 'partnerships' then
    p_opportunities_rate := 0;
    p_appointments_rate := 0;
    p_broker_weekly_appointments := 0;
    p_productive_team_appointments := 0;
  end if;

  v_approved_folders := round(p_sales * p_approved_folders_rate / 100.0);
  v_folders := round(v_approved_folders * p_folders_rate / 100.0);
  v_visits := round(v_folders * p_visits_rate / 100.0);
  v_appointments := case
    when p_profile_key = 'partnerships' then 0
    else round(v_visits * p_appointments_rate / 100.0)
  end;
  v_opportunities := case
    when p_profile_key = 'partnerships' then 0
    else round(v_appointments * p_opportunities_rate / 100.0)
  end;

  if greatest(
    v_opportunities,
    v_appointments,
    v_visits,
    v_folders,
    v_approved_folders,
    p_sales
  ) > 10000000 then
    raise exception 'invalid_argument: calculated goals exceed accepted range'
      using errcode = '22023';
  end if;

  select to_jsonb(g)
    into v_before
    from public.crm_funnel_goals g
    where g.profile_key = p_profile_key
      and g.effective_month = v_effective_month
    for update;

  insert into public.crm_funnel_goals (
    profile_key,
    effective_month,
    opportunities,
    appointments,
    visits,
    folders,
    approved_folders,
    sales,
    opportunities_rate,
    appointments_rate,
    visits_rate,
    folders_rate,
    approved_folders_rate,
    broker_minimum_month_1,
    broker_minimum_month_2,
    broker_minimum_month_3,
    broker_minimum_month_4_plus,
    broker_weekly_appointments,
    broker_weekly_visits,
    broker_weekly_folders,
    productive_team_appointments,
    productive_team_visits,
    productive_team_folders,
    productive_team_sales,
    updated_by
  ) values (
    p_profile_key,
    v_effective_month,
    v_opportunities,
    v_appointments,
    v_visits,
    v_folders,
    v_approved_folders,
    p_sales,
    p_opportunities_rate,
    p_appointments_rate,
    p_visits_rate,
    p_folders_rate,
    p_approved_folders_rate,
    p_broker_minimum_month_1,
    p_broker_minimum_month_2,
    p_broker_minimum_month_3,
    p_broker_minimum_month_4_plus,
    p_broker_weekly_appointments,
    p_broker_weekly_visits,
    p_broker_weekly_folders,
    p_productive_team_appointments,
    p_productive_team_visits,
    p_productive_team_folders,
    p_productive_team_sales,
    v_actor
  )
  on conflict (profile_key, effective_month) do update set
    opportunities = excluded.opportunities,
    appointments = excluded.appointments,
    visits = excluded.visits,
    folders = excluded.folders,
    approved_folders = excluded.approved_folders,
    sales = excluded.sales,
    opportunities_rate = excluded.opportunities_rate,
    appointments_rate = excluded.appointments_rate,
    visits_rate = excluded.visits_rate,
    folders_rate = excluded.folders_rate,
    approved_folders_rate = excluded.approved_folders_rate,
    broker_minimum_month_1 = excluded.broker_minimum_month_1,
    broker_minimum_month_2 = excluded.broker_minimum_month_2,
    broker_minimum_month_3 = excluded.broker_minimum_month_3,
    broker_minimum_month_4_plus = excluded.broker_minimum_month_4_plus,
    broker_weekly_appointments = excluded.broker_weekly_appointments,
    broker_weekly_visits = excluded.broker_weekly_visits,
    broker_weekly_folders = excluded.broker_weekly_folders,
    productive_team_appointments = excluded.productive_team_appointments,
    productive_team_visits = excluded.productive_team_visits,
    productive_team_folders = excluded.productive_team_folders,
    productive_team_sales = excluded.productive_team_sales,
    updated_by = excluded.updated_by
  returning * into v_after;

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'crm.funnel_goals.upserted',
    v_before,
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

revoke execute on function public.upsert_crm_funnel_goals(
  text, date, bigint, numeric, numeric, numeric, numeric, numeric,
  integer, integer, integer, integer, integer, integer, integer,
  smallint, smallint, smallint, smallint
) from public, anon;

grant execute on function public.upsert_crm_funnel_goals(
  text, date, bigint, numeric, numeric, numeric, numeric, numeric,
  integer, integer, integer, integer, integer, integer, integer,
  smallint, smallint, smallint, smallint
) to authenticated;
