begin;

select plan(143);

-- The relay/cutover migration closes this primitive to Data API roles. Keep a
-- transaction-local grant only for the v3 fixture setup exercised below.
grant execute on function public.review_crm_source_identity_mapping(jsonb)
to authenticated;

select has_table('public', 'crm_read_model_v3_runs', 'v3 run table exists');
select has_table('public', 'crm_read_model_v3_events', 'v3 event table exists');
select has_table(
  'public', 'crm_read_model_v3_scope_coverage',
  'v3 exact reporting-scope coverage manifest exists'
);
select has_table('private', 'crm_integration_owners', 'mapping owner catalog exists');
select has_table('private', 'crm_identity_reconciliation_items', 'reconciliation queue exists');
select has_table(
  'private', 'crm_read_model_v3_sources',
  'dataset source authority catalog exists'
);
select has_table(
  'private',
  'crm_reporting_scope_grant_lineage',
  'reporting-grant lineage exists'
);
select has_function(
  'public', 'ingest_crm_read_model_v3', array['jsonb'],
  'v3 ingestion RPC exists'
);
select has_function(
  'public', 'get_crm_read_model_v3', array['text', 'uuid', 'jsonb'],
  'v3 read RPC exists'
);
select has_function(
  'public', 'list_crm_read_model_v3_scopes', array[]::text[],
  'v3 scope RPC exists'
);
select is(
  (select pg_catalog.pg_get_userbyid(functions.proowner)
   from pg_catalog.pg_proc functions
   where functions.oid = 'public.ingest_crm_read_model_v3(jsonb)'::regprocedure),
  'postgres',
  'v3 ingestion RPC is owned by postgres'
);
select ok(
  (select functions.prosecdef
      and 'search_path=""' = any(functions.proconfig)
      and 'statement_timeout=30s' = any(functions.proconfig)
   from pg_catalog.pg_proc functions
   where functions.oid = 'public.ingest_crm_read_model_v3(jsonb)'::regprocedure),
  'v3 ingestion is bounded SECURITY DEFINER with empty search path'
);
select ok(
  (select functions.prosecdef
      and 'search_path=""' = any(functions.proconfig)
      and 'statement_timeout=10s' = any(functions.proconfig)
   from pg_catalog.pg_proc functions
   where functions.oid =
     'public.get_crm_read_model_v3(text,uuid,jsonb)'::regprocedure),
  'v3 read is bounded SECURITY DEFINER with empty search path'
);
select ok(
  has_function_privilege(
    'service_role', 'public.ingest_crm_read_model_v3(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.ingest_crm_read_model_v3(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'public.ingest_crm_read_model_v3(jsonb)', 'EXECUTE'
  ),
  'only service_role receives the v3 ingestion capability'
);
select is(
  (select count(*)
   from public.role_permissions
   where permission_key in (
     'crm.read_model_v3.view',
     'crm.read_model_v3.ranking.view',
     'crm.read_model_v3.partnerships.view',
     'crm.read_model_v3.stock.view'
   )),
  0::bigint,
  'v3 permission catalog creation does not activate any role automatically'
);
set local role anon;
select throws_ok(
  $$select public.ingest_crm_read_model_v3(null::jsonb)$$,
  '42501',
  null,
  'anonymous callers cannot execute the v3 ingestion RPC'
);
reset role;
set local role authenticated;
select throws_ok(
  $$select public.ingest_crm_read_model_v3(null::jsonb)$$,
  '42501',
  null,
  'authenticated user callers cannot execute the v3 ingestion RPC'
);
reset role;
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_crm_read_model_v3(text,uuid,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.get_crm_read_model_v3(text,uuid,jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'service_role', 'public.get_crm_read_model_v3(text,uuid,jsonb)', 'EXECUTE'
  ),
  'only authenticated receives the v3 read capability'
);
select ok(
  (select bool_and(relrowsecurity and relforcerowsecurity)
   from pg_catalog.pg_class
   where oid in (
     'public.crm_read_model_v3_runs'::regclass,
     'public.crm_read_model_v3_events'::regclass,
     'public.crm_read_model_v3_scope_coverage'::regclass,
     'public.crm_read_model_v3_closed_months'::regclass,
     'public.crm_read_model_v3_active_runs'::regclass
   )),
  'all v3 storage tables enable and force RLS'
);
select ok(
  not exists (
    select 1
    from (values
      ('crm_read_model_v3_runs'),
      ('crm_read_model_v3_events'),
      ('crm_read_model_v3_scope_coverage'),
      ('crm_read_model_v3_closed_months'),
      ('crm_read_model_v3_active_runs')
    ) tables(name)
    cross join (values ('anon'), ('authenticated'), ('service_role')) roles(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      roles.name,
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'Data API roles have no direct privileges on v3 storage'
);
select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) roles(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      roles.name,
      'private.crm_read_model_v3_sources',
      privileges.name
    )
  ),
  'Data API roles have no direct privilege on source authority'
);
select has_index(
  'public',
  'crm_read_model_v3_runs',
  'crm_read_model_v3_runs_dataset_published_idx',
  'published-run lookup is indexed by dataset and recency'
);
select has_index(
  'public',
  'crm_read_model_v3_events',
  'crm_read_model_v3_events_scope_date_stage_idx',
  'scope/date/stage reads have a composite index'
);
select has_index(
  'public',
  'crm_read_model_v3_events',
  'crm_read_model_v3_events_run_date_stage_idx',
  'active-run/date/stage aggregation has a composite index'
);
select has_index(
  'public',
  'crm_read_model_v3_closed_months',
  'crm_read_model_v3_closed_months_run_idx',
  'closed-month history has a run/month index'
);
select has_index(
  'public',
  'crm_read_model_v3_scope_coverage',
  'crm_read_model_v3_scope_coverage_scope_run_idx',
  'exact scope-manifest reads have a scope/run index'
);
select has_index(
  'private',
  'crm_read_model_v3_sources',
  'crm_read_model_v3_sources_active_dataset_unique',
  'each dataset has at most one active canonical source'
);

insert into auth.users (id, email)
values
  ('81000000-0000-4000-8000-000000000001', 'v3-master@example.test'),
  ('81000000-0000-4000-8000-000000000002', 'v3-admin@example.test'),
  ('81000000-0000-4000-8000-000000000003', 'v3-manager@example.test'),
  ('81000000-0000-4000-8000-000000000004', 'v3-broker@example.test'),
  ('81000000-0000-4000-8000-000000000005', 'v3-other-broker@example.test');

select public.bootstrap_master_user('81000000-0000-4000-8000-000000000001');

-- Test-local activation only. Production role grants require a separate,
-- reviewed shadow/cutover decision after old-image compatibility is proven.
insert into public.role_permissions (role_key, permission_key)
values
  ('master', 'crm.read_model_v3.view'),
  ('master', 'crm.read_model_v3.ranking.view'),
  ('master', 'crm.read_model_v3.partnerships.view'),
  ('master', 'crm.read_model_v3.stock.view');

insert into public.crm_organizations (id, organization_key, name, kind)
values
  ('82000000-0000-4000-8000-000000000001', 'v3-org-a', 'V3 Organization A', 'house'),
  ('82000000-0000-4000-8000-000000000002', 'v3-org-b', 'V3 Organization B', 'real_estate');

insert into public.crm_teams (id, organization_id, team_key, name)
values
  (
    '83000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'v3-team-a', 'V3 Team A'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    'v3-team-b', 'V3 Team B'
  );

insert into public.crm_people (id, person_key, display_name, auth_user_id)
values
  ('84000000-0000-4000-8000-000000000001', 'v3-coordinator-a', 'V3 Coordinator A', null),
  ('84000000-0000-4000-8000-000000000002', 'v3-manager-a', 'V3 Manager A',
    '81000000-0000-4000-8000-000000000003'),
  ('84000000-0000-4000-8000-000000000003', 'v3-broker-a', 'V3 Broker A',
    '81000000-0000-4000-8000-000000000004'),
  ('84000000-0000-4000-8000-000000000004', 'v3-broker-b', 'V3 Broker B',
    '81000000-0000-4000-8000-000000000005');

insert into public.crm_team_memberships (
  team_id, person_id, membership_role, valid_from
)
values
  ('83000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001', 'coordinator', '2026-01-01'),
  ('83000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000002', 'manager', '2026-01-01'),
  ('83000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000003', 'broker', '2026-01-01'),
  ('83000000-0000-4000-8000-000000000002',
    '84000000-0000-4000-8000-000000000004', 'broker', '2026-01-01');

insert into public.crm_portfolios (id, portfolio_key, name, kind)
values (
  '85000000-0000-4000-8000-000000000001',
  'v3-partnership-a', 'V3 Partnership A', 'partnership'
);
insert into public.crm_portfolio_organizations (
  portfolio_id, organization_id, valid_from
)
values (
  '85000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '2026-01-01'
);

