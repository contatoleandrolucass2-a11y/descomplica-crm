import "server-only";

// Mirrors the `permissions` seed in M5.1/M5.2 migrations. Not a security boundary —
// the authoritative values live in the database. Update here when the seed changes.
// Page-specific keys are added here in the same change as their database seed.
export const PERMISSIONS = {
  "users.view": { description: "View user profiles and roles", minLevel: 10 },
  "users.manage": { description: "Create and modify users", minLevel: 80 },
  "permissions.view": { description: "View permission assignments", minLevel: 10 },
  "permissions.manage": { description: "Grant and revoke permission overrides", minLevel: 80 },
  "roles.view": { description: "View role definitions and assignments", minLevel: 10 },
  "roles.manage": { description: "Assign and modify user roles", minLevel: 80 },
  "audit.view": { description: "Read the audit log", minLevel: 80 },
  "admin.access": { description: "Access the admin panel", minLevel: 80 },
  "pages.view": { description: "View the authorized page catalog", minLevel: 10 },
  "pages.manage": { description: "Manage page catalog visibility", minLevel: 80 },
  "crm.dashboard.view": { description: "View the CRM dashboard", minLevel: 10 },
  "crm.stages.view": { description: "View CRM funnel stage details", minLevel: 10 },
  "crm.ranking.view": { description: "View CRM rankings", minLevel: 10 },
  "crm.settings.view": { description: "View CRM settings", minLevel: 80 },
  "crm.settings.manage": { description: "Change CRM goals and point settings", minLevel: 80 },
  "crm.salesforce.refresh": { description: "Request a Salesforce data refresh", minLevel: 80 },
  "crm.ingest.manage": { description: "Run and inspect CRM ingestion", minLevel: 80 },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function getPermissionMinLevel(permissionKey: PermissionKey): number {
  return PERMISSIONS[permissionKey].minLevel;
}
