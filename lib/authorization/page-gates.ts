import type { PermissionKey } from "./permissions";

export interface ProtectedPageGate {
  pageKey: string;
  path: string;
  permission: PermissionKey;
  releaseEnabled: boolean;
}

// Covers the complete 22-route HTTP smoke inventory. Seventeen entries mirror
// app_pages; five additional simulator routes are released through the protected
// server-built navigation only after the catalog parent and effective permission
// are authorized. The CAIXA page is released only as a protected visual journey;
// its independent runtime and execution gates remain fail-closed. Database
// permissions, route guards and RLS remain authoritative; this copy lets Proxy
// return a real 403 before unauthorized code can stream.
export const PROTECTED_PAGE_GATES = [
  {
    pageKey: "crm.dashboard",
    path: "/app",
    permission: "crm.dashboard.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.stage.opportunities",
    path: "/app/etapas/oportunidades",
    permission: "crm.stages.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.stage.appointments",
    path: "/app/etapas/agendamentos",
    permission: "crm.stages.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.stage.visits",
    path: "/app/etapas/visitas",
    permission: "crm.stages.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.stage.folders",
    path: "/app/etapas/pastas",
    permission: "crm.stages.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.stage.sales",
    path: "/app/etapas/vendas",
    permission: "crm.stages.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.ranking",
    path: "/app/ranking",
    permission: "crm.ranking.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.partnerships",
    path: "/app/canal-de-parcerias",
    permission: "crm.partnerships.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.settings",
    path: "/app/configuracoes",
    permission: "crm.settings.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.settings.goals",
    path: "/app/configuracoes/metas",
    permission: "crm.settings.manage",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.settings.partnerships",
    path: "/app/configuracoes/metas/parcerias",
    permission: "crm.settings.manage",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.settings.points",
    path: "/app/configuracoes/metas/pontos",
    permission: "crm.settings.manage",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation",
    path: "/app/simulacao",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.wf13",
    path: "/app/simulacao/associativo-fluxo-linear",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.wf16",
    path: "/app/simulacao/calcular-documentacao",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.caixa",
    path: "/app/simulacao/caixa",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.wf14",
    path: "/app/simulacao/tabela-direta",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.tabelao",
    path: "/app/simulacao/tabelao",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "crm.simulation.wf15",
    path: "/app/simulacao/tabela-investidor",
    permission: "crm.simulators.view",
    releaseEnabled: true,
  },
  {
    pageKey: "admin.home",
    path: "/admin",
    permission: "admin.access",
    releaseEnabled: true,
  },
  {
    pageKey: "admin.users",
    path: "/admin/usuarios",
    permission: "users.view",
    releaseEnabled: true,
  },
  {
    pageKey: "admin.pages",
    path: "/admin/paginas",
    permission: "pages.manage",
    releaseEnabled: true,
  },
] as const satisfies readonly ProtectedPageGate[];

export function getProtectedPageGate(pathname: string): ProtectedPageGate | null {
  return PROTECTED_PAGE_GATES.find((page) => page.path === pathname) ?? null;
}
