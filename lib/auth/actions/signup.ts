"use server";

/**
 * Signup Server Action.
 *
 * Validates submission shape with `signupSchema`, then delegates account
 * creation to Supabase Auth via the SSR server client. Field-level
 * validation errors are returned per-field (they describe what the form
 * needs, not account state). Any Supabase-side failure collapses into a
 * single generic message — the client never sees Supabase error categories,
 * codes, or internal failure classifications.
 *
 * Boundaries:
 * - No log output; no credentials or account state in logs.
 * - No Service Role; uses the SSR server client only.
 * - No profile row, role, or permission is created here — that remains the
 *   authorization engine's responsibility (M5), not the signup surface.
 * - Navigation after a successful call is left entirely to the caller.
 */

import type { SignupActionState, SignupFieldErrors } from "@/lib/auth/actions/signup-state";
import { signupSchema } from "@/lib/auth/schemas/signup";
import { createClient } from "@/lib/auth/supabase/server";
import { isPublicSignupEnabled } from "@/lib/homologation/config";

const GENERIC_FAILURE_MESSAGE =
  "Não foi possível concluir o cadastro. Tente novamente em instantes.";

const GENERIC_SUCCESS_MESSAGE =
  "Cadastro recebido. Verifique seu e-mail ou faça login se sua conta já estiver ativa.";

export async function signupAction(
  _prevState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  if (!isPublicSignupEnabled()) {
    return { success: false, message: GENERIC_FAILURE_MESSAGE };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: GENERIC_FAILURE_MESSAGE,
      fieldErrors: parsed.error.flatten().fieldErrors as SignupFieldErrors,
    };
  }

  const { name, email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return { success: false, message: GENERIC_FAILURE_MESSAGE };
  }

  return { success: true, message: GENERIC_SUCCESS_MESSAGE };
}
