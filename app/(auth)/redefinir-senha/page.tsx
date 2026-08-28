import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasFreshRecoveryAuthenticationMethod } from "@/lib/auth/mfa/assurance";
import { createClient } from "@/lib/auth/supabase/server";

import { PasswordResetForm } from "./PasswordResetForm";

export const metadata: Metadata = {
  title: "Redefinir senha | Descomplica CRM",
};

export default async function PasswordResetPage() {
  const supabase = await createClient({ persistence: { kind: "temporary" } });
  const [userResult, claimsResult, sessionResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
    supabase.rpc("current_session_is_live"),
  ]);

  if (
    !userResult.data.user ||
    claimsResult.error ||
    sessionResult.error ||
    sessionResult.data !== true ||
    !hasFreshRecoveryAuthenticationMethod(claimsResult.data?.claims)
  ) {
    redirect("/esqueci-senha?status=invalid");
  }

  return <PasswordResetForm />;
}
