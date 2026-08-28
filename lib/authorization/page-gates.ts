import type { PermissionKey } from "./permissions";
import {
  legacyMigrationModuleIsEnabled,
  type LegacyMigrationModuleKey,
} from "../crm/legacy-migration/config";

export interface ProtectedPageGate {
  pageKey: string;
  path: string;
  permission: PermissionKey;
  releaseEnabled: boolean;
  runtimeModule?: LegacyMigrationModuleKey;
}

// Covers the complete 24-route HTTP smoke inventory. Runtime-gated legacy
// modules fail closed until their independent canary flags are enabled. The
// database remains authoritative for navigation and RLS; this copy lets Proxy
// return a real 403 before disabled or unauthorized code can stream.
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
    runtimeModule: "simulator.wf16",
  },
  {
    pageKey: "crm.simulation.caixa",
    path: "/app/simulacao/caixa",
    permission: "crm.simulators.view",
    releaseEnabled: true,
    runtimeModule: "simulator.caixa",
  },
  {
    pageKey: "crm.simulation.wf14",
    path: "/app/simulacao/tabela-direta",
    permission: "crm.simulators.view",
    releaseEnabled: true,
    runtimeModule: "simulator.wf14",
  },
  {
    pageKey: "crm.simulation.wf15",
    path: "/app/simulacao/tabela-investidor",
    permission: "crm.simulators.view",
    releaseEnabled: true,
    runtimeModule: "simulator.wf15",
  },
  {
    pageKey: "crm.simulation.tabelao",
    path: "/app/simulacao/tabela",
    permission: "crm.simulators.view",
    releaseEnabled: true,
    runtimeModule: "simulator.tabelao",
  },
  {
    pageKey: "crm.dialer",
    path: "/app/discador",
    permission: "crm.dialer.view",
    releaseEnabled: true,
    runtimeModule: "dialer",
  },
  {
    pageKey: "crm.dialer.weekend_forecast",
    path: "/app/discador/previsao-final-de-semana",
    permission: "crm.dialer.view",
    releaseEnabled: true,
    runtimeModule: "dialer.weekend-forecast",
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

export function protectedPageGateIsReleased(
  pageGate: { releaseEnabled: boolean; runtimeModule?: LegacyMigrationModuleKey | undefined },
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return (
    pageGate.releaseEnabled &&
    (!pageGate.runtimeModule || legacyMigrationModuleIsEnabled(pageGate.runtimeModule, environment))
  );
}
