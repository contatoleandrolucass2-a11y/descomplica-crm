begin;

select plan(10);

select is(
  pg_catalog.to_regprocedure('private.role_isolation_net_fail_closed()'),
  null::regprocedure,
  'compatibility marker creates no helper function'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname in ('public', 'private')
      and function_entry.proname in (
        '_internal_assert_actor_active',
        '_internal_get_role_level',
        '_internal_has_permission',
        '_internal_list_permissions',
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
      and pg_catalog.pg_get_functiondef(function_entry.oid) ~
        '(crm_qlik_relay|qlik_relay)'
  ),
  'Auth/MFA authorization functions have no Qlik relay dependency'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname in ('public', 'private')
      and function_entry.proname in (
        '_internal_assert_actor_active',
        '_internal_get_role_level',
        '_internal_has_permission',
        '_internal_list_permissions',
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
      and pg_catalog.pg_get_functiondef(function_entry.oid) ~
        '(crm_commercial_engine|commercial_engine)'
  ),
  'Auth/MFA authorization functions have no commercial-engine dependency'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname in ('public', 'private')
      and function_entry.proname in (
        '_internal_assert_actor_active',
        '_internal_get_role_level',
        '_internal_has_permission',
        '_internal_list_permissions',
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
      and pg_catalog.pg_get_functiondef(function_entry.oid) ~
        '(has_schema_privilege|to_regnamespace|pg_net)'
  ),
  'Auth/MFA authorization functions have no optional network-schema dependency'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    join pg_catalog.pg_roles role
      on role.rolname in ('crm_qlik_relay', 'crm_commercial_engine')
    cross join lateral pg_catalog.aclexplode(
      coalesce(function_entry.proacl, pg_catalog.acldefault('f', function_entry.proowner))
    ) privilege
    where namespace.nspname in ('public', 'private')
      and function_entry.proname in (
        '_internal_assert_actor_active',
        '_internal_get_role_level',
        '_internal_has_permission',
        '_internal_list_permissions',
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
      and privilege.grantee = role.oid
      and privilege.privilege_type = 'EXECUTE'
  ),
  'dedicated integration roles receive no Auth/MFA function capability'
);

select ok(
  (
    select bool_and(
      function_entry.prosecdef
      and pg_catalog.pg_get_userbyid(function_entry.proowner) = 'postgres'
      and 'search_path=""' = any(function_entry.proconfig)
    )
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname in ('public', 'private')
      and function_entry.proname in (
        '_internal_assert_actor_active',
        '_internal_get_role_level',
        '_internal_has_permission',
        '_internal_list_permissions',
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
  ),
  'Auth/MFA authorization functions stay postgres-owned empty-path security definers'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_session_is_live()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.current_session_is_live()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.current_session_is_live()',
    'EXECUTE'
  ),
  'live-session probe remains authenticated-only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  ),
  'MFA session gate remains authenticated-only'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname in ('public', 'private')
      and policy.policyname = 'authenticated_session_mfa_gate'
      and policy.roles && array['crm_qlik_relay', 'crm_commercial_engine']::name[]
  ),
  'session/MFA RLS policies grant no dedicated integration role'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname in ('qlik_relay', 'commercial_engine')
      and function_entry.proname in (
        'current_session_is_live',
        'current_session_satisfies_mfa',
        'get_role_level',
        'get_user_authorization_context',
        'has_permission'
      )
  ),
  'compatibility marker creates no Auth/MFA object in integration schemas'
);

select * from finish();

rollback;
