begin;
select plan(72);

insert into auth.users (id,email) values
  ('1ead0000-0000-4000-8000-000000000001','lead-master@example.test'),
  ('1ead0000-0000-4000-8000-000000000002','lead-broker@example.test');
select public.bootstrap_master_user('1ead0000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values
  ('1ead1000-0000-4000-8000-000000000001','lead-core-test','Lead Core Test','house'),
  ('1ead1000-0000-4000-8000-000000000002','lead-hidden-test','Lead Hidden Test','real_estate');
insert into public.crm_teams (id, organization_id, team_key, name)
values ('1ead2000-0000-4000-8000-000000000001','1ead1000-0000-4000-8000-000000000001','lead-core-test','Lead Core Test');
insert into public.crm_people (id, person_key, display_name, auth_user_id)
values ('1ead2100-0000-4000-8000-000000000001','lead-core-broker','Lead Core Broker','1ead0000-0000-4000-8000-000000000002');
insert into public.crm_team_memberships (team_id, person_id, membership_role, valid_from, valid_until)
values ('1ead2000-0000-4000-8000-000000000001','1ead2100-0000-4000-8000-000000000001','broker',now()-interval '1 minute',now()+interval '1 day');
insert into public.crm_reporting_scopes (id, scope_key, scope_type, person_id)
values ('1ead3000-0000-4000-8000-000000000001','lead-core-broker','person','1ead2100-0000-4000-8000-000000000001');
insert into public.crm_user_reporting_scope_grants(user_id,reporting_scope_id,granted_by,reason)
values ('1ead0000-0000-4000-8000-000000000002','1ead3000-0000-4000-8000-000000000001','1ead0000-0000-4000-8000-000000000001','Synthetic lead fixture');
update public.user_roles set role_key='broker_house',assigned_by='1ead0000-0000-4000-8000-000000000001'
where user_id='1ead0000-0000-4000-8000-000000000002';
update public.profiles set is_active=true,access_status='approved',approved_at=now(),approved_by='1ead0000-0000-4000-8000-000000000001'
where user_id='1ead0000-0000-4000-8000-000000000002';

select is((select count(*) from public.permissions where key like 'crm.leads.%' and key in (
  'crm.leads.create','crm.leads.edit','crm.leads.assign','crm.leads.stage.move',
  'crm.leads.activities.manage','crm.leads.messages.manage','crm.leads.tags.manage',
  'crm.leads.close','crm.leads.archive')),9::bigint,'nine action permissions exist');
select is((select count(*) from public.role_permissions where role_key in ('master','admin') and permission_key in (
  'crm.leads.create','crm.leads.edit','crm.leads.assign','crm.leads.stage.move',
  'crm.leads.activities.manage','crm.leads.messages.manage','crm.leads.tags.manage',
  'crm.leads.close','crm.leads.archive')),18::bigint,'master and admin receive every action permission');
select is((select count(*) from public.crm_lead_stages),6::bigint,'canonical funnel stages are seeded');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in (
  'public.crm_lead_sources'::regclass,'public.crm_lead_channels'::regclass,
  'public.crm_lead_lost_reasons'::regclass,'public.crm_lead_stages'::regclass,
  'public.crm_lead_customers'::regclass,'public.crm_lead_interests'::regclass,
  'public.crm_leads'::regclass,'public.crm_lead_stage_history'::regclass,
  'public.crm_lead_activities'::regclass,'public.crm_lead_messages'::regclass,
  'public.crm_lead_tags'::regclass,'public.crm_lead_tag_links'::regclass,
  'public.crm_lead_audit_events'::regclass)), 'all lead tables enable and force RLS');
select ok(not exists (
  select 1 from (values('anon'),('authenticated'),('service_role')) r(name)
  cross join (values('public.crm_leads'),('public.crm_lead_customers'),('public.crm_lead_messages'),('public.crm_lead_audit_events')) t(name)
  cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(name)
  where has_table_privilege(r.name,t.name,p.name)
),'API roles have no direct lead table privileges');
select ok(has_function_privilege('authenticated','public.list_crm_lead_scopes_v1()','EXECUTE')
  and has_function_privilege('authenticated','public.get_crm_lead_catalogs_v1(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.list_crm_leads_v1(jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.list_crm_lead_activities_v1(jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.get_crm_lead_funnel_v1(uuid,jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.get_crm_lead_v1(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.save_crm_lead_v1(uuid,bigint,jsonb,text)','EXECUTE')
  and has_function_privilege('authenticated','public.mutate_crm_lead_v1(uuid,text,jsonb,bigint,text)','EXECUTE'),
  'authenticated enters only guarded lead RPCs');
