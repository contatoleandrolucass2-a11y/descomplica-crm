begin;

select plan(21);

select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  ),
  39::bigint,
  'all public tables retain RLS'
);

select is(
  (
    select array_agg(c.relname order by c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  ),
  array[
    'app_pages',
    'audit_logs',
    'crm_dashboard_metrics',
    'crm_dashboard_snapshots',
    'crm_dashboard_top_developments',
    'crm_dashboard_views',
    'crm_developments',
    'crm_funnel_goals',
    'crm_imob_ranking_developments',
    'crm_imob_ranking_entries',
    'crm_imob_ranking_runs',
    'crm_ingestion_runs',
    'crm_locations',
    'crm_organizations',
    'crm_origins',
    'crm_people',
    'crm_point_metrics',
    'crm_point_settings',
    'crm_portfolio_organizations',
    'crm_portfolios',
    'crm_ranking_participants',
    'crm_ranking_snapshots',
    'crm_read_model_v3_active_runs',
    'crm_read_model_v3_closed_months',
    'crm_read_model_v3_events',
    'crm_read_model_v3_runs',
    'crm_read_model_v3_scope_coverage',
    'crm_reporting_scopes',
    'crm_role_scope_types',
    'crm_source_identities',
    'crm_team_memberships',
    'crm_teams',
    'crm_user_reporting_scope_grants',
    'permissions',
    'profiles',
    'role_permissions',
    'roles',
    'user_permission_overrides',
    'user_roles'
  ]::name[],
  'the complete named public table allowlist retains RLS'
);

select is(
  (
    select array_agg(c.relname order by c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relforcerowsecurity
  ),
  array[
    'crm_developments',
    'crm_imob_ranking_developments',
    'crm_imob_ranking_entries',
    'crm_imob_ranking_runs',
    'crm_locations',
    'crm_organizations',
    'crm_origins',
    'crm_people',
    'crm_portfolio_organizations',
    'crm_portfolios',
    'crm_read_model_v3_active_runs',
    'crm_read_model_v3_closed_months',
    'crm_read_model_v3_events',
    'crm_read_model_v3_runs',
    'crm_read_model_v3_scope_coverage',
    'crm_reporting_scopes',
    'crm_role_scope_types',
    'crm_source_identities',
    'crm_team_memberships',
    'crm_teams',
    'crm_user_reporting_scope_grants'
  ]::name[],
  'new scoped and Qlik tables force RLS even for their owner'
);

select is(
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public'),
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname <> 'authenticated_session_mfa_gate'
  ) + (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  'existing policies plus one session/MFA gate per RLS table are preserved'
);

select is(
  (
    select array_agg(tablename || ':' || policyname order by tablename, policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname <> 'authenticated_session_mfa_gate'
  ),
  array[
    'app_pages:app_pages_select_authorized',
    'audit_logs:audit_logs_select_scoped',
    'crm_dashboard_metrics:crm_dashboard_metrics_select_authorized',
    'crm_dashboard_snapshots:crm_dashboard_snapshots_select_authorized',
    'crm_dashboard_top_developments:crm_dashboard_top_developments_select_authorized',
    'crm_dashboard_views:crm_dashboard_views_select_authorized',
    'crm_funnel_goals:crm_funnel_goals_select_authorized',
    'crm_organizations:crm_organizations_select_scoped',
    'crm_people:crm_people_select_scoped',
    'crm_point_metrics:crm_point_metrics_select_authorized',
    'crm_point_settings:crm_point_settings_select_authorized',
    'crm_portfolio_organizations:crm_portfolio_organizations_select_scoped',
    'crm_portfolios:crm_portfolios_select_scoped',
    'crm_ranking_participants:crm_ranking_participants_select_authorized',
    'crm_ranking_snapshots:crm_ranking_snapshots_select_authorized',
    'crm_reporting_scopes:crm_reporting_scopes_select_scoped',
    'crm_team_memberships:crm_team_memberships_select_scoped',
    'crm_teams:crm_teams_select_scoped',
    'crm_user_reporting_scope_grants:crm_user_reporting_scope_grants_select_self_or_scoped_manager',
    'permissions:permissions_select_authenticated',
    'profiles:profiles_select_self_or_scoped_manager',
    'role_permissions:role_permissions_select_authenticated',
    'roles:roles_select_authenticated',
    'user_permission_overrides:user_permission_overrides_select_self_or_scoped_manager',
    'user_roles:user_roles_select_self_or_scoped_manager'
  ]::text[],
  'the complete named policy allowlist is preserved'
);

select is(
  (
    select array_agg(tablename order by tablename)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = 'authenticated_session_mfa_gate'
      and permissive = 'RESTRICTIVE'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  (
    select array_agg(relation.relname order by relation.relname)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  'every public RLS table requires the restrictive session/MFA gate'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) acl
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and acl.grantee = 0
  ),
  'PUBLIC has no privileges on public tables'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (
      values
        ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privilege(name)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege('anon', c.oid, privilege.name)
  ),
  'anon has no privileges on public tables'
);

select is(
  (
    select array_agg(table_name || ':' || privilege_type order by table_name, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
  ),
  array[
    'app_pages:SELECT',
    'audit_logs:SELECT',
    'crm_dashboard_metrics:SELECT',
    'crm_dashboard_snapshots:SELECT',
    'crm_dashboard_top_developments:SELECT',
    'crm_dashboard_views:SELECT',
    'crm_funnel_goals:SELECT',
    'crm_organizations:SELECT',
    'crm_people:SELECT',
    'crm_point_metrics:SELECT',
    'crm_point_settings:SELECT',
    'crm_portfolio_organizations:SELECT',
    'crm_portfolios:SELECT',
    'crm_ranking_participants:SELECT',
    'crm_ranking_snapshots:SELECT',
    'crm_reporting_scopes:SELECT',
    'crm_team_memberships:SELECT',
    'crm_teams:SELECT',
    'crm_user_reporting_scope_grants:SELECT',
    'profiles:SELECT',
    'user_permission_overrides:SELECT',
    'user_roles:SELECT'
  ]::text[],
  'authenticated receives SELECT only on directly queried tables'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (
      values
        ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
        ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privilege(name)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, privilege.name)
  ),
  'authenticated has no write or maintenance table privileges'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'service_role'
  ),
  'service_role has no direct public table privileges'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) role(name)
    cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) privilege(name)
    where n.nspname = 'public'
      and c.relkind = 'S'
      and has_sequence_privilege(role.name, c.oid, privilege.name)
  ),
  'Data API roles have no direct public sequence privileges'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute public functions'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot execute public functions'
);

