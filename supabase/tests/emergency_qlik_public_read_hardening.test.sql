begin;

select plan(28);

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

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or not exists (
      select 1
      from pg_catalog.pg_proc procedure
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) acl
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
        and acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ),
  'PUBLIC cannot execute the legacy publisher'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or not has_function_privilege(
      'authenticated',
      to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)'),
      'EXECUTE'
    ),
  'authenticated cannot execute the legacy publisher'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or not has_function_privilege(
      'service_role',
      to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)'),
      'EXECUTE'
    ),
  'service_role cannot execute the legacy publisher'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select procedure.proconfig = array[
        'search_path=pg_catalog, extensions, pg_temp'
      ]::text[]
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher uses an explicit safe search_path with pg_temp last'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) not like '%execute %'
        and lower(procedure.prosrc) not like '%format(%'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher contains no dynamic SQL'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) not like '%raise log%'
        and lower(procedure.prosrc) not like '%raise notice%'
        and lower(procedure.prosrc) not like '%raise info%'
        and lower(procedure.prosrc) not like '%raise debug%'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher does not log verifier or payload values'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) like '%extensions.digest(coalesce(sync_token%'
        and lower(procedure.prosrc) like '%raise exception%'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher validates the shared verifier and fails closed'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) not like '%return query%'
        and lower(procedure.prosrc) not like '%return next%'
        and pg_catalog.pg_get_function_result(procedure.oid) = 'jsonb'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher cannot return stored table rows'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) like '%public.crm_imob_ranking_runs%'
        and lower(procedure.prosrc) like '%public.crm_imob_ranking_entries%'
        and lower(procedure.prosrc) like '%public.crm_imob_ranking_developments%'
        and lower(procedure.prosrc) like '%extensions.digest%'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher schema-qualifies protected relations and digest'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select lower(procedure.prosrc) like '%insert into public.crm_imob_ranking_runs%'
        and lower(procedure.prosrc) like '%insert into public.crm_imob_ranking_entries%'
        and lower(procedure.prosrc) like '%insert into public.crm_imob_ranking_developments%'
        and lower(procedure.prosrc) like '%update public.crm_imob_ranking_runs%'
        and lower(procedure.prosrc) not like '%delete from%'
        and lower(procedure.prosrc) not like '%truncate%'
        and lower(procedure.prosrc) not like '%alter table%'
        and lower(procedure.prosrc) not like '%drop table%'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher writes only the expected ranking snapshot relations'
);

select case
  when to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    then pass('legacy publisher absent on clean local replay')
  else throws_ok(
    $$select public.publish_crm_imob_ranking('{}'::jsonb, null)$$,
    '42501',
    'invalid_sync_token',
    'legacy publisher rejects a missing verifier'
  )
end;

select case
  when to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    then pass('legacy publisher absent on clean local replay')
  else throws_ok(
    $$select public.publish_crm_imob_ranking(
      '{}'::jsonb,
      'known-invalid-value'
    )$$,
    '42501',
    'invalid_sync_token',
    'legacy publisher rejects an invalid verifier'
  )
end;

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null
    or (
      select procedure.prosecdef
        and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
      from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure(
        'public.publish_crm_imob_ranking(jsonb,text)'
      )
    ),
  'legacy publisher retains only its required definer execution model'
);

select * from finish();

rollback;