select ok(not exists (
  select 1 from (values('anon'),('service_role')) r(name)
  cross join (values('public.list_crm_lead_scopes_v1()'),('public.get_crm_lead_catalogs_v1(uuid)'),('public.list_crm_leads_v1(jsonb)'),
    ('public.list_crm_lead_activities_v1(jsonb)'),('public.get_crm_lead_funnel_v1(uuid,jsonb)'),('public.get_crm_lead_v1(uuid)'),
    ('public.save_crm_lead_v1(uuid,bigint,jsonb,text)'),('public.mutate_crm_lead_v1(uuid,text,jsonb,bigint,text)')) f(name)
  where has_function_privilege(r.name,f.name,'EXECUTE')
),'anon and service_role cannot execute lead RPCs');
select ok(not has_function_privilege('authenticated','private.crm_lead_assert_actor(text,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.crm_lead_user_can_access_organization(uuid,uuid)','EXECUTE'),
  'internal lead authorization helpers are not callable by clients');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','',true);
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')$$,
  '28000','unauthorized: authenticated user required','missing UID cannot list leads');
select throws_ok($$select public.save_crm_lead_v1(null,null,'{}','missing-uid-command')$$,
  '28000','unauthorized: authenticated user required','missing UID cannot create leads');

select set_config('request.jwt.claim.sub','1ead0000-0000-4000-8000-000000000002',true);
select throws_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''broker-create-001'')',
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Cliente Bloqueado'))
), '42501','forbidden: missing lead permission','scoped broker without action permission cannot create');
reset role;
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by)
select '1ead0000-0000-4000-8000-000000000002',permission_key,'allow','Synthetic non-list page access','1ead0000-0000-4000-8000-000000000001'
from (values('crm.leads.view'),('crm.leads.pipeline.view'),('crm.leads.activities.view')) permissions(permission_key);
set local role authenticated;
select set_config('request.jwt.claim.sub','1ead0000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')$$,
  '42501','forbidden: missing lead read permission','hub pipeline and activities permissions cannot read nominal list');
select throws_ok($$select public.get_crm_lead_v1('1ead4000-0000-4000-8000-000000000001')$$,
  '42501','forbidden: missing lead read permission','hub pipeline and activities permissions cannot read nominal detail');
select is(public.get_crm_lead_funnel_v1('1ead1000-0000-4000-8000-000000000001')#>>'{metrics,total}',
  '0','pipeline permission can read non-nominal aggregate');
select throws_ok($$select public.get_crm_lead_funnel_v1('1ead1000-0000-4000-8000-000000000001','{"query":"private@example.test"}')$$,
  '42501','forbidden: nominal funnel search requires list permission','pipeline-only actor cannot probe customer PII through search');
reset role;
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by)
values ('1ead0000-0000-4000-8000-000000000002','crm.leads.list.view','allow','Synthetic scope read','1ead0000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','1ead0000-0000-4000-8000-000000000002',true);
select is(jsonb_array_length(public.list_crm_lead_scopes_v1()),1,'scope RPC returns only one authorized organization');
select is(public.list_crm_lead_scopes_v1()#>>'{0,id}','1ead1000-0000-4000-8000-000000000001','scope RPC does not leak another organization');
select throws_ok($$select public.get_crm_lead_catalogs_v1('1ead1000-0000-4000-8000-000000000002')$$,
  '42501','forbidden: lead catalogs unavailable','catalog RPC rejects organization outside actor scope');

select set_config('request.jwt.claim.sub','1ead0000-0000-4000-8000-000000000001',true);
select is(jsonb_array_length(public.get_crm_lead_catalogs_v1('1ead1000-0000-4000-8000-000000000001')->'stages'),
  6,'catalog RPC returns canonical stages for authorized scope');
select is(public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')#>>'{total}',
  '0','authorized empty list reports zero');
select lives_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''lead-create-001'')',
  jsonb_build_object(
    'organizationId','1ead1000-0000-4000-8000-000000000001',
    'stageId',(select id from public.crm_lead_stages where key='new'),
    'sourceId',(select id from public.crm_lead_sources where key='manual'),
    'channelId',(select id from public.crm_lead_channels where key='whatsapp'),
    'priority','high','summary','Busca apartamento',
    'customer',jsonb_build_object('name','Cliente Sintetico','email','lead@example.test','phone','61999990000'),
    'interest',jsonb_build_object('title','Apartamento','transactionKind','buy','budgetMin',200000,'budgetMax',400000)
  )
),'authorized master creates normalized lead');
select is((select count(*) from public.crm_leads),1::bigint,'one lead row exists');
select is((select count(*) from public.crm_lead_customers),1::bigint,'customer is stored separately');
select is((select count(*) from public.crm_lead_interests),1::bigint,'interest is stored separately');
select is((select count(*) from public.crm_lead_stage_history),1::bigint,'creation records initial stage history');
select is((select count(*) from public.crm_lead_audit_events where action='lead.created'),1::bigint,'creation is audited');
select lives_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''lead-create-001'')',
  jsonb_build_object(
    'organizationId','1ead1000-0000-4000-8000-000000000001',
    'stageId',(select id from public.crm_lead_stages where key='new'),
    'sourceId',(select id from public.crm_lead_sources where key='manual'),
    'channelId',(select id from public.crm_lead_channels where key='whatsapp'),
    'priority','high','summary','Busca apartamento',
    'customer',jsonb_build_object('name','Cliente Sintetico','email','lead@example.test','phone','61999990000'),
    'interest',jsonb_build_object('title','Apartamento','transactionKind','buy','budgetMin',200000,'budgetMax',400000)
  )
),'creation idempotency replay succeeds');
select is((select count(*) from public.crm_leads),1::bigint,'creation replay does not duplicate lead');
select throws_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''lead-create-001'')',
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Payload divergente'))
), '40001','conflict: lead idempotency key reused','same organization key rejects divergent create payload');
select is(public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001","query":"Sintetico"}')#>>'{total}',
  '1','search finds normalized customer data');
