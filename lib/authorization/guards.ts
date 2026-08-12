import "server-only";

import { createClient } from "@/lib/auth/supabase/server";
import { ROLES } from "./roles";
import { PERMISSIONS } from "./permissions";
import {
  AuthorizationError,
  type AuthorizationContext,
  type PermissionKey,
  type RoleKey,
} from "./types";

// Application-layer authorization guards.
//
// These are a convenience/UX layer ONLY. The authoritative access decision
// lives in the database: RLS policies + the SECURITY DEFINER RPC
// `get_user_authorization_context`. Never treat a passing guard here as a
// substitute for those — the DB re-checks every privileged operation.

// Shape of a single row returned by the RPC. Kept local: the RPC is the
// source of truth, this only describes the wire format before validation.
interface AuthorizationContextRow {
  user_id: string;
  role_key: string;
  level: number;
  permissions: string[];
}

function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

// Resolve the caller's authorization context, or null when unauthenticated.
// An authenticated identity without an approved, scoped context is forbidden;
// treating it as anonymous would bounce between /login and /app forever because
// the login page correctly recognizes the still-valid Supabase session.
// Throws a generic FORBIDDEN error without leaking onboarding/profile details.
export async function getCurrentAuthorizationContext(): Promise<AuthorizationContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_user_authorization_context", {
    user_uuid: user.id,
  });

  if (error) {
    throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
  }

  const rows = (data ?? []) as AuthorizationContextRow[];
  const row = rows[0];

  // The session is valid, so an empty result means authorization denied rather
  // than unauthenticated. Keep that distinction all the way to forbidden().
  if (!row) {
    throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
  }

  // Defensive: validate the RPC payload against the local catalog before
  // trusting it. A mismatch means catalog drift — fail closed.
  if (!isRoleKey(row.role_key)) {
    throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
  }

  // Fail closed: an unknown permission key means catalog drift between the
  // DB and this layer. Do NOT silently filter — reject the whole context.
  const permissions: PermissionKey[] = [];
  for (const perm of row.permissions) {
    if (!isPermissionKey(perm)) {
      throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
    }
    permissions.push(perm);
  }

  return {
    userId: row.user_id,
    roleKey: row.role_key,
    level: row.level,
    permissions,
  };
}

// Like getCurrentAuthorizationContext but throws UNAUTHENTICATED when there is
// no resolvable context.
export async function requireAuthorization(): Promise<AuthorizationContext> {
  const context = await getCurrentAuthorizationContext();

  if (!context) {
    throw new AuthorizationError("UNAUTHENTICATED", "Authentication required.");
  }

  return context;
}

export function hasPermission(context: AuthorizationContext, permission: PermissionKey): boolean {
  return context.permissions.includes(permission);
}

export function hasAllPermissions(
  context: AuthorizationContext,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.every((p) => context.permissions.includes(p));
}

export function hasAnyPermission(
  context: AuthorizationContext,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((p) => context.permissions.includes(p));
}

export async function requirePermission(permission: PermissionKey): Promise<AuthorizationContext> {
  const context = await requireAuthorization();

  if (!hasPermission(context, permission)) {
    throw new AuthorizationError("FORBIDDEN", "Access denied.");
  }

  return context;
}

export async function requireAllPermissions(
  permissions: readonly PermissionKey[],
): Promise<AuthorizationContext> {
  const context = await requireAuthorization();

  if (!hasAllPermissions(context, permissions)) {
    throw new AuthorizationError("FORBIDDEN", "Access denied.");
  }

  return context;
}

export async function requireAnyPermission(
  permissions: readonly PermissionKey[],
): Promise<AuthorizationContext> {
  const context = await requireAuthorization();

  if (!hasAnyPermission(context, permissions)) {
    throw new AuthorizationError("FORBIDDEN", "Access denied.");
  }

  return context;
}
