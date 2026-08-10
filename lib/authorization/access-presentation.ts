import { PERMISSIONS, type PermissionKey } from "./permissions";
import type { RoleKey } from "./roles";

const VISUAL_FOUNDATION_PERMISSIONS = [
  "pages.view",
  "crm.simulators.view",
] as const satisfies readonly PermissionKey[];

const MASTER_PERMISSIONS = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
  (permission) =>
    permission !== "crm.simulators.execute" && permission !== "crm.commercial_engine.execute",
);
const ADMIN_PERMISSIONS = [
  "users.view",
  "users.manage",
  "permissions.view",
  "permissions.manage",
  "roles.view",
  "roles.manage",
  "audit.view",
  "admin.access",
  ...VISUAL_FOUNDATION_PERMISSIONS,
] as const satisfies readonly PermissionKey[];
const NO_INHERITED_PERMISSIONS = [] as const satisfies readonly PermissionKey[];

// UI reflection of role_permissions. Database helpers and RLS remain the
// authority; this map only explains inherited access and builds change summaries.
export const ROLE_INHERITED_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  master: MASTER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  coordinator: VISUAL_FOUNDATION_PERMISSIONS,
  manager: NO_INHERITED_PERMISSIONS,
  supervisor: VISUAL_FOUNDATION_PERMISSIONS,
  house: NO_INHERITED_PERMISSIONS,
  real_estate: VISUAL_FOUNDATION_PERMISSIONS,
  partnership_channel: NO_INHERITED_PERMISSIONS,
  broker_lead: VISUAL_FOUNDATION_PERMISSIONS,
  broker: VISUAL_FOUNDATION_PERMISSIONS,
  user: VISUAL_FOUNDATION_PERMISSIONS,
  pending: NO_INHERITED_PERMISSIONS,
};

export interface AccessChangeSummary {
  added: PermissionKey[];
  removed: PermissionKey[];
}

export function summarizeRoleChange(
  currentRole: RoleKey | null,
  nextRole: RoleKey,
): AccessChangeSummary {
  const current = new Set(currentRole ? ROLE_INHERITED_PERMISSIONS[currentRole] : []);
  const next = new Set(ROLE_INHERITED_PERMISSIONS[nextRole]);

  return {
    added: [...next].filter((permission) => !current.has(permission)),
    removed: [...current].filter((permission) => !next.has(permission)),
  };
}
