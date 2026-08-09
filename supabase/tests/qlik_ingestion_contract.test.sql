begin;

select plan(51);

select has_function(
  'public',
  'ingest_crm_imob_ranking_snapshot',
  array['jsonb'],
  'Qlik ingestion RPC exists'
);
select is(
  (select pg_catalog.pg_get_userbyid(functions.proowner)
   from pg_catalog.pg_proc functions
   where functions.oid =
     'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure),
  'postgres',
  'Qlik ingestion RPC is owned by postgres'
);
select ok(
  (select functions.prosecdef
      and 'search_path=""' = any(functions.proconfig)
      and 'statement_timeout=30s' = any(functions.proconfig)
   from pg_catalog.pg_proc functions
   where functions.oid =
     'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure),
  'Qlik ingestion RPC is a bounded SECURITY DEFINER with empty search path'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.ingest_crm_imob_ranking_snapshot(jsonb)',
    'EXECUTE'
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
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) acl
    where functions.oid =
      'public.ingest_crm_imob_ranking_snapshot(jsonb)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'Qlik ingestion RPC is executable only by service_role among Data API roles'
);

select has_function(
  'public',
  'list_scoped_crm_imob_ranking_entries',
  array['integer', 'integer'],
  'scoped Qlik read RPC exists'
);
select is(
  (select pg_catalog.pg_get_userbyid(functions.proowner)
   from pg_catalog.pg_proc functions
   where functions.oid =
     'public.list_scoped_crm_imob_ranking_entries(integer,integer)'::regprocedure),
  'postgres',
  'scoped Qlik read RPC is owned by postgres'
);
select ok(
  (select functions.prosecdef
      and 'search_path=""' = any(functions.proconfig)
      and 'statement_timeout=10s' = any(functions.proconfig)
   from pg_catalog.pg_proc functions
   where functions.oid =
     'public.list_scoped_crm_imob_ranking_entries(integer,integer)'::regprocedure),
  'scoped Qlik read RPC is a bounded SECURITY DEFINER with empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.list_scoped_crm_imob_ranking_entries(integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.list_scoped_crm_imob_ranking_entries(integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.list_scoped_crm_imob_ranking_entries(integer,integer)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) acl
    where functions.oid =
      'public.list_scoped_crm_imob_ranking_entries(integer,integer)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'scoped Qlik read RPC is executable only by authenticated among Data API roles'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null,
  'legacy token-in-argument Qlik function is absent'
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
      and tables.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and acl.grantee = 0
  ),
  'PUBLIC has no privileges on Qlik tables'
);
select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
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
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
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
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
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
  (select count(*)
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename in (
       'crm_imob_ranking_runs',
       'crm_imob_ranking_entries',
       'crm_imob_ranking_developments'
     )),
  0::bigint,
  'Qlik tables expose zero direct-table policies'
);
select ok(
  (select bool_and(relrowsecurity and relforcerowsecurity)
   from pg_catalog.pg_class
   where oid in (
     'public.crm_imob_ranking_runs'::regclass,
     'public.crm_imob_ranking_entries'::regclass,
     'public.crm_imob_ranking_developments'::regclass
   )),
  'all Qlik tables enable and force RLS'
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
  'developments', (select count(*) from public.crm_imob_ranking_developments),
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
  ),
  'developmentsHash', (
    select md5(coalesce(string_agg(
      to_jsonb(developments)::text,
      '|' order by developments.run_id,
                   developments.period_month,
                   developments.business_unit,
                   developments.development_key
    ), ''))
    from public.crm_imob_ranking_developments developments
  )
) as state;

revoke all privileges on table
  public.crm_imob_ranking_runs,
  public.crm_imob_ranking_entries,
  public.crm_imob_ranking_developments
from public, anon, authenticated, service_role;