select is(jsonb_array_length(public.get_crm_lead_v1((select id from public.crm_leads))->'catalogs'->'stages'),
  6,'detail returns stage catalog');
select is(public.get_crm_lead_v1((select id from public.crm_leads))#>>'{customer,email}',
  'lead@example.test','detail returns customer contract');

select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''set_favorite'',''{"favorite":true}'',1,''lead-favorite-001'')',
  (select id from public.crm_leads)
),'favorite mutation succeeds');
select ok((select is_favorite from public.crm_leads),'favorite is persisted');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''archive'',''{}'',1,''lead-stale-001'')',
  (select id from public.crm_leads)
), '40001','conflict: lead version changed','stale mutation is rejected by CAS');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''move_stage'',%L::jsonb,2,''lead-stage-001'')',
  (select id from public.crm_leads),jsonb_build_object('stageId',(select id from public.crm_lead_stages where key='contact'),'reason','Contato iniciado')
),'non-terminal stage movement succeeds');
select is((select status from public.crm_leads),'open','stage movement keeps lead open');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_activity'',%L::jsonb,null,''lead-activity-001'')',
  (select id from public.crm_leads),jsonb_build_object('type','call','title','Ligacao inicial','description','Fixture sintetica')
),'activity append succeeds');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_message'',%L::jsonb,null,''lead-message-001'')',
  (select id from public.crm_leads),jsonb_build_object('direction','outbound','channelId',(select id from public.crm_lead_channels where key='whatsapp'),'body','Mensagem sintetica')
),'message append succeeds');
select is((select count(*) from public.crm_lead_activities),1::bigint,'one activity exists');
select is((select count(*) from public.crm_lead_messages),1::bigint,'one message exists');
select is(public.list_crm_lead_activities_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')#>>'{total}',
  '1','activity read model returns authorized activity count');
select is(public.get_crm_lead_funnel_v1('1ead1000-0000-4000-8000-000000000001')#>>'{metrics,total}',
  '1','funnel read model returns authorized lead metric');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''set_tags'',%L::jsonb,3,''lead-tags-001'')',
  (select id from public.crm_leads),jsonb_build_object('tagIds','[]'::jsonb,'newTags',jsonb_build_array(jsonb_build_object('name','Quente','color','#dc2626')))
),'tag creation and linking succeeds atomically');
select is((select count(*) from public.crm_lead_tags),1::bigint,'organization tag is created');
select is((select count(*) from public.crm_lead_tag_links),1::bigint,'tag is linked to lead');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''close'',%L::jsonb,4,''lead-close-001'')',
  (select id from public.crm_leads),jsonb_build_object('stageId',(select id from public.crm_lead_stages where key='lost'),'lostReasonId',(select id from public.crm_lead_lost_reasons where key='no_interest'),'reason','Sem interesse')
),'lost closure succeeds with reason');
select is((select status from public.crm_leads),'lost','closure persists lost status');
select lives_ok(format('select public.mutate_crm_lead_v1(%L,''archive'',''{}'',5,''lead-archive-001'')',(select id from public.crm_leads)),
  'archive succeeds');
select is(public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')#>>'{total}',
  '0','archived lead is hidden by default');
select lives_ok(format('select public.mutate_crm_lead_v1(%L,''rescue'',''{}'',6,''lead-rescue-001'')',(select id from public.crm_leads)),
  'rescue succeeds');
select is(public.list_crm_leads_v1('{"organizationId":"1ead1000-0000-4000-8000-000000000001"}')#>>'{total}',
  '1','rescued lead returns to default list');
select lives_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''lead-create-001'')',
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000002','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Outro escopo'))
),'same actor and key execute independently in another organization');
select lives_ok(format(
  'select public.save_crm_lead_v1(null,null,%L::jsonb,''lead-create-002'')',
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Outro lead mesmo escopo'))
),'second same-organization lead supports collision tests');

