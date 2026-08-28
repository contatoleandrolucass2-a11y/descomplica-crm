/**
 * Root route (/) — session-based routing (M6.5).
 *
 * Authenticates first, enforces recovery/MFA assurance, then resolves the first
 * authorized navigation entry. An authenticated user without an approved CRM
 * context still reaches the account-security surface instead of a data route.
 */

import { forbidden, redirect } from "next/navigation";

import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { createClient } from "@/lib/auth/supabase/server";
import { getCurrentAuthorizationContext } from "@/lib/authorization/guards";
import { AuthorizationError } from "@/lib/authorization/types";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";
import { getNavigationHome } from "@/lib/navigation/presentation";

export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const assurance = await getMfaAssurance(supabase);
  if (assurance.status === "recovery") redirect("/redefinir-senha");
  if (assurance.status === "required") redirect("/mfa");
  if (assurance.status === "unavailable") forbidden();

  let context = null;
  try {
    context = await getCurrentAuthorizationContext();
  } catch (error) {
    if (!(error instanceof AuthorizationError) || error.code !== "FORBIDDEN") throw error;
  }

  if (!context) redirect("/conta/seguranca");

  const home = getNavigationHome(await getAuthorizedNavigation(context));
  redirect(home?.path ?? "/conta/seguranca");
}