select is(
  jsonb_build_object(
    'runs', (select count(*) from public.crm_imob_ranking_runs),
    'entries', (select count(*) from public.crm_imob_ranking_entries),
    'developments', (select count(*) from public.crm_imob_ranking_developments),
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
    ),
    'developmentsHash', (
      select md5(coalesce(string_agg(
        to_jsonb(developments)::text,
        '|' order by developments.run_id,
                     developments.period_month,
                     developments.business_unit,
                     developments.development_key
      ), ''))
      from public.crm_imob_ranking_developments developments
    )
  ),
  (select state from qlik_data_before_normalization),
  'grant normalization preserves every existing Qlik row'
);

create function pg_temp.valid_qlik_payload(
  p_request_id text,
  p_include_developments boolean default true
)
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
      ),
      jsonb_build_object(
        'periodMonth', '2026-07-01',
        'imobKey', 'imobiliaria-sem-mapeamento-33333333',
        'imobName', 'Imobiliaria Sem Mapeamento',
        'vgv', 50000,
        'contracts', 1,
        'sourceRankVgv', 3,
        'sourceRankContracts', 3
      )
    )
  ) || case when p_include_developments then jsonb_build_object(
    'developments', jsonb_build_array(
      jsonb_build_object(
        'periodMonth', '2026-07-01',
        'businessUnit', 'SP CAPITAL',
        'developmentKey', 'development-a-11111111',
        'developmentName', 'Development A',
        'vgv', 222222.22,
        'contracts', 4,
        'sourceRankVgv', 1,
        'sourceRankContracts', 1
      )
    )
  ) else '{}'::jsonb end;
