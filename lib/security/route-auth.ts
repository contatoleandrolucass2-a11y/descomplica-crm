import "server-only";

import type { AuthorizationContext } from "@/lib/authorization/types";
import { AuthorizationError } from "@/lib/authorization/types";
import { requirePermission } from "@/lib/authorization/guards";
import type { PermissionKey } from "@/lib/authorization/permissions";

import { noStoreHeaders } from "./api";

export type RouteAuthorizationResult =
  | { ok: true; context: AuthorizationContext }
  | { ok: false; response: Response };

export async function authorizeRoute(permission: PermissionKey): Promise<RouteAuthorizationResult> {
  try {
    return { ok: true, context: await requirePermission(permission) };
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    return {
      ok: false,
      response: Response.json(
        { error: error.code === "UNAUTHENTICATED" ? "unauthenticated" : "forbidden" },
        {
          status: error.code === "UNAUTHENTICATED" ? 401 : 403,
          headers: noStoreHeaders(),
        },
      ),
    };
  }
}
