begin;
select plan(13);
select has_function('public','read_crm_appointments_goals_range',array['date','date'], 'range reader exists');
select ok(not has_function_privilege('anon','public.read_crm_appointments_goals_range(date,date)','execute'), 'anonymous cannot call range');
select ok(not has_function_privilege('service_role','public.read_crm_appointments_goals_range(date,date)','execute'), 'service role has no range grant');
select ok(has_function_privilege('authenticated','public.read_crm_appointments_goals_range(date,date)','execute'), 'authenticated can call permission-checked range');
select ok(not (select prosecdef from pg_proc where oid = 'public.read_crm_appointments_goals_range(date,date)'::regprocedure), 'range reader is security invoker');

insert into auth.users(id,email) values
 ('ad000000-0000-4000-8000-000000000001','range-master@example.test'),
 ('ad000000-0000-4000-8000-000000000002','range-pending@example.test'),
 ('ad000000-0000-4000-8000-000000000003','range-reader@example.test');
select public.bootstrap_master_user('ad000000-0000-4000-8000-000000000001');
-- A regular broker has a valid person/team scope and explicit stage access.
-- Keep Master immutable; suspension below exercises this regular reader only.
insert into public.crm_organizations(id,organization_key,name,kind)
values ('ad000000-0000-4000-8000-000000000006','appointment-range-test','Synthetic range organization','house');
insert into public.crm_teams(id,organization_id,team_key,name)
values ('ad000000-0000-4000-8000-000000000007','ad000000-0000-4000-8000-000000000006','appointment-range-test','Synthetic range team');
insert into public.crm_people(id,person_key,display_name,auth_user_id)
values ('ad000000-0000-4000-8000-000000000004','appointment-range-reader','Synthetic range reader','ad000000-0000-4000-8000-000000000003');
insert into public.crm_team_memberships(team_id,person_id,membership_role,valid_from,valid_until)
values ('ad000000-0000-4000-8000-000000000007','ad000000-0000-4000-8000-000000000004','broker',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day');
insert into public.crm_reporting_scopes(id,scope_key,scope_type,person_id)
values ('ad000000-0000-4000-8000-000000000005','appointment-range-reader','person','ad000000-0000-4000-8000-000000000004');
insert into public.crm_user_reporting_scope_grants(user_id,reporting_scope_id,granted_by,reason)
values ('ad000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000005','ad000000-0000-4000-8000-000000000001','Synthetic range reader fixture');
update public.user_roles set role_key='broker_house',assigned_by='ad000000-0000-4000-8000-000000000001'
where user_id='ad000000-0000-4000-8000-000000000003';
update public.profiles set is_active=true,access_status='approved',approved_at=clock_timestamp(),approved_by='ad000000-0000-4000-8000-000000000001'
where user_id='ad000000-0000-4000-8000-000000000003';
insert into public.user_permission_overrides(user_id,permission_key,effect,reason,granted_by)
values ('ad000000-0000-4000-8000-000000000003','crm.stage.appointments.view','allow','Synthetic range reader fixture','ad000000-0000-4000-8000-000000000001');
-- Historical policies are selected by the canonical readers, never copied backwards.
insert into public.crm_funnel_goals(profile_key,effective_month,sales)
 values ('dv','2026-09-01',0),('dv','2026-10-01',1)
 on conflict(profile_key,effective_month) do update set sales=excluded.sales;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is(jsonb_array_length(public.read_crm_appointments_goals_range('2026-10-01','2026-10-19')),1, 'H0 returns one month');
select is(jsonb_array_length(public.read_crm_appointments_goals_range('2026-01-01','2026-12-19')),12, 'H11 returns twelve months');
select is(
 public.read_crm_appointments_goals_range('2026-09-01','2026-10-19'),
 jsonb_build_array(
   jsonb_build_object('month','2026-09','individualGoal',public.read_crm_appointments_goal('2026-09-01'),
     'conversionGoals',public.read_crm_appointments_conversion_goals('2026-09-01')),
   jsonb_build_object('month','2026-10','individualGoal',public.read_crm_appointments_goal('2026-10-19'),
     'conversionGoals',public.read_crm_appointments_conversion_goals('2026-10-19'))
 ), 'range exactly matches canonical month-specific policy projections including zero');
select throws_ok($$select public.read_crm_appointments_goals_range('2026-01-02','2026-12-19')$$,'22023',null,'coverage starts at month boundary');
select throws_ok($$select public.read_crm_appointments_goals_range('2024-01-01','2026-12-19')$$,'22023',null,'range cannot exceed analysis contract coverage');
reset role;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.read_crm_appointments_goals_range('2026-10-01','2026-10-19')->0->'individualGoal','null'::jsonb,'unauthorized caller receives no individual goal');
select is(public.read_crm_appointments_goals_range('2026-10-01','2026-10-19')->0->'conversionGoals','null'::jsonb,'unauthorized caller receives no conversion goal');
reset role;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select set_config('test.range_reader_authorized_before', (
  public.has_permission(auth.uid(),'crm.stage.appointments.view')
  and public.read_crm_appointments_goals_range('2026-10-01','2026-10-19')->0->>'individualGoal' is not null
)::text,true);
reset role;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
update public.profiles set is_active=false,access_status='suspended' where user_id='ad000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select ok(current_setting('test.range_reader_authorized_before')::boolean
  and not public.has_permission(auth.uid(),'crm.stage.appointments.view')
  and public.read_crm_appointments_goals_range('2026-10-01','2026-10-19')->0->'individualGoal' = 'null'::jsonb,
  'regular reader has a goal before suspension and none after revocation');
reset role;
select * from finish();
rollback;
