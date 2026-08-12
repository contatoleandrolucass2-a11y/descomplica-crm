begin;

select plan(98);

insert into auth.users (id, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'scope-master@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'scope-admin@example.test'),
  ('a1000000-0000-4000-8000-000000000003', 'scope-coordinator@example.test'),
  ('a1000000-0000-4000-8000-000000000004', 'scope-manager@example.test'),
  ('a1000000-0000-4000-8000-000000000005', 'scope-broker@example.test'),
  ('a1000000-0000-4000-8000-000000000006', 'scope-real-estate@example.test'),
  ('a1000000-0000-4000-8000-000000000007', 'scope-house@example.test'),
  ('a1000000-0000-4000-8000-000000000008', 'scope-partnership@example.test'),
  ('a1000000-0000-4000-8000-000000000009', 'scope-pending@example.test'),
  ('a1000000-0000-4000-8000-000000000010', 'scope-expired@example.test'),
  ('a1000000-0000-4000-8000-000000000011', 'scope-approval-good@example.test'),
  ('a1000000-0000-4000-8000-000000000012', 'scope-approval-bad@example.test');

select public.bootstrap_master_user(
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.crm_organizations (
  id,
  organization_key,
  name,
  kind
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'org-a',
    'Synthetic House A',
    'house'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'org-b',
    'Synthetic Real Estate B',
    'real_estate'
  );

insert into public.crm_teams (
  id,
  organization_id,
  team_key,
  name
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'team-a',
    'Synthetic Team A'
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'team-b',
    'Synthetic Team B'
  );

insert into public.crm_people (
  id,
  person_key,
  display_name,
  auth_user_id
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'person-a',
    'Synthetic Person A',
    'a1000000-0000-4000-8000-000000000005'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'person-b',
    'Synthetic Person B',
    'a1000000-0000-4000-8000-000000000006'
  ),
  (
    'd1000000-0000-4000-8000-000000000003',
    'approval-good',
    'Synthetic Approval Good',
    'a1000000-0000-4000-8000-000000000011'
  ),
  (
    'd1000000-0000-4000-8000-000000000004',
    'approval-bad',
    'Synthetic Approval Bad',
    'a1000000-0000-4000-8000-000000000012'
  );

insert into public.crm_team_memberships (
  id,
  team_id,
  person_id,
  membership_role
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'broker'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    'broker'
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000003',
    'broker'
  ),
  (
    'e1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000004',
    'broker'
  );

insert into public.crm_team_memberships (
  id,
  team_id,
  person_id,
  membership_role,
  valid_from
) values (
  'e1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000004',
  'broker',
  now() + interval '1 day'
);

insert into public.crm_portfolios (
  id,
  portfolio_key,
  name,
  kind
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'portfolio-a',
    'Synthetic Partnership Portfolio A',
    'partnership'
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'portfolio-b',
    'Synthetic Partnership Portfolio B',
    'partnership'
  );

insert into public.crm_portfolio_organizations (
  id,
  portfolio_id,
  organization_id
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002'
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
    '21000000-0000-4000-8000-000000000001',
    'organization-a',
    'organization',
    'b1000000-0000-4000-8000-000000000001',
    null,
    null,
    null
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    'organization-b',
    'organization',
    'b1000000-0000-4000-8000-000000000002',
    null,
    null,
    null
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    'team-a',
    'team',
    null,
    'c1000000-0000-4000-8000-000000000001',
    null,
    null
  ),
  (
    '21000000-0000-4000-8000-000000000004',
    'team-b',
    'team',
    null,
    'c1000000-0000-4000-8000-000000000002',
    null,
    null
  ),
  (
    '21000000-0000-4000-8000-000000000005',
    'person-a',
    'person',
    null,
    null,
    null,
    'd1000000-0000-4000-8000-000000000001'
  ),
  (
    '21000000-0000-4000-8000-000000000006',
    'person-b',
    'person',
    null,
    null,
    null,
    'd1000000-0000-4000-8000-000000000002'
  ),
  (
    '21000000-0000-4000-8000-000000000007',
    'portfolio-a',
    'portfolio',
    null,
    null,
    'f1000000-0000-4000-8000-000000000001',
    null
  ),
  (
    '21000000-0000-4000-8000-000000000008',
    'portfolio-b',
    'portfolio',
    null,
    null,
    'f1000000-0000-4000-8000-000000000002',
    null
  ),
  (
    '21000000-0000-4000-8000-000000000009',
    'approval-good',
    'person',
    null,
    null,
    null,
    'd1000000-0000-4000-8000-000000000003'
  ),
  (
    '21000000-0000-4000-8000-000000000010',
    'approval-bad',
    'person',
    null,
    null,
    null,
    'd1000000-0000-4000-8000-000000000004'
  );

update public.user_roles
set role_key = case user_id
      when 'a1000000-0000-4000-8000-000000000002' then 'admin'
      when 'a1000000-0000-4000-8000-000000000003' then 'coordinator'
      when 'a1000000-0000-4000-8000-000000000004' then 'manager'
      when 'a1000000-0000-4000-8000-000000000005' then 'broker'
      when 'a1000000-0000-4000-8000-000000000006' then 'real_estate'
      when 'a1000000-0000-4000-8000-000000000007' then 'house'
      when 'a1000000-0000-4000-8000-000000000008' then 'partnership_channel'
      when 'a1000000-0000-4000-8000-000000000010' then 'admin'
    end,
    assigned_by = 'a1000000-0000-4000-8000-000000000001'
where user_id between
  'a1000000-0000-4000-8000-000000000002'
  and 'a1000000-0000-4000-8000-000000000008'
or user_id = 'a1000000-0000-4000-8000-000000000010';

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
    'a1000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic organization A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '21000000-0000-4000-8000-000000000007',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic portfolio A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    '21000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic team A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    '21000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic person A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    '21000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic organization B grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    '21000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic House A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    '21000000-0000-4000-8000-000000000007',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic partnership portfolio A grant',
    now() - interval '1 hour',
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000010',
    '21000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Synthetic organization A grant later expired',
    now() - interval '2 days',
    null
  );

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = 'a1000000-0000-4000-8000-000000000001'
where user_id between
  'a1000000-0000-4000-8000-000000000002'
  and 'a1000000-0000-4000-8000-000000000008'
or user_id = 'a1000000-0000-4000-8000-000000000010';

update public.crm_user_reporting_scope_grants
set valid_until = now() - interval '1 day'
where user_id = 'a1000000-0000-4000-8000-000000000010';

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason,
  granted_by
)
values
  (
    'a1000000-0000-4000-8000-000000000003',
    'users.manage',
    'allow',
    'Synthetic role-gate probe',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'roles.manage',
    'allow',
    'Synthetic role-gate probe',
    'a1000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select array_agg(role_key || ':' || scope_type order by role_key, scope_type)
    from public.crm_role_scope_types
  ),
  array[
    'admin:organization',
    'broker:person',
    'coordinator:portfolio',
    'coordinator:team',
    'house:organization',
    'manager:team',
    'master:global',
    'partnership_channel:portfolio',
    'real_estate:organization'
  ]::text[],
  'role catalog permits only explicit reporting-scope types'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a', 'org-b']::text[],
  'Master global scope sees every organization'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a', 'team-b']::text[],
  'Master global scope sees every team'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a', 'person-b']::text[],
  'Master global scope sees every person'
);
select is(
  (select array_agg(portfolio_key order by portfolio_key) from public.crm_portfolios),
  array['portfolio-a', 'portfolio-b']::text[],
  'Master global scope sees every portfolio'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array[
    'approval-bad',
    'approval-good',
    'global',
    'organization-a',
    'organization-b',
    'person-a',
    'person-b',
    'portfolio-a',
    'portfolio-b',
    'team-a',
    'team-b'
  ]::text[],
  'Master global scope sees every reporting scope'
);
select is(
  (select count(*) from public.crm_team_memberships),
  5::bigint,
  'Master global scope sees every team membership'
);
select is(
  (select count(*) from public.crm_portfolio_organizations),
  2::bigint,
  'Master global scope sees every portfolio organization'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'Admin organization scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'Admin organization scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a']::text[],
  'Admin organization scope sees only person A'
);
select is(
  (select count(*) from public.crm_portfolios),
  0::bigint,
  'Admin organization scope does not imply a portfolio scope'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array['approval-good', 'organization-a', 'person-a', 'team-a']::text[],
  'Admin discovers only delegable organization-A reporting scopes'
);
select is(
  (
    select count(*)
    from public.crm_user_reporting_scope_grants
    where user_id = 'a1000000-0000-4000-8000-000000000006'
  ),
  0::bigint,
  'Admin cannot read reporting-scope grants from organization B'
);
select is(
  (select count(*) from public.crm_organizations where organization_key = 'org-b'),
  0::bigint,
  'Admin cannot cross from organization A to organization B'
);
select is(
  (select count(*) from public.crm_teams where team_key = 'team-b'),
  0::bigint,
  'Admin cannot cross from team A to team B'
);
select is(
  (select count(*) from public.crm_people where person_key = 'person-b'),
  0::bigint,
  'Admin cannot cross from person A to person B'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'Coordinator portfolio scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'Coordinator portfolio scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a']::text[],
  'Coordinator portfolio scope sees only person A'
);
select is(
  (select array_agg(portfolio_key order by portfolio_key) from public.crm_portfolios),
  array['portfolio-a']::text[],
  'Coordinator portfolio scope sees only portfolio A'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array[
    'approval-good',
    'organization-a',
    'person-a',
    'portfolio-a',
    'team-a'
  ]::text[],
  'Coordinator discovers only reporting scopes derived from portfolio A'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000004',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'Manager team scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'Manager team scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a']::text[],
  'Manager team scope sees only person A'
);
select is(
  (select count(*) from public.crm_portfolios),
  0::bigint,
  'Manager team scope does not imply a portfolio scope'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array['approval-good', 'person-a', 'team-a']::text[],
  'Manager discovers only reporting scopes derived from team A'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000005',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'Broker person scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'Broker person scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['person-a']::text[],
  'Broker person scope sees only person A'
);
select is(
  (select count(*) from public.crm_portfolios),
  0::bigint,
  'Broker person scope does not imply a portfolio scope'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array['person-a']::text[],
  'Broker discovers only scopes derived from its own person relationship'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000006',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-b']::text[],
  'Real Estate organization scope sees only organization B'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-b']::text[],
  'Real Estate organization scope sees only team B'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['person-b']::text[],
  'Real Estate organization scope sees only person B'
);
select is(
  (select count(*) from public.crm_portfolios),
  0::bigint,
  'Real Estate organization scope does not imply a portfolio scope'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array['organization-b', 'person-b', 'team-b']::text[],
  'Real Estate discovers only reporting scopes derived from organization B'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000007',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'House organization scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'House organization scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a']::text[],
  'House organization scope sees only person A'
);
select is(
  (select count(*) from public.crm_portfolios),
  0::bigint,
  'House organization scope does not imply a portfolio scope'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array['approval-good', 'organization-a', 'person-a', 'team-a']::text[],
  'House discovers only reporting scopes derived from organization A'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000008',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'Partnership Channel portfolio scope sees only organization A'
);
select is(
  (select array_agg(team_key order by team_key) from public.crm_teams),
  array['team-a']::text[],
  'Partnership Channel portfolio scope sees only team A'
);
select is(
  (select array_agg(person_key order by person_key) from public.crm_people),
  array['approval-bad', 'approval-good', 'person-a']::text[],
  'Partnership Channel portfolio scope sees only person A'
);
select is(
  (select array_agg(portfolio_key order by portfolio_key) from public.crm_portfolios),
  array['portfolio-a']::text[],
  'Partnership Channel portfolio scope sees only portfolio A'
);
select is(
  (select array_agg(scope_key order by scope_key) from public.crm_reporting_scopes),
  array[
    'approval-good',
    'organization-a',
    'person-a',
    'portfolio-a',
    'team-a'
  ]::text[],
  'Partnership Channel discovers only scopes derived from portfolio A'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000009',
  true
);

