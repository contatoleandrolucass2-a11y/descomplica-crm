begin;
-- 42 existing assertions, six dashboard redaction assertions and four
-- conversion-goal contract assertions.
select plan(53);

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

create function pg_temp.appointment_slice() returns jsonb language sql as $$
  select '{"version":2,"viewKey":"all","coverageStart":"2026-01-01","referenceDate":"2026-08-04",
    "dimensions":{"managers":["Other stage manager","Appointment manager"],
      "owners":["Other stage owner","Appointment owner"],
      "companies":["Other company","Appointment company"],
      "developments":["Other project","True project"],
      "stores":["Store A","Store B"]},
    "facts":[[0,"2026-08-04",0,0,0,0,0,9,0,0,-1],
      [1,"2026-08-04",1,1,1,0,1,2,0,0,0],
      [1,"2026-08-04",1,1,1,0,1,3,0,0,1]]}'::jsonb;
$$;
create function pg_temp.appointment_analysis() returns jsonb language sql as $$
  select jsonb_build_object('version',2,'coverageStart','2026-01-01','referenceDate','2026-08-04',
    'views',(select jsonb_agg(jsonb_set(pg_temp.appointment_slice()-array['version','coverageStart','referenceDate'],
      '{viewKey}',to_jsonb(v))) from unnest(array['all','with_canal_imob','without_canal_imob']) v));
$$;
create function pg_temp.appointment_slice_v3() returns jsonb language sql as $$
  select jsonb_set(jsonb_set(jsonb_set(
    pg_temp.appointment_slice(),'{version}','3'::jsonb),
    '{brokerCount}','8'::jsonb),
    '{appointments}','[{
      "createdAt":"2026-08-04T12:00:00.000Z",
      "scheduledAt":"2026-08-04T15:00:00.000Z",
      "attendedAt":"2026-08-04T16:00:00.000Z",
      "visitPerformed":true,
      "regionalManager":"Synthetic regional",
      "salesManager":"Appointment manager",
      "owner":"Appointment owner",
      "accountName":"Protected account",
      "accountRanking":"Gold"
    }]'::jsonb);
$$;
create function pg_temp.appointment_analysis_v3() returns jsonb language sql as $$
  select jsonb_build_object('version',3,'coverageStart','2026-01-01',
    'referenceDate','2026-08-04','brokerCount',8,
    'views',(select jsonb_agg(
      jsonb_set(pg_temp.appointment_slice_v3()
        - array['version','coverageStart','referenceDate','brokerCount'],
        '{viewKey}',to_jsonb(v))
    ) from unnest(array['all','with_canal_imob','without_canal_imob']) v));
$$;
create function pg_temp.appointment_slice_v4() returns jsonb language sql as $$
  select jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    pg_temp.appointment_slice_v3(),'{version}','4'::jsonb),
    '{brokerManagerCount}','2'::jsonb),
    '{appointments,0}',(pg_temp.appointment_slice_v3()#>'{appointments,0}')
      || '{"channel":0,"company":"Appointment company","registeredBroker":true}'::jsonb),
    '{facts}',(pg_temp.appointment_slice_v3()->'facts')
      || '[[3,"2026-08-04",0,0,0,0,0,1,0,1,-1],
           [4,"2026-08-04",0,0,0,0,0,1,999999,0,-1]]'::jsonb);
$$;
create function pg_temp.appointment_analysis_v4() returns jsonb language sql as $$
  select jsonb_build_object('version',4,'coverageStart','2026-01-01',
    'referenceDate','2026-08-04','brokerCount',8,'brokerManagerCount',2,
    'views',(select jsonb_agg(
      jsonb_set(pg_temp.appointment_slice_v4()
        - array['version','coverageStart','referenceDate','brokerCount','brokerManagerCount'],
        '{viewKey}',to_jsonb(v))
    ) from unnest(array['all','with_canal_imob','without_canal_imob']) v));
$$;
grant execute on function pg_temp.appointment_slice(), pg_temp.appointment_analysis(),
  pg_temp.appointment_slice_v3(), pg_temp.appointment_analysis_v3(),
  pg_temp.appointment_slice_v4(), pg_temp.appointment_analysis_v4() to service_role;
select lives_ok($$select private.validate_crm_dashboard_analysis(pg_temp.analysis_fixture(),'2026-08-04')$$,
  'legacy v1 ingestion remains valid');
select lives_ok($$select private.validate_crm_dashboard_analysis(pg_temp.appointment_analysis(),'2026-08-04')$$,
  'v2 keeps rows differing only by store');