$$;

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000001')
  )->>'status'),
  'succeeded',
  'service_role stores entries and optional developments atomically'
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
      and row_count = 3
      and development_row_count = 1
      and completed_at is not null
  ),
  'Qlik RPC fixes trusted metadata and records both batch counts'
);
select is(
  (select count(*) from public.crm_imob_ranking_entries
   where run_id = '70000000-0000-4000-8000-000000000001'),
  3::bigint,
  'Qlik RPC stores the complete partner entry batch'
);
select is(
  (select count(*) from public.crm_imob_ranking_developments
   where run_id = '70000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Qlik RPC stores the optional development batch'
);
select is(
  (select jsonb_build_object(
     'businessUnit', business_unit,
     'developmentKey', development_key,
     'vgv', vgv,
     'contracts', contracts
   )
   from public.crm_imob_ranking_developments
   where run_id = '70000000-0000-4000-8000-000000000001'),
  jsonb_build_object(
    'businessUnit', 'SP CAPITAL',
    'developmentKey', 'development-a-11111111',
    'vgv', 222222.22,
    'contracts', 4
  ),
  'Qlik RPC stores development source facts without deriving values'
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
  (select count(*) from public.crm_imob_ranking_entries
   where run_id = '70000000-0000-4000-8000-000000000001'),
  3::bigint,
  'idempotent replay creates no duplicate partner entries'
);
select is(
  (select count(*) from public.crm_imob_ranking_developments
   where run_id = '70000000-0000-4000-8000-000000000001'),
  1::bigint,
  'idempotent replay creates no duplicate development entries'
);

set local role service_role;
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000001'),
      '{developments,0,vgv}',
      '999999'::jsonb
    )
  )$$,
  '23505',
  'Qlik request ID conflict',
  'a changed development payload cannot reuse a completed request ID'
);
reset role;
select is(
  (select vgv from public.crm_imob_ranking_entries
   where run_id = '70000000-0000-4000-8000-000000000001'
     and imob_key = 'imobiliaria-a-11111111'),
  123456.78::numeric,
  'a conflicting replay cannot mutate stored partner data'
);
select is(
  (select vgv from public.crm_imob_ranking_developments
   where run_id = '70000000-0000-4000-8000-000000000001'
     and development_key = 'development-a-11111111'),
  222222.22::numeric,
  'a conflicting replay cannot mutate stored development data'
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
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000004'),
      '{padding}',
      to_jsonb(repeat('x', 8 * 1024 * 1024))
    )
  )$$,
  '22023',
  'invalid Qlik ingestion envelope',
  'a Qlik payload larger than 8 MiB fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000005'),
      '{entries,0,imobKey}',
      to_jsonb(repeat('a', 129))
    )
  )$$,
  '22023',
  'invalid Qlik ranking entry',
  'a partner key longer than 128 characters fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000006'),
      '{entries,0,imobName}',
      to_jsonb(repeat('a', 257))
    )
  )$$,
  '22023',
  'invalid Qlik ranking entry',
  'a partner name longer than 256 characters fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000007'),
      '{entries,0,vgv}',
      '123.456'::jsonb
    )
  )$$,
  '22023',
  'invalid Qlik ranking entry',
  'partner VGV with scale above two fails instead of rounding'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000008'),
      '{entries,0,vgv}',
      '10000000000000000'::jsonb
    )
  )$$,
  '22023',
  'invalid Qlik ranking entry',
  'partner VGV above numeric(18,2) magnitude fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000009'),
      '{developments,0,businessUnit}',
      to_jsonb(repeat('a', 129))
    )
  )$$,
  '22023',
  'invalid Qlik development entry',
  'a business unit longer than 128 characters fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000010'),
      '{developments,0,developmentKey}',
      to_jsonb(repeat('a', 129))
    )
  )$$,
  '22023',
  'invalid Qlik development entry',
  'a development key longer than 128 characters fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000011'),
      '{developments,0,developmentName}',
      to_jsonb(repeat('a', 257))
    )
  )$$,
  '22023',
  'invalid Qlik development entry',
  'a development name longer than 256 characters fails closed'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000012'),
      '{developments,0,vgv}',
      '222.222'::jsonb
    )
  )$$,
  '22023',
  'invalid Qlik development entry',
  'development VGV with scale above two fails instead of rounding'
);
select throws_ok(
  $$select public.ingest_crm_imob_ranking_snapshot(
    jsonb_set(
      pg_temp.valid_qlik_payload('70000000-0000-4000-8000-000000000013'),
      '{developments,0,vgv}',
      '10000000000000000'::jsonb
    )
  )$$,
  '22023',
  'invalid Qlik development entry',
  'development VGV above numeric(18,2) magnitude fails closed'
);
reset role;
select ok(
  not exists (
    select 1 from public.crm_imob_ranking_runs
    where id in (
      '70000000-0000-4000-8000-000000000002',
      '70000000-0000-4000-8000-000000000004',
      '70000000-0000-4000-8000-000000000005',
      '70000000-0000-4000-8000-000000000006',
      '70000000-0000-4000-8000-000000000007',
      '70000000-0000-4000-8000-000000000008',
      '70000000-0000-4000-8000-000000000009',
      '70000000-0000-4000-8000-000000000010',
      '70000000-0000-4000-8000-000000000011',
      '70000000-0000-4000-8000-000000000012',
      '70000000-0000-4000-8000-000000000013'
    )
  ),
  'rejected Qlik payloads leave no partial runs'
);
select is(
  (select count(*)
   from public.crm_imob_ranking_entries entries
   where entries.run_id = '70000000-0000-4000-8000-000000000001'),
  (select row_count::bigint from public.crm_imob_ranking_runs
   where id = '70000000-0000-4000-8000-000000000001'),
  'completed Qlik run count reconciles with its partner entries'
);
select is(
  (select count(*)
   from public.crm_imob_ranking_developments developments
   where developments.run_id = '70000000-0000-4000-8000-000000000001'),
  (select development_row_count::bigint from public.crm_imob_ranking_runs
   where id = '70000000-0000-4000-8000-000000000001'),
  'completed Qlik run count reconciles with its development entries'
);

