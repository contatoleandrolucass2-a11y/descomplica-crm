-- Compact-schema behavior uses production authorization definitions and only
-- synthetic users. This file is intentionally outside supabase/tests.
begin;
select plan(115);

select ok(not private.user_presence_uses_scoped_contract(), 'fixture uses the verified compact authorization contract');
select is((select count(*) from public.permissions), 25::bigint, 'compact catalog adds only the two deployed inventory brands');
select is((select count(*) from public.role_permissions where role_key = 'admin'), 25::bigint, 'Administrator inherits the complete deployed catalog');
select is((select count(*) from public.role_permissions where permission_key in ('crm.simulators.view', 'crm.simulators.execute')), 14::bigint, 'all seven current roles inherit both simulator permissions');
select is((select count(*) from public.role_permissions where role_key in ('pending', 'user', 'broker', 'supervisor', 'real_estate', 'broker_lead')), 0::bigint, 'pending and legacy roles gain no defaults');
select is((select array_agg(role_key || ':' || permission_key order by permission_key) from public.role_permissions where permission_key like 'crm.inventory.%'), array['admin:crm.inventory.direcional.view', 'admin:crm.inventory.riva.view'], 'only Administrator inherits inventory brands');
select is((select level from public.roles where key = 'admin'), 80, 'Administrator remains at level eighty');
select ok(not exists (select 1 from public.permissions where key in ('crm.simulators.view','crm.simulators.execute','crm.inventory.riva.view','crm.inventory.direcional.view') and min_level <> 10), 'simulator and brand permissions keep their explicit minimum');

