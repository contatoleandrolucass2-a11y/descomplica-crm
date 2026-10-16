\set ON_ERROR_STOP on
\if :baseline
-- Match the observed legacy cardinality using synthetic pages only. This is
-- not a copy of the private production catalog or its backup.
delete from public.app_pages where key in (
  'crm.settings.connected_systems','crm.settings.goals','crm.settings.marketing',
  'crm.settings.partnerships','crm.settings.points','crm.stage.appointments',
  'crm.stage.folders','crm.stage.opportunities','crm.stage.sales','crm.stage.visits'
);
do $$ begin
  if (select count(*) from public.app_pages) <> 17
     or (select count(*) from public.permissions) <> 25 then
    raise exception 'Synthetic atomic baseline must have 17 pages and 25 permissions';
  end if;
end $$;
-- Synthetic sentinels make preservation checks non-vacuous.
insert into auth.users (id,email) values
  ('d9300000-0000-4000-8000-000000000001','atomic-master@example.test'),
  ('d9300000-0000-4000-8000-000000000002','atomic-broker@example.test');
insert into public.profiles (user_id,email,is_active) select id,email,true from auth.users;
insert into public.user_roles (user_id,role_key) values
  ('d9300000-0000-4000-8000-000000000001','master'),
  ('d9300000-0000-4000-8000-000000000002','broker_house');
insert into public.user_permission_overrides (user_id,permission_key,effect,reason,granted_by) values
  ('d9300000-0000-4000-8000-000000000002','crm.dashboard.view','deny','Synthetic atomic denial','d9300000-0000-4000-8000-000000000001'),
  ('d9300000-0000-4000-8000-000000000002','crm.stages.view','allow','Synthetic atomic grant','d9300000-0000-4000-8000-000000000001');
insert into public.crm_routines (role_key,rows,revision,updated_by)
values ('corretor','[]',7,'d9300000-0000-4000-8000-000000000001');
insert into public.crm_routine_completions (user_id,week_start,role_key,row_index,day,activity_text,completed_at)
values ('d9300000-0000-4000-8000-000000000002','2026-10-12','corretor',0,'Segunda-feira','Synthetic retained activity','2026-10-12T12:00:00Z');

