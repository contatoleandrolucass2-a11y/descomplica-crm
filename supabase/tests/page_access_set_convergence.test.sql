begin;

select plan(12);

select is(
  (select count(*) from public.app_pages),
  17::bigint,
  'the page catalog contains exactly the seventeen approved entries'
);

select is(
  (
    select array_agg(
      concat_ws('|', key, path, permission_key, is_navigation::text)
      order by key
    )
    from public.app_pages
    where is_active
  ),
  array[
    'admin.home|/admin|admin.access|true',
    'admin.pages|/admin/paginas|pages.manage|true',
    'admin.users|/admin/usuarios|users.view|true',
    'crm.dashboard|/app|crm.dashboard.view|true',
    'crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view|true',
    'crm.ranking|/app/ranking|crm.ranking.view|true',
    'crm.settings|/app/configuracoes|crm.settings.view|true',
    'crm.settings.goals|/app/configuracoes/metas|crm.settings.manage|true',
    'crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage|true',
    'crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage|true',
    'crm.simulation|/app/simulacao|crm.simulators.view|true',
    'crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view|true',
    'crm.stage.appointments|/app/etapas/agendamentos|crm.stages.view|true',
    'crm.stage.folders|/app/etapas/pastas|crm.stages.view|true',
    'crm.stage.opportunities|/app/etapas/oportunidades|crm.stages.view|true',
    'crm.stage.sales|/app/etapas/vendas|crm.stages.view|true',
    'crm.stage.visits|/app/etapas/visitas|crm.stages.view|true'
  ]::text[],
  'the active catalog matches the exact approved production key, route, permission and navigation set'
);

select is(
  (
    select count(*)
    from public.app_pages
    where key in (
      'crm.simulation.caixa',
      'crm.simulation.wf14',
      'crm.simulation.wf15',
      'crm.simulation.wf16'
    )
  ),
  0::bigint,
  'the four restore-only simulator entries are absent from the approved catalog'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'master'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'master'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'admin.home',
    'admin.pages',
    'admin.users',
    'crm.dashboard',
    'crm.partnerships',
    'crm.ranking',
    'crm.settings',
    'crm.settings.goals',
    'crm.settings.partnerships',
    'crm.settings.points',
    'crm.simulation',
    'crm.simulation.wf13',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Master resolves the exact seventeen-page production set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'admin'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'admin'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'admin.home',
    'admin.pages',
    'admin.users',
    'crm.dashboard',
    'crm.partnerships',
    'crm.ranking',
    'crm.settings',
    'crm.settings.goals',
    'crm.settings.partnerships',
    'crm.settings.points',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Admin retains the exact fifteen-page inherited set including partnerships'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_house'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_house'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'crm.dashboard',
    'crm.ranking',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Corretor House retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_imob'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_imob'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'crm.dashboard',
    'crm.partnerships',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Corretor Imob retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'coordinator'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'coordinator'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'crm.dashboard',
    'crm.partnerships',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Coordinator retains the exact seven-page Imob inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'manager_house'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'manager_house'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'crm.dashboard',
    'crm.ranking',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Gerente House retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'manager_imob'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'manager_imob'
          and role_permission.permission_key = page.permission_key
      )
  ),
  array[
    'crm.dashboard',
    'crm.partnerships',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Gerente Imob retains the exact seven-page inherited set'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key in (
      'manager',
      'supervisor',
      'house',
      'real_estate',
      'partnership_channel',
      'broker_lead',
      'broker',
      'user'
    )
  ),
  0::bigint,
  'retired roles inherit zero production pages'
);

select is(
  (
    select count(*)
    from public.role_permissions
    where role_key = 'pending'
  ),
  0::bigint,
  'pending role inherits zero production pages'
);

select * from finish();
rollback;
