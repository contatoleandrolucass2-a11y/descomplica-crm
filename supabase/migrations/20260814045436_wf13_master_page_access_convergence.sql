-- Converge the WF13 page gate with the already-applied Master execution gate.
--
-- Production received crm.simulators.execute through remote migration
-- 20260813192928, but the older visual-catalog migration was intentionally not
-- batch-applied. This forward migration adds only the navigation/page
-- prerequisite required by the WF13 Master canary. It does not enable another
-- simulator, integration, policy, formula or runtime flag.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1
    from public.app_pages
    where (key = 'crm.simulation' and path <> '/app/simulacao')
       or (path = '/app/simulacao' and key <> 'crm.simulation')
       or (
         key = 'crm.simulation.wf13'
         and path <> '/app/simulacao/associativo-fluxo-linear'
       )
       or (
         path = '/app/simulacao/associativo-fluxo-linear'
         and key <> 'crm.simulation.wf13'
       )
  ) then
    raise exception 'WF13 page catalog identity conflicts with the approved route'
      using errcode = '55000';
  end if;
end;
$$;

insert into public.permissions (key, description, min_level)
values (
  'crm.simulators.view',
  'Acessar interfaces de simulacao autorizadas para o perfil Master',
  100
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

delete from public.role_permissions
where permission_key = 'crm.simulators.view'
  and role_key <> 'master';

delete from public.user_permission_overrides
where permission_key = 'crm.simulators.view';

insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.simulators.view')
on conflict (role_key, permission_key) do nothing;

insert into public.app_pages (
  key,
  path,
  name,
  description,
  section,
  permission_key,
  parent_key,
  sort_order,
  is_navigation,
  is_active
)
values
  (
    'crm.simulation',
    '/app/simulacao',
    'Simulação',
    'Ferramentas visuais de simulação comercial',
    'simulation',
    'crm.simulators.view',
    null,
    10,
    true,
    true
  ),
  (
    'crm.simulation.wf13',
    '/app/simulacao/associativo-fluxo-linear',
    'Associativo WF13',
    'Interface do fluxo linear associativo',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    20,
    true,
    true
  )
on conflict (key) do update
set path = excluded.path,
    name = excluded.name,
    description = excluded.description,
    section = excluded.section,
    permission_key = excluded.permission_key,
    parent_key = excluded.parent_key,
    sort_order = excluded.sort_order,
    is_navigation = excluded.is_navigation,
    is_active = excluded.is_active;

do $$
begin
  if (
    select count(*)
    from public.role_permissions
    where permission_key = 'crm.simulators.view'
  ) <> 1 or not exists (
    select 1
    from public.role_permissions
    where role_key = 'master'
      and permission_key = 'crm.simulators.view'
  ) then
    raise exception 'crm.simulators.view is not exclusive to Master'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides
    where permission_key = 'crm.simulators.view'
  ) then
    raise exception 'crm.simulators.view has a direct user override'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from public.app_pages
    where key in ('crm.simulation', 'crm.simulation.wf13')
      and permission_key = 'crm.simulators.view'
      and is_navigation
      and is_active
  ) <> 2 then
    raise exception 'WF13 page catalog did not converge with its guard'
      using errcode = '55000';
  end if;
end;
$$;

commit;
