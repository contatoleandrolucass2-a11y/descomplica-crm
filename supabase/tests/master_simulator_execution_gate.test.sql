begin;

select plan(7);

select is(
  (select count(*) from public.permissions where key = 'crm.simulators.execute'),
  1::bigint,
  'the simulator execution permission exists'
);

select is(
  (select min_level from public.permissions where key = 'crm.simulators.execute'),
  10,
  'the simulator execution permission has the shared operational minimum level'
);

select is(
  (select description from public.permissions where key = 'crm.simulators.execute'),
  'Executar simuladores autorizados para o usuário',
  'the simulator execution permission has the approved label'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
  ),
  array['admin', 'broker_house', 'broker_imob', 'coordinator', 'manager_house', 'manager_imob', 'master']::text[],
  'all seven current roles inherit simulator execution'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
      and role_key not in ('master', 'admin', 'coordinator', 'manager_house', 'manager_imob', 'broker_house', 'broker_imob')
  ),
  0::bigint,
  'pending and retired roles do not inherit simulator execution'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key in ('crm.simulators.view', 'crm.simulators.execute')
      and role_key in ('master', 'admin', 'coordinator', 'manager_house', 'manager_imob', 'broker_house', 'broker_imob')
  ),
  14::bigint,
  'each current role inherits both viewing and execution'
);

select ok(
  not has_table_privilege('anon', 'public.permissions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.permissions', 'INSERT,UPDATE,DELETE'),
  'Data API roles cannot mutate the permission catalog'
);

select * from finish();
rollback;
