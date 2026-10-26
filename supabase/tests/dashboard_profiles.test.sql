begin;

select plan(31);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.dashboard_profiles'::regclass),
  'dashboard profiles enable and force RLS'
);
select is(
  (select count(*) from pg_policy where polrelid = 'public.dashboard_profiles'::regclass),
  2::bigint,
  'owner and restrictive MFA policies are installed'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) role_name(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privilege(name)
  where has_table_privilege(role_name.name, 'public.dashboard_profiles', privilege.name)
), 'API roles have no direct table privileges');
select ok(
  has_function_privilege('authenticated', 'public.get_dashboard_profiles(text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_dashboard_profile(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.create_dashboard_profile(text,text,text,jsonb,smallint,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_dashboard_profile(uuid,bigint,text,jsonb,smallint)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.delete_dashboard_profile(uuid,bigint)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_default_dashboard_profile(uuid,bigint)', 'EXECUTE'),
  'authenticated enters only guarded profile RPCs'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('service_role')) role_name(name)
  cross join (values
    ('public.get_dashboard_profiles(text,text)'),
    ('public.get_dashboard_profile(uuid)'),
    ('public.create_dashboard_profile(text,text,text,jsonb,smallint,boolean)'),
    ('public.update_dashboard_profile(uuid,bigint,text,jsonb,smallint)'),
    ('public.delete_dashboard_profile(uuid,bigint)'),
    ('public.set_default_dashboard_profile(uuid,bigint)')
  ) function_name(name)
  where has_function_privilege(role_name.name, function_name.name, 'EXECUTE')
), 'anon and service role cannot execute dashboard profile RPCs');
select ok(
  not has_function_privilege('authenticated', 'private.assert_dashboard_profile_context(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.assert_dashboard_profile_document(text,jsonb)', 'EXECUTE'),
  'private validators are not callable by browser roles'
);

insert into auth.users (id, email) values
  ('ad810000-0000-4000-8000-000000000001', 'dashboard-profile-one@example.test'),
  ('ad810000-0000-4000-8000-000000000002', 'dashboard-profile-two@example.test');
select public.bootstrap_master_user('ad810000-0000-4000-8000-000000000001');
update public.profiles
set is_active = true, access_status = 'approved', approved_at = clock_timestamp(),
    approved_by = 'ad810000-0000-4000-8000-000000000001'
where user_id = 'ad810000-0000-4000-8000-000000000002';
update public.user_roles
set role_key = 'broker_house', assigned_by = 'ad810000-0000-4000-8000-000000000001'
where user_id = 'ad810000-0000-4000-8000-000000000002';
insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
) values (
  'ad810000-0000-4000-8000-000000000002',
  'crm.stage.appointments.view',
  'allow',
  'Synthetic dashboard profile isolation fixture',
  'ad810000-0000-4000-8000-000000000001'
);

create function pg_temp.dashboard_cards(p_id text, p_metric text default 'appointments.total')
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'id', p_id,
    'type', 'bars',
    'metric', p_metric,
    'period', 'month',
    'groupBy', 'day',
    'entityIds', null,
    'layout', jsonb_build_object('order', 0, 'columnSpan', 6, 'height', 360)
  ));
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$select * from public.dashboard_profiles$$,
  '42501',
  'permission denied for table dashboard_profiles',
  'direct table reads cannot bypass the RPC contract'
);
select throws_ok(
  $$select public.get_dashboard_profiles('crm.unknown', null)$$,
  '42501',
  'forbidden: dashboard page unavailable',
  'unknown pages fail closed'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Inválido',
    '[{"id":"bad","type":"pie"}]'::jsonb, 2, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard card',
  'database validates card shape independently from the API'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Métrica inválida',
    pg_temp.dashboard_cards('bad-metric','finance.revenue'), 2, false
  )$$,
  '22023',
  'invalid_argument: metric unavailable for dashboard page',
  'database rejects metrics outside the page catalog'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Entidade inválida',
    jsonb_set(pg_temp.dashboard_cards('bad-entity'), '{0,entityIds}', '["manager.untrusted"]'),
    2, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard card entities',
  'database rejects entity ids outside the page catalog'
);

