-- Gate 2 — Ranking point settings
--
-- Replaces the D1 point_goals row containing weights_json/targets_json with
-- normalized PostgreSQL rows. Ranking readers receive SELECT only; settings
-- administrators replace the complete catalog through one audited RPC.

create table public.crm_point_settings (
  setting_key text primary key,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_point_settings_key check (setting_key = 'default')
);

create trigger crm_point_settings_set_updated_at
  before update on public.crm_point_settings
  for each row execute function public.set_updated_at();

create table public.crm_point_metrics (
  setting_key text not null
    references public.crm_point_settings(setting_key) on delete cascade,
  metric_key text not null,
  weight integer not null default 0,
  target integer not null default 0,
  primary key (setting_key, metric_key),
  constraint crm_point_metrics_key check (
    metric_key in (
      'roulette',
      'roulette_saturday',
      'roulette_sunday',
      'schedule',
      'visit',
      'approved_folder',
      'sale'
    )
  ),
  constraint crm_point_metrics_values check (
    weight between 0 and 100000
    and target between 0 and 100000
  )
);

revoke all on table public.crm_point_settings, public.crm_point_metrics
  from anon, authenticated;
grant select on table public.crm_point_settings, public.crm_point_metrics
  to authenticated;
grant all on table public.crm_point_settings, public.crm_point_metrics
  to service_role;

alter table public.crm_point_settings enable row level security;
alter table public.crm_point_metrics enable row level security;

create policy crm_point_settings_select_authorized
  on public.crm_point_settings
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
    or (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
  );

create policy crm_point_metrics_select_authorized
  on public.crm_point_metrics
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
    or (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
  );

revoke insert, update, delete, truncate, references, trigger
  on table public.crm_point_settings, public.crm_point_metrics
  from anon, authenticated;

create or replace function public.replace_crm_point_settings(
  p_weights jsonb,
  p_targets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_metric_keys constant text[] := array[
    'roulette',
    'roulette_saturday',
    'roulette_sunday',
    'schedule',
    'visit',
    'approved_folder',
    'sale'
  ];
  v_metric text;
  v_weight numeric;
  v_target numeric;
  v_before jsonb;
  v_after jsonb;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage'
      using errcode = '42501';
  end if;

  if p_weights is null or jsonb_typeof(p_weights) <> 'object'
     or p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception 'invalid_argument: weights and targets must be objects'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_weights) as supplied(key)
    where not supplied.key = any(v_metric_keys)
  ) or exists (
    select 1
    from jsonb_object_keys(p_targets) as supplied(key)
    where not supplied.key = any(v_metric_keys)
  ) then
    raise exception 'invalid_argument: unknown point metric'
      using errcode = '22023';
  end if;

  foreach v_metric in array v_metric_keys loop
    if not p_weights ? v_metric or not p_targets ? v_metric
       or jsonb_typeof(p_weights -> v_metric) <> 'number'
       or jsonb_typeof(p_targets -> v_metric) <> 'number' then
      raise exception 'invalid_argument: incomplete point metric %', v_metric
        using errcode = '22023';
    end if;

    v_weight := (p_weights ->> v_metric)::numeric;
    v_target := (p_targets ->> v_metric)::numeric;

    if v_weight <> trunc(v_weight) or v_weight < 0 or v_weight > 100000
       or v_target <> trunc(v_target) or v_target < 0 or v_target > 100000 then
      raise exception 'invalid_argument: invalid point metric %', v_metric
        using errcode = '22023';
    end if;
  end loop;

  select jsonb_object_agg(
    m.metric_key,
    jsonb_build_object('weight', m.weight, 'target', m.target)
  )
  into v_before
  from public.crm_point_metrics m
  where m.setting_key = 'default';

  insert into public.crm_point_settings (setting_key, updated_by)
  values ('default', v_actor)
  on conflict (setting_key) do update set updated_by = excluded.updated_by;

  foreach v_metric in array v_metric_keys loop
    insert into public.crm_point_metrics (setting_key, metric_key, weight, target)
    values (
      'default',
      v_metric,
      (p_weights ->> v_metric)::integer,
      (p_targets ->> v_metric)::integer
    )
    on conflict (setting_key, metric_key) do update set
      weight = excluded.weight,
      target = excluded.target;
  end loop;

  select jsonb_object_agg(
    m.metric_key,
    jsonb_build_object('weight', m.weight, 'target', m.target)
  )
  into v_after
  from public.crm_point_metrics m
  where m.setting_key = 'default';

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'crm.point_settings.replaced',
    v_before,
    v_after
  );

  return jsonb_build_object('setting_key', 'default', 'metrics', v_after);
end;
$$;

revoke execute on function public.replace_crm_point_settings(jsonb, jsonb)
  from public, anon;
grant execute on function public.replace_crm_point_settings(jsonb, jsonb)
  to authenticated;
