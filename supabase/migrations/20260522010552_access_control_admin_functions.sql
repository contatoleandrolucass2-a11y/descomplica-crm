-- Milestone 5.2 — Access Control Admin Functions
-- SECURITY DEFINER write functions over the M5.1 schema. Every mutation
-- enforces actor authentication, actor activation, anti-self-modification,
-- target-hierarchy guard (actor_level > target_current_level), permission
-- guard (delegated to M5.1 can_assign_role / can_grant_permission), and
-- appends a row to public.audit_logs atomically.
--
-- Grants:
--   * assign_user_role, set_user_permission_override,
--     remove_user_permission_override -> authenticated (callable by client
--     through the SECURITY DEFINER wall).
--   * bootstrap_master_user -> NOT granted to authenticated; reachable only
--     by service_role / postgres for one-shot server-side bootstrap.

-- ============================================================================
-- _internal_assert_actor_active
--
-- Centralised actor pre-check used by every admin function below.
-- Returns the actor's role level on success. Raises on any disqualifier.
-- ============================================================================
create or replace function public._internal_assert_actor_active(actor_uuid uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level  integer;
  v_active boolean;
begin
  if actor_uuid is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  v_level := public._internal_get_role_level(actor_uuid);

  if v_level is null then
    raise exception 'unauthorized: actor has no role'
      using errcode = '28000';
  end if;

  -- profiles row may legitimately be absent in M5.2; only an explicit
  -- is_active = false blocks. A null/missing row is treated as active.
  select p.is_active
    into v_active
    from public.profiles p
    where p.user_id = actor_uuid;

  if v_active is false then
    raise exception 'forbidden: actor is inactive'
      using errcode = '42501';
  end if;

  return v_level;
end;
$$;

revoke execute on function public._internal_assert_actor_active(uuid) from public;

-- ============================================================================
-- assign_user_role(target_user_id, target_role_key, reason)
--
-- Upserts the target user's primary role. Hierarchy guards:
--   * actor must be authenticated, active, and have a role
--   * target cannot equal actor (no self-modification)
--   * target's current level (if any) must be strictly below actor level
--   * new role level must be strictly below actor level
--     (delegated to public.can_assign_role, which also requires roles.manage)
-- ============================================================================
create or replace function public.assign_user_role(
  target_user_id  uuid,
  target_role_key text,
  reason          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_level  integer;
  v_target_level integer;
  v_target_role  text;
  v_new_level    integer;
  v_audit_id     bigint;
  v_before       jsonb;
  v_after        jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if target_role_key is null then
    raise exception 'invalid_argument: target_role_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  select r.level
    into v_new_level
    from public.roles r
    where r.key = target_role_key;

  if v_new_level is null then
    raise exception 'invalid_argument: unknown role %', target_role_key
      using errcode = '22023';
  end if;

  -- Lock the target's existing user_roles row (if any) for the txn.
  select ur.role_key, r.level
    into v_target_role, v_target_level
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    where ur.user_id = target_user_id
    for update;

  -- Target hierarchy guard.
  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  -- New-role hierarchy + permission guard (delegated).
  if not public.can_assign_role(v_actor, target_role_key) then
    raise exception
      'forbidden: actor cannot assign role % (level %)',
      target_role_key, v_new_level
      using errcode = '42501';
  end if;

  v_before := case
    when v_target_role is null then null::jsonb
    else jsonb_build_object('role_key', v_target_role, 'level', v_target_level)
  end;
  v_after := jsonb_build_object('role_key', target_role_key, 'level', v_new_level);

  insert into public.user_roles (user_id, role_key, assigned_by)
    values (target_user_id, target_role_key, v_actor)
    on conflict (user_id) do update
      set role_key    = excluded.role_key,
          assigned_by = excluded.assigned_by,
          updated_at  = now();

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.role_assigned',
      jsonb_build_object('previous', v_before, 'reason', reason),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

-- ============================================================================
-- set_user_permission_override(target_user_id, permission_key, effect, reason)
--
-- Inserts or updates a per-user allow/deny override. Hierarchy guards mirror
-- assign_user_role; permission guard delegates to public.can_grant_permission.
-- ============================================================================
create or replace function public.set_user_permission_override(
  target_user_id uuid,
  permission_key text,
  effect         text,
  reason         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
-- plpgsql: prefer column references when identifiers clash with parameter
-- names (e.g. permission_key, effect, reason match columns of
-- user_permission_overrides). Parameters are still reachable via the
-- function-qualified name (set_user_permission_override.permission_key).
#variable_conflict use_column
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
  v_before           jsonb;
  v_after            jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  if set_user_permission_override.effect is null
     or set_user_permission_override.effect not in ('allow', 'deny') then
    raise exception 'invalid_argument: effect must be allow or deny'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = set_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      set_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  -- Lock existing override row (if any).
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = set_user_permission_override.permission_key
    for update;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, set_user_permission_override.permission_key) then
    raise exception 'forbidden: actor cannot grant permission %',
      set_user_permission_override.permission_key
      using errcode = '42501';
  end if;

  v_before := case
    when v_previous_effect is null then null::jsonb
    else jsonb_build_object('effect', v_previous_effect)
  end;
  v_after := jsonb_build_object('effect', set_user_permission_override.effect);

  insert into public.user_permission_overrides
    (user_id, permission_key, effect, reason, granted_by)
    values (
      target_user_id,
      set_user_permission_override.permission_key,
      set_user_permission_override.effect,
      set_user_permission_override.reason,
      v_actor
    )
    on conflict (user_id, permission_key) do update
      set effect     = excluded.effect,
          reason     = excluded.reason,
          granted_by = excluded.granted_by;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_set',
      jsonb_build_object(
        'permission_key', set_user_permission_override.permission_key,
        'previous',       v_before,
        'reason',         set_user_permission_override.reason
      ),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

-- ============================================================================
-- remove_user_permission_override(target_user_id, permission_key, reason)
--
-- Removes a per-user override. Idempotent: if no override exists, returns
-- ok=true with audit_id=null WITHOUT auditing — but only AFTER every guard
-- (actor, target, hierarchy, can_grant_permission) has been validated.
-- ============================================================================
create or replace function public.remove_user_permission_override(
  target_user_id uuid,
  permission_key text,
  reason         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = remove_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      remove_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, permission_key) then
    raise exception 'forbidden: actor cannot manage permission %',
      permission_key
      using errcode = '42501';
  end if;

  -- All guards passed. Now check whether there is anything to remove.
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = remove_user_permission_override.permission_key
    for update;

  if v_previous_effect is null then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  delete from public.user_permission_overrides
    where user_id = target_user_id
      and permission_key = remove_user_permission_override.permission_key;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_removed',
      jsonb_build_object(
        'permission_key', permission_key,
        'effect',         v_previous_effect,
        'reason',         reason
      ),
      null
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

-- ============================================================================
-- bootstrap_master_user(master_user_id)
--
-- One-shot server-side bootstrap. The intended caller is a controlled runbook
-- that reads MASTER_USER_ID from server-side env and calls this via the
-- service_role connection. The function:
--   * is NEVER granted to authenticated
--   * refuses to silently rotate the master — if a DIFFERENT master row
--     already exists, raises a conflict
--   * is idempotent for the same master_user_id (no audit row on re-run)
-- ============================================================================
create or replace function public.bootstrap_master_user(master_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_master uuid;
  v_existing_role   text;
  v_audit_id        bigint;
begin
  if master_user_id is null then
    raise exception 'invalid_argument: master_user_id is required'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = master_user_id) then
    raise exception 'not_found: master user does not exist in auth.users'
      using errcode = 'P0002';
  end if;

  -- Hold a lock against any existing master row throughout the txn.
  select ur.user_id
    into v_existing_master
    from public.user_roles ur
    where ur.role_key = 'master'
    for update;

  if v_existing_master is not null
     and v_existing_master <> bootstrap_master_user.master_user_id then
    raise exception 'conflict: a different master user already exists'
      using errcode = '23505';
  end if;

  -- Already the master — idempotent no-op.
  if v_existing_master = bootstrap_master_user.master_user_id then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  -- Lock the target's existing role row (if any).
  select ur.role_key
    into v_existing_role
    from public.user_roles ur
    where ur.user_id = bootstrap_master_user.master_user_id
    for update;

  -- Ensure a minimal profile row exists.
  insert into public.profiles (user_id, is_active)
    values (bootstrap_master_user.master_user_id, true)
    on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_key, assigned_by)
    values (bootstrap_master_user.master_user_id, 'master',
            bootstrap_master_user.master_user_id)
    on conflict (user_id) do update
      set role_key    = 'master',
          assigned_by = excluded.assigned_by,
          updated_at  = now();

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      bootstrap_master_user.master_user_id,
      bootstrap_master_user.master_user_id,
      'authorization.master_bootstrap',
      case
        when v_existing_role is null then null::jsonb
        else jsonb_build_object('role_key', v_existing_role)
      end,
      jsonb_build_object('role_key', 'master', 'level', 100)
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;

-- ============================================================================
-- Grants
-- ============================================================================
revoke execute on function public.assign_user_role(uuid, text, text)                    from public;
revoke execute on function public.set_user_permission_override(uuid, text, text, text)  from public;
revoke execute on function public.remove_user_permission_override(uuid, text, text)     from public;
revoke execute on function public.bootstrap_master_user(uuid)                           from public;

grant execute on function public.assign_user_role(uuid, text, text)                    to authenticated;
grant execute on function public.set_user_permission_override(uuid, text, text, text)  to authenticated;
grant execute on function public.remove_user_permission_override(uuid, text, text)     to authenticated;

-- bootstrap_master_user: intentionally NOT granted to authenticated.
-- Reachable only by service_role / postgres for controlled one-shot bootstrap.

-- ============================================================================
-- Defense-in-depth: Supabase configures default privileges so that the anon,
-- authenticated and service_role roles each receive EXECUTE on every new
-- function in the public schema. REVOKE FROM PUBLIC (which only undoes the
-- catch-all pseudo-role) is therefore NOT enough to hide privileged helpers
-- from JWT-authenticated callers. The next four REVOKEs explicitly close
-- the door for anon and authenticated against:
--   * _internal_*  helpers (M5.1 introduced; the wrappers must remain the
--     only public path because they enforce the self/users.view guard);
--   * _internal_assert_actor_active (this migration);
--   * bootstrap_master_user (server-side bootstrap only).
-- service_role keeps EXECUTE on bootstrap_master_user by design.
-- ============================================================================
revoke execute on function public._internal_get_role_level(uuid)        from anon, authenticated;
revoke execute on function public._internal_has_permission(uuid, text)  from anon, authenticated;
revoke execute on function public._internal_assert_actor_active(uuid)   from anon, authenticated;
revoke execute on function public.bootstrap_master_user(uuid)           from anon, authenticated;
