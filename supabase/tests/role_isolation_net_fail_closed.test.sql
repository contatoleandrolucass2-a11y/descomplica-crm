begin;

select plan(10);

select has_function(
  'private',
  'crm_qlik_relay_role_isolated',
  array[]::text[],
  'Qlik relay isolation probe exists'
);

select has_function(
  'private',
  'crm_commercial_engine_role_isolated',
  array[]::text[],
  'commercial engine isolation probe exists'
);

select ok(
  (
    select function_row.prosecdef
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
      and 'search_path=""' = any(function_row.proconfig)
    from pg_catalog.pg_proc function_row
    where function_row.oid =
      'private.crm_qlik_relay_role_isolated()'::regprocedure
  ),
  'Qlik relay probe is a postgres-owned empty-path security definer'
);

select ok(
  (
    select function_row.prosecdef
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
      and 'search_path=""' = any(function_row.proconfig)
    from pg_catalog.pg_proc function_row
    where function_row.oid =
      'private.crm_commercial_engine_role_isolated()'::regprocedure
  ),
  'commercial probe is a postgres-owned empty-path security definer'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.crm_qlik_relay_role_isolated()'::regprocedure
  ) like '%not coalesce(pg_catalog.has_schema_privilege(''crm_qlik_relay'', pg_catalog.to_regnamespace(''net''), ''USAGE''), false)%'
  and not has_function_privilege(
    'crm_qlik_relay',
    'private.crm_qlik_relay_role_isolated()',
    'EXECUTE'
  ),
  'Qlik relay probe uses a safe net schema lookup without exposing itself'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%not coalesce(pg_catalog.has_schema_privilege(''crm_commercial_engine'', pg_catalog.to_regnamespace(''net''), ''USAGE''), false)%'
  and not has_function_privilege(
    'crm_commercial_engine',
    'private.crm_commercial_engine_role_isolated()',
    'EXECUTE'
  ),
  'commercial probe uses a safe net schema lookup without exposing itself'
);

select is(
  private.crm_qlik_relay_role_isolated(),
  false,
  'Qlik relay isolation remains fail-closed under inherited capabilities'
);

select is(
  private.crm_commercial_engine_role_isolated(),
  false,
  'commercial isolation remains fail-closed under inherited capabilities'
);

select is(
  not coalesce(
    pg_catalog.has_schema_privilege(
      'crm_qlik_relay',
      pg_catalog.to_regnamespace('qa_schema_that_does_not_exist'),
      'USAGE'
    ),
    false
  ),
  true,
  'Qlik relay net predicate treats an absent schema as no inherited usage'
);

select is(
  not coalesce(
    pg_catalog.has_schema_privilege(
      'crm_commercial_engine',
      pg_catalog.to_regnamespace('qa_schema_that_does_not_exist'),
      'USAGE'
    ),
    false
  ),
  true,
  'commercial net predicate treats an absent schema as no inherited usage'
);

select * from finish();

rollback;
