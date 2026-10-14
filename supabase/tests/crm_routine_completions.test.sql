begin;
select plan(81);

select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = 'public.crm_routine_completions'::regclass), 'RLS enabled and forced');
select is((select count(*) from pg_policy
  where polrelid = 'public.crm_routine_completions'::regclass and polpermissive),
  0::bigint, 'no permissive direct-access policies');
select ok(exists (
  select 1 from pg_policy where polrelid = 'public.crm_routine_completions'::regclass
    and polname = 'authenticated_session_mfa_gate' and not polpermissive and polcmd = '*'
    and polroles = array[(select oid from pg_roles where rolname = 'authenticated')]
    and pg_get_expr(polqual, polrelid) like '%current_session_satisfies_mfa%'
    and pg_get_expr(polwithcheck, polrelid) like '%current_session_satisfies_mfa%'
    and pg_get_expr(polqual, polrelid) like '%auth.uid%'
    and pg_get_expr(polwithcheck, polrelid) like '%auth.uid%'
), 'inventory includes restrictive MFA and ownership gate for USING and WITH CHECK');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(name)
  where has_table_privilege(r.name, 'public.crm_routine_completions', p.name)
), 'API roles have no direct table privileges');
select ok(not exists (
  select 1 from (values ('anon'), ('service_role')) r(name)
  cross join (values ('public.get_crm_routine_completions()'),
    ('public.set_crm_routine_completion(text,integer,text,text,date,boolean)')) f(name)
  where has_function_privilege(r.name, f.name, 'EXECUTE')
), 'anon and service_role cannot enter RPCs');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(name)
  cross join (values ('private.crm_routine_week_start(timestamptz)'),
    ('private.crm_routine_completion_snapshot(uuid,timestamptz)')) f(name)
  where has_function_privilege(r.name, f.name, 'EXECUTE')
), 'no API role can supply an actor or clock to private helpers');
select ok(has_function_privilege('authenticated', 'public.get_crm_routine_completions()', 'EXECUTE')
  and has_function_privilege('authenticated',
    'public.set_crm_routine_completion(text,integer,text,text,date,boolean)', 'EXECUTE'),
  'authenticated can enter guarded RPCs');
select ok((select bool_and(prosecdef and pg_get_userbyid(proowner) = 'postgres'
  and 'search_path=""' = any(proconfig)) from pg_proc
  where oid in ('public.get_crm_routine_completions()'::regprocedure,
    'public.set_crm_routine_completion(text,integer,text,text,date,boolean)'::regprocedure)),
  'RPCs are postgres-owned definers with empty search_path');

-- Calendar is tested at exact instants, independently of the test machine clock.
select is(private.crm_routine_week_start('2026-10-19 02:59:59.999999+00'), date '2026-10-12',
  'UTC Monday before 03:00 is still Sunday in Sao Paulo');
select is(private.crm_routine_week_start('2026-10-19 03:00:00+00'), date '2026-10-19',
  'Monday 00:00 Sao Paulo begins the new week');
select is(private.crm_routine_week_start('2026-10-18 23:59:59.999999-03'), date '2026-10-12',
  'offset representation of Sunday produces same week');
set local timezone = 'Pacific/Auckland';
select is(private.crm_routine_week_start('2026-10-19 02:59:59+00'), date '2026-10-12',
  'session timezone does not advance the business week');
select is((private.crm_routine_completion_snapshot(null, '2026-10-19 02:59:59+00')
  ->> 'resets_at')::timestamptz, '2026-10-19 03:00:00+00'::timestamptz,
  'reset timestamp points to Sao Paulo midnight regardless of session timezone');
select is((private.crm_routine_completion_snapshot(null, '2026-10-19 03:00:00+00')
  ->> 'resets_at')::timestamptz, '2026-10-26 03:00:00+00'::timestamptz,
  'at rollover reset advances to next Monday');
select is(private.crm_routine_week_start('2027-01-01 12:00:00+00'), date '2026-12-28',
  'week crosses year boundary');
set local timezone = 'UTC';

create temporary table completion_actors (id uuid primary key, role_key text);
insert into completion_actors values
  ('ac710000-0000-4000-8000-000000000001', 'master'),
  ('ac710000-0000-4000-8000-000000000002', 'broker_house'),
  ('ac710000-0000-4000-8000-000000000003', 'broker_imob'),
  ('ac710000-0000-4000-8000-000000000004', 'pending');
insert into auth.users (id, email)
select id, 'completion-' || role_key || '@example.test' from completion_actors;
select public.bootstrap_master_user('ac710000-0000-4000-8000-000000000001');
insert into public.crm_organizations (id, organization_key, name, kind)
values ('ac720000-0000-4000-8000-000000000001', 'completion-test', 'Synthetic Completion', 'house');
insert into public.crm_teams (id, organization_id, team_key, name)
values ('ac730000-0000-4000-8000-000000000001', 'ac720000-0000-4000-8000-000000000001',
  'completion-test', 'Synthetic Completion');
