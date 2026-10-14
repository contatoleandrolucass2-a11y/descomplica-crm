import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/authorization/types";

const mocks = vi.hoisted(() => ({
  requireAuthorization: vi.fn(),
  requirePermission: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/authorization/guards", () => ({
  requireAuthorization: mocks.requireAuthorization,
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/auth/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { POST } from "@/app/api/presence/route";
import { GET } from "@/app/api/admin/users/presence/route";

const userId = "e5100000-0000-4000-8000-000000000001";
const context = { userId, roleKey: "master", level: 100, permissions: ["users.view"] };
const now = "2026-10-14T20:00:00.000Z";
const request = (origin = "http://127.0.0.1:3000", body?: string) =>
  new Request("http://127.0.0.1:3000/api/presence", {
    method: "POST",
    headers: { origin },
    ...(body ? { body } : {}),
  });

function expectUncached(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAuthorization.mockResolvedValue(context);
  mocks.requirePermission.mockResolvedValue(context);
  mocks.rpc.mockResolvedValue({ data: now, error: null });
});

describe("user presence heartbeat", () => {
  it("records only the authenticated identity, ignoring client-supplied identity and time", async () => {
    const response = await POST(
      request(undefined, JSON.stringify({ userId: "another", seenAt: "future" })),
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expectUncached(response);
    expect(mocks.requireAuthorization).toHaveBeenCalledOnce();
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("touch_user_presence");
  });

  it.each(["", "https://untrusted.example"])(
    "rejects origin %s without writing",
    async (origin) => {
      const response = await POST(request(origin));
      expect(response.status).toBe(403);
      expectUncached(response);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["MFA_REQUIRED", 403],
    ["PASSWORD_RECOVERY_REQUIRED", 403],
  ] as const)("rejects %s before writing", async (code, status) => {
    mocks.requireAuthorization.mockRejectedValue(new AuthorizationError(code, "denied"));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expectUncached(response);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", 403],
    ["PGRST202", 503],
  ] as const)("does not report a successful write on %s", async (code, status) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "private database diagnostic" },
    });
    const response = await POST(request());
    expect(response.status).toBe(status);
    expectUncached(response);
    expect(await response.json()).toEqual({ error: "presence_unavailable" });
  });
});

describe("scoped administration presence", () => {
  it("requires users.view and returns only the RPC result with no cache or private metadata", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          user_id: userId,
          last_seen_at: now,
          is_online: true,
          observed_at: now,
          email: "private@example.test",
        },
      ],
      error: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expectUncached(response);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users.view");
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_presence");
    expect(await response.json()).toEqual({
      observedAt: now,
      users: [{ userId, lastSeenAt: now, isOnline: true }],
    });
  });

  it("does not infer online from account approval when no signal exists", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ user_id: userId, last_seen_at: null, is_online: false, observed_at: now }],
      error: null,
    });
    expect((await (await GET()).json()).users).toEqual([
      { userId, lastSeenAt: null, isOnline: false },
    ]);
  });

  it("denies readers lacking users.view without requesting presence", async () => {
    mocks.requirePermission.mockRejectedValue(new AuthorizationError("FORBIDDEN", "denied"));
    const response = await GET();
    expect(response.status).toBe(403);
    expectUncached(response);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([null, {}, [{ user_id: userId, is_online: "true" }]])(
    "rejects malformed data without presenting users as offline",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      const response = await GET();
      expect(response.status).toBe(503);
      expectUncached(response);
      expect(await response.json()).toEqual({ error: "presence_unavailable" });
    },
  );

  it("hides transport diagnostics and marks the feature unavailable", async () => {
    mocks.rpc.mockRejectedValue(new Error("private upstream diagnostic"));
    const response = await GET();
    expect(response.status).toBe(503);
    expectUncached(response);
    expect(await response.json()).toEqual({ error: "presence_unavailable" });
  });
});
