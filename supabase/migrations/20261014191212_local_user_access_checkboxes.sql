-- Extend the integrated mixed-access draft RPC with guarded role-default
-- restoration and its read-only catalog. The 20261012113000 migration remains
-- authoritative for apply_user_permission_access_draft.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
begin
  if to_regprocedure(
    'public.apply_user_permission_access_draft(uuid,text[],text[],text[],text)'
  ) is null then
    raise exception 'Role-default assignment requires the versioned mixed-access draft RPC'
      using errcode = '42883';
  end if;
end;
$migration$;

-- The existing assignment and bulk mutation retain their deployed account,
-- hierarchy, scope and row-lock guards. Both operations commit together, or
-- all changes roll back; this wrapper does not broaden their authority.
create or replace function public.assign_user_role_defaults(
  target_user_id uuid,
  target_role_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result jsonb;
  v_override_keys text[];
  v_reason constant text := 'Atribuição de papel com restauração das permissões padrão pela administração de usuários.';
begin
  if v_actor is null
     or not coalesce(public.has_permission(v_actor, 'roles.manage'), false)
     or not coalesce(public.has_permission(v_actor, 'users.manage'), false)
     or not coalesce(public.has_permission(v_actor, 'permissions.manage'), false)
     or not coalesce(public.has_permission(v_actor, 'permissions.view'), false) then
    raise exception 'forbidden: actor cannot assign role defaults' using errcode = '42501';
  end if;

  v_result := public.assign_user_role(target_user_id, target_role_key, v_reason);

  -- The caller has permissions.view and the guarded assignment checked scope.
  -- RLS supplies the deployed visibility contract; the mutation RPC rechecks
  -- target hierarchy and, where installed, reporting scope before clearing.
  select coalesce(array_agg(permission_override.permission_key), array[]::text[])
  into v_override_keys
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id;

  if cardinality(v_override_keys) > 0 then
    perform public.set_user_permission_overrides_bulk(
      target_user_id, v_override_keys, 'inherit', v_reason
    );
  end if;

  return v_result || jsonb_build_object('defaults_restored', true);
end;
$$;

alter function public.assign_user_role_defaults(uuid, text) owner to postgres;
revoke all privileges on function public.assign_user_role_defaults(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.assign_user_role_defaults(uuid, text) to authenticated;
comment on function public.assign_user_role_defaults(uuid, text) is
  'Assigns an authorized role and clears all delegable exceptions atomically, preserving hierarchy, scope and audit.';

-- Read only the role catalog, without exposing table privileges or user data.
-- Use the same permission as the Users page; this grants no operational access.
create or replace function public.get_user_role_permission_defaults()
returns table(role_key text, permission_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select rp.role_key, rp.permission_key
  from public.role_permissions rp
  where public.has_permission((select auth.uid()), 'users.view')
  order by rp.role_key, rp.permission_key;
$$;

alter function public.get_user_role_permission_defaults() owner to postgres;
revoke all privileges on function public.get_user_role_permission_defaults()
  from public, anon, authenticated, service_role;
grant execute on function public.get_user_role_permission_defaults() to authenticated;
comment on function public.get_user_role_permission_defaults() is
  'Returns authoritative role defaults only to callers allowed to view Users; does not grant table access.';

notify pgrst, 'reload schema';

commit;
