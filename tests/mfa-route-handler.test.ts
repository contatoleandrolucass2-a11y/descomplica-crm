import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createRouteClientMock, getMfaAssuranceMock } = vi.hoisted(() => ({
  createRouteClientMock: vi.fn(),
  getMfaAssuranceMock: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/route", () => ({ createRouteClient: createRouteClientMock }));
vi.mock("@/lib/auth/mfa/assurance", () => ({ getMfaAssurance: getMfaAssuranceMock }));

import { POST } from "../app/auth/mfa/verify/route";

const ORIGIN = "https://homolog.example.test";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const FACTOR_ID = "22222222-2222-4222-8222-222222222222";

function requestFor(flow: "enrollment" | "challenge" | "invalid" = "enrollment", origin = ORIGIN) {
  const body = new URLSearchParams();
  body.set("flow", flow);
  body.set("factorId", FACTOR_ID);
  body.set("code", "123456");
  return new NextRequest(`${ORIGIN}/auth/mfa/verify`, {
    method: "POST",
    headers: { origin },
    body,
  });
}

function authenticatedClient(
  options: {
    claimsSub?: string;
    challengeError?: Error | null;
    verifiedFactor?: boolean;
  } = {},
) {
  const factor = {
    id: FACTOR_ID,
    factor_type: "totp",
    status: options.verifiedFactor ? "verified" : "unverified",
  };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { aal: "aal2", sub: options.claimsSub ?? USER_ID } },
        error: null,
      }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({
          data: {
            all: [factor],
            totp: options.verifiedFactor ? [factor] : [],
          },
          error: null,
        }),
        challengeAndVerify: vi.fn().mockResolvedValue(
          options.challengeError
            ? { data: null, error: options.challengeError }
            : {
                data: { access_token: "opaque-token", user: { id: USER_ID } },
                error: null,
              },
        ),
      },
    },
  };
  const applyCookies = vi.fn((response: NextResponse) => {
    response.headers.set("x-test-cookies-applied", "yes");
    return response;
  });
  createRouteClientMock.mockReturnValue({ supabase, applyCookies });
  return { applyCookies, supabase };
}

describe("MFA verification Route Handler", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", ORIGIN);
    createRouteClientMock.mockReset();
    getMfaAssuranceMock.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("commits AAL2 cookies only after enrollment token claims match", async () => {
    const { applyCookies, supabase } = authenticatedClient();
    getMfaAssuranceMock.mockResolvedValue({ status: "optional", currentLevel: "aal1" });

    const response = await POST(requestFor("enrollment"));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-test-cookies-applied")).toBe("yes");
    expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: FACTOR_ID,
      code: "123456",
    });
    expect(supabase.auth.getClaims).toHaveBeenCalledWith("opaque-token");
    expect(applyCookies).toHaveBeenCalledTimes(1);
  });

  it("accepts a verified TOTP factor only for an AAL1 challenge", async () => {
    const { supabase } = authenticatedClient({ verifiedFactor: true });
    getMfaAssuranceMock.mockResolvedValue({ status: "required", currentLevel: "aal1" });

    const response = await POST(requestFor("challenge"));

    expect(response.status).toBe(204);
    expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin, malformed and wrong-assurance requests before verification", async () => {
    expect(await POST(requestFor("enrollment", "https://external.example.test"))).toMatchObject({
      status: 403,
    });
    expect(await POST(requestFor("invalid"))).toMatchObject({ status: 400 });
    expect(
      await POST(
        new NextRequest(`${ORIGIN}/auth/mfa/verify`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
          body: "x".repeat(513),
        }),
      ),
    ).toMatchObject({ status: 400 });
    expect(createRouteClientMock).not.toHaveBeenCalled();

    const { supabase } = authenticatedClient();
    getMfaAssuranceMock.mockResolvedValue({ status: "required", currentLevel: "aal1" });
    expect(await POST(requestFor("enrollment"))).toMatchObject({ status: 403 });
    expect(supabase.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("discards buffered AAL2 cookies when verified claims do not match the user", async () => {
    const { applyCookies } = authenticatedClient({
      claimsSub: "33333333-3333-4333-8333-333333333333",
    });
    getMfaAssuranceMock.mockResolvedValue({ status: "optional", currentLevel: "aal1" });

    const response = await POST(requestFor("enrollment"));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-test-cookies-applied")).toBeNull();
    expect(applyCookies).not.toHaveBeenCalled();
  });

  it("returns a generic client error and preserves safe pre-verification cookie rotations", async () => {
    const { applyCookies } = authenticatedClient({ challengeError: new Error("invalid code") });
    getMfaAssuranceMock.mockResolvedValue({ status: "optional", currentLevel: "aal1" });

    const response = await POST(requestFor("enrollment"));

    expect(response.status).toBe(400);
    expect(response.body).toBeNull();
    expect(applyCookies).toHaveBeenCalledTimes(1);
  });
});
