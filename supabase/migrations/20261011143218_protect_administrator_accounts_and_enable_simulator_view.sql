-- Make Administrator an explicitly protected account class while granting the
-- CRM simulator UI permission requested for that role. Official simulator
-- execution and commercial policy controls remain exclusive to Master.

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
     or to_regprocedure('public._internal_get_role_level(uuid)') is null
     or to_regprocedure('public._internal_has_permission(uuid,text)') is null
     or to_regprocedure('public.can_assign_role(uuid,text)') is null then
    raise exception 'Administrator protection requires the access-control foundation'
      using errcode = '42P01';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_entry
    where column_entry.table_schema = 'public'
      and column_entry.table_name = 'roles'
      and column_entry.column_name = 'is_assignable'
  ) then
    raise exception 'Administrator protection requires the assignable-role contract'
      using errcode = '42703';
  end if;

  if not exists (
    select 1 from public.roles role_entry where role_entry.key = 'master'
  ) or not exists (
    select 1 from public.roles role_entry where role_entry.key = 'admin'
  ) or (
    select count(*)
    from public.permissions permission
    where permission.key in ('crm.simulators.view', 'crm.simulators.execute')
  ) <> 2 then
    raise exception 'Administrator protection requires Master/Admin and simulator permissions'
      using errcode = '23514';
  end if;
end;
$migration$;

update public.permissions
set description =
  'Acessar interfaces de simulacao autorizadas; a execucao oficial possui controle separado',
    min_level = 100
where key = 'crm.simulators.view';

insert into public.role_permissions (role_key, permission_key)
values ('admin', 'crm.simulators.view')
on conflict (role_key, permission_key) do nothing;

-- An Administrator can use every operational CRM surface, but permissions
-- that represent the Master control plane must never become effective through
-- a stale or future individual allow override. Keep unrelated roles and deny
-- overrides untouched.
delete from public.role_permissions
where role_key = 'admin'
  and permission_key in (
    'crm.simulators.execute',
    'crm.commercial_engine.execute',
    'crm.commercial_policy.manage'
  );

delete from public.user_permission_overrides permission_override
using public.user_roles target_role
where target_role.user_id = permission_override.user_id
  and target_role.role_key = 'admin'
  and permission_override.effect = 'allow'
  and permission_override.permission_key in (
    'crm.simulators.execute',
    'crm.commercial_engine.execute',
    'crm.commercial_policy.manage'
  );

-- Role assignment remains callable only from trusted database code. The
-- explicit role-key check is independent of numeric levels, so raising the
-- Administrator level later cannot silently permit peer promotion.
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
    target_role_key <> 'master'
    and (
      target_role_key <> 'admin'
      or exists (
        select 1
        from public.user_roles actor_role
        where actor_role.user_id = actor_uuid
          and actor_role.role_key = 'master'
      )
    )
    and coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (
        select role_entry.is_assignable
          and role_entry.level < coalesce(
            public._internal_get_role_level(actor_uuid),
            0
          )
        from public.roles role_entry
        where role_entry.key = target_role_key
      ),
      false
    );
$$;

alter function public.can_assign_role(uuid, text) owner to postgres;
revoke all privileges on function public.can_assign_role(uuid, text)
  from public, anon, authenticated, service_role;

comment on function public.can_assign_role(uuid, text) is
  'Internal role-assignment guard: only Master may assign Administrator; Master itself is never assignable.';

-- Production currently uses the compact profile contract while clean installs
-- also have scoped onboarding. Reuse the stricter scoped predicate when it is
-- present; otherwise require an active Master role from the production model.
create or replace function private.current_actor_is_master_for_administrator_boundary()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_master boolean := false;
begin
  if v_actor is null then
    return false;
  end if;

  if to_regprocedure('private.current_user_is_master()') is not null then
    execute 'select private.current_user_is_master()'
    into v_is_master;
    return coalesce(v_is_master, false);
  end if;

  return exists (
    select 1
    from public.user_roles user_role
    join public.profiles profile on profile.user_id = user_role.user_id
    where user_role.user_id = v_actor
      and user_role.role_key = 'master'
      and profile.is_active
  );
end;
$$;

alter function private.current_actor_is_master_for_administrator_boundary() owner to postgres;
revoke all privileges
  on function private.current_actor_is_master_for_administrator_boundary()
  from public, anon, authenticated, service_role;

-- RPC checks and RLS remain in place, but this trigger is the final mutation
-- boundary. It also protects against a future SECURITY DEFINER regression or
-- direct SQL issued with an authenticated JWT. Versioned postgres migrations
-- and the audited bootstrap path have no auth.uid() and remain available.
create or replace function private.enforce_administrator_account_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_is_master boolean := false;
  v_old_target_role text;
  v_new_target_role text;
