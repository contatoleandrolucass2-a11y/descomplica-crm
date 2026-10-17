begin;
select plan(61);
create temporary table forecast_actors (id uuid primary key, role_key text);
insert into forecast_actors values
  ('ac710000-0000-4000-8000-000000000001', 'master'),
  ('ac710000-0000-4000-8000-000000000002', 'admin'),
  ('ac710000-0000-4000-8000-000000000003', 'coordinator'),
  ('ac710000-0000-4000-8000-000000000004', 'manager_house'),
  ('ac710000-0000-4000-8000-000000000005', 'manager_imob'),
  ('ac710000-0000-4000-8000-000000000006', 'broker_house'),
  ('ac710000-0000-4000-8000-000000000007', 'broker_imob'),
  ('ac710000-0000-4000-8000-000000000008', 'pending');
insert into auth.users (id, email)
select id, 'forecast-' || role_key || '@example.test' from forecast_actors;
select public.bootstrap_master_user('ac710000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values ('ac720000-0000-4000-8000-000000000001', 'forecast-test', 'Synthetic Forecast', 'house');
insert into public.crm_teams (id, organization_id, team_key, name)
values ('ac730000-0000-4000-8000-000000000001', 'ac720000-0000-4000-8000-000000000001',
  'forecast-test', 'Synthetic Forecast');
insert into public.crm_people (id, person_key, display_name, auth_user_id)
select id, 'forecast-' || role_key, 'Synthetic ' || role_key, id
from forecast_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_team_memberships (team_id, person_id, membership_role)
select 'ac730000-0000-4000-8000-000000000001', id, 'broker'
from forecast_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_reporting_scopes (id, scope_key, scope_type, organization_id, team_id, person_id)
values
  ('ac760000-0000-4000-8000-000000000001', 'forecast-organization', 'organization',
    'ac720000-0000-4000-8000-000000000001', null, null),
  ('ac760000-0000-4000-8000-000000000002', 'forecast-team', 'team',
    null, 'ac730000-0000-4000-8000-000000000001', null),
  ('ac760000-0000-4000-8000-000000000003', 'forecast-broker-house', 'person',
    null, null, 'ac710000-0000-4000-8000-000000000006'),
  ('ac760000-0000-4000-8000-000000000004', 'forecast-broker-imob', 'person',
    null, null, 'ac710000-0000-4000-8000-000000000007')
on conflict do nothing;
-- Resolve by target identity, including scopes already created by setup triggers.
-- Coordinator and both managers share the same unique team scope.
insert into public.crm_user_reporting_scope_grants (user_id, reporting_scope_id, granted_by, reason)
select actor.id, scope.id, 'ac710000-0000-4000-8000-000000000001', 'Synthetic forecast fixture'
from forecast_actors actor
join public.crm_reporting_scopes scope on
  (actor.role_key = 'admin' and scope.scope_type = 'organization'
    and scope.organization_id = 'ac720000-0000-4000-8000-000000000001')
  or (actor.role_key in ('coordinator', 'manager_house', 'manager_imob')
    and scope.scope_type = 'team' and scope.team_id = 'ac730000-0000-4000-8000-000000000001')
  or (actor.role_key in ('broker_house', 'broker_imob')
    and scope.scope_type = 'person' and scope.person_id = actor.id);
update public.user_roles u set role_key = a.role_key,
  assigned_by = 'ac710000-0000-4000-8000-000000000001'
from forecast_actors a where a.id = u.user_id and a.role_key not in ('master', 'pending');
update public.profiles set is_active = true, access_status = 'approved',
  approved_at = now(), approved_by = 'ac710000-0000-4000-8000-000000000001'
where user_id in (select id from forecast_actors where role_key not in ('master', 'pending'));


select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = 'public.crm_forecasts'::regclass), 'forecast RLS is enabled and forced');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(name)
  where has_table_privilege(r.name, 'public.crm_forecasts', p.name)
), 'all API roles lack every direct table privilege');
select ok(not exists (
  select 1 from (values ('anon'), ('service_role')) r(name)
  cross join (values ('public.get_crm_forecast()'), ('public.save_crm_forecast(jsonb,bigint)')) f(name)
  where has_function_privilege(r.name, f.name, 'EXECUTE')
), 'anon and service cannot invoke either definer');
select ok(has_function_privilege('authenticated','public.get_crm_forecast()','EXECUTE')
  and has_function_privilege('authenticated','public.save_crm_forecast(jsonb,bigint)','EXECUTE'), 'authenticated can enter guarded RPCs');
