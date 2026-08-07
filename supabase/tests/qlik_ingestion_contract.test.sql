begin;

select plan(23);

select has_function(
  'public',
  'ingest_crm_imob_ranking_snapshot',
  array['jsonb'],
  'Qlik ingestion RPC exists'
);

select is(
  (
    select pg_catalog.pg_get_userbyid(p.proowner)
    from pg_catalog.pg_proc p
    where p.oid = 'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure
  ),
  'postgres',
  'Qlik ingestion RPC is owned by postgres'
);

select ok(
  (
    select p.prosecdef
      and 'search_path=""' = any(p.proconfig)
      and 'statement_timeout=30s' = any(p.proconfig)
    from pg_catalog.pg_proc p
    where p.oid = 'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure
  ),
  'Qlik ingestion RPC is a bounded SECURITY DEFINER with an empty search path'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.ingest_crm_imob_ranking_snapshot(jsonb)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) acl
    where functions.oid = 'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.ingest_crm_imob_ranking_snapshot(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.ingest_crm_imob_ranking_snapshot(jsonb)',
    'EXECUTE'
  ),
  'Qlik ingestion RPC is executable only by service_role among Data API roles'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class tables
    join pg_catalog.pg_namespace schemas on schemas.oid = tables.relnamespace
    cross join lateral aclexplode(
      coalesce(tables.relacl, acldefault('r', tables.relowner))
    ) acl
    where schemas.nspname = 'public'
      and tables.relname in ('crm_imob_ranking_runs', 'crm_imob_ranking_entries')
      and acl.grantee = 0
  ),
  'PUBLIC has no privileges on Qlik tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'anon',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'anon has no Qlik table privileges'
);

select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'authenticated has no Qlik table privileges'
);

select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'service_role',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'service_role has no direct Qlik table privileges'
);

select is(
  (
    select roles
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_runs'
      and policyname = 'crm_imob_ranking_runs_select_completed'
  ),
  array['authenticated']::name[],
  'Qlik run policy excludes anon'
);

select is(
  (
    select roles
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_entries'
      and policyname = 'crm_imob_ranking_entries_select_completed'
  ),
  array['authenticated']::name[],
  'Qlik entry policy excludes anon'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class
   where oid = 'public.crm_imob_ranking_runs'::regclass)
  and (select relrowsecurity from pg_catalog.pg_class
       where oid = 'public.crm_imob_ranking_entries'::regclass),
  'both Qlik tables retain RLS'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_default_acl defaults
    join pg_catalog.pg_namespace schemas on schemas.oid = defaults.defaclnamespace
    cross join lateral aclexplode(defaults.defaclacl) acl
    where pg_catalog.pg_get_userbyid(defaults.defaclrole) = 'postgres'
      and schemas.nspname = 'public'
      and (
        acl.grantee = 0
        or pg_catalog.pg_get_userbyid(acl.grantee) in (
          'anon', 'authenticated', 'service_role'
        )
      )
  ),
  'postgres default privileges remain fail-closed'
);

create temporary table qlik_data_before_normalization on commit drop as
select jsonb_build_object(
  'runs', (select count(*) from public.crm_imob_ranking_runs),
  'entries', (select count(*) from public.crm_imob_ranking_entries),
  'runsHash', (
    select md5(coalesce(string_agg(to_jsonb(runs)::text, '|' order by runs.id), ''))
    from public.crm_imob_ranking_runs runs
  ),
  'entriesHash', (
    select md5(coalesce(string_agg(
      to_jsonb(entries)::text,
      '|' order by entries.run_id, entries.period_month, entries.imob_key
    ), ''))
    from public.crm_imob_ranking_entries entries
  )
) as state;

revoke all privileges on table
  public.crm_imob_ranking_runs,
  public.crm_imob_ranking_entries
from public, anon, authenticated, service_role;
alter policy crm_imob_ranking_runs_select_completed
  on public.crm_imob_ranking_runs to authenticated;
alter policy crm_imob_ranking_entries_select_completed
  on public.crm_imob_ranking_entries to authenticated;