insert into auth.users (id, email)
select ('d9000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  'compact-' || number || '@example.test'
from generate_series(1, 9) number;
insert into public.profiles (user_id, email, is_active)
select id, email, id <> 'd9000000-0000-4000-8000-000000000007'::uuid from auth.users;
insert into public.user_roles (user_id, role_key)
values
  ('d9000000-0000-4000-8000-000000000001', 'master'),
  ('d9000000-0000-4000-8000-000000000002', 'admin'),
  ('d9000000-0000-4000-8000-000000000003', 'admin'),
  ('d9000000-0000-4000-8000-000000000004', 'manager_house'),
  ('d9000000-0000-4000-8000-000000000005', 'broker_imob'),
  ('d9000000-0000-4000-8000-000000000006', 'pending'),
  ('d9000000-0000-4000-8000-000000000007', 'broker_house'),
  ('d9000000-0000-4000-8000-000000000008', 'user');

select ok(not public._internal_has_permission('d9000000-0000-4000-8000-000000000001', 'crm.inventory.riva.view'), 'Master does not gain inventory read access');
select ok(public._internal_has_permission('d9000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view') and public._internal_has_permission('d9000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'), 'Administrator effectively inherits both brands');
insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values ('d9000000-0000-4000-8000-000000000002','crm.inventory.riva.view','deny','Synthetic inherited denial','d9000000-0000-4000-8000-000000000001');
select ok(not public._internal_has_permission('d9000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view'), 'an individual denial still overrides Administrator defaults');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(public.get_user_directory_contract(), 'compact', 'authorized viewers receive the verified compact directory contract');
select is(jsonb_array_length(public.get_compact_user_directory_page()->'profiles'), 6, 'directory pagination returns at most six profiles');
select is((public.get_compact_user_directory_page()->>'total_count')::integer, 9, 'directory pagination counts every matching profile on the server');
select is(public.get_compact_user_directory_page(0,'','all',true)->'summary', '{"total":9,"active":5,"pending":0,"revoked":1}'::jsonb, 'compact summary distinguishes operational, legacy, pending-role and suspended profiles');
select is((select array_agg(entry->>'user_id') from jsonb_array_elements(public.get_compact_user_directory_page()->'profiles') entry), array['d9000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000002','d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000004','d9000000-0000-4000-8000-000000000005','d9000000-0000-4000-8000-000000000006'], 'equal creation timestamps have a stable user-id order');
select is(jsonb_array_length(public.get_compact_user_directory_page(6)->'profiles'), 3, 'a later offset returns only the remaining profiles');
select is((public.get_compact_user_directory_page(0,'','active')->>'total_count')::integer, 5, 'active filter requires an active profile and a current operational role');
select is((public.get_compact_user_directory_page(0,'','inactive')->>'total_count')::integer, 1, 'inactive filter counts only suspended profiles');
select is(public.get_compact_user_directory_page(0,'','pending')->'profiles', '[]'::jsonb, 'compact directory does not invent pending approvals');
select is((public.get_compact_user_directory_page(0,'','pending')->>'total_count')::integer, 0, 'pending count is zero without the approval contract');
select is((public.get_compact_user_directory_page(0,'  COMPACT-4  ','active')->>'total_count')::integer, 1, 'email search is trimmed and case-insensitive');
select is(public.get_compact_user_directory_page(0,'compact-4','active',true)->'summary', '{"total":9,"active":5,"pending":0,"revoked":1}'::jsonb, 'summary stays global while the result count follows search and status');
select is(public.get_compact_user_directory_page()->'summary', 'null'::jsonb, 'summary is omitted unless requested');
select is(public.get_compact_user_directory_page(0,'compact-8')->'profiles'->0->>'access_status', 'legacy_review', 'active legacy roles are not presented as approved');
select is(public.get_compact_user_directory_page(0,'compact-9')->'profiles'->0->>'access_status', 'legacy_review', 'active profiles without a role are not presented as approved');
select is(public.get_compact_user_directory_page(0,'compact-6')->'profiles'->0->>'access_status', 'legacy_review', 'a pending role is not presented as a current operational role');
select is(public.get_compact_user_directory_page(0,'compact-7')->'profiles'->0->>'access_status', 'suspended', 'an inactive operational user is presented as suspended');
select is(public.get_compact_user_directory_page(999)->'profiles', '[]'::jsonb, 'offset past the final row produces an empty page');
select is((public.get_compact_user_directory_page(999)->>'total_count')::integer, 9, 'empty pages retain the exact filtered count');
select is((public.get_compact_user_directory_page(0,'%')->>'total_count')::integer, 0, 'search treats SQL wildcard characters literally');
select throws_ok($$select public.get_compact_user_directory_page(-1)$$, '22023', null, 'negative offsets are rejected');
select throws_ok($$select public.get_compact_user_directory_page(null)$$, '22023', null, 'null offsets are rejected');
select throws_ok($$select public.get_compact_user_directory_page(0,'','invalid')$$, '22023', null, 'unknown status filters are rejected');
select throws_ok($$select public.get_compact_user_directory_page(0,repeat('x',201))$$, '22023', null, 'search input is bounded');
select throws_ok($$select public.get_compact_user_directory_page(0,'','all',null)$$, '22023', null, 'ambiguous summary arguments are rejected');
select is((select count(*) from public.get_user_role_permission_defaults() where role_key = 'admin'), 25::bigint, 'default catalog RPC returns the compact Administrator catalog');
select lives_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000004', array['crm.inventory.riva.view'], 'allow', 'Synthetic RIVA access')$$, 'Master can delegate RIVA without possessing RIVA');
select ok(public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.riva.view') and not public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.direcional.view'), 'RIVA-only access does not include DIRECIONAL');
select lives_ok($$select public.apply_user_permission_access_draft('d9000000-0000-4000-8000-000000000004', array['crm.inventory.direcional.view'], array['crm.inventory.riva.view'], array[]::text[], 'Synthetic independent brands')$$, 'mixed draft atomically switches independent brands');
select ok(not public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.riva.view') and public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.direcional.view'), 'DIRECIONAL-only access does not include RIVA');
select lives_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000004', array['crm.inventory.riva.view'], 'allow', 'Synthetic both brands')$$, 'brands may also be granted together');
select ok(public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.riva.view') and public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.direcional.view'), 'both grants provide both brand permissions');
select lives_ok($$select public.assign_user_role_defaults('d9000000-0000-4000-8000-000000000004','manager_imob')$$, 'role defaults restore through the compact guarded RPCs');
select is((select count(*) from public.user_permission_overrides where user_id = 'd9000000-0000-4000-8000-000000000004'), 0::bigint, 'role assignment clears delegable exceptions atomically');
select ok(not public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.riva.view') and not public.has_permission('d9000000-0000-4000-8000-000000000004', 'crm.inventory.direcional.view'), 'operational role defaults deny both inventory brands');
select throws_ok($$select public.assign_user_role_defaults('d9000000-0000-4000-8000-000000000001','admin')$$, '42501', null, 'role-default restoration cannot modify the caller');
select throws_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000001', array['crm.inventory.riva.view'], 'allow', 'Synthetic prohibited self grant')$$, '42501', null, 'brand access cannot be self-granted');

select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000005', array['crm.inventory.riva.view'], 'allow', 'Synthetic Administrator delegation')$$, 'Administrator denied RIVA can still manage a lower user RIVA access');
select throws_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000003', array['crm.inventory.riva.view'], 'allow', 'Synthetic prohibited peer grant')$$, '42501', null, 'Administrator cannot edit a peer');
select throws_ok($$select public.assign_user_role_defaults('d9000000-0000-4000-8000-000000000005','admin')$$, '42501', null, 'Administrator cannot promote a user to Administrator');
select throws_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000005', array['permissions.manage'], 'allow', 'Synthetic prohibited same-level delegation')$$, '42501', null, 'full Administrator inheritance does not bypass permission minimums');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.set_user_permission_overrides_bulk('d9000000-0000-4000-8000-000000000005', array['crm.inventory.riva.view'], 'allow', 'Synthetic prohibited unprivileged grant')$$, '42501', null, 'brand delegation still requires permissions.manage');
select is((select count(*) from public.get_user_role_permission_defaults()), 0::bigint, 'role defaults require users.view');
reset role;

-- A missing permissions.view must not masquerade as an empty exception list.
select set_config('request.jwt.claim.sub', '', true);
insert into public.user_permission_overrides (user_id,permission_key,effect,reason,granted_by)
values ('d9000000-0000-4000-8000-000000000002','permissions.view','deny','Synthetic unreadable overrides','d9000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.assign_user_role_defaults('d9000000-0000-4000-8000-000000000005','manager_imob')$$, '42501', null, 'role-default restoration requires permission visibility');
reset role;
select is((select role_key from public.user_roles where user_id = 'd9000000-0000-4000-8000-000000000005'), 'broker_imob', 'denied role restoration retains the original role');

select ok(not has_table_privilege('authenticated','private.user_presence','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon','private.user_presence','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('service_role','private.user_presence','SELECT,INSERT,UPDATE,DELETE'), 'presence storage grants no direct Data API access');
select ok(not has_function_privilege('authenticated','private.user_presence_uses_scoped_contract()','EXECUTE') and not has_function_privilege('anon','public.touch_user_presence()','EXECUTE') and not has_function_privilege('service_role','public.get_user_presence()','EXECUTE'), 'internal and presence RPC grants stay narrow');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.user_presence'::regclass), 'private presence storage forces RLS');
set local role anon;
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'anonymous heartbeat is rejected');
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'anonymous presence reads are rejected');
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'anonymous callers cannot identify the directory contract');
select throws_ok($$select public.get_compact_user_directory_page()$$, '42501', null, 'anonymous callers cannot paginate the directory');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'heartbeat requires a caller identity');
select throws_ok($$select public.get_user_directory_contract()$$, '28000', null, 'directory contract requires a caller identity');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000006', true);
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'pending accounts cannot report online');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000007', true);
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'inactive accounts cannot report online');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000008', true);
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'legacy roles cannot report online');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000009', true);
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'an account without a role cannot report online');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000004', true);
select set_config('test.presence_before', clock_timestamp()::text, true);
select lives_ok($$select public.touch_user_presence()$$, 'a current active user can report their own heartbeat');
select throws_ok($$select public.touch_user_presence('d9000000-0000-4000-8000-000000000005'::uuid, now())$$, '42883', null, 'the RPC accepts neither target nor timestamp injection');
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'presence readers require users.view');
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'directory contract requires users.view');
select throws_ok($$select public.get_compact_user_directory_page()$$, '42501', null, 'directory pagination requires users.view');
select throws_ok($$insert into private.user_presence values ('d9000000-0000-4000-8000-000000000005', now())$$, '42501', null, 'direct writes cannot spoof a different user');
reset role;
select is((select count(*) from private.user_presence), 1::bigint, 'only the calling user receives a heartbeat row');
select ok((select last_seen_at >= current_setting('test.presence_before')::timestamptz and last_seen_at <= clock_timestamp() from private.user_presence), 'heartbeat timestamps come from the server');
select set_config('test.presence_first', (select last_seen_at::text from private.user_presence), true);
set local role authenticated;
select is(public.touch_user_presence(), current_setting('test.presence_first')::timestamptz, 'heartbeats inside twenty seconds do not rewrite the row');
reset role;
update private.user_presence set last_seen_at = clock_timestamp() - interval '21 seconds';
set local role authenticated;
select ok(public.touch_user_presence() > current_setting('test.presence_first')::timestamptz, 'the heartbeat refreshes after twenty seconds');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
select is((select array_agg(user_id order by user_id) from public.get_user_presence()), (select array_agg(user_id order by user_id) from public.profiles), 'compact presence exactly matches current profiles visibility');
select is((select count(*) from public.get_user_presence()), 9::bigint, 'the existing global users.view contract includes every visible profile');
select ok((select is_online from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000004'), 'a recent eligible heartbeat is online');
select ok((select not is_online and last_seen_at is null from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000002'), 'the caller remains visible offline before their first heartbeat');
reset role;
update private.user_presence set last_seen_at = clock_timestamp() - interval '121 seconds';
set local role authenticated;
select ok((select not is_online from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000004'), 'heartbeat expires after two minutes');
reset role;
update private.user_presence set last_seen_at = clock_timestamp() + interval '1 day';
set local role authenticated;
select ok((select not is_online from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000004'), 'a future timestamp cannot mark a user online');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update private.user_presence set last_seen_at = clock_timestamp();
update public.profiles set is_active = false where user_id = 'd9000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select ok((select not is_online from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000004'), 'suspension overrides a recent heartbeat');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = true where user_id = 'd9000000-0000-4000-8000-000000000004';

-- The fixture uses the live session/MFA implementations, not a permissive stub.
insert into public.user_permission_overrides (user_id,permission_key,effect,reason,granted_by)
values ('d9000000-0000-4000-8000-000000000004','users.view','allow','Synthetic compact reader','d9000000-0000-4000-8000-000000000001');
insert into auth.sessions (id,user_id,aal)
values ('d9100000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000004','aal1');
insert into auth.mfa_factors (id,user_id,status)
values ('d9200000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000004','verified');
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000004","session_id":"d9100000-0000-4000-8000-000000000001","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'verified MFA cannot be bypassed with an aal1 session');
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'users.view cannot bypass an incomplete MFA session');
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'directory contract rejects incomplete MFA');
select throws_ok($$select public.get_compact_user_directory_page()$$, '42501', null, 'directory pagination rejects incomplete MFA');
reset role;
update auth.sessions set aal = 'aal2';
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000004","session_id":"d9100000-0000-4000-8000-000000000001","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.touch_user_presence()$$, 'verified aal2 session can report presence');
select lives_ok($$select public.get_user_presence()$$, 'a users.view reader with verified aal2 can list presence');
select is(public.get_user_directory_contract(), 'compact', 'directory contract accepts a valid aal2 viewer');
select lives_ok($$select public.get_compact_user_directory_page()$$, 'directory pagination accepts a valid aal2 viewer');
reset role;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000004","session_id":"d9100000-0000-4000-8000-000000000001","aal":"aal2","amr":[{"method":"recovery"}]}', true);
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'recovery sessions cannot report presence');
reset role;
select set_config('request.jwt.claims', '{"sub":"d9000000-0000-4000-8000-000000000004","session_id":"d9100000-0000-4000-8000-000000000001","aal":"aal2"}', true);
update auth.sessions set not_after = now() - interval '1 second';
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'an expired session cannot report presence');
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select is((select array_agg(user_id order by user_id) from public.get_user_presence()), (select array_agg(user_id order by user_id) from public.profiles), 'a users.view-only reader follows the same compact profile policy');
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = false where user_id = 'd9000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'suspension denies presence reads despite explicit users.view');
reset role;

