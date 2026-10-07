begin;

select plan(62);

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
  'Administrator inherits all relevant non-Master operations and access management'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'coordinator'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.partnerships.view,crm.stages.view,pages.view',
  'Coordinator sees only the Imob channel, partnerships and common operational pages'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'manager_house'
  ),
  'crm.dashboard.view,crm.dashboard.without_canal_imob.view,crm.ranking.view,crm.stages.view,pages.view',
  'Gerente House sees only the House channel and ranking'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'manager_imob'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.partnerships.view,crm.stages.view,pages.view',
  'Gerente Imob sees only the Imob channel and partnerships'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'broker_house'
  ),
  'crm.dashboard.view,crm.dashboard.without_canal_imob.view,crm.ranking.view,crm.stages.view,pages.view',
  'Corretor House sees only the House channel and ranking'
);

select is(
  (
    select string_agg(permission_key, ',' order by permission_key)
    from public.role_permissions
    where role_key = 'broker_imob'
  ),
  'crm.dashboard.view,crm.dashboard.with_canal_imob.view,crm.partnerships.view,crm.stages.view,pages.view',
  'Corretor Imob sees only the Imob channel and partnerships'
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
  ('a3000000-0000-4000-8000-000000000011', 'matrix-lower-actor@example.test');

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
    'crm.simulators.view'
  ),
  'Master can delegate a held permission whose minimum level equals Master'
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
  'Master can allow an inherited-denied permission for an Administrator'
);
select is(
  (
    select effect
    from public.user_permission_overrides
    where user_id = 'a3000000-0000-4000-8000-000000000002'
      and permission_key = 'crm.simulators.view'
  ),
  'allow',
  'Master delegation persists as an explicit allow without changing the target role'
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
    'crm.simulators.view'
  ),
  'Administrator cannot propagate a Master-level permission received by override'
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
    array['crm.dashboard.view', 'crm.simulators.view'],
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

select ok(
  not public.can_assign_role(
    'a3000000-0000-4000-8000-000000000001',
    'supervisor'
  ),
  'retired roles remain unavailable even to Master through normal assignment'
);

select * from finish();
rollback;
