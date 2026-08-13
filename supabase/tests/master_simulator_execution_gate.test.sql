begin;

select plan(7);

select is(
  (select count(*) from public.permissions where key = 'crm.simulators.execute'),
  1::bigint,
  'the simulator execution permission exists'
);

select is(
  (select min_level from public.permissions where key = 'crm.simulators.execute'),
  100,
  'the simulator execution gate is managed only at Master level'
);

select is(
  (select description from public.permissions where key = 'crm.simulators.execute'),
  'Executar simuladores oficiais em validação controlada',
  'the simulator execution permission has the approved label'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
  ),
  array['master']::text[],
  'only Master inherits simulator execution'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
      and role_key <> 'master'
  ),
  0::bigint,
  'no non-Master role inherits simulator execution'
);

select is(
  (
    select count(*)
    from public.user_permission_overrides
    where permission_key = 'crm.simulators.execute'
  ),
  0::bigint,
  'no direct override bypasses the Master-only simulator gate'
);

select ok(
  not has_table_privilege('anon', 'public.permissions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.permissions', 'INSERT,UPDATE,DELETE'),
  'Data API roles cannot mutate the permission catalog'
);

select * from finish();
rollback;
