begin;

select plan(51);

insert into auth.users (id, email)
values
  ('a2000000-0000-4000-8000-000000000001', 'hardening-master@example.test'),
  ('a2000000-0000-4000-8000-000000000002', 'hardening-admin-a@example.test'),
  ('a2000000-0000-4000-8000-000000000003', 'hardening-admin-b@example.test'),
  ('a2000000-0000-4000-8000-000000000004', 'hardening-broker-a@example.test'),
  ('a2000000-0000-4000-8000-000000000005', 'hardening-broker-b@example.test'),
  ('a2000000-0000-4000-8000-000000000006', 'hardening-expired@example.test'),
  ('a2000000-0000-4000-8000-000000000007', 'hardening-pending@example.test'),
  ('a2000000-0000-4000-8000-000000000008', 'hardening-future@example.test'),
  ('a2000000-0000-4000-8000-000000000009', 'hardening-override@example.test'),
  ('a2000000-0000-4000-8000-000000000010', 'hardening-multi@example.test'),
  ('a2000000-0000-4000-8000-000000000011', 'hardening-suspended@example.test'),
  ('a2000000-0000-4000-8000-000000000012', 'hardening-future-cross@example.test'),
  ('a2000000-0000-4000-8000-000000000014', 'hardening-malformed@example.test'),
  ('a2000000-0000-4000-8000-000000000015', 'hardening-stale@example.test');

select public.bootstrap_master_user('a2000000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'hardening-org-a',
    'Hardening House A',
    'house'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'hardening-org-b',
    'Hardening Real Estate B',
    'real_estate'
  );

insert into public.crm_teams (id, organization_id, team_key, name)
values
  (
    'c2000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'hardening-team-a',
    'Hardening Team A'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002',
    'hardening-team-b',
    'Hardening Team B'
  );

insert into public.crm_people (id, person_key, display_name, auth_user_id)
values
  (
    'd2000000-0000-4000-8000-000000000001',
    'hardening-broker-a',
    'Hardening Broker A',
    'a2000000-0000-4000-8000-000000000004'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'hardening-broker-b',
    'Hardening Broker B',
    'a2000000-0000-4000-8000-000000000005'
  ),
  (
    'd2000000-0000-4000-8000-000000000003',
    'hardening-pending',
    'Hardening Pending Broker',
    'a2000000-0000-4000-8000-000000000007'
  ),
  (
    'd2000000-0000-4000-8000-000000000004',
    'hardening-malformed',
    'Hardening Malformed Broker',
    'a2000000-0000-4000-8000-000000000014'
  );

insert into public.crm_team_memberships (
  id,
  team_id,
  person_id,
  membership_role
)
values
  (
    'e2000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'broker'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'c2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000002',
    'broker'
  ),
  (
    'e2000000-0000-4000-8000-000000000003',
    'c2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000003',
    'broker'
  ),
  (
    'e2000000-0000-4000-8000-000000000004',
    'c2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000004',
    'broker'
  );

insert into public.crm_portfolios (id, portfolio_key, name, kind)
values (
  'f2000000-0000-4000-8000-000000000001',
  'hardening-portfolio-a',
  'Hardening Partnership A',
  'partnership'
);

insert into public.crm_portfolio_organizations (
  id,
  portfolio_id,
  organization_id
)
values (
  '12000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001'
);

insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id,
  team_id,
  portfolio_id,
  person_id
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    'hardening-org-a',
    'organization',
    'b2000000-0000-4000-8000-000000000001',
    null,
    null,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    'hardening-org-b',
    'organization',
    'b2000000-0000-4000-8000-000000000002',
    null,
    null,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    'hardening-team-a',
    'team',
    null,
    'c2000000-0000-4000-8000-000000000001',
    null,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000004',
    'hardening-team-b',
    'team',
    null,
    'c2000000-0000-4000-8000-000000000002',
    null,
    null
  ),
  (
    '22000000-0000-4000-8000-000000000005',
    'hardening-person-a',
    'person',
    null,
    null,
    null,
    'd2000000-0000-4000-8000-000000000001'
  ),
  (
    '22000000-0000-4000-8000-000000000006',
    'hardening-person-b',
    'person',
    null,
    null,
    null,
    'd2000000-0000-4000-8000-000000000002'
  ),
  (
    '22000000-0000-4000-8000-000000000007',
    'hardening-person-pending',
    'person',
    null,
    null,
    null,
    'd2000000-0000-4000-8000-000000000003'
  ),
  (
    '22000000-0000-4000-8000-000000000008',
    'hardening-portfolio-a',
    'portfolio',
    null,
    null,
    'f2000000-0000-4000-8000-000000000001',
    null
  ),
  (
    '22000000-0000-4000-8000-000000000009',
    'hardening-person-malformed',
    'person',
    null,
    null,
    null,
    'd2000000-0000-4000-8000-000000000004'
  );

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason,
  valid_from,
  valid_until
)
values
  (
    'a2000000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'Admin A scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    '22000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'Admin B scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000004',
    '22000000-0000-4000-8000-000000000005',
    'a2000000-0000-4000-8000-000000000001',
    'Broker A scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000005',
    '22000000-0000-4000-8000-000000000006',
    'a2000000-0000-4000-8000-000000000001',
    'Broker B scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000006',
    '22000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'Scope later expired',
    now() - interval '2 days',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000011',
    '22000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'Suspended Admin scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000012',
    '22000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000001',
    'Current Team A scope',
    now(),
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000012',
    '22000000-0000-4000-8000-000000000004',
    'a2000000-0000-4000-8000-000000000001',
    'Future Team B scope',
    now() + interval '1 day',
    now() + interval '2 days'
  ),
  (
    'a2000000-0000-4000-8000-000000000014',
    '22000000-0000-4000-8000-000000000009',
    'a2000000-0000-4000-8000-000000000001',
    'Binding later malformed',
    now(),
    null
  );

update public.user_roles
set role_key = case user_id
      when 'a2000000-0000-4000-8000-000000000002' then 'admin'
      when 'a2000000-0000-4000-8000-000000000003' then 'admin'
      when 'a2000000-0000-4000-8000-000000000004' then 'broker'
      when 'a2000000-0000-4000-8000-000000000005' then 'broker'
      when 'a2000000-0000-4000-8000-000000000006' then 'admin'
      when 'a2000000-0000-4000-8000-000000000011' then 'admin'
      when 'a2000000-0000-4000-8000-000000000012' then 'coordinator'
      when 'a2000000-0000-4000-8000-000000000014' then 'broker'
    end,
    assigned_by = 'a2000000-0000-4000-8000-000000000001'
where user_id in (
  'a2000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000005',
  'a2000000-0000-4000-8000-000000000006',
  'a2000000-0000-4000-8000-000000000011',
  'a2000000-0000-4000-8000-000000000012',
  'a2000000-0000-4000-8000-000000000014'
);

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = 'a2000000-0000-4000-8000-000000000001'
where user_id in (
  'a2000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000005',
  'a2000000-0000-4000-8000-000000000006',
  'a2000000-0000-4000-8000-000000000012',
  'a2000000-0000-4000-8000-000000000014'
);

update public.profiles
set is_active = false,
    access_status = 'suspended',
    approved_at = now(),
    approved_by = 'a2000000-0000-4000-8000-000000000001'
where user_id = 'a2000000-0000-4000-8000-000000000011';

update public.crm_user_reporting_scope_grants
set valid_until = now() - interval '1 day'
where user_id = 'a2000000-0000-4000-8000-000000000006';

select throws_ok(
  $$update public.crm_people
    set auth_user_id = null
    where id = 'd2000000-0000-4000-8000-000000000004'$$,
  '55000',
  'conflict: suspend approved person-scope users before changing topology',
  'active person-grantee identity drift is blocked fail closed'
);

select is(
  (
    select auth_user_id
    from public.crm_people
    where id = 'd2000000-0000-4000-8000-000000000004'
  ),
  'a2000000-0000-4000-8000-000000000014'::uuid,
  'blocked identity drift leaves the approved Broker binding intact'
);

