begin;

select plan(15);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.meta_ads_canvas_profiles'::regclass),
  'canvas profiles enable and force RLS'
);
select is(
  (select count(*) from pg_policy
   where polrelid = 'public.meta_ads_canvas_profiles'::regclass),
  2::bigint,
  'canvas profiles have an owner policy and the restrictive session gate'
);
select ok(
  not has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'SELECT')
  and not has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'DELETE'),
  'authenticated users receive no direct table operations'
);
select ok(
  not has_table_privilege('anon', 'public.meta_ads_canvas_profiles', 'SELECT')
  and not has_table_privilege('anon', 'public.meta_ads_canvas_profiles', 'INSERT')
  and not has_table_privilege('service_role', 'public.meta_ads_canvas_profiles', 'SELECT'),
  'anon and service role have no direct privileges'
);

insert into auth.users (id, email)
values
  ('ad710000-0000-4000-8000-000000000001', 'canvas-one@example.test'),
  ('ad710000-0000-4000-8000-000000000002', 'canvas-two@example.test');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"ad710000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$select public.save_meta_ads_canvas_profile(
      'macro',
      '{"activeId":"22222222-2222-4222-8222-222222222222","defaultId":"22222222-2222-4222-8222-222222222222","items":[]}'::jsonb
    )$$,
  'owner can create a canvas profile'
);
select is(
  (select public.get_meta_ads_canvas_profile('macro') #>> '{state,activeId}'),
  '22222222-2222-4222-8222-222222222222',
  'owner reads the own profile through the audited RPC'
);
select is(
  (select (public.get_meta_ads_canvas_profile('macro') ->> 'revision')::bigint),
  1::bigint,
  'a new profile starts at revision one'
);
select lives_ok(
  $$select public.save_meta_ads_canvas_profile(
      'macro',
      '{"activeId":"22222222-2222-4222-8222-222222222222","defaultId":"22222222-2222-4222-8222-222222222222","items":[{"name":"Meu layout"}]}'::jsonb
    )$$,
  'owner can update the own profile'
);
select is(
  (select public.get_meta_ads_canvas_profile('macro') #>> '{state,items,0,name}'),
  'Meu layout',
  'owner update is persisted'
);
select is(
  (select (public.get_meta_ads_canvas_profile('macro') ->> 'revision')::bigint),
  2::bigint,
  'an update increments the profile revision'
);
select throws_ok(
  $$select * from public.meta_ads_canvas_profiles$$,
  '42501',
  'permission denied for table meta_ads_canvas_profiles',
  'the browser role cannot bypass the RPC contract with direct reads'
);
select throws_ok(
  $$select public.save_meta_ads_canvas_profile('invalid', '{}'::jsonb)$$,
  '22023',
  'invalid_argument: unknown canvas scope',
  'invalid scope is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad710000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  public.get_meta_ads_canvas_profile('macro'),
  null::jsonb,
  'another user cannot read the first user profile'
);
select lives_ok(
  $$select public.save_meta_ads_canvas_profile('micro-sets', '{"items":[]}'::jsonb)$$,
  'another user can create an isolated profile'
);

reset role;
select is(
  (select count(*) from public.meta_ads_canvas_profiles),
  2::bigint,
  'database owner sees both isolated rows for fixture verification'
);

select * from finish();
rollback;
