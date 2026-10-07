-- Reconcile the user-facing role catalog, dashboard-view authorization and
-- atomic permission exception updates. The migration is compatible with both
-- the legacy production authorization schema and clean installs that include
-- the scoped-onboarding foundation.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
begin
  if to_regclass('public.roles') is null
     or to_regclass('public.permissions') is null
     or to_regclass('public.role_permissions') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.user_permission_overrides') is null
     or to_regclass('public.audit_logs') is null
     or to_regprocedure('public._internal_get_role_level(uuid)') is null
     or to_regprocedure('public._internal_has_permission(uuid,text)') is null
     or to_regprocedure('public.can_grant_permission(uuid,text)') is null then
    raise exception 'role reconciliation requires the access-control foundation'
      using errcode = '42P01';
  end if;

  if to_regclass('public.crm_dashboard_views') is null
     or to_regclass('public.crm_dashboard_metrics') is null
     or to_regclass('public.crm_dashboard_top_developments') is null then
    raise exception 'dashboard-view reconciliation requires the dashboard read model'
      using errcode = '42P01';
  end if;
end;
$migration$;

alter table public.roles
  add column if not exists is_assignable boolean not null default false;

-- Free level 55 before adding the explicit House manager role. Existing users
-- keep their legacy role key and are not mapped to a new business role.
update public.roles
set level = 53
where key = 'manager'
  and level <> 53;

insert into public.roles (key, name, level, is_system, is_assignable) values
  ('pending',       'Pendente',        1,   true, false),
  ('manager_house', 'Gerente House',   55,  true, true),
  ('manager_imob',  'Gerente Imob',    54,  true, true),
  ('broker_house',  'Corretor House',  25,  true, true),
  ('broker_imob',   'Corretor Imob',   24,  true, true)
on conflict (key) do update
set name = excluded.name,
    level = excluded.level,
    is_system = excluded.is_system,
    is_assignable = excluded.is_assignable;

update public.roles
set is_assignable = case
  when key in (
    'admin',
    'coordinator',
    'manager_house',
    'manager_imob',
    'broker_house',
    'broker_imob'
  ) then true
  else false
end
where key in (
  'master',
  'admin',
  'coordinator',
  'manager_house',
  'manager_imob',
  'broker_house',
  'broker_imob',
  'manager',
  'supervisor',
  'house',
  'real_estate',
  'partnership_channel',
  'broker_lead',
  'broker',
  'user',
  'pending'
);

insert into public.permissions (key, description, min_level) values
  ('crm.dashboard.all.view', 'Visualizar a visao Geral do dashboard', 10),
  (
    'crm.dashboard.with_canal_imob.view',
    'Visualizar a visao do dashboard com Canal Imob',
    10
  ),
  (
    'crm.dashboard.without_canal_imob.view',
    'Visualizar a visao do dashboard sem Canal Imob',
    10
  ),
  (
    'crm.partnerships.view',
    'Visualizar o Canal de Parcerias quando concedido pelo papel',
    10
  )
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

-- One exact inherited baseline. User overrides remain audited and untouched.
delete from public.role_permissions
where role_key in (
  'admin',
  'coordinator',
  'manager_house',
  'manager_imob',
  'broker_house',
  'broker_imob',
  'manager',
  'supervisor',
  'house',
  'real_estate',
  'partnership_channel',
  'broker_lead',
  'broker',
  'user',
  'pending'
);

