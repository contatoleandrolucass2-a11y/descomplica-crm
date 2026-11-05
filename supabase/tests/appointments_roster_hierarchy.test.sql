begin;
select plan(31);
create function pg_temp.valid_ingestion_payload(
  p_request_id text,
  p_generated_at text default '2026-08-04T06:00:00Z'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 2,
    'requestId', p_request_id,
    'workflow', 'salesforce_daily',
    'dashboard', jsonb_build_object(
      'snapshotKey', 'global',
      'referenceDate', '2026-08-04',
      'generatedAt', p_generated_at,
      'timezone', 'America/Sao_Paulo',
      'source', 'pgTAP Salesforce fixture',
      'goalsAvailable', true,
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
      'rouletteAvailable', true,
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
grant execute on function pg_temp.valid_ingestion_payload(text, text)
to service_role;

select has_column('public', 'crm_ranking_participants', 'roster_manager_name');
select has_column('public', 'crm_ranking_participants', 'regional_manager_name');
select ok(not has_function_privilege('service_role', 'private.ingest_crm_salesforce_snapshot_roster_base(jsonb)', 'execute'), 'preserved primitive is private');
select ok(not has_function_privilege('anon', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'), 'anonymous callers cannot execute the new wrapper');
select ok(not has_function_privilege('authenticated', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'), 'browser users cannot execute the new wrapper');
select ok(has_function_privilege('service_role', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'), 'machine role can execute the new wrapper');
select ok(not has_function_privilege('anon', 'private.ingest_crm_salesforce_snapshot_roster_base(jsonb)', 'execute'), 'anonymous callers cannot execute the preserved base');
select ok(not has_function_privilege('authenticated', 'private.ingest_crm_salesforce_snapshot_roster_base(jsonb)', 'execute'), 'browser users cannot execute the preserved base');
select ok((select relrowsecurity from pg_class where oid = 'public.crm_ranking_participants'::regclass), 'RLS remains enabled');
create temporary table hierarchy_fixture as select jsonb_set(
  pg_temp.valid_ingestion_payload('70000000-0000-4000-8000-000000000001'),
  '{ranking,participants,0}',
  (pg_temp.valid_ingestion_payload('70000000-0000-4000-8000-000000000001') #> '{ranking,participants,0}') ||
    '{"rosterManagerName":"Gerente Oficial","regionalManagerName":"Regional A"}'::jsonb
) payload;
select is((public.ingest_crm_salesforce_snapshot((select payload from hierarchy_fixture))->>'ok'), 'true', 'enriched payload succeeds');
select is((select roster_manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Gerente Oficial', 'official manager persists');
select is((select regional_manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Regional A', 'regional person persists');
select is((select manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Gerente A', 'legacy manager is unchanged');
select is((select schedule from public.crm_ranking_participants where broker_key = 'ana-silva'), 10::bigint, 'legacy counts are unchanged');
select is((public.ingest_crm_salesforce_snapshot((select payload from hierarchy_fixture))->>'idempotent'), 'true', 'identical enriched replay remains idempotent');
select throws_ok($$select public.ingest_crm_salesforce_snapshot(jsonb_set((select payload from hierarchy_fixture), '{ranking,participants,0,regionalManagerName}', '"Regional Replay"'::jsonb))$$, '22023', 'enriched ingestion replay payload mismatch', 'changed regional is rejected on replay');
select throws_ok($$select public.ingest_crm_salesforce_snapshot(jsonb_set((select payload from hierarchy_fixture), '{dashboard,goalsAvailable}', 'false'::jsonb))$$, '22023', 'enriched ingestion replay payload mismatch', 'full payload hash covers fields removed by the base wrapper');
select ok((select roster_payload_sha256 ~ '^[0-9a-f]{64}$' from public.crm_ingestion_runs where request_key = 'ingest:70000000-0000-4000-8000-000000000001'), 'successful enriched request stores SHA256');
select is((select regional_manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Regional A', 'replay cannot rewrite hierarchy');
select throws_ok($$select public.ingest_crm_salesforce_snapshot(jsonb_set((select payload from hierarchy_fixture), '{ranking,participants,0,rosterManagerName}', 'null'::jsonb))$$, '22023', 'regional manager requires roster manager', 'invalid hierarchy rejected before mutation');
select is((select regional_manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Regional A', 'failed write preserves committed hierarchy');
create function pg_temp.reject_hierarchy_update() returns trigger language plpgsql as $$
begin
  if new.regional_manager_name = 'Reject Fixture' then
    raise exception 'forced hierarchy fixture failure' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger hierarchy_atomic_fixture before update on public.crm_ranking_participants
  for each row execute function pg_temp.reject_hierarchy_update();
select throws_ok($$select public.ingest_crm_salesforce_snapshot(
  jsonb_set(jsonb_set(jsonb_set(jsonb_set((select payload from hierarchy_fixture),
    '{requestId}', '"70000000-0000-4000-8000-000000000003"'::jsonb),
    '{ranking,generatedAt}', '"2026-08-04T08:00:00Z"'::jsonb),
    '{dashboard,generatedAt}', '"2026-08-04T08:00:00Z"'::jsonb),
    '{ranking,participants,0,regionalManagerName}', '"Reject Fixture"'::jsonb)
)$$, '22023', 'forced hierarchy fixture failure', 'post-ingest hierarchy failure rolls back the transaction');
select is((select regional_manager_name from public.crm_ranking_participants where broker_key = 'ana-silva'), 'Regional A', 'participant deletion and reinsertion rolled back');
select is((select generated_at from public.crm_ranking_snapshots where snapshot_key = 'global'), '2026-08-04T06:00:00Z'::timestamptz, 'ranking generation rolls back with hierarchy');
select is((select generated_at from public.crm_dashboard_snapshots where snapshot_key = 'global'), '2026-08-04T06:00:00Z'::timestamptz, 'dashboard generation rolls back with hierarchy');
select is((select count(*) from public.crm_ingestion_runs where request_key = 'ingest:70000000-0000-4000-8000-000000000003'), 0::bigint, 'failed post-ingest write rolls back run and hash');
drop trigger hierarchy_atomic_fixture on public.crm_ranking_participants;
select is((public.ingest_crm_salesforce_snapshot(pg_temp.valid_ingestion_payload('70000000-0000-4000-8000-000000000002', '2026-08-04T07:00:00Z'))->>'ok'), 'true', 'legacy payload still succeeds');
select ok((select roster_manager_name is null and regional_manager_name is null from public.crm_ranking_participants where broker_key = 'ana-silva'), 'legacy payload leaves hierarchy unknown');
select is((public.ingest_crm_salesforce_snapshot(jsonb_set(pg_temp.valid_ingestion_payload('70000000-0000-4000-8000-000000000002', '2026-08-04T07:00:00Z'), '{dashboard,goalsAvailable}', 'false'::jsonb))->>'idempotent'), 'true', 'legacy replay keeps its request-ID-only contract');
select throws_ok($$select public.ingest_crm_salesforce_snapshot(jsonb_set(
  pg_temp.valid_ingestion_payload('70000000-0000-4000-8000-000000000002', '2026-08-04T07:00:00Z'),
  '{ranking,participants,0,rosterManagerName}', '"Gerente Oficial"'::jsonb))$$,
  '22023', 'enriched ingestion replay payload mismatch', 'enriched replay of an old unhashed request fails closed');
select ok((select roster_manager_name is null and regional_manager_name is null from public.crm_ranking_participants where broker_key = 'ana-silva'), 'rejected upgrade of old request cannot rewrite hierarchy');
select * from finish();
rollback;


