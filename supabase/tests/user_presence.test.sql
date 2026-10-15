begin;

select plan(47);

select has_table('private', 'user_presence', 'presence uses a private table');
select is(
  (select array_agg(column_name::text order by ordinal_position)
   from information_schema.columns where table_schema = 'private' and table_name = 'user_presence'),
  array['user_id', 'last_seen_at']::text[],
  'presence stores only the user and latest server timestamp'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'private.user_presence'::regclass),
  'presence storage enforces RLS'
);
select ok(
  not has_table_privilege('anon', 'private.user_presence', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'private.user_presence', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('service_role', 'private.user_presence', 'SELECT,INSERT,UPDATE,DELETE'),
  'Data API roles have no direct presence-table privileges'
);
select ok(
  has_function_privilege('authenticated', 'public.touch_user_presence()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_user_presence()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_user_directory_contract()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_compact_user_directory_page(integer,text,text,boolean)', 'EXECUTE'),
  'authenticated callers can execute the guarded presence RPCs'
);
select ok(
  not has_function_privilege('anon', 'public.touch_user_presence()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_user_presence()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.touch_user_presence()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.get_user_presence()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.user_presence_uses_scoped_contract()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_user_directory_contract()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.get_user_directory_contract()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_compact_user_directory_page(integer,text,text,boolean)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.get_compact_user_directory_page(integer,text,text,boolean)', 'EXECUTE'),
  'anonymous and service roles have no presence RPC capability'
);
select ok(
  not exists (
    select 1 from pg_catalog.pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
    where procedure.oid in ('public.touch_user_presence()'::regprocedure, 'public.get_user_presence()'::regprocedure, 'public.get_user_directory_contract()'::regprocedure)
      and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot invoke the SECURITY DEFINER entry points'
);
select ok(
  (select bool_and(prosecdef and 'search_path=""' = any(proconfig) and 'statement_timeout=3s' = any(proconfig))
   from pg_catalog.pg_proc where oid in ('public.touch_user_presence()'::regprocedure, 'public.get_user_presence()'::regprocedure, 'public.get_user_directory_contract()'::regprocedure)),
  'presence entry points use bounded execution and an empty search path'
);

insert into auth.users (id, email)
values
  ('a9000000-0000-4000-8000-000000000001', 'presence-master@example.test'),
  ('a9000000-0000-4000-8000-000000000002', 'presence-admin@example.test'),
  ('a9000000-0000-4000-8000-000000000003', 'presence-manager@example.test'),
  ('a9000000-0000-4000-8000-000000000004', 'presence-outside@example.test'),
  ('a9000000-0000-4000-8000-000000000005', 'presence-pending@example.test'),
  ('a9000000-0000-4000-8000-000000000006', 'presence-suspended@example.test'),
  ('a9000000-0000-4000-8000-000000000007', 'presence-revoked@example.test');
select public.bootstrap_master_user('a9000000-0000-4000-8000-000000000001');
insert into public.crm_organizations (id, organization_key, name, kind)
values
  ('b9000000-0000-4000-8000-000000000001', 'presence-org-a', 'Presence Organization A', 'house'),
  ('b9000000-0000-4000-8000-000000000002', 'presence-org-b', 'Presence Organization B', 'house');
insert into public.crm_teams (id, organization_id, team_key, name)
values
  ('c9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'presence-team-a', 'Presence Team A'),
  ('c9000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000002', 'presence-team-b', 'Presence Team B');
insert into public.crm_reporting_scopes (id, scope_key, scope_type, organization_id, team_id)
values
  ('f9000000-0000-4000-8000-000000000001', 'presence-org-a', 'organization', 'b9000000-0000-4000-8000-000000000001', null),
  ('f9000000-0000-4000-8000-000000000002', 'presence-team-a', 'team', null, 'c9000000-0000-4000-8000-000000000001'),
  ('f9000000-0000-4000-8000-000000000003', 'presence-team-b', 'team', null, 'c9000000-0000-4000-8000-000000000002');
update public.user_roles
set role_key = case when user_id = 'a9000000-0000-4000-8000-000000000002' then 'admin' else 'manager_house' end,
    assigned_by = 'a9000000-0000-4000-8000-000000000001'
where user_id in (
  'a9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000003',
  'a9000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000006',
  'a9000000-0000-4000-8000-000000000007'
);
insert into public.crm_user_reporting_scope_grants (user_id, reporting_scope_id, granted_by, reason)
values
  ('a9000000-0000-4000-8000-000000000002', 'f9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'Synthetic presence Admin scope'),
  ('a9000000-0000-4000-8000-000000000003', 'f9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'Synthetic presence manager scope'),
  ('a9000000-0000-4000-8000-000000000004', 'f9000000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-000000000001', 'Synthetic presence outside scope'),
  ('a9000000-0000-4000-8000-000000000006', 'f9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'Synthetic presence suspended scope'),
  ('a9000000-0000-4000-8000-000000000007', 'f9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'Synthetic presence revoked scope');
update public.profiles
set is_active = true, access_status = 'approved', approved_at = now(),
    approved_by = 'a9000000-0000-4000-8000-000000000001'
where user_id in (
  'a9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000003',
  'a9000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000006',
  'a9000000-0000-4000-8000-000000000007'
);

set local role anon;
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'anonymous heartbeat is denied');
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'anonymous presence listing is denied');
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'anonymous callers cannot identify the directory contract');
select throws_ok($$select public.get_compact_user_directory_page()$$, '42501', null, 'anonymous callers cannot use directory pagination');
reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '28000', null, 'heartbeat requires an authenticated identity');
select throws_ok($$select public.get_user_directory_contract()$$, '28000', null, 'directory contract requires an authenticated identity');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000005', true);
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'pending accounts cannot report presence');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000003', true);
select set_config('test.presence_before', clock_timestamp()::text, true);
select lives_ok($$select public.touch_user_presence()$$, 'an approved user can report their own presence');
select throws_ok(
  $$select public.touch_user_presence('a9000000-0000-4000-8000-000000000004'::uuid, now())$$,
  '42883', null, 'heartbeat has no target or client timestamp arguments'
);
select throws_ok(
  $$insert into private.user_presence (user_id, last_seen_at) values ('a9000000-0000-4000-8000-000000000004', now())$$,
  '42501', null, 'direct presence insertion cannot impersonate another user'
);
select throws_ok(
  $$update private.user_presence set last_seen_at = now() + interval '1 day'$$,
  '42501', null, 'direct timestamp updates are denied'
);
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'an approved user without users.view cannot list presence');
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'directory contract requires users.view');
select throws_ok($$select public.get_compact_user_directory_page()$$, '42501', null, 'directory pagination requires users.view');
reset role;
select is(
  (select count(*) from private.user_presence where user_id::text like 'a9000000-%'),
  1::bigint, 'heartbeat creates only the calling user row'
);
select ok(
  (select last_seen_at >= current_setting('test.presence_before')::timestamptz and last_seen_at <= clock_timestamp()
   from private.user_presence where user_id = 'a9000000-0000-4000-8000-000000000003'),
  'heartbeat time comes from the server'
);
select set_config('test.presence_first', (select last_seen_at::text from private.user_presence where user_id = 'a9000000-0000-4000-8000-000000000003'), true);
set local role authenticated;
select is(public.touch_user_presence(), current_setting('test.presence_first')::timestamptz, 'heartbeats inside twenty seconds reuse the existing timestamp');
reset role;
update private.user_presence set last_seen_at = clock_timestamp() - interval '21 seconds'
where user_id = 'a9000000-0000-4000-8000-000000000003';
set local role authenticated;
select ok(public.touch_user_presence() > current_setting('test.presence_first')::timestamptz, 'a heartbeat after the write interval refreshes presence');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000006', true);
select public.touch_user_presence();
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = false, access_status = 'suspended'
where user_id = 'a9000000-0000-4000-8000-000000000006';
update public.crm_user_reporting_scope_grants
set revoked_at = now(),
    revoked_by = 'a9000000-0000-4000-8000-000000000001',
    revocation_reason = 'Synthetic presence revocation'
