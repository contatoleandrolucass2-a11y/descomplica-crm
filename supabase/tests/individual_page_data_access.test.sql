begin;
select plan(29);

insert into auth.users (id,email) values ('d9200000-0000-4000-8000-000000000001','independent-reader@example.test');
do $$ begin
  if to_regclass('public.crm_reporting_scopes') is not null then
    perform public.bootstrap_master_user('d9200000-0000-4000-8000-000000000001');
  else
    insert into public.profiles (user_id,email,is_active)
    values ('d9200000-0000-4000-8000-000000000001','independent-reader@example.test',true);
    insert into public.user_roles (user_id,role_key)
    values ('d9200000-0000-4000-8000-000000000001','master');
  end if;
end $$;
insert into public.user_permission_overrides (user_id,permission_key,effect,reason)
select 'd9200000-0000-4000-8000-000000000001',key,
  case when key in ('pages.view','crm.stage.opportunities.view','crm.dashboard.with_canal_imob.view','crm.settings.goals.view') then 'allow' else 'deny' end,
  'Synthetic independent page fixture' from public.permissions;

delete from public.crm_dashboard_snapshots;
insert into public.crm_dashboard_snapshots (snapshot_key,reference_date,generated_at,source)
values ('global','2026-10-15','2026-10-15T00:00:00Z','Synthetic independent page fixture');
insert into public.crm_dashboard_views (snapshot_id,view_key)
select s.id,v.key from public.crm_dashboard_snapshots s cross join (values ('all'),('with_canal_imob'),('without_canal_imob')) v(key);
insert into public.crm_dashboard_metrics (snapshot_id,view_key,stage_key,current_month)
select s.id,v.key,t.key,10 from public.crm_dashboard_snapshots s
cross join (values ('all'),('with_canal_imob'),('without_canal_imob')) v(key)
cross join (values ('opportunities'),('appointments'),('visits'),('folders'),('sales')) t(key);
insert into public.crm_dashboard_top_developments (snapshot_id,view_key,rank,name,total)
select id,'with_canal_imob',1,'Synthetic',10 from public.crm_dashboard_snapshots;
delete from public.crm_funnel_goals;
insert into public.crm_funnel_goals (profile_key,effective_month) values ('dv','2026-10-01'),('partnerships','2026-10-01');
delete from public.crm_point_settings;
insert into public.crm_point_settings (setting_key) values ('default');
insert into public.crm_point_metrics (setting_key,metric_key) values ('default','sale');

select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select ok(not public.has_permission(auth.uid(),'crm.dashboard.view'),'stage reader has no Dashboard grant');
select is((select count(*) from public.crm_dashboard_snapshots),1::bigint,'independent stage can read snapshot metadata');
select is((select array_agg(view_key||':'||stage_key order by view_key,stage_key) from public.crm_dashboard_metrics),array['with_canal_imob:opportunities']::text[],'only the allowed stage and channel are visible');
select is((select count(*) from public.crm_dashboard_views),0::bigint,'stage access does not expose sales-value summaries');
select is((select count(*) from public.crm_dashboard_top_developments),0::bigint,'stage access does not expose ranking');
select is((select array_agg(profile_key) from public.crm_funnel_goals),array['dv']::text[],'goal page reads its own profile without settings editing');
select is((select count(*) from public.crm_point_settings),0::bigint,'unrelated point settings remain hidden');
select throws_ok($$update public.crm_dashboard_metrics set current_month=99$$,'42501',null,'page access cannot update commercial facts');
select throws_ok($$update public.crm_funnel_goals set sales=99$$,'42501',null,'goal page access cannot update goals');
select throws_ok($$select public.replace_crm_point_settings('{}','{}')$$,'42501',null,'page access does not grant settings replacement');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.app_pages set is_active=false where key in ('crm.stage.opportunities','crm.settings.goals');
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_snapshots),0::bigint,'disabled only stage hides snapshot metadata');
select is((select count(*) from public.crm_dashboard_metrics),0::bigint,'disabled stage hides its metrics');
select is((select count(*) from public.crm_funnel_goals),0::bigint,'disabled goal page hides its profile');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.app_pages set is_active=true where key in ('crm.stage.opportunities','crm.settings.goals');
update public.user_permission_overrides set effect='deny' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key in ('crm.stage.opportunities.view','crm.dashboard.with_canal_imob.view','crm.settings.goals.view');
update public.user_permission_overrides set effect='allow' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key in ('crm.stage.visits.view','crm.dashboard.without_canal_imob.view','crm.settings.partnerships.view','crm.settings.points.view');
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select array_agg(view_key||':'||stage_key order by view_key,stage_key) from public.crm_dashboard_metrics),array['without_canal_imob:visits']::text[],'changed grants expose only the new stage and channel');
select is((select array_agg(profile_key) from public.crm_funnel_goals),array['partnerships']::text[],'partnership goals do not expose DV goals');
select is((select count(*) from public.crm_point_settings),1::bigint,'point page can read its settings without Ranking or editing');
select is((select count(*) from public.crm_point_metrics),1::bigint,'point page can read its metrics');
select throws_ok($$select public.replace_crm_point_settings('{}','{}')$$,'42501',null,'point page still cannot replace settings');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_permission_overrides set effect='deny' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key in ('crm.dashboard.without_canal_imob.view','crm.settings.points.view');
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_metrics),0::bigint,'stage grant without a channel exposes no metrics');
select is((select count(*) from public.crm_point_settings),0::bigint,'point denial hides settings immediately');
select is((select count(*) from public.crm_point_metrics),0::bigint,'point denial hides metrics immediately');
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from public.user_permission_overrides where user_id='d9200000-0000-4000-8000-000000000001' and permission_key='crm.dashboard.view';
update public.user_permission_overrides set effect='deny' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key='crm.settings.partnerships.view';
update public.user_permission_overrides set effect='allow' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key in ('crm.dashboard.with_canal_imob.view','crm.settings.points.view');
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_metrics),5::bigint,'Dashboard keeps its aggregate metrics within the allowed channel');
select is((select array_agg(profile_key) from public.crm_funnel_goals),array['partnerships']::text[],'Imob Dashboard reads only its partnership goal without settings access');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_permission_overrides set effect='deny' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key='crm.dashboard.with_canal_imob.view';
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.crm_funnel_goals),0::bigint,'Dashboard without the Imob view cannot read partnership goals');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_permission_overrides set effect='allow' where user_id='d9200000-0000-4000-8000-000000000001' and permission_key='crm.dashboard.with_canal_imob.view';
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d9200000-0000-4000-8000-000000000001","amr":[{"method":"recovery"}]}',true);
select is((select count(*) from public.crm_dashboard_metrics),0::bigint,'recovery-only session cannot read stage or dashboard data');
select is((select count(*) from public.crm_funnel_goals),0::bigint,'recovery-only session cannot read goals');
reset role;
select set_config('request.jwt.claims','{}',true);
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where user_id='d9200000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','d9200000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.crm_dashboard_metrics),0::bigint,'inactive account cannot read metrics');
select is((select count(*) from public.crm_funnel_goals),0::bigint,'inactive account cannot read goals');
select is((select count(*) from public.crm_point_metrics),0::bigint,'inactive account cannot read points');
reset role;
select * from finish();
rollback;
