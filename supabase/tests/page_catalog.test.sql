begin;

select plan(29);

select has_table('public', 'app_pages', 'app_pages exists');

select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.app_pages'::regclass),
  'app_pages has RLS enabled'
);

select is(
  (select count(*) from public.permissions where key like 'crm.%' or key like 'pages.%'),
  9::bigint,
  'nine Gate 1 permissions are seeded'
);

select is(
  (select count(*) from public.app_pages),
  15::bigint,
  'all CRM and initial admin pages are seeded'
);

select is(
  (
    select count(*)
    from public.roles r
    where (
      select count(*)
      from public.role_permissions rp
      where rp.role_key = r.key
        and rp.permission_key in (
          'pages.view',
          'crm.dashboard.view',
          'crm.stages.view',
          'crm.ranking.view'
        )
    ) = 4
  ),
  8::bigint,
  'all eight profiles receive the exact core CRM read permissions'
);

select is(
  (
    select array_agg(distinct rp.role_key order by rp.role_key)
    from public.role_permissions rp
    where rp.permission_key in ('crm.settings.view', 'crm.settings.manage')
  ),
  array['admin', 'master']::text[],
  'only admin and master receive CRM settings permissions'
);

select is(
  (
    select concat_ws(
      '|',
      path,
      name,
      description,
      section,
      permission_key,
      sort_order::text,
      is_navigation::text,
      is_active::text
    )
    from public.app_pages
    where key = 'crm.partnerships'
  ),
  '/app/canal-de-parcerias|Canal de Parcerias|Ranking das imobiliárias parceiras|crm|crm.ranking.view|65|true|true',
  'the remote partnership catalog identity is versioned explicitly'
);

select has_function(
  'public',
  'handle_new_auth_user',
  array[]::text[],
  'Auth provisioning trigger function exists'
);

select ok(
  has_table_privilege('authenticated', 'public.app_pages', 'select'),
  'authenticated receives SELECT on app_pages'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_pages', 'insert'),
  'authenticated cannot INSERT app_pages directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_pages', 'update'),
  'authenticated cannot UPDATE app_pages directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_pages', 'delete'),
  'authenticated cannot DELETE app_pages directly'
);

select ok(
  not has_table_privilege('anon', 'public.app_pages', 'select'),
  'anon cannot SELECT app_pages'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_app_page_active(text,boolean,text)',
    'execute'
  ),
  'authenticated can invoke the guarded visibility RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_app_page_active(text,boolean,text)',
    'execute'
  ),
  'anon cannot invoke the visibility RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_app_pages_for_management()',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.list_app_pages_for_management()',
    'execute'
  ),
  'only authenticated callers can invoke the guarded management listing'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'gate1-user@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'gate1-master@example.test');

update public.user_roles
set role_key = 'master'
where user_id = '10000000-0000-0000-0000-000000000002';

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'user',
  'new Auth users receive the least-privileged role'
);

select ok(
  (
    select is_active
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'new Auth users receive an active profile'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.app_pages),
  8::bigint,
  'regular user sees only authorized CRM pages'
);

select throws_ok(
  $$select public.set_app_page_active('crm.ranking', false, 'unauthorized test')$$,
  '42501',
  'forbidden: actor cannot manage pages',
  'regular user cannot change catalog visibility'
);

select throws_ok(
  $$select public.set_user_active(
    '10000000-0000-0000-0000-000000000002',
    false,
    'unauthorized test'
  )$$,
  '42501',
  'forbidden: actor cannot manage users',
  'regular user cannot change account status'
);

reset role;

insert into public.user_permission_overrides
  (user_id, permission_key, effect, reason)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'pages.view',
    'deny',
    'RLS test'
  );

set local role authenticated;

select is(
  (select count(*) from public.app_pages),
  0::bigint,
  'pages.view deny override hides the navigation catalog'
);

reset role;

delete from public.user_permission_overrides
where user_id = '10000000-0000-0000-0000-000000000001'
  and permission_key = 'pages.view';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select lives_ok(
  $$select public.set_app_page_active('crm.ranking', false, 'pgTAP visibility test')$$,
  'master can change page visibility through the guarded RPC'
);

select is(
  (select count(*) from public.list_app_pages_for_management()),
  15::bigint,
  'page manager RPC returns active and inactive catalog entries'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(
  (select count(*) from public.app_pages),
  7::bigint,
  'regular user does not see an inactive page'
);

reset role;

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'authorization.page_visibility_changed'
      and actor_id = '10000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'page visibility mutation is audited once'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select lives_ok(
  $$select public.set_user_active(
    '10000000-0000-0000-0000-000000000001',
    false,
    'pgTAP inactive-user test'
  )$$,
  'master can deactivate a lower-level user through the guarded RPC'
);

reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(
  (select count(*) from public.app_pages),
  0::bigint,
  'inactive users cannot read the page catalog'
);

select is(
  (
    select count(*)
    from public.get_user_authorization_context(
      '10000000-0000-0000-0000-000000000001'
    )
  ),
  0::bigint,
  'inactive users cannot obtain an authorization context'
);

reset role;

select * from finish();
rollback;
