begin;

select plan(15);

select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  ),
  18::bigint,
  'all public tables retain RLS'
);

select is(
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public'),
  17::bigint,
  'the existing policy set is preserved'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) acl
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and acl.grantee = 0
  ),
  'PUBLIC has no privileges on public tables'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (
      values
        ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privilege(name)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege('anon', c.oid, privilege.name)
  ),
  'anon has no privileges on public tables'
);

select is(
  (
    select array_agg(table_name || ':' || privilege_type order by table_name, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
  ),
  array[
    'app_pages:SELECT',
    'audit_logs:SELECT',
    'crm_dashboard_metrics:SELECT',
    'crm_dashboard_snapshots:SELECT',
    'crm_dashboard_top_developments:SELECT',
    'crm_dashboard_views:SELECT',
    'crm_funnel_goals:SELECT',
    'crm_point_metrics:SELECT',
    'crm_point_settings:SELECT',
    'crm_ranking_participants:SELECT',
    'crm_ranking_snapshots:SELECT',
    'profiles:SELECT',
    'user_permission_overrides:SELECT',
    'user_roles:SELECT'
  ]::text[],
  'authenticated receives SELECT only on directly queried tables'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (
      values
        ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
        ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privilege(name)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, privilege.name)
  ),
  'authenticated has no write or maintenance table privileges'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'service_role'
  ),
  'service_role has no direct public table privileges'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) role(name)
    cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) privilege(name)
    where n.nspname = 'public'
      and c.relkind = 'S'
      and has_sequence_privilege(role.name, c.oid, privilege.name)
  ),
  'Data API roles have no direct public sequence privileges'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute public functions'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot execute public functions'
);

select is(
  (
    select array_agg(p.proname order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  array[
    'assign_user_role',
    'begin_crm_salesforce_refresh',
    'finish_crm_salesforce_refresh',
    'get_crm_sync_status',
    'get_user_authorization_context',
    'has_permission',
    'list_app_pages_for_management',
    'remove_user_permission_override',
    'replace_crm_point_settings',
    'set_app_page_active',
    'set_user_active',
    'set_user_permission_override',
    'upsert_crm_funnel_goals'
  ]::name[],
  'authenticated can execute only the audited browser and RLS functions'
);

select is(
  (
    select array_agg(p.proname order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  array['ingest_crm_salesforce_snapshot']::name[],
  'service_role can execute only the server-side ingestion RPC'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or (
    not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')
  ),
  'rls_auto_enable is not executable by Data API roles when installed'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or exists (
    select 1
    from pg_catalog.pg_event_trigger e
    where e.evtname = 'ensure_rls'
      and e.evtfoid = to_regprocedure('public.rls_auto_enable()')
      and e.evtenabled <> 'D'
  ),
  'ensure_rls remains attached and enabled when rls_auto_enable is installed'
);

select ok(
  has_function_privilege('postgres', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.bootstrap_master_user(uuid)', 'EXECUTE'),
  'bootstrap_master_user is restricted to the documented postgres administrator path'
);

select * from finish();

rollback;
