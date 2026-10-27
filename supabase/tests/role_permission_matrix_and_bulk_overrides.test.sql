begin;

select plan(180);

select has_column(
  'public',
  'roles',
  'is_assignable',
  'roles expose whether the role remains assignable'
);

select is(
  (
    select string_agg(key, ',' order by level desc)
    from public.roles
    where is_assignable
  ),
  'admin,coordinator,manager_house,manager_imob,broker_house,broker_imob',
  'only the approved non-Master roles remain assignable'
);

select is(
  (
    select string_agg(key, ',' order by level desc)
    from public.roles
    where not is_assignable
  ),
  'master,manager,supervisor,house,real_estate,partnership_channel,broker_lead,broker,user,pending',
  'Master, pending and every retired legacy role are not assignable'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key in (
      'manager',
      'supervisor',
      'house',
      'real_estate',
      'partnership_channel',
      'broker_lead',
      'broker',
      'user',
      'pending'
    )
  ),
  0::bigint,
  'retired and pending roles inherit no permissions'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'pages.view',
      'crm.dashboard.view',
      'crm.dashboard.all.view',
      'crm.dashboard.with_canal_imob.view',
      'crm.dashboard.without_canal_imob.view',
      'crm.stages.view',
      'crm.ranking.view',
      'crm.partnerships.view',
      'permissions.manage',
      'roles.manage',
      'users.manage',
      'pages.manage',
      'crm.settings.manage'
    ]) required(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.role_key = 'master'
        and role_permission.permission_key = required.permission_key
    )
  ),
  'Master inherits every relevant operational and administrative permission'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'pages.view',
      'crm.dashboard.view',
      'crm.dashboard.all.view',
      'crm.dashboard.with_canal_imob.view',
      'crm.dashboard.without_canal_imob.view',
      'crm.stages.view',
      'crm.ranking.view',
      'crm.partnerships.view',
      'permissions.manage',
      'roles.manage',
      'users.manage',
      'pages.manage',
      'crm.settings.manage'
    ]) required(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.role_key = 'admin'
        and role_permission.permission_key = required.permission_key
    )
  ),
  'Administrator inherits all relevant operations and access management'
);

select is(
  (select count(*) from public.role_permissions where role_key = 'admin'),
  82::bigint,
  'Administrator inherits all eighty-two current catalog permissions'
);
select is(
  (select array_agg(permission_key order by permission_key) from public.role_permissions where role_key = 'admin'),
  (select array_agg(key order by key) from public.permissions),
  'Administrator defaults match the complete catalog with no missing permission'
);
select is(
  (select level from public.roles where key = 'admin'),
  80,
  'complete Administrator defaults do not promote its hierarchy level'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'coordinator'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.management.forecast.values.edit,crm.management.forecast.view,crm.management.routine.view,crm.management.view,crm.partnerships.view,crm.simulators.execute,crm.simulators.view,crm.stage.appointments.view,crm.stage.folders.view,crm.stage.opportunities.view,crm.stage.sales.view,crm.stage.visits.view,crm.stages.view,crm.useful_links.app_bora_vender.view,crm.useful_links.campanha_do_mes.view,crm.useful_links.grupos_whatsapp.view,crm.useful_links.linktree_liveprint.view,crm.useful_links.lojas_horarios.view,crm.useful_links.regras_comerciais.view,crm.useful_links.relacionamento.view,crm.useful_links.view,pages.view',
  'Coordinator inherits Imob, partnerships, simulators, and common operational pages'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'manager_house'
  ),
  'crm.dashboard.view,crm.dashboard.without_canal_imob.view,crm.management.forecast.values.edit,crm.management.forecast.view,crm.management.routine.view,crm.management.view,crm.ranking.view,crm.simulators.execute,crm.simulators.view,crm.stage.appointments.view,crm.stage.folders.view,crm.stage.opportunities.view,crm.stage.sales.view,crm.stage.visits.view,crm.stages.view,crm.useful_links.app_bora_vender.view,crm.useful_links.campanha_do_mes.view,crm.useful_links.grupos_whatsapp.view,crm.useful_links.linktree_liveprint.view,crm.useful_links.lojas_horarios.view,crm.useful_links.regras_comerciais.view,crm.useful_links.relacionamento.view,crm.useful_links.view,pages.view',
  'Gerente House inherits House, ranking, and simulators'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'manager_imob'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.management.forecast.values.edit,crm.management.forecast.view,crm.management.routine.view,crm.management.view,crm.partnerships.view,crm.simulators.execute,crm.simulators.view,crm.stage.appointments.view,crm.stage.folders.view,crm.stage.opportunities.view,crm.stage.sales.view,crm.stage.visits.view,crm.stages.view,crm.useful_links.app_bora_vender.view,crm.useful_links.campanha_do_mes.view,crm.useful_links.grupos_whatsapp.view,crm.useful_links.linktree_liveprint.view,crm.useful_links.lojas_horarios.view,crm.useful_links.regras_comerciais.view,crm.useful_links.relacionamento.view,crm.useful_links.view,pages.view',
  'Gerente Imob inherits Imob, partnerships, and simulators'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'broker_house'
  ),
  'crm.dashboard.view,crm.dashboard.without_canal_imob.view,crm.management.forecast.values.edit,crm.management.forecast.view,crm.management.routine.view,crm.management.view,crm.ranking.view,crm.simulators.execute,crm.simulators.view,crm.stage.appointments.view,crm.stage.folders.view,crm.stage.opportunities.view,crm.stage.sales.view,crm.stage.visits.view,crm.stages.view,crm.useful_links.app_bora_vender.view,crm.useful_links.campanha_do_mes.view,crm.useful_links.grupos_whatsapp.view,crm.useful_links.linktree_liveprint.view,crm.useful_links.lojas_horarios.view,crm.useful_links.regras_comerciais.view,crm.useful_links.relacionamento.view,crm.useful_links.view,pages.view',
  'Corretor House inherits House, ranking, and simulators'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'broker_imob'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.management.forecast.values.edit,crm.management.forecast.view,crm.management.routine.view,crm.management.view,crm.partnerships.view,crm.simulators.execute,crm.simulators.view,crm.stage.appointments.view,crm.stage.folders.view,crm.stage.opportunities.view,crm.stage.sales.view,crm.stage.visits.view,crm.stages.view,crm.useful_links.app_bora_vender.view,crm.useful_links.campanha_do_mes.view,crm.useful_links.grupos_whatsapp.view,crm.useful_links.linktree_liveprint.view,crm.useful_links.lojas_horarios.view,crm.useful_links.regras_comerciais.view,crm.useful_links.relacionamento.view,crm.useful_links.view,pages.view',
  'Corretor Imob inherits Imob, partnerships, and simulators'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key in (
      'coordinator',
      'manager_house',
      'manager_imob',
      'broker_house',
      'broker_imob'
    )
      and permission_key in (
        'users.manage',
        'permissions.manage',
        'roles.manage',
        'pages.manage',
        'crm.settings.manage',
        'crm.dashboard.all.view'
      )
  ),
  0::bigint,
  'operational roles cannot manage users, permissions, pages, goals or the General view'
);

