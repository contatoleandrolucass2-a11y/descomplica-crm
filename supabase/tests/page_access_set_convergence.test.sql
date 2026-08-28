begin;

select plan(13);

select is(
  (select count(*) from public.app_pages),
  24::bigint,
  'the page catalog contains exactly the twenty-four approved canary entries'
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
    'crm.dialer|/app/discador|crm.dialer.view|true',
    'crm.dialer.weekend_forecast|/app/discador/previsao-final-de-semana|crm.dialer.view|true',
    'crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view|true',
    'crm.ranking|/app/ranking|crm.ranking.view|true',
    'crm.settings|/app/configuracoes|crm.settings.view|true',
    'crm.settings.goals|/app/configuracoes/metas|crm.settings.manage|true',
    'crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage|true',
    'crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage|true',
    'crm.simulation|/app/simulacao|crm.simulators.view|true',
    'crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view|true',
    'crm.simulation.tabelao|/app/simulacao/tabela|crm.simulators.view|true',
    'crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view|true',
    'crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view|true',
    'crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view|true',
    'crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view|true',
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
    select array_agg(key order by key)
    from public.app_pages
    where key in (
      'crm.dialer',
      'crm.dialer.weekend_forecast',
      'crm.simulation.caixa',
      'crm.simulation.tabelao',
      'crm.simulation.wf14',
      'crm.simulation.wf15',
      'crm.simulation.wf16'
    )
  ),
  array[
    'crm.dialer',
    'crm.dialer.weekend_forecast',
    'crm.simulation.caixa',
    'crm.simulation.tabelao',
    'crm.simulation.wf14',
    'crm.simulation.wf15',
    'crm.simulation.wf16'
  ]::text[],
  'the exact seven Master canary pages are present in the approved catalog'
);

select ok(
  (
    select array_agg(role_key order by role_key)
    from public.role_permissions
    where permission_key = 'crm.dialer.view'
  ) = array['master']::text[]
  and not exists (
    select 1
    from public.user_permission_overrides
    where permission_key = 'crm.dialer.view'
  ),
  'the dialer permission is inherited only by Master and has no user override'
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
    'crm.dialer',
    'crm.dialer.weekend_forecast',
    'crm.partnerships',
    'crm.ranking',
    'crm.settings',
    'crm.settings.goals',
    'crm.settings.partnerships',
    'crm.settings.points',
    'crm.simulation',
    'crm.simulation.caixa',
    'crm.simulation.tabelao',
    'crm.simulation.wf13',
    'crm.simulation.wf14',
    'crm.simulation.wf15',
    'crm.simulation.wf16',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'Master resolves the exact twenty-four-page canary set'
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
  'Admin retains the exact fourteen-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker'
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
  'broker retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_lead'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'broker_lead'
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
  'broker_lead retains the exact seven-page inherited set'
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
    'crm.ranking',
    'crm.stage.appointments',
    'crm.stage.folders',
    'crm.stage.opportunities',
    'crm.stage.sales',
    'crm.stage.visits'
  ]::text[],
  'coordinator retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'real_estate'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'real_estate'
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
  'real_estate retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'supervisor'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'supervisor'
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
  'supervisor retains the exact seven-page inherited set'
);

select is(
  (
    select array_agg(page.key order by page.key)
    from public.app_pages page
    where page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'user'
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = 'user'
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
  'user retains the exact seven-page inherited set'
);

select is(
  (
    select count(*)
    from public.roles role
    cross join public.app_pages page
    where role.key in ('manager', 'house', 'partnership_channel', 'pending')
      and page.is_active
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = role.key
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1 from public.role_permissions role_permission
        where role_permission.role_key = role.key
          and role_permission.permission_key = page.permission_key
      )
  ),
  0::bigint,
  'future and pending roles inherit zero commercial pages'
);

select * from finish();
rollback;
