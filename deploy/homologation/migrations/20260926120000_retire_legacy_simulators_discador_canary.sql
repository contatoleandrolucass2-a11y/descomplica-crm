-- Retire the isolated legacy simulator and dialer canary from homologation.
--
-- This roll-forward is intentionally not part of supabase/migrations: production
-- never received the canary. It accepts only the exact 24-page canary state,
-- removes only the seven canary pages and the Master dialer permission, and
-- restores the canonical 17-page catalog without rewriting migration history.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $retirement_preconditions$
begin
  if exists (
    with expected(
      page_key,
      page_path,
      page_name,
      page_description,
      page_section,
      permission_key,
      parent_key,
      sort_order,
      is_navigation,
      is_active
    ) as (
      values
        ('admin.home', '/admin', 'Administração', 'Gestão de usuários e permissões', 'admin', 'admin.access', null::text, 10, true, true),
        ('admin.pages', '/admin/paginas', 'Páginas', 'Catálogo de páginas autorizadas', 'admin', 'pages.manage', 'admin.home', 30, true, true),
        ('admin.users', '/admin/usuarios', 'Usuários', 'Papéis e permissões por usuário', 'admin', 'users.view', 'admin.home', 20, true, true),
        ('crm.dashboard', '/app', 'Dashboard', 'Visão geral do funil comercial', 'crm', 'crm.dashboard.view', null::text, 10, true, true),
        ('crm.dialer', '/app/discador', 'Discador', 'Área protegida do Discador', 'dialer', 'crm.dialer.view', null::text, 10, true, true),
        ('crm.dialer.weekend_forecast', '/app/discador/previsao-final-de-semana', 'Previsão Final de Semana', 'Previsão de visitas e vendas do final de semana', 'dialer', 'crm.dialer.view', 'crm.dialer', 20, true, true),
        ('crm.partnerships', '/app/canal-de-parcerias', 'Canal de Parcerias', 'Ranking das imobiliárias parceiras', 'crm', 'crm.partnerships.view', null::text, 65, true, true),
        ('crm.ranking', '/app/ranking', 'Ranking', 'Ranking comercial', 'crm', 'crm.ranking.view', null::text, 70, true, true),
        ('crm.settings', '/app/configuracoes', 'Configurações', 'Metas e pontuação do CRM', 'settings', 'crm.settings.view', null::text, 10, true, true),
        ('crm.settings.goals', '/app/configuracoes/metas', 'Metas do funil', 'Metas do funil DV', 'settings', 'crm.settings.manage', 'crm.settings', 20, true, true),
        ('crm.settings.partnerships', '/app/configuracoes/metas/parcerias', 'Metas de parcerias', 'Metas do canal de parcerias', 'settings', 'crm.settings.manage', 'crm.settings', 30, true, true),
        ('crm.settings.points', '/app/configuracoes/metas/pontos', 'Metas de pontos', 'Pesos e metas de pontuação', 'settings', 'crm.settings.manage', 'crm.settings', 40, true, true),
        ('crm.simulation', '/app/simulacao', 'Simulação', 'Ferramentas visuais de simulação comercial', 'simulation', 'crm.simulators.view', null::text, 10, true, true),
        ('crm.simulation.caixa', '/app/simulacao/caixa', 'CAIXA', 'Simulação da jornada de financiamento CAIXA', 'simulation', 'crm.simulators.view', 'crm.simulation', 40, true, true),
        ('crm.simulation.tabelao', '/app/simulacao/tabela', 'Tabelão', 'Consulta de empreendimentos e plantas', 'simulation', 'crm.simulators.view', 'crm.simulation', 70, true, true),
        ('crm.simulation.wf13', '/app/simulacao/associativo-fluxo-linear', 'Associativo WF13', 'Interface do fluxo linear associativo', 'simulation', 'crm.simulators.view', 'crm.simulation', 20, true, true),
        ('crm.simulation.wf14', '/app/simulacao/tabela-direta', 'Tabela Direta', 'Simulação da tabela direta', 'simulation', 'crm.simulators.view', 'crm.simulation', 50, true, true),
        ('crm.simulation.wf15', '/app/simulacao/tabela-investidor', 'Tabela Investidor', 'Simulação da proposta para investidor', 'simulation', 'crm.simulators.view', 'crm.simulation', 60, true, true),
        ('crm.simulation.wf16', '/app/simulacao/calcular-documentacao', 'Calcular Documentação', 'Cálculo de documentação da proposta', 'simulation', 'crm.simulators.view', 'crm.simulation', 30, true, true),
        ('crm.stage.appointments', '/app/etapas/agendamentos', 'Agendamentos', 'Detalhe da etapa de agendamentos', 'crm', 'crm.stages.view', 'crm.dashboard', 30, true, true),
        ('crm.stage.folders', '/app/etapas/pastas', 'Pastas', 'Detalhe da etapa de pastas', 'crm', 'crm.stages.view', 'crm.dashboard', 50, true, true),
        ('crm.stage.opportunities', '/app/etapas/oportunidades', 'Oportunidades', 'Detalhe da etapa de oportunidades', 'crm', 'crm.stages.view', 'crm.dashboard', 20, true, true),
        ('crm.stage.sales', '/app/etapas/vendas', 'Vendas', 'Detalhe da etapa de vendas', 'crm', 'crm.stages.view', 'crm.dashboard', 60, true, true),
        ('crm.stage.visits', '/app/etapas/visitas', 'Visitas', 'Detalhe da etapa de visitas', 'crm', 'crm.stages.view', 'crm.dashboard', 40, true, true)
    ), actual as (
      select
        page.key,
        page.path,
        page.name,
        page.description,
        page.section,
        page.permission_key,
        page.parent_key,
        page.sort_order,
        page.is_navigation,
        page.is_active
      from public.app_pages page
    ), difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    )
    select 1 from difference
  ) or (select count(*) from public.app_pages) <> 24 then
    raise exception 'legacy canary retirement requires the exact approved 24-page catalog'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.permissions permission
    where permission.key = 'crm.dialer.view'
      and permission.description =
        'Acessar interfaces do Discador autorizadas para o perfil Master'
      and permission.min_level = 100
  ) then
    raise exception 'legacy canary retirement requires the exact dialer permission'
      using errcode = '23514';
  end if;

  if (
    select coalesce(
      array_agg(role_permission.role_key order by role_permission.role_key),
      array[]::text[]
    )
    from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.dialer.view'
  ) is distinct from array['master']::text[] then
    raise exception 'legacy canary retirement requires the Master-only dialer grant'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.dialer.view'
  ) then
    raise exception 'legacy canary retirement refuses dialer permission overrides'
      using errcode = '23514';
  end if;