create schema qa_atomic;
create function qa_atomic.snapshot() returns jsonb language plpgsql as $$
declare result jsonb; table_rows jsonb := '{}'; relation record; rows jsonb;
begin
  for relation in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t',relation.relname) into rows;
    table_rows := table_rows || jsonb_build_object(relation.relname, rows);
  end loop;
  select jsonb_build_object(
    'tables',table_rows,
    'routines',(select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p')),
    'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
    'relations',(select jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl,'owner',c.relowner,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','S')),
    'defaultAcl',(select jsonb_agg(to_jsonb(a) order by a.oid) from pg_default_acl a)
  ) into result;
  return result;
end;
$$;
create table qa_atomic.before_state as select qa_atomic.snapshot() as state;
\else
begin;
select plan(26);
select is((select count(*) from public.permissions),38::bigint,'atomic commit has 38 permissions');
select is((select count(*) from public.app_pages),27::bigint,'atomic commit has 27 pages');
select is((select count(*) from public.role_permissions where role_key='master'),38::bigint,'Master has all 38 permissions');
select is((select count(*) from public.role_permissions where role_key='admin'),38::bigint,'Admin has all 38 permissions');
select ok((select (qa_atomic.snapshot()->'tables'->'permissions') @> (state->'tables'->'permissions') from qa_atomic.before_state),'all legacy permission rows survive');
select ok((select (qa_atomic.snapshot()->'tables'->'role_permissions') @> (state->'tables'->'role_permissions') from qa_atomic.before_state),'all legacy role defaults survive');
select ok((select (qa_atomic.snapshot()->'tables'->'user_permission_overrides') @> (state->'tables'->'user_permission_overrides') from qa_atomic.before_state),'legacy overrides including reason and grantor survive');
select is((select qa_atomic.snapshot()->'tables'->'crm_routines'),(select state->'tables'->'crm_routines' from qa_atomic.before_state),'routine data and revisions survive');
select is((select qa_atomic.snapshot()->'tables'->'crm_routine_completions'),(select state->'tables'->'crm_routine_completions' from qa_atomic.before_state),'completion data survives');
select ok((select not is_active from public.app_pages where key='crm.simulation.wf14'),'disabled page stays disabled');
select is((select qa_atomic.snapshot()->'relations'),(select state->'relations' from qa_atomic.before_state),'table ACL owners RLS and force RLS unchanged');
select is((select qa_atomic.snapshot()->'defaultAcl'),(select state->'defaultAcl' from qa_atomic.before_state),'default ACL unchanged');
select ok(not exists(select 1 from jsonb_array_elements((select state->'routines' from qa_atomic.before_state)) old join jsonb_array_elements(qa_atomic.snapshot()->'routines') current on old->>'identity'=current->>'identity' where old->'acl' is distinct from current->'acl' or old->'owner' is distinct from current->'owner'),'routine ACL and owners unchanged');
select ok((select coalesce(jsonb_agg(p order by p->>'oid'),'[]') from jsonb_array_elements(qa_atomic.snapshot()->'policies') p where p->>'polname'='authenticated_session_mfa_gate') = (select coalesce(jsonb_agg(p order by p->>'oid'),'[]') from qa_atomic.before_state, jsonb_array_elements(state->'policies') p where p->>'polname'='authenticated_session_mfa_gate'),'all restrictive MFA gates unchanged');
select is((select count(*) from public.user_permission_overrides where user_id='d9300000-0000-4000-8000-000000000002' and permission_key in ('crm.management.view','crm.management.routine.view') and effect='deny' and reason='Synthetic atomic denial' and granted_by='d9300000-0000-4000-8000-000000000001'),2::bigint,'legacy denial inherited with provenance');
select is((select count(*) from public.user_permission_overrides where user_id='d9300000-0000-4000-8000-000000000002' and permission_key like 'crm.stage.%.view' and effect='allow' and reason='Synthetic atomic grant' and granted_by='d9300000-0000-4000-8000-000000000001'),5::bigint,'legacy allow inherited with provenance');
select is((select count(distinct permission_key) from public.app_pages where section<>'simulation'),20::bigint,'non-simulator pages use independent permissions');
select is((select count(distinct permission_key) from public.app_pages where section='simulation'),1::bigint,'simulators share one permission');
select ok(not has_table_privilege('anon','public.app_pages','SELECT') and not has_table_privilege('authenticated','public.app_pages','INSERT, UPDATE, DELETE'),'catalog browser ACL remains restricted');
select ok(not has_function_privilege('anon','public.get_crm_routines()','EXECUTE') and has_function_privilege('authenticated','public.get_crm_routines()','EXECUTE'),'routine RPC execution ACL remains restricted');
select ok(not exists(select 1 from qa_atomic.before_state, jsonb_array_elements(state->'tables'->'app_pages') old_page where not exists(select 1 from public.app_pages p where p.key=old_page->>'key' and p.is_active=(old_page->>'is_active')::boolean)),'all legacy page keys and visibility survive');
select is((select qa_atomic.snapshot()->'tables'->'user_roles'),(select state->'tables'->'user_roles' from qa_atomic.before_state),'user role assignments survive');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_crm_routines','save_crm_routine','get_crm_routine_completions','set_crm_routine_completion') and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE')),4::bigint,'all four routine RPCs retain authenticated-only API execution');
select is((select count(*) from pg_policy p where p.polrelid in ('public.crm_dashboard_snapshots'::regclass,'public.crm_dashboard_metrics'::regclass,'public.crm_funnel_goals'::regclass,'public.crm_point_settings'::regclass,'public.crm_point_metrics'::regclass) and p.polname='authenticated_session_mfa_gate' and not p.polpermissive),5::bigint,'five target tables retain restrictive MFA policies');
select is((select count(*) from qa_atomic.before_state, jsonb_array_elements(state->'routines') old_routine join jsonb_array_elements(qa_atomic.snapshot()->'routines') new_routine on old_routine->>'identity'=new_routine->>'identity' where old_routine->'definition' is distinct from new_routine->'definition'),4::bigint,'commit changes all four routine definitions');
select is((select count(*) from qa_atomic.before_state, jsonb_array_elements(state->'policies') old_policy join jsonb_array_elements(qa_atomic.snapshot()->'policies') new_policy on old_policy->>'oid'=new_policy->>'oid' where old_policy is distinct from new_policy),5::bigint,'commit changes exactly five target policies');
select * from finish();
rollback;
\ir ../../../supabase/tests/individual_page_data_access.test.sql
\endif