select has_function(
  'public',
  'set_user_permission_overrides_bulk',
  array['uuid', 'text[]', 'text', 'text'],
  'atomic bulk permission override RPC exists'
);

with function_definition as (
  select pg_get_functiondef(
    'public.set_user_permission_overrides_bulk(uuid,text[],text,text)'::regprocedure
  ) as definition
)
select ok(
  regexp_count(
    definition,
    'execute ''select private\.can_manage_user\(\$1\)'''
  ) = 2
  and strpos(
    split_part(
      definition,
      E'where profile.user_id = target_user_id\n  for update;',
      2
    ),
    'execute ''select private.can_manage_user($1)'''
  ) > 0,
  'bulk RPC revalidates optional scope enforcement after locking the target profile'
)
from function_definition;

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_user_permission_overrides_bulk(uuid,text[],text,text)',
    'execute'
  ),
  'authenticated can invoke the guarded bulk RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_user_permission_overrides_bulk(uuid,text[],text,text)',
    'execute'
  ),
  'anon cannot invoke the bulk RPC'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.set_user_permission_overrides_bulk(uuid,text[],text,text)',
    'execute'
  ),
  'service_role cannot bypass the authenticated bulk RPC contract'
);

select has_function(
  'public',
  'apply_user_permission_access_draft',
  array['uuid', 'text[]', 'text[]', 'text[]', 'text'],
  'atomic mixed permission access draft RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_user_permission_access_draft(uuid,text[],text[],text[],text)',
    'execute'
  ),
  'authenticated can invoke the guarded mixed access draft RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_user_permission_access_draft(uuid,text[],text[],text[],text)',
    'execute'
  ),
  'anon cannot invoke the mixed access draft RPC'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.apply_user_permission_access_draft(uuid,text[],text[],text[],text)',
    'execute'
  ),
  'service_role cannot bypass the mixed access draft contract'
);

select is(
  (
    select string_agg(
      concat_ws(
        '|',
        table_namespace.nspname,
        table_entry.relname,
        trigger_entry.tgname,
        function_namespace.nspname || '.' || function_entry.proname,
        trigger_entry.tgenabled
      ),
      ','
      order by table_entry.relname
    )
    from pg_catalog.pg_trigger trigger_entry
    join pg_catalog.pg_class table_entry
      on table_entry.oid = trigger_entry.tgrelid
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_entry.relnamespace
    join pg_catalog.pg_proc function_entry
      on function_entry.oid = trigger_entry.tgfoid
    join pg_catalog.pg_namespace function_namespace
      on function_namespace.oid = function_entry.pronamespace
    where trigger_entry.tgname like 'administrator_account_boundary_%'
      and not trigger_entry.tgisinternal
  ),
  'public|crm_user_reporting_scope_grants|administrator_account_boundary_reporting_scopes|'
    || 'private.enforce_administrator_account_boundary|O,'
    || 'public|profiles|administrator_account_boundary_profiles|'
    || 'private.enforce_administrator_account_boundary|O,'
    || 'public|user_permission_overrides|administrator_account_boundary_permission_overrides|'
    || 'private.enforce_administrator_account_boundary|O,'
    || 'public|user_roles|administrator_account_boundary_roles|'
    || 'private.enforce_administrator_account_boundary|O',
  'all four Administrator boundary triggers are present, enabled and bound to the private guard'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_roles owner_role
      on owner_role.oid = function_entry.proowner
    where function_entry.oid in (
      'public.can_assign_role(uuid,text)'::regprocedure,
      'private.current_actor_is_master_for_administrator_boundary()'::regprocedure,
      'private.enforce_administrator_account_boundary()'::regprocedure
    )
      and (
        not function_entry.prosecdef
        or owner_role.rolname <> 'postgres'
        or not ('search_path=""' = any(function_entry.proconfig))
      )
  ),
  'Administrator guards and Master predicate are postgres-owned SECURITY DEFINER functions with an empty search path'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    cross join lateral aclexplode(
      coalesce(
        function_entry.proacl,
        acldefault('f', function_entry.proowner)
      )
    ) privilege
    where function_entry.oid in (
      'public.can_assign_role(uuid,text)'::regprocedure,
      'private.current_actor_is_master_for_administrator_boundary()'::regprocedure,
      'private.enforce_administrator_account_boundary()'::regprocedure
    )
      and privilege.privilege_type = 'EXECUTE'
      and privilege.grantee in (
        0,
        (select oid from pg_catalog.pg_roles where rolname = 'anon'),
        (select oid from pg_catalog.pg_roles where rolname = 'authenticated'),
        (select oid from pg_catalog.pg_roles where rolname = 'service_role')
      )
  ),
  'Data API roles and PUBLIC cannot execute internal Administrator guards'
);

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) api_role(role_name)
    cross join unnest(array[
      'public.profiles',
      'public.user_roles',
      'public.user_permission_overrides',
      'public.crm_user_reporting_scope_grants'
    ]) guarded_table(table_name)
    where has_table_privilege(
      api_role.role_name,
      guarded_table.table_name,
      'INSERT,UPDATE,DELETE,TRUNCATE'
    )
  ),
  'Data API roles retain no direct write grant on the four guarded account tables'
);

insert into auth.users (id, email)
values
  ('a3000000-0000-4000-8000-000000000001', 'matrix-master@example.test'),
  ('a3000000-0000-4000-8000-000000000002', 'matrix-admin-a@example.test'),
  ('a3000000-0000-4000-8000-000000000003', 'matrix-admin-b@example.test'),
  ('a3000000-0000-4000-8000-000000000004', 'matrix-coordinator@example.test'),
  ('a3000000-0000-4000-8000-000000000005', 'matrix-manager-house@example.test'),
  ('a3000000-0000-4000-8000-000000000006', 'matrix-manager-imob@example.test'),
  ('a3000000-0000-4000-8000-000000000007', 'matrix-broker-house@example.test'),
  ('a3000000-0000-4000-8000-000000000008', 'matrix-broker-imob@example.test'),
  ('a3000000-0000-4000-8000-000000000009', 'matrix-out-of-scope@example.test'),
  ('a3000000-0000-4000-8000-000000000010', 'matrix-pending@example.test'),
  ('a3000000-0000-4000-8000-000000000011', 'matrix-lower-actor@example.test'),
  ('a3000000-0000-4000-8000-000000000012', 'matrix-brand-pending@example.test');