insert into public.crm_people (id, person_key, display_name, auth_user_id)
select id, 'completion-' || role_key, 'Synthetic ' || role_key, id
from completion_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_team_memberships (team_id, person_id, membership_role)
select 'ac730000-0000-4000-8000-000000000001', id, 'broker'
from completion_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_reporting_scopes (id, scope_key, scope_type, person_id)
select id, 'completion-' || role_key, 'person', id
from completion_actors where role_key in ('broker_house', 'broker_imob')
on conflict do nothing;
insert into public.crm_user_reporting_scope_grants (user_id, reporting_scope_id, granted_by, reason)
select actor.id, scope.id, 'ac710000-0000-4000-8000-000000000001', 'Synthetic completion fixture'
from completion_actors actor join public.crm_reporting_scopes scope
  on scope.scope_type = 'person' and scope.person_id = actor.id;
update public.user_roles u set role_key = a.role_key,
  assigned_by = 'ac710000-0000-4000-8000-000000000001'
from completion_actors a where a.id = u.user_id and a.role_key in ('broker_house', 'broker_imob');
update public.profiles set is_active = true, access_status = 'approved',
  approved_at = now(), approved_by = 'ac710000-0000-4000-8000-000000000001'
where user_id in (select id from completion_actors where role_key in ('broker_house', 'broker_imob'));
insert into auth.sessions (id, user_id, aal, not_after)
select id, id, 'aal1', now() + interval '1 hour' from completion_actors;

create function pg_temp.completion_login(actor uuid, assurance text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', actor, 'role', 'authenticated', 'session_id', actor, 'aal', assurance)::text, true);
end;
$$;
create function pg_temp.completion_week()
returns date language sql as $$
  select date_trunc('week', clock_timestamp() at time zone 'America/Sao_Paulo')::date;
$$;
create function pg_temp.completion_mark(completed boolean default true)
returns jsonb language sql as $$
  select public.set_crm_routine_completion('corretor', 0, 'Segunda-feira', 'synthetic',
    pg_temp.completion_week(), completed);
$$;
grant execute on function pg_temp.completion_login(uuid,text), pg_temp.completion_week(),
  pg_temp.completion_mark(boolean) to authenticated;

set local role authenticated;
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select is(public.get_crm_routine_completions() -> 'completions', '[]'::jsonb, 'empty store reads empty');
select throws_ok($$select pg_temp.completion_mark()$$, 'RC003',
  'conflict: routine must be saved before completion', 'unsaved defaults cannot be completed');
select throws_ok($$select pg_temp.completion_mark(false)$$, 'RC003',
  'conflict: routine must be saved before completion', 'unsaved defaults cannot be unchecked');
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000001');
select public.save_crm_routine('corretor', jsonb_build_array(jsonb_build_object(
  'Segunda-feira', 'synthetic', U&'Ter\00E7a-feira', 'other', 'Quarta-feira', '',
  'Quinta-feira', E' \t\n', 'Sexta-feira', '', U&'S\00E1bado', '', 'Domingo', 'sunday'
)), 0);
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select is(pg_temp.completion_mark() -> 'completions',
  '[{"role_key":"corretor","row_index":0,"day":"Segunda-feira","activity_text":"synthetic"}]'::jsonb,
  'viewer completes own saved cell with exact contract');
select is(pg_temp.completion_mark() -> 'completions', public.get_crm_routine_completions() -> 'completions',
  'repeated completion is idempotent');
select throws_ok($$select public.save_crm_routine('corretor', '[]', 1)$$, '42501',
  'forbidden: missing crm.settings.manage', 'completion permission never permits content editing');
select is(public.get_crm_routines() #>> '{routines,0,revision}', '1', 'completion does not revise content');

select pg_temp.completion_login('ac710000-0000-4000-8000-000000000003');
select is(public.get_crm_routine_completions() -> 'completions', '[]'::jsonb,
  'second viewer cannot see first viewer completions');
select is(pg_temp.completion_mark(false) -> 'completions', '[]'::jsonb,
  'second viewer cannot remove first viewer completion');
select is(jsonb_array_length(pg_temp.completion_mark() -> 'completions'), 1,
  'second viewer has independent completion');
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000001');
select is(public.get_crm_routine_completions() -> 'completions', '[]'::jsonb,
  'master also reads only own completions');
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select is(jsonb_array_length(public.get_crm_routine_completions() -> 'completions'), 1,
  'first viewer completion remains after second viewer mutations');
select is(pg_temp.completion_mark(false) -> 'completions', '[]'::jsonb, 'own uncheck succeeds');
select is(pg_temp.completion_mark(false) -> 'completions', '[]'::jsonb, 'uncheck is idempotent');
select lives_ok($$select pg_temp.completion_mark()$$, 'own recheck succeeds');

select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','synthetic',
  pg_temp.completion_week() - 7,true)$$, 'RC001', 'conflict: routine completion week changed',
  'stale previous-week client receives rollover conflict');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','synthetic',
  pg_temp.completion_week() + 7,false)$$, 'RC001', 'conflict: routine completion week changed',
  'client cannot select a future week even for uncheck');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','obsolete',
  pg_temp.completion_week(),true)$$, 'RC002', 'conflict: routine activity changed', 'stale text rejected');
