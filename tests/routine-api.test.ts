import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/routines/route";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));

const row = {
  "Segunda-feira": "Atividade sintetica",
  "Terça-feira": "",
  "Quarta-feira": "",
  "Quinta-feira": "",
  "Sexta-feira": "",
  Sábado: "",
  Domingo: "Legado sintetico",
};
const body = { role_key: "regional-house", rows: [row], expected_revision: 0 };
const record = {
  role_key: body.role_key,
  rows: body.rows,
  revision: 1,
  updated_at: "2026-10-12T15:00:00Z",
};
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request("http://routine.test/api/routines", {
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
  mocks.rpc.mockResolvedValue({ data: record, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("shared routine API", () => {
  it.each([401, 403])("preserves auth denial %i before accessing RPC", async (status) => {
    for (const method of [GET, () => PUT(request())]) {
      mocks.authorize.mockResolvedValueOnce({
        ok: false,
        response: Response.json(
          { error: "denied" },
          { status, headers: { "cache-control": "no-store", pragma: "no-cache" } },
        ),
      });
      await result(await method(), status, { error: "denied" });
    }
    expect(mocks.authorize).toHaveBeenNthCalledWith(1, "crm.dashboard.view");
    expect(mocks.authorize).toHaveBeenNthCalledWith(2, "crm.settings.manage");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "returns validated shared records and can_edit=%s without cache",
    async (can_edit) => {
      const snapshot = { routines: [record], can_edit };
      mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
      await result(await GET(), 200, snapshot);
      expect(mocks.rpc).toHaveBeenCalledWith("get_crm_routines");
    },
  );
  it("accepts an empty database without inventing a saved default", async () => {
    mocks.rpc.mockResolvedValue({ data: { routines: [], can_edit: true }, error: null });
    await result(await GET(), 200, { routines: [], can_edit: true });
  });
  it.each([
    null,
    {},
    { routines: [record, record], can_edit: true },
    { routines: [{ ...record, revision: 0 }], can_edit: true },
  ])("fails closed for malformed GET data: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await result(await GET(), 503, { error: "routine_unavailable" });
  });
  it("sanitizes GET RPC failure and exceptions", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private diagnostic" } });
    await result(await GET(), 503, { error: "routine_unavailable" });
    mocks.client.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await GET(), 503, { error: "routine_unavailable" });
  });
  it.each(["", "null", "https://untrusted.test"])(
    "rejects missing or foreign origin %s",
    async (origin) => {
      await result(await PUT(request(body, { origin })), 403, { error: "invalid_origin" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects non-JSON before RPC", async () => {
    await result(await PUT(request(body, { "content-type": "text/plain" })), 415, {
      error: "invalid_content_type",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    "{broken",
    { ...body, role_key: "administrator" },
    { ...body, expected_revision: -1 },
    { ...body, expected_revision: 1.5 },
    { ...body, expected_revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...body, rows: [{}] },
    { ...body, extra: true },
    { ...body, rows: [{ ...row, extra: "not allowed" }] },
    { ...body, rows: [{ ...row, "Segunda-feira": "x".repeat(4001) }] },
    { ...body, rows: Array.from({ length: 201 }, () => row) },
  ])("rejects invalid schema/body %#", async (value) => {
    await result(await PUT(request(value)), 400, { error: "invalid_routine" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces declared and streamed byte limits independently", async () => {
    await result(await PUT(request(body, { "content-length": "1000001" })), 413, {
      error: "body_too_large",
    });
    // Multibyte data exceeds the byte limit even though the character count does not.
    await result(await PUT(request("ã".repeat(500001))), 413, { error: "body_too_large" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects an absent body", async () => {
    await result(
      await PUT(
        new Request("http://routine.test/api/routines", {
          method: "PUT",
          headers: { origin: "http://routine.test", "content-type": "application/json" },
        }),
      ),
      400,
      { error: "invalid_routine" },
    );
  });
  it("passes role, rows and expected revision to the versioned RPC", async () => {
    await result(await PUT(request(body)), 200, record);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_crm_routine", {
      p_role_key: body.role_key,
      p_rows: body.rows,
      p_expected_revision: 0,
    });
  });
  it.each([
    ["40001", 409, "revision_conflict"],
    ["42501", 403, "forbidden"],
    ["22023", 400, "invalid_routine"],
    ["XX000", 503, "routine_unavailable"],
  ])("maps RPC %s without leaking diagnostics", async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } });
    await result(await PUT(request()), Number(status), { error });
  });
  it("rejects invalid save records and catches RPC exceptions", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...record, revision: 0 }, error: null });
    await result(await PUT(request()), 503, { error: "routine_unavailable" });
    mocks.rpc.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await PUT(request()), 503, { error: "routine_unavailable" });
  });
});
