import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorize }));
import { POST } from "@/app/api/salesforce/console/route";
import { GET } from "@/app/api/salesforce/console/authorize/route";
import { getSalesforceConsoleConfiguration } from "@/lib/crm/salesforce/console-config";

const origin = "https://crm.example.test";
const subject = "00000000-0000-4000-8000-000000000001";
function request(originHeader: string | null = origin, body?: string) {
  return new Request(`${origin}/api/salesforce/console`, {
    method: "POST",
    headers: originHeader ? { origin: originHeader } : {},
    ...(body === undefined ? {} : { body }),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("SALESFORCE_CONSOLE_ENABLED", "true");
  vi.stubEnv("SALESFORCE_CONSOLE_PASSWORD", "testOnly");
  mocks.authorize.mockResolvedValue({ ok: true, context: { userId: subject, roleKey: "master" } });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("Salesforce remote console API", () => {
  it("accepts an empty streamed POST as supplied by the Next adapter", async () => {
    const streamed = new Request(`${origin}/api/salesforce/console`, {
      method: "POST",
      headers: { origin },
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await POST(streamed)).status).toBe(200);
  });
  it("is explicitly disabled and rejects invalid RFB configuration", () => {
    expect(getSalesforceConsoleConfiguration({}).available).toBe(false);
    for (const password of ["", "short", "too-long-password", "1234567\n", "1234567é"]) {
      expect(
        getSalesforceConsoleConfiguration({
          SALESFORCE_CONSOLE_ENABLED: "true",
          SALESFORCE_CONSOLE_PASSWORD: password,
        }).available,
      ).toBe(false);
    }
  });
  it.each([null, "null", "https://evil.example", `${origin}/`, "http://crm.example.test"])(
    "rejects a nonexact origin %s",
    async (value) => {
      expect((await POST(request(value))).status).toBe(403);
      expect(mocks.authorize).not.toHaveBeenCalled();
    },
  );
  it("does not trust request Host when APP_ORIGIN is missing", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect((await POST(request())).status).toBe(403);
  });
  it("does not accept a login form or caller-provided destination", async () => {
    expect((await POST(request(origin, JSON.stringify({ username: "synthetic" })))).status).toBe(
      400,
    );
    expect(
      (
        await POST(
          new Request(`${origin}/api/salesforce/console?target=external`, {
            method: "POST",
            headers: { origin },
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it.each(["admin", "manager", "broker"])(
    "rejects %s even with settings permission",
    async (roleKey) => {
      mocks.authorize.mockResolvedValue({ ok: true, context: { userId: subject, roleKey } });
      for (const response of [await POST(request()), await GET()]) {
        expect(response.status).toBe(403);
        expect(await response.text()).not.toContain("testOnly");
      }
    },
  );
  it.each([401, 403])("preserves authentication and MFA denials (%s)", async (status) => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "denied" }, { status }),
    });
    expect((await POST(request())).status).toBe(status);
    expect((await GET()).status).toBe(status);
  });
  it("fails closed on authorization outages without leaking internals", async () => {
    mocks.authorize.mockRejectedValue(new Error("private infrastructure detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private infrastructure");
  });
  it("sends the technical credential only to the authorized Master bootstrap", async () => {
    const response = await POST(request());
    expect(mocks.authorize).toHaveBeenCalledWith("crm.settings.manage", true);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(await response.json()).toEqual({
      password: "testOnly",
      websocketPath: "/salesforce-console/socket",
      expiresIn: 600,
    });
    const authorization = await GET();
    expect(mocks.authorize).toHaveBeenLastCalledWith("crm.settings.manage", false);
    expect(authorization.headers.get("cache-control")).toContain("no-store");
    expect(await authorization.json()).toEqual({ ok: true, subject });
  });
  it("revokes both endpoints when disabled", async () => {
    vi.stubEnv("SALESFORCE_CONSOLE_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
    expect((await GET()).status).toBe(503);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
});
