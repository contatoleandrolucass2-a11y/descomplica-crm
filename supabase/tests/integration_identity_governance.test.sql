begin;

select plan(20);

select is(
  (
    select count(*)
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.crm_source_identities'::regclass
      and constraint_row.confrelid in (
        'public.crm_people'::regclass,
        'public.crm_organizations'::regclass
      )
      and constraint_row.contype = 'f'
      and constraint_row.confdeltype = 'r'
  ),
  2::bigint,
  'legacy person and organization mappings reject target deletion'
);

select ok(
  not exists (
    select 1
    from public.crm_source_identities identity
    where not exists (
      select 1
      from private.crm_source_identity_history history
      where history.source_identity_id = identity.id
    )
  ),
  'every preexisting source identity has migration or trigger history'
);

select ok(
  not exists (
    select 1
    from private.crm_reporting_scope_grant_lineage lineage
    join public.crm_user_reporting_scope_grants grant_row
      on grant_row.id = lineage.grant_id
    join public.crm_reporting_scopes scope
      on scope.id = grant_row.reporting_scope_id
    left join public.user_roles user_role
      on user_role.user_id = grant_row.user_id
    where lineage.grant_origin = 'bootstrap'
      and (
        user_role.role_key is distinct from 'master'
        or scope.scope_type is distinct from 'global'
        or grant_row.user_id is distinct from grant_row.granted_by
        or grant_row.reason is distinct from 'Master bootstrap global scope'
        or lineage.requires_reconciliation
      )
  ),
  'only an evidenced Master self-grant can become trusted bootstrap lineage'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.review_crm_source_identity_mapping(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.review_crm_source_identity_mapping(jsonb)', 'EXECUTE'
  ),
  'direct mapping mutation is closed to Data API sessions'
);

-- The final migration keeps this function as an owner-only primitive. This
-- transactional grant exercises its lower-level governance contract in
-- isolation; production callers use the authority-gated batch wrapper.
grant execute on function public.review_crm_source_identity_mapping(jsonb)
to authenticated;

insert into auth.users (id, email)
values
  ('91000000-0000-4000-8000-000000000001', 'governance-master@example.test'),
  ('91000000-0000-4000-8000-000000000002', 'governance-admin@example.test');

select public.bootstrap_master_user('91000000-0000-4000-8000-000000000001');

insert into public.crm_organizations (
  id, organization_key, name, kind
)
values (
  '93000000-0000-4000-8000-000000000001',
  'governance-org',
  'Governance organization',
  'house'
);

insert into public.crm_reporting_scopes (
  id, scope_key, scope_type, organization_id
)
values (
  '93000000-0000-4000-8000-000000000002',
  'governance-org-scope',
  'organization',
  '93000000-0000-4000-8000-000000000001'
);

update public.user_roles
set role_key = 'admin',
    assigned_by = '91000000-0000-4000-8000-000000000001'
where user_id = '91000000-0000-4000-8000-000000000002';

insert into public.crm_user_reporting_scope_grants (
  user_id, reporting_scope_id, granted_by, reason, valid_from
)
values (
  '91000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001',
  'Governance Admin organization scope',
  now()
);

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = '91000000-0000-4000-8000-000000000001'
where user_id = '91000000-0000-4000-8000-000000000002';

insert into auth.users (id, email)
values (
  '91000000-0000-4000-8000-000000000003',
  'governance-broker@example.test'
);

insert into public.crm_teams (id, organization_id, team_key, name)
values (
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000001',
  'governance-team',
  'Governance team'
);

insert into public.crm_people (id, person_key, display_name, auth_user_id)
values (
  '93000000-0000-4000-8000-000000000004',
  'governance-broker',
  'Governance broker',
  '91000000-0000-4000-8000-000000000003'
);

insert into public.crm_team_memberships (
  team_id, person_id, membership_role, valid_from, valid_until
)
values (
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000004',
  'broker',
  now() - interval '1 minute',
  now() + interval '1 day'
);

insert into public.crm_reporting_scopes (
  id, scope_key, scope_type, person_id
)
values (
  '93000000-0000-4000-8000-000000000005',
  'governance-broker-scope',
  'person',
  '93000000-0000-4000-8000-000000000004'
);