select is((select count(*) from public.crm_organizations), 0::bigint, 'pending sees no organizations');
select is((select count(*) from public.crm_teams), 0::bigint, 'pending sees no teams');
select is((select count(*) from public.crm_people), 0::bigint, 'pending sees no people');
select is((select count(*) from public.crm_portfolios), 0::bigint, 'pending sees no portfolios');
select is((select count(*) from public.crm_reporting_scopes), 0::bigint, 'pending sees no reporting scopes');
select is(
  (select count(*) from public.crm_user_reporting_scope_grants),
  0::bigint,
  'pending sees no reporting-scope grants'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000010',
  true
);

select is((select count(*) from public.crm_organizations), 0::bigint, 'expired grant reveals no organizations');
select is((select count(*) from public.crm_teams), 0::bigint, 'expired grant reveals no teams');
select is((select count(*) from public.crm_people), 0::bigint, 'expired grant reveals no people');
select is((select count(*) from public.crm_portfolios), 0::bigint, 'expired grant reveals no portfolios');
select is((select count(*) from public.crm_reporting_scopes), 0::bigint, 'expired grant reveals no reporting scopes');

reset role;
select set_config('request.jwt.claim.sub', '', true);

update public.crm_user_reporting_scope_grants
set valid_until = now() + interval '1 day'
where user_id = 'a1000000-0000-4000-8000-000000000002'
  and reporting_scope_id = '21000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000011',
    'broker',
    array['21000000-0000-4000-8000-000000000009']::uuid[],
    'Reject delegation from a finite actor grant'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'active but finite actor grants cannot authorize persistent delegation'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