select is(
  jsonb_build_object(
    'runs', (select count(*) from public.crm_imob_ranking_runs),
    'entries', (select count(*) from public.crm_imob_ranking_entries),
    'runsHash', (
      select md5(coalesce(string_agg(to_jsonb(runs)::text, '|' order by runs.id), ''))
      from public.crm_imob_ranking_runs runs
    ),
    'entriesHash', (
      select md5(coalesce(string_agg(
        to_jsonb(entries)::text,
        '|' order by entries.run_id, entries.period_month, entries.imob_key
      ), ''))
      from public.crm_imob_ranking_entries entries
    )
  ),
  (select state from qlik_data_before_normalization),
  'grant and policy normalization preserves every existing Qlik row'
);

create function pg_temp.valid_qlik_payload(p_request_id text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'requestId', p_request_id,
    'referenceYear', 2026,
    'generatedAt', '2026-08-07T12:00:00Z',
    'sourceUpdatedAt', '2026-08-07T11:55:00Z',
    'entries', jsonb_build_array(
      jsonb_build_object(
        'periodMonth', '2026-07-01',
        'imobKey', 'imobiliaria-a-11111111',
        'imobName', 'Imobiliaria A',
        'vgv', 123456.78,
        'contracts', 2,
        'sourceRankVgv', 1,
        'sourceRankContracts', 2
      ),
      jsonb_build_object(
        'periodMonth', '2026-07-01',
        'imobKey', 'imobiliaria-b-22222222',
        'imobName', 'Imobiliaria B',
        'vgv', 98765.43,
        'contracts', 3,
        'sourceRankVgv', 2,
        'sourceRankContracts', 1
      )
    )
  );
$$;

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000001')
  )->>'status'),
  'succeeded',
  'service_role stores a valid Qlik snapshot atomically'
);
reset role;

select ok(
  exists (
    select 1
    from public.crm_imob_ranking_runs
    where id = '70000000-0000-4000-8000-000000000001'
      and status = 'succeeded'
      and source = 'qlik'
      and regional = 'SP CAPITAL'
      and company = 'Direcional'
      and row_count = 2
      and completed_at is not null
  ),
  'Qlik RPC fixes trusted source metadata and completes the run'
);

select is(
  (
    select count(*)
    from public.crm_imob_ranking_entries
    where run_id = '70000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'Qlik RPC stores the complete entry batch'
);

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000001')
  )->>'idempotent'),
  'true',
  'an exact Qlik snapshot replay is idempotent'
);
reset role;

select is(
  (
    select count(*)
    from public.crm_imob_ranking_entries
    where run_id = '70000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'idempotent replay creates no duplicate entries'
);

set local role service_role;
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000001'),
      '{entries,0,vgv}',
      '999999'::jsonb
    )
  )$$,
  '23505',
  'Qlik request ID conflict',
  'a changed payload cannot reuse a completed request ID'
);
reset role;

select is(
  (
    select vgv
    from public.crm_imob_ranking_entries
    where run_id = '70000000-0000-4000-8000-000000000001'
      and imob_key = 'imobiliaria-a-11111111'
  ),
  123456.78::numeric,
  'a conflicting replay cannot mutate stored Qlik data'
);

set local role service_role;
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    '{"schemaVersion":1,"requestId":"70000000-0000-4000-8000-000000000002"}'::jsonb
  )$$,
  '22023',
  'invalid Qlik ingestion envelope',
  'an incomplete Qlik payload fails closed'
);
reset role;

select ok(
  not exists (
    select 1
    from public.crm_imob_ranking_runs
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  'a rejected Qlik payload leaves no partial run'
);

select is(
  (
    select count(*)
    from public.crm_imob_ranking_entries entries
    join public.crm_imob_ranking_runs runs on runs.id = entries.run_id
    where runs.status = 'succeeded'
      and runs.id = '70000000-0000-4000-8000-000000000001'
  ),
  (
    select row_count::bigint
    from public.crm_imob_ranking_runs
    where id = '70000000-0000-4000-8000-000000000001'
  ),
  'completed Qlik run count reconciles with its entries'
);

select * from finish();

rollback;