create temporary table created_profiles (slot text primary key, id uuid not null);
insert into created_profiles
select 'first', (public.create_dashboard_profile(
  'crm.stage.appointments', null, 'Principal',
  jsonb_set(
    jsonb_set(pg_temp.dashboard_cards('card-1'), '{0,type}', '"kpi"'),
    '{0,layout}', '{"order":0,"columnSpan":2,"height":168}'
  ),
  2, false
)->>'id')::uuid;
insert into created_profiles
select 'second', (public.create_dashboard_profile(
  'crm.stage.appointments', null, 'Alternativo', pg_temp.dashboard_cards('card-2','appointments.rate'), 2, false
)->>'id')::uuid;

select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', null)),
  2,
  'owner lists both profiles in the requested page scope'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='first'))->>'isDefault')::boolean,
  true,
  'first profile becomes default automatically'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='first'))->>'schemaVersion',
  '2',
  'schema version 2 persists with a KPI at the 168px minimum'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='second'))->>'isDefault')::boolean,
  false,
  'later profile is not default unless requested'
);
select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='first'), 1, 'Principal novo', null, null
  )->>'version',
  '2',
  'matching optimistic version updates and increments version'
);
select throws_ok(
  format(
    'select public.update_dashboard_profile(%L::uuid, 1, %L, null, null)',
    (select id from created_profiles where slot='first'), 'Obsoleto'
  ),
  '40001',
  'conflict: dashboard profile version changed',
  'stale PATCH version fails with a serializable conflict code'
);
select is(
  public.set_default_dashboard_profile(
    (select id from created_profiles where slot='second'), 1
  )->>'version',
  '2',
  'set-default increments the selected profile version'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='first'))->>'isDefault')::boolean,
  false,
  'set-default clears the prior default atomically'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='second'))->>'isDefault')::boolean,
  true,
  'set-default selects exactly one default'
);
select throws_ok(
  format(
    'select public.delete_dashboard_profile(%L::uuid, 1)',
    (select id from created_profiles where slot='second')
  ),
  '40001',
  'conflict: dashboard profile version changed',
  'stale DELETE version fails with a conflict'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  public.get_dashboard_profiles('crm.stage.appointments', null),
  '[]'::jsonb,
  'another authorized user cannot list the first user profiles'
);
select throws_ok(
  format(
    'select public.get_dashboard_profile(%L::uuid)',
    (select id from created_profiles where slot='first')
  ),
  'P0002',
  'not_found: dashboard profile',
  'another user cannot address the first user profile by id'
);
select is(
  public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Segundo usuário',
    pg_temp.dashboard_cards('card-user-2'), 2, false
  )->>'isDefault',
  'true',
  'another user creates an independent default'
);
select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', null)),
  1,
  'another user sees only the own profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  public.delete_dashboard_profile(
    (select id from created_profiles where slot='second'), 2
  )#>>'{defaultProfile,id}',
  (select id::text from created_profiles where slot='first'),
  'deleting the default promotes the remaining profile atomically'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='first'))->>'isDefault')::boolean,
  true,
  'fallback profile is persisted as the new default'
);
select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', 'campaign-1')),
  0,
  'scopeKey isolates profiles within the same page'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', 'bad scope', 'Inválido', '[]'::jsonb, 2, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard profile scope',
  'invalid scopeKey is rejected by the database contract'
);

reset role;
select is(
  (select count(*) from public.dashboard_profiles),
  2::bigint,
  'fixture leaves one isolated row per user before rollback'
);
select is(
  (select count(*) from public.dashboard_profiles where is_default),
  2::bigint,
  'each user scope has exactly one default'
);

select * from finish();
rollback;