update public.crm_user_reporting_scope_grants
set valid_until = null
where user_id = 'a1000000-0000-4000-8000-000000000002'
  and reporting_scope_id = '21000000-0000-4000-8000-000000000001';

update public.profiles
set is_active = false,
    access_status = 'suspended'
where user_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000008'
);

update public.crm_portfolio_organizations
set valid_until = now() + interval '1 day'
where id = '11000000-0000-4000-8000-000000000001';

update public.profiles
set is_active = true,
    access_status = 'approved'
where user_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000008'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select is(
  private.can_delegate_reporting_scope(
    '21000000-0000-4000-8000-000000000001'
  ),
  false,
  'finite portfolio edges cannot authorize persistent delegation'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

update public.profiles
set is_active = false,
    access_status = 'suspended'
where user_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000008'
);

update public.crm_portfolio_organizations
set valid_until = null
where id = '11000000-0000-4000-8000-000000000001';

update public.profiles
set is_active = true,
    access_status = 'approved'
where user_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000008'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000011',
    'broker',
    array['21000000-0000-4000-8000-000000000009']::uuid[],
    'Reject approval by an overridden Coordinator'
  )$$,
  '42501',
  'forbidden: actor cannot approve users',
  'permission overrides do not let Coordinator bypass the Master-or-Admin approval policy'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000006',
    'real_estate',
    array['21000000-0000-4000-8000-000000000001']::uuid[],
    'Probe existing cross-organization target'
  )$$,
  '42501',
  'forbidden: pending identity is outside actor scope',
  'approval hides existing cross-organization target state'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000099',
    'real_estate',
    array['21000000-0000-4000-8000-000000000001']::uuid[],
    'Probe nonexistent target'
  )$$,
  '42501',
  'forbidden: pending identity is outside actor scope',
  'approval returns the same denial for a nonexistent target'
);

