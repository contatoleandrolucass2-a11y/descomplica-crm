-- Persist the direct checkbox draft from User management in one database
-- transaction. The existing guarded bulk RPC remains the authorization and
-- audit boundary for every effect group.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
begin
  if to_regprocedure(
    'public.set_user_permission_overrides_bulk(uuid,text[],text,text)'
  ) is null then
    raise exception 'Permission access draft requires the guarded bulk override RPC'
      using errcode = '42883';
  end if;
end;
$migration$;

create or replace function public.apply_user_permission_access_draft(
  target_user_id uuid,
  allow_permission_keys text[],
  deny_permission_keys text[],
  inherit_permission_keys text[],
  reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_allow_permission_keys text[] := coalesce(allow_permission_keys, array[]::text[]);
  v_deny_permission_keys text[] := coalesce(deny_permission_keys, array[]::text[]);
  v_inherit_permission_keys text[] := coalesce(inherit_permission_keys, array[]::text[]);
  v_permission_keys text[];
  v_permission_count integer;
  v_allow_result jsonb;
  v_deny_result jsonb;
  v_inherit_result jsonb;
begin
  v_permission_keys := v_allow_permission_keys
    || v_deny_permission_keys
    || v_inherit_permission_keys;
  v_permission_count := cardinality(v_permission_keys);

  if target_user_id is null
     or v_permission_count < 1
     or v_permission_count > 100
     or nullif(btrim(coalesce(reason, '')), '') is null
     or char_length(btrim(reason)) > 240
     or array_position(v_permission_keys, null) is not null
     or (
       select count(distinct requested.permission_key)
       from unnest(v_permission_keys) requested(permission_key)
     ) <> v_permission_count then
    raise exception 'invalid_argument: target, 1-100 unique permissions and reason are required'
      using errcode = '22023';
  end if;

  if cardinality(v_allow_permission_keys) > 0 then
    v_allow_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_allow_permission_keys,
      'allow',
      reason
    );
  end if;

  if cardinality(v_deny_permission_keys) > 0 then
    v_deny_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_deny_permission_keys,
      'deny',
      reason
    );
  end if;

  if cardinality(v_inherit_permission_keys) > 0 then
    v_inherit_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_inherit_permission_keys,
      'inherit',
      reason
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'changed_count', v_permission_count,
    'allow', v_allow_result,
    'deny', v_deny_result,
    'inherit', v_inherit_result
  );
end;
$$;

alter function public.apply_user_permission_access_draft(uuid, text[], text[], text[], text)
  owner to postgres;
revoke all privileges
  on function public.apply_user_permission_access_draft(uuid, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute
  on function public.apply_user_permission_access_draft(uuid, text[], text[], text[], text)
  to authenticated;

comment on function public.apply_user_permission_access_draft(uuid, text[], text[], text[], text) is
  'Atomically applies mixed checkbox access changes through the guarded bulk override RPC.';

commit;