select is((public.mutate_crm_lead_v1(
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  'set_favorite','{"favorite":true}',1,'lead-favorite-001'
)->>'replayed'),'true','exact mutation replay ignores stale CAS and returns prior result');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''set_favorite'',''{"favorite":false}'',null,''lead-favorite-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico')
),'40001','conflict: lead idempotency key reused','mutation key rejects divergent payload');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''set_favorite'',''{"favorite":true}'',1,''lead-favorite-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo')
),'40001','conflict: lead idempotency key reused','mutation key rejects another lead in the same organization');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''set_favorite'',''{"favorite":true}'',1,''lead-favorite-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro escopo')
),'mutation key executes independently in another organization');

select is((public.mutate_crm_lead_v1(
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  'add_activity',jsonb_build_object('type','call','title','Ligacao inicial','description','Fixture sintetica'),null,'lead-activity-001'
)->>'replayed'),'true','exact activity replay returns the original result');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_activity'',%L::jsonb,null,''lead-activity-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  jsonb_build_object('type','call','title','Payload divergente')
),'40001','conflict: lead idempotency key reused','activity key rejects divergent payload');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_activity'',%L::jsonb,null,''lead-activity-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo'),
  jsonb_build_object('type','call','title','Ligacao inicial','description','Fixture sintetica')
),'40001','conflict: lead idempotency key reused','activity key rejects another lead in the same organization');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_activity'',%L::jsonb,null,''lead-activity-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro escopo'),
  jsonb_build_object('type','call','title','Ligacao inicial','description','Fixture sintetica')
),'activity key executes independently in another organization');

select is((public.mutate_crm_lead_v1(
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  'add_message',jsonb_build_object('direction','outbound','channelId',(select id from public.crm_lead_channels where key='whatsapp'),'body','Mensagem sintetica'),null,'lead-message-001'
)->>'replayed'),'true','exact message replay returns the original result');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_message'',%L::jsonb,null,''lead-message-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  jsonb_build_object('direction','outbound','channelId',(select id from public.crm_lead_channels where key='whatsapp'),'body','Payload divergente')
),'40001','conflict: lead idempotency key reused','message key rejects divergent payload');
select throws_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_message'',%L::jsonb,null,''lead-message-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo'),
  jsonb_build_object('direction','outbound','channelId',(select id from public.crm_lead_channels where key='whatsapp'),'body','Mensagem sintetica')
),'40001','conflict: lead idempotency key reused','message key rejects another lead in the same organization');
select lives_ok(format(
  'select public.mutate_crm_lead_v1(%L,''add_message'',%L::jsonb,null,''lead-message-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro escopo'),
  jsonb_build_object('direction','outbound','channelId',(select id from public.crm_lead_channels where key='whatsapp'),'body','Mensagem sintetica')
),'message key executes independently in another organization');

select lives_ok(format(
  'select public.save_crm_lead_v1(%L,1,%L::jsonb,''lead-update-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo'),
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Outro lead mesmo escopo'))
),'save update succeeds with scoped command digest');
select lives_ok(format(
  'select public.save_crm_lead_v1(%L,1,%L::jsonb,''lead-update-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo'),
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'customer',jsonb_build_object('name','Outro lead mesmo escopo'))
),'exact save update replay succeeds despite stale expected version');
select throws_ok(format(
  'select public.save_crm_lead_v1(%L,2,%L::jsonb,''lead-update-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro lead mesmo escopo'),
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='new'),'summary','Payload divergente','customer',jsonb_build_object('name','Outro lead mesmo escopo'))
),'40001','conflict: lead idempotency key reused','save update key rejects divergent payload');
select throws_ok(format(
  'select public.save_crm_lead_v1(%L,7,%L::jsonb,''lead-update-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Cliente Sintetico'),
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000001','stageId',(select id from public.crm_lead_stages where key='lost'),'customer',jsonb_build_object('name','Cliente Sintetico'))
),'40001','conflict: lead idempotency key reused','save update key rejects another lead in the same organization');
select lives_ok(format(
  'select public.save_crm_lead_v1(%L,2,%L::jsonb,''lead-update-001'')',
  (select l.id from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where c.full_name='Outro escopo'),
  jsonb_build_object('organizationId','1ead1000-0000-4000-8000-000000000002','stageId',(select id from public.crm_lead_stages where key='new'),'favorite',true,'customer',jsonb_build_object('name','Outro escopo'))
),'save update key executes independently in another organization');
reset role;

select ok(not exists(select 1 from public.crm_lead_audit_events where metadata::text like '%Mensagem sintetica%'
  or metadata::text like '%lead@example.test%'),'audit metadata does not copy message or customer PII');
select * from finish();
rollback;