select throws_ok(
  $$select public.assign_user_role(
    'a1000000-0000-4000-8000-000000000006',
    'real_estate',
    'Probe existing cross-organization target'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'role assignment hides existing cross-organization target state'
);

select throws_ok(
  $$select public.assign_user_role(
    'a1000000-0000-4000-8000-000000000099',
    'real_estate',
    'Probe nonexistent target'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'role assignment returns the same denial for a nonexistent target'
);

select throws_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000006',
    false,
    'Probe existing cross-organization target'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'status mutation hides existing cross-organization target state'
);

select throws_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000099',
    false,
    'Probe nonexistent target'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'status mutation returns the same denial for a nonexistent target'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000011',
    'broker',
    array['21999999-0000-4000-8000-000000000099']::uuid[],
    'Reject unknown scope without disclosure'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'unknown scope identifiers receive the same non-Master denial'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000012',
    'broker',
    array['21000000-0000-4000-8000-000000000010']::uuid[],
    'Reject future cross-organization affiliation'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'Admin A cannot approve a person with a scheduled non-expired membership in organization B'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000012',
    'partnership_channel',
    array['21000000-0000-4000-8000-000000000001']::uuid[],
    'Reject incompatible scope type'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'incompatible scope types receive the same non-Master denial'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000012',
    'house',
    array['21000000-0000-4000-8000-000000000002']::uuid[],
    'Reject wrong organization kind'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'wrong-kind scopes receive the same non-Master denial'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000012',
    'broker',
    array['21000000-0000-4000-8000-000000000006']::uuid[],
    'Reject horizontal organization crossing'
  )$$,
  '42501',
  'forbidden: requested scope is outside actor scope',
  'Admin A cannot approve a Broker in organization B'
);

