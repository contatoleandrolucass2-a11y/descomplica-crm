import type { ReactNode } from "react";

import { enforceAnyPermission } from "@/lib/authorization/enforce";
import type { PermissionKey } from "@/lib/authorization/permissions";
import { PAGE_REGISTRY } from "@/lib/navigation/registry";

// This check runs in the /app layout, outside the sibling loading.tsx
// Suspense boundary. It prevents an unauthorized request from committing a
// streamed HTTP 200 before the page-specific guard can return the real 403.
// Page guards and RLS still enforce the exact permission for each child route.
const APP_SURFACE_PERMISSIONS = [
  ...PAGE_REGISTRY.filter((page) => page.releaseEnabled && page.path.startsWith("/app")).map(
    (page) => page.permission,
  ),
  "crm.dashboard.view",
  "crm.stages.view",
  "crm.ranking.view",
  "crm.partnerships.view",
  "crm.read_model_v3.view",
  "crm.read_model_v3.ranking.view",
  "crm.read_model_v3.partnerships.view",
  "crm.read_model_v3.stock.view",
  "crm.simulators.view",
  "crm.settings.view",
  "crm.settings.manage",
] as const satisfies readonly PermissionKey[];

export default async function AppLayout({ children }: { children: ReactNode }) {
  await enforceAnyPermission(APP_SURFACE_PERMISSIONS);
  return children;
}
