begin;
select no_plan();

select has_table('public', 'crm_dashboard_analysis', 'packed analysis table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.crm_dashboard_analysis'::regclass),
  'analysis has RLS enabled');
select ok(
  has_table_privilege('authenticated', 'public.crm_dashboard_analysis', 'select')
  and not has_table_privilege('authenticated', 'public.crm_dashboard_analysis', 'insert,update,delete,truncate,references,trigger'),
  'authenticated has SELECT only'
);
select ok(not has_table_privilege(role_name, 'public.crm_dashboard_analysis', 'select,insert,update,delete,truncate,references,trigger'),
  role_name || ' has no direct table privilege')
from unnest(array['anon', 'service_role']) role_name;
select ok(not exists (
  select 1 from pg_class c, lateral aclexplode(c.relacl) a
  where c.oid = 'public.crm_dashboard_analysis'::regclass and a.grantee = 0
), 'PUBLIC has no table privileges');
select ok(has_function_privilege('service_role', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.ingest_crm_salesforce_snapshot(jsonb)', 'execute'),
  'only service_role reaches the public ingestion RPC');
select ok(not has_function_privilege(role_name, 'private.ingest_crm_salesforce_snapshot_v2_internal(jsonb)', 'execute')
  and not has_function_privilege(role_name, 'private.validate_crm_dashboard_analysis(jsonb,text)', 'execute'),
  role_name || ' cannot bypass the public wrapper')
from unnest(array['anon', 'authenticated', 'service_role']) role_name;
select ok((select prosecdef and proconfig @> array['search_path=""']
  from pg_proc where oid = 'public.ingest_crm_salesforce_snapshot(jsonb)'::regprocedure),
  'public wrapper is SECURITY DEFINER with empty search_path');

create function pg_temp.analysis_fixture()
returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1, 'coverageStart', '2026-01-01', 'referenceDate', '2026-08-04',
    'views', (select jsonb_agg(jsonb_build_object(
      'viewKey', view_key,
      'dimensions', jsonb_build_object(
        'managers', jsonb_build_array('Synthetic manager'),
        'owners', jsonb_build_array('Synthetic owner'),
        'companies', jsonb_build_array('Synthetic company'),
        'developments', jsonb_build_array('Synthetic development')
      ),
      'facts', jsonb_build_array(
        jsonb_build_array(3, '2026-08-04', 0, 0, 0, channel, 0, 2, 0, 1),
        jsonb_build_array(4, '2026-08-04', -1, -1, -1, channel, -1, 1, 100, 0)
      )
    ) order by view_key)
    from (values ('all',0), ('with_canal_imob',0), ('without_canal_imob',1)) v(view_key,channel))
  );
$$;

create function pg_temp.analysis_payload(
  p_request_id text default 'ac000000-0000-4000-8000-000000000001',
  p_generated_at text default '2026-08-04T06:00:00Z'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', 2, 'requestId', p_request_id, 'workflow', 'analysis_test',
    'dashboard', jsonb_build_object(
      'snapshotKey', 'analysis-test', 'referenceDate', '2026-08-04',
      'generatedAt', p_generated_at, 'timezone', 'America/Sao_Paulo',
      'source', 'synthetic pgTAP analysis', 'goalsAvailable', false,
      'analysis', pg_temp.analysis_fixture(),
      'views', (select jsonb_agg(jsonb_build_object(
        'viewKey', v, 'salesValueMonth', 100, 'salesValueWeek', 100, 'salesValueToday', 100
      )) from unnest(array['all','with_canal_imob','without_canal_imob']) v),
      'metrics', (select jsonb_agg(jsonb_build_object(
        'viewKey', v, 'stageKey', s, 'currentMonth', 1, 'currentWeek', 1, 'currentToday', 1,
        'goalMonth', 0, 'goalWeek', 0, 'goalToday', 0,
        'previousMonth', null, 'yearClosedMonthsAverage', null, 'lastThreeClosedMonthsAverage', null,
        'previousFourteenDays', null, 'lastFourteenDays', null,
        'previousSevenDays', null, 'lastSevenDays', null, 'previousWeek', null, 'yesterday', null
      )) from unnest(array['all','with_canal_imob','without_canal_imob']) v
      cross join unnest(array['opportunities','appointments','visits','folders','sales']) s),
      'topDevelopments', '[]'::jsonb
    ),
    'ranking', jsonb_build_object(
      'snapshotKey', 'analysis-test', 'referenceDate', '2026-08-04',
      'generatedAt', p_generated_at, 'timezone', 'America/Sao_Paulo',
      'source', 'synthetic pgTAP analysis', 'rouletteAvailable', false,
      'participants', jsonb_build_array(jsonb_build_object(
        'periodKey', 'month', 'brokerKey', 'synthetic-owner', 'brokerName', 'Synthetic owner',
        'managerName', 'Synthetic manager', 'roulette', 0, 'rouletteSaturday', 0,
        'rouletteSunday', 0, 'schedule', 2, 'visit', 1, 'approvedFolder', 1, 'sale', 1
      ))
    )
  );
