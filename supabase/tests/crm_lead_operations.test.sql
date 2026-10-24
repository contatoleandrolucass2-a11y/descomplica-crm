begin;
select plan(53);
insert into auth.users(id,email) values('2ead0000-0000-4000-8000-000000000001','ops-master@example.test');
select public.bootstrap_master_user('2ead0000-0000-4000-8000-000000000001');
insert into public.crm_organizations(id,organization_key,name,kind) values
('2ead1000-0000-4000-8000-000000000001','lead-ops-test','Lead Ops Test','house'),
('2ead1000-0000-4000-8000-000000000002','lead-ops-second','Lead Ops Second','real_estate');
insert into public.crm_lead_workspaces(id,workspace_key,name,kind) values
('2ead1000-0000-4000-8000-000000000001','lead-ops-test','Lead Ops Test','house'),
('2ead1000-0000-4000-8000-000000000002','lead-ops-second','Lead Ops Second','real_estate');

select is((select count(*) from public.permissions where key in('crm.leads.distribution.view','crm.leads.reports.view','crm.leads.settings.view','crm.leads.audit.view','crm.leads.import.view','crm.leads.distribution.manage','crm.leads.distribution.assign','crm.leads.reports.export','crm.leads.import.manage','crm.leads.export','crm.leads.settings.manage')),11::bigint,'five view and six action permissions exist');
select is((select count(*) from public.role_permissions where role_key in('master','admin') and permission_key in('crm.leads.distribution.view','crm.leads.reports.view','crm.leads.settings.view','crm.leads.audit.view','crm.leads.import.view','crm.leads.distribution.manage','crm.leads.distribution.assign','crm.leads.reports.export','crm.leads.import.manage','crm.leads.export','crm.leads.settings.manage')),22::bigint,'master and admin inherit operations permissions');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in('public.crm_lead_distribution_queues'::regclass,'public.crm_lead_distribution_members'::regclass,'public.crm_lead_distribution_memory'::regclass,'public.crm_lead_distribution_rules'::regclass,'public.crm_lead_distribution_events'::regclass,'public.crm_lead_operation_settings'::regclass,'public.crm_lead_import_batches'::regclass,'public.crm_lead_import_rows'::regclass,'public.crm_lead_operations_audit'::regclass)),'all operations tables force RLS');
select ok(not exists(select 1 from(values('anon'),('authenticated'),('service_role'))r(name) cross join(values('public.crm_lead_distribution_queues'),('public.crm_lead_import_rows'),('public.crm_lead_operations_audit'))t(name) cross join(values('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(name) where has_table_privilege(r.name,t.name,p.name)),'API roles have no direct DML');
select ok(has_function_privilege('authenticated','public.get_crm_lead_distribution_v1(uuid)','EXECUTE') and has_function_privilege('authenticated','public.preview_crm_lead_import_v1(uuid,text,jsonb,jsonb)','EXECUTE') and has_function_privilege('authenticated','public.export_crm_leads_v1(uuid,jsonb,integer)','EXECUTE') and has_function_privilege('authenticated','public.purge_crm_lead_import_staging_v1(uuid)','EXECUTE') and has_function_privilege('authenticated','public.list_crm_lead_imports_v1(uuid,integer,integer)','EXECUTE'),'authenticated can enter guarded RPCs');
select ok(not has_function_privilege('anon','public.get_crm_lead_distribution_v1(uuid)','EXECUTE') and not has_function_privilege('anon','public.purge_crm_lead_import_staging_v1(uuid)','EXECUTE') and not has_function_privilege('service_role','public.apply_crm_lead_import_v1(uuid,text)','EXECUTE'),'anon and service cannot execute RPCs');
select ok(not has_function_privilege('authenticated','private.crm_lead_ops_actor(text,uuid)','EXECUTE') and not has_function_privilege('authenticated','private.crm_lead_csv_safe(text)','EXECUTE'),'internal helpers remain private');
select ok(exists(select 1 from pg_extension where extname='pg_cron'),'pg_cron extension is versioned');
select is((select count(*) from cron.job where jobname='crm-lead-import-staging-retention'),1::bigint,'retention schedule is idempotently unique');
select ok((select command like '%delete from public.crm_lead_import_batches%' from cron.job where jobname='crm-lead-import-staging-retention'),'retention job deletes expired preview batches');

set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_crm_lead_settings_v1('2ead1000-0000-4000-8000-000000000001')$$,'28000','unauthorized: authenticated user required','missing UID is denied');
reset role;
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by)
select '2ead0000-0000-4000-8000-000000000001',permission_key,'deny','Synthetic action denial','2ead0000-0000-4000-8000-000000000001'
from (values('crm.leads.distribution.manage'),('crm.leads.reports.export'),('crm.leads.settings.manage'),('crm.leads.import.manage')) denied(permission_key);
select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.get_crm_lead_distribution_v1('2ead1000-0000-4000-8000-000000000001')->>'revision','0','distribution getter uses view permission without manage action');
select is(public.get_crm_lead_report_v1('2ead1000-0000-4000-8000-000000000001','general',current_date,current_date)->>'available','true','report getter uses report view without export action');
select is(public.get_crm_lead_settings_v1('2ead1000-0000-4000-8000-000000000001')->>'revision','0','settings getter uses settings view without manage action');
select is(public.list_crm_lead_operations_audit_v1('2ead1000-0000-4000-8000-000000000001')#>>'{total}','0','audit getter uses audit view permission');
select is(public.list_crm_lead_imports_v1('2ead1000-0000-4000-8000-000000000001')#>>'{total}','0','import history getter uses import view permission');
select throws_ok($$select public.save_crm_lead_distribution_v1('2ead1000-0000-4000-8000-000000000001',0,'{"queues":[],"rules":[]}','Denied mutation reason')$$,'42501','forbidden: missing lead operations permission','view permission does not authorize distribution mutation');
reset role;select set_config('request.jwt.claim.sub','',true);delete from public.user_permission_overrides where user_id='2ead0000-0000-4000-8000-000000000001' and permission_key in('crm.leads.distribution.manage','crm.leads.reports.export','crm.leads.settings.manage','crm.leads.import.manage');
select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.get_crm_lead_settings_v1('2ead1000-0000-4000-8000-000000000001')->>'revision','0','settings start at revision zero');
select is(public.save_crm_lead_settings_v1('2ead1000-0000-4000-8000-000000000001',0,'{"sources":[],"channels":[],"stages":[],"lostReasons":[],"tags":[{"name":"VIP","color":"#112233"}],"alerts":{},"adjustments":{}}','Synthetic settings save')->>'revision','1','settings save uses CAS');
select throws_ok($$select public.save_crm_lead_settings_v1('2ead1000-0000-4000-8000-000000000001',0,'{"sources":[],"channels":[],"stages":[],"lostReasons":[],"tags":[],"alerts":{},"adjustments":{}}','Synthetic stale save')$$,'40001','conflict: settings revision changed','stale settings save is denied');
select is((select count(*) from public.crm_lead_tags where organization_id='2ead1000-0000-4000-8000-000000000001'),1::bigint,'settings synchronize organization tags');

select is(public.save_crm_lead_distribution_v1('2ead1000-0000-4000-8000-000000000001',0,jsonb_build_object('queues',jsonb_build_array(jsonb_build_object('key','main','name','Principal','active',true,'members',jsonb_build_array(jsonb_build_object('userId','2ead0000-0000-4000-8000-000000000001','capacity',10,'weight',2,'active',true)))),'rules',jsonb_build_array(jsonb_build_object('queueKey','main','fallbackQueueKey',null,'name','Padrao','priority',1,'criteria','{}'::jsonb,'active',true))),'Synthetic distribution save')->>'revision','1','distribution configuration saves atomically');
select is(public.set_crm_lead_presence_v1('2ead1000-0000-4000-8000-000000000001',true,10)->>'updatedQueues','1','member checks in');
select is(public.get_crm_lead_distribution_v1('2ead1000-0000-4000-8000-000000000001')#>>'{queues,0,members,0,available}','true','presence is visible in read model');

reset role;
insert into public.crm_lead_customers(id,organization_id,full_name,email,phone) values('2ead2000-0000-4000-8000-000000000001','2ead1000-0000-4000-8000-000000000001','=cmd','safe@example.test','61999999999');
insert into public.crm_leads(id,organization_id,customer_id,stage_id,source_id,channel_id,created_idempotency_key,created_payload_hash,created_by,updated_by) values('2ead3000-0000-4000-8000-000000000001','2ead1000-0000-4000-8000-000000000001','2ead2000-0000-4000-8000-000000000001',(select id from public.crm_lead_stages where key='new'),(select id from public.crm_lead_sources where key='manual'),(select id from public.crm_lead_channels where key='other'),'ops-fixture-create',repeat('0',64),'2ead0000-0000-4000-8000-000000000001','2ead0000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.assign_crm_lead_v1('2ead3000-0000-4000-8000-000000000001',null,'ops-assign-001')->>'outcome','assigned','deterministic assignment selects available member');
select is(public.assign_crm_lead_v1('2ead3000-0000-4000-8000-000000000001',null,'ops-assign-001')->>'replayed','true','assignment is idempotent');
select throws_ok(format(
  'select public.assign_crm_lead_v1(''2ead3000-0000-4000-8000-000000000001'',%L,''ops-assign-001'')',
  (select id from public.crm_lead_distribution_queues where organization_id='2ead1000-0000-4000-8000-000000000001' and key='main')
),'40001','conflict: assignment idempotency key reused','same organization and lead key rejects a different queue payload');
select is((select responsible_user_id::text from public.crm_leads where id='2ead3000-0000-4000-8000-000000000001'),'2ead0000-0000-4000-8000-000000000001','assignment updates lead atomically');
select is(public.get_crm_lead_report_v1('2ead1000-0000-4000-8000-000000000001','general',current_date-1,current_date+1)->>'available','true','reports expose availability explicitly');
select is(public.get_crm_lead_report_v1('2ead1000-0000-4000-8000-000000000001','general',current_date-1,current_date+1)#>>'{summary,total}','1','general report counts scoped lead');
select is(public.export_crm_leads_v1('2ead1000-0000-4000-8000-000000000001')#>>'{rows,0,name}','''=cmd','export neutralizes CSV formula injection');
select is(public.export_crm_leads_v1('2ead1000-0000-4000-8000-000000000001')->>'limit','5000','export applies bounded default');
reset role;
insert into public.crm_lead_customers(id,organization_id,full_name) values
('2ead2000-0000-4000-8000-000000000002','2ead1000-0000-4000-8000-000000000001','Segundo lead'),
('2ead2000-0000-4000-8000-000000000003','2ead1000-0000-4000-8000-000000000002','Outro escopo');
insert into public.crm_leads(id,organization_id,customer_id,stage_id,created_idempotency_key,created_payload_hash,created_by,updated_by) values
('2ead3000-0000-4000-8000-000000000002','2ead1000-0000-4000-8000-000000000001','2ead2000-0000-4000-8000-000000000002',(select id from public.crm_lead_stages where key='new'),'ops-second-create',repeat('1',64),'2ead0000-0000-4000-8000-000000000001','2ead0000-0000-4000-8000-000000000001'),
('2ead3000-0000-4000-8000-000000000003','2ead1000-0000-4000-8000-000000000002','2ead2000-0000-4000-8000-000000000003',(select id from public.crm_lead_stages where key='new'),'ops-cross-create',repeat('2',64),'2ead0000-0000-4000-8000-000000000001','2ead0000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.assign_crm_lead_v1('2ead3000-0000-4000-8000-000000000002',null,'ops-assign-001')$$,'40001','conflict: assignment idempotency key reused','same organization key rejects a different lead command');
select is(public.assign_crm_lead_v1('2ead3000-0000-4000-8000-000000000003',null,'ops-assign-001')->>'outcome','unassigned','same actor and key execute independently in another organization');

select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('a',64),'{}','[{"name":"Importado","email":"import@example.test","phone":"61988888888"}]')->>'status','previewed','import preview stores normalized staging only');
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('a',64),'{}','[{"name":"Importado"}]')->>'replayed','true','preview is idempotent by file hash');
select is(public.apply_crm_lead_import_v1((select id from public.crm_lead_import_batches where file_hash=repeat('a',64)),(select plan_hash from public.crm_lead_import_batches where file_hash=repeat('a',64)))->>'created','1','matching plan applies import');
select is((select count(*) from public.crm_lead_import_rows),0::bigint,'staging rows are removed after apply');
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('b',64),'{}','[{"name":"Expirado"}]')->>'status','previewed','second preview creates expiring staging');
reset role;update public.crm_lead_import_batches set expires_at=now()-interval '1 minute' where file_hash=repeat('b',64);select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.list_crm_lead_imports_v1('2ead1000-0000-4000-8000-000000000001')#>>'{total}','1','history hides expired preview');
select is(public.apply_crm_lead_import_v1((select id from public.crm_lead_import_batches where file_hash=repeat('b',64)),(select plan_hash from public.crm_lead_import_batches where file_hash=repeat('b',64)))->>'status','expired','expired apply returns domain failure after purge');
select is((select count(*) from public.crm_lead_import_batches where file_hash=repeat('b',64)),0::bigint,'expired apply removes batch and staging');
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('c',64),'{}','[{"name":"Para purgar"}]')->>'status','previewed','third preview creates explicit purge fixture');
reset role;update public.crm_lead_import_batches set expires_at=now()-interval '25 hours' where file_hash=repeat('c',64);select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.purge_crm_lead_import_staging_v1('2ead1000-0000-4000-8000-000000000001')->>'purgedBatches','1','explicit purge is scoped and idempotent');
select is(public.purge_crm_lead_import_staging_v1('2ead1000-0000-4000-8000-000000000001')->>'purgedBatches','0','repeated explicit purge is a no-op');
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('d',64),'{}','[{"name":"Preview antigo"}]')->>'status','previewed','preview purge fixture is created');
reset role;update public.crm_lead_import_batches set expires_at=now()-interval '25 hours' where file_hash=repeat('d',64);select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('e',64),'{}','[{"name":"Preview novo"}]')->>'status','previewed','new preview triggers scoped retention cleanup');
select is((select count(*) from public.crm_lead_import_batches where file_hash=repeat('d',64)),0::bigint,'preview entry purges staging older than 24 hours');
select is(public.preview_crm_lead_import_v1('2ead1000-0000-4000-8000-000000000001',repeat('f',64),'{}','[{"name":"Cron fixture"}]')->>'status','previewed','cron retention fixture is created');
reset role;update public.crm_lead_import_batches set expires_at=now()-interval '25 hours' where file_hash=repeat('f',64);
select lives_ok((select command from cron.job where jobname='crm-lead-import-staging-retention'),'scheduled retention SQL executes');
select is((select count(*) from public.crm_lead_import_batches where file_hash=repeat('f',64)),0::bigint,'scheduled retention physically deletes expired batch and cascades staging');
select set_config('request.jwt.claim.sub','2ead0000-0000-4000-8000-000000000001',true);
select ok(not exists(select 1 from public.crm_lead_operations_audit where metadata::text like '%import@example.test%' or metadata::text like '%=cmd%'),'operations audit excludes PII');
select is((select count(*) from public.crm_lead_operations_audit where organization_id='2ead1000-0000-4000-8000-000000000001'),13::bigint,'mutations and retention create scoped audit events');
select * from finish();rollback;
