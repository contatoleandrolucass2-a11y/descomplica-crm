-- Grant execution of independently flagged official simulators only to Master.
-- The application flags remain off by default; this migration does not activate
-- any formula, policy, integration, data source or runtime.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values (
  'crm.simulators.execute',
  'Executar simuladores oficiais em validação controlada',
  100
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

delete from public.role_permissions
where permission_key = 'crm.simulators.execute'
  and role_key <> 'master';

delete from public.user_permission_overrides
where permission_key = 'crm.simulators.execute';

insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.simulators.execute')
on conflict (role_key, permission_key) do nothing;

do $$
begin
  if exists (
    select 1
    from public.role_permissions
    where permission_key = 'crm.simulators.execute'
      and role_key <> 'master'
  ) then
    raise exception 'crm.simulators.execute has a non-master role link'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides
    where permission_key = 'crm.simulators.execute'
  ) then
    raise exception 'crm.simulators.execute has a direct user override'
      using errcode = '55000';
  end if;
end;
$$;

commit;