select public.bootstrap_master_user('a3000000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values
  (
    'b3000000-0000-4000-8000-000000000001',
    'matrix-org-a',
    'Synthetic Matrix Organization A',
    'house'
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'matrix-org-b',
    'Synthetic Matrix Organization B',
    'real_estate'
  );

insert into public.crm_teams (id, organization_id, team_key, name)
values
  (
    'c3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'matrix-team-a',
    'Synthetic Matrix Team A'
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000002',
    'matrix-team-b',
    'Synthetic Matrix Team B'
  );

insert into public.crm_people (id, person_key, display_name, auth_user_id)
values
  (
    'd3000000-0000-4000-8000-000000000001',
    'matrix-broker-house',
    'Synthetic Broker House',
    'a3000000-0000-4000-8000-000000000007'
  ),
  (
    'd3000000-0000-4000-8000-000000000002',
    'matrix-broker-imob',
    'Synthetic Broker Imob',
    'a3000000-0000-4000-8000-000000000008'
  ),
  (
    'd3000000-0000-4000-8000-000000000003',
    'matrix-out-of-scope',
    'Synthetic Out of Scope Broker',
    'a3000000-0000-4000-8000-000000000009'
  ),
  (
    'd3000000-0000-4000-8000-000000000004',
    'matrix-lower-actor',
    'Synthetic Lower Actor',
    'a3000000-0000-4000-8000-000000000011'
  ),
  (
    'd3000000-0000-4000-8000-000000000005',
    'matrix-pending',
    'Synthetic Pending User',
    'a3000000-0000-4000-8000-000000000010'
  );

insert into public.crm_team_memberships (id, team_id, person_id, membership_role)
values
  (
    'e3000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'broker'
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000002',
    'broker'
  ),
  (
    'e3000000-0000-4000-8000-000000000003',
    'c3000000-0000-4000-8000-000000000002',
    'd3000000-0000-4000-8000-000000000003',
    'broker'
  ),
  (
    'e3000000-0000-4000-8000-000000000004',
    'c3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000004',
    'broker'
  ),
  (
    'e3000000-0000-4000-8000-000000000005',
    'c3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000005',
    'broker'
  );

insert into public.crm_reporting_scopes (
  id,
  scope_key,
  scope_type,
  organization_id,
  team_id,
  person_id
)
values
  (
    'f3000000-0000-4000-8000-000000000001',
    'matrix-org-a',
    'organization',
    'b3000000-0000-4000-8000-000000000001',
    null,
    null
  ),
  (
    'f3000000-0000-4000-8000-000000000002',
    'matrix-team-a',
    'team',
    null,
    'c3000000-0000-4000-8000-000000000001',
    null
  ),
  (
    'f3000000-0000-4000-8000-000000000003',
    'matrix-team-b',
    'team',
    null,
    'c3000000-0000-4000-8000-000000000002',
    null
  ),
  (
    'f3000000-0000-4000-8000-000000000004',
    'matrix-broker-house',
    'person',
    null,
    null,
    'd3000000-0000-4000-8000-000000000001'
  ),
  (
    'f3000000-0000-4000-8000-000000000005',
    'matrix-broker-imob',
    'person',
    null,
    null,
    'd3000000-0000-4000-8000-000000000002'
  ),
  (
    'f3000000-0000-4000-8000-000000000006',
    'matrix-out-of-scope',
    'person',
    null,
    null,
    'd3000000-0000-4000-8000-000000000003'
  ),
  (
    'f3000000-0000-4000-8000-000000000007',
    'matrix-lower-actor',
    'person',
    null,
    null,
    'd3000000-0000-4000-8000-000000000004'
  ),
  (
    'f3000000-0000-4000-8000-000000000008',
    'matrix-org-b',
    'organization',
    'b3000000-0000-4000-8000-000000000002',
    null,
    null
  );

insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
values
  (
    'a3000000-0000-4000-8000-000000000002',
    'f3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Admin A scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000003',
    'f3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Admin B scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000004',
    'f3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Coordinator scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000005',
    'f3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Manager House scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000006',
    'f3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Manager Imob scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000007',
    'f3000000-0000-4000-8000-000000000004',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Broker House scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000008',
    'f3000000-0000-4000-8000-000000000005',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic Broker Imob scope'
  ),
  (
    'a3000000-0000-4000-8000-000000000009',
    'f3000000-0000-4000-8000-000000000006',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic out-of-scope grant'
  ),
  (
    'a3000000-0000-4000-8000-000000000011',
    'f3000000-0000-4000-8000-000000000007',
    'a3000000-0000-4000-8000-000000000001',
    'Synthetic lower actor scope'
  );

update public.user_roles
set role_key = case user_id
      when 'a3000000-0000-4000-8000-000000000002' then 'admin'
      when 'a3000000-0000-4000-8000-000000000003' then 'admin'
      when 'a3000000-0000-4000-8000-000000000004' then 'coordinator'
      when 'a3000000-0000-4000-8000-000000000005' then 'manager_house'
      when 'a3000000-0000-4000-8000-000000000006' then 'manager_imob'
      when 'a3000000-0000-4000-8000-000000000007' then 'broker_house'
      when 'a3000000-0000-4000-8000-000000000008' then 'broker_imob'
      when 'a3000000-0000-4000-8000-000000000009' then 'broker_house'
      when 'a3000000-0000-4000-8000-000000000011' then 'broker_house'
    end,
    assigned_by = 'a3000000-0000-4000-8000-000000000001'
where user_id in (
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000004',
  'a3000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000007',
  'a3000000-0000-4000-8000-000000000008',
  'a3000000-0000-4000-8000-000000000009',
  'a3000000-0000-4000-8000-000000000011'
);

insert into public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  reason,
  granted_by
)
values (
  'a3000000-0000-4000-8000-000000000003',
  'crm.dashboard.view',
  'deny',
  'Synthetic peer removal guard',
  'a3000000-0000-4000-8000-000000000001'
);

update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = now(),
    approved_by = 'a3000000-0000-4000-8000-000000000001'
where user_id in (
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000004',
  'a3000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000007',
  'a3000000-0000-4000-8000-000000000008',
  'a3000000-0000-4000-8000-000000000009',
  'a3000000-0000-4000-8000-000000000011'
);

-- Every current approved role inherits both sides of simulator access. These
-- fixtures have valid reporting scopes, so an inherited grant can be effective.
select ok(
  public._internal_has_permission(fixture.user_id::uuid, 'crm.simulators.view')
    and public._internal_has_permission(fixture.user_id::uuid, 'crm.simulators.execute'),
  concat(fixture.role_key, ' receives both simulator permissions after approval')
)
from (values
  ('a3000000-0000-4000-8000-000000000001', 'master'),
  ('a3000000-0000-4000-8000-000000000002', 'admin'),
  ('a3000000-0000-4000-8000-000000000004', 'coordinator'),
  ('a3000000-0000-4000-8000-000000000005', 'manager_house'),
  ('a3000000-0000-4000-8000-000000000006', 'manager_imob'),
  ('a3000000-0000-4000-8000-000000000007', 'broker_house'),
  ('a3000000-0000-4000-8000-000000000008', 'broker_imob')
) as fixture(user_id, role_key);

select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000010', 'crm.simulators.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000010', 'crm.simulators.execute'),
  'pending accounts receive neither simulator permission'
);

update public.profiles
set is_active = false
where user_id = 'a3000000-0000-4000-8000-000000000008';
select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.simulators.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.simulators.execute'),
  'inactive approved accounts cannot use their inherited simulator permissions'
);
update public.profiles
set is_active = true
where user_id = 'a3000000-0000-4000-8000-000000000008';

insert into public.user_permission_overrides (user_id, permission_key, effect, reason, granted_by)
values (
  'a3000000-0000-4000-8000-000000000008', 'crm.simulators.execute', 'deny',
  'Synthetic simulator deny remains authoritative', 'a3000000-0000-4000-8000-000000000001'
);
select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.simulators.execute'),
  'an existing explicit deny still overrides the expanded simulator defaults'
);
delete from public.user_permission_overrides
where user_id = 'a3000000-0000-4000-8000-000000000008'
  and permission_key = 'crm.simulators.execute';
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.simulators.execute'),
  'removing the simulator deny restores the role default'
);

