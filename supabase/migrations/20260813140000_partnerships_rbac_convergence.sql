-- Converge the Canal de Parcerias catalog and effective RBAC independently
-- from the unapplied Qlik/read-model migration stack.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values (
  'crm.partnerships.view',
  'Visualizar o Canal de Parcerias',
  100
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

-- This gate is deliberately Master-only. Remove stale role links and direct
-- overrides for this permission without touching any other permission.
delete from public.role_permissions
where permission_key = 'crm.partnerships.view'
  and role_key <> 'master';

delete from public.user_permission_overrides
where permission_key = 'crm.partnerships.view';

insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.partnerships.view')
on conflict (role_key, permission_key) do nothing;

do $$
declare
  v_updated integer;
begin
  update public.app_pages
  set permission_key = 'crm.partnerships.view'
  where key = 'crm.partnerships';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'crm.partnerships page catalog row is missing or duplicated'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.role_permissions
    where permission_key = 'crm.partnerships.view'
      and role_key <> 'master'
  ) then
    raise exception 'crm.partnerships.view has a non-master role link'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides
    where permission_key = 'crm.partnerships.view'
  ) then
    raise exception 'crm.partnerships.view has a direct user override'
      using errcode = '55000';
  end if;
end;
$$;

commit;