insert into public.crm_reporting_scopes (
  id, scope_key, scope_type, organization_id, team_id, portfolio_id, person_id
)
values
  ('86000000-0000-4000-8000-000000000001', 'v3-org-a', 'organization',
    '82000000-0000-4000-8000-000000000001', null, null, null),
  ('86000000-0000-4000-8000-000000000002', 'v3-org-b', 'organization',
    '82000000-0000-4000-8000-000000000002', null, null, null),
  ('86000000-0000-4000-8000-000000000003', 'v3-team-a', 'team', null,
    '83000000-0000-4000-8000-000000000001', null, null),
  ('86000000-0000-4000-8000-000000000004', 'v3-person-a', 'person', null,
    null, null, '84000000-0000-4000-8000-000000000003'),
  ('86000000-0000-4000-8000-000000000005', 'v3-person-b', 'person', null,
    null, null, '84000000-0000-4000-8000-000000000004'),
  ('86000000-0000-4000-8000-000000000006', 'v3-portfolio-a', 'portfolio', null,
    null, '85000000-0000-4000-8000-000000000001', null);

update public.user_roles
set role_key = case user_id
      when '81000000-0000-4000-8000-000000000002' then 'admin'
      when '81000000-0000-4000-8000-000000000003' then 'manager'
      when '81000000-0000-4000-8000-000000000004' then 'broker'
      when '81000000-0000-4000-8000-000000000005' then 'broker'
    end,
    assigned_by = '81000000-0000-4000-8000-000000000001'
where user_id between
  '81000000-0000-4000-8000-000000000002'
  and '81000000-0000-4000-8000-000000000005';

insert into public.crm_user_reporting_scope_grants (
  user_id, reporting_scope_id, granted_by, reason, valid_from
)
values
  ('81000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001', 'V3 Admin organization scope', now()),
  ('81000000-0000-4000-8000-000000000003',
    '86000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001', 'V3 Manager team scope', now()),
  ('81000000-0000-4000-8000-000000000004',
    '86000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000001', 'V3 Broker own-person scope', now()),
  ('81000000-0000-4000-8000-000000000005',
    '86000000-0000-4000-8000-000000000005',
    '81000000-0000-4000-8000-000000000001', 'V3 other Broker own-person scope', now());

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = '81000000-0000-4000-8000-000000000001'
where user_id between
  '81000000-0000-4000-8000-000000000002'
  and '81000000-0000-4000-8000-000000000005';

insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
)
select
  id,
  'crm.read_model_v3.view',
  'allow',
  'V3 scoped read contract test',
  '81000000-0000-4000-8000-000000000001'
from auth.users
where id between
  '81000000-0000-4000-8000-000000000002'
  and '81000000-0000-4000-8000-000000000005';

select is(
  (select count(*)
   from private.crm_reporting_scope_grant_lineage lineage
   join public.crm_user_reporting_scope_grants grant_row
     on grant_row.id = lineage.grant_id
   where grant_row.user_id between
     '81000000-0000-4000-8000-000000000002'
     and '81000000-0000-4000-8000-000000000005'
     and lineage.parent_grant_id is not null
     and lineage.depth = 1
     and not lineage.requires_reconciliation),
  4::bigint,
  'all synthetic delegated grants have one reconciled Master-root parent'
);
select ok(
  (select private.reporting_scope_grant_lineage_is_effective(grant_row.id, now())
   from public.crm_user_reporting_scope_grants grant_row
   where grant_row.user_id = '81000000-0000-4000-8000-000000000002'),
  'Admin lineage is effective only through its active Master ancestor'
);

insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind
)
values
  (
    '87000000-0000-4000-8000-000000000001',
    'v3-official-mapping-owner', 'V3 official mapping owner', 'team'
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    'v3-official-source-owner', 'V3 official source owner', 'team'
  );

insert into private.crm_read_model_v3_sources (
  dataset_key, source_key, workflow_key, producer_key, owner_id,
  is_active, require_complete_coverage, approved_at, approved_by,
  evidence_reference
)
values
  (
    'funnel', 'salesforce', 'official-export-v3', 'crm-relay-v3',
    '87000000-0000-4000-8000-000000000002', true, true, now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/funnel-source-authority'
  ),
  (
    'ranking', 'salesforce', 'official-export-v3', 'crm-relay-v3',
    '87000000-0000-4000-8000-000000000002', true, false, now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/ranking-source-authority'
  );

