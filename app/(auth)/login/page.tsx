import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/auth/supabase/server";
import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { isPublicSignupEnabled } from "@/lib/homologation/config";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | Descomplica Platform",
};

// Session handling (M7.4): an already-authenticated visitor is sent through
// the authorized-home resolver at `/` instead of seeing the login form again.
// Recovery and AAL1-with-MFA sessions are quarantined first. Absent or failed
// getUser() is treated as "no session" and renders the form normally.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const assurance = await getMfaAssurance(supabase);
    if (assurance.status === "recovery") redirect("/redefinir-senha");
    if (assurance.status === "required") redirect("/mfa");
    if (assurance.status !== "unavailable") redirect("/");
  }

  const params = await searchParams;
  const notice =
    params.password === "updated"
      ? "Senha redefinida. Todas as sessões foram encerradas; entre novamente."
      : null;

  return (
    <LoginForm publicSignupEnabled={isPublicSignupEnabled()} {...(notice ? { notice } : {})} />
  );
}
