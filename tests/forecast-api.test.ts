import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/forecasts/route";
import { createForecastDocument, getForecastGroups } from "@/lib/crm/forecast-grid";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));

const document = createForecastDocument();
document.rows[0]!.cells.broker = "Corretor sintético";
const firstGroup = getForecastGroups(document)[0]!;
document.rows[0]!.cells[firstGroup.forecastId] = "12.50";
document.rows[0]!.cells[firstGroup.actualId] = "8";
const body = { ...document, expected_revision: 0 };
const record = { ...document, revision: 1, updated_at: "2026-10-12T15:00:00Z" };
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request("http://forecast.test/api/forecasts", {
    method: "PUT",
    headers: { origin: "http://forecast.test", "content-type": "application/json", ...headers },
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
  vi.stubEnv("APP_ORIGIN", "http://forecast.test");
  mocks.authorize.mockResolvedValue({
    ok: true,
    context: { permissions: ["crm.settings.manage"] },
  });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: record, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("shared forecast API", () => {
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
    expect(mocks.authorize).toHaveBeenNthCalledWith(1, "/app/gestao/previsao");
    expect(mocks.authorize).toHaveBeenNthCalledWith(2, "/app/gestao/previsao");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "returns validated shared records and can_edit=%s without cache",
    async (can_edit) => {
      const snapshot = { forecast: record, can_edit };
      mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
      await result(await GET(), 200, snapshot);
      expect(mocks.rpc).toHaveBeenCalledWith("get_crm_forecast");
    },
  );
  it("does not allow routine page access to grant routine editing", async () => {
    mocks.authorize.mockResolvedValue({
      ok: true,
      context: { permissions: ["crm.management.forecast.view"] },
    });
    await result(await PUT(request()), 403, { error: "forbidden" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts an empty database without inventing a saved default", async () => {
    mocks.rpc.mockResolvedValue({ data: { forecast: null, can_edit: true }, error: null });
    await result(await GET(), 200, { forecast: null, can_edit: true });
  });
  it.each([
    null,
    {},
    { forecast: [record, record], can_edit: true },
    { forecast: { ...record, revision: 0 }, can_edit: true },
  ])("fails closed for malformed GET data: %j", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await result(await GET(), 503, { error: "forecast_unavailable" });
  });
  it("sanitizes GET RPC failure and exceptions", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private diagnostic" } });
    await result(await GET(), 503, { error: "forecast_unavailable" });
    mocks.client.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await GET(), 503, { error: "forecast_unavailable" });
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
    { ...body, columns: [] },
    { ...body, expected_revision: -1 },
    { ...body, expected_revision: 1.5 },
    { ...body, expected_revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...body, rows: [{}] },
    { ...body, extra: true },
    { ...body, rows: [{ id: "row1", cells: { unknown: "not allowed" } }] },
    { ...body, rows: [{ id: "row1", cells: { broker: "x".repeat(4001) } }] },
    {
      ...body,
      rows: Array.from({ length: 201 }, (_, i) => ({ id: `row${i}`, cells: { broker: "" } })),
    },
  ])("rejects invalid schema/body %#", async (value) => {
    await result(await PUT(request(value)), 400, { error: "invalid_forecast" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("enforces declared and streamed byte limits independently", async () => {
    await result(await PUT(request(body, { "content-length": "2000001" })), 413, {
      error: "body_too_large",
    });
    // Multibyte data exceeds the byte limit even though the character count does not.
    await result(await PUT(request("ã".repeat(1000001))), 413, { error: "body_too_large" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects an absent body", async () => {
    await result(
      await PUT(
        new Request("http://forecast.test/api/forecasts", {
          method: "PUT",
          headers: { origin: "http://forecast.test", "content-type": "application/json" },
        }),
      ),
      400,
      { error: "invalid_forecast" },
    );
  });
  it("cancels a stalled request after ten seconds", async () => {
    vi.useFakeTimers();
    try {
      const pending = PUT(
        new Request("http://forecast.test/api/forecasts", {
          method: "PUT",
          headers: { origin: "http://forecast.test", "content-type": "application/json" },
          body: new ReadableStream<Uint8Array>(),
          duplex: "half",
        } as RequestInit),
      );
      await vi.advanceTimersByTimeAsync(10_001);
      await result(await pending, 408, { error: "request_timeout" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("passes role, rows and expected revision to the versioned RPC", async () => {
    await result(await PUT(request(body)), 200, record);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_crm_forecast", {
      p_document: document,
      p_expected_revision: 0,
    });
  });
  it("passes the free-text action plan after Total without treating it as numeric", async () => {
    const withActionPlan = structuredClone(body);
    withActionPlan.rows[0]!.cells.action_plan =
      "Revisar a abordagem comercial e retornar ao cliente na quinta-feira.";

    await result(await PUT(request(withActionPlan)), 200, record);
    expect(withActionPlan.columns.at(-1)).toEqual({
      id: "action_plan",
      label: "Plano de ação",
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_crm_forecast", {
      p_document: {
        ...document,
        rows: withActionPlan.rows,
      },
      p_expected_revision: 0,
    });
  });
  it.each(["texto", "12 reais", "1e3", "-1", "NaN", "Infinity", "1.234", "1000000000", "<script>"])(
    "rejects non-numeric or out-of-range comparison value %s before RPC",
    async (value) => {
      const invalid = structuredClone(body);
      invalid.rows[0]!.cells[firstGroup.forecastId] = value;
      await result(await PUT(request(invalid)), 400, { error: "invalid_forecast" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["40001", 409, "revision_conflict"],
    ["28000", 401, "unauthenticated"],
    ["42501", 403, "forbidden"],
    ["22023", 400, "invalid_forecast"],
    ["XX000", 503, "forecast_unavailable"],
  ])("maps RPC %s without leaking diagnostics", async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } });
    await result(await PUT(request()), Number(status), { error });
  });
  it.each([
    ["28000", 401, "unauthenticated"],
    ["42501", 403, "forbidden"],
  ])("honors revoked database read authorization %s", async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } });
    await result(await GET(), Number(status), { error });
  });
  it("rejects invalid save records and catches RPC exceptions", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...record, revision: 0 }, error: null });
    await result(await PUT(request()), 503, { error: "forecast_unavailable" });
    mocks.rpc.mockRejectedValueOnce(new Error("private diagnostic"));
    await result(await PUT(request()), 503, { error: "forecast_unavailable" });
  });
});