insert into auth.users (id, email)
values
  ('71000000-0000-4000-8000-000000000001', 'qlik-scoped@example.test'),
  ('71000000-0000-4000-8000-000000000002', 'qlik-no-permission@example.test'),
  ('71000000-0000-4000-8000-000000000003', 'qlik-no-scope@example.test');

insert into public.crm_organizations (id, organization_key, name, kind)
values
  (
    '72000000-0000-4000-8000-000000000001',
    'qlik-organization-a',
    'Qlik Organization A',
    'real_estate'
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    'qlik-organization-b',
    'Qlik Organization B',
    'real_estate'
  );
insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id
)
values
  (
    '73000000-0000-4000-8000-000000000001',
    'qlik-organization-a',
    'organization',
    '72000000-0000-4000-8000-000000000001'
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    'qlik-organization-b',
    'organization',
    '72000000-0000-4000-8000-000000000002'
  );

update public.user_roles
set role_key = 'admin'
where user_id in (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000003'
);

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
values
  (
    '71000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'Synthetic organization A Qlik scope'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'Synthetic scope without Qlik permission'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001',
    'Synthetic scope revoked before Qlik read'
  );

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now()
where user_id in (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000003'
);

update public.crm_user_reporting_scope_grants
set revoked_at = now(),
    revoked_by = '71000000-0000-4000-8000-000000000001',
    revocation_reason = 'Synthetic revoked scope for fail-closed Qlik read'
where user_id = '71000000-0000-4000-8000-000000000003';

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason
)
values
  (
    '71000000-0000-4000-8000-000000000001',
    'crm.partnerships.view',
    'allow',
    'Synthetic scoped Qlik reader'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    'crm.partnerships.view',
    'allow',
    'Synthetic Qlik reader without active scope'
  );

insert into public.crm_source_identities (
  source,
  entity_kind,
  external_id,
  organization_id
)
values
  (
    'qlik',
    'organization',
    'imobiliaria-a-11111111',
    '72000000-0000-4000-8000-000000000001'
  ),
  (
    'qlik',
    'organization',
    'imobiliaria-b-22222222',
    '72000000-0000-4000-8000-000000000002'
  );

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  (select count(*) from public.list_scoped_crm_imob_ranking_entries()),
  1::bigint,
  'authorized reader receives only one mapped in-scope Qlik row'
);
select is(
  (select organization_id
   from public.list_scoped_crm_imob_ranking_entries()
   limit 1),
  '72000000-0000-4000-8000-000000000001'::uuid,
  'scoped Qlik RPC binds each returned row to its mapped organization'
);
select is(
  (select array_agg(imob_key order by imob_key)
   from public.list_scoped_crm_imob_ranking_entries()),
  array['imobiliaria-a-11111111']::text[],
  'out-of-scope mappings and unmapped Qlik identities remain unavailable'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.list_scoped_crm_imob_ranking_entries()),
  0::bigint,
  'scope without crm.partnerships.view returns no Qlik data'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.list_scoped_crm_imob_ranking_entries()),
  0::bigint,
  'crm.partnerships.view without reporting scope returns no Qlik data'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.list_scoped_crm_imob_ranking_entries(501, 0)$$,
  '22023',
  'invalid Qlik read pagination',
  'scoped Qlik read RPC rejects unbounded pagination'
);
reset role;

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.valid_qlik_payload(
      '70000000-0000-4000-8000-000000000003',
      false
    )
  )->>'status'),
  'succeeded',
  'schemaVersion 1 remains valid when developments are omitted'
);
reset role;
select is(
  (select development_row_count from public.crm_imob_ranking_runs
   where id = '70000000-0000-4000-8000-000000000003'),
  0,
  'omitted developments record a zero development count'
);
select is(
  (select count(*) from public.crm_imob_ranking_developments
   where run_id = '70000000-0000-4000-8000-000000000003'),
  0::bigint,
  'omitted developments create no development rows'
);

select * from finish();

rollback;