-- Isolate dashboard counts from persistent local fixtures. The enclosing
-- transaction rolls back this cleanup along with every synthetic test row.
delete from public.crm_dashboard_snapshots;

insert into public.crm_dashboard_snapshots (snapshot_key, reference_date, generated_at, source)
values ('matrix', current_date, now(), 'synthetic-role-matrix');

insert into public.crm_dashboard_views (
  snapshot_id,
  view_key,
  sales_value_month,
  sales_value_week,
  sales_value_today
)
select snapshot.id, view_key, 1, 1, 1
from public.crm_dashboard_snapshots snapshot
cross join unnest(array['all', 'with_canal_imob', 'without_canal_imob']) as views(view_key)
where snapshot.snapshot_key = 'matrix';

insert into public.crm_dashboard_metrics (
  snapshot_id,
  view_key,
  stage_key,
  current_month,
  current_week,
  current_today
)
select snapshot.id, view_key, stage_key, 1, 1, 1
from public.crm_dashboard_snapshots snapshot
cross join unnest(array['all', 'with_canal_imob', 'without_canal_imob']) as views(view_key)
cross join unnest(array['opportunities', 'appointments', 'visits', 'folders', 'sales']) as stages(stage_key)
where snapshot.snapshot_key = 'matrix';

insert into public.crm_dashboard_top_developments (snapshot_id, view_key, rank, name, total)
select snapshot.id, view_key, 1, concat('Synthetic ', view_key), 1
from public.crm_dashboard_snapshots snapshot
cross join unnest(array['all', 'with_canal_imob', 'without_canal_imob']) as views(view_key)
where snapshot.snapshot_key = 'matrix';

select ok(
  public.can_grant_permission(
    'a3000000-0000-4000-8000-000000000001',
    'crm.commercial_policy.manage'
  ),
  'Master can delegate a held permission whose minimum level equals Master'
);

select ok(
  not public.can_assign_role(
    'a3000000-0000-4000-8000-000000000002',
    'admin'
  ),
  'Administrator cannot assign the Administrator role to a peer'
);

select ok(
  public.can_assign_role(
    'a3000000-0000-4000-8000-000000000001',
    'admin'
  ),
  'Master can assign the Administrator role'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'all,with_canal_imob,without_canal_imob',
  'Master reads all dashboard views'
);
select is((select count(*) from public.crm_dashboard_metrics), 15::bigint, 'Master reads all dashboard metrics');
select is((select count(*) from public.crm_dashboard_top_developments), 3::bigint, 'Master reads all ranked developments');

select lives_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000002',
    array['crm.simulators.view'],
    'allow',
    'Master delegation to Administrator test'
  )$$,
  'Master can preserve an explicit allow for an inherited Administrator permission'
);
select is(
  (
    select effect
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.simulators.view'
  ),
  'allow',
  'Master override persists without changing the Administrator role'
);
select is(
  (
    select role_key
    from public.user_roles
    where user_id = 'a3000000-0000-4000-8000-000000000002'
  ),
  'admin',
  'permission delegation does not promote the Administrator role'
);

reset role;
select ok(
  not public.can_grant_permission(
    'a3000000-0000-4000-8000-000000000002',
    'crm.commercial_policy.manage'
  ),
  'Administrator cannot propagate an inherited permission whose minimum level is 100'
);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'all,with_canal_imob,without_canal_imob',
  'Administrator reads all dashboard views'
);
select is((select count(*) from public.crm_dashboard_top_developments), 3::bigint, 'Administrator reads every ranked dashboard view');
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000004', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'with_canal_imob',
  'Coordinator reads only the Imob dashboard view'
);
select is((select count(*) from public.crm_dashboard_metrics), 5::bigint, 'Coordinator reads only Imob metrics');
select is((select count(*) from public.crm_dashboard_top_developments), 0::bigint, 'Coordinator cannot read ranked developments');

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000005', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'without_canal_imob',
  'Gerente House reads only the House dashboard view'
);
select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_top_developments),
  'without_canal_imob',
  'Gerente House reads ranked developments only for the House view'
);

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000006', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'with_canal_imob',
  'Gerente Imob reads only the Imob dashboard view'
);
select is((select count(*) from public.crm_dashboard_top_developments), 0::bigint, 'Gerente Imob cannot read ranked developments');

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000007', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'without_canal_imob',
  'Corretor House reads only the House dashboard view'
);
select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_top_developments),
  'without_canal_imob',
  'Corretor House reads ranked developments only for the House view'
);

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000008', true);
set local role authenticated;