insert into public.crm_dashboard_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  source
)
values ('hardening-proof', current_date, now(), 'synthetic-test');

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason,
  valid_from
)
values
  (
    'a2000000-0000-4000-8000-000000000008',
    '22000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'Scheduled scope replaced during approval',
    now() + interval '1 day'
  ),
  (
    'a2000000-0000-4000-8000-000000000015',
    '22000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'Stale scope replaced during approval',
    now()
  );

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason,
  granted_by
)
values (
  'a2000000-0000-4000-8000-000000000009',
  'pages.view',
  'deny',
  'Synthetic pre-approval exception',
  'a2000000-0000-4000-8000-000000000001'
);

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason,
  granted_by
)
values
  (
    'a2000000-0000-4000-8000-000000000012',
    'users.manage',
    'allow',
    'Synthetic containment exploit probe',
    'a2000000-0000-4000-8000-000000000001'
  ),
  (
    'a2000000-0000-4000-8000-000000000012',
    'roles.manage',
    'allow',
    'Synthetic containment exploit probe',
    'a2000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key <> 'master'
      and permission_key in (
        'crm.dashboard.view',
        'crm.stages.view',
        'crm.ranking.view',
        'pages.manage',
        'crm.settings.view',
        'crm.settings.manage',
        'crm.salesforce.refresh',
        'crm.ingest.manage'
      )
  ),
  0::bigint,
  'unscoped v2 commercial and global mutation permissions are Master-only'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'user_roles_single_master_unique'
  ),
  1::bigint,
  'storage enforces one Master role'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.crm_reporting_scopes'::regclass
      and constraint_row.conrelid in (
        'public.crm_user_reporting_scope_grants'::regclass,
        'public.audit_logs'::regclass
      )
      and constraint_row.confdeltype = 'r'
  ),
  2::bigint,
  'scope grants and audit lineage reject hard deletion'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select throws_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000007',
    'house',
    array['22000000-0000-4000-8000-000000000001']::uuid[],
    'Attempt child-to-parent delegation expansion'
  )$$,
  '42501',
  'forbidden: actor cannot approve users',
  'team-scoped non-Admin cannot enter the scoped approval flow'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);

