begin;

select plan(12);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.meta_ads_canvas_profiles'::regclass),
  'canvas profiles enable and force RLS'
);
select is(
  (select count(*) from pg_policy
   where polrelid = 'public.meta_ads_canvas_profiles'::regclass),
  1::bigint,
  'canvas profiles have one owner policy'
);
select ok(
  has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'SELECT')
  and has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'INSERT')
  and has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'UPDATE')
  and has_table_privilege('authenticated', 'public.meta_ads_canvas_profiles', 'DELETE'),
  'authenticated users receive only the required data operations'
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
  $$insert into public.meta_ads_canvas_profiles (user_id, scope, state)
    values (
      'ad710000-0000-4000-8000-000000000001',
      'macro',
      '{"activeId":"22222222-2222-4222-8222-222222222222","defaultId":"22222222-2222-4222-8222-222222222222","items":[]}'::jsonb
    )$$,
  'owner can create a canvas profile'
);
select is(
  (select count(*) from public.meta_ads_canvas_profiles),
  1::bigint,
  'owner reads only the own profile'
);
select lives_ok(
  $$update public.meta_ads_canvas_profiles
    set state = jsonb_set(state, '{items}', '[{"name":"Meu layout"}]'::jsonb)
    where scope = 'macro'$$,
  'owner can update the own profile'
);
select is(
  (select state #>> '{items,0,name}' from public.meta_ads_canvas_profiles where scope = 'macro'),
  'Meu layout',
  'owner update is persisted'
);
select throws_ok(
  $$insert into public.meta_ads_canvas_profiles (user_id, scope, state)
    values ('ad710000-0000-4000-8000-000000000002', 'macro', '{}'::jsonb)$$,
  '42501',
  'new row violates row-level security policy for table "meta_ads_canvas_profiles"',
  'owner cannot create a profile for another user'
);
select throws_ok(
  $$insert into public.meta_ads_canvas_profiles (user_id, scope, state)
    values ('ad710000-0000-4000-8000-000000000001', 'invalid', '{}'::jsonb)$$,
  '23514',
  null,
  'invalid scope is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad710000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  (select count(*) from public.meta_ads_canvas_profiles),
  0::bigint,
  'another user cannot read the first user profile'
);
select is(
  (select count(*) from public.meta_ads_canvas_profiles
   where user_id = 'ad710000-0000-4000-8000-000000000001'),
  0::bigint,
  'explicit owner predicate cannot bypass RLS'
);

reset role;
select is(
  (select count(*) from public.meta_ads_canvas_profiles),
  1::bigint,
  'database owner sees the preserved row for fixture verification'
);

select * from finish();
rollback;
