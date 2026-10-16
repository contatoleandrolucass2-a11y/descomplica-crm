-- Compact production already contains these two routine contracts.
\ir ../../../supabase/migrations/20261013014310_crm_shared_routines.sql
\ir ../../../supabase/migrations/20261014020437_crm_routine_completions.sql

insert into auth.users (id,email) values
  ('d9100000-0000-4000-8000-000000000001','page-master@example.test'),
  ('d9100000-0000-4000-8000-000000000002','page-broker@example.test');
insert into public.profiles (user_id,email,is_active) select id,email,true from auth.users;
insert into public.user_roles (user_id,role_key) values
  ('d9100000-0000-4000-8000-000000000001','master'),
  ('d9100000-0000-4000-8000-000000000002','broker_house');
insert into public.user_permission_overrides (user_id,permission_key,effect,reason,granted_by)
values ('d9100000-0000-4000-8000-000000000002','crm.dashboard.view','deny',
  'Synthetic existing module denial','d9100000-0000-4000-8000-000000000001');

\ir ../../../supabase/migrations/20261015202643_sync_page_catalog.sql
\ir ../../../supabase/migrations/20261015202644_routine_individual_page_access.sql

begin;
select plan(14);
select is((select count(*) from public.permissions),38::bigint,'independent pages add thirteen compact permissions');
select is((select count(*) from public.role_permissions where role_key='master'),38::bigint,'Master inherits every new page');
select is((select count(*) from public.role_permissions where role_key='admin'),38::bigint,'Administrator inherits every new page');
select is((select count(*) from public.role_permissions where role_key='broker_house'),14::bigint,'existing operational page access is preserved');
select is((select count(distinct permission_key) from public.app_pages where section<>'simulation'),20::bigint,'each non-simulator page has an independent permission');
select is((select count(distinct permission_key) from public.app_pages where section='simulation'),1::bigint,'simulators keep a single page permission');
select ok(not public._internal_has_permission('d9100000-0000-4000-8000-000000000002','crm.management.view') and not public._internal_has_permission('d9100000-0000-4000-8000-000000000002','crm.management.routine.view'),'legacy module denial is preserved on both newly separated pages');
select ok(public._internal_has_permission('d9100000-0000-4000-8000-000000000002','crm.stage.sales.view'),'denying dashboard does not revoke an unrelated stage permission');

select set_config('request.jwt.claim.sub','d9100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.apply_user_permission_access_draft('d9100000-0000-4000-8000-000000000002',array['crm.management.routine.view'],array[]::text[],array[]::text[],'Synthetic independent page grant')$$,'the existing guarded access API accepts the independent page');
select set_config('request.jwt.claim.sub','d9100000-0000-4000-8000-000000000002',true);
select is((select array_agg(key order by key) from public.app_pages where key like 'crm.management%'),array['crm.management.routine']::text[],'RLS exposes Rotina without exposing Gestão');
select lives_ok($$select public.get_crm_routines()$$,'direct routine reads use their own page access');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_permission_overrides set effect='deny'
where user_id='d9100000-0000-4000-8000-000000000002' and permission_key='crm.management.routine.view';
select set_config('request.jwt.claim.sub','d9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.get_crm_routines()$$,'42501',null,'denied page blocks direct routine RPC reads');
select throws_ok($$select public.get_crm_routine_completions()$$,'42501',null,'denied page blocks direct completion reads');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','Atividade',current_date,true)$$,'42501',null,'denied page blocks direct completion writes');
reset role;
select * from finish();
rollback;
