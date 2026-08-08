-- Require meaningful audit reasons for sensitive authorization changes.
--
-- The existing SECURITY DEFINER RPCs remain the only mutation boundary and
-- retain every authentication, hierarchy, anti-self and permission check.
-- This BEFORE INSERT trigger runs inside the same transaction as each RPC, so
-- a missing reason aborts and rolls back the entire attempted change.

create or replace function private.enforce_authorization_audit_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_reason text;
  v_previous_level integer;
  v_next_level integer;
begin
  if new.action = 'authorization.role_assigned' then
    v_previous_level := coalesce((new.before #>> '{previous,level}')::integer, 0);
    v_next_level := coalesce((new.after ->> 'level')::integer, 0);
    v_reason := new.before ->> 'reason';

    if v_next_level > v_previous_level
       and nullif(btrim(coalesce(v_reason, '')), '') is null then
      raise exception 'invalid_argument: reason is required for privilege elevation'
        using errcode = '22023';
    end if;
  elsif new.action in (
    'authorization.permission_override_set',
    'authorization.permission_override_removed'
  ) then
    v_reason := new.before ->> 'reason';

    if nullif(btrim(coalesce(v_reason, '')), '') is null then
      raise exception 'invalid_argument: reason is required for permission exceptions'
        using errcode = '22023';
    end if;
  elsif new.action = 'authorization.user_status_changed'
        and coalesce((new.after ->> 'is_active')::boolean, true) is false then
    v_reason := new.after ->> 'reason';

    if nullif(btrim(coalesce(v_reason, '')), '') is null then
      raise exception 'invalid_argument: reason is required for user deactivation'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_authorization_audit_reason()
  from public, anon, authenticated, service_role;

create trigger audit_logs_require_sensitive_action_reason
  before insert on public.audit_logs
  for each row execute function private.enforce_authorization_audit_reason();

comment on function private.enforce_authorization_audit_reason() is
  'Aborts sensitive access changes without a meaningful audit reason.';
