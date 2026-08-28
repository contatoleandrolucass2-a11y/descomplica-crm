import "server-only";

import type { RoleKey } from "./roles";
import type { PermissionKey } from "./permissions";

// These types mirror the authorization engine defined in M5.1/M5.2/M5.3.0 SQL migrations.
// Security is enforced by RLS and SECURITY DEFINER RPCs — these types are a compile-time
// reflection of that catalog, not a source of truth for access decisions.

export type { RoleKey, PermissionKey };

export interface AuthorizationContext {
  userId: string;
  roleKey: RoleKey;
  level: number;
  permissions: PermissionKey[];
}

export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "PASSWORD_RECOVERY_REQUIRED"
  | "FORBIDDEN";

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export interface AdminMutationResult {
  ok: true;
  audit_id?: number | null;
  noop?: boolean;
}