end;
$retirement_preconditions$;

do $retire_canary$
declare
  v_deleted bigint;
  v_deleted_total bigint := 0;
begin
  delete from public.app_pages page
  where page.key = 'crm.dialer.weekend_forecast'
    and page.path = '/app/discador/previsao-final-de-semana';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'legacy canary retirement did not remove the dialer child page first'
      using errcode = '23514';
  end if;
  v_deleted_total := v_deleted_total + v_deleted;

  delete from public.app_pages page
  where (page.key, page.path) in (
    ('crm.simulation.wf16', '/app/simulacao/calcular-documentacao'),
    ('crm.simulation.caixa', '/app/simulacao/caixa'),
    ('crm.simulation.wf14', '/app/simulacao/tabela-direta'),
    ('crm.simulation.wf15', '/app/simulacao/tabela-investidor'),
    ('crm.simulation.tabelao', '/app/simulacao/tabela')
  );
  get diagnostics v_deleted = row_count;
  if v_deleted <> 5 then
    raise exception 'legacy canary retirement did not remove exactly five simulator pages'
      using errcode = '23514';
  end if;
  v_deleted_total := v_deleted_total + v_deleted;

  delete from public.app_pages page
  where page.key = 'crm.dialer'
    and page.path = '/app/discador';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'legacy canary retirement did not remove the dialer parent page last'
      using errcode = '23514';
  end if;
  v_deleted_total := v_deleted_total + v_deleted;

  if v_deleted_total <> 7 then
    raise exception 'legacy canary retirement did not remove exactly seven pages'
      using errcode = '23514';
  end if;

  delete from public.role_permissions role_permission
  where role_permission.role_key = 'master'
    and role_permission.permission_key = 'crm.dialer.view';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'legacy canary retirement did not remove exactly one Master dialer grant'
      using errcode = '23514';
  end if;

  delete from public.permissions permission
  where permission.key = 'crm.dialer.view';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'legacy canary retirement did not remove exactly one dialer permission'
      using errcode = '23514';
  end if;
