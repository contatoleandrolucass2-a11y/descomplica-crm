begin;

select plan(9);

select is(
  (select count(*) from public.permissions where key = 'crm.partnerships.view'),
  1::bigint,
  'the dedicated partnership permission exists'
);

select is(
  (select min_level from public.permissions where key = 'crm.partnerships.view'),
  100,
  'only the Master level may manage the partnership permission'
);

select is(
  (select description from public.permissions where key = 'crm.partnerships.view'),
  'Visualizar o Canal de Parcerias',
  'the partnership permission has the approved commercial label'
);

select is(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.partnerships.view'
  ),
  array['master']::text[],
  'only Master inherits the partnership permission'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.partnerships.view'
      and role_key <> 'master'
  ),
  0::bigint,
  'no non-Master role inherits the partnership permission'
);

select is(
  (
    select count(*)
    from public.user_permission_overrides
    where permission_key = 'crm.partnerships.view'
  ),
  0::bigint,
  'no direct user override bypasses the Master-only gate'
);

select is(
  (select permission_key from public.app_pages where key = 'crm.partnerships'),
  'crm.partnerships.view',
  'the navigation catalog and route guard use the same permission'
);

select is(
  (select path from public.app_pages where key = 'crm.partnerships'),
  '/app/canal-de-parcerias',
  'the partnership route remains unchanged'
);

select is(
  (
    select concat_ws('|', is_active::text, is_navigation::text, sort_order::text)
    from public.app_pages
    where key = 'crm.partnerships'
  ),
  'true|true|65',
  'the partnership page remains active and visible only through RBAC'
);

select * from finish();
rollback;
