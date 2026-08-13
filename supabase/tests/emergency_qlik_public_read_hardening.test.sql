begin;

select plan(15);

select ok(
  not has_table_privilege('anon', 'public.crm_imob_ranking_runs', 'SELECT'),
  'anon cannot select Qlik runs'
);

select ok(
  not has_table_privilege('anon', 'public.crm_imob_ranking_entries', 'SELECT'),
  'anon cannot select Qlik entries'
);

select ok(
  not has_table_privilege('anon', 'public.crm_imob_ranking_developments', 'SELECT'),
  'anon cannot select Qlik developments'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_imob_ranking_runs', 'SELECT'),
  'authenticated cannot directly select Qlik runs'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_imob_ranking_entries', 'SELECT'),
  'authenticated cannot directly select Qlik entries'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_imob_ranking_developments', 'SELECT'),
  'authenticated cannot directly select Qlik developments'
);

select ok(
  not has_table_privilege('service_role', 'public.crm_imob_ranking_runs', 'SELECT'),
  'service_role cannot directly select Qlik runs'
);

select ok(
  not has_table_privilege('service_role', 'public.crm_imob_ranking_entries', 'SELECT'),
  'service_role cannot directly select Qlik entries'
);

select ok(
  not has_table_privilege('service_role', 'public.crm_imob_ranking_developments', 'SELECT'),
  'service_role cannot directly select Qlik developments'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) acl
    left join pg_catalog.pg_roles grantee
      on grantee.oid = acl.grantee
    where namespace.nspname = 'public'
      and relation.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and (
        acl.grantee = 0
        or grantee.rolname in ('anon', 'authenticated', 'service_role')
      )
  ),
  'Data API roles and PUBLIC have no direct Qlik table privileges'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and cmd in ('SELECT', 'ALL')
  ),
  0::bigint,
  'Qlik tables expose no direct read policies'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and relation.relrowsecurity
  ),
  3::bigint,
  'all Qlik tables retain RLS'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and relation.relforcerowsecurity
  ),
  3::bigint,
  'all Qlik tables force RLS'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or has_function_privilege(
      'anon',
      to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)'),
      'EXECUTE'
    ),
  'when present, legacy Qlik publisher remains executable until relay cutover'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select procedure.prosecdef and owner_role.rolbypassrls
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_roles owner_role
        on owner_role.oid = procedure.proowner
      where procedure.oid = to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)')
    ),
  'when present, legacy publisher keeps SECURITY DEFINER owner bypass required after FORCE RLS'
);

select * from finish();

rollback;