where user_id = 'a9000000-0000-4000-8000-000000000007';
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000006', true);
set local role authenticated;
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'suspended accounts cannot refresh presence');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000007', true);
select throws_ok($$select public.touch_user_presence()$$, '42501', null, 'accounts without a valid role scope cannot report presence');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000002', true);
select is(public.get_user_directory_contract(), 'scoped', 'a scoped users.view reader receives the verified directory contract');
select throws_ok($$select public.get_compact_user_directory_page()$$, '55000', null, 'the compact pagination RPC cannot bypass scoped authorization');
select is(
  (select array_agg(user_id order by user_id) from public.get_user_presence()),
  (select array_agg(user_id order by user_id) from public.profiles),
  'presence listing exactly matches profiles visible through the existing scoped policy'
);
select is(
  (select count(*) from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000004'),
  0::bigint, 'Administrator cannot read presence outside the delegated organization'
);
select ok(
  (select is_online and last_seen_at is not null from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000003'),
  'a recent heartbeat marks an eligible in-scope user online'
);
select ok(
  (select not is_online and last_seen_at is null from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000002'),
  'self remains visible and offline before any heartbeat'
);
select ok(
  (select not is_online and last_seen_at is not null from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000006'),
  'suspension overrides a recent heartbeat'
);
select is(
  (select count(distinct observed_at) from public.get_user_presence()),
  1::bigint, 'all presence rows share one server observation time'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update private.user_presence set last_seen_at = clock_timestamp() - interval '119 seconds'
where user_id = 'a9000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select ok(
  (select is_online from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000003'),
  'a heartbeat just inside the two-minute window remains online'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update private.user_presence set last_seen_at = clock_timestamp() - interval '121 seconds'
where user_id = 'a9000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select ok(
  (select not is_online and last_seen_at is not null from public.get_user_presence() where user_id = 'a9000000-0000-4000-8000-000000000003'),
  'presence expires after two minutes without relying on last sign-in'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values ('a9000000-0000-4000-8000-000000000003', 'users.view', 'allow', 'Synthetic presence self-view-only permission', 'a9000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is(
  (select array_agg(user_id order by user_id) from public.get_user_presence()),
  array['a9000000-0000-4000-8000-000000000003'::uuid],
  'users.view without management scope exposes only the caller as the profiles policy allows'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = false, access_status = 'suspended'
where user_id = 'a9000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok($$select public.get_user_presence()$$, '42501', null, 'suspended readers lose presence access despite an explicit users.view allow');
reset role;
select set_config('request.jwt.claim.sub', 'a9000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.get_user_presence() where user_id::text like 'a9000000-%'),
  7::bigint, 'Master presence visibility follows its existing global profile scope'
);
select throws_ok($$select * from private.user_presence$$, '42501', null, 'Master has no direct presence-table read privilege');
reset role;
select is(
  (select count(*) from private.user_presence where user_id::text like 'a9000000-%'),
  2::bigint, 'repeated heartbeats and denied requests retain one row per reporting user'
);
select is(
  (select count(*) from pg_catalog.pg_policies where schemaname = 'private' and tablename = 'user_presence'),
  0::bigint, 'private presence storage has no permissive direct-access policy'
);

-- Contract probes must also fail closed when the full schema drifts.
create policy presence_future_scope_restriction on public.profiles as restrictive
  for select to authenticated using (user_id = (select auth.uid()));
set local role authenticated;
select throws_ok($$select public.get_user_directory_contract()$$, '55000', null, 'a changed scoped profile policy is not reported as a recognized contract');
reset role;
drop policy presence_future_scope_restriction on public.profiles;
alter function private.lock_and_assert_actor(uuid) rename to presence_test_missing_actor_guard;
set local role authenticated;
select throws_ok($$select public.get_user_directory_contract()$$, '55000', null, 'a partially installed scoped schema cannot authorize the directory');
reset role;
alter function private.presence_test_missing_actor_guard(uuid) rename to lock_and_assert_actor;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select throws_ok($$select public.get_user_directory_contract()$$, '42501', null, 'directory contract requires a valid session and MFA context');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