insert into public.crm_origins (id, organization_id, origin_key, name)
values
  ('88000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'v3-origin-a', 'V3 Origin A'),
  ('88000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002', 'v3-origin-b', 'V3 Origin B');
insert into public.crm_developments (id, organization_id, development_key, name)
values
  ('89000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'v3-development-a', 'V3 Development A'),
  ('89000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002', 'v3-development-b', 'V3 Development B');
insert into public.crm_locations (id, organization_id, location_key, name, location_kind)
values
  ('8a000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'v3-stand-a', 'V3 Stand A', 'stand'),
  ('8a000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002', 'v3-region-b', 'V3 Region B', 'region');

insert into public.crm_source_identities (
  source, entity_kind, external_id,
  person_id, organization_id, team_id, portfolio_id, reporting_scope_id,
  origin_id, development_id, location_id,
  mapping_status, mapping_owner_id, valid_from, verified_at, verified_by,
  evidence_reference
)
values
  ('salesforce', 'reporting_scope', 'scope-global', null, null, null, null,
    '00000000-0000-4000-8000-000000000001', null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/scope-global'),
  ('salesforce', 'reporting_scope', 'scope-org-a', null, null, null, null,
    '86000000-0000-4000-8000-000000000001', null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/scope-org-a'),
  ('salesforce', 'reporting_scope', 'scope-person-a', null, null, null, null,
    '86000000-0000-4000-8000-000000000004', null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/scope-person-a'),
  ('salesforce', 'reporting_scope', 'scope-person-b', null, null, null, null,
    '86000000-0000-4000-8000-000000000005', null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/scope-person-b'),
  ('salesforce', 'organization', 'org-a', null,
    '82000000-0000-4000-8000-000000000001', null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/org-a'),
  ('salesforce', 'organization', 'org-b', null,
    '82000000-0000-4000-8000-000000000002', null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/org-b'),
  ('salesforce', 'team', 'team-a', null, null,
    '83000000-0000-4000-8000-000000000001', null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/team-a'),
  ('salesforce', 'team', 'team-b', null, null,
    '83000000-0000-4000-8000-000000000002', null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/team-b'),
  ('salesforce', 'portfolio', 'portfolio-a', null, null, null,
    '85000000-0000-4000-8000-000000000001', null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/portfolio-a'),
  ('salesforce', 'person', 'coordinator-a',
    '84000000-0000-4000-8000-000000000001', null, null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/coordinator-a'),
  ('salesforce', 'person', 'manager-a',
    '84000000-0000-4000-8000-000000000002', null, null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/manager-a'),
  ('salesforce', 'person', 'broker-a',
    '84000000-0000-4000-8000-000000000003', null, null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/broker-a'),
  ('salesforce', 'person', 'broker-b',
    '84000000-0000-4000-8000-000000000004', null, null, null, null, null, null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/broker-b'),
  ('salesforce', 'origin', 'origin-a', null, null, null, null, null,
    '88000000-0000-4000-8000-000000000001', null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/origin-a'),
  ('salesforce', 'origin', 'origin-b', null, null, null, null, null,
    '88000000-0000-4000-8000-000000000002', null, null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/origin-b'),
  ('salesforce', 'development', 'development-a', null, null, null, null, null,
    null, '89000000-0000-4000-8000-000000000001', null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/development-a'),
  ('salesforce', 'development', 'development-b', null, null, null, null, null,
    null, '89000000-0000-4000-8000-000000000002', null,
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/development-b'),
  ('salesforce', 'location', 'location-a', null, null, null, null, null,
    null, null, '8a000000-0000-4000-8000-000000000001',
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/location-a'),
  ('salesforce', 'location', 'location-b', null, null, null, null, null,
    null, null, '8a000000-0000-4000-8000-000000000002',
    'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
    '81000000-0000-4000-8000-000000000001', 'qa://v3/location-b');

select is(
  (select count(*) from public.crm_source_identities
   where source = 'salesforce' and mapping_status = 'verified'
     and mapping_owner_id = '87000000-0000-4000-8000-000000000001'),
  19::bigint,
  'all source identities are verified, owned and evidenced'
);
select is(
  (select count(*) from private.crm_source_identity_history
   where (current_record ->> 'source') = 'salesforce'),
  19::bigint,
  'mapping creation is recorded in immutable audit history'
);
select throws_ok(
  $$insert into public.crm_source_identities (
      source, entity_kind, external_id, organization_id,
      mapping_status, verified_at, verified_by, evidence_reference
    ) values (
      'salesforce', 'organization', 'unowned-organization',
      '82000000-0000-4000-8000-000000000001',
      'verified', now(), '81000000-0000-4000-8000-000000000001',
      'qa://v3/unowned'
    )$$,
  '23514',
  null,
  'verified mapping without explicit ownership is rejected'
);
select throws_ok(
  $$insert into public.crm_source_identities (
      source, entity_kind, external_id, person_id,
      mapping_status, mapping_owner_id, valid_from, valid_until,
      verified_at, verified_by, evidence_reference
    ) values (
      'salesforce', 'person', 'broker-a',
      '84000000-0000-4000-8000-000000000003',
      'verified', '87000000-0000-4000-8000-000000000001',
      '2025-12-01', '2026-02-01', now(),
      '81000000-0000-4000-8000-000000000001', 'qa://v3/overlap-rejected'
    )$$,
  '23505',
  'conflict: source identity validity windows overlap',
  'external identity versions cannot overlap silently'
);

insert into public.crm_source_identities (
  source, entity_kind, external_id, reporting_scope_id,
  mapping_status, mapping_owner_id, valid_from, verified_at, verified_by,
  evidence_reference
) values (
  'salesforce', 'reporting_scope', 'scope-team-a',
  '86000000-0000-4000-8000-000000000003',
  'verified', '87000000-0000-4000-8000-000000000001',
  '2026-01-01', now(), '81000000-0000-4000-8000-000000000001',
  'qa://v3/scope-team-a'
);

create temporary table v3_test_payloads (
  payload_key text primary key,
  payload jsonb not null
);

insert into v3_test_payloads (payload_key, payload)
values (
  'funnel-ready',
  jsonb_build_object(
    'schemaVersion', 3,
    'requestId', '8b000000-0000-4000-8000-000000000001',
    'datasetKey', 'funnel',
    'sourceKey', 'salesforce',
    'workflowKey', 'official-export-v3',
    'producerKey', 'crm-relay-v3',
    'sourceSnapshotId', 'v3-funnel-ready-001',
    'referenceDate', '2026-08-09',
    'timezone', 'America/Sao_Paulo',
    'generatedAt', '2026-08-09T18:00:00Z',
    'sourceUpdatedAt', '2026-08-09T17:55:00Z',
    'coverage', jsonb_build_object(
      'start', '2026-01-01', 'end', '2026-08-09', 'status', 'complete'
    ),
    'sourceStatus', 'ready',
    'statusReason', null,
    'qualityStatus', 'verified',
    'qualityIssues', jsonb_build_array(),
    'availableMeasures', jsonb_build_array('counts', 'sales_amount'),
    'coveredReportingScopeExternalIds', jsonb_build_array(
      'scope-global', 'scope-org-a', 'scope-team-a', 'scope-person-a'
    ),
    'closedMonths', jsonb_build_array('2026-06-01', '2026-07-01'),
    'records', jsonb_build_array(
      jsonb_build_object(
        'sourceRecordId', 'opportunity-a', 'stageKey', 'opportunities',
        'occurredAt', '2026-08-09T10:00:00-03:00', 'commercialDate', '2026-08-09',
        'amount', null,
        'dimensions', jsonb_build_object(
          'reportingScopeExternalId', 'scope-person-a',
          'organizationExternalId', 'org-a', 'teamExternalId', 'team-a',
          'portfolioExternalId', 'portfolio-a',
          'coordinatorExternalId', 'coordinator-a', 'managerExternalId', 'manager-a',
          'brokerExternalId', 'broker-a', 'originExternalId', 'origin-a',
          'developmentExternalId', 'development-a', 'locationExternalId', 'location-a'
        )
      ),
      jsonb_build_object(
        'sourceRecordId', 'appointment-a', 'stageKey', 'appointments',
        'occurredAt', '2026-08-09T11:00:00-03:00', 'commercialDate', '2026-08-09',
        'amount', null,
        'dimensions', jsonb_build_object(
          'reportingScopeExternalId', 'scope-person-a',
          'organizationExternalId', 'org-a', 'teamExternalId', 'team-a',
          'portfolioExternalId', 'portfolio-a',
          'coordinatorExternalId', 'coordinator-a', 'managerExternalId', 'manager-a',
          'brokerExternalId', 'broker-a', 'originExternalId', 'origin-a',
          'developmentExternalId', 'development-a', 'locationExternalId', 'location-a'
        )
      ),
      jsonb_build_object(
        'sourceRecordId', 'sale-a', 'stageKey', 'sales',
        'occurredAt', '2026-08-09T12:00:00-03:00', 'commercialDate', '2026-08-09',
        'amount', '250000.00',
        'dimensions', jsonb_build_object(
          'reportingScopeExternalId', 'scope-person-a',
          'organizationExternalId', 'org-a', 'teamExternalId', 'team-a',
          'portfolioExternalId', 'portfolio-a',
          'coordinatorExternalId', 'coordinator-a', 'managerExternalId', 'manager-a',
          'brokerExternalId', 'broker-a', 'originExternalId', 'origin-a',
          'developmentExternalId', 'development-a', 'locationExternalId', 'location-a'
        )
      ),
      jsonb_build_object(
        'sourceRecordId', 'opportunity-b', 'stageKey', 'opportunities',
        'occurredAt', '2026-08-09T13:00:00-03:00', 'commercialDate', '2026-08-09',
        'amount', null,
        'dimensions', jsonb_build_object(
          'reportingScopeExternalId', 'scope-person-b',
          'organizationExternalId', 'org-b', 'teamExternalId', 'team-b',
          'brokerExternalId', 'broker-b', 'originExternalId', 'origin-b',
          'developmentExternalId', 'development-b', 'locationExternalId', 'location-b'
        )
      )
    )
  )
);

select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{coveredReportingScopeExternalIds}', '[]'::jsonb
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 quality contract',
  'ready snapshots require at least one explicit covered reporting scope'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{coveredReportingScopeExternalIds}',
        '["scope-global"," scope-global "]'::jsonb
      )
    )$$,
  '22023',
  'invalid_argument: duplicate covered reporting scope',
  'scope-manifest uniqueness is enforced after canonical whitespace normalization'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{coveredReportingScopeExternalIds}',
        (
          select jsonb_agg(to_jsonb('scope-' || sequence::text) order by sequence)
          from generate_series(1, 1001) sequence
        )
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 arrays',
  'scope coverage manifests are bounded to 1,000 explicit identities'
);

select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
            '{requestId}', '"8b000000-0000-4000-8000-00000000000a"'
          ),
          '{sourceSnapshotId}', '"unauthorized-source"'
        ),
        '{producerKey}', '"unapproved-producer"'
      )
    )$$,
  '42501',
  'forbidden: dataset source authority is unavailable',
  'an unapproved dataset/source/workflow/producer tuple fails closed'
);

select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{generatedAt}', '"2026-08-09T18:00:00"'
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 envelope values',
  'generatedAt without an explicit ISO offset is rejected before casting'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{generatedAt}', '"infinity"'
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 envelope values',
  'non-finite special timestamps are rejected before casting'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{generatedAt}', '"2026-08-09 18:00:00Z"'
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 envelope values',
  'noncanonical ISO timestamp separators are rejected'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{referenceDate}', '"2026-8-9"'
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 envelope values',
  'noncanonical calendar dates are rejected before casting'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{referenceDate}', '"infinity"'
      )
    )$$,
  '22023',
  'invalid_argument: invalid CRM v3 envelope values',
  'non-finite special dates are rejected before casting'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{timezone}', '"Factory"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'PostgreSQL-only Factory timezone is rejected as incompatible with Intl'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
          '{sourceStatus}', '"stale"'
        ),
        '{statusReason}', '"Not Canonical"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'statusReason must be a canonical lowercase slug'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
          '{sourceStatus}', '"stale"'
        ),
        '{statusReason}', to_jsonb(repeat('a', 101))
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'statusReason cannot exceed 100 characters'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
          '{sourceStatus}', '"stale"'
        ),
        '{statusReason}', '123'::jsonb
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'statusReason must be a JSON string rather than a coercible number'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{records,2,amount}', '"NaN"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 record',
  'NaN amount strings are rejected before numeric casting'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{records,2,amount}', '"10000000000000000.00"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 record',
  'amount strings cannot exceed 16 integer digits'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{records,2,amount}', '"1e3"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 record',
  'amount strings reject exponent notation before numeric casting'
);

select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
              '{requestId}', '"8b000000-0000-4000-8000-000000000009"'
            ),
            '{sourceSnapshotId}', '"cross-organization-team-scope"'
          ),
          '{generatedAt}', '"2026-08-09T17:59:00Z"'
        ),
        '{records}',
        jsonb_build_array(
          jsonb_build_object(
            'sourceRecordId', 'cross-organization-attempt',
            'stageKey', 'opportunities',
            'occurredAt', '2026-08-09T13:00:00-03:00',
            'commercialDate', '2026-08-09',
            'amount', null,
            'dimensions', jsonb_build_object(
              'reportingScopeExternalId', 'scope-team-a',
              'organizationExternalId', 'org-b'
            )
          )
        )
      )
    )$$,
  '23514',
  'conflict: mapped dimensions do not share one canonical scope',
  'team scope cannot omit its team dimension to publish another organization'
);

grant select on v3_test_payloads to service_role;
set local role service_role;
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-ready')
    )$$,
  'service_role can publish an official mapped v3 snapshot through the sole RPC grant'
);
reset role;
select is(
  (select publication_status || ':' || source_status || ':' || record_count
   from public.crm_read_model_v3_runs
   where request_id = '8b000000-0000-4000-8000-000000000001'),
  'published:ready:4',
  'published run retains explicit source state and reconciled count'
);
select is(
  (select count(*) from public.crm_read_model_v3_events),
  4::bigint,
  'each official source grain is stored once'
);
select is(
  (select array_agg(scope.scope_key order by scope.scope_key)
   from public.crm_read_model_v3_scope_coverage coverage
   join public.crm_reporting_scopes scope on scope.id = coverage.reporting_scope_id
   join public.crm_read_model_v3_runs run on run.id = coverage.run_id
   where run.request_id = '8b000000-0000-4000-8000-000000000001'),
  array['global', 'v3-org-a', 'v3-person-a', 'v3-team-a']::text[],
  'published run stores every exact covered scope, including empty aggregate scopes'
);
select throws_ok(
  $$update public.crm_read_model_v3_scope_coverage
    set created_at = created_at
    where run_id = (
      select id from public.crm_read_model_v3_runs
      where request_id = '8b000000-0000-4000-8000-000000000001'
    )$$,
  '55000',
  'conflict: published read-model records are immutable',
  'published exact scope manifests are immutable'
);
select throws_ok(
  $$insert into public.crm_read_model_v3_events (
      run_id, stage_key, source_record_id, occurred_at, commercial_date, amount,
      reporting_scope_id, reporting_scope_identity_id,
      organization_id, organization_identity_id, record_hash
    )
    select
      run_id, 'sales', 'direct-nan-attempt', occurred_at, commercial_date,
      'NaN'::numeric, reporting_scope_id, reporting_scope_identity_id,
      organization_id, organization_identity_id, repeat('0', 64)
    from public.crm_read_model_v3_events
    order by source_record_id
    limit 1$$,
  '23514',
  null,
  'event CHECK rejects non-finite numeric NaN even outside the RPC parser'
);
select is(
  (select run.source_snapshot_id
   from public.crm_read_model_v3_active_runs active_run
   join public.crm_read_model_v3_runs run on run.id = active_run.run_id
   where active_run.dataset_key = 'funnel'),
  'v3-funnel-ready-001',
  'atomic publication advances only the dataset active pointer'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{sourceKey}', to_jsonb(repeat('a', 101))
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'sourceKey cannot exceed 100 characters'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{workflowKey}', to_jsonb(repeat('a', 101))
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'workflowKey cannot exceed 100 characters'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{producerKey}', to_jsonb(repeat('a', 101))
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'producerKey cannot exceed 100 characters'
);
select throws_ok(
  $$insert into private.crm_read_model_v3_sources (
      dataset_key, source_key, workflow_key, producer_key, owner_id
    ) values (
      'stock', repeat('s', 101), repeat('w', 101), repeat('p', 101),
      '87000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'source catalog CHECK blocks oversized integration authority keys'
);
select throws_ok(
  $$insert into public.crm_read_model_v3_runs (
      request_id, payload_hash, dataset_key, source_key, workflow_key,
      producer_key, source_snapshot_id, reference_date, timezone,
      generated_at, source_updated_at, coverage_start, coverage_end,
      coverage_status, source_status, status_reason, quality_status,
      quality_issues, available_measures, publication_status,
      rejection_reason, record_count, published_at
    )
    select
      '8b000000-0000-4000-8000-000000000014', payload_hash, dataset_key,
      repeat('s', 101), repeat('w', 101), repeat('p', 101),
      'v3-oversized-run-check', reference_date, timezone, generated_at,
      source_updated_at, coverage_start, coverage_end, coverage_status,
      source_status, status_reason, quality_status, quality_issues,
      available_measures, publication_status, rejection_reason, record_count,
      published_at
    from public.crm_read_model_v3_runs
    where request_id = '8b000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'run envelope CHECK blocks oversized integration authority keys'
);
select is(
  (select run.source_snapshot_id
   from public.crm_read_model_v3_active_runs active_run
   join public.crm_read_model_v3_runs run on run.id = active_run.run_id
   where active_run.dataset_key = 'funnel'),
  'v3-funnel-ready-001',
  'oversized integration keys cannot mutate the active run'
);
select is(
  (public.ingest_crm_read_model_v3(
    (select payload from v3_test_payloads where payload_key = 'funnel-ready')
  ) ->> 'noop')::boolean,
  true,
  'identical request replay is an idempotent noop'
);
select is(
  (public.ingest_crm_read_model_v3(
    (
      select payload || jsonb_build_object(
        'availableMeasures', jsonb_build_array('sales_amount', 'counts'),
        'coveredReportingScopeExternalIds', jsonb_build_array(
          'scope-team-a', 'scope-person-a', 'scope-org-a', 'scope-global'
        ),
        'closedMonths', jsonb_build_array('2026-07-01', '2026-06-01'),
        'records', (
          select jsonb_agg(record order by ordinal desc)
          from jsonb_array_elements(payload -> 'records')
            with ordinality item(record, ordinal)
        )
      )
      from v3_test_payloads where payload_key = 'funnel-ready'
    )
  ) ->> 'noop')::boolean,
  true,
  'semantic replay is idempotent when unordered arrays arrive reordered'
);
insert into v3_test_payloads (payload_key, payload)
select
  'funnel-unknown-scope-manifest',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          payload,
          '{requestId}', '"8b000000-0000-4000-8000-000000000010"'
        ),
        '{sourceSnapshotId}', '"v3-funnel-unknown-scope-manifest"'
      ),
      '{generatedAt}', '"2026-08-09T18:02:00Z"'
    ),
    '{coveredReportingScopeExternalIds}', '["unknown-scope"]'::jsonb
  )
