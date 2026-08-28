import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/documents";

export const COOKIE_CONSENT_COOKIE_NAME = "descomplica-cookie-consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type CookieConsentCategories = {
  essential: true;
  security: true;
  functional: boolean;
  performance: boolean;
  analytics: boolean;
};

export type CookieConsent = {
  version: typeof LEGAL_DOCUMENT_VERSIONS.cookies;
  categories: CookieConsentCategories;
};

export function buildCookieConsent(
  optional: Partial<Pick<CookieConsentCategories, "functional" | "performance" | "analytics">>,
): CookieConsent {
  return {
    version: LEGAL_DOCUMENT_VERSIONS.cookies,
    categories: {
      essential: true,
      security: true,
      functional: optional.functional === true,
      performance: optional.performance === true,
      analytics: optional.analytics === true,
    },
  };
}

export function serializeCookieConsent(consent: CookieConsent): string {
  // Next's cookie serializer performs the wire encoding. Pre-encoding here
  // would produce a double-encoded value in the browser.
  return JSON.stringify(consent);
}

export function parseCookieConsent(value: string | null | undefined): CookieConsent | null {
  if (!value || value.length > 1_024) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<CookieConsent>;
    const categories = parsed.categories;
    if (
      parsed.version !== LEGAL_DOCUMENT_VERSIONS.cookies ||
      !categories ||
      categories.essential !== true ||
      categories.security !== true ||
      typeof categories.functional !== "boolean" ||
      typeof categories.performance !== "boolean" ||
      typeof categories.analytics !== "boolean"
    ) {
      return null;
    }
    return parsed as CookieConsent;
  } catch {
    return null;
  }
}
