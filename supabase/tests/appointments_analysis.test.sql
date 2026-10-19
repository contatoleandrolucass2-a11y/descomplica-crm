begin;
-- 22 single assertions plus two three-role ACL matrices.
select plan(28);

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
grant execute on function pg_temp.appointment_slice(), pg_temp.appointment_analysis() to service_role;
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
select set_config('test.appointment_snapshot',(select id::text from public.crm_dashboard_snapshots
  where snapshot_key='analysis-test'),true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,'missing identity yields no stage data');
reset role;
insert into auth.users(id,email) values ('ac190000-0000-4000-8000-000000000001','appointments@example.test');
select public.bootstrap_master_user('ac190000-0000-4000-8000-000000000001');
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.dashboard.view','deny','Synthetic stage-only test'),
  ('ac190000-0000-4000-8000-000000000001','crm.ranking.view','deny','Synthetic ranking protection');
select set_config('request.jwt.claim.sub','ac190000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),1::bigint,
  'stage-only access works without dashboard permission');
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
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.dashboard.all.view','deny','Synthetic view denial');
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,
  'stage permission cannot bypass an explicitly denied view');
reset role;
delete from public.user_permission_overrides
where user_id='ac190000-0000-4000-8000-000000000001' and permission_key='crm.dashboard.all.view';
insert into public.user_permission_overrides(user_id,permission_key,effect,reason) values
  ('ac190000-0000-4000-8000-000000000001','crm.stage.appointments.view','deny','Synthetic immediate revocation');
set local role authenticated;
select is((select count(*) from public.read_crm_appointments_analysis(
  current_setting('test.appointment_snapshot')::bigint,array['all'])),0::bigint,'stage permission revocation is immediate');
reset role;
select * from finish();
rollback;
