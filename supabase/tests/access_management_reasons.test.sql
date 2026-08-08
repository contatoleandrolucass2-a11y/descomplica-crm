begin;

select plan(28);

insert into auth.users (id, email)
values
  ('81000000-0000-4000-8000-000000000001', 'access-master@example.test'),
  ('81000000-0000-4000-8000-000000000002', 'access-target@example.test'),
  ('81000000-0000-4000-8000-000000000003', 'access-user@example.test');

update public.user_roles
set role_key = 'master'
where user_id = '81000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.assign_user_role(
    '81000000-0000-4000-8000-000000000002',
    'admin',
    null
  )$$,
  '22023',
  'invalid_argument: reason is required for privilege elevation',
  'privilege elevation requires a reason'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '81000000-0000-4000-8000-000000000002'
  ),
  'user',
  'failed elevation leaves the role unchanged'
);

select lives_ok(
  $$select public.assign_user_role(
    '81000000-0000-4000-8000-000000000002',
    'admin',
    'Responsabilidade administrativa aprovada'
  )$$,
  'Master can elevate a lower user with a reason'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '81000000-0000-4000-8000-000000000002'
  ),
  'admin',
  'approved elevation assigns the admin role'
);

select ok(
  public.has_permission(
    '81000000-0000-4000-8000-000000000002',
    'admin.access'
  ),
  'admin receives access to the administrative panel'
);

select lives_ok(
  $$select public.assign_user_role(
    '81000000-0000-4000-8000-000000000002',
    'user',
    null
  )$$,
  'role downgrade does not require an elevation reason'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '81000000-0000-4000-8000-000000000002'
  ),
  'user',
  'downgrade restores the user role'
);

select throws_ok(
  $$select public.set_user_active(
    '81000000-0000-4000-8000-000000000002',
    false,
    null
  )$$,
  '22023',
  'invalid_argument: reason is required for user deactivation',
  'deactivation requires a reason'
);

select ok(
  (select is_active from public.profiles where user_id = '81000000-0000-4000-8000-000000000002'),
  'failed deactivation leaves the user active'
);

select lives_ok(
  $$select public.set_user_active(
    '81000000-0000-4000-8000-000000000002',
    false,
    'Afastamento operacional registrado'
  )$$,
  'Master can deactivate a lower user with a reason'
);

select ok(
  not (select is_active from public.profiles where user_id = '81000000-0000-4000-8000-000000000002'),
  'approved deactivation suspends the account'
);

select lives_ok(
  $$select public.set_user_active(
    '81000000-0000-4000-8000-000000000002',
    true,
    null
  )$$,
  'reactivation does not require a deactivation reason'
);

select ok(
  (select is_active from public.profiles where user_id = '81000000-0000-4000-8000-000000000002'),
  'reactivation restores the active account'
);

select throws_ok(
  $$select public.set_user_permission_override(
    '81000000-0000-4000-8000-000000000002',
    'crm.dashboard.view',
    'deny',
    '   '
  )$$,
  '22023',
  'invalid_argument: reason is required for permission exceptions',
  'setting an exception requires a meaningful reason'
);

select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = '81000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.dashboard.view'
  ),
  0::bigint,
  'failed exception does not persist an override'
);

select lives_ok(
  $$select public.set_user_permission_override(
    '81000000-0000-4000-8000-000000000002',
    'crm.dashboard.view',
    'deny',
    'Restrição temporária aprovada'
  )$$,
  'Master can set an exception with a reason'
);

select is(
  (
    select effect
    from public.user_permission_overrides
    where user_id = '81000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.dashboard.view'
  ),
  'deny',
  'approved exception is persisted'
);

select throws_ok(
  $$select public.remove_user_permission_override(
    '81000000-0000-4000-8000-000000000002',
    'crm.dashboard.view',
    null
  )$$,
  '22023',
  'invalid_argument: reason is required for permission exceptions',
  'removing an exception requires a reason'
);

select is(
  (
    select effect
    from public.user_permission_overrides
    where user_id = '81000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.dashboard.view'
  ),
  'deny',
  'failed removal preserves the existing exception'
);

select lives_ok(
  $$select public.remove_user_permission_override(
    '81000000-0000-4000-8000-000000000002',
    'crm.dashboard.view',
    'Restrição encerrada pelo responsável'
  )$$,
  'Master can remove an exception with a reason'
);

select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = '81000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.dashboard.view'
  ),
  0::bigint,
  'approved removal deletes the exception'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

select throws_ok(
  $$select public.assign_user_role(
    '81000000-0000-4000-8000-000000000003',
    'broker',
    'Tentativa de autoelevação'
  )$$,
  '42501',
  'forbidden: self-modification is not allowed',
  'ordinary user cannot elevate their own role'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '81000000-0000-4000-8000-000000000003'
  ),
  'user',
  'self-elevation attempt leaves the role unchanged'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.assign_user_role(
    '81000000-0000-4000-8000-000000000002',
    'master',
    'Tentativa de atribuição do papel protegido'
  )$$,
  '42501',
  'forbidden: actor cannot assign role master (level 100)',
  'Master role cannot be assigned through the authenticated RPC'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '81000000-0000-4000-8000-000000000002'
  ),
  'user',
  'protected Master assignment leaves the target role unchanged'
);

reset role;

select ok(
  not has_function_privilege(
    'authenticated',
    'private.enforce_authorization_audit_reason()',
    'execute'
  ),
  'authenticated cannot execute the audit reason trigger function directly'
);

select is(
  (
    select t.tgenabled::text
    from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.audit_logs'::regclass
      and t.tgname = 'audit_logs_require_sensitive_action_reason'
      and not t.tgisinternal
  ),
  'O'::text,
  'audit reason trigger remains enabled'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where target_user_id = '81000000-0000-4000-8000-000000000002'
      and action = 'authorization.role_assigned'
      and nullif(btrim(before ->> 'reason'), '') is not null
  ),
  'successful privilege elevation records its reason'
);

select * from finish();
rollback;
