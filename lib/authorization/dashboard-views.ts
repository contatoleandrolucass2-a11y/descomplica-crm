import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

import type { PermissionKey } from "./permissions";

export const DASHBOARD_VIEW_PERMISSIONS = {
  all: "crm.dashboard.all.view",
  with_canal_imob: "crm.dashboard.with_canal_imob.view",
  without_canal_imob: "crm.dashboard.without_canal_imob.view",
} as const satisfies Record<DashboardViewKey, PermissionKey>;

export function getAuthorizedDashboardViews(
  permissions: readonly PermissionKey[],
): DashboardViewKey[] {
  return (Object.keys(DASHBOARD_VIEW_PERMISSIONS) as DashboardViewKey[]).filter((viewKey) =>
    permissions.includes(DASHBOARD_VIEW_PERMISSIONS[viewKey]),
  );
}
