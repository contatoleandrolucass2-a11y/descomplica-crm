import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));

import { createRouteClient } from "../lib/auth/supabase/route";
import { updateSession } from "../lib/auth/supabase/middleware";

describe("buffered Supabase Route Handler client", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://homolog.example.test");
    vi.stubEnv("SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-key-at-least-twenty-characters");
    createServerClientMock.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("buffers final cookie state and applies hardened options atomically", () => {
    let cookieAdapter:
      | {
          getAll: () => { name: string; value: string }[];
          setAll: (
            cookies: { name: string; value: string; options: Record<string, unknown> }[],
            headers: Record<string, string>,
          ) => void;
        }
      | undefined;
    createServerClientMock.mockImplementation((_url, _key, options) => {
      cookieAdapter = options.cookies;
      return { marker: "client" };
    });
    const request = new NextRequest("https://homolog.example.test/auth/mfa/verify", {
      headers: {
        cookie: "sb-project-ref-auth-token=old; sb-project-ref-auth-token.1=stale",
      },
    });

    const { applyCookies } = createRouteClient(request);
    expect(cookieAdapter?.getAll()).toEqual(
      expect.arrayContaining([
        { name: "sb-project-ref-auth-token", value: "old" },
        { name: "sb-project-ref-auth-token.1", value: "stale" },
      ]),
    );

    cookieAdapter?.setAll(
      [
        { name: "sb-project-ref-auth-token", value: "intermediate", options: {} },
        { name: "sb-project-ref-auth-token.1", value: "", options: { maxAge: 0 } },
      ],
      { Expires: "Thu, 01 Jan 1970 00:00:00 GMT" },
    );
    expect(cookieAdapter?.getAll()).not.toContainEqual({
      name: "sb-project-ref-auth-token.1",
      value: "",
    });
    cookieAdapter?.setAll(
      [{ name: "sb-project-ref-auth-token", value: "aal2", options: { maxAge: 999_999 } }],
      {},
    );

    const response = applyCookies(new NextResponse(null, { status: 204 }));
    const cookies = response.cookies.getAll();
    expect(cookies.find(({ name }) => name === "sb-project-ref-auth-token")).toMatchObject({
      value: "aal2",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(
      cookies.find(({ name }) => name === "sb-project-ref-auth-token")?.maxAge,
    ).toBeUndefined();
    expect(cookies.find(({ name }) => name === "sb-project-ref-auth-token.1")).toMatchObject({
      value: "",
      maxAge: 0,
      httpOnly: true,
      secure: true,
    });
    expect(response.headers.get("expires")).toBe("Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("mirrors a proxy refresh into the request without duplicating response cookies", async () => {
    createServerClientMock.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll(
            [{ name: "sb-project-ref-auth-token", value: "rotated", options: {} }],
            { "Cache-Control": "no-store" },
          );
          return { data: { claims: {} }, error: null };
        },
      },
    }));
    const request = new NextRequest("https://homolog.example.test/auth/mfa/verify", {
      headers: { cookie: "sb-project-ref-auth-token=aal1" },
      method: "POST",
    });

    const { response } = await updateSession(request, { deferResponseAuthCookies: true });

    expect(request.cookies.get("sb-project-ref-auth-token")?.value).toBe("rotated");
    expect(response.cookies.get("sb-project-ref-auth-token")).toBeUndefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves a deferred proxy chunk deletion through the final route response", async () => {
    createServerClientMock
      .mockImplementationOnce((_url, _key, options) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [{ name: "sb-project-ref-auth-token.1", value: "", options: { maxAge: 0 } }],
              {},
            );
            return { data: { claims: {} }, error: null };
          },
        },
      }))
      .mockImplementationOnce(() => ({ marker: "route-client" }));
    const request = new NextRequest("https://homolog.example.test/auth/mfa/verify", {
      headers: {
        cookie: "sb-project-ref-auth-token=aal1; sb-project-ref-auth-token.1=stale",
      },
      method: "POST",
    });

    const { response: proxyResponse } = await updateSession(request, {
      deferResponseAuthCookies: true,
    });
    expect(proxyResponse.cookies.get("sb-project-ref-auth-token.1")).toBeUndefined();
    expect(request.cookies.get("sb-project-ref-auth-token.1")?.value).toBe("");

    const { applyCookies } = createRouteClient(request);
    const routeResponse = applyCookies(new NextResponse(null, { status: 400 }));

    expect(routeResponse.cookies.get("sb-project-ref-auth-token.1")).toMatchObject({
      value: "",
      maxAge: 0,
      httpOnly: true,
      secure: true,
    });
  });
});
