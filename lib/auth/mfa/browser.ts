"use client";

import type { MfaActionState } from "@/lib/auth/mfa/state";

const GENERIC_MFA_ERROR = "Não foi possível concluir a verificação. Tente novamente.";

export async function verifyMfaViaRoute(
  _previousState: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  void _previousState;
  const flow = formData.get("flow");
  const destination =
    flow === "challenge" ? "/app" : flow === "enrollment" ? "/conta/seguranca?mfa=enabled" : null;
  if (!destination) return { status: "error", message: GENERIC_MFA_ERROR };

  try {
    const body = new URLSearchParams();
    for (const key of ["flow", "factorId", "code"]) {
      const value = formData.get(key);
      if (typeof value === "string") body.set(key, value);
    }
    const response = await fetch("/auth/mfa/verify", {
      method: "POST",
      body,
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { status: "error", message: GENERIC_MFA_ERROR };

    window.location.assign(destination);
    return { status: "idle" };
  } catch {
    return { status: "error", message: GENERIC_MFA_ERROR };
  }
}