select is(
  (
    select array_agg(p.proname order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  array[
    'apply_crm_commercial_policy_import',
    'apply_crm_source_identity_mapping_import',
    'approve_user_access',
    'assign_user_role',
    'begin_crm_salesforce_refresh',
    'current_session_is_live',
    'finish_crm_salesforce_refresh',
    'get_crm_commercial_configuration_draft',
    'get_crm_read_model_v3',
    'get_crm_sync_status',
    'get_qlik_relay_health',
    'get_role_level',
    'get_user_authorization_context',
    'has_permission',
    'list_app_pages_for_management',
    'list_crm_read_model_v3_scopes',
    'list_scoped_crm_imob_ranking_entries',
    'preview_crm_commercial_configuration_draft',
    'preview_crm_commercial_policy_import',
    'preview_crm_source_identity_mapping_import',
    'remove_user_permission_override',
    'replace_crm_point_settings',
    'revoke_current_user_sessions_after_password_recovery',
    'save_crm_commercial_configuration_draft',
    'set_app_page_active',
    'set_crm_commercial_engine_gate',
    'set_user_active',
    'set_user_permission_override',
    'upsert_crm_funnel_goals'
  ]::name[],
  'authenticated can execute only the audited browser and RLS functions'
);

select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_schema_privilege('service_role', 'private', 'USAGE')
  and (
    select array_agg(
      p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      order by p.proname, pg_get_function_identity_arguments(p.oid)
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) = array[
    'can_delegate_reporting_scope(p_scope_id uuid)',
    'can_manage_user(p_target_user_id uuid)',
    'can_read_organization(p_organization_id uuid)',
    'can_read_person(p_person_id uuid)',
    'can_read_portfolio(p_portfolio_id uuid)',
    'can_read_reporting_scope(p_scope_id uuid)',
    'can_read_team(p_team_id uuid)',
    'current_session_satisfies_mfa()',
    'current_user_is_master()'
  ]::text[]
  and not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ),
  'private RLS helpers expose only the exact authenticated boolean surface'
);

select is(
  (
    select array_agg(p.proname order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  array[
    'ingest_crm_imob_ranking_snapshot',
    'ingest_crm_read_model_v3',
    'ingest_crm_salesforce_snapshot'
  ]::name[],
  'service_role can execute only the audited server-side ingestion RPCs'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or (
    not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')
  ),
  'rls_auto_enable is not executable by Data API roles when installed'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or exists (
    select 1
    from pg_catalog.pg_event_trigger e
    where e.evtname = 'ensure_rls'
      and e.evtfoid = to_regprocedure('public.rls_auto_enable()')
      and e.evtenabled <> 'D'
  ),
  'ensure_rls remains attached and enabled when rls_auto_enable is installed'
);

select ok(
  has_function_privilege('postgres', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.bootstrap_master_user(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.bootstrap_master_user(uuid)', 'EXECUTE'),
  'bootstrap_master_user is restricted to the documented postgres administrator path'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) acl
    where pg_catalog.pg_get_userbyid(d.defaclrole) = 'postgres'
      and n.nspname = 'public'
      and (
        acl.grantee = 0
        or pg_catalog.pg_get_userbyid(acl.grantee) in (
          'anon',
          'authenticated',
          'service_role'
        )
      )
  ),
  'postgres default privileges keep future public objects fail-closed'
);

select * from finish();

rollback;
