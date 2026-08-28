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

export async function saveCookieConsentAction(formData: FormData): Promise<void> {
  const choice = formData.get("choice");
  if (choice !== "all" && choice !== "essential" && choice !== "custom") return;

  const consent = buildCookieConsent({
    functional: choice === "all" || (choice === "custom" && formData.get("functional") === "on"),
    performance: choice === "all" || (choice === "custom" && formData.get("performance") === "on"),
    analytics: choice === "all" || (choice === "custom" && formData.get("analytics") === "on"),
  });
  const origin = getApplicationOrigin();
  if (!origin) return;

  (await cookies()).set(COOKIE_CONSENT_COOKIE_NAME, serializeCookieConsent(consent), {
    httpOnly: true,
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: origin?.protocol === "https:",
  });
  revalidatePath("/", "layout");
}