begin
  if v_actor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_actor_is_master := coalesce(
    private.current_actor_is_master_for_administrator_boundary(),
    false
  );

  if tg_table_name = 'user_roles' then
    if tg_op <> 'INSERT' then
      v_old_target_role := old.role_key;
    end if;
    if tg_op <> 'DELETE' then
      v_new_target_role := new.role_key;
    end if;
  else
    if tg_op <> 'INSERT' then
      select user_role.role_key
      into v_old_target_role
      from public.user_roles user_role
      where user_role.user_id = old.user_id;
    end if;

    if tg_op <> 'DELETE' then
      select user_role.role_key
      into v_new_target_role
      from public.user_roles user_role
      where user_role.user_id = new.user_id;
    end if;
  end if;

  if tg_table_name = 'user_permission_overrides' and tg_op <> 'DELETE' then
    if v_new_target_role = 'admin'
       and new.effect = 'allow'
       and new.permission_key in (
         'crm.simulators.execute',
         'crm.commercial_engine.execute',
         'crm.commercial_policy.manage'
       ) then
      raise exception 'forbidden: Administrator cannot receive Master-only permissions'
        using errcode = '42501';
    end if;
  end if;

  if 'master' in (v_old_target_role, v_new_target_role) then
    raise exception 'forbidden: Master accounts are immutable through authenticated account management'
      using errcode = '42501';
  end if;

  if not v_actor_is_master
     and 'admin' in (v_old_target_role, v_new_target_role) then
    raise exception 'forbidden: only Master may manage Administrator accounts'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function private.enforce_administrator_account_boundary() owner to postgres;
revoke all privileges on function private.enforce_administrator_account_boundary()
  from public, anon, authenticated, service_role;

drop trigger if exists administrator_account_boundary_roles on public.user_roles;
create trigger administrator_account_boundary_roles
  before insert or update or delete on public.user_roles
  for each row execute function private.enforce_administrator_account_boundary();

drop trigger if exists administrator_account_boundary_profiles on public.profiles;
drop trigger if exists administrator_account_boundary_permission_overrides
  on public.user_permission_overrides;
create trigger administrator_account_boundary_permission_overrides
  before insert or update or delete on public.user_permission_overrides
  for each row execute function private.enforce_administrator_account_boundary();

do $migration$
begin
  if exists (
    select 1
    from information_schema.columns column_entry
    where column_entry.table_schema = 'public'
      and column_entry.table_name = 'profiles'
      and column_entry.column_name = 'access_status'
  ) then
    execute $trigger$
      create trigger administrator_account_boundary_profiles
        before update of is_active, access_status on public.profiles
        for each row execute function private.enforce_administrator_account_boundary()
    $trigger$;
  else
    execute $trigger$
      create trigger administrator_account_boundary_profiles
        before update of is_active on public.profiles
        for each row execute function private.enforce_administrator_account_boundary()
    $trigger$;
  end if;

  if to_regclass('public.crm_user_reporting_scope_grants') is not null then
    execute 'drop trigger if exists administrator_account_boundary_reporting_scopes '
      || 'on public.crm_user_reporting_scope_grants';
    execute $trigger$
      create trigger administrator_account_boundary_reporting_scopes
        before insert or update or delete on public.crm_user_reporting_scope_grants
        for each row execute function private.enforce_administrator_account_boundary()
    $trigger$;
  end if;
end;
$migration$;

do $migration$
declare
  v_expected_trigger_count integer := 3 + case
    when to_regclass('public.crm_user_reporting_scope_grants') is null then 0
    else 1
  end;
begin
  if not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.role_key = 'admin'
      and role_permission.permission_key = 'crm.simulators.view'
  ) then
    raise exception 'Administrator did not inherit simulator view access'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.role_permissions role_permission
    where (
      role_permission.permission_key = 'crm.simulators.execute'
      and role_permission.role_key <> 'master'
    ) or (
      role_permission.role_key = 'admin'
      and role_permission.permission_key in (
        'crm.commercial_engine.execute',
        'crm.commercial_policy.manage'
      )
    )
  ) then
    raise exception 'a Master-only permission escaped the Administrator boundary'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides permission_override
    join public.user_roles target_role
      on target_role.user_id = permission_override.user_id
    where target_role.role_key = 'admin'
      and permission_override.effect = 'allow'
      and permission_override.permission_key in (
        'crm.simulators.execute',
        'crm.commercial_engine.execute',
        'crm.commercial_policy.manage'
      )
  ) then
    raise exception 'Administrator retained a Master-only permission override'
      using errcode = '23514';
  end if;

  if (
    select array_agg(role_permission.role_key order by role_permission.role_key)
    from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.simulators.view'
  ) is distinct from array['admin', 'master']::text[] then
    raise exception 'simulator view access must be inherited only by Administrator and Master'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger trigger_entry
    join pg_catalog.pg_class table_entry on table_entry.oid = trigger_entry.tgrelid
    join pg_catalog.pg_namespace schema_entry on schema_entry.oid = table_entry.relnamespace
    where schema_entry.nspname = 'public'
      and trigger_entry.tgname in (
        'administrator_account_boundary_roles',
        'administrator_account_boundary_profiles',
        'administrator_account_boundary_permission_overrides',
        'administrator_account_boundary_reporting_scopes'
      )
      and not trigger_entry.tgisinternal
      and trigger_entry.tgenabled <> 'D'
  ) <> v_expected_trigger_count then
    raise exception 'Administrator account boundary triggers are incomplete'
      using errcode = '23514';
  end if;

  if has_function_privilege(
    'anon',
    'private.enforce_administrator_account_boundary()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.enforce_administrator_account_boundary()',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'private.enforce_administrator_account_boundary()',
    'EXECUTE'
  ) then
    raise exception 'Administrator boundary trigger function is callable from the Data API'
      using errcode = '42501';
  end if;

  if has_function_privilege(
    'anon',
    'private.current_actor_is_master_for_administrator_boundary()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.current_actor_is_master_for_administrator_boundary()',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'private.current_actor_is_master_for_administrator_boundary()',
    'EXECUTE'
  ) then
    raise exception 'Administrator boundary role helper is callable from the Data API'
      using errcode = '42501';
  end if;
end;
$migration$;

commit;
