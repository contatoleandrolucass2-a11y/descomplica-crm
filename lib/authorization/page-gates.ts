import { PAGE_REGISTRY, type RegisteredPage } from "@/lib/navigation/registry";
import type { PermissionKey } from "./permissions";
import type { RoleKey } from "./roles";

export interface ProtectedPageGate {
  pageKey: string;
  path: string;
  permission: PermissionKey;
  releaseEnabled: boolean;
  allowedRoles?: readonly RoleKey[];
}

export function pageGateAllowsRole(
  gate: Pick<ProtectedPageGate, "allowedRoles">,
  roleKey: unknown,
): boolean {
  return (
    gate.allowedRoles === undefined ||
    gate.allowedRoles.some((allowedRole) => allowedRole === roleKey)
  );
}

// Database grants and route guards remain authoritative. Proxy uses the same registration.
export const PROTECTED_PAGE_GATES: readonly ProtectedPageGate[] = PAGE_REGISTRY.map(
  (page: RegisteredPage) => ({
    pageKey: page.pageKey,
    path: page.path,
    permission: page.permission,
    releaseEnabled: page.releaseEnabled,
    ...(page.allowedRoles ? { allowedRoles: page.allowedRoles } : {}),
  }),
);

export function getProtectedPageGate(pathname: string): ProtectedPageGate | null {
  return PROTECTED_PAGE_GATES.find((page) => page.path === pathname) ?? null;
}
