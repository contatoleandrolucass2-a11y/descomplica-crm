import { PERMISSIONS, type PermissionKey } from "./permissions";
import type { RoleKey } from "./roles";

const CRM_READER_PERMISSIONS = [
  "pages.view",
  "crm.dashboard.view",
  "crm.stages.view",
  "crm.ranking.view",
  "crm.simulators.view",
] as const satisfies readonly PermissionKey[];

const ADMIN_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

// UI reflection of role_permissions. Database helpers and RLS remain the
// authority; this map only explains inherited access and builds change summaries.
export const ROLE_INHERITED_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  master: ADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  coordinator: CRM_READER_PERMISSIONS,
  supervisor: CRM_READER_PERMISSIONS,
  real_estate: CRM_READER_PERMISSIONS,
  broker_lead: CRM_READER_PERMISSIONS,
  broker: CRM_READER_PERMISSIONS,
  user: CRM_READER_PERMISSIONS,
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
