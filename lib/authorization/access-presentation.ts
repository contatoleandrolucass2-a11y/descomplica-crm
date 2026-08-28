import { PERMISSIONS, type PermissionKey } from "./permissions";
import type { RoleKey } from "./roles";

const BASE_NAVIGATION_PERMISSIONS = [
  "pages.view",
  "crm.dashboard.view",
  "crm.stages.view",
  "crm.ranking.view",
] as const satisfies readonly PermissionKey[];

const FUTURE_PERMISSIONS_ABSENT_FROM_PRODUCTION = new Set<PermissionKey>([
  "crm.read_model_v3.view",
  "crm.read_model_v3.ranking.view",
  "crm.read_model_v3.partnerships.view",
  "crm.read_model_v3.stock.view",
  "crm.commercial_engine.execute",
  "crm.commercial_policy.manage",
]);
const MASTER_PERMISSIONS = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
  (permission) => !FUTURE_PERMISSIONS_ABSENT_FROM_PRODUCTION.has(permission),
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
  "pages.manage",
  ...BASE_NAVIGATION_PERMISSIONS,
  "crm.settings.view",
  "crm.settings.manage",
  "crm.salesforce.refresh",
  "crm.ingest.manage",
] as const satisfies readonly PermissionKey[];
const NO_INHERITED_PERMISSIONS = [] as const satisfies readonly PermissionKey[];

// UI reflection of the production role_permissions baseline reconciled by this
// release. Database helpers and RLS remain authoritative; future foundations
// cannot appear here before their own production grants are approved.
export const ROLE_INHERITED_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  master: MASTER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  coordinator: BASE_NAVIGATION_PERMISSIONS,
  manager: NO_INHERITED_PERMISSIONS,
  supervisor: BASE_NAVIGATION_PERMISSIONS,
  house: NO_INHERITED_PERMISSIONS,
  real_estate: BASE_NAVIGATION_PERMISSIONS,
  partnership_channel: NO_INHERITED_PERMISSIONS,
  broker_lead: BASE_NAVIGATION_PERMISSIONS,
  broker: BASE_NAVIGATION_PERMISSIONS,
  user: BASE_NAVIGATION_PERMISSIONS,
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