end;
$retire_canary$;

do $retirement_postconditions$
begin
  if exists (
    with expected(
      page_key,
      page_path,
      page_name,
      page_description,
      page_section,
      permission_key,
      parent_key,
      sort_order,
      is_navigation,
      is_active
    ) as (
      values
        ('admin.home', '/admin', 'Administração', 'Gestão de usuários e permissões', 'admin', 'admin.access', null::text, 10, true, true),
        ('admin.pages', '/admin/paginas', 'Páginas', 'Catálogo de páginas autorizadas', 'admin', 'pages.manage', 'admin.home', 30, true, true),
        ('admin.users', '/admin/usuarios', 'Usuários', 'Papéis e permissões por usuário', 'admin', 'users.view', 'admin.home', 20, true, true),
        ('crm.dashboard', '/app', 'Dashboard', 'Visão geral do funil comercial', 'crm', 'crm.dashboard.view', null::text, 10, true, true),
        ('crm.partnerships', '/app/canal-de-parcerias', 'Canal de Parcerias', 'Ranking das imobiliárias parceiras', 'crm', 'crm.partnerships.view', null::text, 65, true, true),
        ('crm.ranking', '/app/ranking', 'Ranking', 'Ranking comercial', 'crm', 'crm.ranking.view', null::text, 70, true, true),
        ('crm.settings', '/app/configuracoes', 'Configurações', 'Metas e pontuação do CRM', 'settings', 'crm.settings.view', null::text, 10, true, true),
        ('crm.settings.goals', '/app/configuracoes/metas', 'Metas do funil', 'Metas do funil DV', 'settings', 'crm.settings.manage', 'crm.settings', 20, true, true),
        ('crm.settings.partnerships', '/app/configuracoes/metas/parcerias', 'Metas de parcerias', 'Metas do canal de parcerias', 'settings', 'crm.settings.manage', 'crm.settings', 30, true, true),
        ('crm.settings.points', '/app/configuracoes/metas/pontos', 'Metas de pontos', 'Pesos e metas de pontuação', 'settings', 'crm.settings.manage', 'crm.settings', 40, true, true),
        ('crm.simulation', '/app/simulacao', 'Simulação', 'Ferramentas visuais de simulação comercial', 'simulation', 'crm.simulators.view', null::text, 10, true, true),
        ('crm.simulation.wf13', '/app/simulacao/associativo-fluxo-linear', 'Associativo WF13', 'Interface do fluxo linear associativo', 'simulation', 'crm.simulators.view', 'crm.simulation', 20, true, true),
        ('crm.stage.appointments', '/app/etapas/agendamentos', 'Agendamentos', 'Detalhe da etapa de agendamentos', 'crm', 'crm.stages.view', 'crm.dashboard', 30, true, true),
        ('crm.stage.folders', '/app/etapas/pastas', 'Pastas', 'Detalhe da etapa de pastas', 'crm', 'crm.stages.view', 'crm.dashboard', 50, true, true),
        ('crm.stage.opportunities', '/app/etapas/oportunidades', 'Oportunidades', 'Detalhe da etapa de oportunidades', 'crm', 'crm.stages.view', 'crm.dashboard', 20, true, true),
        ('crm.stage.sales', '/app/etapas/vendas', 'Vendas', 'Detalhe da etapa de vendas', 'crm', 'crm.stages.view', 'crm.dashboard', 60, true, true),
        ('crm.stage.visits', '/app/etapas/visitas', 'Visitas', 'Detalhe da etapa de visitas', 'crm', 'crm.stages.view', 'crm.dashboard', 40, true, true)
    ), actual as (
      select
        page.key,
        page.path,
        page.name,
        page.description,
        page.section,
        page.permission_key,
        page.parent_key,
        page.sort_order,
        page.is_navigation,
        page.is_active
      from public.app_pages page
    ), difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    )
    select 1 from difference
  ) or (select count(*) from public.app_pages) <> 17 then
    raise exception 'legacy canary retirement did not restore the exact 17-page catalog'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.permissions permission
    where permission.key = 'crm.dialer.view'
  ) or exists (
    select 1 from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.dialer.view'
  ) or exists (
    select 1 from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.dialer.view'
  ) then
    raise exception 'legacy dialer authorization survived retirement'
      using errcode = '23514';
  end if;
end;
$retirement_postconditions$;
