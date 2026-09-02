-- Permit multiple independently authenticated Master identities while keeping
-- Master elevation outside every browser, Data API and service-role path.
-- The only supported mutation boundary remains this versioned, postgres-owned
-- bootstrap function, invoked by the audited root-only production runbook.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $migration$
declare
  v_scope_contract_count integer;
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.roles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.audit_logs') is null
     or to_regprocedure('public.can_assign_role(uuid,text)') is null
     or to_regprocedure('public.bootstrap_master_user(uuid)') is null then
    raise exception 'multi-Master migration requires the access-control foundation'
      using errcode = '42P01';
  end if;

  select
    (case when to_regclass('public.crm_reporting_scopes') is not null then 1 else 0 end)
    + (case when to_regclass('public.crm_user_reporting_scope_grants') is not null then 1 else 0 end)
    + (case when to_regprocedure('private.user_role_scope_is_valid(uuid,text)') is not null then 1 else 0 end)
    + (case when exists (
        select 1
        from information_schema.columns column_entry
        where column_entry.table_schema = 'public'
          and column_entry.table_name = 'profiles'
          and column_entry.column_name = 'access_status'
      ) then 1 else 0 end)
  into v_scope_contract_count;

  if v_scope_contract_count not in (0, 4) then
    raise exception 'multi-Master migration found an incomplete reporting-scope contract'
      using errcode = '55000';
  end if;
end;
$migration$;

-- The old partial unique index encoded the former break-glass-only policy.
-- Replace it with a non-unique lookup index so every Master remains a primary
-- role row and role-based authorization queries stay indexed.
drop index if exists public.user_roles_single_master_unique;

create index if not exists user_roles_role_key_idx
  on public.user_roles (role_key);

-- No authenticated actor, including an existing Master, may grant Master via
-- assign_user_role. Strictly lower roles remain governed by the existing
-- hierarchy and roles.manage permission.
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
    and coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (select role_entry.level from public.roles role_entry where role_entry.key = target_role_key),
      2147483647
    ) < coalesce(public._internal_get_role_level(actor_uuid), 0);
$$;

