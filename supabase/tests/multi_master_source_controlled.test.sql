begin;

select plan(22);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_index index_entry
    where index_entry.indrelid = 'public.user_roles'::regclass
      and index_entry.indisunique
      and pg_catalog.pg_get_expr(index_entry.indpred, index_entry.indrelid) ilike '%master%'
  ),
  'no unique partial index limits the number of Master identities'
);

select has_index(
  'public',
  'user_roles',
  'user_roles_role_key_idx',
  'role lookup remains indexed after removing single-Master uniqueness'
);

select has_function(
  'public',
  'bootstrap_master_user',
  array['uuid'],
  'source-controlled Master bootstrap exists'
);

select ok(
  (
    select function_entry.prosecdef
      and pg_catalog.pg_get_userbyid(function_entry.proowner) = 'postgres'
      and function_entry.proconfig = array['search_path=""']::text[]
    from pg_catalog.pg_proc function_entry
    where function_entry.oid = 'public.bootstrap_master_user(uuid)'::regprocedure
  ),
  'Master bootstrap is a postgres-owned empty-path security definer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.bootstrap_master_user(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute Master bootstrap'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.bootstrap_master_user(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute Master bootstrap'
);

select ok(
  not pg_catalog.has_function_privilege(
    'service_role',
    'public.bootstrap_master_user(uuid)',
    'EXECUTE'
  ),
  'service_role cannot execute Master bootstrap'
);

select ok(
  not pg_catalog.has_table_privilege(
    'anon',
    'public.user_roles',
    'INSERT,UPDATE,DELETE,TRUNCATE'
  ),
  'anon cannot mutate user roles directly'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.user_roles',
    'INSERT,UPDATE,DELETE,TRUNCATE'
  ),
  'authenticated cannot mutate user roles directly'
);

select ok(
  not pg_catalog.has_table_privilege(
    'service_role',
    'public.user_roles',
    'INSERT,UPDATE,DELETE,TRUNCATE'
  ),
  'service_role cannot mutate user roles directly'
);

insert into auth.users (id, email)
values
  ('b1000000-0000-4000-8000-000000000001', 'multi-master-one@example.test'),
  ('b1000000-0000-4000-8000-000000000002', 'multi-master-two@example.test');

select lives_ok(
  $$select public.bootstrap_master_user('b1000000-0000-4000-8000-000000000001')$$,
  'first source-controlled Master bootstrap succeeds'
);

select lives_ok(
  $$select public.bootstrap_master_user('b1000000-0000-4000-8000-000000000002')$$,
  'second source-controlled Master bootstrap succeeds'
);

select is(
  (
    select count(*)
    from public.user_roles user_role
    where user_role.user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and user_role.role_key = 'master'
  ),
  2::bigint,
  'both independently authenticated identities retain Master'
);

select is(
  (
    select count(*)
    from public.profiles profile
    where profile.user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and profile.is_active
      and profile.access_status = 'approved'
  ),
  2::bigint,
  'both Master profiles are active and approved'
);

select is(
  (
    select count(*)
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where scope_grant.user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and reporting_scope.scope_key = 'global'
      and reporting_scope.scope_type = 'global'
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and (scope_grant.valid_until is null or scope_grant.valid_until > now())
  ),
  2::bigint,
  'each Master receives one active global reporting scope'
);

select is(
  (
    select count(*)
    from public.audit_logs audit_log
    where audit_log.target_user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and audit_log.action = 'authorization.master_bootstrap'
      and audit_log.after ->> 'source' = 'source_controlled'
  ),
  2::bigint,
  'each Master bootstrap creates a source-controlled audit record'
);

select is(
  (
    select public.bootstrap_master_user(
      'b1000000-0000-4000-8000-000000000002'
    ) ->> 'noop'
  ),
  'true',
  'repeating the same complete Master bootstrap is an idempotent no-op'
);

select is(
  (
    select count(*)
    from public.audit_logs audit_log
    where audit_log.target_user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and audit_log.action = 'authorization.master_bootstrap'
      and audit_log.after ->> 'source' = 'source_controlled'
  ),
  2::bigint,
  'idempotent replay creates no duplicate audit record'
);

select ok(
  not public.can_assign_role(
    'b1000000-0000-4000-8000-000000000001',
    'master'
  ),
  'even a Master cannot assign Master through the public hierarchy function'
);

select is(
  (
    select count(*)
    from public.user_roles user_role
    where user_role.user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
      and user_role.role_key = 'master'
  ),
  2::bigint,
  'idempotent replay preserves every existing Master'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.bootstrap_master_user(uuid)'::regprocedure
  ) !~* '(email|password|token|secret)',
  'Master bootstrap contains no identity credential or secret material'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.can_assign_role(uuid,text)'::regprocedure
  ) ~ $$target_role_key <> 'master'$$,
  'database role assignment explicitly excludes Master'
);

select * from finish();

rollback;
