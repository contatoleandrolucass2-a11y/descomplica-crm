begin;

select plan(9);

select is(
  (select pg_catalog.md5(prosrc) from pg_catalog.pg_proc
    where oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure),
  '48bcdeb5d43781cc7499b0a20e42d2fd',
  'the existing ingestion implementation remains unchanged'
);
select ok(
  not exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no implicit or explicit execution grant'
);

select is(
  (select option_value from pg_catalog.pg_proc p,
    lateral pg_catalog.pg_options_to_table(p.proconfig)
    where p.oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure
      and option_name = 'statement_timeout'),
  '30s',
  'machine ingestion has a finite thirty-second function budget'
);
select is(
  (select option_value from pg_catalog.pg_proc p,
    lateral pg_catalog.pg_options_to_table(p.proconfig)
    where p.oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure
      and option_name = 'search_path'),
  '""',
  'ingestion retains its empty search path'
);
select ok(
  (select prosecdef and proowner = 'postgres'::regrole
    from pg_catalog.pg_proc
    where oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure),
  'existing definer and owner remain unchanged'
);
select ok(
  has_function_privilege('service_role', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'),
  'machine role retains ingestion execution'
);
select ok(
  not has_function_privilege('anon', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'),
  'anonymous callers cannot use the longer ingestion budget'
);
select ok(
  not has_function_privilege('authenticated', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'),
  'signed-in browser users cannot use the longer ingestion budget'
);
select is(
  (select count(*)::integer from pg_catalog.pg_proc p,
    lateral pg_catalog.pg_options_to_table(p.proconfig)
    where p.oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure),
  2,
  'only search path and the bounded timeout are configured on ingestion'
);

select * from finish();
rollback;
