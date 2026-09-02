begin;

select plan(11);

select is(
  (select count(*) from public.permissions where key = 'crm.simulators.view'),
  1::bigint,
  'the WF13 page permission exists'
);

select is(
  (select min_level from public.permissions where key = 'crm.simulators.view'),
  100,
  'the WF13 page gate is managed only at Master level'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.simulators.view'
  ),
  array['master']::text[],
  'only Master inherits the WF13 page permission'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.simulators.view'
      and role_key <> 'master'
  ),
  0::bigint,
  'no non-Master role inherits the WF13 page permission'
);

select is(
  (
    select count(*)
    from public.user_permission_overrides
    where permission_key = 'crm.simulators.view'
  ),
  0::bigint,
  'no direct override bypasses the Master-only page gate'
);

select is(
  (
    select concat_ws('|', path, permission_key, parent_key, is_navigation, is_active)
    from public.app_pages
    where key = 'crm.simulation.wf13'
  ),
  '/app/simulacao/associativo-fluxo-linear|crm.simulators.view|crm.simulation|t|t',
  'the WF13 catalog entry matches the guarded route'
);

select is(
  (
    select name
    from public.app_pages
    where key = 'crm.simulation.wf13'
  ),
  'Simulador Associativo',
  'the WF13 navigation entry uses the approved product name'
);

select is(
  (
    select concat_ws('|', path, permission_key, coalesce(parent_key, 'root'), is_navigation, is_active)
    from public.app_pages
    where key = 'crm.simulation'
  ),
  '/app/simulacao|crm.simulators.view|root|t|t',
  'the simulator hub is the active authorized parent'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
  ),
  array['master']::text[],
  'the independent execution gate remains Master-only'
);

select ok(
  not has_table_privilege('anon', 'public.app_pages', 'SELECT')
  and not has_table_privilege('anon', 'public.permissions', 'SELECT'),
  'anonymous callers cannot read page or permission catalogs'
);

select ok(
  not has_table_privilege('authenticated', 'public.app_pages', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.permissions', 'INSERT,UPDATE,DELETE'),
  'authenticated callers cannot mutate the authorization catalogs'
);

select * from finish();
rollback;
