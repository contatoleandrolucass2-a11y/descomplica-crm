import "server-only";

import { redirect } from "next/navigation";

import { requireAuthorization, requirePermission } from "./guards";
import { AuthorizationError } from "./types";
import type { AuthorizationContext } from "./types";
import type { PermissionKey } from "./permissions";

// Bridges the throwing M5 guards to Next.js routing. The guards deliberately
// know nothing about routing (no next/navigation); this is the single place
// that maps an AuthorizationError.code to a destination and issues the
// redirect. Security remains enforced server-side by the guards + RPC + RLS —
// this only decides *where the browser goes* when access is denied.
//
// NEXT_REDIRECT handling: redirect() throws an internal control-flow
// exception. It must never be called inside a catch that could swallow it, so
// we record the destination in a variable and call redirect() AFTER the
// try/catch has completed.

function destinationFor(error: AuthorizationError): string {
  return error.code === "UNAUTHENTICATED" ? "/login" : "/unauthorized";
}

export async function enforceAuthorization(): Promise<AuthorizationContext> {
  let redirectTo: string | null = null;

  try {
    return await requireAuthorization();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirectTo = destinationFor(error);
    } else {
      throw error;
    }
  }

  if (redirectTo !== null) redirect(redirectTo);
  throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
}

export async function enforcePermission(permission: PermissionKey): Promise<AuthorizationContext> {
  let redirectTo: string | null = null;

  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirectTo = destinationFor(error);
    } else {
      throw error;
    }
  }

  if (redirectTo !== null) redirect(redirectTo);
  throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
}