select throws_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.appointment_analysis(),'{views,0,facts,1,10}','2'),'2026-08-04')$$,
  '22023','invalid dashboard analysis','store index must address the current dictionary');
select throws_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.appointment_analysis(),'{views,0,facts,0,10}','0'),'2026-08-04')$$,
  '22023','invalid dashboard analysis','non-appointment stages cannot carry store indices');
select throws_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.appointment_analysis(),'{version}','1'),'2026-08-04')$$,
  '22023','invalid dashboard analysis','v2 tuples cannot be relabeled as v1');
select throws_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.appointment_analysis(),'{views,0,facts,2,10}','0'),'2026-08-04')$$,
  '22023','invalid dashboard analysis','duplicate v2 aggregate keys fail');
select lives_ok($$select private.validate_crm_dashboard_analysis(
  pg_temp.appointment_analysis_v3(),'2026-08-04')$$,
  'v3 validates broker population and operational rows');
select is(private.project_crm_appointments_analysis(
  pg_temp.appointment_slice_v3(),true)#>>'{appointments,0,accountName}',
  'Protected account','ranking permission preserves requested account details');
select is(private.project_crm_appointments_analysis(
  pg_temp.appointment_slice_v3(),false)#>>'{appointments,0,accountName}',
  '','missing ranking permission redacts account names');
select lives_ok($$select private.validate_crm_dashboard_analysis(
  pg_temp.appointment_analysis_v4(),'2026-08-04')$$,
  'v4 validates official manager population and productive broker marker');
select throws_ok($$select private.validate_crm_dashboard_analysis(
  jsonb_set(pg_temp.appointment_analysis_v4(),'{brokerManagerCount}','9'::jsonb),
  '2026-08-04')$$,'22023','invalid dashboard analysis',
  'v4 manager population cannot exceed registered brokers');
select ok((select sum((fact->>7)::int) filter (where fact->>0='0') = 9
    and count(*) filter (where fact->>0='4') = 1
    and count(*) filter (where fact->>0='3') = 1
    and sum((fact->>8)::numeric) filter (where fact->>0='4') = 999999
    and sum((fact->>9)::numeric) filter (where fact->>0='3') = 1
  from jsonb_array_elements(
    private.project_crm_appointments_analysis(pg_temp.appointment_slice_v4(),true)->'facts'
  ) fact),'v4 projection exposes the complete aggregate funnel without customer records');
select is(private.project_crm_appointments_analysis(
  pg_temp.appointment_slice_v4(),false)#>>'{appointments,0,accountName}',
  '','v4 preserves account redaction while exposing aggregate funnel facts');

select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),true)#>'{dimensions,managers}',
  '["Appointment manager"]'::jsonb,'projection removes other-stage manager labels');
select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),true)#>'{dimensions,owners}',
  '["Appointment owner"]'::jsonb,'projection removes other-stage owner labels');
select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),true)#>'{facts}',
  '[[1,"2026-08-04",0,0,0,0,0,2,0,0,0],[1,"2026-08-04",0,0,0,0,0,3,0,0,1]]'::jsonb,
  'appointment facts reindex every dictionary and retain independent stores');
select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),false)#>'{facts}',
  '[[1,"2026-08-04",0,0,0,0,-1,5,0,0,-1]]'::jsonb,
  'protected store/project facts collapse with exact totals');
select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),false)#>'{dimensions,stores}',
  '[]'::jsonb,'store dictionary is protected by the existing ranking permission');
select is(private.project_crm_appointments_analysis(pg_temp.appointment_slice(),false)#>'{dimensions,developments}',
  '[]'::jsonb,'development dictionary is protected by the existing ranking permission');
select ok(has_function_privilege('authenticated','public.read_crm_appointments_analysis(bigint,text[])','execute')
  and not has_function_privilege('anon','public.read_crm_appointments_analysis(bigint,text[])','execute')
  and not has_function_privilege('service_role','public.read_crm_appointments_analysis(bigint,text[])','execute'),
  'only authenticated can invoke the stage read RPC');
select ok(has_function_privilege('authenticated','public.read_crm_appointments_goal(date)','execute')
  and not has_function_privilege('anon','public.read_crm_appointments_goal(date)','execute')
  and not has_function_privilege('service_role','public.read_crm_appointments_goal(date)','execute'),
  'only authenticated can invoke the appointment goal RPC');
