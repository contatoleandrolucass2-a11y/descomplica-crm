begin;

select plan(33);

select has_table('public', 'app_pages', 'app_pages exists');

select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.app_pages'::regclass),
  'app_pages has RLS enabled'
);

select is(
  (select count(*) from public.permissions where key like 'crm.%' or key like 'pages.%'),
  18::bigint,
  'eighteen platform and CRM permissions are seeded'
);

select is(
  (select count(*) from public.app_pages),
  21::bigint,
  'all reference CRM and initial admin pages are seeded'
);

select is(
  (
    select array_agg(r.key order by r.key)
    from public.roles r
    where (
      select count(*)
      from public.role_permissions rp
      where rp.role_key = r.key
        and rp.permission_key in (
          'pages.view',
          'crm.dashboard.view',
          'crm.stages.view',
          'crm.ranking.view',
          'crm.simulators.view'
        )
    ) = 5
  ),
  array['master']::text[],
  'only Master inherits all global v2 CRM read permissions'
);

select is(
  (
    select array_agg(distinct rp.role_key order by rp.role_key)
    from public.role_permissions rp
    where rp.permission_key in ('crm.settings.view', 'crm.settings.manage')
  ),
  array['admin', 'master']::text[],
  'Master and Admin retain the production CRM settings permissions'
);

select is(
  (
    select array_agg(rp.role_key order by rp.role_key)
    from public.role_permissions rp
    where rp.permission_key = 'crm.partnerships.view'
  ),
  array['master']::text[],
  'only master inherits the dedicated partnership permission automatically'
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
  '/app/canal-de-parcerias|Canal de Parcerias|Ranking das imobiliárias parceiras|crm|crm.partnerships.view|65|true|true',
  'the production partnership page keeps its existing dedicated gate during v3 shadow validation'
);

select is(
  (
    select string_agg(
      concat_ws('|', key, path, permission_key, coalesce(parent_key, 'root')),
      ','
      order by sort_order
    )
    from public.app_pages
    where section = 'simulation'
  ),
  'crm.simulation|/app/simulacao|crm.simulators.view|root,'
    || 'crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view|crm.simulation,'
    || 'crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view|crm.simulation,'
    || 'crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view|crm.simulation,'
    || 'crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view|crm.simulation,'
    || 'crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view|crm.simulation',
  'all simulator routes use one explicit authorized hierarchy'
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

select public.bootstrap_master_user(
  '10000000-0000-0000-0000-000000000002'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'new Auth users receive the pending role'
);

select is(
  (
    select access_status
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'new Auth users remain pending until scoped approval'
);

select ok(
  not (
    select is_active
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'new Auth users receive an inactive profile'
);

select is(
  (
    select count(*)
    from public.permissions permission
    where public.has_permission(
      '10000000-0000-0000-0000-000000000001',
      permission.key
    )
  ),
  0::bigint,
  'new Auth users receive no effective permissions before approval'
);

insert into public.crm_organizations (id, organization_key, name, kind)
values (
  '12000000-0000-4000-8000-000000000001',
  'page-catalog-real-estate',
  'Page Catalog Real Estate',
  'real_estate'
);

insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id
)
values (
  '13000000-0000-4000-8000-000000000001',
  'page-catalog-real-estate',
  'organization',
  '12000000-0000-4000-8000-000000000001'
);

update public.user_roles
set role_key = 'real_estate',
    assigned_by = '10000000-0000-0000-0000-000000000002'
where user_id = '10000000-0000-0000-0000-000000000001';

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
values (
  '10000000-0000-0000-0000-000000000001',
  '13000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'Page catalog synthetic active scope'
);

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = '10000000-0000-0000-0000-000000000002'
where user_id = '10000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select array_agg(key order by sort_order, key) from public.app_pages),
  array[
    'crm.dashboard',
    'crm.stage.opportunities',
    'crm.stage.appointments',
    'crm.stage.visits',
    'crm.stage.folders',
    'crm.stage.sales',
    'crm.ranking'
  ]::text[],
  'scoped real-estate role sees only its seven inherited production pages'
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

select set_config('request.jwt.claim.sub', '', true);

insert into public.user_permission_overrides
  (user_id, permission_key, effect, reason)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'pages.view',
    'deny',
    'RLS test'
  );

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(
  (select count(*) from public.app_pages),
  0::bigint,
  'pages.view deny override hides the navigation catalog'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);

delete from public.user_permission_overrides
where user_id = '10000000-0000-0000-0000-000000000001'
  and permission_key = 'pages.view';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select lives_ok(
  $$select public.set_app_page_active('crm.simulation.wf15', false, 'pgTAP visibility test')$$,
  'master can change page visibility through the guarded RPC'
);

select is(
  (select count(*) from public.list_app_pages_for_management()),
  21::bigint,
  'page manager RPC returns active and inactive catalog entries'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(
  (select array_agg(key order by sort_order, key) from public.app_pages),
  array[
    'crm.dashboard',
    'crm.stage.opportunities',
    'crm.stage.appointments',
    'crm.stage.visits',
    'crm.stage.folders',
    'crm.stage.sales',
    'crm.ranking'
  ]::text[],
  'scoped real-estate role remains isolated from simulator visibility changes'
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
