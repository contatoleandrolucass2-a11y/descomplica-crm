begin;

select plan(28);

insert into auth.users (id, email)
values
  (
    '91000000-0000-4000-8000-000000000001',
    'pending-access@example.test'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'legacy-master@example.test'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'legacy-inactive@example.test'
  );

select public.bootstrap_master_user(
  '91000000-0000-4000-8000-000000000002'
);

update public.user_roles
set role_key = 'user'
where user_id = '91000000-0000-4000-8000-000000000003';

update public.profiles
set is_active = false,
    access_status = 'legacy_review',
    approved_at = null,
    approved_by = null
where user_id = '91000000-0000-4000-8000-000000000003';

select is(
  (
    select count(*)
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'signup creates exactly one profile'
);

select is(
  (
    select access_status
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'signup profile starts pending'
);

select ok(
  not (
    select is_active
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  'signup profile starts inactive'
);

select ok(
  not (
    select profile_completed
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  'signup profile starts incomplete'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'signup receives only the pending role'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key = 'pending'
  ),
  0::bigint,
  'pending role has no permissions'
);

select is(
  (
    select count(*)
    from public.permissions permission
    where public.has_permission(
      '91000000-0000-4000-8000-000000000001',
      permission.key
    )
  ),
  0::bigint,
  'pending account has no effective permissions'
);

select is(
  (
    select count(*)
    from public.crm_user_reporting_scope_grants
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'signup creates no reporting-scope grant'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.bootstrap_master_user(uuid)',
    'execute'
  ),
  'authenticated cannot execute Master bootstrap'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'pending account can read its own profile'
);

select is(
  (
    select count(*)
    from public.user_roles
    where user_id = '91000000-0000-4000-8000-000000000001'
      and role_key = 'pending'
  ),
  1::bigint,
  'pending account can read its own role'
);

select is(
  (select count(*) from public.app_pages),
  0::bigint,
  'pending account sees no application pages'
);

select is(
  (
    select count(*)
    from public.get_user_authorization_context(
      '91000000-0000-4000-8000-000000000001'
    )
  ),
  0::bigint,
  'pending account receives no authorization context'
);

select throws_ok(
  $$update public.profiles
    set is_active = true,
        access_status = 'approved'
    where user_id = '91000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table profiles',
  'pending account cannot approve itself through direct writes'
);

select throws_ok(
  $$select public.approve_user_access(
    '91000000-0000-4000-8000-000000000001',
    'broker',
    array['00000000-0000-4000-8000-000000000001']::uuid[],
    'Self approval attempt'
  )$$,
  '42501',
  'forbidden: actor is not approved',
  'pending account cannot approve itself through the guarded RPC'
);

select throws_ok(
  $$select public.set_user_active(
    '91000000-0000-4000-8000-000000000001',
    true,
    'Self activation attempt'
  )$$,
  '42501',
  'forbidden: actor is not approved',
  'pending account cannot activate itself'
);

select throws_ok(
  $$select * from public.list_app_pages_for_management()$$,
  '42501',
  'forbidden: actor is not approved',
  'pending account cannot invoke page administration'
);

select throws_ok(
  $$select public.set_app_page_active(
    'crm.dashboard',
    false,
    'Pending account attempt'
  )$$,
  '42501',
  'forbidden: actor is not approved',
  'pending account cannot mutate page administration'
);

select throws_ok(
  $$select public.replace_crm_point_settings('{}'::jsonb, '{}'::jsonb)$$,
  '42501',
  'forbidden: actor is not approved',
  'pending account cannot invoke commercial settings mutation'
);

select throws_ok(
  $$select public.begin_crm_salesforce_refresh(
    'refresh:91000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'access denied',
  'pending account cannot request a Salesforce refresh'
);

select throws_ok(
  $$select public.bootstrap_master_user(
    '91000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'permission denied for function bootstrap_master_user',
  'pending account cannot invoke the postgres-only Master bootstrap'
);

reset role;

insert into public.crm_organizations (
  id,
  organization_key,
  name,
  kind
) values (
  '92000000-0000-4000-8000-000000000001',
  'legacy-reconciliation-real-estate',
  'Legacy Reconciliation Real Estate',
  'real_estate'
);

insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id
) values (
  '93000000-0000-4000-8000-000000000001',
  'legacy-reconciliation-real-estate',
  'organization',
  '92000000-0000-4000-8000-000000000001'
);

select is(
  (
    select access_status
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000003'
  ),
  'legacy_review',
  'migrated inactive non-Master remains eligible for legacy review'
);

select ok(
  not (
    select is_active
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000003'
  ),
  'migrated inactive non-Master remains inactive before reconciliation'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    public.approve_user_access(
      '91000000-0000-4000-8000-000000000003',
      'real_estate',
      array['93000000-0000-4000-8000-000000000001']::uuid[],
      'Reconcile inactive legacy fixture'
    ) ->> 'role_key'
  ),
  'real_estate',
  'Master reconciles an inactive legacy-review account through guarded approval'
);

reset role;

select ok(
  (
    select is_active and access_status = 'approved'
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000003'
  ),
  'legacy reconciliation activates and approves the profile'
);

select is(
  (
    select role_key
    from public.user_roles
    where user_id = '91000000-0000-4000-8000-000000000003'
  ),
  'real_estate',
  'legacy reconciliation assigns the requested compatible role'
);

select is(
  (
    select count(*)
    from public.crm_user_reporting_scope_grants
    where user_id = '91000000-0000-4000-8000-000000000003'
      and reporting_scope_id = '93000000-0000-4000-8000-000000000001'
      and revoked_at is null
      and valid_from <= now()
      and (valid_until is null or valid_until > now())
  ),
  1::bigint,
  'legacy reconciliation grants exactly one active compatible scope'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where actor_id = '91000000-0000-4000-8000-000000000002'
      and target_user_id = '91000000-0000-4000-8000-000000000003'
      and action = 'authorization.user_approved'
      and before ->> 'access_status' = 'legacy_review'
  ),
  1::bigint,
  'legacy reconciliation records the original review state in one audit event'
);

select * from finish();

rollback;