select ok(has_function_privilege('authenticated','public.read_crm_appointments_conversion_goals(date)','execute')
  and not has_function_privilege('anon','public.read_crm_appointments_conversion_goals(date)','execute')
  and not has_function_privilege('service_role','public.read_crm_appointments_conversion_goals(date)','execute'),
  'only authenticated can invoke the appointment conversion goal RPC');
select ok(not has_function_privilege(role_name,'private.project_crm_appointments_analysis(jsonb,boolean)','execute'),
  role_name || ' cannot bypass stage authorization through the private projector')
from unnest(array['anon','authenticated','service_role']) role_name;
select ok(not has_table_privilege(role_name,'public.crm_dashboard_analysis','select'),
  role_name || ' cannot bypass RPC redaction through direct SELECT')
from unnest(array['anon','authenticated','service_role']) role_name;

-- Ingestion preserves the v2 discriminator instead of storing a false v1 label.
set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(pg_temp.analysis_payload(),
  '{dashboard,analysis}',pg_temp.appointment_analysis()))->>'status','succeeded','machine RPC accepts v2');
reset role;
select is((select payload->'version' from public.crm_dashboard_analysis where view_key='all'),
  '2'::jsonb,'stored slices preserve version 2');
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(jsonb_set(
  pg_temp.analysis_payload('ac000000-0000-4000-8000-000000000002','2026-08-04T07:00:00Z'),
  '{dashboard,snapshotKey}','"analysis-test-v3"'::jsonb),
  '{dashboard,analysis}',pg_temp.appointment_analysis_v3()))->>'status',
  'succeeded','machine RPC accepts v3');
select is((select jsonb_build_object('version',payload->'version','brokerCount',payload->'brokerCount')
  from public.crm_dashboard_analysis where view_key='all' and payload->'version'='3'::jsonb),
  '{"version":3,"brokerCount":8}'::jsonb,'stored v3 slices preserve broker population');
set local role service_role;
select is(public.ingest_crm_salesforce_snapshot(jsonb_set(
  pg_temp.analysis_payload('ac000000-0000-4000-8000-000000000003','2026-08-04T08:00:00Z'),
  '{dashboard,analysis}',pg_temp.appointment_analysis_v4()))->>'status',
  'succeeded','machine RPC accepts v4');
reset role;
select is((select jsonb_build_object(
    'version',payload->'version','brokerCount',payload->'brokerCount',
    'brokerManagerCount',payload->'brokerManagerCount')
  from public.crm_dashboard_analysis where view_key='all' and payload->'version'='4'::jsonb),
  '{"version":4,"brokerCount":8,"brokerManagerCount":2}'::jsonb,
  'stored v4 slices preserve official broker and manager populations');
select set_config('test.appointment_snapshot',(select s.id::text
  from public.crm_dashboard_snapshots s
  join public.crm_dashboard_analysis a on a.snapshot_id=s.id and a.view_key='all'
  where s.snapshot_key='analysis-test-v3' and a.payload->'version'='3'::jsonb),true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,'missing identity yields no stage data');
select is(public.read_crm_appointments_goal('2026-08-04'),null::bigint,
  'missing identity yields no appointment goal');
select is(public.read_crm_appointments_conversion_goals('2026-08-04'),null::jsonb,
  'missing identity yields no appointment conversion goals');
reset role;
insert into public.crm_funnel_goals(
  profile_key,effective_month,opportunities,appointments,visits,folders,approved_folders,sales,
  approved_folders_rate,folders_rate,visits_rate,appointments_rate
)
values ('dv','2026-08-01',216,24,12,8,2,1,150,500,154,204)
on conflict (profile_key,effective_month) do update set
  opportunities=excluded.opportunities,
  appointments=excluded.appointments,
  visits=excluded.visits,
  folders=excluded.folders,
  approved_folders=excluded.approved_folders,
  sales=excluded.sales,
  approved_folders_rate=excluded.approved_folders_rate,
  folders_rate=excluded.folders_rate,
  visits_rate=excluded.visits_rate,
  appointments_rate=excluded.appointments_rate;
insert into auth.users(id,email) values ('ac190000-0000-4000-8000-000000000001','appointments@example.test');
select public.bootstrap_master_user('ac190000-0000-4000-8000-000000000001');
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.ranking.view','deny','Synthetic ranking protection');
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.read_crm_dashboard_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),1::bigint,
  'v3 dashboard remains readable without ranking permission');
select is((select payload->'facts' from public.read_crm_dashboard_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),
  '[[0,"2026-08-04",0,0,0,0,-1,9,0,0,-1],[1,"2026-08-04",1,1,1,0,-1,5,0,0,-1]]'::jsonb,
  'v3 dashboard preserves eleven-field facts and exact totals after redaction');
