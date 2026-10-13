begin;
select plan(91);

select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = 'public.crm_routines'::regclass), 'routines enable and force RLS');
select is((select count(*) from pg_policy where polrelid = 'public.crm_routines'::regclass),
  0::bigint, 'no permissive direct-access policies');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(name)
  where has_table_privilege(r.name, 'public.crm_routines', p.name)
), 'API roles have zero direct table privileges');
select ok(not exists (
  select 1 from (values ('anon'), ('service_role')) r(name)
  cross join (values ('public.get_crm_routines()'),
    ('public.save_crm_routine(text,jsonb,bigint)')) f(name)
  where has_function_privilege(r.name, f.name, 'EXECUTE')
), 'anon and service_role cannot execute either RPC');
select ok(has_function_privilege('authenticated', 'public.get_crm_routines()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.save_crm_routine(text,jsonb,bigint)', 'EXECUTE'),
  'authenticated can enter both guarded RPCs');
select ok((select bool_and(prosecdef and pg_get_userbyid(proowner) = 'postgres'
  and 'search_path=""' = any(proconfig)) from pg_proc
  where oid in ('public.get_crm_routines()'::regprocedure,
    'public.save_crm_routine(text,jsonb,bigint)'::regprocedure)),
  'RPCs are postgres-owned definers with an empty search_path');
select is((select count(*) from public.crm_routines), 0::bigint, 'no routine seed');
select is((select count(*) from public.permissions where key like 'crm.routines.%'),
  0::bigint, 'no new permission keys break old authorization clients');
select ok(not exists (select 1 from public.app_pages
  where key in ('crm.management', 'crm.management.routine')
    and permission_key <> 'crm.dashboard.view'), 'existing catalog entries use dashboard view');

create temporary table routine_actors (id uuid primary key, role_key text);
insert into routine_actors values
  ('ab710000-0000-4000-8000-000000000001', 'master'),
  ('ab710000-0000-4000-8000-000000000002', 'admin'),
  ('ab710000-0000-4000-8000-000000000003', 'coordinator'),
  ('ab710000-0000-4000-8000-000000000004', 'manager_house'),
  ('ab710000-0000-4000-8000-000000000005', 'manager_imob'),
  ('ab710000-0000-4000-8000-000000000006', 'broker_house'),
  ('ab710000-0000-4000-8000-000000000007', 'broker_imob'),
  ('ab710000-0000-4000-8000-000000000008', 'pending');
insert into auth.users (id, email)
select id, 'routine-' || role_key || '@example.test' from routine_actors;
select public.bootstrap_master_user('ab710000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values ('ab720000-0000-4000-8000-000000000001', 'routine-test', 'Synthetic Routine', 'house');
insert into public.crm_teams (id, organization_id, team_key, name)
values ('ab730000-0000-4000-8000-000000000001', 'ab720000-0000-4000-8000-000000000001',
  'routine-test', 'Synthetic Routine');
insert into public.crm_people (id, person_key, display_name, auth_user_id)
select id, 'routine-' || role_key, 'Synthetic ' || role_key, id
from routine_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_team_memberships (team_id, person_id, membership_role)
select 'ab730000-0000-4000-8000-000000000001', id, 'broker'
from routine_actors where role_key in ('broker_house', 'broker_imob');
insert into public.crm_reporting_scopes (id, scope_key, scope_type, organization_id, team_id, person_id)
select id, 'routine-' || role_key,
  case when role_key = 'admin' then 'organization'
    when role_key in ('broker_house', 'broker_imob') then 'person' else 'team' end,
  case when role_key = 'admin' then 'ab720000-0000-4000-8000-000000000001'::uuid end,
  case when role_key in ('coordinator', 'manager_house', 'manager_imob')
    then 'ab730000-0000-4000-8000-000000000001'::uuid end,
  case when role_key in ('broker_house', 'broker_imob') then id end
from routine_actors where role_key not in ('master', 'pending');
insert into public.crm_user_reporting_scope_grants (user_id, reporting_scope_id, granted_by, reason)
select id, id, 'ab710000-0000-4000-8000-000000000001', 'Synthetic routine fixture'
from routine_actors where role_key not in ('master', 'pending');
update public.user_roles u set role_key = a.role_key,
  assigned_by = 'ab710000-0000-4000-8000-000000000001'
from routine_actors a where a.id = u.user_id and a.role_key not in ('master', 'pending');
update public.profiles set is_active = true, access_status = 'approved',
  approved_at = now(), approved_by = 'ab710000-0000-4000-8000-000000000001'
where user_id in (select id from routine_actors where role_key not in ('master', 'pending'));

create function pg_temp.routine_rows(n integer default 1, cell text default 'synthetic')
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'Segunda-feira', cell, U&'Ter\00E7a-feira', cell, 'Quarta-feira', cell,
    'Quinta-feira', cell, 'Sexta-feira', cell, U&'S\00E1bado', cell, 'Domingo', cell
  )), '[]'::jsonb) from generate_series(1, n);
