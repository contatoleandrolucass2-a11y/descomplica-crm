import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import type { AuthorizationContext } from "@/lib/authorization/types";
import type { DisabledNavigationItem } from "@/lib/navigation/presentation";

const appPageRowSchema = z.object({
  key: z.string().min(1),
  path: z.string().startsWith("/"),
  name: z.string().min(1),
  description: z.string(),
  section: z.string().min(1),
  permission_key: z.string().min(1),
  parent_key: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
  is_navigation: z.boolean(),
  is_active: z.boolean(),
});

export interface AppPage {
  key: string;
  path: string;
  name: string;
  description: string;
  section: string;
  permissionKey: PermissionKey;
  parentKey: string | null;
  sortOrder: number;
  isNavigation: boolean;
  isActive: boolean;
}

interface SupplementalNavigationDefinition {
  key: string;
  path: string;
  name: string;
  description: string;
  sortOrder: number;
}

const SIMULATION_PARENT_KEY = "crm.simulation";
const SIMULATION_PARENT_PATH = "/app/simulacao";

function hasAuthorizedSimulationRoot(pages: AppPage[]) {
  return pages.some(
    (page) =>
      page.key === SIMULATION_PARENT_KEY &&
      page.path === SIMULATION_PARENT_PATH &&
      page.section === "simulation" &&
      page.permissionKey === "crm.simulators.view" &&
      page.parentKey === null &&
      page.isNavigation &&
      page.isActive,
  );
}

/**
 * Released simulator pages intentionally kept outside the 17-page database
 * catalog are discoverable only after the authenticated catalog has authorized
 * their parent and the route gate has authorized the caller's permission.
 */
const SUPPLEMENTAL_SIMULATOR_PAGES: readonly SupplementalNavigationDefinition[] = [
  {
    key: "crm.simulation.wf14",
    path: "/app/simulacao/tabela-direta",
    name: "Tabela Direta",
    description: "Monte e compare fluxos da Tabela Direta.",
    sortOrder: 30,
  },
  {
    key: "crm.simulation.wf15",
    path: "/app/simulacao/tabela-investidor",
    name: "Tabela Investidor",
    description: "Consulte a jornada comercial para investidores.",
    sortOrder: 40,
  },
  {
    key: "crm.simulation.tabelao",
    path: "/app/simulacao/tabelao",
    name: "Tabelão",
    description: "Consulte o estoque SPC disponível.",
    sortOrder: 50,
  },
  {
    key: "crm.simulation.wf16",
    path: "/app/simulacao/calcular-documentacao",
    name: "Documentação",
    description: "Calcule a documentação da proposta.",
    sortOrder: 60,
  },
  {
    key: "crm.simulation.caixa",
    path: "/app/simulacao/caixa",
    name: "CAIXA",
    description: "Consulte a jornada visual; cálculo e envio permanecem bloqueados.",
    sortOrder: 70,
  },
] as const;

