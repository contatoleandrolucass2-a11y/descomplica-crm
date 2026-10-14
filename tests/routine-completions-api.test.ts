import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/routines/completions/route";
import { routineCompletionSaveSchema } from "@/lib/crm/routine-completions";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));

const completion = {
  role_key: "corretor",
  row_index: 0,
  day: "Segunda-feira",
  activity_text: "Atividade sintetica",
};
const body = { ...completion, expected_week_start: "2026-10-12", completed: true };
const snapshot = {
  week_start: "2026-10-12",
  resets_at: "2026-10-19T03:00:00+00:00",
  server_now: "2026-10-14T02:00:00+00:00",
  completions: [completion],
};
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request("http://routine.test/api/routines/completions", {
    method: "PUT",
    headers: { origin: "http://routine.test", "content-type": "application/json", ...headers },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
}
async function result(response: Response, status: number, value: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(await response.json()).toEqual(value);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://routine.test");
  mocks.authorize.mockResolvedValue({ ok: true });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("individual weekly routine completions", () => {
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [403, "mfa_required"],
  ])("preserves guard denial %s %s before client creation", async (status, error) => {
    for (const method of [GET, () => PUT(request())]) {
      mocks.authorize.mockResolvedValueOnce({
        ok: false,
        response: Response.json(
          { error },
          { status: Number(status), headers: { "cache-control": "no-store", pragma: "no-cache" } },
        ),
      });
      await result(await method(), Number(status), { error });
    }
    expect(mocks.authorize.mock.calls).toEqual([["crm.dashboard.view"], ["crm.dashboard.view"]]);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("reads the DB clock and current actor snapshot without client identity or local clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    await result(await GET(), 200, snapshot);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_crm_routine_completions");
  });

  it("accepts an empty snapshot without creating default completions", async () => {
    const empty = { ...snapshot, completions: [] };
    mocks.rpc.mockResolvedValue({ data: empty, error: null });
    await result(await GET(), 200, empty);
  });

  it.each([true, false])(
    "a viewer can set completed=%s using only the six contract fields",
    async (completed) => {
      await result(await PUT(request({ ...body, completed })), 200, snapshot);
      expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith("crm.dashboard.view");
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_crm_routine_completion", {
        p_role_key: completion.role_key,
        p_row_index: 0,
        p_day: completion.day,
        p_activity_text: completion.activity_text,
        p_expected_week_start: body.expected_week_start,
        p_completed: completed,
      });
    },
  );

  it.each([
    null,
    {},
    { ...snapshot, week_start: "2026-02-30" },
    { ...snapshot, server_now: "not-a-date" },
    { ...snapshot, resets_at: "2026-10-19T03:00:00" },
    { ...snapshot, completions: [completion, completion] },
    { ...snapshot, completions: [{ ...completion, activity_text: " " }] },
    { ...snapshot, completions: [{ ...completion, user_id: "private" }] },
    { ...snapshot, user_id: "private" },
  ])("fails closed for malformed RPC snapshot %# in GET and PUT", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await result(await GET(), 503, { error: "routine_completions_unavailable" });
    await result(await PUT(request()), 503, { error: "routine_completions_unavailable" });
  });

  it.each(["", "null", "https://foreign.test"])("rejects invalid origin %s", async (origin) => {
    await result(await PUT(request(body, { origin })), 403, { error: "invalid_origin" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["text/plain", "application/jsonp"])("rejects content type %s", async (contentType) => {
    await result(await PUT(request(body, { "content-type": contentType })), 415, {
      error: "invalid_content_type",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    "{broken",
    { ...body, user_id: "another-user" },
    { ...body, actor_id: "another-user" },
    { ...body, role_key: "admin" },
    { ...body, row_index: -1 },
    { ...body, row_index: 200 },
    { ...body, row_index: 0.5 },
    { ...body, row_index: "0" },
    { ...body, day: "__proto__" },
    { ...body, day: "Monday" },
    { ...body, activity_text: "" },
    { ...body, activity_text: " \t\n" },
    { ...body, activity_text: "x".repeat(4001) },
    { ...body, activity_text: "\u{1f680}".repeat(2001) },
    { ...body, expected_week_start: "2026-02-30" },
    { ...body, expected_week_start: "2026-10-12T00:00:00Z" },
    { ...body, completed: "true" },
    { ...body, completed: null },
    { ...body, extra: true },
  ])("rejects malicious or invalid input %# without RPC", async (value) => {
    await result(await PUT(request(value)), 400, { error: "invalid_completion" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves exact text, including whitespace and supplementary characters", () => {
    const activity_text = "  " + "\u{1f680}".repeat(1998) + "  ";
    expect(routineCompletionSaveSchema.parse({ ...body, activity_text }).activity_text).toBe(
      activity_text,
    );
  });

  it("limits declared and actual streamed bytes independently", async () => {
    await result(await PUT(request(body, { "content-length": "32769" })), 413, {
      error: "body_too_large",
    });
    await result(await PUT(request("\u00e3".repeat(16385))), 413, { error: "body_too_large" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing bodies", async () => {
    const empty = new Request("http://routine.test/api/routines/completions", {
      method: "PUT",
      headers: { origin: "http://routine.test", "content-type": "application/json" },
    });
    await result(await PUT(empty), 400, { error: "invalid_completion" });
  });

  it("cancels a stalled body after ten seconds without invoking RPC", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stalled = new Request("http://routine.test/api/routines/completions", {
      method: "PUT",
      headers: { origin: "http://routine.test", "content-type": "application/json" },
      body: new ReadableStream({ cancel }),
      duplex: "half",
    } as RequestInit);
    const pending = PUT(stalled);
    await vi.advanceTimersByTimeAsync(10_000);
    await result(await pending, 408, { error: "request_timeout" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["RC001", 409, "week_conflict"],
    ["RC002", 409, "activity_conflict"],
    ["RC003", 409, "routine_not_saved"],
    ["28000", 401, "unauthenticated"],
    ["42501", 403, "forbidden"],
    ["22023", 400, "invalid_completion"],
    ["55P03", 503, "routine_completions_unavailable"],
    ["XX000", 503, "routine_completions_unavailable"],
  ])("maps RPC %s to %s without exposing diagnostics", async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } });
    await result(await GET(), Number(status), { error });
    await result(await PUT(request()), Number(status), { error });
  });

  it("sanitizes RPC and client exceptions", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await PUT(request()), 503, { error: "routine_completions_unavailable" });
    mocks.client.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await GET(), 503, { error: "routine_completions_unavailable" });
  });
});