select is(
  (select string_agg(view_key, ',' order by view_key) from public.crm_dashboard_views),
  'with_canal_imob',
  'Corretor Imob reads only the Imob dashboard view'
);
select is((select count(*) from public.crm_dashboard_top_developments), 0::bigint, 'Corretor Imob cannot read ranked developments');

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select throws_ok(
  $$select public.assign_user_role(
    'a3000000-0000-4000-8000-000000000003',
    'coordinator',
    'Peer role change attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot alter another Administrator role'
);
select is(
  (select role_key from public.user_roles where user_id = 'a3000000-0000-4000-8000-000000000003'),
  'admin',
  'failed peer role change leaves the Administrator unchanged'
);
select throws_ok(
  $$select public.approve_user_access(
    'a3000000-0000-4000-8000-000000000010',
    'admin',
    array['f3000000-0000-4000-8000-000000000001'::uuid],
    'Administrator promotion attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot approve a pending identity as Administrator'
);
select throws_ok(
  $$select public.set_user_active(
    'a3000000-0000-4000-8000-000000000003',
    false,
    'Peer deactivation attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot deactivate another Administrator'
);
select ok(
  (select is_active from public.profiles where user_id = 'a3000000-0000-4000-8000-000000000003'),
  'failed peer deactivation leaves the Administrator active'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000002',
    array['crm.dashboard.view'],
    'deny',
    'Self override attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot change their own permissions in bulk'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000003',
    array['crm.dashboard.view'],
    'deny',
    'Peer override attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot change another Administrator permissions'
);
select throws_ok(
  $$select public.apply_user_permission_access_draft(
    'a3000000-0000-4000-8000-000000000003',
    array[]::text[],
    array['crm.dashboard.view'],
    array[]::text[],
    'Peer mixed access draft attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot change another Administrator through the checkbox draft RPC'
);
select throws_ok(
  $$select public.set_user_permission_override(
    'a3000000-0000-4000-8000-000000000003',
    'crm.dashboard.view',
    'deny',
    'Peer single override attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot set a single permission override on another Administrator'
);
select throws_ok(
  $test$
  do $boundary$
  begin
    begin
      perform public.remove_user_permission_override(
        'a3000000-0000-4000-8000-000000000003',
        'crm.dashboard.view',
        'Peer override removal attempt'
      );
      raise exception 'expected peer override removal denial'
        using errcode = 'P0001';
    exception
      when sqlstate '42501' then
        if not exists (
          select 1
          from public.user_permission_overrides permission_override
          where permission_override.user_id = 'a3000000-0000-4000-8000-000000000003'
            and permission_override.permission_key = 'crm.dashboard.view'
            and permission_override.effect = 'deny'
        ) then
          raise exception 'peer override was removed after denied RPC'
            using errcode = 'P0001';
        end if;
        raise;
    end;
  end
  $boundary$;
  $test$,
  '42501',
  null,
  'Administrator cannot remove another Administrator override and the row remains'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
delete from public.user_permission_overrides
where user_id = 'a3000000-0000-4000-8000-000000000003'
  and permission_key = 'crm.dashboard.view';
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select throws_ok(
  $test$
  do $boundary$
  begin
    if exists (
      select 1
      from public.user_permission_overrides permission_override
      where permission_override.user_id = 'a3000000-0000-4000-8000-000000000003'
        and permission_override.permission_key = 'crm.ranking.view'
    ) then
      raise exception 'unexpected peer override fixture'
        using errcode = 'P0001';
    end if;

    perform public.set_user_permission_overrides_bulk(
      'a3000000-0000-4000-8000-000000000003',
      array['crm.ranking.view'],
      'inherit',
      'Peer inherit without row attempt'
    );
    raise exception 'expected peer inherit denial'
      using errcode = 'P0001';
  end
  $boundary$;
  $test$,
  '42501',
  null,
  'Administrator bulk inherit cannot target another Administrator without an override row'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000009',
    array['crm.dashboard.view'],
    'deny',
    'Out of scope override attempt'
  )$$,
  '42501',
  null,
  'Administrator cannot change permissions outside the delegated scope'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000010',
    array['crm.dashboard.view'],
    'deny',
    'Pending target override attempt'
  )$$,
  '23505',
  null,
  'bulk mutation rejects a target that is not approved'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.dashboard.view'],
    'replace',
    'Invalid effect test'
  )$$,
  '22023',
  null,
  'bulk mutation rejects an unknown effect'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array[]::text[],
    'allow',
    'Empty selection test'
  )$$,
  '22023',
  null,
  'bulk mutation rejects an empty permission selection'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.dashboard.view', 'crm.dashboard.view'],
    'allow',
    'Duplicate selection test'
  )$$,
  '22023',
  null,
  'bulk mutation rejects duplicate permission keys'
);
select throws_ok(
  $$select public.apply_user_permission_access_draft(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.dashboard.view'],
    array['crm.dashboard.view'],
    array[]::text[],
    'Duplicate mixed access draft test'
  )$$,
  '22023',
  null,
  'mixed access draft rejects a permission repeated across effect groups'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.unknown.view'],
    'allow',
    'Unknown permission test'
  )$$,
  '22023',
  null,
  'bulk mutation rejects unknown permission keys'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array(select concat('crm.synthetic.', value::text) from generate_series(1, 101) value),
    'allow',
    'Oversized selection test'
  )$$,
  '22023',
  null,
  'bulk mutation rejects more than one hundred permission keys'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.dashboard.view', 'crm.commercial_policy.manage'],
    'deny',
    'Atomic authorization failure test'
  )$$,
  '42501',
  null,
  'one forbidden permission aborts the complete bulk mutation'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
      and permission_key = 'crm.dashboard.view'
  ),
  0::bigint,
  'atomic failure does not persist an earlier valid permission'
);

reset role;

select throws_ok(
  $$update public.user_roles
    set role_key = 'coordinator'
    where user_id = 'a3000000-0000-4000-8000-000000000003'$$,
  '42501',
  null,
  'role trigger blocks direct Administrator-to-Administrator role mutation'
);
select throws_ok(
  $$update public.profiles
    set is_active = false,
        access_status = 'suspended'
    where user_id = 'a3000000-0000-4000-8000-000000000003'$$,
  '42501',
  null,
  'profile trigger blocks direct Administrator-to-Administrator status mutation'
);
select throws_ok(
  $$insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    ) values (
      'a3000000-0000-4000-8000-000000000003',
      'crm.dashboard.view',
      'deny',
      'Direct peer override attempt',
      'a3000000-0000-4000-8000-000000000002'
    )$$,
  '42501',
  null,
  'override trigger blocks direct Administrator-to-Administrator permission mutation'
);
select throws_ok(
  $$update public.crm_user_reporting_scope_grants
    set reason = 'Direct peer scope attempt'
    where user_id = 'a3000000-0000-4000-8000-000000000003'
      and revoked_at is null$$,
  '42501',
  null,
  'scope trigger blocks direct Administrator-to-Administrator reporting-scope mutation'
);
select throws_ok(
  $test$
  do $boundary$
  begin
    if exists (
      select 1
      from public.crm_user_reporting_scope_grants scope_grant
      where scope_grant.user_id = 'a3000000-0000-4000-8000-000000000003'
        and scope_grant.reporting_scope_id = 'f3000000-0000-4000-8000-000000000008'
        and scope_grant.revoked_at is null
    ) then
      raise exception 'unexpected peer reporting-scope fixture'
        using errcode = 'P0001';
    end if;

    insert into public.crm_user_reporting_scope_grants (
      user_id,
      reporting_scope_id,
      granted_by,
      reason
    )
    values (
      'a3000000-0000-4000-8000-000000000003',
      'f3000000-0000-4000-8000-000000000008',
      'a3000000-0000-4000-8000-000000000002',
      'Direct peer scope insert attempt'
    );
    raise exception 'expected peer reporting-scope insert denial'
      using errcode = 'P0001';
  end
  $boundary$;
  $test$,
  '42501',
  null,
  'scope trigger blocks direct reporting-scope insert for another Administrator'
);
select throws_ok(
  $test$
  do $boundary$
  begin
    begin
      delete from public.crm_user_reporting_scope_grants scope_grant
      where scope_grant.user_id = 'a3000000-0000-4000-8000-000000000003'
        and scope_grant.reporting_scope_id = 'f3000000-0000-4000-8000-000000000001'
        and scope_grant.revoked_at is null;
      raise exception 'expected peer reporting-scope delete denial'
        using errcode = 'P0001';
    exception
      when sqlstate '42501' then
        if not exists (
          select 1
          from public.crm_user_reporting_scope_grants scope_grant
          where scope_grant.user_id = 'a3000000-0000-4000-8000-000000000003'
            and scope_grant.reporting_scope_id = 'f3000000-0000-4000-8000-000000000001'
            and scope_grant.revoked_at is null
        ) then
          raise exception 'peer reporting-scope row was removed after denied delete'
            using errcode = 'P0001';
        end if;
        raise;
    end;
  end
  $boundary$;
  $test$,
  '42501',
  null,
  'scope trigger blocks direct reporting-scope delete for another Administrator and the row remains'
);

set local role authenticated;