export function extendAuthorizedNavigationWithReleasedPages(
  pages: AppPage[],
  context: AuthorizationContext,
): AppPage[] {
  const marketingGate = getProtectedPageGate("/app/configuracoes/recurso-mkt");
  const settingsParent = pages.find(
    (page) =>
      page.key === "crm.settings" &&
      page.path === "/app/configuracoes" &&
      page.section === "settings" &&
      page.permissionKey === "crm.settings.view" &&
      page.parentKey === null &&
      page.isActive &&
      page.isNavigation,
  );
  if (
    settingsParent &&
    marketingGate?.releaseEnabled &&
    marketingGate.pageKey === "crm.settings.marketing" &&
    context.permissions.includes(marketingGate.permission) &&
    !pages.some((page) => page.key === marketingGate.pageKey || page.path === marketingGate.path)
  ) {
    pages = [
      ...pages,
      {
        key: marketingGate.pageKey,
        path: marketingGate.path,
        name: "Recurso MKT",
        description: "Fundo de investimento de Marketing e distribuição dos recursos.",
        section: "settings",
        permissionKey: marketingGate.permission,
        parentKey: settingsParent.key,
        sortOrder: 50,
        isActive: true,
        isNavigation: true,
      },
    ];
  }
  if (!hasAuthorizedSimulationRoot(pages)) return pages;

  const occupiedKeys = new Set(pages.map((page) => page.key));
  const occupiedPaths = new Set(pages.map((page) => page.path));
  const supplementalPages: AppPage[] = [];

  for (const definition of SUPPLEMENTAL_SIMULATOR_PAGES) {
    const gate = getProtectedPageGate(definition.path);
    if (
      !gate?.releaseEnabled ||
      gate.pageKey !== definition.key ||
      !context.permissions.includes(gate.permission) ||
      occupiedKeys.has(definition.key) ||
      occupiedPaths.has(definition.path)
    ) {
      continue;
    }

    supplementalPages.push({
      ...definition,
      section: "simulation",
      permissionKey: gate.permission,
      parentKey: SIMULATION_PARENT_KEY,
      isNavigation: true,
      isActive: true,
    });
    occupiedKeys.add(definition.key);
    occupiedPaths.add(definition.path);
  }

  return [...pages, ...supplementalPages];
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

function parsePages(data: unknown): AppPage[] {
  const rows = z.array(appPageRowSchema).parse(data);

  return rows.map((row) => {
    if (!isPermissionKey(row.permission_key)) {
      throw new Error("Page catalog is out of sync with the application permission catalog.");
    }

    return {
      key: row.key,
      path: row.path,
      name: row.name,
      description: row.description,
      section: row.section,
      permissionKey: row.permission_key,
      parentKey: row.parent_key,
      sortOrder: row.sort_order,
      isNavigation: row.is_navigation,
      isActive: row.is_active,
    };
  });
}

function pageGateAuthorizesNavigation(page: AppPage, context: AuthorizationContext) {
  const gate = getProtectedPageGate(page.path);
  return (
    gate?.releaseEnabled === true &&
    gate.pageKey === page.key &&
    gate.permission === page.permissionKey &&
    context.permissions.includes(gate.permission)
  );
}

async function queryPages(options: { navigationOnly: boolean; activeOnly: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("app_pages")
    .select(
      "key,path,name,description,section,permission_key,parent_key,sort_order,is_navigation,is_active",
    )
    .order("section")
    .order("sort_order")
    .order("key");

  if (options.navigationOnly) query = query.eq("is_navigation", true);
  if (options.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load the authorized page catalog.");
  }

  return parsePages(data ?? []);
}

export async function getAuthorizedNavigation(context: AuthorizationContext): Promise<AppPage[]> {
  if (!context.permissions.includes("pages.view")) return [];

  const pages = await queryPages({ navigationOnly: true, activeOnly: true });
  const authorizedPages = pages.filter((page) => pageGateAuthorizesNavigation(page, context));
  return extendAuthorizedNavigationWithReleasedPages(authorizedPages, context);
}

export function getDisabledNavigationItems(
  context: AuthorizationContext,
  pages: AppPage[],
): DisabledNavigationItem[] {
  const caixaGate = getProtectedPageGate("/app/simulacao/caixa");

  if (
    !hasAuthorizedSimulationRoot(pages) ||
    !caixaGate ||
    caixaGate.releaseEnabled ||
    caixaGate.pageKey !== "crm.simulation.caixa" ||
    !context.permissions.includes(caixaGate.permission)
  ) {
    return [];
  }

  return [
    {
      key: caixaGate.pageKey,
      name: "CAIXA",
      description: "Jornada preservada até a autorização oficial.",
      section: "simulation",
      parentKey: SIMULATION_PARENT_KEY,
      sortOrder: 70,
      reason: "Aguardando autorização",
    },
  ];
}

export async function getManageablePages(): Promise<AppPage[]> {
  await requirePermission("pages.manage");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_app_pages_for_management");

  if (error) throw new Error("Unable to load the manageable page catalog.");
  return parsePages(data ?? []);
}
