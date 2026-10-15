begin;

select plan(11);

select is(
  (select count(*) from public.permissions where key = 'crm.simulators.view'),
  1::bigint,
  'the WF13 page permission exists'
);

select is(
  (select min_level from public.permissions where key = 'crm.simulators.view'),
  10,
  'the simulator page permission has the shared operational minimum level'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.simulators.view'
  ),
  array['admin', 'broker_house', 'broker_imob', 'coordinator', 'manager_house', 'manager_imob', 'master']::text[],
  'all seven current roles inherit the simulator page permission'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.simulators.view'
      and role_key not in ('master', 'admin', 'coordinator', 'manager_house', 'manager_imob', 'broker_house', 'broker_imob')
  ),
  0::bigint,
  'pending and retired roles do not inherit the simulator page permission'
);

select is(
  (
    select count(*)
    from public.role_permissions page_permission
    where page_permission.permission_key = 'crm.simulators.view'
      and not exists (
        select 1 from public.role_permissions execution_permission
        where execution_permission.role_key = page_permission.role_key
          and execution_permission.permission_key = 'crm.simulators.execute'
      )
  ),
  0::bigint,
  'every role with simulator viewing also inherits execution'
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
  array['admin', 'broker_house', 'broker_imob', 'coordinator', 'manager_house', 'manager_imob', 'master']::text[],
  'the execution permission is inherited by the same seven current roles'
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
