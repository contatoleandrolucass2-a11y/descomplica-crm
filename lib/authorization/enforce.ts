import "server-only";

import { forbidden, redirect } from "next/navigation";

import { requireAuthorization, requirePermission } from "./guards";
import { AuthorizationError } from "./types";
import type { AuthorizationContext } from "./types";
import type { PermissionKey } from "./permissions";

// Bridges the throwing M5 guards to Next.js routing. The guards deliberately
// know nothing about routing (no next/navigation); this is the single place
// that maps an AuthorizationError.code to a destination and issues the
// response. Security remains enforced server-side by guards + RPC + RLS; this
// layer maps an expected denial to the framework's real HTTP 403 interrupt.
//
// NEXT_REDIRECT handling: redirect() throws an internal control-flow
// exception. It must never be called inside a catch that could swallow it, so
// we record the destination in a variable and call redirect() AFTER the
// try/catch has completed.

export async function enforceAuthorization(): Promise<AuthorizationContext> {
  let denial: AuthorizationError["code"] | null = null;

  try {
    return await requireAuthorization();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      denial = error.code;
    } else {
      throw error;
    }
  }

  if (denial === "UNAUTHENTICATED") redirect("/login");
  forbidden();
}

export async function enforcePermission(permission: PermissionKey): Promise<AuthorizationContext> {
  let denial: AuthorizationError["code"] | null = null;

  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      denial = error.code;
    } else {
      throw error;
    }
  }

  if (denial === "UNAUTHENTICATED") redirect("/login");
  forbidden();
}
