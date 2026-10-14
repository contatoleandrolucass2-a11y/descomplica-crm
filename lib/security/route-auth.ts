import "server-only";

import type { AuthorizationContext } from "@/lib/authorization/types";
import { AuthorizationError } from "@/lib/authorization/types";
import { requireAuthorization, requirePermission } from "@/lib/authorization/guards";
import type { PermissionKey } from "@/lib/authorization/permissions";

import { noStoreHeaders } from "./api";

export type RouteAuthorizationResult =
  | { ok: true; context: AuthorizationContext }
  | { ok: false; response: Response };

export async function authorizeRoute(permission: PermissionKey): Promise<RouteAuthorizationResult> {
  return authorizeContext(() => requirePermission(permission));
}

/** Authenticated self-service endpoints still enforce approval, scope and MFA. */
export async function authorizeAuthenticatedRoute(): Promise<RouteAuthorizationResult> {
  return authorizeContext(requireAuthorization);
}

async function authorizeContext(
  authorize: () => Promise<AuthorizationContext>,
): Promise<RouteAuthorizationResult> {
  try {
    return { ok: true, context: await authorize() };
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    return {
      ok: false,
      response: Response.json(
        {
          error:
            error.code === "UNAUTHENTICATED"
              ? "unauthenticated"
              : error.code === "MFA_REQUIRED"
                ? "mfa_required"
                : error.code === "PASSWORD_RECOVERY_REQUIRED"
                  ? "password_recovery_required"
                  : "forbidden",
        },
        {
          status: error.code === "UNAUTHENTICATED" ? 401 : 403,
          headers: noStoreHeaders(),
        },
      ),
    };
  }
}