$$;
grant execute on function pg_temp.analysis_fixture(), pg_temp.analysis_payload(text,text) to service_role;

select lives_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"2025-05-01"'), '2026-08-04'
)$$, 'coverage exactly fifteen months before the reference month is accepted');

set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload())->>'status', 'succeeded',
  'machine RPC applies analysis with the v2 base');
select throws_ok('select * from public.crm_dashboard_analysis', '42501', null,
  'service_role cannot directly read analysis');
select throws_ok('delete from public.crm_dashboard_analysis', '42501', null,
  'service_role cannot directly delete analysis');
reset role;

select is((select count(*) from public.crm_dashboard_analysis), 3::bigint, 'three packed view rows stored');
select ok(not exists(
  select 1 from public.crm_dashboard_analysis a
  join public.crm_dashboard_snapshots s on s.id = a.snapshot_id
  where a.payload <> (select v || jsonb_build_object(
    'version',1,'coverageStart','2026-01-01','referenceDate','2026-08-04'
  ) from jsonb_array_elements(pg_temp.analysis_fixture()->'views') v where v->>'viewKey' = a.view_key)
    or a.payload->>'referenceDate' <> s.reference_date::text
    or a.payload ? 'views' or a.payload ? 'ranking'
), 'each row has the exact per-view shape and matching snapshot metadata');

create function pg_temp.analysis_state()
returns jsonb language sql as $$
  select jsonb_build_object(
    'dashboard', (select jsonb_agg(to_jsonb(s) order by s.id) from public.crm_dashboard_snapshots s),
    'views', (select jsonb_agg(to_jsonb(s) order by s.snapshot_id,s.view_key) from public.crm_dashboard_views s),
    'metrics', (select jsonb_agg(to_jsonb(s) order by s.snapshot_id,s.view_key,s.stage_key) from public.crm_dashboard_metrics s),
    'analysis', (select jsonb_agg(to_jsonb(s) order by s.snapshot_id,s.view_key) from public.crm_dashboard_analysis s),
    'ranking', (select jsonb_agg(to_jsonb(s) order by s.id) from public.crm_ranking_snapshots s),
    'participants', (select jsonb_agg(to_jsonb(s) order by s.snapshot_id,s.period_key,s.broker_key) from public.crm_ranking_participants s),
    'runs', (select count(*) from public.crm_ingestion_runs),
    'audit', (select count(*) from public.audit_logs)
  );
$$;
create temporary table original_analysis_state as select pg_temp.analysis_state() as value;

set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(pg_temp.analysis_payload(),
  '{dashboard,analysis,views,0,facts,0,7}', '99'))->>'idempotent', 'true',
  'replay with altered analysis remains a no-op');
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(pg_temp.analysis_payload(),
  '{dashboard,analysis}', 'null'))->>'idempotent', 'true',
  'replay does not reinterpret even a malformed extension');
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload() #- '{dashboard,analysis}')->>'idempotent', 'true',
  'legacy replay cannot clear analysis');
reset role;
select is(pg_temp.analysis_state(), (select value from original_analysis_state),
  'replay preserves base, analysis, ranking, runs and audit');