update public.user_roles
set role_key = 'broker',
    assigned_by = '91000000-0000-4000-8000-000000000001'
where user_id = '91000000-0000-4000-8000-000000000003';

insert into public.crm_user_reporting_scope_grants (
  user_id, reporting_scope_id, granted_by, reason, valid_from
)
values (
  '91000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000002',
  'Governance Broker delegated person scope',
  now()
);

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = '91000000-0000-4000-8000-000000000001'
where user_id = '91000000-0000-4000-8000-000000000003';

select is(
  (
    select jsonb_build_array(
      lineage.depth,
      parent_grant.user_id,
      private.reporting_scope_grant_lineage_is_effective(grant_row.id, now())
    )
    from public.crm_user_reporting_scope_grants grant_row
    join private.crm_reporting_scope_grant_lineage lineage
      on lineage.grant_id = grant_row.id
    join public.crm_user_reporting_scope_grants parent_grant
      on parent_grant.id = lineage.parent_grant_id
    where grant_row.user_id = '91000000-0000-4000-8000-000000000003'
  ),
  '[2,"91000000-0000-4000-8000-000000000002",true]'::jsonb,
  'delegated lineage is effective while every temporal scope edge contains its child'
);

select is(
  (
    select private.reporting_scope_grant_lineage_is_effective(
      grant_row.id,
      now() + interval '2 days'
    )
    from public.crm_user_reporting_scope_grants grant_row
    where grant_row.user_id = '91000000-0000-4000-8000-000000000003'
  ),
  false,
  'expired team membership invalidates the delegated organization-to-person edge'
);

insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind
)
values (
  '92000000-0000-4000-8000-000000000001',
  'governance-mapping-owner',
  'Governance mapping owner',
  'team'
);

insert into public.crm_source_identities (
  source, entity_kind, external_id, organization_id,
  mapping_status, valid_from
)
values (
  'governance', 'organization', 'historied-org',
  '93000000-0000-4000-8000-000000000001', 'pending', now()
);

select is(
  (
    select count(*)
    from private.crm_source_identity_history history
    join public.crm_source_identities identity
      on identity.id = history.source_identity_id
    where identity.source = 'governance'
      and identity.entity_kind = 'organization'
      and identity.external_id = 'historied-org'
      and history.event_type = 'created'
  ),
  1::bigint,
  'new source identity receives immutable creation history'
);

select throws_ok(
  $$delete from public.crm_source_identities
    where source = 'governance'
      and entity_kind = 'organization'
      and external_id = 'historied-org'$$,
  '23503',
  null,
  'history prevents hard deletion of a mapped identity'
);

select throws_ok(
  $$delete from public.crm_organizations
    where id = '93000000-0000-4000-8000-000000000001'$$,
  '23503',
  null,
  'canonical target cannot cascade-delete mapping evidence'
);

select throws_ok(
  $$insert into public.crm_source_identities (
      source, entity_kind, external_id, organization_id,
      mapping_status, valid_from
    ) values (
      'governance', 'organization', 'infinite-window',
      '93000000-0000-4000-8000-000000000001', 'pending', '-infinity'
    )$$,
  '23514',
  null,
  'mapping windows reject non-finite timestamps at storage'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true
);
set local role authenticated;
select throws_ok(
  $$select public.review_crm_source_identity_mapping(jsonb_build_object(
      'requestId', '94000000-0000-4000-8000-000000000001',
      'source', 'governance',
      'entityKind', 'organization',
      'externalId', 'admin-denied',
      'ownerKey', 'governance-mapping-owner',
      'targetId', '93000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', '2026-08-01T00:00:00Z',
      'evidenceReference', 'qa://governance/admin-denied',
      'reason', 'official_identity_evidence_verified'
    ))$$,
  '42501',
  'forbidden: mapping review is not permitted',
  'approved Admin cannot review a mapping'
);
reset role;