alter function public.can_assign_role(uuid, text) owner to postgres;
revoke all privileges on function public.can_assign_role(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.bootstrap_master_user(master_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_role text;
  v_existing_complete boolean := false;
  v_has_scoped_contract boolean := false;
  v_global_scope uuid;
  v_audit_id bigint;
  v_change_ref text := nullif(
    current_setting('app.master_provisioning_change', true),
    ''
  );
  v_source_revision text := nullif(
    current_setting('app.master_provisioning_revision', true),
    ''
  );
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.bootstrap_master_user', 0)
  );

  if master_user_id is null then
    raise exception 'invalid_argument: master_user_id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = master_user_id
  ) then
    raise exception 'not_found: master user does not exist in auth.users'
      using errcode = 'P0002';
  end if;

  select user_role.role_key
  into v_existing_role
  from public.user_roles user_role
  where user_role.user_id = master_user_id
  for update;

  v_has_scoped_contract :=
    to_regclass('public.crm_reporting_scopes') is not null
    and to_regclass('public.crm_user_reporting_scope_grants') is not null
    and to_regprocedure('private.user_role_scope_is_valid(uuid,text)') is not null
    and exists (
      select 1
      from information_schema.columns column_entry
      where column_entry.table_schema = 'public'
        and column_entry.table_name = 'profiles'
        and column_entry.column_name = 'access_status'
    );

  if v_has_scoped_contract then
    select reporting_scope.id
    into v_global_scope
    from public.crm_reporting_scopes reporting_scope
    where reporting_scope.scope_key = 'global'
      and reporting_scope.scope_type = 'global'
      and reporting_scope.is_active;

    if v_global_scope is null then
      raise exception 'conflict: active global reporting scope does not exist'
        using errcode = '23505';
    end if;

    select
      v_existing_role = 'master'
      and exists (
        select 1
        from public.profiles profile
        where profile.user_id = master_user_id
          and profile.is_active
          and profile.access_status = 'approved'
      )
      and exists (
        select 1
        from public.crm_user_reporting_scope_grants scope_grant
        where scope_grant.user_id = master_user_id
          and scope_grant.reporting_scope_id = v_global_scope
          and scope_grant.revoked_at is null
          and scope_grant.valid_from <= now()
          and (scope_grant.valid_until is null or scope_grant.valid_until > now())
      )
      and private.user_role_scope_is_valid(master_user_id, 'master')
    into v_existing_complete;
  else
    select
      v_existing_role = 'master'
      and exists (
        select 1
        from public.profiles profile
        where profile.user_id = master_user_id
          and profile.is_active
      )
    into v_existing_complete;
  end if;

  if v_existing_complete then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  if v_has_scoped_contract then
    insert into public.profiles (
      user_id,
      is_active,
      access_status
    ) values (
      master_user_id,
      false,
      'pending'
    )
    on conflict (user_id) do nothing;

    update public.crm_user_reporting_scope_grants scope_grant
    set revoked_at = now(),
        revoked_by = master_user_id,
        revocation_reason = 'Removed incompatible scope during source-controlled Master bootstrap'
    from public.crm_reporting_scopes reporting_scope
    where reporting_scope.id = scope_grant.reporting_scope_id
      and scope_grant.user_id = master_user_id
      and reporting_scope.scope_type <> 'global'
      and scope_grant.revoked_at is null
      and (scope_grant.valid_until is null or scope_grant.valid_until > now());

    insert into public.crm_user_reporting_scope_grants (
      user_id,
      reporting_scope_id,
      granted_by,
      reason
    ) values (
      master_user_id,
      v_global_scope,
      master_user_id,
      'Source-controlled Master bootstrap global scope'
    )
    on conflict (user_id, reporting_scope_id)
      where valid_until is null and revoked_at is null
    do nothing;

    insert into public.user_roles (user_id, role_key, assigned_by)
    values (master_user_id, 'master', master_user_id)
    on conflict (user_id) do update
    set role_key = excluded.role_key,
        assigned_by = excluded.assigned_by,
        updated_at = now();

    update public.profiles profile
    set is_active = true,
        access_status = 'approved',
        approved_at = coalesce(profile.approved_at, now()),
        approved_by = master_user_id
    where profile.user_id = master_user_id;

    if not private.user_role_scope_is_valid(master_user_id, 'master') then
      raise exception 'conflict: Master bootstrap requires an active global scope'
        using errcode = '23505';
    end if;
  else
    insert into public.profiles (user_id, is_active)
    values (master_user_id, true)
    on conflict (user_id) do update
    set is_active = true,
        updated_at = now();

    insert into public.user_roles (user_id, role_key, assigned_by)
    values (master_user_id, 'master', master_user_id)
    on conflict (user_id) do update
    set role_key = excluded.role_key,
        assigned_by = excluded.assigned_by,
        updated_at = now();
  end if;

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after
  ) values (
    master_user_id,
    master_user_id,
    'authorization.master_bootstrap',
    jsonb_build_object(
      'previous_role_key', v_existing_role,
      'source', 'source_controlled'
    ),
    jsonb_build_object(
      'role_key', 'master',
      'level', 100,
      'source', 'source_controlled',
      'change_ref', v_change_ref,
      'source_revision', v_source_revision
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id, 'noop', false);
end;
$$;

alter function public.bootstrap_master_user(uuid) owner to postgres;
revoke all privileges on function public.bootstrap_master_user(uuid)
  from public, anon, authenticated, service_role;

-- Role rows are read through RLS and changed through guarded functions. Direct
-- Data API writes are unnecessary and would create a second elevation path.
revoke insert, update, delete, truncate on table public.user_roles
  from anon, authenticated, service_role;

do $migration$
begin
  if exists (
    select 1
    from pg_catalog.pg_index index_entry
    where index_entry.indrelid = 'public.user_roles'::regclass
      and index_entry.indisunique
      and pg_catalog.pg_get_expr(index_entry.indpred, index_entry.indrelid) ilike '%master%'
  ) then
    raise exception 'a unique Master index still prevents multiple identities'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes index_entry
    where index_entry.schemaname = 'public'
      and index_entry.tablename = 'user_roles'
      and index_entry.indexname = 'user_roles_role_key_idx'
  ) then
    raise exception 'the non-unique role lookup index is missing'
      using errcode = '42P01';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_entry.pronamespace
    where namespace.nspname = 'public'
      and function_entry.oid = 'public.bootstrap_master_user(uuid)'::regprocedure
      and function_entry.prosecdef
      and pg_catalog.pg_get_userbyid(function_entry.proowner) = 'postgres'
      and function_entry.proconfig = array['search_path=""']::text[]
  ) then
    raise exception 'Master bootstrap security attributes are invalid'
      using errcode = '42501';
  end if;

  if pg_catalog.has_function_privilege(
       'anon', 'public.bootstrap_master_user(uuid)', 'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated', 'public.bootstrap_master_user(uuid)', 'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'service_role', 'public.bootstrap_master_user(uuid)', 'EXECUTE'
     ) then
    raise exception 'Master bootstrap is reachable outside its owner-only boundary'
      using errcode = '42501';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.user_roles', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.user_roles', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('service_role', 'public.user_roles', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'a Data API role retains direct role mutation privileges'
      using errcode = '42501';
  end if;
end;
$migration$;

comment on function public.bootstrap_master_user(uuid) is
  'Source-controlled, postgres-owner-only and audited provisioning for multiple Master identities.';

reset lock_timeout;
reset statement_timeout;