-- A future scope migration must not leave a global SECURITY DEFINER bypass.
select set_config('request.jwt.claim.sub', '', true);
create policy compact_future_restriction on public.profiles as restrictive
  for select to authenticated using (user_id = (select auth.uid()));
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.get_user_presence()$$, '55000', null, 'an unrecognized profile restriction makes compact presence fail closed');
select throws_ok($$select public.get_user_directory_contract()$$, '55000', null, 'a new profile policy invalidates the directory contract');
select throws_ok($$select public.get_compact_user_directory_page()$$, '55000', null, 'a new profile policy blocks compact pagination');
reset role;
drop policy compact_future_restriction on public.profiles;
alter table public.profiles add column access_status text;
set local role authenticated;
select throws_ok($$select public.get_user_presence()$$, '55000', null, 'a partially installed scoped contract fails closed');
select throws_ok($$select public.get_user_directory_contract()$$, '55000', null, 'a partial scoped install invalidates the directory contract');
select throws_ok($$select public.get_compact_user_directory_page()$$, '55000', null, 'a partial scoped install blocks compact pagination');
reset role;
alter table public.profiles drop column access_status;

select ok(not has_table_privilege('authenticated','public.role_permissions','SELECT') and not has_table_privilege('authenticated','public.permissions','SELECT'), 'catalog RPCs add no direct catalog-table privileges');
select ok(not has_function_privilege('authenticated','public.can_grant_permission(uuid,text)','EXECUTE'), 'brand delegation helper remains internal');
select is((select count(*) from private.user_presence), 1::bigint, 'denied calls and refreshes keep only one row per reporting account');
select is((select count(*) from pg_policies where schemaname = 'private' and tablename = 'user_presence'), 0::bigint, 'presence table has no permissive policy');

