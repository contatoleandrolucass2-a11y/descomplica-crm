begin;

select plan(34);

select has_table('public', 'crm_ingestion_runs', 'ingestion runs table exists');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_ingestion_runs'::regclass),
  'ingestion runs have RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.crm_ingestion_runs', 'select')
  and not has_table_privilege('authenticated', 'public.crm_ingestion_runs', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_ingestion_runs', 'update')
  and not has_table_privilege('authenticated', 'public.crm_ingestion_runs', 'delete'),
  'authenticated cannot access ingestion runs directly'
);
select ok(
  not has_table_privilege('anon', 'public.crm_ingestion_runs', 'select')
  and not has_table_privilege('anon', 'public.crm_ingestion_runs', 'insert'),
  'anon cannot access ingestion runs'
);
select ok(
  has_table_privilege('service_role', 'public.crm_ingestion_runs', 'select')
  and has_table_privilege('service_role', 'public.crm_ingestion_runs', 'insert'),
  'service role owns the machine ingestion path'
);
select ok(
  to_regclass('public.crm_ingestion_runs_kind_created_idx') is not null
  and to_regclass('public.crm_ingestion_runs_active_refresh_idx') is not null,
  'operational lookups are indexed'
);
select has_function('public', 'get_crm_sync_status', array[]::text[], 'safe status RPC exists');
select has_function(
  'public',
  'begin_crm_salesforce_refresh',
  array['text'],
  'refresh start RPC exists'
);
select has_function(
  'public',
  'finish_crm_salesforce_refresh',
  array['uuid', 'text', 'integer', 'text'],
  'refresh completion RPC exists'
);
select has_function(
  'public',
  'ingest_crm_salesforce_snapshot',
  array['jsonb'],
  'normalized ingestion RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.get_crm_sync_status()', 'execute')
  and has_function_privilege('authenticated', 'public.begin_crm_salesforce_refresh(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_crm_sync_status()', 'execute'),
  'safe browser RPC grants are explicit'
);
select ok(
  has_function_privilege('service_role', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'),
  'machine ingestion is service-role only'
);
select is((select count(*) from public.crm_ingestion_runs), 0::bigint, 'migration seeds no runs');

insert into auth.users (id, email)
values ('60000000-0000-4000-8000-000000000001', 'ingestion-admin@example.test');
update public.user_roles
set role_key = 'admin'
where user_id = '60000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (public.begin_crm_salesforce_refresh(
    'refresh:60000000-0000-4000-8000-000000000002'
  )->>'status'),
  'started',
  'authorized administrator starts a refresh'
);

reset role;
select is(
  (select count(*) from public.crm_ingestion_runs where kind = 'salesforce_refresh'),
  1::bigint,
  'refresh start creates one run'
);
select is(
  (select count(*) from public.audit_logs where action = 'crm.salesforce.refresh.requested'),
  1::bigint,
  'refresh request is audited'
);
select set_config(
  'test.refresh_run_id',
  (select id::text from public.crm_ingestion_runs
    where request_key = 'refresh:60000000-0000-4000-8000-000000000002'),
  true
);

set local role authenticated;
select is(
  (public.begin_crm_salesforce_refresh(
    'refresh:60000000-0000-4000-8000-000000000003'
  )->>'status'),
  'already_running',
  'concurrent refresh is rejected before cooldown evaluation'
);
select is(
  (public.finish_crm_salesforce_refresh(
    current_setting('test.refresh_run_id')::uuid,
    'succeeded',
    202,
    null
  )->>'status'),
  'succeeded',
  'request owner completes the refresh'
);
select is(
  (public.begin_crm_salesforce_refresh(
    'refresh:60000000-0000-4000-8000-000000000004'
  )->>'status'),
  'rate_limited',
  'per-user cooldown blocks rapid refreshes'
);
select is(
  (select refresh_status from public.get_crm_sync_status()),
  'succeeded',
  'safe status RPC exposes the latest refresh state'
);

reset role;
insert into public.user_permission_overrides (user_id, permission_key, effect, reason)
values (
  '60000000-0000-4000-8000-000000000001',
  'crm.salesforce.refresh',
  'deny',
  'ingestion permission test'
);
set local role authenticated;
select throws_ok(
  $$select public.begin_crm_salesforce_refresh(
    'refresh:60000000-0000-4000-8000-000000000005'
  )$$,
  '42501',
  'access denied',
  'deny override blocks refresh RPC'
);

reset role;
delete from public.user_permission_overrides
where user_id = '60000000-0000-4000-8000-000000000001'
  and permission_key = 'crm.salesforce.refresh';

