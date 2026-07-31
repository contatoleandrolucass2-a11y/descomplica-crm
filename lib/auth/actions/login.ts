"use server";

/**
 * Login Server Action.
 *
 * Validates submission shape with `loginSchema`, then delegates credential
 * verification to Supabase Auth via the SSR server client. Every failure
 * branch — schema rejection, unknown identifier, wrong secret, locked
 * account, transient backend error — collapses into a single generic
 * user-facing message per
 * `AUTH_SECURITY.md > Account Enumeration Prevention`.
 *
 * This Action is the trust boundary: the client never sees Supabase error
 * categories, codes, or internal failure classifications.
 *
 * Boundaries:
 * - No log output; no credentials or authentication state in logs.
 * - No Service Role; uses the SSR server client only.
 * - No protection-style redirects; only the post-success redirect to "/".
 * - `redirect("/")` is intentionally OUTSIDE any try/catch so Next.js can
 *   propagate its internal control-flow exception unimpeded.
 */

import { redirect } from "next/navigation";

import type { LoginActionState } from "@/lib/auth/actions/login-state";
import { loginSchema } from "@/lib/auth/schemas/login";
import { createClient } from "@/lib/auth/supabase/server";

const GENERIC_FAILURE_MESSAGE =
  "Não foi possível autenticar. Verifique suas credenciais e tente novamente.";

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  redirect("/");
}
