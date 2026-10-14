import "server-only";

import { ROLES } from "./roles";
import { PERMISSIONS } from "./permissions";
import { AuthorizationError } from "./types";
import type { AuthorizationContext } from "./types";
import type { RoleKey } from "./roles";
import type { PermissionKey } from "./permissions";

// Application-layer pre-check for anti-escalation rules. Mirrors the guards
// enforced by the SECURITY DEFINER SQL functions (M5.2). This is UX/early-exit
// ONLY — the final authority remains the RPCs / RLS / Postgres, which re-check
// every mutation. Never treat a passing check here as authorization.

// Rule 1: an actor can only manage a target strictly below its own level.
// Equality is NOT allowed (peers cannot manage peers).
export function canManageTargetLevel(actor: AuthorizationContext, targetLevel: number): boolean {
  return actor.level > targetLevel;
}

export function requireCanManageTargetLevel(
  actor: AuthorizationContext,
  targetLevel: number,
): void {
  if (!canManageTargetLevel(actor, targetLevel)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}

// Administrator accounts are a protected resource, not merely another numeric
// level. Keeping this rule explicit prevents a future level/catalog change from
// turning peer administration back on accidentally. Master accounts remain
// outside normal account-management flows altogether.
export function canManageTargetRole(
  actor: AuthorizationContext,
  targetRoleKey: RoleKey,
  targetLevel: number = ROLES[targetRoleKey].level,
): boolean {
  if (targetRoleKey === "master") return false;
  if (targetRoleKey === "admin" && actor.roleKey !== "master") return false;
  return canManageTargetLevel(actor, targetLevel);
}

export function requireCanManageTargetRole(
  actor: AuthorizationContext,
  targetRoleKey: RoleKey,
  targetLevel: number = ROLES[targetRoleKey].level,
): void {
  if (!canManageTargetRole(actor, targetRoleKey, targetLevel)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}

// Rule 2: an actor can only assign a role strictly below its own level.
export function canAssignRole(actor: AuthorizationContext, targetRoleKey: RoleKey): boolean {
  const targetRole = ROLES[targetRoleKey];
  return (
    targetRole.assignable &&
    targetRoleKey !== "master" &&
    (targetRoleKey !== "admin" || actor.roleKey === "master") &&
    actor.level > targetRole.level
  );
}

export function requireCanAssignRole(actor: AuthorizationContext, targetRoleKey: RoleKey): void {
  if (!canAssignRole(actor, targetRoleKey)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}

// Rule 3: an actor can only grant a permission it holds. Master may delegate
// any held permission to a strictly lower target even when minLevel equals the
// Master level. Other roles still require minLevel strictly below their level.
// Target hierarchy and protected Administrator accounts are checked separately
// by requireCanManageTargetRole.
// Inventory brands require individual access outside the Administrator defaults.
// Permission managers can delegate those two accesses without receiving unit access.
export function canGrantPermission(
  actor: AuthorizationContext,
  permission: PermissionKey,
): boolean {
  const managesInventoryBrand =
    (permission === "crm.inventory.riva.view" || permission === "crm.inventory.direcional.view") &&
    actor.permissions.includes("permissions.manage");
  return (
    (actor.permissions.includes(permission) || managesInventoryBrand) &&
    (actor.roleKey === "master" || actor.level > PERMISSIONS[permission].minLevel)
  );
}

export function requireCanGrantPermission(
  actor: AuthorizationContext,
  permission: PermissionKey,
): void {
  if (!canGrantPermission(actor, permission)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}

export function canGrantAllPermissions(
  actor: AuthorizationContext,
  permissions: readonly PermissionKey[],
): boolean {
  // Fail closed: an empty set is not a grantable "all" — reject it.
  return permissions.length > 0 && permissions.every((p) => canGrantPermission(actor, p));
}

export function requireCanGrantAllPermissions(
  actor: AuthorizationContext,
  permissions: readonly PermissionKey[],
): void {
  if (!canGrantAllPermissions(actor, permissions)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}

export function canGrantAnyPermission(
  actor: AuthorizationContext,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((p) => canGrantPermission(actor, p));
}

export function requireCanGrantAnyPermission(
  actor: AuthorizationContext,
  permissions: readonly PermissionKey[],
): void {
  if (!canGrantAnyPermission(actor, permissions)) {
    throw new AuthorizationError("FORBIDDEN", "Operation not allowed.");
  }
}
