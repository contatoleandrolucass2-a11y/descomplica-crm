begin;
select plan(39);

create function pg_temp.productive_slice() returns jsonb language sql as $$
  select '{"version":4,"viewKey":"all","coverageStart":"2026-10-01",
    "referenceDate":"2026-11-01","brokerCount":1,"brokerManagerCount":1,
    "dimensions":{"managers":["Synthetic manager","Protected other-stage manager"],
      "owners":["Synthetic broker","Protected other-stage broker"],
      "companies":["Synthetic company","Protected other company"],
      "developments":["Protected project"],"stores":["Protected store"]},
    "facts":[[0,"2026-11-01",1,1,1,1,0,90,0,0,-1],
      [1,"2026-11-01",0,0,0,1,0,3,0,0,0],
      [2,"2026-11-01",0,0,0,1,0,4,0,0,-1],
      [3,"2026-11-01",0,0,0,1,0,5,0,2,-1],
      [4,"2026-11-01",0,0,0,1,0,6,500000,0,-1]],
    "appointments":[{"createdAt":"2026-11-01T12:00:00Z",
      "scheduledAt":"2026-11-02T12:00:00Z","attendedAt":null,"visitPerformed":true,
      "regionalManager":"Synthetic regional","salesManager":"Synthetic manager",
      "owner":"Synthetic broker","accountName":"Protected account","accountRanking":"Gold",
      "channel":1,"company":"Synthetic company","registeredBroker":true}]}'::jsonb;
$$;

select is(private.project_crm_productive_team_analysis(pg_temp.productive_slice(),
  array['appointments','visits','folders','sales'])#>'{facts}',
  '[[1,"2026-11-01",0,0,0,1,-1,1,0,0,-1],
    [2,"2026-11-01",0,0,0,1,-1,1,0,0,-1],
    [3,"2026-11-01",0,0,0,1,-1,1,0,0,-1],
    [4,"2026-11-01",0,0,0,1,-1,1,0,0,-1]]'::jsonb,
  'only broker presence crosses the boundary, without sales or activity volumes');
select is(private.project_crm_productive_team_analysis(pg_temp.productive_slice(),
  array['sales'])#>'{dimensions,owners}', '["Synthetic broker"]'::jsonb,
  'unrelated dictionaries are removed and remaining indices are remapped');