$$;
create function pg_temp.check_routine_actor(actor uuid, role_name text)
returns setof text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  return next is(public.get_crm_routines() ->> 'can_edit',
    (role_name in ('master', 'admin'))::text, role_name || ' read capability');
  if role_name not in ('master', 'admin') then
    return next throws_ok($q$select public.save_crm_routine('corretor', '[]', 0)$q$,
      '42501', 'forbidden: missing crm.settings.manage', role_name || ' cannot save');
  end if;
end;
$$;
grant select on routine_actors to authenticated;
grant execute on function pg_temp.routine_rows(integer,text),
  pg_temp.check_routine_actor(uuid,text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '', true);
select pg_temp.check_routine_actor(id, role_key)
from routine_actors where role_key <> 'pending' order by role_key;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.get_crm_routines()$$, '28000',
  'unauthorized: authenticated user required', 'read rejects missing auth.uid');
select throws_ok($$select public.save_crm_routine('corretor','[]',0)$$, '28000',
  'unauthorized: authenticated user required', 'save rejects missing auth.uid');
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000008', true);
select throws_ok($$select public.get_crm_routines()$$, '42501',
  'forbidden: actor is not approved', 'pending cannot read');
select throws_ok($$select public.save_crm_routine('corretor','[]',0)$$, '42501',
  'forbidden: actor is not approved', 'pending cannot save');

select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000002', true);
select is(public.get_crm_routines(), '{"routines":[],"can_edit":true}'::jsonb,
  'empty global store returns the complete read contract');
select is(public.save_crm_routine('corretor', pg_temp.routine_rows(), 0) ->> 'revision',
  '1', 'admin creates with expected zero');
select is(public.save_crm_routine('corretor', pg_temp.routine_rows(1, 'updated'), 1) ->> 'revision',
  '2', 'CAS advances exactly once');
select throws_ok($$select public.save_crm_routine('corretor', '[]', 0)$$,
  '40001', 'conflict: routine revision changed', 'duplicate create conflicts');
select throws_ok($$select public.save_crm_routine('corretor', '[]', 1)$$,
  '40001', 'conflict: routine revision changed', 'stale update conflicts');
select throws_ok($$select public.save_crm_routine('gerente-house', '[]', 1)$$,
  '40001', 'conflict: routine revision changed', 'update of missing role conflicts');
