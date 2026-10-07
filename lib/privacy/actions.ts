"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  buildCookieConsent,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  serializeCookieConsent,
} from "./cookie-consent";
import { getApplicationOrigin } from "../security/origin";

export type CookieConsentActionState =
  | { status: "idle"; message: "" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function saveCookieConsentAction(
  _previousState: CookieConsentActionState,
  formData: FormData,
): Promise<CookieConsentActionState> {
  const choice = formData.get("choice");
  if (choice !== "all" && choice !== "essential" && choice !== "custom") {
    return {
      status: "error",
      message: "Escolha inválida. Revise as preferências e tente novamente.",
    };
  }

  const consent = buildCookieConsent({
    functional: choice === "all" || (choice === "custom" && formData.get("functional") === "on"),
    performance: choice === "all" || (choice === "custom" && formData.get("performance") === "on"),
    analytics: choice === "all" || (choice === "custom" && formData.get("analytics") === "on"),
  });
  const origin = getApplicationOrigin();
  if (!origin) {
    return {
      status: "error",
      message: "Não foi possível salvar agora. Recarregue a página e tente novamente.",
    };
  }

  try {
    (await cookies()).set(COOKIE_CONSENT_COOKIE_NAME, serializeCookieConsent(consent), {
      httpOnly: true,
      maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: origin.protocol === "https:",
    });
    revalidatePath("/", "layout");
    return { status: "saved", message: "Preferências salvas." };
  } catch {
    return {
      status: "error",
      message: "Não foi possível salvar agora. Recarregue a página e tente novamente.",
    };
  }
}