-- All malformed extensions use a fresh request with newer base data. Failure
-- must undo the successful inner v2 write as well as its audit/run records.
create temporary table malformed_analysis (description text, payload jsonb);
insert into malformed_analysis values
  ('null extension', 'null'),
  ('array extension', '[]'),
  ('unknown extension key', pg_temp.analysis_fixture() || '{"ranking":[]}'),
  ('string version', jsonb_set(pg_temp.analysis_fixture(), '{version}', '"1"')),
  ('unsupported version', jsonb_set(pg_temp.analysis_fixture(), '{version}', '2')),
  ('missing version', pg_temp.analysis_fixture() - 'version'),
  ('numeric coverage', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '20260101')),
  ('invalid calendar date', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"2026-02-30"')),
  ('non-first coverage day', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"2026-01-02"')),
  ('reversed coverage', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"2026-09-01"')),
  ('coverage exceeds fifteen months', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"2025-04-01"')),
  ('ancient coverage is rejected', jsonb_set(pg_temp.analysis_fixture(), '{coverageStart}', '"0001-01-01"')),
  ('snapshot reference mismatch', jsonb_set(pg_temp.analysis_fixture(), '{referenceDate}', '"2026-08-05"')),
  ('null reference', jsonb_set(pg_temp.analysis_fixture(), '{referenceDate}', 'null')),
  ('non-array views', jsonb_set(pg_temp.analysis_fixture(), '{views}', '{}')),
  ('missing view', jsonb_set(pg_temp.analysis_fixture(), '{views}', (pg_temp.analysis_fixture()->'views') - 2)),
  ('duplicate views', jsonb_set(pg_temp.analysis_fixture(), '{views,2}', pg_temp.analysis_fixture()#>'{views,0}')),
  ('unknown view', jsonb_set(pg_temp.analysis_fixture(), '{views,0,viewKey}', '"other"')),
  ('non-object view', jsonb_set(pg_temp.analysis_fixture(), '{views,0}', 'null')),
  ('unknown view key', jsonb_set(pg_temp.analysis_fixture(), '{views,0,ranking}', '[]')),
  ('unknown dictionary', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,ranking}', '[]')),
  ('missing dictionary', pg_temp.analysis_fixture() #- '{views,0,dimensions,owners}'),
  ('non-array dictionary', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners}', '{}')),
  ('null dictionary label', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners,0}', 'null')),
  ('empty dictionary label', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners,0}', '"  "')),
  ('whitespace dictionary label', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners,0}', to_jsonb(E'\t\n'))),
  ('long dictionary label', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners,0}', to_jsonb(repeat('x',201)))),
  ('duplicate dictionary labels', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners}', '["Owner","Owner"]')),
  ('oversized dictionary', jsonb_set(pg_temp.analysis_fixture(), '{views,0,dimensions,owners}',
    (select jsonb_agg('Owner ' || i) from generate_series(1,10001) i))),
  ('non-array facts', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts}', '{}')),
  ('non-array fact', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts,0}', '{}')),
  ('short tuple', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts,0}', (pg_temp.analysis_fixture()#>'{views,0,facts,0}') - 9)),
  ('long tuple', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts,0}', (pg_temp.analysis_fixture()#>'{views,0,facts,0}') || '0')),
  ('duplicate fact key with different counts', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts}',
    jsonb_build_array(pg_temp.analysis_fixture()#>'{views,0,facts,0}',
      jsonb_set(pg_temp.analysis_fixture()#>'{views,0,facts,0}', '{7}', '99')))),
  ('oversized fact array', jsonb_set(pg_temp.analysis_fixture(), '{views,0,facts}',
    (select jsonb_agg('[4,"2026-08-04",-1,-1,-1,0,-1,1,0,0]'::jsonb) from generate_series(1,100001))));
insert into malformed_analysis
select description, jsonb_set(pg_temp.analysis_fixture(), array['views','0','facts','0',position::text], value)
from (values
  ('stage too large',0,'5'::jsonb), ('fractional stage',0,'0.5'::jsonb),
  ('invalid fact date',1,'"2026-02-30"'::jsonb), ('before coverage',1,'"2025-12-31"'::jsonb),
  ('after reference',1,'"2026-08-05"'::jsonb), ('non-string date',1,'20260804'::jsonb),
  ('manager below sentinel',2,'-2'::jsonb), ('manager out of bounds',2,'1'::jsonb),
  ('owner out of bounds',3,'1'::jsonb), ('company out of bounds',4,'1'::jsonb),
  ('unknown channel',5,'2'::jsonb), ('negative channel',5,'-1'::jsonb),
  ('development out of bounds',6,'1'::jsonb), ('fractional index',6,'0.5'::jsonb),
  ('zero count',7,'0'::jsonb), ('negative count',7,'-1'::jsonb),
  ('excessive count',7,'1000000001'::jsonb), ('fractional count',7,'1.5'::jsonb),
  ('string count',7,'"1"'::jsonb), ('null count',7,'null'::jsonb),
  ('negative amount',8,'-1'::jsonb), ('amount on folders',8,'1'::jsonb),
  ('excessive approved count',9,'3'::jsonb), ('negative approved count',9,'-1'::jsonb),
  ('fractional approved count',9,'0.5'::jsonb)
) bad(description,position,value);
insert into malformed_analysis values
  ('approval on sales',jsonb_set(pg_temp.analysis_fixture(),'{views,0,facts,1,9}','1')),
  ('excessive sales amount',jsonb_set(pg_temp.analysis_fixture(),'{views,0,facts,1,8}','1000000000000001'));
grant select on malformed_analysis to service_role;

set local role service_role;
select throws_ok(format('select public.ingest_crm_salesforce_snapshot(%L::jsonb)',
  jsonb_set(pg_temp.analysis_payload('ac000000-0000-4000-8000-000000000002','2026-08-04T08:00:00Z'),
    '{dashboard,analysis}', payload)), '22023', 'invalid dashboard analysis', description)
from malformed_analysis;
reset role;
select is(pg_temp.analysis_state(), (select value from original_analysis_state),
  'every invalid extension rolls back snapshot, metrics, ranking, analysis, run and audit');

create function pg_temp.reject_analysis_insert() returns trigger language plpgsql as $$
begin
  raise exception 'synthetic analysis storage failure' using errcode='P0001';
end;
$$;
create trigger analysis_test_storage_failure before insert on public.crm_dashboard_analysis
for each row execute function pg_temp.reject_analysis_insert();
set local role service_role;
select throws_ok($$select public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000002','2026-08-04T08:00:00Z'))$$,
  'P0001','synthetic analysis storage failure','analysis persistence failure escapes the base success');
reset role;
drop trigger analysis_test_storage_failure on public.crm_dashboard_analysis;
select is(pg_temp.analysis_state(), (select value from original_analysis_state),
  'storage failure rolls back the base, deleted analysis, run and audit');

set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000003','2026-08-04T05:00:00Z'))->>'status', 'failed',
  'stale base remains rejected');
reset role;
select is((select jsonb_agg(to_jsonb(a) order by a.snapshot_id,a.view_key) from public.crm_dashboard_analysis a),
  (select value->'analysis' from original_analysis_state), 'stale request cannot replace analysis');
select is((select generated_at from public.crm_dashboard_snapshots where snapshot_key='analysis-test'),
  '2026-08-04T06:00:00Z'::timestamptz, 'stale request cannot replace the base snapshot');

-- A successful extension replaces all views, including an empty analysis.
set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000004','2026-08-04T09:00:00Z'), '{dashboard,analysis,views,0,facts}', '[]'))->>'status',
  'succeeded', 'new snapshot replaces analysis atomically');
reset role;
select is((select payload->'facts' from public.crm_dashboard_analysis where view_key='all'),
  '[]'::jsonb, 'empty view facts replace old facts rather than merging');

-- Compare RLS with the existing view policy for every catalogued role.
create temporary table analysis_roles as
select key, ('ad000000-0000-4000-8000-' || lpad(row_number() over(order by key)::text,12,'0'))::uuid as user_id
from public.roles;
insert into auth.users(id,email) select user_id, 'analysis-' || key || '@example.test' from analysis_roles;
select public.bootstrap_master_user((select user_id from analysis_roles where key='master'));
insert into public.crm_organizations(id,organization_key,name,kind)
values ('ae000000-0000-4000-8000-000000000001','analysis-org','Synthetic organization','house');
insert into public.crm_teams(id,organization_id,team_key,name)
values ('af000000-0000-4000-8000-000000000001','ae000000-0000-4000-8000-000000000001',
  'analysis-team','Synthetic team');
insert into public.crm_people(person_key,display_name,auth_user_id)
select 'analysis-' || key,'Synthetic ' || key,user_id from analysis_roles
where key in ('broker_house','broker_imob');
insert into public.crm_team_memberships(team_id,person_id,membership_role)
select 'af000000-0000-4000-8000-000000000001',p.id,'broker'
from public.crm_people p join analysis_roles r on r.user_id=p.auth_user_id;
insert into public.crm_reporting_scopes(scope_key,scope_type,organization_id,team_id)
values
  ('analysis-org','organization','ae000000-0000-4000-8000-000000000001',null),
  ('analysis-team','team',null,'af000000-0000-4000-8000-000000000001');
insert into public.crm_reporting_scopes(scope_key,scope_type,person_id)
select 'analysis-' || r.key,'person',p.id from public.crm_people p
join analysis_roles r on r.user_id=p.auth_user_id;
insert into public.crm_user_reporting_scope_grants(user_id,reporting_scope_id,granted_by,reason)
select r.user_id,s.id,(select user_id from analysis_roles where key='master'),'Synthetic analysis role scope'
from analysis_roles r join public.crm_reporting_scopes s on s.scope_key = case
  when r.key='admin' then 'analysis-org'
  when r.key in ('coordinator','manager_house','manager_imob') then 'analysis-team'
  when r.key in ('broker_house','broker_imob') then 'analysis-' || r.key
  else null end;
update public.user_roles u set role_key = r.key from analysis_roles r
where r.user_id=u.user_id and r.key <> 'master';
update public.profiles p set is_active=true, access_status='approved', approved_at=now()
from analysis_roles r where r.user_id=p.user_id
  and r.key in ('admin','coordinator','manager_house','manager_imob','broker_house','broker_imob');
grant select on analysis_roles to authenticated;

create function pg_temp.check_analysis_role(p_user uuid, p_key text)
returns setof text language plpgsql as $$
declare v_actual text; v_expected text; v_views text;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
  select coalesce(string_agg(view_key,',' order by view_key),'') into v_actual from public.crm_dashboard_analysis;
  select coalesce(string_agg(view_key,',' order by view_key),'') into v_views from public.crm_dashboard_views;
  v_expected := case
    when p_key in ('master','admin') then 'all,with_canal_imob,without_canal_imob'
    when p_key in ('coordinator','manager_imob','broker_imob') then 'with_canal_imob'
    when p_key in ('manager_house','broker_house') then 'without_canal_imob'
    else '' end;
  return next is(v_actual,v_expected,p_key || ' sees only its authorized analysis views');
  return next is(v_actual,v_views,p_key || ' analysis policy matches crm_dashboard_views');
  execute 'reset role';
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','',true);
end;
$$;
select pg_temp.check_analysis_role(user_id,key) from analysis_roles order by key;

select set_config('request.jwt.claim.sub',(select user_id::text from analysis_roles where key='coordinator'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select ok(not public.has_permission(auth.uid(),'crm.ranking.view'), 'coordinator has no ranking permission');
select is((select payload#>>'{dimensions,owners,0}' from public.crm_dashboard_analysis),
  'Synthetic owner','authorized dashboard filter includes owner labels without ranking access');
select is((select count(*) from public.crm_ranking_participants),0::bigint,'filter access does not expose ranking rows');
select throws_ok('insert into public.crm_dashboard_analysis values (1,''all'',''{}'')','42501',null,'authenticated cannot insert');
select throws_ok('update public.crm_dashboard_analysis set payload=''{}''','42501',null,'authenticated cannot update');
select throws_ok('delete from public.crm_dashboard_analysis','42501',null,'authenticated cannot delete');
select throws_ok('select public.ingest_crm_salesforce_snapshot(''{}'')','42501',null,'authenticated cannot call ingestion');
reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

insert into public.user_permission_overrides(user_id,permission_key,effect,reason)
select user_id,'crm.dashboard.with_canal_imob.view','deny','Synthetic analysis view denial'
from analysis_roles where key='coordinator';
select set_config('request.jwt.claim.sub',(select user_id::text from analysis_roles where key='coordinator'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'specific view deny hides analysis');
reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
insert into public.user_permission_overrides(user_id,permission_key,effect,reason)
select user_id,'crm.dashboard.view','deny','Synthetic analysis dashboard denial'
from analysis_roles where key='admin';
select set_config('request.jwt.claim.sub',(select user_id::text from analysis_roles where key='admin'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'base dashboard deny overrides individual view grants');
reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
set local role authenticated;
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'missing identity fails closed');
reset role;
set local role anon;
select throws_ok('select * from public.crm_dashboard_analysis','42501',null,'anon cannot read analysis');
select throws_ok('insert into public.crm_dashboard_analysis values (1,''all'',''{}'')','42501',null,'anon cannot insert');
select throws_ok('update public.crm_dashboard_analysis set payload=''{}''','42501',null,'anon cannot update');
select throws_ok('delete from public.crm_dashboard_analysis','42501',null,'anon cannot delete');
select throws_ok('select public.ingest_crm_salesforce_snapshot(''{}'')','42501',null,'anon cannot call ingestion');
reset role;

set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000005','2026-08-04T10:00:00Z') #- '{dashboard,analysis}')->>'status',
  'succeeded','legacy v2 newly applies without analysis');
reset role;
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'new legacy payload invalidates old analysis');
select is((select count(*) from public.crm_dashboard_metrics),15::bigint,'legacy base metrics remain intact');
set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000005','2026-08-04T10:00:00Z'))->>'idempotent','true',
  'adding analysis to a legacy replay cannot backfill');
reset role;
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'legacy replay keeps analysis unavailable');
set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(pg_temp.analysis_payload(
  'ac000000-0000-4000-8000-000000000006','2026-08-04T11:00:00Z'))->>'status','succeeded',
  'only a new successful snapshot can restore analysis');
reset role;
delete from public.crm_dashboard_snapshots where snapshot_key='analysis-test';
select is((select count(*) from public.crm_dashboard_analysis),0::bigint,'snapshot deletion cascades to analysis');

select * from finish();
rollback;