select throws_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000012',
    'broker',
    array['21000000-0000-4000-8000-000000000005']::uuid[],
    'Reject another Broker identity'
  )$$,
  '22023',
  'invalid_argument: Broker person scope must match target Auth user',
  'Admin cannot bind a pending Broker to another Auth identity'
);

reset role;

select is(
  (
    select access_status
    from public.profiles
    where user_id = 'a1000000-0000-4000-8000-000000000012'
  ),
  'pending',
  'rejected approvals leave the target pending'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $$select public.approve_user_access(
    'a1000000-0000-4000-8000-000000000011',
    'broker',
    array['21000000-0000-4000-8000-000000000009']::uuid[],
    'Approved synthetic in-scope Broker'
  )$$,
  'Admin A can approve an in-scope Broker'
);

reset role;

select ok(
  (
    select is_active and access_status = 'approved'
    from public.profiles
    where user_id = 'a1000000-0000-4000-8000-000000000011'
  ),
  'successful approval activates and approves the profile'
);
select is(
  (
    select role_key
    from public.user_roles
    where user_id = 'a1000000-0000-4000-8000-000000000011'
  ),
  'broker',
  'successful approval assigns the requested compatible role'
);
select is(
  (
    select array_agg(reporting_scope_id order by reporting_scope_id)
    from public.crm_user_reporting_scope_grants
    where user_id = 'a1000000-0000-4000-8000-000000000011'
      and valid_from <= now()
      and (valid_until is null or valid_until > now())
  ),
  array['21000000-0000-4000-8000-000000000009']::uuid[],
  'successful approval grants exactly the requested person scope'
);
select ok(
  exists (
    select 1
    from public.crm_user_reporting_scope_grants
    where user_id = 'a1000000-0000-4000-8000-000000000011'
      and granted_by = 'a1000000-0000-4000-8000-000000000002'
      and reason = 'Approved synthetic in-scope Broker'
  ),
  'successful approval records actor and reason on the scope grant'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where actor_id = 'a1000000-0000-4000-8000-000000000002'
      and target_user_id = 'a1000000-0000-4000-8000-000000000011'
      and action = 'authorization.user_approved'
      and reporting_scope_id = '21000000-0000-4000-8000-000000000009'
  ),
  'successful approval writes a scoped audit event'
);
select is(
  (
    select before ->> 'reason'
    from public.audit_logs
    where actor_id = 'a1000000-0000-4000-8000-000000000002'
      and target_user_id = 'a1000000-0000-4000-8000-000000000011'
      and action = 'authorization.user_approved'
  ),
  'Approved synthetic in-scope Broker',
  'approval audit preserves the explicit reason'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)
    from public.audit_logs
    where target_user_id = 'a1000000-0000-4000-8000-000000000011'
      and action = 'authorization.user_approved'
  ),
  1::bigint,
  'scoped Admin can read its in-scope approval audit event'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000011',
  true
);

