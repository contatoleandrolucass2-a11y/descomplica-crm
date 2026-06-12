import "server-only";

// Mirrors the `roles` seed in M5.1 migration. Not a security boundary —
// the authoritative values live in the database. Update here when the seed changes.
export const ROLES = {
  master: { level: 100 },
  admin: { level: 80 },
  coordinator: { level: 60 },
  supervisor: { level: 50 },
  real_estate: { level: 40 },
  broker_lead: { level: 30 },
  broker: { level: 20 },
  user: { level: 10 },
} as const;

export type RoleKey = keyof typeof ROLES;

export function getRoleLevel(roleKey: RoleKey): number {
  return ROLES[roleKey].level;
}