select is(public.get_crm_routines() #>> '{routines,0,revision}', '2', 'conflicts preserve revision');
select is(public.get_crm_routines() #> '{routines,0,rows}', pg_temp.routine_rows(1, 'updated'),
  'conflicts preserve payload');
select ok((public.get_crm_routines() #> '{routines,0}') ?& array['role_key','rows','revision','updated_at']
  and not (public.get_crm_routines() #> '{routines,0}') ? 'updated_by', 'read exposes only contract metadata');
select throws_ok($$select * from public.crm_routines$$, '42501',
  'permission denied for table crm_routines', 'even admin cannot read directly');
select throws_ok($$delete from public.crm_routines$$, '42501',
  'permission denied for table crm_routines', 'even admin cannot delete directly');

-- Invalid payloads must fail before any write or audit entry.
select throws_ok(format('select public.save_crm_routine(%L, ''[]'', 0)', key),
  '22023', 'invalid_argument: unknown routine role', 'invalid role: ' || coalesce(key, 'NULL'))
from (values (null::text), ('admin'), ('Corretor')) invalid(key);
select throws_ok(format('select public.save_crm_routine(''corretor'', ''[]'', %L::bigint)', revision),
  '22023', 'invalid_argument: invalid expected revision', 'invalid expected revision')
from (values (null::bigint), (-1), (9007199254740991),
  (9007199254740992), (9223372036854775807)) invalid(revision);
select throws_ok(format('select public.save_crm_routine(''corretor'', %L::jsonb, 2)', payload),
  '22023', 'invalid_argument: rows must be an array', 'non-array is rejected')
from (values (null::jsonb), ('null'::jsonb), ('{}'::jsonb), ('"text"'::jsonb)) invalid(payload);
select throws_ok(format('select public.save_crm_routine(''corretor'', %L::jsonb, 2)', payload),
  '22023', 'invalid_argument: row must be an object', 'non-object row is rejected')
from (values ('[null]'::jsonb), ('[[]]'::jsonb), ('[1]'::jsonb)) invalid(payload);
select throws_ok(format('select public.save_crm_routine(''corretor'', %L::jsonb, 2)', payload),
  '22023', 'invalid_argument: row must contain exactly seven weekdays', 'wrong day keys rejected')
from (values ('[{}]'::jsonb),
  (jsonb_build_array((pg_temp.routine_rows() -> 0) - 'Domingo')),
  (jsonb_build_array((pg_temp.routine_rows() -> 0) || '{"extra":""}')),
  (jsonb_build_array(((pg_temp.routine_rows() -> 0) - 'Domingo') || '{"Sunday":""}')))
  invalid(payload);
select throws_ok(format('select public.save_crm_routine(''corretor'', %L::jsonb, 2)',
  jsonb_set(pg_temp.routine_rows(), '{0,Domingo}', cell)), '22023',
  'invalid_argument: weekday must be a string of at most 4000 characters', 'non-string cell rejected')
from (values ('null'::jsonb), ('1'::jsonb), ('true'::jsonb), ('{}'::jsonb), ('[]'::jsonb)) invalid(cell);
select throws_ok($$select public.save_crm_routine('corretor', pg_temp.routine_rows(1, repeat('a',4001)), 2)$$,
  '22023', 'invalid_argument: weekday must be a string of at most 4000 characters', '4001 chars rejected');
select throws_ok($$select public.save_crm_routine('corretor', pg_temp.routine_rows(201), 2)$$,
  '22023', 'invalid_argument: routine payload limit exceeded', '201 rows rejected');
select throws_ok($$select public.save_crm_routine('corretor', pg_temp.routine_rows(200, repeat('a',1000)), 2)$$,
  '22023', 'invalid_argument: routine payload limit exceeded', 'over 1 MiB rejected');
select lives_ok($$select public.save_crm_routine('gerente-house', pg_temp.routine_rows(200, ''), 0)$$,
  '200 short rows accepted');
select lives_ok($$select public.save_crm_routine('regional-house', pg_temp.routine_rows(1, repeat(U&'\00E1',4000)), 0)$$,
  '4000 Unicode characters accepted');
select lives_ok($$select public.save_crm_routine('regional-house', pg_temp.routine_rows(1, repeat(U&'\+01F680',2000)), 1)$$,
  '2000 supplementary characters fit 4000 UTF-16 units');
select is((select char_length(item #>> '{rows,0,Segunda-feira}')
  from jsonb_array_elements(public.get_crm_routines() -> 'routines') item
  where item ->> 'role_key' = 'regional-house'), 2000,
  'supplementary characters round-trip through read RPC');
select throws_ok($$select public.save_crm_routine('regional-house', pg_temp.routine_rows(1, repeat(U&'\+01F680',2001)), 2)$$,
  '22023', 'invalid_argument: weekday must be a string of at most 4000 characters',
  '2001 supplementary characters cannot poison the shared GET schema');

select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.save_crm_routine('regional-imob', '[]', 0)$$, 'master bypass writes empty array');
select lives_ok($$select public.save_crm_routine('coordenador-vendas', '[]', 0)$$, 'fifth role accepted');
select lives_ok($$select public.save_crm_routine('coordenador-parcerias', '[]', 0)$$, 'sixth role accepted');
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000006', true);
select is(jsonb_array_length(public.get_crm_routines() -> 'routines'), 6, 'broker reads all six global routines');

reset role;
select is((select updated_by from public.crm_routines where role_key = 'corretor'),
  'ab710000-0000-4000-8000-000000000002'::uuid, 'actor recorded server-side');
select is((select count(*) from public.audit_logs where action = 'crm.routine.saved'),
  8::bigint, 'only eight successful writes produced audit entries');
select ok(not exists (select 1 from public.audit_logs where action = 'crm.routine.saved'
  and ((before - array['role_key','revision']) <> '{}'::jsonb
    or (after - array['role_key','revision','row_count','updated_at']) <> '{}'::jsonb)),
  'audit contains metadata only, never routine contents');
insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values ('ab710000-0000-4000-8000-000000000002', 'crm.dashboard.view', 'deny',
  'Synthetic dashboard denial', 'ab710000-0000-4000-8000-000000000001'),
  ('ab710000-0000-4000-8000-000000000006', 'crm.dashboard.view', 'deny',
  'Synthetic reader denial', 'ab710000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.get_crm_routines()$$, '42501',
  'forbidden: missing routine read permission', 'explicit read deny also blocks editor');
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000006', true);
select throws_ok($$select public.get_crm_routines()$$, '42501',
  'forbidden: missing routine read permission', 'explicit deny blocks reader');
reset role;
insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values ('ab710000-0000-4000-8000-000000000002', 'crm.settings.manage', 'deny',
  'Synthetic editor denial', 'ab710000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.save_crm_routine('corretor','[]',2)$$, '42501',
  'forbidden: missing crm.settings.manage', 'explicit deny blocks editor');

-- Real JWT claims cannot use the privileged legacy pgTAP assurance fallback.
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"ab710000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select throws_ok($$select public.get_crm_routines()$$, '28000',
  'unauthorized: session assurance required', 'master read rejects absent live session');
select throws_ok($$select public.save_crm_routine('corretor','[]',2)$$, '28000',
  'unauthorized: session assurance required', 'master save rejects absent live session');
select set_config('request.jwt.claims', '', true);
reset role;
insert into auth.sessions (id, user_id, aal, not_after)
values ('ab740000-0000-4000-8000-000000000001', 'ab710000-0000-4000-8000-000000000001',
  'aal1', now() + interval '1 hour');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('ab750000-0000-4000-8000-000000000001', 'ab710000-0000-4000-8000-000000000001',
  'Synthetic Routine TOTP', 'totp', 'verified', now(), now());
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'ab710000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'session_id', 'ab740000-0000-4000-8000-000000000001', 'aal', 'aal1')::text, true);
select throws_ok($$select public.get_crm_routines()$$, '28000',
  'unauthorized: session assurance required', 'verified MFA rejects AAL1 read');
select throws_ok($$select public.save_crm_routine('corretor','[]',2)$$, '28000',
  'unauthorized: session assurance required', 'verified MFA rejects AAL1 save');
reset role;
update auth.sessions set aal = 'aal2' where id = 'ab740000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'ab710000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'session_id', 'ab740000-0000-4000-8000-000000000001', 'aal', 'aal2')::text, true);
select lives_ok($$select public.get_crm_routines()$$, 'live AAL2 read succeeds');
select lives_ok($$select public.save_crm_routine('corretor','[]',2)$$, 'live AAL2 save succeeds');
select set_config('request.jwt.claims', '', true);
reset role;
update public.profiles set is_active = false where user_id = 'ab710000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.get_crm_routines()$$, '42501',
  'forbidden: actor is not approved', 'inactive user rejected');