select is(
  (select array_agg(organization_key order by organization_key) from public.crm_organizations),
  array['org-a']::text[],
  'newly approved Broker receives organization A metadata'
);
select is(
  (select count(*) from public.crm_organizations where organization_key = 'org-b'),
  0::bigint,
  'newly approved Broker cannot cross into organization B'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$update public.crm_reporting_scopes
    set scope_key = 'approval-good-renamed'
    where id = '21000000-0000-4000-8000-000000000009'$$,
  '55000',
  'conflict: reporting scope identity is immutable',
  'reporting-scope identity cannot be repointed after grants exist'
);

select throws_ok(
  $$update public.crm_teams
    set organization_id = 'b1000000-0000-4000-8000-000000000002'
    where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '55000',
  'conflict: team organization is immutable; create a new team',
  'team organization cannot be changed in place'
);

select throws_ok(
  $$insert into public.crm_team_memberships (
      id,
      team_id,
      person_id,
      membership_role,
      valid_from
    ) values (
      'e1000000-0000-4000-8000-000000000006',
      'c1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000003',
      'broker',
      now() + interval '1 day'
    )$$,
  '55000',
  'conflict: suspend approved person-scope users before changing topology',
  'active Broker topology cannot gain a scheduled cross-organization membership'
);

select throws_ok(
  $$update public.crm_people
    set auth_user_id = null
    where id = 'd1000000-0000-4000-8000-000000000003'$$,
  '55000',
  'conflict: suspend approved person-scope users before changing topology',
  'active Broker Auth identity cannot drift'
);

select throws_ok(
  $$insert into public.crm_portfolio_organizations (
      id,
      portfolio_id,
      organization_id
    ) values (
      '11000000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )$$,
  '55000',
  'conflict: suspend approved portfolio-scope users before changing topology',
  'active portfolio grantees block silent portfolio expansion'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    false,
    'Suspend before topology change'
  )$$,
  'in-scope Admin can suspend the Broker before a topology change'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$insert into public.crm_team_memberships (
      id,
      team_id,
      person_id,
      membership_role,
      valid_from
    ) values (
      'e1000000-0000-4000-8000-000000000006',
      'c1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000003',
      'broker',
      now() + interval '1 day'
    )$$,
  'suspension permits the audited topology maintenance window'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    true,
    'Attempt cross-boundary reactivation'
  )$$,
  '42501',
  'forbidden: target is outside actor scope',
  'Admin cannot reactivate a Broker after cross-boundary topology change'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    true,
    'Attempt lower-role reactivation'
  )$$,
  '42501',
  'forbidden: actor cannot reactivate users',
  'users-manage override does not let Coordinator reactivate users'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    true,
    'Master approves changed boundary'
  )$$,
  'Master can explicitly accept the changed Broker boundary'
);

select lives_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    false,
    'Suspend before orphaning person scope'
  )$$,
  'Master can suspend the Broker before removing memberships'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$delete from public.crm_team_memberships
    where person_id = 'd1000000-0000-4000-8000-000000000003'$$,
  'suspended Broker memberships can be reconciled'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $$select public.set_user_active(
    'a1000000-0000-4000-8000-000000000011',
    true,
    'Reject orphaned person scope'
  )$$,
  '23505',
  'conflict: reactivation requires a compatible active reporting scope',
  'even Master cannot reactivate an orphaned Broker person scope'
);

reset role;
select is(
  (
    select access_status
    from public.profiles
    where user_id = 'a1000000-0000-4000-8000-000000000011'
  ),
  'suspended',
  'failed orphan reactivation leaves the Broker suspended'
);

select * from finish();

rollback;
