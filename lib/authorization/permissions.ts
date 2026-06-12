import "server-only";

// Mirrors the `permissions` seed in M5.1/M5.2 migrations. Not a security boundary —
// the authoritative values live in the database. Update here when the seed changes.
// Do NOT add future page-specific permission keys here; declare them at development time.
export const PERMISSIONS = {
  "users.view": { description: "View user profiles and roles", minLevel: 10 },
  "users.manage": { description: "Create and modify users", minLevel: 80 },
  "permissions.view": { description: "View permission assignments", minLevel: 10 },
  "permissions.manage": { description: "Grant and revoke permission overrides", minLevel: 80 },
  "roles.view": { description: "View role definitions and assignments", minLevel: 10 },
  "roles.manage": { description: "Assign and modify user roles", minLevel: 80 },
  "audit.view": { description: "Read the audit log", minLevel: 80 },
  "admin.access": { description: "Access the admin panel", minLevel: 80 },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function getPermissionMinLevel(permissionKey: PermissionKey): number {
  return PERMISSIONS[permissionKey].minLevel;
}
