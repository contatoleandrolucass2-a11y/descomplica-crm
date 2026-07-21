-- Milestone 5.5.1 — Patch: fix ambiguous `permission_key` in
-- remove_user_permission_override
--
-- Bug found during M5.5 verification: the DELETE statement inside
-- public.remove_user_permission_override referenced the bare identifier
-- `permission_key`, which is ambiguous between the PL/pgSQL parameter and the
-- user_permission_overrides column. Postgres raised
--   ERROR: column reference "permission_key" is ambiguous
-- on every real removal (the no-op path returned earlier and was unaffected),
-- so removing an existing override was broken in runtime.
--
-- The sibling function set_user_permission_override already avoided this via
-- `#variable_conflict use_column`. Here we fix it surgically by aliasing the
-- target table in the DELETE and qualifying every reference (column via the
-- alias, parameters via the function name). No other logic is changed.
--
-- This migration ONLY does `create or replace` on the existing function and
-- reaffirms its ACL. It does not alter any prior migration, does not touch
-- set_user_permission_override, and does not rename the function.

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

  -- FIX: alias the target table and fully-qualify both sides so the bare
  -- `permission_key` is no longer ambiguous between column and parameter.
  delete from public.user_permission_overrides as upo
    where upo.user_id = remove_user_permission_override.target_user_id
      and upo.permission_key = remove_user_permission_override.permission_key;

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

-- Reaffirm ACL: never anon; authenticated calls through the SECURITY DEFINER
-- wall. Matches the grants established in M5.2.
revoke execute on function public.remove_user_permission_override(uuid, text, text) from public;
revoke execute on function public.remove_user_permission_override(uuid, text, text) from anon;
grant  execute on function public.remove_user_permission_override(uuid, text, text) to authenticated;
