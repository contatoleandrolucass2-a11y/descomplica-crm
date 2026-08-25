"use server";

import { redirect } from "next/navigation";

import { clearLocalAuthenticationCookies } from "@/lib/auth/clear-session";
import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { factorIdSchema, totpCodeSchema } from "@/lib/auth/mfa/schemas";
import type { MfaActionState } from "@/lib/auth/mfa/state";
import { createClient } from "@/lib/auth/supabase/server";

const GENERIC_MFA_ERROR = "Não foi possível concluir a verificação. Tente novamente.";

async function getAuthenticatedMfaClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const assurance = await getMfaAssurance(supabase);
  return assurance.status === "recovery" || assurance.status === "unavailable"
    ? null
    : { supabase, assurance };
}

export async function beginTotpEnrollmentAction(
  _previousState: MfaActionState,
): Promise<MfaActionState> {
  void _previousState;
  const authentication = await getAuthenticatedMfaClient();
  if (!authentication) return { status: "error", message: GENERIC_MFA_ERROR };
  const { assurance, supabase } = authentication;

  const factorsResult = await supabase.auth.mfa.listFactors();
  if (assurance.status === "required") {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }
  if (factorsResult.error || factorsResult.data.totp.length > 0) {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  for (const factor of factorsResult.data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Descomplica CRM",
  });
  if (
    error ||
    !data ||
    data.type !== "totp" ||
    !data.totp.qr_code.startsWith("data:image/svg+xml;") ||
    !/^[A-Z2-7]{16,128}$/i.test(data.totp.secret)
  ) {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  return {
    status: "idle",
    enrollment: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

export async function verifyTotpEnrollmentAction(
  _previousState: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  const factorId = factorIdSchema.safeParse(formData.get("factorId"));
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!factorId.success || !code.success) {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  const authentication = await getAuthenticatedMfaClient();
  if (!authentication || authentication.assurance.status === "required") {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }
  const { supabase } = authentication;

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.all.find(
    (candidate) =>
      candidate.id === factorId.data &&
      candidate.factor_type === "totp" &&
      candidate.status === "unverified",
  );
  if (factorsError || !factor) return { status: "error", message: GENERIC_MFA_ERROR };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (error || (await getMfaAssurance(supabase)).status !== "verified") {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  redirect("/conta/seguranca?mfa=enabled");
}

export async function verifyMfaChallengeAction(
  _previousState: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  const factorId = factorIdSchema.safeParse(formData.get("factorId"));
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!factorId.success || !code.success) {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  const authentication = await getAuthenticatedMfaClient();
  if (!authentication || authentication.assurance.status !== "required") {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }
  const { supabase } = authentication;

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((candidate) => candidate.id === factorId.data);
  if (factorsError || !factor) return { status: "error", message: GENERIC_MFA_ERROR };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (error || (await getMfaAssurance(supabase)).status !== "verified") {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }

  redirect("/");
}

export async function cancelTotpEnrollmentAction(formData: FormData): Promise<void> {
  const factorId = factorIdSchema.safeParse(formData.get("factorId"));
  if (!factorId.success) redirect("/conta/seguranca?mfa=error");

  const authentication = await getAuthenticatedMfaClient();
  if (!authentication) redirect("/login");
  if (authentication.assurance.status === "required") redirect("/mfa");
  const { supabase } = authentication;

  const { data, error } = await supabase.auth.mfa.listFactors();
  const factor = data?.all.find(
    (candidate) =>
      candidate.id === factorId.data &&
      candidate.factor_type === "totp" &&
      candidate.status === "unverified",
  );
  if (error || !factor) redirect("/conta/seguranca?mfa=error");

  const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  redirect(removeError ? "/conta/seguranca?mfa=error" : "/conta/seguranca?mfa=cancelled");
}

export async function removeMfaFactorAction(formData: FormData): Promise<void> {
  const factorId = factorIdSchema.safeParse(formData.get("factorId"));
  if (!factorId.success) redirect("/conta/seguranca?mfa=error");

  const authentication = await getAuthenticatedMfaClient();
  if (!authentication) redirect("/login");
  if (authentication.assurance.status !== "verified") redirect("/mfa");
  const { supabase } = authentication;

  const { data, error } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((candidate) => candidate.id === factorId.data);
  if (error || !factor) redirect("/conta/seguranca?mfa=error");

  // Revoke every other browser while the verified factor still protects the
  // account. If revocation fails, keep the factor enrolled and fail closed;
  // otherwise an old AAL1 session could regain access after the last factor
  // disappears.
  const { error: revokeOthersError } = await supabase.auth.signOut({ scope: "others" });
  if (revokeOthersError) redirect("/conta/seguranca?mfa=error");

  const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (removeError) redirect("/conta/seguranca?mfa=error");

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut({ scope: "local" });
    await clearLocalAuthenticationCookies();
    redirect("/login?mfa=removed");
  }
  redirect("/conta/seguranca?mfa=removed");
}