select is(private.project_crm_productive_team_analysis(pg_temp.productive_slice(),
  array['appointments'])#>>'{appointments,0,accountName}', '', 'account identities are redacted');
select is(private.project_crm_productive_team_analysis(pg_temp.productive_slice(),
  array['appointments'])#>'{appointments,0,scheduledAt}', 'null'::jsonb,
  'unneeded appointment timestamps are redacted');
select is(private.project_crm_productive_team_analysis(pg_temp.productive_slice(),
  array['sales'])#>'{appointments}', '[]'::jsonb, 'unavailable appointment source is not exposed');
select is(private.project_crm_productive_team_analysis(
  jsonb_set(pg_temp.productive_slice(),'{version}','3'::jsonb),array['sales']),
  null::jsonb, 'legacy snapshots are unavailable rather than false zeros');
select ok(has_function_privilege('authenticated','public.read_crm_productive_team(text)','execute')
  and not has_function_privilege('anon','public.read_crm_productive_team(text)','execute')
  and not has_function_privilege('service_role','public.read_crm_productive_team(text)','execute'),
  'only authenticated may execute the guarded read');
select ok(has_function_privilege('authenticated','public.read_crm_productive_team_v2(text)','execute')
  and not has_function_privilege('anon','public.read_crm_productive_team_v2(text)','execute')
  and not has_function_privilege('service_role','public.read_crm_productive_team_v2(text)','execute'),
  'only authenticated may execute the guarded v2 read');
select ok(not has_function_privilege(role_name,
  'private.project_crm_productive_team_analysis(jsonb,text[])','execute'),
  role_name || ' cannot bypass the public authorization boundary')
from unnest(array['anon','authenticated','service_role']) role_name;
select ok(not has_table_privilege(role_name,'public.crm_dashboard_analysis','select'),
  role_name || ' cannot read raw analysis')
from unnest(array['anon','authenticated','service_role']) role_name;

insert into public.crm_dashboard_snapshots(snapshot_key,reference_date,generated_at,source)
values ('global','2026-11-01','2026-11-01T18:00:00Z','Synthetic productive team');
insert into public.crm_dashboard_analysis(snapshot_id,view_key,payload)
select id,'all',pg_temp.productive_slice() from public.crm_dashboard_snapshots where snapshot_key='global';
insert into public.crm_dashboard_metrics(snapshot_id,view_key,stage_key)
select id,'all',stage from public.crm_dashboard_snapshots
cross join unnest(array['appointments','visits','folders','sales']) stage where snapshot_key='global';
insert into public.crm_ranking_snapshots(snapshot_key,reference_date,generated_at,source)
values ('global','2026-11-01','2026-11-01T18:00:00Z','Synthetic productive roster');
insert into public.crm_ranking_participants(snapshot_id,period_key,broker_key,broker_name,manager_name)
select id,'month','synthetic-broker','Synthetic broker','Synthetic manager'
from public.crm_ranking_snapshots where snapshot_key='global';

set local role authenticated;
select is(public.read_crm_productive_team('all'),null::jsonb,'missing identity has no data');
select is(public.read_crm_productive_team_v2('all'),null::jsonb,'v2 missing identity has no data');
reset role;
insert into auth.users(id,email)
values ('ed110000-0000-4000-8000-000000000001','productive@example.test');
select public.bootstrap_master_user('ed110000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is(jsonb_array_length(public.read_crm_productive_team('all')->'availableStages'),4,
  'page permission independently authorizes its four source indicators');
select is(jsonb_array_length(public.read_crm_productive_team('all')->'brokerRoster'),1,
  'matching official roster is returned atomically');
select is(public.read_crm_productive_team('not-a-view'),null::jsonb,'unknown view is denied');
select is(public.read_crm_productive_team_v2('not-a-view'),null::jsonb,'v2 unknown view is denied');
reset role;

update public.crm_ranking_participants set roster_manager_name='Official manager',
  regional_manager_name='Official regional';
set local role authenticated;
select is(public.read_crm_productive_team_v2('all')#>>'{brokerRoster,0,manager}',
  'Official manager','v2 uses the official manager rather than historical activity');
select is(public.read_crm_productive_team_v2('all')#>>'{brokerRoster,0,regionalManager}',
  'Official regional','v2 returns the matching official regional');
select is(public.read_crm_productive_team('all')#>>'{brokerRoster,0,manager}',
  'Synthetic manager','v1 keeps its original legacy contract');
select ok(not ((public.read_crm_productive_team('all')#>'{brokerRoster,0}') ? 'regionalManager'),
  'v1 strict clients receive no new roster property');
reset role;
update public.crm_ranking_participants set regional_manager_name=null;
set local role authenticated;
select is(public.read_crm_productive_team_v2('all')#>'{brokerRoster,0,regionalManager}',
  'null'::jsonb,'explicit missing official regional never borrows activity history');
reset role;
update public.crm_ranking_participants set roster_manager_name=null;
set local role authenticated;
select is(public.read_crm_productive_team_v2('all')->'brokerRoster',
  'null'::jsonb,'unknown official manager makes the roster unavailable');
reset role;
update public.crm_ranking_participants set roster_manager_name='Official manager',
  regional_manager_name='Official regional';
select set_config('request.jwt.claim.sub','',true);
insert into public.user_permission_overrides(user_id,permission_key,effect,reason)
values ('ed110000-0000-4000-8000-000000000001','crm.stage.appointments.view','deny','Synthetic unrelated stage denial'),
  ('ed110000-0000-4000-8000-000000000001','crm.ranking.view','deny','Synthetic unrelated ranking denial');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(jsonb_array_length(public.read_crm_productive_team_v2('all')->'brokerRoster'),1,
  'productive-team permission is independent of appointments and ranking access');
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from public.user_permission_overrides where user_id='ed110000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);

update public.crm_ranking_snapshots set generated_at='2026-11-01T17:00:00Z' where snapshot_key='global';
set local role authenticated;
select is(public.read_crm_productive_team('all')->'brokerRoster','null'::jsonb,
  'mismatched roster generation is unavailable');
select is(public.read_crm_productive_team_v2('all')->'brokerRoster','null'::jsonb,
  'v2 mismatched roster generation is unavailable');
reset role;
update public.crm_dashboard_analysis set payload=jsonb_set(payload,'{facts}','[]'::jsonb);
set local role authenticated;
select is(jsonb_array_length(public.read_crm_productive_team('all')->'availableStages'),4,
  'a source with no facts is still an available real zero');
select is(jsonb_array_length(public.read_crm_productive_team_v2('all')->'availableStages'),4,
  'v2 preserves confirmed empty sources');
reset role;
delete from public.crm_dashboard_metrics where stage_key='folders';
set local role authenticated;
select ok(not (public.read_crm_productive_team('all')->'availableStages' ? 'folders'),
  'missing metric source stays unavailable');
select ok(not (public.read_crm_productive_team_v2('all')->'availableStages' ? 'folders'),
  'v2 missing metric source stays unavailable');
reset role;
-- Fixture writes run as postgres without a JWT. RESET ROLE alone leaves
-- auth.uid() populated and correctly triggers the immutable-Master boundary.
select set_config('request.jwt.claim.sub','',true);
insert into public.user_permission_overrides(user_id,permission_key,effect,reason)
values ('ed110000-0000-4000-8000-000000000001','crm.dashboard.all.view','deny','Synthetic view denial');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.read_crm_productive_team('all'),null::jsonb,'explicit view denial wins');
select is(public.read_crm_productive_team_v2('all'),null::jsonb,'v2 explicit view denial wins');
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from public.user_permission_overrides where user_id='ed110000-0000-4000-8000-000000000001';
insert into public.user_permission_overrides(user_id,permission_key,effect,reason)
values ('ed110000-0000-4000-8000-000000000001','crm.productive_team.view','deny','Synthetic page denial');
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.read_crm_productive_team('all'),null::jsonb,'explicit page denial wins');
select is(public.read_crm_productive_team_v2('all'),null::jsonb,'v2 explicit page denial wins');
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from public.user_permission_overrides where user_id='ed110000-0000-4000-8000-000000000001';
update public.app_pages set is_active=false where key='crm.productive_team';
select set_config('request.jwt.claim.sub','ed110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.read_crm_productive_team('all'),null::jsonb,'inactive page cannot be read via RPC');
select is(public.read_crm_productive_team_v2('all'),null::jsonb,'v2 inactive page cannot be read via RPC');
reset role;
select * from finish();
rollback;