select lives_ok(
  $$select public.apply_user_permission_access_draft(
    'a3000000-0000-4000-8000-000000000007',
    array['crm.dashboard.with_canal_imob.view'],
    array['pages.view'],
    array[]::text[],
    'Direct checkbox mixed draft test'
  )$$,
  'Administrator can save checked and unchecked permissions in one atomic draft'
);
select is(
  (
    select string_agg(concat(permission_key, ':', effect), ',' order by permission_key)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  'crm.dashboard.with_canal_imob.view:allow,pages.view:deny',
  'mixed access draft persists each checkbox with its intended effect'
);
select lives_ok(
  $$select public.apply_user_permission_access_draft(
    'a3000000-0000-4000-8000-000000000007',
    array[]::text[],
    array[]::text[],
    array['crm.dashboard.with_canal_imob.view', 'pages.view'],
    'Restore selected profile defaults test'
  )$$,
  'Administrator can restore the selected profile defaults atomically'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  0::bigint,
  'profile default restore removes every changed override'
);

select lives_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['pages.view', 'crm.dashboard.with_canal_imob.view'],
    'allow',
    'Approved bulk allow test'
  )$$,
  'Administrator can add multiple permission exceptions to an in-scope lower user'
);
select is(
  (
    select string_agg(concat(permission_key, ':', effect), ',' order by permission_key)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  'crm.dashboard.with_canal_imob.view:allow,pages.view:allow',
  'bulk allow persists every selected permission'
);
select lives_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['pages.view', 'crm.dashboard.with_canal_imob.view'],
    'deny',
    'Approved bulk deny test'
  )$$,
  'Administrator can deny multiple permission exceptions atomically'
);
select is(
  (
    select string_agg(concat(permission_key, ':', effect), ',' order by permission_key)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  'crm.dashboard.with_canal_imob.view:deny,pages.view:deny',
  'bulk deny updates every selected permission'
);
select lives_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000007',
    array['pages.view', 'crm.dashboard.with_canal_imob.view'],
    'inherit',
    'Approved bulk inheritance restore test'
  )$$,
  'Administrator can restore inherited behavior for multiple permissions'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  0::bigint,
  'inherit removes every selected individual override'
);

reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000008',
    array['crm.dashboard.view'],
    'deny',
    'Lower role mutation attempt'
  )$$,
  '42501',
  null,
  'operational roles cannot mutate another user permissions'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000008'
  ),
  0::bigint,
  'rejected lower-role mutation persists nothing'
);

reset role;

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
  $$select public.set_user_permission_override(
    'a3000000-0000-4000-8000-000000000003',
    'crm.simulators.execute',
    'allow',
    'Master-only simulator override attempt'
  )$$,
  '42501',
  null,
  'even Master cannot allow official simulator execution for an Administrator'
);
select throws_ok(
  $$select public.set_user_permission_override(
    'a3000000-0000-4000-8000-000000000003',
    'crm.commercial_engine.execute',
    'allow',
    'Master-only commercial engine override attempt'
  )$$,
  '42501',
  null,
  'even Master cannot allow commercial engine execution for an Administrator'
);
select throws_ok(
  $$select public.set_user_permission_override(
    'a3000000-0000-4000-8000-000000000003',
    'crm.commercial_policy.manage',
    'allow',
    'Master-only commercial policy override attempt'
  )$$,
  '42501',
  null,
  'even Master cannot allow commercial policy management for an Administrator'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk(
    'a3000000-0000-4000-8000-000000000003',
    array[
      'crm.simulators.execute',
      'crm.commercial_engine.execute',
      'crm.commercial_policy.manage'
    ],
    'allow',
    'Master-only bulk override attempt'
  )$$,
  '42501',
  null,
  'bulk override cannot grant any Master-only permission to an Administrator'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'rejected Master-only allows persist no partial Administrator override'
);
reset role;

select lives_ok(
  $$insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    ) values
      (
        'a3000000-0000-4000-8000-000000000003',
        'crm.simulators.execute',
        'deny',
        'Administrator simulator deny preservation test',
        'a3000000-0000-4000-8000-000000000001'
      ),
      (
        'a3000000-0000-4000-8000-000000000003',
        'crm.commercial_engine.execute',
        'deny',
        'Administrator engine deny preservation test',
        'a3000000-0000-4000-8000-000000000001'
      ),
      (
        'a3000000-0000-4000-8000-000000000003',
        'crm.commercial_policy.manage',
        'deny',
        'Administrator policy deny preservation test',
        'a3000000-0000-4000-8000-000000000001'
      )$$,
  'Administrator boundary trigger preserves direct deny overrides for Master-only permissions'
);
select is(
  (
    select string_agg(
      concat(permission_key, ':', effect),
      ','
      order by permission_key
    )
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000003'
  ),
  'crm.commercial_engine.execute:deny,crm.commercial_policy.manage:deny,'
    || 'crm.simulators.execute:deny',
  'Administrator deny overrides remain intact for every Master-only permission'
);
select lives_ok(
  $$delete from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000003'
      and permission_key = any(array[
      'crm.simulators.execute',
      'crm.commercial_engine.execute',
      'crm.commercial_policy.manage'
    ])$$,
  'trusted cleanup can remove Administrator deny overrides without widening access'
);
select lives_ok(
  $$insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    ) values
      (
        'a3000000-0000-4000-8000-000000000007',
        'crm.simulators.execute',
        'allow',
        'Non-Administrator simulator allow preservation test',
        'a3000000-0000-4000-8000-000000000001'
      ),
      (
        'a3000000-0000-4000-8000-000000000007',
        'crm.commercial_engine.execute',
        'allow',
        'Non-Administrator engine allow preservation test',
        'a3000000-0000-4000-8000-000000000001'
      ),
      (
        'a3000000-0000-4000-8000-000000000007',
        'crm.commercial_policy.manage',
        'allow',
        'Non-Administrator policy allow preservation test',
        'a3000000-0000-4000-8000-000000000001'
      )$$,
  'Administrator boundary trigger leaves direct allow overrides for other roles unchanged'
);
select is(
  (
    select string_agg(
      concat(permission_key, ':', effect),
      ','
      order by permission_key
    )
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
  ),
  'crm.commercial_engine.execute:allow,crm.commercial_policy.manage:allow,'
    || 'crm.simulators.execute:allow',
  'non-Administrator allow overrides are preserved exactly'
);
select lives_ok(
  $$delete from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000007'
      and permission_key = any(array[
      'crm.simulators.execute',
      'crm.commercial_engine.execute',
      'crm.commercial_policy.manage'
    ])$$,
  'trusted cleanup can remove preserved non-Administrator overrides'
);

select throws_ok(
  $$insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    ) values (
      'a3000000-0000-4000-8000-000000000003',
      'crm.simulators.execute',
      'allow',
      'Direct Master-only override attempt',
      'a3000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  null,
  'override trigger blocks a direct Master-only allow for Administrator even from Master'
);

set local role authenticated;

select lives_ok(
  $$select public.approve_user_access(
    'a3000000-0000-4000-8000-000000000010',
    'admin',
    array['f3000000-0000-4000-8000-000000000001'::uuid],
    'Master approval of Administrator'
  )$$,
  'Master can approve a pending identity as Administrator with an organization scope'
);
select is(
  (
    select concat_ws(
      '|',
      user_role.role_key,
      profile.access_status,
      profile.is_active::text,
      (
        select count(*)::text
        from public.crm_user_reporting_scope_grants scope_grant
        where scope_grant.user_id = profile.user_id
          and scope_grant.revoked_at is null
      )
    )
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.user_id
    where profile.user_id = 'a3000000-0000-4000-8000-000000000010'
  ),
  'admin|approved|true|1',
  'Master approval persists the protected role, active status and one reporting scope'
);
select lives_ok(
  $$select public.assign_user_role(
    'a3000000-0000-4000-8000-000000000010',
    'admin',
    'Master Administrator role confirmation'
  )$$,
  'Master can assign Administrator to an approved Administrator account'
);
select lives_ok(
  $$select public.set_user_active(
    'a3000000-0000-4000-8000-000000000010',
    false,
    'Master Administrator suspension test'
  )$$,
  'Master can suspend an Administrator account'
);

