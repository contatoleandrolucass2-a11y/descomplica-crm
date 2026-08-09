begin;

select plan(25);

select has_table('public', 'crm_funnel_goals', 'funnel goals table exists');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_funnel_goals'::regclass),
  'funnel goals have RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.crm_funnel_goals', 'select'),
  'authenticated can select authorized funnel goals'
);
select ok(
  not has_table_privilege('authenticated', 'public.crm_funnel_goals', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_funnel_goals', 'update')
  and not has_table_privilege('authenticated', 'public.crm_funnel_goals', 'delete'),
  'authenticated cannot mutate funnel goals directly'
);
select ok(
  not has_table_privilege('anon', 'public.crm_funnel_goals', 'select'),
  'anon cannot read funnel goals'
);
select has_function(
  'public',
  'upsert_crm_funnel_goals',
  array[
    'text', 'date', 'bigint', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric',
    'integer', 'integer', 'integer', 'integer', 'integer', 'integer', 'integer',
    'smallint', 'smallint', 'smallint', 'smallint'
  ],
  'audited funnel goals RPC exists'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.crm_funnel_goals_id_seq', 'usage'),
  'authenticated cannot use the goals sequence directly'
);

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'goals-master@example.test'),
  ('30000000-0000-0000-0000-000000000002', 'goals-pending@example.test');

select public.bootstrap_master_user(
  '30000000-0000-0000-0000-000000000001'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.crm_funnel_goals),
  0::bigint,
  'authorized Master starts with no configured goals'
);

select lives_ok(
  $$select public.upsert_crm_funnel_goals(
    'dv', '2026-08-01', 10,
    200, 150, 200, 125, 120,
    4, 6, 8, 10,
    6, 2, 1,
    100::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  'authorized Master creates DV goals through the RPC'
);

select is(
  (select count(*) from public.crm_funnel_goals),
  1::bigint,
  'RPC creates one monthly profile row'
);
select is(
  (select approved_folders from public.crm_funnel_goals where profile_key = 'dv'),
  12::bigint,
  'approved folders are calculated from sales'
);
select is(
  (select opportunities from public.crm_funnel_goals where profile_key = 'dv'),
  90::bigint,
  'complete funnel is calculated deterministically from configured rates'
);
select is(
  (select updated_by from public.crm_funnel_goals where profile_key = 'dv'),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'RPC records the authenticated actor on the goal row'
);

reset role;
select is(
  (select count(*) from public.audit_logs where action = 'crm.funnel_goals.upserted'),
  1::bigint,
  'goal creation is audited atomically'
);
set local role authenticated;

select lives_ok(
  $$select public.upsert_crm_funnel_goals(
    'dv', '2026-08-15', 12,
    200, 150, 200, 125, 120,
    4, 6, 8, 10,
    6, 2, 1,
    100::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  'RPC updates the existing profile for the same month'
);
select is(
  (select count(*) from public.crm_funnel_goals where profile_key = 'dv'),
  1::bigint,
  'same profile and month are idempotently upserted'
);
select is(
  (select sales from public.crm_funnel_goals where profile_key = 'dv'),
  12::bigint,
  'monthly upsert persists the new sales target'
);

reset role;
select is(
  (select count(*) from public.audit_logs where action = 'crm.funnel_goals.upserted'),
  2::bigint,
  'goal update appends a second audit event'
);
set local role authenticated;

select lives_ok(
  $$select public.upsert_crm_funnel_goals(
    'partnerships', '2026-08-01', 8,
    900, 900, 200, 125, 120,
    4, 6, 8, 10,
    99, 2, 1,
    99::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  'partnership goals are accepted through the same guarded RPC'
);
select ok(
  (
    select opportunities = 0
      and appointments = 0
      and opportunities_rate = 0
      and appointments_rate = 0
      and broker_weekly_appointments = 0
      and productive_team_appointments = 0
    from public.crm_funnel_goals
    where profile_key = 'partnerships'
  ),
  'partnership profile enforces its reduced funnel scope server-side'
);
select is(
  (select count(*) from public.crm_funnel_goals),
  2::bigint,
  'the two profile goals remain independently versioned'
);

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select is(
  (select count(*) from public.crm_funnel_goals),
  0::bigint,
  'pending user without settings permission cannot read goal rows'
);
select throws_ok(
  $$select public.upsert_crm_funnel_goals(
    'dv', '2026-08-01', 10,
    200, 150, 200, 125, 120,
    4, 6, 8, 10,
    6, 2, 1,
    100::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  '42501',
  null,
  'pending user without settings permission cannot call the write RPC'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
update public.profiles
set is_active = false,
    access_status = 'suspended'
where user_id = '30000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select throws_ok(
  $$select public.upsert_crm_funnel_goals(
    'dv', '2026-08-01', 10,
    200, 150, 200, 125, 120,
    4, 6, 8, 10,
    6, 2, 1,
    100::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  '42501',
  null,
  'inactive Master cannot mutate goals'
);

select throws_ok(
  $$select public.upsert_crm_funnel_goals(
    'invalid', '2026-08-01', 10,
    200, 150, 200, 125, 120,
    4, 6, 8, 10,
    6, 2, 1,
    100::smallint, 90::smallint, 80::smallint, 60::smallint
  )$$,
  '42501',
  null,
  'inactive caller fails closed before input validation'
);

reset role;
select * from finish();
rollback;
