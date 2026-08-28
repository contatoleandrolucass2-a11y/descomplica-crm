-- Publish the seven legacy-reference pages as an isolated Master canary.
--
-- This migration changes only the permission/page catalog. Simulator engines,
-- inventory sources, dialer writes and external integrations remain governed
-- by independent, default-off runtime flags and contracts.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $migration$
begin
  if exists (
    with expected(
      page_key,
      page_path,
      permission_key,
      parent_key,
      is_navigation,
      is_active
    ) as (
      values
        ('admin.home', '/admin', 'admin.access', null::text, true, true),
        ('admin.pages', '/admin/paginas', 'pages.manage', 'admin.home', true, true),
        ('admin.users', '/admin/usuarios', 'users.view', 'admin.home', true, true),
        ('crm.dashboard', '/app', 'crm.dashboard.view', null::text, true, true),
        (
          'crm.partnerships',
          '/app/canal-de-parcerias',
          'crm.partnerships.view',
          null::text,
          true,
          true
        ),
        ('crm.ranking', '/app/ranking', 'crm.ranking.view', null::text, true, true),
        (
          'crm.settings',
          '/app/configuracoes',
          'crm.settings.view',
          null::text,
          true,
          true
        ),
        (
          'crm.settings.goals',
          '/app/configuracoes/metas',
          'crm.settings.manage',
          'crm.settings',
          true,
          true
        ),
        (
          'crm.settings.partnerships',
          '/app/configuracoes/metas/parcerias',
          'crm.settings.manage',
          'crm.settings',
          true,
          true
        ),
        (
          'crm.settings.points',
          '/app/configuracoes/metas/pontos',
          'crm.settings.manage',
          'crm.settings',
          true,
          true
        ),
        (
          'crm.simulation',
          '/app/simulacao',
          'crm.simulators.view',
          null::text,
          true,
          true
        ),
        (
          'crm.simulation.wf13',
          '/app/simulacao/associativo-fluxo-linear',
          'crm.simulators.view',
          'crm.simulation',
          true,
          true
        ),
        (
          'crm.stage.appointments',
          '/app/etapas/agendamentos',
          'crm.stages.view',
          'crm.dashboard',
          true,
          true
        ),
        (
          'crm.stage.folders',
          '/app/etapas/pastas',
          'crm.stages.view',
          'crm.dashboard',
          true,
          true
        ),
        (
          'crm.stage.opportunities',
          '/app/etapas/oportunidades',
          'crm.stages.view',
          'crm.dashboard',
          true,
          true
        ),
        (
          'crm.stage.sales',
          '/app/etapas/vendas',
          'crm.stages.view',
          'crm.dashboard',
          true,
          true
        ),
        (
          'crm.stage.visits',
          '/app/etapas/visitas',
          'crm.stages.view',
          'crm.dashboard',
          true,
          true
        )
    ),
    actual as (
      select
        page.key,
        page.path,
        page.permission_key,
        page.parent_key,
        page.is_navigation,
        page.is_active
      from public.app_pages page
    ),
    difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    )
    select 1 from difference
  ) then
    raise exception 'legacy canary requires the exact approved 17-page baseline'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.permissions permission
    where permission.key = 'crm.simulators.view'
      and permission.min_level = 100
  ) then
    raise exception 'legacy canary requires the Master simulator page permission'
      using errcode = '23514';
  end if;

  if (
    select coalesce(array_agg(role_permission.role_key order by role_permission.role_key), array[]::text[])
    from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.simulators.view'
  ) is distinct from array['master']::text[]
  or exists (
    select 1
    from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.simulators.view'
  ) then
    raise exception 'legacy canary requires crm.simulators.view to be Master-only'
      using errcode = '23514';
  end if;
end;
$migration$;

reset lock_timeout;
reset statement_timeout;

insert into public.permissions (key, description, min_level)
values (
  'crm.dialer.view',
  'Acessar interfaces do Discador autorizadas para o perfil Master',
  100
)
on conflict (key) do nothing;

insert into public.role_permissions (role_key, permission_key)
values ('master', 'crm.dialer.view')
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
    'crm.simulation.wf16',
    '/app/simulacao/calcular-documentacao',
    'Calcular Documentação',
    'Cálculo de documentação da proposta',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    30,
    true,
    true
  ),
  (
    'crm.simulation.caixa',
    '/app/simulacao/caixa',
    'CAIXA',
    'Simulação da jornada de financiamento CAIXA',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    40,
    true,
    true
  ),
  (
    'crm.simulation.wf14',
    '/app/simulacao/tabela-direta',
    'Tabela Direta',
    'Simulação da tabela direta',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    50,
    true,
    true
  ),
  (
    'crm.simulation.wf15',
    '/app/simulacao/tabela-investidor',
    'Tabela Investidor',
    'Simulação da proposta para investidor',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    60,
    true,
    true
  ),
  (
    'crm.simulation.tabelao',
    '/app/simulacao/tabela',
    'Tabelão',
    'Consulta de empreendimentos e plantas',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    70,
    true,
    true
  ),
  (
    'crm.dialer',
    '/app/discador',
    'Discador',
    'Área protegida do Discador',
    'dialer',
    'crm.dialer.view',
    null,
    10,
    true,
    true
  ),
  (
    'crm.dialer.weekend_forecast',
    '/app/discador/previsao-final-de-semana',
    'Previsão Final de Semana',
    'Previsão de visitas e vendas do final de semana',
    'dialer',
    'crm.dialer.view',
    'crm.dialer',
    20,
    true,
    true
  );