from v3_test_payloads where payload_key = 'funnel-ready';
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads
       where payload_key = 'funnel-unknown-scope-manifest')
    )$$,
  'unknown manifest identities reject atomically through reconciliation'
);
select is(
  (
    select rejected.publication_status || ':' || rejected.rejection_reason || ':'
      || active_snapshot.source_snapshot_id
    from public.crm_read_model_v3_runs rejected
    cross join public.crm_read_model_v3_active_runs active_run
    join public.crm_read_model_v3_runs active_snapshot on active_snapshot.id = active_run.run_id
    where rejected.request_id = '8b000000-0000-4000-8000-000000000010'
      and active_run.dataset_key = 'funnel'
  ),
  'rejected:unresolved_mappings:v3-funnel-ready-001',
  'unknown manifest mapping stores no coverage and preserves the active run'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
              '{requestId}', '"8b000000-0000-4000-8000-000000000011"'
            ),
            '{sourceSnapshotId}', '"v3-funnel-event-outside-manifest"'
          ),
          '{generatedAt}', '"2026-08-09T18:03:00Z"'
        ),
        '{coveredReportingScopeExternalIds}', '["scope-person-a"]'::jsonb
      )
    )$$,
  '23514',
  'conflict: event scope is outside declared scope coverage',
  'every event must be contained by at least one explicitly manifested scope'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
        '{sourceSnapshotId}', '"different-content"'
      )
    )$$,
  '23505',
  'conflict: request id was reused with different content',
  'same request ID with a different semantic payload is rejected'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
            '{requestId}', '"8b000000-0000-4000-8000-000000000002"'
          ),
          '{sourceSnapshotId}', '"duplicate-grain"'
        ),
        '{records}',
        ((select payload -> 'records' from v3_test_payloads
          where payload_key = 'funnel-ready') ||
         jsonb_build_array((select payload -> 'records' -> 0 from v3_test_payloads
          where payload_key = 'funnel-ready')))
      )
    )$$,
  '22023',
  'invalid_argument: duplicate source record grain',
  'duplicate source grain rejects the entire batch'
);
select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
              '{requestId}', '"8b000000-0000-4000-8000-000000000008"'
            ),
            '{sourceSnapshotId}', '"excessive-amount-precision"'
          ),
          '{generatedAt}', '"2026-08-09T18:05:00Z"'
        ),
        '{records,2,amount}', '"1.001"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 record',
  'amounts with more than two decimal places are rejected instead of rounded'
);

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-unmapped',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(payload, '{requestId}', '"8b000000-0000-4000-8000-000000000003"'),
        '{sourceSnapshotId}', '"v3-funnel-unmapped-001"'
      ),
      '{generatedAt}', '"2026-08-09T18:10:00Z"'
    ),
    '{records,0,dimensions,brokerExternalId}', '"unknown-broker"'
  )
from v3_test_payloads where payload_key = 'funnel-ready';

select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-unmapped')
    )$$,
  'unknown IDs are quarantined without a partial publication error'
);
select is(
  (select publication_status || ':' || rejection_reason || ':' || record_count
   from public.crm_read_model_v3_runs
   where request_id = '8b000000-0000-4000-8000-000000000003'),
  'rejected:unresolved_mappings:0',
  'unresolved mapping rejects the whole run with zero facts'
);
select is(
  (select status || ':' || reason_code
   from private.crm_identity_reconciliation_items
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'unknown-broker'),
  'pending:verified_mapping_missing',
  'unknown official ID enters the owner-only reconciliation queue'
);
select is(
  (select run.source_snapshot_id
   from public.crm_read_model_v3_active_runs active_run
   join public.crm_read_model_v3_runs run on run.id = active_run.run_id
   where active_run.dataset_key = 'funnel'),
  'v3-funnel-ready-001',
  'rejected run cannot move the active pointer'
);