reset role;

-- Temporary privilege proves RLS independently of the production ACL.
grant select on public.crm_routines to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.crm_routines), 0::bigint,
  'RLS hides every row even if SELECT is accidentally granted');
reset role;
revoke select on public.crm_routines from authenticated;
set local role anon;
select throws_ok($$select public.get_crm_routines()$$, '42501',
  'permission denied for function get_crm_routines', 'anonymous RPC invocation denied');
reset role;
set local role service_role;
select throws_ok($$select * from public.crm_routines$$, '42501',
  'permission denied for table crm_routines', 'service bypassrls does not bypass table ACL');
select throws_ok($$select public.save_crm_routine('corretor','[]',3)$$, '42501',
  'permission denied for function save_crm_routine', 'service cannot invoke save');
reset role;

update public.crm_routines set revision = 9007199254740990 where role_key = 'corretor';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab710000-0000-4000-8000-000000000001', true);
select is(public.save_crm_routine('corretor', '[]', 9007199254740990) ->> 'revision',
  '9007199254740991', 'last safe JavaScript revision is representable');
select throws_ok($$select public.save_crm_routine('corretor','[]',9007199254740991)$$,
  '22023', 'invalid_argument: invalid expected revision', 'revision cannot exceed MAX_SAFE_INTEGER');
reset role;

select * from finish();
rollback;