insert into public.role_permissions (role_key, permission_key)
select requested.role_key, requested.permission_key
from (
  values
    ('master', 'crm.dashboard.all.view'),
    ('master', 'crm.dashboard.with_canal_imob.view'),
    ('master', 'crm.dashboard.without_canal_imob.view'),
    ('master', 'crm.partnerships.view'),
    ('admin', 'users.view'),
    ('admin', 'users.manage'),
    ('admin', 'permissions.view'),
    ('admin', 'permissions.manage'),
    ('admin', 'roles.view'),
    ('admin', 'roles.manage'),
    ('admin', 'audit.view'),
    ('admin', 'admin.access'),
    ('admin', 'pages.view'),
    ('admin', 'pages.manage'),
    ('admin', 'crm.dashboard.view'),
    ('admin', 'crm.dashboard.all.view'),
    ('admin', 'crm.dashboard.with_canal_imob.view'),
    ('admin', 'crm.dashboard.without_canal_imob.view'),
    ('admin', 'crm.stages.view'),
    ('admin', 'crm.ranking.view'),
    ('admin', 'crm.partnerships.view'),
    ('admin', 'crm.settings.view'),
    ('admin', 'crm.settings.manage'),
    ('admin', 'crm.salesforce.refresh'),
    ('admin', 'crm.ingest.manage'),
    ('coordinator', 'pages.view'),
    ('coordinator', 'crm.dashboard.view'),
    ('coordinator', 'crm.dashboard.with_canal_imob.view'),
    ('coordinator', 'crm.stages.view'),
    ('coordinator', 'crm.partnerships.view'),
    ('manager_house', 'pages.view'),
    ('manager_house', 'crm.dashboard.view'),
    ('manager_house', 'crm.dashboard.without_canal_imob.view'),
    ('manager_house', 'crm.stages.view'),
    ('manager_house', 'crm.ranking.view'),
    ('manager_imob', 'pages.view'),
    ('manager_imob', 'crm.dashboard.view'),
    ('manager_imob', 'crm.dashboard.with_canal_imob.view'),
    ('manager_imob', 'crm.stages.view'),
    ('manager_imob', 'crm.partnerships.view'),
    ('broker_house', 'pages.view'),
    ('broker_house', 'crm.dashboard.view'),
    ('broker_house', 'crm.dashboard.without_canal_imob.view'),
    ('broker_house', 'crm.stages.view'),
    ('broker_house', 'crm.ranking.view'),
    ('broker_imob', 'pages.view'),
    ('broker_imob', 'crm.dashboard.view'),
    ('broker_imob', 'crm.dashboard.with_canal_imob.view'),
    ('broker_imob', 'crm.stages.view'),
    ('broker_imob', 'crm.partnerships.view')
) as requested(role_key, permission_key)
join public.permissions permission
  on permission.key = requested.permission_key
on conflict (role_key, permission_key) do nothing;

-- On legacy production, keep the existing profile shape and onboarding
-- behavior, but stop assigning the retired user role. Clean installs already
-- have the scoped pending/approval implementation and remain unchanged.
do $migration$
begin
  if not exists (
    select 1
    from information_schema.columns column_entry
    where column_entry.table_schema = 'public'
      and column_entry.table_name = 'profiles'
      and column_entry.column_name = 'access_status'
  ) then
    execute $function$
      create or replace function public.handle_new_auth_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      begin
        insert into public.profiles (user_id, email, is_active, profile_completed)
        values (new.id, new.email, true, false)
        on conflict (user_id) do nothing;

        insert into public.user_roles (user_id, role_key)
        values (new.id, 'pending')
        on conflict (user_id) do nothing;

        return new;
      end;
      $body$
    $function$;

    execute
      'revoke all privileges on function public.handle_new_auth_user() '
      || 'from public, anon, authenticated, service_role';
  end if;
end;
$migration$;

-- Scoped clean installs receive scope rules for the new roles. Legacy
-- production has no scope topology yet, so this block is deliberately skipped.
do $migration$
begin
  if to_regclass('public.crm_role_scope_types') is not null
     and to_regclass('public.crm_user_reporting_scope_grants') is not null
     and to_regclass('public.crm_reporting_scopes') is not null
     and to_regclass('public.crm_people') is not null then
    execute $sql$
      delete from public.crm_role_scope_types
      where role_key in (
        'manager',
        'supervisor',
        'house',
        'real_estate',
        'partnership_channel',
        'broker_lead',
        'broker',
        'user'
      )
    $sql$;

    execute $sql$
      insert into public.crm_role_scope_types (role_key, scope_type) values
        ('manager_house', 'team'),
        ('manager_imob', 'team'),
        ('broker_house', 'person'),
        ('broker_imob', 'person')
      on conflict do nothing
    $sql$;

    execute $function$
      create or replace function private.user_role_scope_is_valid(
        p_user_id uuid,
        p_role_key text
      )
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as $body$
        with active_grants as (
          select reporting_scope.*
          from public.crm_user_reporting_scope_grants scope_grant
          join public.crm_reporting_scopes reporting_scope
            on reporting_scope.id = scope_grant.reporting_scope_id
          where scope_grant.user_id = p_user_id
            and scope_grant.revoked_at is null
            and scope_grant.valid_from <= now()
            and (scope_grant.valid_until is null or scope_grant.valid_until > now())
            and reporting_scope.is_active
        ),
        validated_grants as (
          select
            active_grant.*,
            case active_grant.scope_type
              when 'global' then true
              when 'organization' then exists (
                select 1
                from public.crm_organizations organization
                where organization.id = active_grant.organization_id
                  and organization.is_active
              )
              when 'team' then exists (
                select 1
                from public.crm_teams team
                join public.crm_organizations organization
                  on organization.id = team.organization_id
                 and organization.is_active
                where team.id = active_grant.team_id
                  and team.is_active
              )
              when 'portfolio' then exists (
                select 1
                from public.crm_portfolios portfolio
                where portfolio.id = active_grant.portfolio_id
                  and portfolio.is_active
              )
              when 'person' then exists (
                select 1
                from public.crm_people person
                join public.crm_team_memberships membership
                  on membership.person_id = person.id
                 and membership.valid_from <= now()
                 and (membership.valid_until is null or membership.valid_until > now())
                join public.crm_teams team
                  on team.id = membership.team_id
                 and team.is_active
                join public.crm_organizations organization
                  on organization.id = team.organization_id
                 and organization.is_active
                where person.id = active_grant.person_id
                  and person.is_active
              )
              else false
            end as target_is_active
          from active_grants active_grant
        )
        select p_user_id is not null
          and p_role_key is not null
          and exists (
            select 1
            from public.roles role_entry
            where role_entry.key = p_role_key
              and (role_entry.is_assignable or role_entry.key = 'master')
          )
          and exists (select 1 from validated_grants)
          and not exists (
            select 1 from validated_grants where not target_is_active
          )
          and not exists (
            select 1
            from validated_grants active_grant
            where not exists (
              select 1
              from public.crm_role_scope_types allowed_scope
              where allowed_scope.role_key = p_role_key
                and allowed_scope.scope_type = active_grant.scope_type
            )
          )
          and (
            p_role_key not in (
              'manager_house',
              'manager_imob',
              'broker_house',
              'broker_imob'
            )
            or (select count(*) from validated_grants) = 1
          )
          and (
            p_role_key not in ('broker_house', 'broker_imob')
            or not exists (
              select 1
              from validated_grants active_grant
              left join public.crm_people person
                on person.id = active_grant.person_id
              where active_grant.scope_type <> 'person'
                or person.auth_user_id is distinct from p_user_id
            )
          );
      $body$
    $function$;

    execute
      'revoke all privileges on function private.user_role_scope_is_valid(uuid, text) '
      || 'from public, anon, authenticated, service_role';
  end if;