reset role;

select lives_ok(
  $$update public.crm_user_reporting_scope_grants
    set reason = 'Master direct protected-scope maintenance test'
    where user_id = 'a3000000-0000-4000-8000-000000000010'
      and revoked_at is null$$,
  'scope trigger permits trusted Master maintenance while the Administrator is suspended'
);

set local role authenticated;

select lives_ok(
  $$select public.set_user_active(
    'a3000000-0000-4000-8000-000000000010',
    true,
    'Master Administrator reactivation test'
  )$$,
  'Master can reactivate an Administrator account with a compatible scope'
);
select lives_ok(
  $$select public.set_user_permission_override(
    'a3000000-0000-4000-8000-000000000010',
    'crm.dashboard.view',
    'deny',
    'Master Administrator override test'
  )$$,
  'Master can set a single permission override on an Administrator account'
);
select lives_ok(
  $$select public.remove_user_permission_override(
    'a3000000-0000-4000-8000-000000000010',
    'crm.dashboard.view',
    'Master Administrator override cleanup'
  )$$,
  'Master can remove a single permission override from an Administrator account'
);
select is(
  (
    select count(*)
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000010'
  ),
  0::bigint,
  'Master override cleanup restores the Administrator inherited matrix'
);

reset role;

select ok(
  not public.can_assign_role(
    'a3000000-0000-4000-8000-000000000001',
    'supervisor'
  ),
  'retired roles remain unavailable even to Master through normal assignment'
);


-- Local direct-access controls preserve the existing hierarchy and audit RPCs.
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select ok(has_function_privilege('authenticated', 'public.assign_user_role_defaults(uuid,text)', 'EXECUTE'), 'authenticated can invoke guarded role defaults');
select ok(not has_function_privilege('anon', 'public.assign_user_role_defaults(uuid,text)', 'EXECUTE'), 'anonymous cannot assign role defaults');
select ok(not has_function_privilege('service_role', 'public.assign_user_role_defaults(uuid,text)', 'EXECUTE'), 'service role has no direct execute grant');
select lives_ok($$select public.apply_user_permission_access_draft(
  'a3000000-0000-4000-8000-000000000007', array['crm.partnerships.view'], array['crm.dashboard.view'], array[]::text[], 'Synthetic direct checkbox changes'
)$$, 'mixed checkbox changes save atomically');
select is((select effect from public.user_permission_overrides where user_id='a3000000-0000-4000-8000-000000000007' and permission_key='crm.partnerships.view'), 'allow', 'checked exception is persisted');
select is((select effect from public.user_permission_overrides where user_id='a3000000-0000-4000-8000-000000000007' and permission_key='crm.dashboard.view'), 'deny', 'unchecked inherited permission is persisted');
select lives_ok($$select public.assign_user_role_defaults('a3000000-0000-4000-8000-000000000007','broker_imob')$$, 'role assignment restores defaults without manual reason');
select is((select count(*) from public.user_permission_overrides where user_id='a3000000-0000-4000-8000-000000000007'), 0::bigint, 'all old exceptions are removed');
select is((select role_key from public.user_roles where user_id='a3000000-0000-4000-8000-000000000007'), 'broker_imob', 'new role is persisted');
select throws_ok($$select public.assign_user_role_defaults('a3000000-0000-4000-8000-000000000001','admin')$$, '42501', null, 'self role change remains blocked');
select throws_ok($$select public.apply_user_permission_access_draft('a3000000-0000-4000-8000-000000000007',array['crm.dashboard.view'],array['crm.dashboard.view'],array[]::text[],'Synthetic duplicate')$$, '22023', null, 'contradictory checkbox changes are rejected');
select lives_ok($$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000007',array['crm.commercial_policy.manage'],'allow','Synthetic privileged exception')$$, 'Master can prepare a privileged exception');
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.assign_user_role_defaults('a3000000-0000-4000-8000-000000000003','coordinator')$$, '42501', null, 'peer role assignment remains blocked');
select throws_ok($$select public.assign_user_role_defaults('a3000000-0000-4000-8000-000000000009','broker_imob')$$, '42501', null, 'out of scope assignment remains blocked');
select throws_ok($$select public.assign_user_role_defaults('a3000000-0000-4000-8000-000000000007','broker_house')$$, '42501', null, 'undelegable exceptions reject the entire role change');
select is((select role_key from public.user_roles where user_id='a3000000-0000-4000-8000-000000000007'), 'broker_imob', 'failed reset rolls back the role assignment');
select throws_ok($$select public.apply_user_permission_access_draft('a3000000-0000-4000-8000-000000000007',array['pages.view'],array['users.manage'],array[]::text[],'Synthetic atomic failure')$$, '42501', null, 'a forbidden permission rejects the entire mixed draft');
select is((select count(*) from public.user_permission_overrides where user_id='a3000000-0000-4000-8000-000000000007' and permission_key='pages.view'), 0::bigint, 'earlier permitted draft group also rolls back');
reset role;

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select ok(has_function_privilege('authenticated', 'public.get_user_role_permission_defaults()', 'EXECUTE'), 'authenticated can request guarded role defaults');
select ok(not has_function_privilege('anon', 'public.get_user_role_permission_defaults()', 'EXECUTE'), 'anonymous cannot read role defaults');
select ok(not has_function_privilege('service_role', 'public.get_user_role_permission_defaults()', 'EXECUTE'), 'service role has no direct defaults read grant');
select is((select count(*) from public.get_user_role_permission_defaults() where role_key='manager_imob'), 24::bigint, 'Users viewers receive the authoritative Imob baseline');
select is((select count(*) from public.get_user_role_permission_defaults() where role_key='admin'), 82::bigint, 'the defaults RPC exposes every inherited Administrator permission');
select ok(exists(select 1 from public.get_user_role_permission_defaults() where role_key='master' and permission_key='crm.commercial_policy.manage'), 'role defaults reflect local policy grants absent from the static UI baseline');
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000011', true);
set local role authenticated;
select is((select count(*) from public.get_user_role_permission_defaults()), 0::bigint, 'callers without users.view receive no role defaults');
reset role;