select throws_ok($$select public.set_crm_routine_completion('corretor',1,'Segunda-feira','synthetic',
  pg_temp.completion_week(),true)$$, 'RC002', 'conflict: routine activity changed', 'missing row rejected');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Quarta-feira','invented',
  pg_temp.completion_week(),true)$$, 'RC002', 'conflict: routine activity changed', 'empty saved cell rejected');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Quinta-feira','invented',
  pg_temp.completion_week(),true)$$, 'RC002', 'conflict: routine activity changed', 'blank saved cell rejected');

select throws_ok(format('select public.set_crm_routine_completion(%L,%L,%L,%L,%L::date,%L::boolean)',
  role_key, row_index, day, activity, week_start, completed), '22023',
  'invalid_argument: invalid completion', 'malicious or invalid RPC input: ' || label)
from (values
  ('role', 'admin', 0, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), true),
  ('null role', null, 0, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), true),
  ('negative row', 'corretor', -1, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), true),
  ('large row', 'corretor', 200, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), true),
  ('null row', 'corretor', null, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), true),
  ('day injection', 'corretor', 0, '__proto__', 'synthetic', pg_temp.completion_week(), true),
  ('null day', 'corretor', 0, null, 'synthetic', pg_temp.completion_week(), true),
  ('empty text', 'corretor', 0, 'Segunda-feira', '', pg_temp.completion_week(), true),
  ('blank text', 'corretor', 0, 'Segunda-feira', E' \t\n', pg_temp.completion_week(), true),
  ('Unicode blank', 'corretor', 0, 'Segunda-feira', U&'\00A0\FEFF\3000', pg_temp.completion_week(), true),
  ('null text', 'corretor', 0, 'Segunda-feira', null, pg_temp.completion_week(), true),
  ('long text', 'corretor', 0, 'Segunda-feira', repeat('x',4001), pg_temp.completion_week(), true),
  ('UTF16 limit', 'corretor', 0, 'Segunda-feira', repeat(U&'\+01F680',2001), pg_temp.completion_week(), true),
  ('null week', 'corretor', 0, 'Segunda-feira', 'synthetic', null, true),
  ('infinite week', 'corretor', 0, 'Segunda-feira', 'synthetic', 'infinity'::date, true),
  ('null completed', 'corretor', 0, 'Segunda-feira', 'synthetic', pg_temp.completion_week(), null)
) invalid(label, role_key, row_index, day, activity, week_start, completed);

