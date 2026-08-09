begin;

insert into public.permissions (key, description, min_level)
values (
  'crm.simulators.view',
  'View authorized commercial simulator interfaces',
  10
)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

insert into public.role_permissions (role_key, permission_key)
values
  ('master', 'crm.simulators.view'),
  ('admin', 'crm.simulators.view'),
  ('coordinator', 'crm.simulators.view'),
  ('supervisor', 'crm.simulators.view'),
  ('real_estate', 'crm.simulators.view'),
  ('broker_lead', 'crm.simulators.view'),
  ('broker', 'crm.simulators.view'),
  ('user', 'crm.simulators.view')
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
  ),
  (
    'crm.simulation.wf16',
    '/app/simulacao/calcular-documentacao',
    'Documentação WF16',
    'Interface de cálculo de documentação',
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
    'Simulação CAIXA',
    'Interface da jornada de financiamento CAIXA',
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
    'Tabela Direta WF14',
    'Interface de comparação da tabela direta',
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
    'Tabela Investidor WF15',
    'Interface de proposta para investidor',
    'simulation',
    'crm.simulators.view',
    'crm.simulation',
    60,
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

commit;
