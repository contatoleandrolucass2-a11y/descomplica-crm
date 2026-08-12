begin;

select plan(28);

select has_table('public', 'crm_dashboard_snapshots', 'dashboard snapshots table exists');
select has_table('public', 'crm_dashboard_metrics', 'dashboard metrics table exists');
select has_table('public', 'crm_dashboard_views', 'dashboard view summaries table exists');
select has_table(
  'public',
  'crm_dashboard_top_developments',
  'dashboard top developments table exists'
);
select has_column(
  'public',
  'crm_dashboard_snapshots',
  'goals_available',
  'dashboard snapshots track goal source availability'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_dashboard_snapshots'::regclass),
  'snapshots have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_dashboard_metrics'::regclass),
  'metrics have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_dashboard_views'::regclass),
  'view summaries have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_dashboard_top_developments'::regclass),
  'top developments have RLS enabled'
);

select ok(
  has_table_privilege('authenticated', 'public.crm_dashboard_snapshots', 'select')
  and has_table_privilege('authenticated', 'public.crm_dashboard_views', 'select')
  and has_table_privilege('authenticated', 'public.crm_dashboard_metrics', 'select')
  and has_table_privilege('authenticated', 'public.crm_dashboard_top_developments', 'select'),
  'authenticated receives SELECT on the complete dashboard read model'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_dashboard_snapshots', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_views', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_metrics', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_top_developments', 'insert'),
  'authenticated cannot insert dashboard data directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_dashboard_snapshots', 'update')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_views', 'update')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_metrics', 'update')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_top_developments', 'update'),
  'authenticated cannot update dashboard data directly'
);

select ok(
  not has_table_privilege('anon', 'public.crm_dashboard_snapshots', 'select')
  and not has_table_privilege('anon', 'public.crm_dashboard_views', 'select')
  and not has_table_privilege('anon', 'public.crm_dashboard_metrics', 'select')
  and not has_table_privilege('anon', 'public.crm_dashboard_top_developments', 'select'),
  'anon cannot read dashboard data'
);

insert into public.crm_dashboard_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  source
) values (
  'global',
  '2026-08-04',
  '2026-08-04T03:00:00Z',
  'pgTAP fixture'
);

insert into public.crm_dashboard_views (
  snapshot_id,
  view_key,
  sales_value_month,
  sales_value_week,
  sales_value_today
)
select s.id, v.view_key, v.month_value, v.week_value, v.today_value
from public.crm_dashboard_snapshots s
cross join (
  values
    ('all', 742500::numeric, 241000::numeric, 58000::numeric),
    ('with_canal_imob', 207900::numeric, 67480::numeric, 16240::numeric),
    ('without_canal_imob', 534600::numeric, 173520::numeric, 41760::numeric)
) as v(view_key, month_value, week_value, today_value)
where s.snapshot_key = 'global';

insert into public.crm_dashboard_metrics (
  snapshot_id,
  view_key,
  stage_key,
  current_month,
  current_week,
  current_today,
  goal_month,
  goal_week,
  goal_today
)
select
  s.id,
  v.view_key,
  stage.stage_key,
  10,
  3,
  1,
  20,
  5,
  1
from public.crm_dashboard_snapshots s
cross join (
  values ('all'), ('with_canal_imob'), ('without_canal_imob')
) as v(view_key)
cross join (
  values ('opportunities'), ('appointments'), ('visits'), ('folders'), ('sales')
) as stage(stage_key)
where s.snapshot_key = 'global';

insert into public.crm_dashboard_top_developments
  (snapshot_id, view_key, rank, name, total)
select s.id, 'all', development.rank, development.name, development.total
from public.crm_dashboard_snapshots s
cross join (
  values
    (1::smallint, 'Reserva Urban Clube', 5::bigint),
    (2::smallint, 'Pátio Central', 3::bigint)
) as development(rank, name, total)
where s.snapshot_key = 'global';

select is(
  (select count(*) from public.crm_dashboard_views),
  3::bigint,
  'fixture stores one summary per dashboard view'
);
select is(
  (select goals_available from public.crm_dashboard_snapshots where snapshot_key = 'global'),
  false,
  'goal availability fails closed when a source is not declared'
);

select is(
  (select count(*) from public.crm_dashboard_metrics),
  15::bigint,
  'fixture stores one metric per view and stage'
);

select is(
  (select count(*) from public.crm_dashboard_top_developments),
  2::bigint,
  'fixture stores ranked developments'
);

select throws_ok(
  $$insert into public.crm_dashboard_snapshots
    (snapshot_key, reference_date, generated_at, source)
    values ('global', '2026-08-04', '2026-08-04T04:00:00Z', 'duplicate')$$,
  '23505',
  null,
  'snapshot business key is unique'
);

select throws_ok(
  $$insert into public.crm_dashboard_metrics
    (snapshot_id, view_key, stage_key, current_month)
    select id, 'all', 'sales', 1
    from public.crm_dashboard_snapshots
    where snapshot_key = 'global'$$,
  '23505',
  null,
  'duplicate metric identity is rejected'
);

select throws_ok(
  $$update public.crm_dashboard_metrics
    set current_month = -1
    where view_key = 'all' and stage_key = 'sales'$$,
  '23514',
  null,
  'negative dashboard metrics are rejected'
);

insert into auth.users (id, email)
values ('20000000-0000-0000-0000-000000000001', 'dashboard-master@example.test');

select public.bootstrap_master_user(
  '20000000-0000-0000-0000-000000000001'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.crm_dashboard_snapshots),
  1::bigint,
  'authorized Master reads the current dashboard snapshot'
);
select is(
  (select count(*) from public.crm_dashboard_metrics),
  15::bigint,
  'authorized Master reads dashboard metrics'
);
select is(
  (select count(*) from public.crm_dashboard_views),
  3::bigint,
  'authorized Master reads dashboard view summaries'
);
select is(
  (select count(*) from public.crm_dashboard_top_developments),
  2::bigint,
  'authorized Master reads ranked developments'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

insert into public.user_permission_overrides
  (user_id, permission_key, effect, reason)
values (
  '20000000-0000-0000-0000-000000000001',
  'crm.dashboard.view',
  'deny',
  'dashboard RLS test'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.crm_dashboard_snapshots),
  0::bigint,
  'deny override hides dashboard snapshots'
);
select is(
  (select count(*) from public.crm_dashboard_metrics),
  0::bigint,
  'deny override hides dashboard metrics'
);
select is(
  (select count(*) from public.crm_dashboard_views),
  0::bigint,
  'deny override hides dashboard view summaries'
);
select is(
  (select count(*) from public.crm_dashboard_top_developments),
  0::bigint,
  'deny override hides ranked developments'
);

reset role;

select * from finish();
rollback;