insert into public.crm_source_identities (
  source, entity_kind, external_id, person_id, mapping_status, valid_from
) values (
  'salesforce', 'person', 'pending-broker',
  '84000000-0000-4000-8000-000000000004', 'pending', now()
);

create temporary table v3_mapping_review_payloads (
  payload_key text primary key,
  payload jsonb not null
);
insert into v3_mapping_review_payloads (payload_key, payload)
values (
  'verify-unknown-broker',
  jsonb_build_object(
    'requestId', '8c000000-0000-4000-8000-000000000001',
    'source', 'salesforce',
    'entityKind', 'person',
    'externalId', 'unknown-broker',
    'ownerKey', 'v3-official-mapping-owner',
    'targetId', '84000000-0000-4000-8000-000000000003',
    'decision', 'verify',
    'effectiveFrom', '2026-01-01T00:00:00Z',
    'evidenceReference', 'qa://v3/unknown-broker-reviewed',
    'reason', 'official_identity_evidence_verified'
  )
), (
  'verify-pending-broker',
  jsonb_build_object(
    'requestId', '8c000000-0000-4000-8000-000000000003',
    'source', 'salesforce',
    'entityKind', 'person',
    'externalId', 'pending-broker',
    'ownerKey', 'v3-official-mapping-owner',
    'targetId', '84000000-0000-4000-8000-000000000004',
    'decision', 'verify',
    'effectiveFrom', '2026-02-01T00:00:00Z',
    'evidenceReference', 'qa://v3/pending-broker-reviewed',
    'reason', 'pending_identity_evidence_verified'
  )
), (
  'reject-unknown-broker',
  jsonb_build_object(
    'requestId', '8c000000-0000-4000-8000-000000000002',
    'source', 'salesforce',
    'entityKind', 'person',
    'externalId', 'unknown-broker',
    'decision', 'reject',
    'evidenceReference', 'qa://v3/unknown-broker-retired',
    'reason', 'official_identity_retired'
  )
);
grant select on v3_mapping_review_payloads to authenticated;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  (public.review_crm_source_identity_mapping(
    (select payload from v3_mapping_review_payloads
     where payload_key = 'verify-unknown-broker')
  ) ->> 'noop')::boolean,
  false,
  'Master verifies an unknown ID with explicit owner, evidence and effective date'
);
reset role;
select is(
  (select status from private.crm_identity_reconciliation_items
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'unknown-broker'),
  'resolved',
  'mapping verification resolves the reconciliation item atomically'
);
select is(
  (select mapping_status || ':' || valid_from::date::text
   from public.crm_source_identities
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'unknown-broker' and valid_until is null),
  'verified:2026-01-01',
  'reviewed mapping preserves its audited historical effective date'
);
set local role authenticated;
select is(
  (public.review_crm_source_identity_mapping(
    (select payload from v3_mapping_review_payloads
     where payload_key = 'verify-unknown-broker')
  ) ->> 'noop')::boolean,
  true,
  'mapping review request replay is idempotent'
);
select is(
  (public.review_crm_source_identity_mapping(
    (select payload from v3_mapping_review_payloads
     where payload_key = 'verify-pending-broker')
  ) ->> 'noop')::boolean,
  false,
  'matching pending mapping is promoted instead of duplicated'
);
reset role;
select is(
  (select mapping_status || ':' || valid_from::date::text
   from public.crm_source_identities
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'pending-broker' and valid_until is null),
  'verified:2026-02-01',
  'pending promotion applies the reviewed historical effective date'
);

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-unmapped-retry',
  jsonb_set(
    jsonb_set(
      jsonb_set(payload, '{requestId}', '"8b000000-0000-4000-8000-00000000000b"'),
      '{sourceSnapshotId}', '"v3-funnel-unmapped-retry-001"'
    ),
    '{generatedAt}', '"2026-08-09T18:11:00Z"'
  )
from v3_test_payloads where payload_key = 'funnel-unmapped';

select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-unmapped-retry')
    )$$,
  'a rejected snapshot can be retried under a new request after mapping review'
);
select is(
  (select publication_status || ':' || record_count
   from public.crm_read_model_v3_runs
   where request_id = '8b000000-0000-4000-8000-00000000000b'),
  'published:4',
  'reviewed identity enables full atomic retry without partial facts'
);

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-whitespace-normalized',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          payload || jsonb_build_object(
            'requestId', '8b000000-0000-4000-8000-000000000012',
            'sourceSnapshotId', 'v3-funnel-whitespace-normalized-001',
            'generatedAt', '2026-08-09T18:12:00Z'
          ),
          '{coveredReportingScopeExternalIds}',
          '[" scope-global ","scope-org-a","scope-team-a","scope-person-a"]'::jsonb
        ),
        '{records,0,dimensions,reportingScopeExternalId}',
        '" scope-person-a "'::jsonb
      ),
      '{records,0,dimensions,organizationExternalId}',
      '" org-a "'::jsonb
    ),
    '{records,0,dimensions,brokerExternalId}',
    '" broker-a "'::jsonb
  )
from v3_test_payloads where payload_key = 'funnel-ready';
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads
       where payload_key = 'funnel-whitespace-normalized')
    )$$,
  'canonical whitespace normalization is consistent across every resolver pass'
);
select is(
  (
    select run.publication_status || ':' || run.record_count || ':'
      || count(coverage.reporting_scope_id)
    from public.crm_read_model_v3_runs run
    left join public.crm_read_model_v3_scope_coverage coverage
      on coverage.run_id = run.id
    where run.request_id = '8b000000-0000-4000-8000-000000000012'
    group by run.id
  ),
  'published:4:4',
  'normalized source IDs publish all facts and all explicit scope coverage rows'
);
select is(
  (
    select event.reporting_scope_id::text || ':' || event.organization_id::text
      || ':' || event.broker_id::text
    from public.crm_read_model_v3_events event
    join public.crm_read_model_v3_runs run on run.id = event.run_id
    where run.request_id = '8b000000-0000-4000-8000-000000000012'
      and event.source_record_id = 'opportunity-a'
  ),
  '86000000-0000-4000-8000-000000000004:'
    || '82000000-0000-4000-8000-000000000001:'
    || '84000000-0000-4000-8000-000000000003',
  'trimmed required and optional IDs resolve to their canonical active targets'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  (public.review_crm_source_identity_mapping(
    (select payload from v3_mapping_review_payloads
     where payload_key = 'reject-unknown-broker')
  ) ->> 'noop')::boolean,
  false,
  'Master can explicitly retire a previously verified mapping'
);
reset role;
select is(
  (select status from private.crm_identity_reconciliation_items
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'unknown-broker'),
  'rejected',
  'mapping rejection updates the reconciliation decision'
);
select ok(
  exists (
    select 1 from public.crm_source_identities
    where source = 'salesforce' and entity_kind = 'person'
      and external_id = 'unknown-broker'
      and mapping_status = 'verified' and valid_until is not null
  ) and not exists (
    select 1 from public.crm_source_identities
    where source = 'salesforce' and entity_kind = 'person'
      and external_id = 'unknown-broker' and valid_until is null
  ),
  'reject closes the verified version without rewriting its audit status'
);
select throws_ok(
  $$update public.crm_source_identities
    set person_id = '84000000-0000-4000-8000-000000000004'
    where source = 'salesforce' and entity_kind = 'person'
      and external_id = 'broker-a'$$,
  '55000',
  'conflict: source identity is immutable; close and version the mapping',
  'verified mapping target cannot be silently repointed'
);
select throws_ok(
  $$update public.crm_read_model_v3_runs set record_count = 0
    where request_id = '8b000000-0000-4000-8000-000000000001'$$,
  '55000',
  'conflict: published read-model records are immutable',
  'published run envelope is immutable'
);

select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
    )$$,
  '42501',
  null,
  'anonymous callers cannot execute the v3 read RPC'
);
reset role;

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
select is(
  (select array_agg(scope_type || ':' || scope_key order by scope_key)
   from public.list_crm_read_model_v3_scopes()),
  array['global:global']::text[],
  'Master receives only its explicit effective global scope option'
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'stock', '00000000-0000-4000-8000-000000000001',
      '{"organizationIds":[]}'::jsonb
    )$$,
  '22023',
  'invalid_argument: invalid dimensional filter',
  'malformed filters fail before the no-active-run state is evaluated'
);

select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true
);
select is(
  (select array_agg(scope_type || ':' || scope_key order by scope_key)
   from public.list_crm_read_model_v3_scopes()),
  array['organization:v3-org-a']::text[],
  'Admin receives only its explicit effective organization scope option'
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'ranking', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
    )$$,
  '42501',
  'forbidden: read-model dataset is unavailable',
  'generic funnel permission cannot open the ranking dataset'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,stageTotals,0,value}')::bigint,
  1::bigint,
  'Admin sees the organization-A opportunity only'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,stageTotals,4,value}')::bigint,
  1::bigint,
  'Admin sees the organization-A sale without cross-tenant facts'
);

select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000003', '{}'::jsonb
  ) #>> '{metrics,stageTotals,0,value}')::bigint,
  1::bigint,
  'Manager sees only events in the effective team scope'
);