select is(
  (
    select count(*)
    from private.crm_mapping_commands
    where request_id = '94000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'denied Admin review leaves no idempotency command'
);

select set_config('request.jwt.claim.sub', '', true);
update public.profiles
set is_active = false,
    access_status = 'suspended'
where user_id = '91000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select throws_ok(
  $$select public.review_crm_source_identity_mapping(jsonb_build_object(
      'requestId', '94000000-0000-4000-8000-000000000002',
      'source', 'governance',
      'entityKind', 'organization',
      'externalId', 'suspended-denied',
      'ownerKey', 'governance-mapping-owner',
      'targetId', '93000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', '2026-08-01T00:00:00Z',
      'evidenceReference', 'qa://governance/suspended-denied',
      'reason', 'official_identity_evidence_verified'
    ))$$,
  '42501',
  'forbidden: mapping review is not permitted',
  'suspended Master cannot review a mapping'
);
reset role;

select is(
  (
    select count(*)
    from private.crm_mapping_commands
    where request_id = '94000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'suspended review leaves mapping state unchanged'
);

select set_config('request.jwt.claim.sub', '', true);
update public.profiles
set is_active = true,
    access_status = 'approved'
where user_id = '91000000-0000-4000-8000-000000000001';

insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
)
values (
  '91000000-0000-4000-8000-000000000001',
  'crm.ingest.manage',
  'deny',
  'Prove fail-closed mapping review without permission',
  '91000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select throws_ok(
  $$select public.review_crm_source_identity_mapping(jsonb_build_object(
      'requestId', '94000000-0000-4000-8000-000000000003',
      'source', 'governance',
      'entityKind', 'organization',
      'externalId', 'permission-denied',
      'ownerKey', 'governance-mapping-owner',
      'targetId', '93000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', '2026-08-01T00:00:00Z',
      'evidenceReference', 'qa://governance/permission-denied',
      'reason', 'official_identity_evidence_verified'
    ))$$,
  '42501',
  'forbidden: mapping review is not permitted',
  'Master with an explicit permission deny cannot review a mapping'
);
reset role;

select is(
  (
    select count(*)
    from private.crm_mapping_commands
    where request_id = '94000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'permission denial leaves mapping state unchanged'
);

select set_config('request.jwt.claim.sub', '', true);
delete from public.user_permission_overrides
where user_id = '91000000-0000-4000-8000-000000000001'
  and permission_key = 'crm.ingest.manage';

select set_config(
  'request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select throws_ok(
  $$select public.review_crm_source_identity_mapping(jsonb_build_object(
      'requestId', '94000000-0000-4000-8000-000000000004',
      'source', 'governance',
      'entityKind', 'organization',
      'externalId', 'infinite-effective-from',
      'ownerKey', 'governance-mapping-owner',
      'targetId', '93000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', '-infinity',
      'evidenceReference', 'qa://governance/infinite-effective-from',
      'reason', 'official_identity_evidence_verified'
    ))$$,
  '22023',
  'invalid_argument: invalid mapping review identifiers',
  'mapping review rejects non-finite effectiveFrom before casting'
);

select throws_ok(
  $$select public.review_crm_source_identity_mapping(jsonb_build_object(
      'requestId', '94000000-0000-4000-8000-000000000005',
      'source', 'governance',
      'entityKind', 'organization',
      'externalId', 'non-iso-effective-from',
      'ownerKey', 'governance-mapping-owner',
      'targetId', '93000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', '2026-08-01',
      'evidenceReference', 'qa://governance/non-iso-effective-from',
      'reason', 'official_identity_evidence_verified'
    ))$$,
  '22023',
  'invalid_argument: invalid mapping review identifiers',
  'mapping review rejects non-ISO effectiveFrom literals'
);
reset role;

select is(
  (
    select count(*)
    from private.crm_mapping_commands
    where request_id in (
      '94000000-0000-4000-8000-000000000004',
      '94000000-0000-4000-8000-000000000005'
    )
  ),
  0::bigint,
  'invalid temporal reviews do not create commands'
);

select ok(
  not exists (
    select 1
    from public.crm_source_identities
    where source = 'governance'
      and external_id in (
        'admin-denied',
        'suspended-denied',
        'permission-denied',
        'infinite-effective-from',
        'non-iso-effective-from'
      )
  ),
  'all rejected reviewer paths leave identity state invariant'
);

select * from finish();
rollback;
