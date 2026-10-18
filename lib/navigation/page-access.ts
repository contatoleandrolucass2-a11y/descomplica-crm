import type { SupabaseClient } from "@supabase/supabase-js";

import { PAGE_REGISTRY, type RegisteredPage } from "./registry";
import { pageGateAllowsRole } from "@/lib/authorization/page-gates";

export function pagePermissionMatches(page: RegisteredPage, permission: string): boolean {
  // During the ordered rollout the database still names the prior permission.
  // After activation only the new persisted key is accepted for that row. This
  // never falls back when a row is missing, inactive or denied by RLS.
  return permission === page.permission || permission === page.legacyPermission;
}

export async function hasPersistedPageAccess(
  client: Pick<SupabaseClient, "from">,
  pathname: string,
  roleKey: string,
  permissions: readonly string[],
): Promise<boolean> {
  const page: RegisteredPage | undefined = PAGE_REGISTRY.find((item) => item.path === pathname);
  if (!page?.releaseEnabled || !pageGateAllowsRole(page, roleKey)) return false;
  const { data, error } = await client
    .from("app_pages")
    .select("key,path,permission_key,is_active")
    .eq("key", page.pageKey)
    .eq("path", page.path)
    .eq("is_active", true)
    .maybeSingle();
  return (
    !error &&
    data?.key === page.pageKey &&
    data.path === page.path &&
    data.is_active === true &&
    typeof data.permission_key === "string" &&
    pagePermissionMatches(page, data.permission_key) &&
    permissions.includes(data.permission_key)
  );
}