do $migration$
declare
  v_contract record;
  v_actual_pages text[];
begin
  if not exists (
    select 1
    from public.permissions permission
    where permission.key = 'crm.dialer.view'
      and permission.min_level = 100
      and permission.description =
        'Acessar interfaces do Discador autorizadas para o perfil Master'
  ) then
    raise exception 'crm.dialer.view metadata differs from the approved canary contract'
      using errcode = '23514';
  end if;

  if (
    select coalesce(array_agg(role_permission.role_key order by role_permission.role_key), array[]::text[])
    from public.role_permissions role_permission
    where role_permission.permission_key = 'crm.dialer.view'
  ) is distinct from array['master']::text[]
  or exists (
    select 1
    from public.user_permission_overrides permission_override
    where permission_override.permission_key = 'crm.dialer.view'
  ) then
    raise exception 'crm.dialer.view is not exclusive to Master'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.app_pages page
  ) <> 24 then
    raise exception 'legacy canary did not produce the exact 24-page catalog'
      using errcode = '23514';
  end if;

  if exists (
    with expected(
      page_key,
      page_path,
      permission_key,
      parent_key,
      sort_order
    ) as (
      values
        (
          'crm.simulation.wf16',
          '/app/simulacao/calcular-documentacao',
          'crm.simulators.view',
          'crm.simulation',
          30
        ),
        (
          'crm.simulation.caixa',
          '/app/simulacao/caixa',
          'crm.simulators.view',
          'crm.simulation',
          40
        ),
        (
          'crm.simulation.wf14',
          '/app/simulacao/tabela-direta',
          'crm.simulators.view',
          'crm.simulation',
          50
        ),
        (
          'crm.simulation.wf15',
          '/app/simulacao/tabela-investidor',
          'crm.simulators.view',
          'crm.simulation',
          60
        ),
        (
          'crm.simulation.tabelao',
          '/app/simulacao/tabela',
          'crm.simulators.view',
          'crm.simulation',
          70
        ),
        (
          'crm.dialer',
          '/app/discador',
          'crm.dialer.view',
          null::text,
          10
        ),
        (
          'crm.dialer.weekend_forecast',
          '/app/discador/previsao-final-de-semana',
          'crm.dialer.view',
          'crm.dialer',
          20
        )
    ),
    actual as (
      select
        page.key,
        page.path,
        page.permission_key,
        page.parent_key,
        page.sort_order
      from public.app_pages page
      where page.key in (select expected.page_key from expected)
        and page.is_navigation
        and page.is_active
    ),
    difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    )
    select 1 from difference
  ) then
    raise exception 'legacy canary page identities differ from the approved seven-page set'
      using errcode = '23514';
  end if;

  for v_contract in
    select *
    from (values
      (
        'master',
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
        ]::text[]
      ),
      (
        'admin',
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
        ]::text[]
      ),
      (
        'coordinator',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      (
        'supervisor',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      (
        'real_estate',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      (
        'broker_lead',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      (
        'broker',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      (
        'user',
        array[
          'crm.dashboard',
          'crm.ranking',
          'crm.stage.appointments',
          'crm.stage.folders',
          'crm.stage.opportunities',
          'crm.stage.sales',
          'crm.stage.visits'
        ]::text[]
      ),
      ('manager', array[]::text[]),
      ('house', array[]::text[]),
      ('partnership_channel', array[]::text[]),
      ('pending', array[]::text[])
    ) contract(role_key, expected_pages)
  loop
    select coalesce(array_agg(page.key order by page.key), array[]::text[])
    into v_actual_pages
    from public.app_pages page
    where page.is_active
      and exists (
        select 1
        from public.role_permissions role_permission
        where role_permission.role_key = v_contract.role_key
          and role_permission.permission_key = 'pages.view'
      )
      and exists (
        select 1
        from public.role_permissions role_permission
        where role_permission.role_key = v_contract.role_key
          and role_permission.permission_key = page.permission_key
      );

    if v_actual_pages is distinct from v_contract.expected_pages then
      raise exception 'legacy canary page matrix differs for role %', v_contract.role_key
        using errcode = '23514';
    end if;
  end loop;
end;
$migration$;
