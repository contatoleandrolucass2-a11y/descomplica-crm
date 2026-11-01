import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/(protected)/app/leads/backend/[...path]/route";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  client: vi.fn(),
  session: vi.fn(),
  backend: vi.fn(),
  pages: vi.fn(),
}));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.pages }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/crm/lead-plus/server/runtime.mjs", () => ({ handleLeadPlus: mocks.backend }));
const context = { params: Promise.resolve({ path: ["session"] }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true, context: { userId: "auth-1", permissions: [] } });
  mocks.client.mockResolvedValue({ auth: { getSession: mocks.session } });
  mocks.session.mockResolvedValue({
    data: {
      session: {
        user: { id: "auth-1", email: "synthetic@example.invalid" },
        access_token: "private-session",
        authorizedPages: ["/app/leads/lista"],
      },
    },
  });
  mocks.pages.mockResolvedValue([{ path: "/app/leads/lista" }]);
  mocks.backend.mockResolvedValue(Response.json({ preview: false }));
});
describe("LEAD+ host route", () => {
  it("requires the existing catalog page permission before reading the session", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect(
      (await GET(new Request("https://crm.example.invalid/app/leads/backend/session"), context))
        .status,
    ).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.backend).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes before invoking the operational backend", async () => {
    expect(
      (
        await POST(
          new Request("https://crm.example.invalid/app/leads/backend/leads", {
            method: "POST",
            headers: { origin: "https://evil.invalid" },
          }),
          context,
        )
      ).status,
    ).toBe(403);
    expect(mocks.backend).not.toHaveBeenCalled();
  });
  it("binds the session identity to the validated server authorization", async () => {
    mocks.session.mockResolvedValue({
      data: { session: { user: { id: "other" }, access_token: "other-token" } },
    });
    expect(
      (await GET(new Request("https://crm.example.invalid/app/leads/backend/session"), context))
        .status,
    ).toBe(401);
    expect(mocks.backend).not.toHaveBeenCalled();
  });
  it("passes the cookie session server-side, never in the response", async () => {
    const response = await GET(
      new Request("https://crm.example.invalid/app/leads/backend/session"),
      context,
    );
    expect(await response.text()).not.toContain("private-session");
    expect(mocks.backend.mock.calls[0]?.[2]).toEqual({
      id: "auth-1",
      email: "synthetic@example.invalid",
      token: "private-session",
      authorizedPages: ["/app/leads/lista"],
      canonicalPermissions: [],
    });
  });
});

it("denies import when the hub is allowed but the canonical import page is not", async () => {
  mocks.authorize.mockImplementation(async (path: string) =>
    path === "/app/leads"
      ? { ok: true, context: { userId: "auth-1", permissions: [] } }
      : { ok: false, response: new Response(null, { status: 403 }) },
  );
  const response = await POST(
    new Request("https://crm.example.invalid/app/leads/backend/imports", {
      method: "POST",
      headers: { origin: "https://crm.example.invalid" },
    }),
    { params: Promise.resolve({ path: ["imports"] }) },
  );
  expect(response.status).toBe(403);
  expect(mocks.backend).not.toHaveBeenCalled();
});

it("rejects lead creation when hub and list pages are allowed without the granular create grant", async () => {
  const response = await POST(
    new Request("https://crm.example.invalid/app/leads/backend/leads", {
      method: "POST",
      headers: { origin: "https://crm.example.invalid" },
    }),
    { params: Promise.resolve({ path: ["leads"] }) },
  );
  expect(response.status).toBe(403);
  expect(mocks.backend).not.toHaveBeenCalled();
});
