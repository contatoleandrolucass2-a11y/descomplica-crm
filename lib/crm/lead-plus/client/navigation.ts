export const submenus: Record<string, string[]> = {
  Relatórios: [
    "Geral",
    "Visitas e Negócios Fechados",
    "Métricas de desempenho",
    "Negócio Fechado por origem",
    "Negócio Fechado por natureza da negociação",
    "Relatório de leads",
    "Acompanhamento de Uso",
  ],
  "Distribuição de leads": ["Filas de Distribuição"],
  Configurações: [
    "Motivos de arquivamento",
    "Alerta de clientes sem atendimento",
    "Ajustes",
    "Ajustes do Bolsão",
    "Permissões",
    "Auditoria",
    "Etiquetas",
  ],
};
export const profileMenu = ["Mensagens prontas", "Minhas indicações", "Treinamentos"];

// A mesma regra determina os menus, os atalhos e o acesso direto por URL.
// A ausência de uma rota na matriz não concede acesso automaticamente.
export const routePermissions: Record<string, string> = {
  Administração: "admin.access",
  "LEAD+": "crm.dashboard.view",
  Dashboards: "crm.dashboard.view",
  "Dashboard Meta": "reports.view",
  Leads: "leads.view",
  Funil: "leads.view",
  Gestão: "teams.view",
  "Meu DESCOMPLICA LEAD": "leads.view",
  Bolsão: "bucket.view",
  "Importar leads": "leads.create",
  Relatórios: "reports.view",
  ...Object.fromEntries(submenus.Relatórios!.map((route) => [route, "reports.view"])),
  "Minhas exportações": "reports.export",
  Usuários: "users.view",
  Hierarquia: "teams.view",
  "Distribuição de leads": "queues.manage",
  "Filas de Distribuição": "queues.manage",
  "Ajustes do Bolsão": "bucket.manage",
  Etiquetas: "tags.manage",
  Configurações: "audit.view",
  Auditoria: "audit.view",
  Permissões: "crm.settings.manage",
  Ajustes: "crm.settings.manage",
  "Motivos de arquivamento": "crm.settings.manage",
  "Alerta de clientes sem atendimento": "crm.settings.manage",
  Integrações: "crm.settings.manage",
  "Mensagens prontas": "leads.view",
  "Minhas indicações": "leads.view",
  Treinamentos: "leads.view",
};

const root = "/app/leads";
const hostRoutePages: Record<string, string> = {
  Administração: root + "/configuracoes",
  "LEAD+": root + "/relatorios",
  Dashboards: root + "/relatorios",
  "Dashboard Meta": root + "/relatorios",
  Leads: root + "/lista",
  Funil: root + "/funil",
  Gestão: root + "/relatorios",
  "Meu DESCOMPLICA LEAD": root + "/lista",
  Bolsão: root + "/funil",
  "Importar leads": root + "/importacao",
  Relatórios: root + "/relatorios",
  "Minhas exportações": root + "/relatorios",
  Usuários: root + "/configuracoes",
  Hierarquia: root + "/distribuicao",
  "Distribuição de leads": root + "/distribuicao",
  "Filas de Distribuição": root + "/distribuicao",
  "Ajustes do Bolsão": root + "/configuracoes",
  Etiquetas: root + "/configuracoes",
  Configurações: root + "/configuracoes",
  Auditoria: root + "/auditoria",
  Permissões: root + "/configuracoes",
  Ajustes: root + "/configuracoes",
  "Motivos de arquivamento": root + "/configuracoes",
  "Alerta de clientes sem atendimento": root + "/configuracoes",
  Integrações: root + "/configuracoes",
  "Mensagens prontas": root + "/lista",
  "Minhas indicações": root + "/lista",
  Treinamentos: root + "/lista",
  ...Object.fromEntries(submenus.Relatórios!.map((route) => [route, root + "/relatorios"])),
};
type PermissionCheck = (permission: string) => boolean;
export function canAccessRoute(
  route: string,
  can: PermissionCheck,
  pages: readonly string[] = [],
): boolean {
  const permission = routePermissions[route];
  const page = hostRoutePages[route];
  return typeof permission === "string" && !!page && pages.includes(page) && can(permission);
}
export function visibleSubmenus(
  route: string,
  can: PermissionCheck,
  pages: readonly string[] = [],
): string[] {
  return (submenus[route] || []).filter((child) => canAccessRoute(child, can, pages));
}
export function canShowMenu(
  route: string,
  can: PermissionCheck,
  pages: readonly string[] = [],
): boolean {
  return submenus[route]
    ? visibleSubmenus(route, can, pages).length > 0
    : canAccessRoute(route, can, pages);
}
