"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clearLocalAuthenticationCookies } from "../clear-session";
import type { RecoveryActionState } from "./recovery-state";
import { hasFreshRecoveryAuthenticationMethod } from "../mfa/assurance";
import { passwordRecoveryRequestSchema, passwordResetSchema } from "../schemas/recovery";
import { buildSessionPersistenceCookie, issueSessionPersistence } from "../session-persistence";
import { createClient } from "../supabase/server";
import { getApplicationUrl } from "../../security/origin";

const GENERIC_REQUEST_MESSAGE =
  "Se houver uma conta elegível para esse e-mail, enviaremos as instruções de redefinição.";
const GENERIC_RESET_FAILURE =
  "Não foi possível redefinir a senha. Solicite um novo link e tente novamente.";

export async function requestPasswordRecoveryAction(
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const parsed = passwordRecoveryRequestSchema.safeParse({ email: formData.get("email") });
  const callbackUrl = getApplicationUrl("/auth/callback");

  if (parsed.success && callbackUrl) {
    const supabase = await createClient({ persistence: { kind: "temporary" } });
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: callbackUrl.toString(),
    });
  }

  return { status: "success", message: GENERIC_REQUEST_MESSAGE };
}

export async function resetPasswordAction(
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const parsed = passwordResetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_RESET_FAILURE,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

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
    return { status: "error", message: GENERIC_RESET_FAILURE };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) return { status: "error", message: GENERIC_RESET_FAILURE };

  const revocation = await supabase.rpc("revoke_current_user_sessions_after_password_recovery");
  let sessionsRevoked = !revocation.error && revocation.data === true;
  if (!sessionsRevoked) {
    const fallback = await supabase.auth.signOut({ scope: "global" });
    sessionsRevoked = !fallback.error;
  }

  await clearLocalAuthenticationCookies();
  const marker = buildSessionPersistenceCookie(issueSessionPersistence(undefined));
  (await cookies()).set(marker.name, marker.value, marker.options);

  if (!sessionsRevoked) return { status: "error", message: GENERIC_RESET_FAILURE };
  redirect("/login?password=updated");
}