select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000004', '{}'::jsonb
  ) #>> '{metrics,stageTotals,0,value}')::bigint,
  1::bigint,
  'Broker sees only events attached to the own-person scope'
);

select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'funnel',
      '86000000-0000-4000-8000-000000000001',
      '{"organizationIds":["82000000-0000-4000-8000-000000000002"]}'::jsonb
    )$$,
  '22023',
  'invalid_argument: filter value is unavailable in the selected scope',
  'forged cross-organization filter fails closed instead of broadening'
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'funnel', '86000000-0000-4000-8000-000000000001',
      '{"unexpected":true}'::jsonb
    )$$,
  '22023',
  'invalid_argument: invalid read-model filters',
  'unknown filter keys fail closed'
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'funnel', '86000000-0000-4000-8000-000000000001',
      '{"teamIds":[]}'::jsonb
    )$$,
  '22023',
  'invalid_argument: invalid dimensional filter',
  'empty arrays cannot silently become General'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel',
    '86000000-0000-4000-8000-000000000001',
    '{
      "originIds":["88000000-0000-4000-8000-000000000001"],
      "developmentIds":["89000000-0000-4000-8000-000000000001"],
      "locationIds":["8a000000-0000-4000-8000-000000000001"]
    }'::jsonb
  ) #>> '{metrics,stageTotals,0,value}')::bigint,
  1::bigint,
  'combined source-backed dimensions are deterministic'
);
select is(
  public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,goalsAvailable}',
  'false',
  'commercial goals remain explicitly unavailable in v3'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,salesAmount}')::numeric,
  250000::numeric,
  'official sales amount is preserved without a derived business rule'
);
select is(
  jsonb_typeof(
    public.get_crm_read_model_v3(
      'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
    ) #> '{metrics,salesAmount}'
  ),
  'string',
  'aggregated money is serialized as an exact decimal string'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,stageTotals,2,value}')::bigint,
  0::bigint,
  'ready source distinguishes a real empty stage as zero'
);
select is(
  (public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{metrics,stageTotals,0,closedMonthsAverage}')::numeric,
  0::numeric,
  'closed-month average uses only explicitly certified complete months'
);
select is(
  public.get_crm_read_model_v3(
    'funnel', '86000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) #>> '{source,timezone}',
  'America/Sao_Paulo',
  'read model exposes its explicit source timezone'
);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
select is(
  (
    select jsonb_build_array(
      response ->> 'dataStatus',
      response ->> 'reasonCode',
      response -> 'metrics' <> 'null'::jsonb,
      response #>> '{source,qualityStatus}',
      (response #> '{source,qualityIssues}')
        @> '["scope_coverage_not_proven"]'::jsonb
    )
    from (
      select public.get_crm_read_model_v3(
        'funnel',
        '00000000-0000-4000-8000-000000000001',
        '{"period":"custom","from":"2026-08-01","to":"2026-08-02"}'::jsonb
      ) response
    ) result
  ),
  '["empty",null,true,"verified",false]'::jsonb,
  'exact manifest proves a real empty scope-period without relying on visible facts'
);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true
);
select is(
  (
    select jsonb_build_array(
      response ->> 'dataStatus', response ->> 'reasonCode',
      response -> 'metrics', response -> 'breakdowns',
      response #>> '{source,qualityStatus}',
      (response #> '{source,qualityIssues}')
        @> '["scope_coverage_not_proven"]'::jsonb
    )
    from (
      select public.get_crm_read_model_v3(
        'funnel', '86000000-0000-4000-8000-000000000005', '{}'::jsonb
      ) response
    ) result
  ),
  '["unavailable","scope_coverage_not_proven",null,null,"warning",true]'::jsonb,
  'ancestor-manifest containment cannot substitute for an exact requested-scope manifest'
);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
select is(
  (
    select jsonb_build_array(
      response ->> 'dataStatus',
      response -> 'metrics' <> 'null'::jsonb,
      (
        select sum((stage ->> 'value')::bigint)
        from jsonb_array_elements(response #> '{metrics,stageTotals}') stage
      )
    )
    from (
      select public.get_crm_read_model_v3(
        'funnel',
        '00000000-0000-4000-8000-000000000001',
        '{
          "teamIds":["83000000-0000-4000-8000-000000000001"],
          "brokerIds":["84000000-0000-4000-8000-000000000004"]
        }'::jsonb
      ) response
    ) result
  ),
  '["empty",true,0]'::jsonb,
  'exactly manifested scope-period preserves empty when valid filter intersection has zero facts'
);
reset role;

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-month-period-not-covered',
  payload || jsonb_build_object(
    'requestId', '8b000000-0000-4000-8000-000000000013',
    'sourceSnapshotId', 'v3-funnel-month-period-not-covered-001',
    'generatedAt', '2026-08-09T18:13:00Z',
    'sourceUpdatedAt', '2026-08-09T18:12:00Z',
    'coverage', jsonb_build_object(
      'start', '2026-08-05', 'end', '2026-08-09', 'status', 'complete'
    ),
    'closedMonths', jsonb_build_array()
  )
from v3_test_payloads where payload_key = 'funnel-ready';
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads
       where payload_key = 'funnel-month-period-not-covered')
    )$$,
  'complete partial bounds can publish without claiming the whole preset month'
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  (
    select jsonb_build_array(
      response ->> 'dataStatus', response ->> 'reasonCode',
      response -> 'metrics', response -> 'breakdowns',
      response #>> '{source,qualityStatus}', response #> '{source,qualityIssues}'
    )
    from (
      select public.get_crm_read_model_v3(
        'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
      ) response
    ) result
  ),
  (
    '["unavailable","period_coverage_not_proven",null,null,"warning",'
      || '["period_coverage_not_proven"]]'
  )::jsonb,
  'month preset fails closed when certified complete bounds omit month start'
);
reset role;

select throws_ok(
  $$select public.ingest_crm_read_model_v3(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            (select payload from v3_test_payloads where payload_key = 'funnel-ready'),
            '{requestId}', '"8b000000-0000-4000-8000-000000000004"'
          ),
          '{sourceSnapshotId}', '"invalid-timezone"'
        ),
        '{timezone}', '"Brazil/Imaginary"'
      )
    )$$,
  '22023',
  'invalid_argument: inconsistent CRM v3 envelope',
  'unknown timezone is rejected before publication'
);

insert into v3_test_payloads (payload_key, payload)
values (
  'ranking-unavailable',
  jsonb_build_object(
    'schemaVersion', 3,
    'requestId', '8b000000-0000-4000-8000-000000000005',
    'datasetKey', 'ranking',
    'sourceKey', 'salesforce',
    'workflowKey', 'official-export-v3',
    'producerKey', 'crm-relay-v3',
    'sourceSnapshotId', 'v3-ranking-unavailable-001',
    'referenceDate', '2026-08-09',
    'timezone', 'America/Sao_Paulo',
    'generatedAt', '2026-08-09T18:20:00Z',
    'sourceUpdatedAt', null,
    'coverage', jsonb_build_object('start', null, 'end', null, 'status', 'unknown'),
    'sourceStatus', 'unavailable',
    'statusReason', 'official_contract_missing',
    'qualityStatus', 'warning',
    'qualityIssues', jsonb_build_array('official_contract_missing'),
    'availableMeasures', jsonb_build_array(),
    'coveredReportingScopeExternalIds', jsonb_build_array(),
    'closedMonths', jsonb_build_array(),
    'records', jsonb_build_array()
  )
);
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'ranking-unavailable')
    )$$,
  'explicit unavailable source state publishes without fake records'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  public.get_crm_read_model_v3(
    'ranking', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) ->> 'dataStatus',
  'unavailable',
  'unavailable source remains distinguishable from a ready zero'
);
select is(
  public.get_crm_read_model_v3(
    'ranking', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) -> 'metrics',
  'null'::jsonb,
  'unavailable source exposes no synthetic metrics'
);
reset role;

insert into v3_test_payloads (payload_key, payload)
values (
  'ranking-partial-ready',
  jsonb_build_object(
    'schemaVersion', 3,
    'requestId', '8b000000-0000-4000-8000-000000000006',
    'datasetKey', 'ranking',
    'sourceKey', 'salesforce',
    'workflowKey', 'official-export-v3',
    'producerKey', 'crm-relay-v3',
    'sourceSnapshotId', 'v3-ranking-partial-ready-001',
    'referenceDate', '2026-08-09',
    'timezone', 'America/Sao_Paulo',
    'generatedAt', '2026-08-09T18:25:00Z',
    'sourceUpdatedAt', '2026-08-09T18:24:00Z',
    'coverage', jsonb_build_object(
      'start', '2026-08-01', 'end', '2026-08-09', 'status', 'partial'
    ),
    'sourceStatus', 'ready',
    'statusReason', null,
    'qualityStatus', 'verified',
    'qualityIssues', jsonb_build_array(),
    'availableMeasures', jsonb_build_array('counts'),
    'coveredReportingScopeExternalIds', jsonb_build_array('scope-global'),
    'closedMonths', jsonb_build_array(),
    'records', jsonb_build_array()
  )
);
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'ranking-partial-ready')
    )$$,
  'authorized partial source state publishes without synthetic facts'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  (
    select jsonb_build_array(
      response ->> 'dataStatus', response ->> 'reasonCode', response -> 'metrics',
      response #>> '{source,qualityStatus}', response #> '{source,qualityIssues}'
    )
    from (
      select public.get_crm_read_model_v3(
        'ranking', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
      ) as response
    ) result
  ),
  '["unavailable","period_coverage_not_proven",null,"warning",["coverage_not_complete","period_coverage_not_proven"]]'::jsonb,
  'partial coverage cannot prove the resolved preset period or present synthetic zeros'
);
select throws_ok(
  $$select public.get_crm_read_model_v3(
      'ranking', '00000000-0000-4000-8000-000000000001',
      '{"period":"custom","from":"2026-07-31","to":"2026-08-02"}'::jsonb
    )$$,
  '22023',
  'invalid_argument: custom period exceeds certified coverage',
  'custom reads cannot extend outside certified source coverage'
);
reset role;

