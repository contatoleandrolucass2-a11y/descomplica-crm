import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, revalidatePath } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

import {
  getMfaAssurance,
  hasFreshRecoveryAuthenticationMethod,
  hasRecoveryAuthenticationMethod,
  PASSWORD_RECOVERY_ASSURANCE_MAX_AGE_SECONDS,
} from "../lib/auth/mfa/assurance";
import { isRecoveryTokenHash } from "../lib/auth/recovery-token";
import { passwordSchema } from "../lib/auth/schemas/password";
import { passwordRecoveryRequestSchema, passwordResetSchema } from "../lib/auth/schemas/recovery";
import {
  buildCookieConsent,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  parseCookieConsent,
  serializeCookieConsent,
} from "../lib/privacy/cookie-consent";
import { saveCookieConsentAction } from "../lib/privacy/actions";
import { getApplicationOrigin, getApplicationUrl } from "../lib/security/origin";

describe("password and recovery schemas", () => {
  const validPassword = "Abcd1234!xyz";

  it("accepts only official implicit and PKCE recovery token-hash forms", () => {
    const digest = "a".repeat(56);
    expect(isRecoveryTokenHash(digest)).toBe(true);
    expect(isRecoveryTokenHash(`pkce_${digest}`)).toBe(true);
    expect(isRecoveryTokenHash(`implicit_${digest}`)).toBe(false);
    expect(isRecoveryTokenHash("A".repeat(56))).toBe(false);
    expect(isRecoveryTokenHash("a".repeat(55))).toBe(false);
    expect(isRecoveryTokenHash(undefined)).toBe(false);
  });

  it("accepts 12 and 128 characters with every required class", () => {
    expect(validPassword).toHaveLength(12);
    expect(passwordSchema.safeParse(validPassword).success).toBe(true);

    const maximumPassword = `A1!${"a".repeat(125)}`;
    expect(maximumPassword).toHaveLength(128);
    expect(passwordSchema.safeParse(maximumPassword).success).toBe(true);
  });

  it.each([
    ["short", "Ab1!short"],
    ["long", `A1!${"a".repeat(126)}`],
    ["uppercase", "abcd1234!xyz"],
    ["lowercase", "ABCD1234!XYZ"],
    ["number", "Abcdefgh!xyz"],
    ["symbol", "Abcd12345xyz"],
  ])("rejects invalid %s password", (_case, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it("normalizes recovery email and rejects mismatched confirmation", () => {
    expect(passwordRecoveryRequestSchema.parse({ email: "  USER@EXAMPLE.COM " })).toEqual({
      email: "user@example.com",
    });
    expect(
      passwordResetSchema.safeParse({
        password: validPassword,
        confirmPassword: `${validPassword}!`,
      }).success,
    ).toBe(false);
  });
});

describe("cookie consent", () => {
  beforeEach(() => {
    cookieSet.mockClear();
    revalidatePath.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps required categories enabled and optional categories disabled by default", () => {
    expect(buildCookieConsent({}).categories).toEqual({
      essential: true,
      security: true,
      functional: false,
      performance: false,
      analytics: false,
    });
  });

  it("round-trips valid consent and rejects malformed or weakened values", () => {
    const valid = buildCookieConsent({ functional: true });
    const serialized = serializeCookieConsent(valid);
    expect(serialized.startsWith("%7B")).toBe(false);
    expect(parseCookieConsent(serialized)).toEqual(valid);
    expect(parseCookieConsent("not-json")).toBeNull();
    expect(parseCookieConsent("x".repeat(1_025))).toBeNull();
    expect(
      parseCookieConsent(
        encodeURIComponent(
          JSON.stringify({ ...valid, categories: { ...valid.categories, security: false } }),
        ),
      ),
    ).toBeNull();
    expect(
      parseCookieConsent(encodeURIComponent(JSON.stringify({ ...valid, version: "obsolete" }))),
    ).toBeNull();
  });

  it("writes an HTTPS-only, HttpOnly and SameSite=Lax consent cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://crm.example.test");
    const formData = new FormData();
    formData.set("choice", "essential");

    await saveCookieConsentAction(formData);

    expect(cookieSet).toHaveBeenCalledWith(COOKIE_CONSENT_COOKIE_NAME, expect.any(String), {
      httpOnly: true,
      maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not write consent when APP_ORIGIN is invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "//external.example.test");
    const formData = new FormData();
    formData.set("choice", "all");

    await saveCookieConsentAction(formData);

    expect(cookieSet).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("application origin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only an exact HTTPS origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://crm.example.test");
    expect(getApplicationOrigin()?.href).toBe("https://crm.example.test/");
    expect(getApplicationUrl("/auth/callback")?.href).toBe(
      "https://crm.example.test/auth/callback",
    );

    vi.stubEnv("APP_ORIGIN", "http://crm.example.test");
    expect(getApplicationOrigin()).toBeNull();
    vi.stubEnv("APP_ORIGIN", "https://crm.example.test/untrusted-path");
    expect(getApplicationOrigin()).toBeNull();
    vi.stubEnv("APP_ORIGIN", "https://user:pass@crm.example.test");
    expect(getApplicationOrigin()).toBeNull();
    vi.stubEnv("APP_ORIGIN", "//external.example.test");
    expect(getApplicationOrigin()).toBeNull();
  });

  it("allows HTTP only for an exact loopback origin in a local production-mode gate", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:4173");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(getApplicationOrigin()).toBeNull();

    vi.stubEnv("AUTH_LOCAL_INSECURE_LOOPBACK_QA", "true");
    expect(getApplicationOrigin()?.href).toBe("http://127.0.0.1:4173/");

    vi.stubEnv("APP_ORIGIN", "http://localhost:4173");
    expect(getApplicationOrigin()?.href).toBe("http://localhost:4173/");

    vi.stubEnv("APP_ORIGIN", "http://crm.example.test:4173");
    expect(getApplicationOrigin()).toBeNull();

    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:4173");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    expect(getApplicationOrigin()).toBeNull();
  });
});

