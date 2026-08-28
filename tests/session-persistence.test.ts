import { describe, expect, it } from "vitest";

import {
  applyAuthCookiePolicy,
  buildSessionPersistenceCookie,
  isRememberBrowserRequested,
  isSupabaseAuthCookieName,
  isSupabaseSessionCookieName,
  issueSessionPersistence,
  REMEMBER_BROWSER_MAX_AGE_SECONDS,
  resolveSessionPersistence,
  SESSION_PERSISTENCE_COOKIE_NAME,
  type SessionPersistence,
} from "../lib/auth/session-persistence";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const VALID_SECRET = "x".repeat(64);

describe("session persistence", () => {
  it("accepts only the literal checkbox value on", () => {
    expect(isRememberBrowserRequested("on")).toBe(true);
    for (const value of [undefined, null, "", "ON", "true", true, 1]) {
      expect(isRememberBrowserRequested(value)).toBe(false);
    }
  });

  it("identifies only the configured Supabase auth cookie and its chunks", () => {
    const supabaseUrl = "https://project-ref.supabase.co";
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token", supabaseUrl)).toBe(true);
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token.0", supabaseUrl)).toBe(true);
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token.12", supabaseUrl)).toBe(true);
    expect(isSupabaseSessionCookieName("sb-project-ref-auth-token.12", supabaseUrl)).toBe(true);
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token-code-verifier", supabaseUrl)).toBe(
      true,
    );
    expect(
      isSupabaseAuthCookieName(
        "sb-project-ref-auth-token-flow-Abcd_1234-code-verifier.0",
        supabaseUrl,
      ),
    ).toBe(true);
    expect(
      isSupabaseAuthCookieName("sb-project-ref-auth-token-flows-code-verifier", supabaseUrl),
    ).toBe(true);
    expect(
      isSupabaseSessionCookieName("sb-project-ref-auth-token-code-verifier", supabaseUrl),
    ).toBe(false);
    expect(isSupabaseAuthCookieName("sb-other-auth-token", supabaseUrl)).toBe(false);
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token.bad", supabaseUrl)).toBe(false);
    expect(isSupabaseAuthCookieName(SESSION_PERSISTENCE_COOKIE_NAME, supabaseUrl)).toBe(false);
    expect(isSupabaseAuthCookieName("sb-project-ref-auth-token", "invalid")).toBe(false);
  });

  it("issues an HMAC-signed marker with an absolute 30-day deadline", () => {
    const issued = issueSessionPersistence("on", { now: NOW, secret: VALID_SECRET });

    expect(issued.persistence).toEqual({
      kind: "remembered",
      deadlineEpochSeconds: Math.floor(NOW.getTime() / 1000) + REMEMBER_BROWSER_MAX_AGE_SECONDS,
    });
    expect(issued.markerValue).toMatch(/^v1\.\d{10}\.[A-Za-z0-9_-]{43}$/);
    expect(issued.markerValue).not.toContain(VALID_SECRET);
    expect(
      resolveSessionPersistence(issued.markerValue, { now: NOW, secret: VALID_SECRET }),
    ).toEqual(issued.persistence);
  });

  it("fails closed for absent, weak, wrong, malformed, tampered, expired or overlong markers", () => {
    const issued = issueSessionPersistence("on", { now: NOW, secret: VALID_SECRET });
    expect(issued.persistence.kind).toBe("remembered");

    const marker = issued.markerValue!;
    const deadline = (issued.persistence as Extract<SessionPersistence, { kind: "remembered" }>)
      .deadlineEpochSeconds;
    const tampered = `${marker.slice(0, -1)}${marker.endsWith("A") ? "B" : "A"}`;

    expect(resolveSessionPersistence(null, { now: NOW, secret: VALID_SECRET }).kind).toBe(
      "temporary",
    );
    expect(resolveSessionPersistence(marker, { now: NOW, secret: undefined }).kind).toBe(
      "temporary",
    );
    expect(resolveSessionPersistence(marker, { now: NOW, secret: "short" }).kind).toBe("temporary");
    expect(resolveSessionPersistence(marker, { now: NOW, secret: "y".repeat(64) }).kind).toBe(
      "temporary",
    );
    expect(resolveSessionPersistence("not-a-marker", { now: NOW, secret: VALID_SECRET }).kind).toBe(
      "temporary",
    );
    expect(resolveSessionPersistence(tampered, { now: NOW, secret: VALID_SECRET }).kind).toBe(
      "temporary",
    );
    expect(
      resolveSessionPersistence(marker, {
        now: new Date(deadline * 1000),
        secret: VALID_SECRET,
      }).kind,
    ).toBe("temporary");
    expect(
      resolveSessionPersistence(marker, {
        now: new Date(NOW.getTime() - 1000),
        secret: VALID_SECRET,
      }).kind,
    ).toBe("temporary");
  });

  it("uses a temporary session when checkbox or signing secret is unavailable", () => {
    expect(issueSessionPersistence(undefined, { now: NOW, secret: VALID_SECRET })).toEqual({
      persistence: { kind: "temporary" },
      markerValue: null,
    });
    expect(issueSessionPersistence("invalid", { now: NOW, secret: VALID_SECRET })).toEqual({
      persistence: { kind: "temporary" },
      markerValue: null,
    });
    expect(issueSessionPersistence("on", { now: NOW, secret: "short" })).toEqual({
      persistence: { kind: "temporary" },
      markerValue: null,
    });
  });

  it("forces secure cookie attributes and strips lifetime from temporary cookies", () => {
    const options = applyAuthCookiePolicy(
      {
        domain: "crm.example.com",
        expires: new Date("2030-01-01T00:00:00.000Z"),
        httpOnly: false,
        maxAge: 400 * 24 * 60 * 60,
        path: "/unsafe",
        sameSite: "strict",
        secure: false,
      },
      { kind: "temporary" },
      { applicationOrigin: "https://crm.example.com", now: NOW },
    );

    expect(options).toEqual({
      domain: "crm.example.com",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("sets Secure only for an HTTPS APP_ORIGIN", () => {
    const temporary = { kind: "temporary" } as const;
    expect(
      applyAuthCookiePolicy({}, temporary, {
        applicationOrigin: "http://127.0.0.1:3000",
        now: NOW,
      }).secure,
    ).toBe(false);
    expect(
      applyAuthCookiePolicy({}, temporary, { applicationOrigin: "invalid", now: NOW }).secure,
    ).toBe(false);
    expect(
      applyAuthCookiePolicy({}, temporary, {
        applicationOrigin: "invalid",
        now: NOW,
        production: true,
      }).secure,
    ).toBe(true);
    expect(
      applyAuthCookiePolicy({}, temporary, {
        applicationOrigin: "http://crm.example.com",
        now: NOW,
        production: true,
      }).secure,
    ).toBe(true);
    expect(
      applyAuthCookiePolicy({}, temporary, {
        applicationOrigin: "http://127.0.0.1:3000",
        now: NOW,
        production: true,
      }).secure,
    ).toBe(true);
    expect(
      applyAuthCookiePolicy({}, temporary, {
        allowInsecureLoopback: true,
        applicationOrigin: "http://127.0.0.1:3000",
        now: NOW,
        production: true,
      }).secure,
    ).toBe(false);
    expect(
      applyAuthCookiePolicy({}, temporary, {
        applicationOrigin: "https://crm.example.com",
        now: NOW,
      }).secure,
    ).toBe(true);
  });

  it("preserves maxAge zero for removals while removing expires", () => {
    expect(
      applyAuthCookiePolicy(
        { expires: new Date("1970-01-01T00:00:00.000Z"), maxAge: 0 },
        { kind: "temporary" },
        { applicationOrigin: "https://crm.example.com", now: NOW },
      ),
    ).toEqual({
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("keeps remembered cookies inside the original absolute deadline", () => {
    const issued = issueSessionPersistence("on", { now: NOW, secret: VALID_SECRET });
    expect(issued.persistence.kind).toBe("remembered");
    const oneDayLater = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const options = applyAuthCookiePolicy({ maxAge: 400 * 24 * 60 * 60 }, issued.persistence, {
      applicationOrigin: "https://crm.example.com",
      now: oneDayLater,
    });

    expect(options.maxAge).toBe(29 * 24 * 60 * 60);
    expect(options.expires).toEqual(
      new Date(
        (issued.persistence as Extract<SessionPersistence, { kind: "remembered" }>)
          .deadlineEpochSeconds * 1000,
      ),
    );
  });

  it("fails forged or expired remembered policy objects back to session cookies", () => {
    const nowSeconds = Math.floor(NOW.getTime() / 1000);
    for (const deadlineEpochSeconds of [
      nowSeconds,
      nowSeconds + REMEMBER_BROWSER_MAX_AGE_SECONDS + 1,
    ]) {
      const options = applyAuthCookiePolicy(
        { maxAge: 400 * 24 * 60 * 60 },
        { kind: "remembered", deadlineEpochSeconds },
        { applicationOrigin: "https://crm.example.com", now: NOW },
      );
      expect(options.maxAge).toBeUndefined();
      expect(options.expires).toBeUndefined();
    }
  });

  it("builds a protected marker cookie and clears stale markers for temporary sessions", () => {
    const remembered = buildSessionPersistenceCookie(
      issueSessionPersistence("on", { now: NOW, secret: VALID_SECRET }),
      { applicationOrigin: "https://crm.example.com", now: NOW },
    );
    expect(remembered.name).toBe(SESSION_PERSISTENCE_COOKIE_NAME);
    expect(remembered.value).toMatch(/^v1\./);
    expect(remembered.options).toMatchObject({
      httpOnly: true,
      maxAge: REMEMBER_BROWSER_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    const temporary = buildSessionPersistenceCookie(
      issueSessionPersistence("off", { now: NOW, secret: VALID_SECRET }),
      { applicationOrigin: "http://127.0.0.1:3000", now: NOW },
    );
    expect(temporary).toEqual({
      name: SESSION_PERSISTENCE_COOKIE_NAME,
      value: "",
      options: {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: false,
      },
    });
  });
});