select is((select jsonb_build_object(
    'developments',payload#>'{dimensions,developments}',
    'stores',payload#>'{dimensions,stores}')
  from public.read_crm_dashboard_analysis(
    current_setting('test.appointment_snapshot')::bigint,array['all'])),
  '{"developments":[],"stores":[]}'::jsonb,
  'v3 dashboard removes both protected dictionaries');
select is((select jsonb_build_object(
    'accountName',payload#>'{appointments,0,accountName}',
    'accountRanking',payload#>'{appointments,0,accountRanking}')
  from public.read_crm_dashboard_analysis(
    current_setting('test.appointment_snapshot')::bigint,array['all'])),
  '{"accountName":"","accountRanking":""}'::jsonb,
  'v3 dashboard redacts protected appointment account fields');
select ok(not exists (
  select 1
  from public.read_crm_dashboard_analysis(
    current_setting('test.appointment_snapshot')::bigint,array['all']) analysis,
    lateral jsonb_array_elements(analysis.payload->'facts') fact
  group by jsonb_build_array(fact->0,fact->1,fact->2,fact->3,fact->4,fact->5,fact->6,fact->10)
  having count(*) > 1 or bool_or(jsonb_array_length(fact) <> 11)
), 'v3 redaction preserves tuple shape and aggregate uniqueness');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('test.appointment_snapshot',(select s.id::text
  from public.crm_dashboard_snapshots s
  join public.crm_dashboard_analysis a on a.snapshot_id=s.id and a.view_key='all'
  where s.snapshot_key='analysis-test' and a.payload->'version'='4'::jsonb),true);
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select ok((select payload->'version'='4'::jsonb
    and payload#>'{dimensions,developments}'='[]'::jsonb
    and payload#>'{dimensions,stores}'='[]'::jsonb
    and payload#>>'{appointments,0,accountName}'=''
    and payload#>>'{appointments,0,accountRanking}'=''
    and not exists (
      select 1 from jsonb_array_elements(payload->'facts') fact
      group by jsonb_build_array(
        fact->0,fact->1,fact->2,fact->3,fact->4,fact->5,fact->6,fact->10
      )
      having count(*) > 1 or bool_or(jsonb_array_length(fact) <> 11)
    )
  from public.read_crm_dashboard_analysis(
    current_setting('test.appointment_snapshot')::bigint,array['all'])),
  'v4 dashboard preserves shape, uniqueness and protected-field redaction');
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.dashboard.view','deny','Synthetic stage-only test');
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),1::bigint,
  'stage-only access works without dashboard permission');
select is(public.read_crm_appointments_goal('2026-08-04'),24::bigint,
  'stage-only access reads only the active appointment volume');
select is((public.read_crm_appointments_conversion_goals('2026-08-04')#>>'{dv,opportunityAppointment}')::numeric,
  9::numeric,'stage-only access reads the active House opportunity-to-appointment limit');
select is(public.read_crm_appointments_conversion_goals('2026-08-04')#>'{dv,monthlyFunnel}',
  '{"opportunities":216,"appointments":24,"visits":12,"folders":8,"approvedFolders":2,"sales":1}'::jsonb,
  'stage-only access reads the complete configured funnel goal');
select is(public.read_crm_appointments_conversion_goals('2026-08-04')#>'{partnerships}',
  'null'::jsonb,'partnership appointment conversions remain unavailable instead of fabricated');
select is((select payload#>'{dimensions,developments}' from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),'[]'::jsonb,
  'stage-only RPC cannot bypass ranking protection');
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array[]::text[])),0::bigint,'empty selection yields no data');
reset role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ac190000-0000-4000-8000-000000000001',
  'session_id','ac190000-0000-4000-8000-000000000099','aal','aal1')::text,true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,
  'stage read rejects JWT claims without a live session');
reset role;
reset request.jwt.claims;
-- PostgreSQL prepares fixtures without impersonating an authenticated Master.
select set_config('request.jwt.claim.sub','',true);
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.dashboard.all.view','deny','Synthetic view denial');
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,
  'stage permission cannot bypass an explicitly denied view');
reset role;
reset request.jwt.claims;
select set_config('request.jwt.claim.sub','',true);
delete from public.user_permission_overrides
where user_id='ac190000-0000-4000-8000-000000000001' and permission_key='crm.dashboard.all.view';
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.stage.appointments.view','deny','Synthetic immediate revocation');
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,'stage permission revocation is immediate');
reset role;
select * from finish();
rollback;