end;
$migration$;

create or replace function public.can_assign_role(
  actor_uuid uuid,
  target_role_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (
        select role_entry.is_assignable
          and role_entry.level < coalesce(public._internal_get_role_level(actor_uuid), 0)
        from public.roles role_entry
        where role_entry.key = target_role_key
      ),
      false
    );
$$;

alter function public.can_assign_role(uuid, text) owner to postgres;
revoke all privileges on function public.can_assign_role(uuid, text)
  from public, anon, authenticated, service_role;

drop policy if exists crm_dashboard_views_select_authorized
  on public.crm_dashboard_views;
create policy crm_dashboard_views_select_authorized
  on public.crm_dashboard_views for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
    and case view_key
      when 'all' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.all.view')
      )
      when 'with_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.with_canal_imob.view'
        )
      )
      when 'without_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.without_canal_imob.view'
        )
      )
      else false
    end
  );

drop policy if exists crm_dashboard_metrics_select_authorized
  on public.crm_dashboard_metrics;
create policy crm_dashboard_metrics_select_authorized
  on public.crm_dashboard_metrics for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
    and case view_key
      when 'all' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.all.view')
      )
      when 'with_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.with_canal_imob.view'
        )
      )
      when 'without_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.without_canal_imob.view'
        )
      )
      else false
    end
  );

drop policy if exists crm_dashboard_top_developments_select_authorized
  on public.crm_dashboard_top_developments;
create policy crm_dashboard_top_developments_select_authorized
  on public.crm_dashboard_top_developments for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
    and (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
    and case view_key
      when 'all' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.all.view')
      )
      when 'with_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.with_canal_imob.view'
        )
      )
      when 'without_canal_imob' then (
        select public.has_permission(
          (select auth.uid()),
          'crm.dashboard.without_canal_imob.view'
        )
      )
      else false
    end
  );