select ok(
  not has_function_privilege('anon','public.get_user_directory_contract()','EXECUTE')
  and not has_function_privilege('service_role','public.get_user_directory_contract()','EXECUTE')
  and not has_function_privilege('anon','public.get_compact_user_directory_page(integer,text,text,boolean)','EXECUTE')
  and not has_function_privilege('service_role','public.get_compact_user_directory_page(integer,text,text,boolean)','EXECUTE'),
  'directory RPCs have no anonymous or service execution privilege'
);
select ok((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.get_compact_user_directory_page(integer,text,text,boolean)'::regprocedure), 'compact pagination uses invoker rights with an empty search path');
create policy compact_role_visibility_test on public.user_roles as restrictive
  for select to authenticated using (user_id = (select auth.uid()));
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((public.get_compact_user_directory_page(0,'','active')->>'total_count')::integer, 1, 'compact pagination honors caller RLS on the joined user roles');
reset role;
drop policy compact_role_visibility_test on public.user_roles;

-- Disabling new assignments of a role must not revoke existing users. The
-- compact account guards do not use roles.is_assignable for session eligibility.
select set_config('request.jwt.claim.sub', '', true);
update public.roles set is_assignable = false where key = 'broker_imob';
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select lives_ok($$select public.touch_user_presence()$$, 'existing users can report presence when their role cannot receive new assignments');
select set_config('request.jwt.claim.sub', 'd9000000-0000-4000-8000-000000000001', true);
select is(public.get_compact_user_directory_page(0,'compact-5')->'profiles'->0->>'access_status', 'approved', 'directory eligibility follows existing account access rather than role assignability');
select ok((select is_online from public.get_user_presence() where user_id = 'd9000000-0000-4000-8000-000000000005'), 'presence eligibility matches the active directory account for an existing non-assignable role');
select throws_ok($$select public.assign_user_role('d9000000-0000-4000-8000-000000000004','broker_imob','Synthetic rejected role assignment')$$, '42501', null, 'the same non-assignable role still rejects new assignments');
reset role;

select * from finish();
rollback;