select is(
  (select array_agg(role_key order by role_key)
   from public.role_permissions
   where permission_key = 'crm.read_model_v3.view'),
  array['master']::text[],
  'test-local activation grants generic v3 access only to Master'
);
select is(
  (select array_agg(permission_key order by permission_key)
   from public.role_permissions
   where role_key = 'master'
     and permission_key like 'crm.read_model_v3.%.view'),
  array[
    'crm.read_model_v3.partnerships.view',
    'crm.read_model_v3.ranking.view',
    'crm.read_model_v3.stock.view'
  ]::text[],
  'test-local activation grants each dataset-specific v3 capability only to Master'
);
select is(
  (select string_agg(role_key || ':' || permission_key, ',' order by role_key, permission_key)
   from public.role_permissions
   where role_key <> 'master'
     and permission_key in (
       'crm.dashboard.view', 'crm.stages.view', 'crm.ranking.view',
       'crm.partnerships.view'
     )),
  'admin:crm.dashboard.view,admin:crm.ranking.view,admin:crm.stages.view,'
    || 'broker:crm.dashboard.view,broker:crm.ranking.view,broker:crm.stages.view,'
    || 'broker_lead:crm.dashboard.view,broker_lead:crm.ranking.view,'
    || 'broker_lead:crm.stages.view,coordinator:crm.dashboard.view,'
    || 'coordinator:crm.ranking.view,coordinator:crm.stages.view,'
    || 'real_estate:crm.dashboard.view,real_estate:crm.ranking.view,'
    || 'real_estate:crm.stages.view,supervisor:crm.dashboard.view,'
    || 'supervisor:crm.ranking.view,supervisor:crm.stages.view,'
    || 'user:crm.dashboard.view,user:crm.ranking.view,user:crm.stages.view',
  'v3 work preserves the exact production v2 read baseline without partnerships'
);
select is(
  (select string_agg(key || ':' || permission_key, ',' order by key)
   from public.app_pages
   where key in (
     'crm.dashboard', 'crm.stage.opportunities', 'crm.stage.appointments',
     'crm.stage.visits', 'crm.stage.folders', 'crm.stage.sales',
     'crm.partnerships', 'crm.ranking'
   )),
  'crm.dashboard:crm.dashboard.view,'
    || 'crm.partnerships:crm.partnerships.view,'
    || 'crm.ranking:crm.ranking.view,'
    || 'crm.stage.appointments:crm.stages.view,'
    || 'crm.stage.folders:crm.stages.view,'
    || 'crm.stage.opportunities:crm.stages.view,'
    || 'crm.stage.sales:crm.stages.view,'
    || 'crm.stage.visits:crm.stages.view',
  'v3 migration leaves production navigation gates unchanged during shadow validation'
);

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-performance',
  jsonb_build_object(
    'schemaVersion', 3,
    'requestId', '8b000000-0000-4000-8000-00000000000c',
    'datasetKey', 'funnel',
    'sourceKey', 'salesforce',
    'workflowKey', 'official-export-v3',
    'producerKey', 'crm-relay-v3',
    'sourceSnapshotId', 'v3-funnel-performance-10000',
    'referenceDate', '2026-08-09',
    'timezone', 'America/Sao_Paulo',
    'generatedAt', '2026-08-09T18:30:00Z',
    'sourceUpdatedAt', '2026-08-09T18:29:00Z',
    'coverage', jsonb_build_object(
      'start', '2026-01-01', 'end', '2026-08-09', 'status', 'complete'
    ),
    'sourceStatus', 'ready',
    'statusReason', null,
    'qualityStatus', 'verified',
    'qualityIssues', jsonb_build_array(),
    'availableMeasures', jsonb_build_array('counts', 'sales_amount'),
    'coveredReportingScopeExternalIds', jsonb_build_array('scope-global'),
    'closedMonths', jsonb_build_array(),
    'records', (
      select jsonb_agg(
        jsonb_build_object(
          'sourceRecordId', 'performance-' || sequence,
          'stageKey', stage_key,
          'occurredAt', '2026-08-09T12:00:00-03:00',
          'commercialDate', '2026-08-09',
          'amount', case when stage_key = 'sales'
            then to_jsonb('0.00'::text) else 'null'::jsonb end,
          'dimensions', jsonb_build_object(
            'reportingScopeExternalId', 'scope-global',
            'organizationExternalId', 'org-a'
          )
        ) order by sequence
      )
      from (
        select sequence,
          (array['opportunities', 'appointments', 'visits', 'folders', 'sales'])[
            1 + ((sequence - 1) % 5)
          ] as stage_key
        from generate_series(1, 10000) sequence
      ) generated
    )
  );

select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-performance')
    )$$,
  'ingestion handles the full 10,000-record contract inside its bounded timeout'
);
select is(
  (select record_count from public.crm_read_model_v3_runs
   where request_id = '8b000000-0000-4000-8000-00000000000c'),
  10000,
  'maximum-size ingestion publishes all source grains atomically'
);

analyze public.crm_read_model_v3_events;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select lives_ok(
  $$select public.get_crm_read_model_v3(
      'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
    )$$,
  'critical scoped aggregation handles the 10,000-record contract maximum within its timeout'
);
select is(
  (select sum((stage ->> 'value')::bigint)
   from jsonb_array_elements(
     public.get_crm_read_model_v3(
       'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
     ) #> '{metrics,stageTotals}'
   ) stage),
  10000::numeric,
  'maximum-size aggregation returns every visible fact exactly once'
);
reset role;

insert into public.crm_organizations (id, organization_key, name, kind)
select
  ('8d000000-0000-4000-8000-' || lpad(to_hex(sequence), 12, '0'))::uuid,
  'v3-cap-org-' || lpad(sequence::text, 3, '0'),
  'V3 Cap Organization ' || lpad(sequence::text, 3, '0'),
  'house'
from generate_series(1, 101) sequence;

insert into public.crm_source_identities (
  source, entity_kind, external_id, organization_id,
  mapping_status, mapping_owner_id, valid_from, verified_at, verified_by,
  evidence_reference
)
select
  'salesforce', 'organization', organization.organization_key, organization.id,
  'verified', '87000000-0000-4000-8000-000000000001', '2026-01-01', now(),
  '81000000-0000-4000-8000-000000000001',
  'qa://v3/' || organization.organization_key
from public.crm_organizations organization
where organization.organization_key like 'v3-cap-org-%';

insert into public.crm_read_model_v3_events (
  run_id, stage_key, source_record_id, occurred_at, commercial_date, amount,
  reporting_scope_id, reporting_scope_identity_id,
  organization_id, organization_identity_id, record_hash
)
select
  active_run.run_id,
  'opportunities',
  'option-cap-' || organization.organization_key,
  '2026-08-09T12:00:00-03:00'::timestamptz,
  '2026-08-09'::date,
  null,
  '00000000-0000-4000-8000-000000000001'::uuid,
  scope_identity.id,
  organization.id,
  organization_identity.id,
  repeat('1', 64)
from public.crm_read_model_v3_active_runs active_run
cross join public.crm_source_identities scope_identity
join public.crm_organizations organization
  on organization.organization_key like 'v3-cap-org-%'
join public.crm_source_identities organization_identity
  on organization_identity.source = 'salesforce'
 and organization_identity.entity_kind = 'organization'
 and organization_identity.organization_id = organization.id