create function pg_temp.valid_ingestion_payload(
  p_request_id text,
  p_generated_at text default '2026-08-04T06:00:00Z'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'requestId', p_request_id,
    'workflow', 'salesforce_daily',
    'dashboard', jsonb_build_object(
      'snapshotKey', 'global',
      'referenceDate', '2026-08-04',
      'generatedAt', p_generated_at,
      'timezone', 'America/Sao_Paulo',
      'source', 'pgTAP Salesforce fixture',
      'views', (
        select jsonb_agg(jsonb_build_object(
          'viewKey', view_key,
          'salesValueMonth', 100,
          'salesValueWeek', 20,
          'salesValueToday', 5
        ))
        from (values ('all'), ('with_canal_imob'), ('without_canal_imob')) v(view_key)
      ),
      'metrics', (
        select jsonb_agg(jsonb_build_object(
          'viewKey', view_key,
          'stageKey', stage_key,
          'currentMonth', 10,
          'currentWeek', 3,
          'currentToday', 1,
          'goalMonth', 20,
          'goalWeek', 5,
          'goalToday', 1,
          'previousMonth', null,
          'yearClosedMonthsAverage', null,
          'lastThreeClosedMonthsAverage', null,
          'previousFourteenDays', null,
          'lastFourteenDays', null,
          'previousSevenDays', null,
          'lastSevenDays', null,
          'previousWeek', null,
          'yesterday', null
        ))
        from (values ('all'), ('with_canal_imob'), ('without_canal_imob')) v(view_key)
        cross join (values
          ('opportunities'), ('appointments'), ('visits'), ('folders'), ('sales')
        ) s(stage_key)
      ),
      'topDevelopments', jsonb_build_array(
        jsonb_build_object('viewKey', 'all', 'rank', 1, 'name', 'Reserva', 'total', 3)
      )
    ),
    'ranking', jsonb_build_object(
      'snapshotKey', 'global',
      'referenceDate', '2026-08-04',
      'generatedAt', p_generated_at,
      'timezone', 'America/Sao_Paulo',
      'source', 'pgTAP Salesforce fixture',
      'participants', jsonb_build_array(jsonb_build_object(
        'periodKey', 'month',
        'brokerKey', 'ana-silva',
        'brokerName', 'Ana Silva',
        'managerName', 'Gerente A',
        'roulette', 2,
        'rouletteSaturday', 0,
        'rouletteSunday', 0,
        'schedule', 10,
        'visit', 5,
        'approvedFolder', 2,
        'sale', 1
      ))
    )
  );
$$;

set local role service_role;
select is(
  (public.ingest_crm_salesforce_snapshot(
    pg_temp.valid_ingestion_payload('60000000-0000-4000-8000-000000000010')
  )->>'status'),
  'succeeded',
  'service role ingests a valid normalized snapshot'
);
select is((select count(*) from public.crm_dashboard_snapshots), 1::bigint, 'ingestion creates dashboard snapshot');
select is((select count(*) from public.crm_dashboard_views), 3::bigint, 'ingestion stores all dashboard views');
select is((select count(*) from public.crm_dashboard_metrics), 15::bigint, 'ingestion stores complete metrics');
select is((select count(*) from public.crm_ranking_snapshots), 1::bigint, 'ingestion creates ranking snapshot');
select is((select count(*) from public.crm_ranking_participants), 1::bigint, 'ingestion stores ranking participant');
select is(
  (select record_count from public.crm_ingestion_runs where request_key = 'ingest:60000000-0000-4000-8000-000000000010'),
  16,
  'successful run records normalized row count'
);
select is(
  (public.ingest_crm_salesforce_snapshot(
    pg_temp.valid_ingestion_payload('60000000-0000-4000-8000-000000000010')
  )->>'idempotent'),
  'true',
  'replayed request is idempotent'
);
select is(
  (select count(*) from public.crm_ingestion_runs where kind = 'salesforce_ingest'),
  1::bigint,
  'idempotent replay does not create another run'
);
select is(
  (public.ingest_crm_salesforce_snapshot(
    pg_temp.valid_ingestion_payload(
      '60000000-0000-4000-8000-000000000011',
      '2026-08-04T05:00:00Z'
    )
  )->>'status'),
  'failed',
  'stale snapshot is rejected'
);
select is(
  (select generated_at::text from public.crm_dashboard_snapshots where snapshot_key = 'global'),
  '2026-08-04 06:00:00+00',
  'stale request cannot overwrite the current snapshot'
);
select is(
  (select status from public.crm_ingestion_runs where request_key = 'ingest:60000000-0000-4000-8000-000000000011'),
  'failed',
  'rejected ingestion leaves a sanitized operational record'
);
insert into public.crm_ingestion_runs (
  request_key, kind, status, workflow, error_code, finished_at
)
select
  'ingest:70000000-0000-4000-8000-' || lpad(series::text, 12, '0'),
  'salesforce_ingest',
  'failed',
  'rate_limit_fixture',
  'ingestion_rejected',
  now()
from generate_series(1, 18) series;
select is(
  (public.ingest_crm_salesforce_snapshot(
    pg_temp.valid_ingestion_payload('60000000-0000-4000-8000-000000000012')
  )->>'status'),
  'rate_limited',
  'machine ingestion enforces the global per-minute limit'
);

select * from finish();
rollback;
