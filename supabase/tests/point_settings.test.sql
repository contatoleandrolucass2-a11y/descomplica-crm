begin;

select plan(26);

select has_table('public', 'crm_point_settings', 'point settings table exists');
select has_table('public', 'crm_point_metrics', 'point metrics table exists');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_point_settings'::regclass),
  'point settings have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_point_metrics'::regclass),
  'point metrics have RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.crm_point_settings', 'select')
  and has_table_privilege('authenticated', 'public.crm_point_metrics', 'select'),
  'authenticated receives SELECT on normalized point settings'
);
select ok(
  not has_table_privilege('authenticated', 'public.crm_point_settings', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_point_settings', 'update')
  and not has_table_privilege('authenticated', 'public.crm_point_metrics', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_point_metrics', 'update'),
  'authenticated cannot mutate point settings directly'
);
select ok(
  not has_table_privilege('anon', 'public.crm_point_settings', 'select')
  and not has_table_privilege('anon', 'public.crm_point_metrics', 'select'),
  'anon cannot read point settings'
);
select has_function(
  'public',
  'replace_crm_point_settings',
  array['jsonb', 'jsonb'],
  'audited point settings RPC exists'
);
select is((select count(*) from public.crm_point_settings), 0::bigint, 'migration seeds no settings');
select is((select count(*) from public.crm_point_metrics), 0::bigint, 'migration seeds no metrics');

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'points-admin@example.test'),
  ('40000000-0000-0000-0000-000000000002', 'points-user@example.test');

update public.user_roles
set role_key = 'admin'
where user_id = '40000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.replace_crm_point_settings(
    '{"roulette":1,"roulette_saturday":2,"roulette_sunday":3,"schedule":1,"visit":7,"approved_folder":4,"sale":10}'::jsonb,
    '{"roulette":0,"roulette_saturday":0,"roulette_sunday":0,"schedule":50,"visit":20,"approved_folder":10,"sale":5}'::jsonb
  )$$,
  'authorized administrator creates point settings through the RPC'
);
select is((select count(*) from public.crm_point_settings), 1::bigint, 'RPC creates singleton settings');
select is((select count(*) from public.crm_point_metrics), 7::bigint, 'RPC creates all seven metric rows');
select is(
  (select weight from public.crm_point_metrics where metric_key = 'sale'),
  10,
  'sale weight is persisted'
);
select is(
  (select updated_by from public.crm_point_settings where setting_key = 'default'),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'settings record the authenticated actor'
);

reset role;
select is(
  (select count(*) from public.audit_logs where action = 'crm.point_settings.replaced'),
  1::bigint,
  'point settings creation is audited atomically'
);
set local role authenticated;

select throws_ok(
  $$select public.replace_crm_point_settings(
    '{"roulette":1,"roulette_saturday":2,"roulette_sunday":3,"schedule":1,"visit":7,"approved_folder":4,"sale":10,"unknown":1}'::jsonb,
    '{"roulette":0,"roulette_saturday":0,"roulette_sunday":0,"schedule":50,"visit":20,"approved_folder":10,"sale":5}'::jsonb
  )$$,
  '22023',
  null,
  'RPC rejects unknown metric keys'
);
select lives_ok(
  $$select public.replace_crm_point_settings(
    '{"roulette":2,"roulette_saturday":3,"roulette_sunday":4,"schedule":2,"visit":8,"approved_folder":5,"sale":12}'::jsonb,
    '{"roulette":1,"roulette_saturday":1,"roulette_sunday":1,"schedule":60,"visit":25,"approved_folder":12,"sale":6}'::jsonb
  )$$,
  'authorized administrator replaces the complete configuration'
);
select is((select count(*) from public.crm_point_metrics), 7::bigint, 'replacement remains complete');
select is(
  (select weight from public.crm_point_metrics where metric_key = 'sale'),
  12,
  'replacement updates the sale weight'
);

reset role;
select is(
  (select count(*) from public.audit_logs where action = 'crm.point_settings.replaced'),
  2::bigint,
  'replacement appends a second audit event'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.crm_point_settings), 1::bigint, 'ranking reader sees settings');
select is((select count(*) from public.crm_point_metrics), 7::bigint, 'ranking reader sees all weights');

reset role;
insert into public.user_permission_overrides (user_id, permission_key, effect, reason)
values (
  '40000000-0000-0000-0000-000000000002',
  'crm.ranking.view',
  'deny',
  'point settings RLS test'
);
set local role authenticated;
select ok(
  (select count(*) from public.crm_point_settings) = 0
  and (select count(*) from public.crm_point_metrics) = 0,
  'ranking deny override hides all point settings'
);
select throws_ok(
  $$select public.replace_crm_point_settings(
    '{"roulette":1,"roulette_saturday":2,"roulette_sunday":3,"schedule":1,"visit":7,"approved_folder":4,"sale":10}'::jsonb,
    '{"roulette":0,"roulette_saturday":0,"roulette_sunday":0,"schedule":0,"visit":0,"approved_folder":0,"sale":0}'::jsonb
  )$$,
  '42501',
  null,
  'ranking reader cannot replace point settings'
);

reset role;
update public.profiles
set is_active = false
where user_id = '40000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select public.replace_crm_point_settings(
    '{"roulette":1,"roulette_saturday":2,"roulette_sunday":3,"schedule":1,"visit":7,"approved_folder":4,"sale":10}'::jsonb,
    '{"roulette":0,"roulette_saturday":0,"roulette_sunday":0,"schedule":0,"visit":0,"approved_folder":0,"sale":0}'::jsonb
  )$$,
  '42501',
  null,
  'inactive administrator cannot replace point settings'
);

reset role;
select * from finish();
rollback;