-- Administrator and Master inherit both brands; operational roles need
-- explicit access. A deny remains authoritative without removing management.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*) from public.permissions where key in ('crm.inventory.riva.view', 'crm.inventory.direcional.view') and min_level = 10),
  2::bigint,
  'both brand permissions exist with the operational minimum level'
);
select is(
  (select array_agg(role_key || ':' || permission_key order by role_key, permission_key)
   from public.role_permissions
   where permission_key in ('crm.inventory.riva.view', 'crm.inventory.direcional.view')),
  array['admin:crm.inventory.direcional.view', 'admin:crm.inventory.riva.view', 'master:crm.inventory.direcional.view', 'master:crm.inventory.riva.view']::text[],
  'Administrator and Master inherit both inventory brands'
);
select ok(
  not exists (
    select 1
    from unnest(array[
      'a3000000-0000-4000-8000-000000000004'::uuid,
      'a3000000-0000-4000-8000-000000000005'::uuid,
      'a3000000-0000-4000-8000-000000000006'::uuid,
      'a3000000-0000-4000-8000-000000000007'::uuid,
      'a3000000-0000-4000-8000-000000000008'::uuid
    ]) fixture(user_id)
    where public._internal_has_permission(fixture.user_id, 'crm.inventory.riva.view')
      or public._internal_has_permission(fixture.user_id, 'crm.inventory.direcional.view')
  ),
  'the five operational roles start without access to either brand'
);
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'),
  'Administrator initially receives both brands from the role default'
);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000002', array['crm.inventory.riva.view', 'crm.inventory.direcional.view'], 'deny', 'Synthetic Administrator brand deny')$$,
  'Master can explicitly deny inherited brand access for Administrator'
);
reset role;
select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'),
  'individual denies take precedence over the complete Administrator defaults'
);
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.can_grant_permission('a3000000-0000-4000-8000-000000000001', 'crm.inventory.riva.view')
    and public.can_grant_permission('a3000000-0000-4000-8000-000000000001', 'crm.inventory.direcional.view'),
  'Master can manage both inherited brand permissions'
);
select ok(
  public.can_grant_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and public.can_grant_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'),
  'Administrator can manage both brand permissions without reading either brand'
);
select ok(
  not public.can_grant_permission('a3000000-0000-4000-8000-000000000011', 'crm.inventory.riva.view')
    and not public.can_grant_permission('a3000000-0000-4000-8000-000000000011', 'crm.inventory.direcional.view'),
  'an actor without permissions.manage cannot delegate either brand'
);
insert into public.permissions (key, description, min_level)
values ('crm.inventory.other.view', 'Synthetic brand-like permission outside the allowlist', 10);
select ok(
  not public.can_grant_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.other.view')
    and not public.can_grant_permission('a3000000-0000-4000-8000-000000000002', 'crm.commercial_policy.manage'),
  'the brand exception does not extend to similar keys or restricted commercial policy'
);
delete from public.permissions where key = 'crm.inventory.other.view';
update public.permissions set min_level = 100 where key = 'crm.inventory.riva.view';
select ok(
  not public.can_grant_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and public.can_grant_permission('a3000000-0000-4000-8000-000000000001', 'crm.inventory.riva.view'),
  'brand delegation retains the existing minimum-level rule and Master exception'
);
update public.permissions set min_level = 10 where key = 'crm.inventory.riva.view';
select ok(
  not has_function_privilege('authenticated', 'public.can_grant_permission(uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.can_grant_permission(uuid,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.can_grant_permission(uuid,text)', 'EXECUTE')
    and not has_table_privilege('authenticated', 'public.permissions', 'INSERT,UPDATE,DELETE')
    and not has_table_privilege('anon', 'public.permissions', 'INSERT,UPDATE,DELETE'),
  'brand configuration adds no direct function or catalog mutation grants'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000008', array['crm.inventory.riva.view'], 'allow', 'Synthetic RIVA access')$$,
  'Master grants inherited RIVA to a lower user'
);
reset role;
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.riva.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.direcional.view'),
  'RIVA-only access does not authorize DIRECIONAL'
);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select lives_ok(
  $$select public.apply_user_permission_access_draft('a3000000-0000-4000-8000-000000000008', array['crm.inventory.direcional.view'], array[]::text[], array['crm.inventory.riva.view'], 'Synthetic DIRECIONAL-only access')$$,
  'Administrator switches brands atomically without possessing brand read access'
);
reset role;
select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.riva.view')
    and public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.direcional.view'),
  'DIRECIONAL-only access does not authorize RIVA'
);
set local role authenticated;
select lives_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000008', array['crm.inventory.riva.view'], 'allow', 'Synthetic combined brand access')$$,
  'Administrator can explicitly authorize both brands'
);
reset role;
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.riva.view')
    and public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.direcional.view'),
  'both explicitly allowed brands are effective'
);
set local role authenticated;
select lives_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000008', array['crm.inventory.riva.view', 'crm.inventory.direcional.view'], 'inherit', 'Synthetic brand access revocation')$$,
  'restoring defaults revokes both explicit brand grants'
);
reset role;
select ok(
  not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.riva.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000008', 'crm.inventory.direcional.view'),
  'revocation leaves the target with neither brand'
);
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000001', 'crm.inventory.riva.view')
    and public._internal_has_permission('a3000000-0000-4000-8000-000000000001', 'crm.inventory.direcional.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and not public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'),
  'managing another user preserves inherited Master access and explicit Administrator denies'
);
set local role authenticated;
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000002', array['crm.inventory.riva.view'], 'allow', 'Synthetic self brand grant')$$,
  '42501', null, 'Administrator cannot grant brand access to self'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000003', array['crm.inventory.riva.view'], 'allow', 'Synthetic peer brand grant')$$,
  '42501', null, 'Administrator cannot grant brand access to a peer'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000001', array['crm.inventory.riva.view'], 'allow', 'Synthetic superior brand grant')$$,
  '42501', null, 'Administrator cannot grant brand access to Master'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000009', array['crm.inventory.direcional.view'], 'allow', 'Synthetic outside-scope brand grant')$$,
  '42501', null, 'Administrator cannot grant brand access outside the reporting scope'
);
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000011', true);
set local role authenticated;
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000008', array['crm.inventory.riva.view'], 'allow', 'Synthetic unmanaged brand grant')$$,
  '42501', null, 'actors without permissions.manage cannot mutate brand access through the RPC'
);
reset role;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000001', array['crm.inventory.riva.view'], 'allow', 'Synthetic Master self brand grant')$$,
  '42501', null, 'Master cannot bypass the existing self-modification guard'
);
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000012', array['crm.inventory.riva.view'], 'allow', 'Synthetic pending brand grant')$$,
  '23505', null, 'pending users cannot receive brand permission exceptions'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = false
where user_id = 'a3000000-0000-4000-8000-000000000008';
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000008', array['crm.inventory.direcional.view'], 'allow', 'Synthetic inactive brand grant')$$,
  '23505', null, 'inactive users cannot receive brand permission exceptions'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set is_active = true
where user_id = 'a3000000-0000-4000-8000-000000000008';
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_user_permission_overrides_bulk('a3000000-0000-4000-8000-000000000002', array['crm.inventory.riva.view', 'crm.inventory.direcional.view'], 'inherit', 'Synthetic Administrator defaults restored')$$,
  'Master can restore Administrator brand inheritance without rewriting role defaults'
);
reset role;
select ok(
  public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.riva.view')
    and public._internal_has_permission('a3000000-0000-4000-8000-000000000002', 'crm.inventory.direcional.view'),
  'removing individual denies restores both inherited Administrator brands'
);
select is(
  (select count(*) from public.user_permission_overrides where user_id::text like 'a3000000-%' and permission_key in ('crm.inventory.riva.view', 'crm.inventory.direcional.view')),
  0::bigint,
  'rejected brand mutations leave no residual access grants'
);

select * from finish();
rollback;