select ok((select bool_and(prosecdef and pg_get_userbyid(proowner) = 'postgres' and 'search_path=""' = any(proconfig))
  from pg_proc where oid in ('public.get_crm_forecast()'::regprocedure, 'public.save_crm_forecast(jsonb,bigint)'::regprocedure)),
  'definers are owned by postgres and have an empty search path');
select is((select count(*) from public.crm_forecasts), 0::bigint, 'no invented saved forecast');

create function pg_temp.forecast_doc(cell text default 'Synthetic', n integer default 1)
returns jsonb language sql immutable as $$
  select jsonb_build_object('title', 'Equipe', 'columns', '[{"id":"broker","label":"Nome do corretor"},{"id":"forecast","label":"Previsão"},{"id":"actual","label":"Realizado"}]'::jsonb,
    'rows', coalesce(jsonb_agg(jsonb_build_object('id', 'r'||i, 'cells', jsonb_build_object('broker',cell,'forecast','','actual',''))), '[]'::jsonb))
  from generate_series(1,n) i;
$$;
grant execute on function pg_temp.forecast_doc(text,integer) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','',true);
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_crm_forecast()$$,'28000','unauthorized: authenticated user required','missing UID cannot read');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),0)$$,'28000','unauthorized: authenticated user required','missing UID cannot save');
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000008',true);
select throws_ok($$select public.get_crm_forecast()$$,'42501','forbidden: actor is not approved','pending account cannot read');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),0)$$,'42501','forbidden: actor is not approved','pending account cannot save');
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000006',true);
select throws_ok($$select public.get_crm_forecast()$$,'42501','forbidden: forecast page unavailable','default broker cannot read independent page');
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000002',true);
select is(public.get_crm_forecast(),'{"forecast":null,"can_edit":true}'::jsonb,'empty snapshot has explicit edit capability');
select is(public.save_crm_forecast(pg_temp.forecast_doc(),0)->>'revision','1','first save creates singleton');
select is(public.save_crm_forecast(pg_temp.forecast_doc('Updated'),1)->>'revision','2','matching CAS increments revision');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),0)$$,'40001','conflict: forecast revision changed','concurrent create fails');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),1)$$,'40001','conflict: forecast revision changed','stale update fails');
select is(public.get_crm_forecast()#>>'{forecast,rows,0,cells,broker}','Updated','conflict preserves content');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),-1)$$,'22023','invalid_argument: invalid expected revision','negative CAS rejected');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),9007199254740991)$$,'22023','invalid_argument: invalid expected revision','unsafe increment rejected');
select throws_ok(format('select public.save_crm_forecast(%L::jsonb,2)', doc), '22023', 'invalid_argument: invalid forecast', reason)
from (values
  ('null'::jsonb,'null grid rejected'),
  ('[]'::jsonb,'array grid rejected'),
  ('{}'::jsonb,'missing keys rejected'),
  (pg_temp.forecast_doc()||'{"extra":true}'::jsonb,'unknown root key rejected'),
  (pg_temp.forecast_doc()||'{"columns":[]}'::jsonb,'no columns rejected'),
  (pg_temp.forecast_doc()||'{"title":4}'::jsonb,'numeric title rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{title}',to_jsonb(repeat('x',121))),'long title rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{columns,0,id}','"bad.id"'),'invalid column ID rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{columns,0,id}','"__proto__"'),'unsafe object key rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{columns,1,id}','"broker"'),'duplicate column ID rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{columns,0,label}','"  "'),'empty column label rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{rows,0,id}','null'),'null row ID rejected'),
  (jsonb_set(pg_temp.forecast_doc('',2),'{rows,1,id}','"r1"'),'duplicate row ID rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{rows,0,cells}','{}'),'missing cells rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{rows,0,cells,extra}','""'),'unknown cells rejected'),
  (jsonb_set(pg_temp.forecast_doc(),'{rows,0,cells,broker}','5'),'numeric cells rejected'),
  (pg_temp.forecast_doc(repeat('x',4001)),'long cells rejected'),
  (pg_temp.forecast_doc(repeat(U&'\+01F600',2001)),'UTF16 emoji limit enforced'),
  (pg_temp.forecast_doc('',201),'row count limit enforced')
) invalid(doc,reason);
select lives_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(repeat(U&'\+01F600',2000)),2)$$,'UTF16 boundary accepted');
select lives_ok($$select public.save_crm_forecast(pg_temp.forecast_doc('',200),3)$$,'200 unique rows accepted');
select lives_ok($$select public.save_crm_forecast(pg_temp.forecast_doc('',0),4)$$,'all rows may be removed');
reset role;
select is((select updated_by from public.crm_forecasts),'ac710000-0000-4000-8000-000000000002'::uuid,'actor recorded server side');
select is((select count(*) from public.audit_logs where action='crm.forecast.saved'),5::bigint,'only successful saves create audit');
select ok(not exists (select 1 from public.audit_logs where action='crm.forecast.saved'
  and ((before-array['revision'])<>'{}'::jsonb or (after-array['revision','row_count','column_count','updated_at'])<>'{}'::jsonb)),
  'audit retains only metadata, never title or cell content');
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by) values
  ('ac710000-0000-4000-8000-000000000006','crm.management.forecast.view','allow','Synthetic read grant','ac710000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000006',true);