create or replace function public.set_user_permission_overrides_bulk(
  target_user_id uuid,
  permission_keys text[],
  effect text,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_target_is_active boolean;
  v_target_is_approved boolean;
  v_scope_allowed boolean := true;
  v_permission_count integer := coalesce(cardinality(permission_keys), 0);
  v_changed_count integer := 0;
  v_previous_effects jsonb := '{}'::jsonb;
  v_audit_id bigint;
begin
  if target_user_id is null
     or v_permission_count < 1
     or v_permission_count > 100
     or effect is null
     or effect not in ('allow', 'deny', 'inherit')
     or nullif(btrim(coalesce(reason, '')), '') is null
     or char_length(btrim(reason)) > 240 then
    raise exception 'invalid_argument: target, 1-100 permissions, effect and reason are required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(permission_keys) requested(permission_key)
    where requested.permission_key is null
       or nullif(btrim(requested.permission_key), '') is null
  ) or (
    select count(distinct requested.permission_key)
    from unnest(permission_keys) requested(permission_key)
  ) <> v_permission_count then
    raise exception 'invalid_argument: permissions must be nonempty and unique'
      using errcode = '22023';
  end if;

  if v_actor is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  perform 1
  from public.profiles profile
  where profile.user_id = v_actor
    and profile.is_active
  for update;

  if not found
     or not coalesce(
       public._internal_has_permission(v_actor, 'permissions.manage'),
       false
     ) then
    raise exception 'forbidden: actor cannot manage permission exceptions'
      using errcode = '42501';
  end if;

  v_actor_level := public._internal_get_role_level(v_actor);
  if v_actor_level is null then
    raise exception 'forbidden: actor has no active role'
      using errcode = '42501';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if to_regprocedure('private.can_manage_user(uuid)') is not null then
    execute 'select private.can_manage_user($1)'
      into v_scope_allowed
      using target_user_id;
  end if;

  if not coalesce(v_scope_allowed, false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  select profile.is_active
  into v_target_is_active
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if to_regprocedure('private.can_manage_user(uuid)') is not null then
    execute 'select private.can_manage_user($1)'
      into v_scope_allowed
      using target_user_id;
  end if;

  if not coalesce(v_scope_allowed, false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  if not found or not v_target_is_active then
    raise exception 'conflict: permission exceptions require an active target'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from information_schema.columns column_entry
    where column_entry.table_schema = 'public'
      and column_entry.table_name = 'profiles'
      and column_entry.column_name = 'access_status'
  ) then
    execute
      'select profile.access_status = ''approved'' '
      || 'from public.profiles profile where profile.user_id = $1'
      into v_target_is_approved
      using target_user_id;

    if not coalesce(v_target_is_approved, false) then
      raise exception 'conflict: permission exceptions require an approved target'
        using errcode = '23505';
    end if;
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.permissions permission
    where permission.key = any(permission_keys)
  ) <> v_permission_count then
    raise exception 'invalid_argument: unknown permission'
      using errcode = '22023';
  end if;

  perform permission.key
  from public.permissions permission
  where permission.key = any(permission_keys)
  order by permission.key
  for update;

  if exists (
    select 1
    from unnest(permission_keys) requested(permission_key)
    where not public.can_grant_permission(v_actor, requested.permission_key)
  ) then
    raise exception 'forbidden: actor cannot manage every requested permission'
      using errcode = '42501';
  end if;

  perform permission_override.permission_key
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = any(permission_keys)
  order by permission_override.permission_key
  for update;

  select coalesce(
    jsonb_object_agg(
      permission_override.permission_key,
      permission_override.effect
      order by permission_override.permission_key
    ),
    '{}'::jsonb
  )
  into v_previous_effects
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = any(permission_keys);

  if effect = 'inherit' then
    delete from public.user_permission_overrides permission_override
    where permission_override.user_id = target_user_id
      and permission_override.permission_key = any(permission_keys);
    get diagnostics v_changed_count = row_count;
  else
    insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    )
    select
      target_user_id,
      requested.permission_key,
      effect,
      btrim(reason),
      v_actor
    from unnest(permission_keys) requested(permission_key)
    order by requested.permission_key
    on conflict (user_id, permission_key) do update
    set effect = excluded.effect,
        reason = excluded.reason,
        granted_by = excluded.granted_by;
    get diagnostics v_changed_count = row_count;
  end if;

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after
  ) values (
    v_actor,
    target_user_id,
    'authorization.permission_overrides_bulk_set',
    jsonb_build_object(
      'permission_keys', to_jsonb(permission_keys),
      'effects', v_previous_effects,
      'reason', btrim(reason)
    ),
    jsonb_build_object(
      'effect', effect,
      'changed_count', v_changed_count
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', v_audit_id,
    'effect', effect,
    'changed_count', v_changed_count
  );
end;
$$;

alter function public.set_user_permission_overrides_bulk(uuid, text[], text, text)
  owner to postgres;
revoke all privileges on function public.set_user_permission_overrides_bulk(uuid, text[], text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_user_permission_overrides_bulk(uuid, text[], text, text)
  to authenticated;

comment on function public.set_user_permission_overrides_bulk(uuid, text[], text, text) is
  'Atomically sets or restores 1-100 user permission exceptions with hierarchy, scope and audit enforcement.';

do $migration$
begin
  if exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.role_key in (
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
  ) then
    raise exception 'retired or pending role retained inherited permissions'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.roles role_entry
    where role_entry.key in (
      'master',
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
      and role_entry.is_assignable
  ) then
    raise exception 'non-assignable role was left assignable'
      using errcode = '23514';
  end if;
end;
$migration$;

commit;