select ok(
  not public.has_permission(
    'a2000000-0000-4000-8000-000000000003',
    'pages.view'
  ),
  'Admin A cannot inspect effective permissions for Admin B'
);
select is(
  (
    select count(*)
    from public.get_user_authorization_context(
      'a2000000-0000-4000-8000-000000000003'
    )
  ),
  0::bigint,
  'Admin A receives no authorization context for Admin B'
);
select throws_ok(
  $$select public.remove_user_permission_override(
    'a2000000-0000-4000-8000-000000000003',
    'pages.view',
    'Out-of-scope no-op probe'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'out-of-scope no-op removal fails before override lookup'
);
select ok(
  not public.has_permission(
    'a2000000-0000-4000-8000-000000000012',
    'pages.view'
  ),
  'a future out-of-scope grant makes target management fail closed'
);
select throws_ok(
  $$select public.remove_user_permission_override(
    'a2000000-0000-4000-8000-000000000012',
    'pages.view',
    'Future cross-scope no-op probe'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'future out-of-scope grant blocks no-op permission mutation'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

update public.crm_organizations
set is_active = false
where id = 'b2000000-0000-4000-8000-000000000002';

update public.crm_teams
set is_active = false
where id = 'c2000000-0000-4000-8000-000000000002';

insert into public.crm_team_memberships (
  id,
  team_id,
  person_id,
  membership_role,
  valid_from
) values (
  'e2000000-0000-4000-8000-000000000005',
  'c2000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000003',
  'broker',
  now() + interval '1 day'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000007',
    'broker',
    array['22000000-0000-4000-8000-000000000007']::uuid[],
    'Reject latent cross-organization membership'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'Admin A rejects a latent nonexpired Team B membership even while Team and Org B are inactive'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

delete from public.crm_team_memberships
where id = 'e2000000-0000-4000-8000-000000000005';

update public.crm_teams
set is_active = true
where id = 'c2000000-0000-4000-8000-000000000002';

update public.crm_organizations
set is_active = true
where id = 'b2000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000011',
    'coordinator',
    array['22000000-0000-4000-8000-000000000003']::uuid[],
    'Attempt to reapprove suspended peer Admin'
  )$$,
  '23505',
  'conflict: only pending or legacy-review accounts can be approved',
  'approval RPC cannot re-scope a suspended peer Admin'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000004', true);
select is(
  (select count(*) from public.crm_team_memberships),
  1::bigint,
  'Broker A sees only one membership in a shared team'
);
select is(
  (
    select person_id
    from public.crm_team_memberships
  ),
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'Broker A cannot enumerate Broker B membership metadata'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000006', true);
select ok(
  not public.has_permission(
    'a2000000-0000-4000-8000-000000000006',
    'pages.view'
  ),
  'expired scope removes effective permissions'
);
select is((select count(*) from public.app_pages), 0::bigint, 'expired scope hides navigation');
select is(
  (select count(*) from public.crm_dashboard_snapshots),
  0::bigint,
  'expired scope hides global commercial read models'
);
select is(
  (select count(*) from public.crm_organizations),
  0::bigint,
  'expired scope hides scoped metadata'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000014', true);
select ok(
  public.has_permission(
    'a2000000-0000-4000-8000-000000000014',
    'pages.view'
  ),
  'blocked Broker identity drift preserves effective permissions'
);
select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['hardening-org-a']::text[],
  'blocked Broker identity drift preserves only its scoped metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_user_reporting_scope_grants
set valid_from = now() - interval '2 days',
    valid_until = now() - interval '1 day'
where user_id = 'a2000000-0000-4000-8000-000000000001'
  and revoked_at is null
  and valid_until is null;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select ok(
  not public.has_permission(
    'a2000000-0000-4000-8000-000000000001',
    'pages.view'
  ),
  'Master without an active global grant has no effective permissions'
);
select is((select count(*) from public.app_pages), 0::bigint, 'Master without global grant sees no pages');
select is(
  (select count(*) from public.crm_organizations),
  0::bigint,
  'Master without global grant sees no scoped metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select public.bootstrap_master_user('a2000000-0000-4000-8000-000000000001');
select is(
  (
    select count(*)
    from public.crm_user_reporting_scope_grants scope_grant
    join public.crm_reporting_scopes reporting_scope
      on reporting_scope.id = scope_grant.reporting_scope_id
    where scope_grant.user_id = 'a2000000-0000-4000-8000-000000000001'
      and scope_grant.revoked_at is null
      and scope_grant.valid_from <= now()
      and (scope_grant.valid_until is null or scope_grant.valid_until > now())
      and reporting_scope.scope_type = 'global'
  ),
  1::bigint,
  'bootstrap repairs an expired Master global grant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select ok(
  public.has_permission(
    'a2000000-0000-4000-8000-000000000001',
    'pages.view'
  ),
  'repaired Master regains explicitly scoped permissions'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_organizations set is_active = false
where id = 'b2000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.crm_organizations where id = 'b2000000-0000-4000-8000-000000000002'),
  0::bigint,
  'inactive organization is hidden even from Master metadata reads'
);
select ok(
  not private.can_delegate_reporting_scope('22000000-0000-4000-8000-000000000002'),
  'inactive organization scope cannot be delegated'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_organizations set is_active = true
where id = 'b2000000-0000-4000-8000-000000000002';

update public.crm_teams set is_active = false
where id = 'c2000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.crm_teams where id = 'c2000000-0000-4000-8000-000000000002'),
  0::bigint,
  'inactive team is hidden even from Master metadata reads'
);
select ok(
  not private.can_delegate_reporting_scope('22000000-0000-4000-8000-000000000004'),
  'inactive team scope cannot be delegated'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_teams set is_active = true
where id = 'c2000000-0000-4000-8000-000000000002';

update public.crm_teams set is_active = false
where id = 'c2000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select ok(
  not private.can_delegate_reporting_scope('22000000-0000-4000-8000-000000000005'),
  'inactive team topology prevents organization-to-person delegation'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_teams set is_active = true
where id = 'c2000000-0000-4000-8000-000000000001';

update public.crm_people set is_active = false
where id = 'd2000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.crm_people where id = 'd2000000-0000-4000-8000-000000000002'),
  0::bigint,
  'inactive person is hidden even from Master metadata reads'
);
select ok(
  not private.can_delegate_reporting_scope('22000000-0000-4000-8000-000000000006'),
  'inactive person scope cannot be delegated'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_people set is_active = true
where id = 'd2000000-0000-4000-8000-000000000002';

update public.crm_portfolios set is_active = false
where id = 'f2000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.crm_portfolios where id = 'f2000000-0000-4000-8000-000000000001'),
  0::bigint,
  'inactive portfolio is hidden even from Master metadata reads'
);
select ok(
  not private.can_delegate_reporting_scope('22000000-0000-4000-8000-000000000008'),
  'inactive portfolio scope cannot be delegated'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.crm_portfolios set is_active = true
where id = 'f2000000-0000-4000-8000-000000000001';

update public.crm_organizations set is_active = false
where id = 'b2000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000015',
    'manager',
    array['22000000-0000-4000-8000-000000000003']::uuid[],
    'Admin cannot replace stale foreign scope'
  )$$,
  '42501',
  'forbidden: pending identity is outside actor scope',
  'scoped Admin cannot replace a stale out-of-scope grant'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000015',
    'manager',
    array['22000000-0000-4000-8000-000000000003']::uuid[],
    'Master replaces stale foreign scope'
  )$$,
  'Master can replace a stale inactive scope grant'
);
reset role;
select ok(
  exists (
    select 1
    from public.crm_user_reporting_scope_grants
    where user_id = 'a2000000-0000-4000-8000-000000000015'
      and reporting_scope_id = '22000000-0000-4000-8000-000000000002'
      and revoked_at is not null
      and revocation_reason like 'Replaced during scoped approval:%'
  ),
  'stale grant is retained as explicit revocation history'
);
update public.crm_organizations set is_active = true
where id = 'b2000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000008',
    'manager',
    array['22000000-0000-4000-8000-000000000003']::uuid[],
    'Replace scheduled future scope'
  )$$,
  'Master can approve while retiring a scheduled future grant'
);
reset role;
select ok(
  exists (
    select 1
    from public.crm_user_reporting_scope_grants
    where user_id = 'a2000000-0000-4000-8000-000000000008'
      and reporting_scope_id = '22000000-0000-4000-8000-000000000002'
      and revoked_at is not null
  ),
  'scheduled future grant is revoked instead of silently surviving approval'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000009',
    'manager',
    array['22000000-0000-4000-8000-000000000003']::uuid[],
    'Reject inherited permission exception'
  )$$,
  '23505',
  'conflict: clear audited permission exceptions before approval',
  'approval fails until historical permission exceptions are reconciled'
);
reset role;
select is(
  (select access_status from public.profiles where user_id = 'a2000000-0000-4000-8000-000000000009'),
  'pending',
  'failed approval with exception leaves target pending'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.approve_user_access(
    'a2000000-0000-4000-8000-000000000010',
    'coordinator',
    array[
      '22000000-0000-4000-8000-000000000003',
      '22000000-0000-4000-8000-000000000004'
    ]::uuid[],
    'Approve two explicit scopes'
  )$$,
  'Master can approve a valid multi-scope Coordinator'
);
reset role;
select is(
  (
    select reporting_scope_id
    from public.audit_logs
    where target_user_id = 'a2000000-0000-4000-8000-000000000010'
      and action = 'authorization.user_approved'
  ),
  null::uuid,
  'multi-scope approval audit does not leak through an arbitrary first scope'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.assign_user_role(
    'a2000000-0000-4000-8000-000000000010',
    'manager',
    'Reject role incompatible with two active scopes'
  )$$,
  '23505',
  'conflict: role is incompatible with active reporting scopes',
  'multi-scope Coordinator cannot become a single-team Manager without scope reconciliation'
);

reset role;
select is(
  (
    select role_key
    from public.user_roles
    where user_id = 'a2000000-0000-4000-8000-000000000010'
  ),
  'coordinator',
  'failed incompatible role assignment preserves the Coordinator role'
);

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason,
  granted_by
)
values (
  'a2000000-0000-4000-8000-000000000011',
  'pages.view',
  'deny',
  'Synthetic suspended exception',
  'a2000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_user_active(
    'a2000000-0000-4000-8000-000000000011',
    true,
    'Attempt with unresolved exception'
  )$$,
  '23505',
  'conflict: reconcile audited permission exceptions before reactivation',
  'reactivation fails while permission exceptions remain'
);
select lives_ok(
  $$select public.remove_user_permission_override(
    'a2000000-0000-4000-8000-000000000011',
    'pages.view',
    'Reconcile before reactivation'
  )$$,
  'Master can reconcile the suspended account exception'
);
select lives_ok(
  $$select public.set_user_active(
    'a2000000-0000-4000-8000-000000000011',
    true,
    'Approved reactivation'
  )$$,
  'reactivation succeeds only after scope and exceptions validate'
);
select throws_ok(
  $$select public.assign_user_role(
    'a2000000-0000-4000-8000-000000000007',
    'broker',
    'Attempt to bypass pending approval'
  )$$,
  '23505',
  'conflict: pending or inactive account requires scoped approval/reactivation',
  'legacy role assignment RPC cannot bypass pending approval'
);
select throws_ok(
  $$select public.set_user_active(
    'a2000000-0000-4000-8000-000000000007',
    false,
    'Attempt to strand pending onboarding'
  )$$,
  '23505',
  'conflict: onboarding account requires scoped approval',
  'status RPC cannot convert pending onboarding into suspended state'
);

reset role;

select * from finish();
rollback;