select is(public.get_crm_forecast()->>'can_edit','false','page grant allows shared read, not editing');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'42501','forbidden: missing crm.settings.manage','reader cannot save');
reset role;
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by) values
  ('ac710000-0000-4000-8000-000000000002','crm.management.forecast.view','deny','Synthetic read denial','ac710000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.get_crm_forecast()$$,'42501','forbidden: forecast page unavailable','denied editor cannot read');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'42501','forbidden: forecast page unavailable','denied editor cannot save');
reset role;
update public.app_pages set is_active=false where key='crm.management.forecast';
set local role authenticated;
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_crm_forecast()$$,'42501','forbidden: forecast page unavailable','disabled page blocks master');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'42501','forbidden: forecast page unavailable','disabled page blocks master save');
reset role;
update public.app_pages set is_active=true where key='crm.management.forecast';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac710000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select throws_ok($$select public.get_crm_forecast()$$,'28000','unauthorized: session assurance required','real JWT requires live session');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'28000','unauthorized: session assurance required','real JWT save requires live session');
select set_config('request.jwt.claims','',true);
reset role;
insert into auth.sessions(id,user_id,aal,not_after) values
  ('ac740000-0000-4000-8000-000000000001','ac710000-0000-4000-8000-000000000001','aal1',now()+interval '1 hour');
insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at) values
  ('ac750000-0000-4000-8000-000000000001','ac710000-0000-4000-8000-000000000001','Synthetic Forecast TOTP','totp','verified',now(),now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac710000-0000-4000-8000-000000000001","role":"authenticated","session_id":"ac740000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select throws_ok($$select public.get_crm_forecast()$$,'28000','unauthorized: session assurance required','verified MFA rejects AAL1');
select throws_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'28000','unauthorized: session assurance required','verified MFA rejects AAL1 save');
reset role;
update auth.sessions set aal='aal2' where id='ac740000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac710000-0000-4000-8000-000000000001","role":"authenticated","session_id":"ac740000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select lives_ok($$select public.get_crm_forecast()$$,'live AAL2 read succeeds');
select lives_ok($$select public.save_crm_forecast(pg_temp.forecast_doc(),5)$$,'live AAL2 save succeeds');
select set_config('request.jwt.claims','',true);
reset role;
update public.profiles set is_active=false where user_id='ac710000-0000-4000-8000-000000000006';
set local role authenticated;
select set_config('request.jwt.claim.sub','ac710000-0000-4000-8000-000000000006',true);
select throws_ok($$select public.get_crm_forecast()$$,'42501','forbidden: actor is not approved','inactive reader rejected');
reset role;
grant select on public.crm_forecasts to authenticated;
set local role authenticated;
select is((select count(*) from public.crm_forecasts),0::bigint,'RLS hides all rows even after accidental grant');
reset role;
revoke select on public.crm_forecasts from authenticated;
set local role anon;
select throws_ok($$select public.get_crm_forecast()$$,'42501','permission denied for function get_crm_forecast','anon read RPC denied');
reset role;
set local role service_role;
select throws_ok($$select * from public.crm_forecasts$$,'42501','permission denied for table crm_forecasts','service BYPASSRLS does not bypass ACL');
select throws_ok($$select public.save_crm_forecast('{}',0)$$,'42501','permission denied for function save_crm_forecast','service save RPC denied');
reset role;
select * from finish();
rollback;