where active_run.dataset_key = 'funnel'
  and scope_identity.source = 'salesforce'
  and scope_identity.entity_kind = 'reporting_scope'
  and scope_identity.external_id = 'scope-global';

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select is(
  (
    select jsonb_array_length(response #> '{options,organizations}')::text
      || ':' || (response #>> '{options,organizations,0,label}')
      || ':' || (response #>> '{options,organizations,99,label}')
    from (
      select public.get_crm_read_model_v3(
        'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
      ) response
    ) result
  ),
  '100:V3 Cap Organization 001:V3 Cap Organization 100',
  'organization filter options are deterministically sorted and capped at 100'
);
select is(
  public.get_crm_read_model_v3(
    'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
  ) -> 'truncatedOptions',
  '["organizations"]'::jsonb,
  'response explicitly reports each truncated option dimension in sorted order'
);
select is(
  (
    select response #>> '{source,qualityStatus}' || ':'
      || (
        (response #> '{source,qualityIssues}')
        @> '["filter_options_truncated"]'::jsonb
      )::text
    from (
      select public.get_crm_read_model_v3(
        'funnel', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
      ) response
    ) result
  ),
  'warning:true',
  'option truncation is also exposed as an explicit source-quality warning'
);
select is(
  (
    select jsonb_build_array(
      jsonb_array_length(response #> '{options,organizations}'),
      response #>> '{options,organizations,0,id}',
      exists (
        select 1
        from jsonb_array_elements(response #> '{options,organizations}') option
        where option ->> 'id' = '8d000000-0000-4000-8000-000000000065'
      ),
      response -> 'truncatedOptions'
    )
    from (
      select public.get_crm_read_model_v3(
        'funnel',
        '00000000-0000-4000-8000-000000000001',
        '{"organizationIds":["8d000000-0000-4000-8000-000000000065"]}'::jsonb
      ) response
    ) result
  ),
  '[100,"8d000000-0000-4000-8000-000000000065",true,["organizations"]]'::jsonb,
  'selected 101st option survives the cap and is ordered before label and UUID'
);
reset role;

insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
) values (
  '81000000-0000-4000-8000-000000000002',
  'crm.partnerships.view',
  'allow',
  'V3 Qlik active-organization contract test',
  '81000000-0000-4000-8000-000000000001'
);
insert into public.crm_source_identities (
  source, entity_kind, external_id, organization_id,
  mapping_status, mapping_owner_id, valid_from, verified_at, verified_by,
  evidence_reference
) values (
  'qlik', 'organization', 'v3-qlik-org-a',
  '82000000-0000-4000-8000-000000000001',
  'verified', '87000000-0000-4000-8000-000000000001',
  '2026-01-01', now(), '81000000-0000-4000-8000-000000000001',
  'qa://v3/qlik-org-a'
);
insert into public.crm_imob_ranking_runs (
  id, status, reference_year, generated_at, source_updated_at,
  row_count, completed_at
) values (
  '8e000000-0000-4000-8000-000000000001', 'succeeded', 2026,
  '2026-08-09T18:31:00Z', '2026-08-09T18:30:00Z', 1,
  '2026-08-09T18:31:01Z'
);
insert into public.crm_imob_ranking_entries (
  run_id, period_month, imob_key, imob_name, vgv, contracts,
  source_rank_vgv, source_rank_contracts
) values (
  '8e000000-0000-4000-8000-000000000001', '2026-08-01',
  'v3-qlik-org-a', 'V3 Qlik Organization A', 100.00, 1, 1, 1
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true
);
set local role authenticated;
select is(
  (select count(*) from public.list_scoped_crm_imob_ranking_entries(10, 0)),
  1::bigint,
  'legacy scoped Qlik read returns a verified mapping to an active organization'
);
reset role;
update public.crm_organizations
set is_active = false
where id = '82000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(
  (select count(*) from public.list_scoped_crm_imob_ranking_entries(10, 0)),
  0::bigint,
  'legacy scoped Qlik read denies mappings whose canonical organization is inactive'
);
reset role;
update public.crm_organizations
set is_active = true
where id = '82000000-0000-4000-8000-000000000001';

update public.crm_people
set is_active = false
where id = '84000000-0000-4000-8000-000000000001';
update public.crm_organizations
set is_active = false
where id = '82000000-0000-4000-8000-000000000001';
update public.crm_teams
set is_active = false
where id = '83000000-0000-4000-8000-000000000001';
update public.crm_portfolios
set is_active = false
where id = '85000000-0000-4000-8000-000000000001';
update public.crm_reporting_scopes
set is_active = false
where id = '86000000-0000-4000-8000-000000000004';
update public.crm_origins
set is_active = false
where id = '88000000-0000-4000-8000-000000000001';
update public.crm_developments
set is_active = false
where id = '89000000-0000-4000-8000-000000000001';
update public.crm_locations
set is_active = false
where id = '8a000000-0000-4000-8000-000000000001';

select is(
  (
    select count(identity.id)
    from (values
      ('person', 'coordinator-a'),
      ('organization', 'org-a'),
      ('team', 'team-a'),
      ('portfolio', 'portfolio-a'),
      ('reporting_scope', 'scope-person-a'),
      ('origin', 'origin-a'),
      ('development', 'development-a'),
      ('location', 'location-a')
    ) candidate(entity_kind, external_id)
    cross join lateral private.resolve_verified_source_identity(
      'salesforce', candidate.entity_kind, candidate.external_id,
      '2026-08-09T12:00:00Z'::timestamptz
    ) identity
  ),
  0::bigint,
  'resolver denies inactive canonical targets for every supported entity kind'
);
select is(
  (
    select count(*)
    from public.crm_source_identities identity
    where identity.source = 'salesforce'
      and (identity.entity_kind, identity.external_id) in (
        ('person', 'coordinator-a'),
        ('organization', 'org-a'),
        ('team', 'team-a'),
        ('portfolio', 'portfolio-a'),
        ('reporting_scope', 'scope-person-a'),
        ('origin', 'origin-a'),
        ('development', 'development-a'),
        ('location', 'location-a')
      )
      and identity.mapping_status = 'verified'
      and identity.valid_until is null
      and identity.mapping_owner_id = '87000000-0000-4000-8000-000000000001'
  ),
  8::bigint,
  'canonical deactivation does not rewrite valid mapping ownership or history'
);

insert into v3_test_payloads (payload_key, payload)
select
  'funnel-inactive-targets',
  jsonb_set(
    jsonb_set(
      jsonb_set(payload, '{requestId}', '"8b000000-0000-4000-8000-00000000000e"'),
      '{sourceSnapshotId}', '"v3-funnel-inactive-targets"'
    ),
    '{generatedAt}', '"2026-08-09T18:34:00Z"'
  )
from v3_test_payloads where payload_key = 'funnel-ready';
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-inactive-targets')
    )$$,
  'inactive canonical targets quarantine the whole batch without partial facts'
);
select is(
  (
    select rejected.publication_status || ':' || rejected.rejection_reason || ':'
      || rejected.record_count || ':' || active_snapshot.source_snapshot_id
    from public.crm_read_model_v3_runs rejected
    cross join public.crm_read_model_v3_active_runs active_run
    join public.crm_read_model_v3_runs active_snapshot on active_snapshot.id = active_run.run_id
    where rejected.request_id = '8b000000-0000-4000-8000-00000000000e'
      and active_run.dataset_key = 'funnel'
  ),
  'rejected:unresolved_mappings:0:v3-funnel-performance-10000',
  'inactive-target rejection preserves the last valid active snapshot'
);

update public.crm_people
set is_active = true
where id = '84000000-0000-4000-8000-000000000001';
update public.crm_organizations
set is_active = true
where id = '82000000-0000-4000-8000-000000000001';
update public.crm_teams
set is_active = true
where id = '83000000-0000-4000-8000-000000000001';
update public.crm_portfolios
set is_active = true
where id = '85000000-0000-4000-8000-000000000001';
update public.crm_reporting_scopes
set is_active = true
where id = '86000000-0000-4000-8000-000000000004';
update public.crm_origins
set is_active = true
where id = '88000000-0000-4000-8000-000000000001';
update public.crm_developments
set is_active = true
where id = '89000000-0000-4000-8000-000000000001';
update public.crm_locations
set is_active = true
where id = '8a000000-0000-4000-8000-000000000001';

update private.crm_integration_owners
set is_active = false, updated_at = now()
where id = '87000000-0000-4000-8000-000000000001';
insert into v3_test_payloads (payload_key, payload)
select
  'funnel-owner-inactive',
  jsonb_set(
    jsonb_set(
      jsonb_set(payload, '{requestId}', '"8b000000-0000-4000-8000-00000000000d"'),
      '{sourceSnapshotId}', '"v3-funnel-owner-inactive"'
    ),
    '{generatedAt}', '"2026-08-09T18:35:00Z"'
  )
from v3_test_payloads where payload_key = 'funnel-unmapped';
select lives_ok(
  $$select public.ingest_crm_read_model_v3(
      (select payload from v3_test_payloads where payload_key = 'funnel-owner-inactive')
    )$$,
  'inactive mapping ownership quarantines a new snapshot instead of trusting stale mappings'
);
select is(
  (select status || ':' || (resolved_at is null)::text || ':'
      || (source_identity_id is null)::text
   from private.crm_identity_reconciliation_items
   where source = 'salesforce' and entity_kind = 'person'
     and external_id = 'unknown-broker'),
  'pending:true:true',
  'a recurring unresolved identity reopens a previously decided queue item'
);

select set_config('request.jwt.claim.sub', '', true);
update public.profiles
set is_active = false, access_status = 'suspended'
where user_id = '81000000-0000-4000-8000-000000000001';
select is(
  (select private.reporting_scope_grant_lineage_is_effective(grant_row.id, now())
   from public.crm_user_reporting_scope_grants grant_row
   where grant_row.user_id = '81000000-0000-4000-8000-000000000002'),
  false,
  'suspending a delegating ancestor makes descendant v3 lineage ineffective'
);

select * from finish();
rollback;
