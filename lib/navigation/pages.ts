import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import { getProtectedPageGate, pageGateAllowsRole } from "@/lib/authorization/page-gates";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import type { AuthorizationContext } from "@/lib/authorization/types";
import { PAGE_REGISTRY, type RegisteredPage } from "@/lib/navigation/registry";
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
    pageGateAllowsRole(gate, context.roleKey) &&
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

  // Navigation uses only persisted, authorized rows. A disabled or missing page is never recreated.
  const pages = await queryPages({ navigationOnly: false, activeOnly: false });
  const authorizedPages = pages.filter(
    (page) => page.isActive && page.isNavigation && pageGateAuthorizesNavigation(page, context),
  );
  return authorizedPages;
}

export function getDisabledNavigationItems(
  context: AuthorizationContext,
  pages: AppPage[],
): DisabledNavigationItem[] {
  const registry: readonly RegisteredPage[] = PAGE_REGISTRY;
  return registry
    .filter(
      (page) =>
        !page.releaseEnabled &&
        page.isNavigation &&
        pageGateAllowsRole(page, context.roleKey) &&
        context.permissions.includes(page.permission) &&
        page.parentKey !== null &&
        pages.some((parent) => parent.key === page.parentKey && parent.isActive),
    )
    .map((page) => ({
      key: page.pageKey,
      name: page.name,
      description: page.description,
      section: page.section,
      parentKey: page.parentKey!,
      sortOrder: page.sortOrder,
      reason: "Aguardando autorização",
    }));
}

export async function getManageablePages(): Promise<AppPage[]> {
  await requirePermission("pages.manage");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_app_pages_for_management");

  if (error) throw new Error("Unable to load the manageable page catalog.");
  return parsePages(data ?? []);
}