describe("MFA assurance and recovery claims", () => {
  function supabaseWithAssurance(
    data: unknown,
    error: unknown = null,
    session: { data: unknown; error: unknown } = { data: true, error: null },
    claims: { data: unknown; error: unknown } = {
      data: { claims: { amr: [{ method: "password", timestamp: 1_000 }] } },
      error: null,
    },
  ) {
    return {
      auth: {
        getClaims: vi.fn().mockResolvedValue(claims),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data, error }),
        },
      },
      rpc: vi.fn().mockResolvedValue(session),
    } as never;
  }

  it.each([
    [
      { currentLevel: "aal1", nextLevel: "aal1" },
      { status: "optional", currentLevel: "aal1" },
    ],
    [
      { currentLevel: "aal1", nextLevel: "aal2" },
      { status: "required", currentLevel: "aal1" },
    ],
    [
      { currentLevel: "aal2", nextLevel: "aal2" },
      { status: "verified", currentLevel: "aal2" },
    ],
  ])("maps Supabase AAL %o to %o", async (data, expected) => {
    await expect(getMfaAssurance(supabaseWithAssurance(data))).resolves.toEqual(expected);
  });

  it("fails closed when assurance cannot be verified", async () => {
    await expect(
      getMfaAssurance(supabaseWithAssurance(null, new Error("unavailable"))),
    ).resolves.toEqual({ status: "unavailable", currentLevel: null });
  });

  it.each([
    ["revoked session", { data: false, error: null }],
    ["session RPC error", { data: null, error: new Error("rpc unavailable") }],
  ])("fails closed for %s", async (_case, session) => {
    await expect(
      getMfaAssurance(
        supabaseWithAssurance(
          { currentLevel: "aal2", nextLevel: "aal2" },
          null,
          session as { data: unknown; error: unknown },
        ),
      ),
    ).resolves.toEqual({ status: "unavailable", currentLevel: null });
  });

  it("recognizes only official email-recovery assurance methods", () => {
    expect(hasRecoveryAuthenticationMethod({ amr: ["recovery"] })).toBe(true);
    expect(hasRecoveryAuthenticationMethod({ amr: [{ method: "recovery" }] })).toBe(true);
    expect(hasRecoveryAuthenticationMethod({ amr: [{ method: "otp" }] })).toBe(true);
    expect(hasRecoveryAuthenticationMethod({ amr: [{ method: "password" }] })).toBe(false);
    expect(hasRecoveryAuthenticationMethod({ amr: "recovery" })).toBe(false);
    expect(hasRecoveryAuthenticationMethod(null)).toBe(false);
  });

  it("quarantines recovery assurance and accepts it only inside the short reset window", async () => {
    const timestamp = 2_000;
    const claims = { amr: [{ method: "otp", timestamp }] };
    await expect(
      getMfaAssurance(
        supabaseWithAssurance(
          { currentLevel: "aal1", nextLevel: "aal1" },
          null,
          { data: true, error: null },
          { data: { claims }, error: null },
        ),
      ),
    ).resolves.toEqual({ status: "recovery", currentLevel: "aal1" });
    expect(hasFreshRecoveryAuthenticationMethod(claims, { nowEpochSeconds: timestamp + 60 })).toBe(
      true,
    );
    expect(
      hasFreshRecoveryAuthenticationMethod(claims, {
        nowEpochSeconds: timestamp + PASSWORD_RECOVERY_ASSURANCE_MAX_AGE_SECONDS + 1,
      }),
    ).toBe(false);
    expect(hasFreshRecoveryAuthenticationMethod({ amr: ["recovery"] })).toBe(false);
    expect(
      hasFreshRecoveryAuthenticationMethod(
        { amr: [{ method: "otp", timestamp: timestamp + 61 }] },
        { nowEpochSeconds: timestamp },
      ),
    ).toBe(false);
  });
});
