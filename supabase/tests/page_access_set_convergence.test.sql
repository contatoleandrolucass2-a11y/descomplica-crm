begin;

select plan(12);

select is(
  (select count(*) from public.app_pages),
  49::bigint,
  'the page catalog contains exactly the forty-nine approved entries'
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
    'crm.leads|/app/leads|crm.leads.view|true',
    'crm.leads.activities|/app/leads/atividades|crm.leads.activities.view|true',
    'crm.leads.audit|/app/leads/auditoria|crm.leads.audit.view|true',
    'crm.leads.distribution|/app/leads/distribuicao|crm.leads.distribution.view|true',
    'crm.leads.import|/app/leads/importacao|crm.leads.import.view|true',
    'crm.leads.list|/app/leads/lista|crm.leads.list.view|true',
    'crm.leads.pipeline|/app/leads/funil|crm.leads.pipeline.view|true',
    'crm.leads.reports|/app/leads/relatorios|crm.leads.reports.view|true',
    'crm.leads.settings|/app/leads/configuracoes|crm.leads.settings.view|true',
    'crm.management|/app/gestao|crm.management.view|true',
    'crm.management.forecast|/app/gestao/previsao|crm.management.forecast.view|true',
    'crm.management.routine|/app/gestao/rotina|crm.management.routine.view|true',
    'crm.meta_ads|/app/meta-ads|crm.meta_ads.view|true',
    'crm.meta_ads.accounts|/app/meta-ads/contas-de-anuncios|crm.meta_ads.accounts.view|true',
    'crm.meta_ads.campaigns|/app/meta-ads/campanhas|crm.meta_ads.campaigns.view|true',
    'crm.meta_ads.reports|/app/meta-ads/relatorios|crm.meta_ads.reports.view|true',
    'crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view|true',
    'crm.ranking|/app/ranking|crm.ranking.view|true',
    'crm.repasse|/app/repasse|crm.repasse.view|true',
    'crm.settings|/app/configuracoes|crm.settings.view|true',
    'crm.settings.connected_systems|/app/configuracoes/conectar-sistemas|crm.settings.connected_systems.view|true',
    'crm.settings.goals|/app/configuracoes/metas|crm.settings.goals.view|true',
    'crm.settings.marketing|/app/configuracoes/recurso-mkt|crm.settings.marketing.view|true',
    'crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.partnerships.view|true',
    'crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.points.view|true',
    'crm.simulation|/app/simulacao|crm.simulators.view|true',
    'crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view|true',
    'crm.simulation.tabelao|/app/simulacao/tabelao|crm.simulators.view|true',
    'crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view|true',
    'crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view|true',
    'crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view|true',
    'crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view|true',
    'crm.stage.appointments|/app/etapas/agendamentos|crm.stage.appointments.view|true',
    'crm.stage.folders|/app/etapas/pastas|crm.stage.folders.view|true',
    'crm.stage.opportunities|/app/etapas/oportunidades|crm.stage.opportunities.view|true',
    'crm.stage.sales|/app/etapas/vendas|crm.stage.sales.view|true',
    'crm.stage.visits|/app/etapas/visitas|crm.stage.visits.view|true',
    'crm.useful_links|/app/links-uteis|crm.useful_links.view|true',
    'crm.useful_links.app_bora_vender|/app/links-uteis/app-bora-vender|crm.useful_links.app_bora_vender.view|true',
    'crm.useful_links.campanha_do_mes|/app/links-uteis/campanha-do-mes|crm.useful_links.campanha_do_mes.view|true',
    'crm.useful_links.grupos_whatsapp|/app/links-uteis/grupos-whatsapp|crm.useful_links.grupos_whatsapp.view|true',
    'crm.useful_links.linktree_liveprint|/app/links-uteis/linktree-liveprint|crm.useful_links.linktree_liveprint.view|true',
    'crm.useful_links.lojas_horarios|/app/links-uteis/lojas-horarios|crm.useful_links.lojas_horarios.view|true',
    'crm.useful_links.regras_comerciais|/app/links-uteis/regras-comerciais|crm.useful_links.regras_comerciais.view|true',
    'crm.useful_links.relacionamento|/app/links-uteis/relacionamento|crm.useful_links.relacionamento.view|true'
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
  4::bigint,
  'the four released simulator entries are present in the managed catalog'
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
    'crm.leads',
    'crm.leads.activities',
    'crm.leads.audit',
    'crm.leads.distribution',
    'crm.leads.import',
    'crm.leads.list',
    'crm.leads.pipeline',
    'crm.leads.reports',
    'crm.leads.settings',
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.meta_ads',
    'crm.meta_ads.accounts',
    'crm.meta_ads.campaigns',
    'crm.meta_ads.reports',
    'crm.partnerships',
    'crm.ranking',
    'crm.repasse',
    'crm.settings',
    'crm.settings.connected_systems',
    'crm.settings.goals',
    'crm.settings.marketing',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Master resolves the exact forty-nine-page catalog set'
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
    'crm.leads',
    'crm.leads.activities',
    'crm.leads.audit',
    'crm.leads.distribution',
    'crm.leads.import',
    'crm.leads.list',
    'crm.leads.pipeline',
    'crm.leads.reports',
    'crm.leads.settings',
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.meta_ads',
    'crm.meta_ads.accounts',
    'crm.meta_ads.campaigns',
    'crm.meta_ads.reports',
    'crm.partnerships',
    'crm.ranking',
    'crm.repasse',
    'crm.settings',
    'crm.settings.connected_systems',
    'crm.settings.goals',
    'crm.settings.marketing',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Admin retains the exact forty-nine-page inherited set including Lead, Meta Ads, useful links, partnerships and simulators'
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
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.ranking',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Corretor House retains the exact inherited inherited set including simulators'
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
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.partnerships',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Corretor Imob retains the exact inherited inherited set including simulators'
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
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.partnerships',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Coordinator retains the exact inherited Imob inherited set including simulators'
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
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.ranking',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Gerente House retains the exact inherited inherited set including simulators'
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
    'crm.management',
    'crm.management.forecast',
    'crm.management.routine',
    'crm.partnerships',
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
    'crm.stage.visits',
    'crm.useful_links',
    'crm.useful_links.app_bora_vender',
    'crm.useful_links.campanha_do_mes',
    'crm.useful_links.grupos_whatsapp',
    'crm.useful_links.linktree_liveprint',
    'crm.useful_links.lojas_horarios',
    'crm.useful_links.regras_comerciais',
    'crm.useful_links.relacionamento'
  ]::text[],
  'Gerente Imob retains the exact inherited inherited set including simulators'
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
