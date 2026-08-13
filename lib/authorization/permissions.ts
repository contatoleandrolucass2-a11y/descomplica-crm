// Mirrors the `permissions` catalog in versioned migrations. Not a security boundary —
// the authoritative values live in the database. Labels are presentation-only;
// the technical keys remain unchanged for RPCs, RLS and audit records.
export const PERMISSIONS = {
  "users.view": {
    label: "Visualizar usuários",
    description: "Consulta perfis e papéis atribuídos.",
    minLevel: 10,
  },
  "users.manage": {
    label: "Gerenciar usuários",
    description: "Ativa ou desativa contas abaixo do próprio nível.",
    minLevel: 80,
  },
  "permissions.view": {
    label: "Visualizar permissões",
    description: "Consulta permissões e exceções individuais.",
    minLevel: 10,
  },
  "permissions.manage": {
    label: "Gerenciar exceções",
    description: "Concede ou revoga exceções abaixo do próprio nível.",
    minLevel: 80,
  },
  "roles.view": {
    label: "Visualizar papéis",
    description: "Consulta os papéis e suas atribuições.",
    minLevel: 10,
  },
  "roles.manage": {
    label: "Gerenciar papéis",
    description: "Altera papéis respeitando a hierarquia.",
    minLevel: 80,
  },
  "audit.view": {
    label: "Visualizar auditoria",
    description: "Consulta o histórico de alterações administrativas.",
    minLevel: 80,
  },
  "admin.access": {
    label: "Acessar administração",
    description: "Abre o painel administrativo.",
    minLevel: 80,
  },
  "pages.view": {
    label: "Visualizar navegação",
    description: "Consulta o catálogo de páginas autorizadas.",
    minLevel: 10,
  },
  "pages.manage": {
    label: "Gerenciar páginas",
    description: "Ativa ou desativa itens do catálogo de navegação.",
    minLevel: 80,
  },
  "crm.dashboard.view": {
    label: "Visualizar dashboard",
    description: "Consulta os indicadores do CRM.",
    minLevel: 10,
  },
  "crm.stages.view": {
    label: "Visualizar etapas",
    description: "Consulta oportunidades, agendamentos, visitas, pastas e vendas.",
    minLevel: 10,
  },
  "crm.ranking.view": {
    label: "Visualizar ranking",
    description: "Consulta o ranking comercial disponível.",
    minLevel: 10,
  },
  "crm.partnerships.view": {
    label: "Visualizar Canal de Parcerias",
    description: "Acessa o Canal de Parcerias exclusivamente no perfil Master.",
    minLevel: 100,
  },
  "crm.read_model_v3.view": {
    label: "Visualizar read model v3",
    description:
      "Consulta fatos comerciais canônicos somente por RPC e dentro de um escopo explícito.",
    minLevel: 10,
  },
  "crm.read_model_v3.ranking.view": {
    label: "Visualizar dataset v3 de ranking",
    description: "Autoriza somente o dataset canônico de ranking escopado.",
    minLevel: 10,
  },
  "crm.read_model_v3.partnerships.view": {
    label: "Visualizar dataset v3 de parcerias",
    description: "Autoriza somente o dataset canônico de parcerias escopado.",
    minLevel: 10,
  },
  "crm.read_model_v3.stock.view": {
    label: "Visualizar dataset v3 de estoque",
    description: "Autoriza somente o dataset canônico de estoque escopado.",
    minLevel: 10,
  },
  "crm.simulators.view": {
    label: "Visualizar simuladores",
    description: "Acessa as interfaces autorizadas de simulação comercial.",
    minLevel: 10,
  },
  "crm.simulators.execute": {
    label: "Executar simuladores",
    description: "Executa somente motores comerciais aprovados e vigentes.",
    minLevel: 10,
  },
  "crm.commercial_engine.execute": {
    label: "Executar motores comerciais",
    description: "Executa somente motores comerciais não interativos aprovados e vigentes.",
    minLevel: 100,
  },
  "crm.commercial_policy.manage": {
    label: "Gerenciar políticas comerciais",
    description: "Versiona e controla políticas comerciais aprovadas.",
    minLevel: 100,
  },
  "crm.settings.view": {
    label: "Visualizar configurações",
    description: "Consulta metas e parâmetros do CRM.",
    minLevel: 80,
  },
  "crm.settings.manage": {
    label: "Gerenciar configurações",
    description: "Altera metas e parâmetros de pontuação.",
    minLevel: 80,
  },
  "crm.salesforce.refresh": {
    label: "Atualizar dados",
    description: "Solicita atualização quando a integração estiver disponível.",
    minLevel: 80,
  },
  "crm.ingest.manage": {
    label: "Gerenciar ingestão",
    description: "Executa e inspeciona cargas autorizadas do CRM.",
    minLevel: 80,
  },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function getPermissionMinLevel(permissionKey: PermissionKey): number {
  return PERMISSIONS[permissionKey].minLevel;
}

export function getPermissionLabel(permissionKey: PermissionKey): string {
  return PERMISSIONS[permissionKey].label;
}