-- Edit through the authoritative RPC, then verify stale reads and stale unchecks.
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000001');
select public.save_crm_routine('corretor', jsonb_set(
  public.get_crm_routines() #> '{routines,0,rows}', '{0,Segunda-feira}', '"changed"'), 1);
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select is(public.get_crm_routine_completions() -> 'completions', '[]'::jsonb,
  'GET excludes completions that no longer match saved text');
select throws_ok($$select pg_temp.completion_mark(false)$$, 'RC002',
  'conflict: routine activity changed', 'obsolete uncheck cannot affect replacement activity');
select is(public.set_crm_routine_completion('corretor', 0, 'Segunda-feira', 'changed',
  pg_temp.completion_week(), true) #>> '{completions,0,activity_text}', 'changed',
  'new text replaces completion for that same cell');
reset role;
select is((select count(*) from public.crm_routine_completions
  where user_id = 'ac710000-0000-4000-8000-000000000002'), 1::bigint,
  'replacement preserves unique actor/week/cell key');

-- Historical rows survive the logical reset; only the selected current week is visible.
insert into public.crm_routine_completions
  (user_id, week_start, role_key, row_index, day, activity_text, completed_at)
values ('ac710000-0000-4000-8000-000000000002', pg_temp.completion_week() - 7,
  'corretor', 0, 'Segunda-feira', 'changed', clock_timestamp() - interval '7 days');
select is(jsonb_array_length(private.crm_routine_completion_snapshot(
  'ac710000-0000-4000-8000-000000000002', clock_timestamp() + interval '7 days') -> 'completions'),
  0, 'following week starts empty without deleting prior rows');
select is((select count(*) from public.crm_routine_completions
  where user_id = 'ac710000-0000-4000-8000-000000000002'), 2::bigint, 'history retained');
set local role authenticated;
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select is(jsonb_array_length(public.get_crm_routine_completions() -> 'completions'), 1,
  'GET does not return previous-week records');
select ok(public.get_crm_routine_completions() ?& array['week_start','resets_at','server_now','completions'],
  'snapshot has complete timer contract');
select ok((public.get_crm_routine_completions() ->> 'server_now')::timestamptz >= transaction_timestamp(),
  'server_now uses observation clock, not transaction start');

select pg_temp.completion_login('ac710000-0000-4000-8000-000000000004');
select throws_ok($$select public.get_crm_routine_completions()$$, '42501',
  'forbidden: actor is not approved', 'pending user cannot read');
select throws_ok($$select pg_temp.completion_mark()$$, '42501',
  'forbidden: actor is not approved', 'pending user cannot write');
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values ('ac710000-0000-4000-8000-000000000003', 'crm.dashboard.view', 'deny',
  'Synthetic completion denial', 'ac710000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000003');
select throws_ok($$select public.get_crm_routine_completions()$$, '42501',
  'forbidden: missing routine read permission', 'explicit permission deny blocks GET');
select throws_ok($$select pg_temp.completion_mark()$$, '42501',
  'forbidden: missing routine read permission', 'explicit permission deny blocks PUT');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('ac750000-0000-4000-8000-000000000001', 'ac710000-0000-4000-8000-000000000002',
  'Synthetic Completion TOTP', 'totp', 'verified', now(), now());
set local role authenticated;
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002');
select throws_ok($$select public.get_crm_routine_completions()$$, '28000',
  'unauthorized: session assurance required', 'verified MFA requires AAL2 for GET');
select throws_ok($$select pg_temp.completion_mark()$$, '28000',
  'unauthorized: session assurance required', 'verified MFA requires AAL2 for PUT');
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$select public.get_crm_routine_completions()$$, '28000',
  'unauthorized: session assurance required', 'JWT AAL2 alone cannot upgrade an AAL1 live session');
reset role;
update auth.sessions set aal = 'aal2' where id = 'ac710000-0000-4000-8000-000000000002';
set local role authenticated;
select lives_ok($$select public.get_crm_routine_completions()$$, 'live AAL2 permits GET');
select lives_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','changed',
  pg_temp.completion_week(),true)$$, 'live AAL2 permits own completion');
reset role;
delete from auth.sessions where id = 'ac710000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.get_crm_routine_completions()$$, '28000',
  'unauthorized: session assurance required', 'revoked session cannot read');
select throws_ok($$select pg_temp.completion_mark()$$, '28000',
  'unauthorized: session assurance required', 'revoked session cannot write');
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
select throws_ok($$select public.get_crm_routine_completions()$$, '28000',
  'unauthorized: authenticated user required', 'missing actor rejected');
select throws_ok($$select pg_temp.completion_mark()$$, '28000',
  'unauthorized: authenticated user required', 'missing actor cannot write');

select throws_ok($$select * from public.crm_routine_completions$$, '42501',
  'permission denied for table crm_routine_completions', 'direct SELECT denied');
select throws_ok($$delete from public.crm_routine_completions$$, '42501',
  'permission denied for table crm_routine_completions', 'direct DELETE denied');
reset role;
-- A temporary grant proves RLS independently of table ACL. Still no permissive policy.
grant select on public.crm_routine_completions to authenticated;
set local role authenticated;
select pg_temp.completion_login('ac710000-0000-4000-8000-000000000001');
select is((select count(*) from public.crm_routine_completions), 0::bigint,
  'RLS denies even master when SELECT is accidentally granted');
reset role;
revoke select on public.crm_routine_completions from authenticated;
set local role anon;
select throws_ok($$select public.get_crm_routine_completions()$$, '42501',
  'permission denied for function get_crm_routine_completions', 'anon cannot invoke GET');
select throws_ok($$select public.set_crm_routine_completion('corretor',0,'Segunda-feira','x',
  '2026-10-12',true)$$, '42501', 'permission denied for function set_crm_routine_completion',
  'anon cannot invoke PUT');
reset role;
set local role service_role;
select throws_ok($$select * from public.crm_routine_completions$$, '42501',
  'permission denied for table crm_routine_completions', 'BYPASSRLS does not bypass table ACL');
select throws_ok($$select public.get_crm_routine_completions()$$, '42501',
  'permission denied for function get_crm_routine_completions', 'service role cannot impersonate through RPC');
reset role;

select * from finish();
rollback;
