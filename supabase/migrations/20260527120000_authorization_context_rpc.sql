-- Milestone 5.3.0 — Authorization Context RPC
--
-- Read-only RPC that returns the caller's (or, with users.view, any user's)
-- full authorization context in a single round-trip:
--   * user_id
--   * role_key
--   * level
--   * permissions text[]   (resolved: deny override > allow override > role)
--
-- Design notes:
--   * Reuses the M5.1 _internal_* helpers (never calls the public wrappers,
--     which would re-apply the self/users.view guard recursively).
--   * Adds a new SECURITY DEFINER internal helper, _internal_list_permissions,
--     that materializes the effective permission set with deny precedence.
--     Denied permissions are NOT returned.
--   * The public RPC enforces auth.uid() presence and the self-or-users.view
--     rule before exposing any row.

-- ============================================================================
-- _internal_list_permissions(user_uuid)
--
-- Effective permission set for a user, computed as:
--   (role grants ∪ allow overrides)  \  deny overrides
--
-- Internal: NOT granted to anon/authenticated. Reachable only through other
-- SECURITY DEFINER functions in this schema.
-- ============================================================================
create or replace function public._internal_list_permissions(user_uuid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with role_perms as (
    select rp.permission_key as perm_key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = user_uuid
  ),
  allow_overrides as (
    select o.permission_key as perm_key
    from public.user_permission_overrides o
    where o.user_id = user_uuid
      and o.effect  = 'allow'
  ),
  combined as (
    select perm_key from role_perms
    union
    select perm_key from allow_overrides
  )
  select coalesce(array_agg(c.perm_key order by c.perm_key), array[]::text[])
  from combined c
  where not exists (
    select 1
    from public.user_permission_overrides d
    where d.user_id        = user_uuid
      and d.permission_key = c.perm_key
      and d.effect         = 'deny'
  );
$$;

-- ============================================================================
-- get_user_authorization_context(user_uuid)
--
-- Returns 0 or 1 row with the full authorization context for `user_uuid`.
--
-- Access rule:
--   * auth.uid() must be non-null (no anonymous callers).
--   * user_uuid = auth.uid()                              → allowed.
--   * user_uuid <> auth.uid() and caller has users.view   → allowed.
--   * Otherwise                                           → returns no rows.
--
-- Returns no row when:
--   * the access rule above blocks the call;
--   * the target user has no role assigned (no user_roles entry);
--   * user_uuid is null.
-- ============================================================================
create or replace function public.get_user_authorization_context(user_uuid uuid)
returns table (
  user_id     uuid,
  role_key    text,
  level       integer,
  permissions text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null then
    return;
  end if;

  if user_uuid is null then
    return;
  end if;

  if user_uuid <> v_caller
     and not coalesce(public._internal_has_permission(v_caller, 'users.view'), false) then
    return;
  end if;

  return query
    select
      ur.user_id,
      ur.role_key,
      r.level,
      public._internal_list_permissions(ur.user_id) as permissions
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    where ur.user_id = user_uuid;
end;
$$;

-- ============================================================================
-- Grants
--
-- Defense-in-depth: Supabase default privileges grant EXECUTE on every new
-- public function to anon/authenticated/service_role. REVOKE FROM PUBLIC alone
-- does not undo that — internal helpers must be revoked from anon AND
-- authenticated explicitly. service_role retains EXECUTE by design.
-- ============================================================================
revoke execute on function public._internal_list_permissions(uuid)         from public;
revoke execute on function public._internal_list_permissions(uuid)         from anon, authenticated;

revoke execute on function public.get_user_authorization_context(uuid)     from public;
revoke execute on function public.get_user_authorization_context(uuid)     from anon;
grant  execute on function public.get_user_authorization_context(uuid)     to   authenticated;
