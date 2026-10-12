import { generateKeyPairSync, sign } from "node:crypto";
import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...cookieStore.values].map(([name, value]) => ({ name, value })),
    set: cookieStore.set,
  }),
}));

import { GET } from "@/app/api/salesforce/console/authorize/route";
import { POST } from "@/app/api/salesforce/console/route";

const origin = "https://crm.example.test";
const supabaseUrl = "https://readonly-fixture.supabase.co";
const subject = "12345678-1234-4123-8123-123456789abc";
const sessionId = "12345678-1234-4123-8123-123456789abd";
const cookieName = "sb-readonly-fixture-auth-token";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "synthetic-key",
  alg: "ES256",
  use: "sig",
};
const requests: { path: string; authorization: string | null; body: string | null }[] = [];
let live = true;
let liveError = false;
let role = "master";
let factors: { id: string; status: string; factor_type: string }[] = [];

function syntheticSession(expiresIn: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64URL(JSON.stringify({ alg: "ES256", typ: "JWT", kid: jwk.kid }));
  const payload = stringToBase64URL(
    JSON.stringify({
      iss: `${supabaseUrl}/auth/v1`,
      sub: subject,
      aud: "authenticated",
      role: "authenticated",
      session_id: sessionId,
      aal: "aal1",
      amr: [{ method: "password", timestamp: now - 3600 }],
      iat: now - 3600,
      exp: now + expiresIn,
    }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return {
    access_token: `${header}.${payload}.${signature}`,
    refresh_token: "synthetic-refresh-never-send-from-probe",
    token_type: "bearer",
    expires_at: now + expiresIn,
    expires_in: expiresIn,
    user: { id: subject, aud: "authenticated", role: "authenticated", factors },
  };
}

function seedCookie(expiresIn: number) {
  const session = syntheticSession(expiresIn);
  // Public SSR helpers encode the fixture, including its normal chunk boundaries.
  const encoded = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  for (const cookie of createChunks(cookieName, encoded)) {
    cookieStore.values.set(cookie.name, cookie.value);
  }
  return session;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T16:00:00Z"));
  vi.stubEnv("SUPABASE_URL", supabaseUrl);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key-at-least-twenty-characters");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("SALESFORCE_CONSOLE_ENABLED", "true");
  vi.stubEnv("SALESFORCE_CONSOLE_PASSWORD", "testOnly");
  cookieStore.values.clear();
  cookieStore.set.mockReset();
  cookieStore.set.mockImplementation(
    (name: string, value: string, options?: { maxAge?: number }) => {
      if (options?.maxAge === 0) cookieStore.values.delete(name);
      else cookieStore.values.set(name, value);
    },
  );
  requests.length = 0;
  live = true;
  liveError = false;
  role = "master";
  factors = [];
  // Only the transport is substituted: SSR, Auth, guards and RPC client are real.
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      expect(url.origin).toBe(supabaseUrl);
      const body = request.body ? await request.text() : null;
      requests.push({
        path: url.pathname,
        authorization: request.headers.get("authorization"),
        body,
      });
      switch (url.pathname) {
        case "/auth/v1/.well-known/jwks.json":
          return Response.json({ keys: [jwk] });
        case "/auth/v1/user":
          return Response.json({
            id: subject,
            aud: "authenticated",
            role: "authenticated",
            factors,
          });
        case "/rest/v1/rpc/current_session_is_live":
          return liveError
            ? Response.json({ code: "P0001", message: "Synthetic RPC failure" }, { status: 400 })
            : Response.json(live);
        case "/rest/v1/rpc/get_user_authorization_context":
          expect(JSON.parse(body ?? "null")).toEqual({ user_uuid: subject });
          return Response.json([
            { user_id: subject, role_key: role, level: 100, permissions: ["crm.settings.manage"] },
          ]);
        case "/auth/v1/token":
          // A regression can complete refresh, so assertions detect it without retries/timeouts.
          return Response.json({ ...syntheticSession(3600), refresh_token: "synthetic-rotated" });
        default:
          return Response.json({ message: "Unexpected synthetic endpoint" }, { status: 400 });
      }
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function expectReadOnly() {
  expect(requests.filter(({ path }) => path === "/auth/v1/token")).toEqual([]);
  expect(cookieStore.set).not.toHaveBeenCalled();
}

describe("Salesforce verification with the public Supabase SSR client", () => {
  it("repeated expired-cookie probes fail closed without token network or cookie writes", async () => {
    seedCookie(-60);
    const original = [...cookieStore.values];
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await GET();
      expect(response.status).toBe(401);
      expect(response.headers.has("set-cookie")).toBe(false);
    }
    expect(requests).toEqual([]);
    expect([...cookieStore.values]).toEqual(original);
    expectReadOnly();
  });

  it.each([3600, 30])(
    "verifies a valid JWT with %i seconds left and calls live/permission RPCs",
    async (expiresIn) => {
      const session = seedCookie(expiresIn);
      const response = await GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, subject });
      expect(response.headers.get("cache-control")).toContain("no-store");
      for (const path of [
        "/auth/v1/user",
        "/rest/v1/rpc/current_session_is_live",
        "/rest/v1/rpc/get_user_authorization_context",
      ]) {
        expect(requests).toContainEqual(
          expect.objectContaining({ path, authorization: `Bearer ${session.access_token}` }),
        );
      }
      expectReadOnly();
    },
  );

  it.each(["revoked", "rpc-error"])(
    "denies a valid JWT when live-session verification is %s",
    async (failure) => {
      seedCookie(3600);
      live = failure !== "revoked";
      liveError = failure === "rpc-error";
      expect((await GET()).status).toBe(403);
      expect(requests.some(({ path }) => path.endsWith("/current_session_is_live"))).toBe(true);
      expect(requests.some(({ path }) => path.endsWith("/get_user_authorization_context"))).toBe(
        false,
      );
      expectReadOnly();
    },
  );

  it("still requires MFA when the authenticated user has a verified factor", async () => {
    factors = [{ id: sessionId, status: "verified", factor_type: "totp" }];
    seedCookie(3600);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "mfa_required" });
    expectReadOnly();
  });

  it("still denies a non-Master with the settings permission", async () => {
    seedCookie(3600);
    role = "admin";
    expect((await GET()).status).toBe(403);
    expectReadOnly();
  });

  it("fails closed when the browser has no session cookie", async () => {
    expect((await GET()).status).toBe(401);
    expect(requests).toEqual([]);
    expectReadOnly();
  });

  it("keeps normal bootstrap refresh and browser cookie rotation enabled", async () => {
    seedCookie(-60);
    const original = [...cookieStore.values];
    const response = await POST(
      new Request(`${origin}/api/salesforce/console`, {
        method: "POST",
        headers: { origin },
      }),
    );
    expect(response.status).toBe(200);
    expect(requests.filter(({ path }) => path === "/auth/v1/token")).toHaveLength(1);
    expect(cookieStore.set).toHaveBeenCalled();
    expect([...cookieStore.values]).not.toEqual(original);
    expect(requests.some(({ path }) => path.endsWith("/current_session_is_live"))).toBe(true);
  });
});
