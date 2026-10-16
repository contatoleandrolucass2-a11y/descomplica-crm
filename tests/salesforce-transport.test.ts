import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/ingest/salesforce/route";
import { MAX_SALESFORCE_INGESTION_BODY_BYTES } from "../lib/crm/salesforce/transport";
import { MAX_INGESTION_BODY_BYTES } from "../lib/security/api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  parse: vi.fn(),
  configuration: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/privileged", () => ({
  createPrivilegedClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/crm/salesforce/config", () => ({
  getSalesforceIngestConfiguration: mocks.configuration,
}));
// Transport tests isolate schema validation; its real contract has separate tests.
vi.mock("@/lib/crm/ingestion/schema", () => ({
  salesforceIngestionSchema: { safeParse: mocks.parse },
}));

const secret = "s".repeat(64);
const requestId = "60000000-0000-4000-8000-000000000001";
const limit = MAX_SALESFORCE_INGESTION_BODY_BYTES;

function bodyOfBytes(bytes: number) {
  const empty = JSON.stringify({ requestId, synthetic: "" });
  const remaining = bytes - Buffer.byteLength(empty);
  return (
    JSON.stringify({ requestId, synthetic: "\u00e9".repeat(Math.floor(remaining / 2)) }) +
    " ".repeat(remaining % 2)
  );
}

function request(body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ingest/salesforce", {
    method: "POST",
    body,
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", ...headers },
    ...{ duplex: "half" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configuration.mockReturnValue({ available: true, enabled: true, ingestSecret: secret });
  mocks.parse.mockImplementation((data: unknown) => ({ success: true, data }));
  mocks.rpc.mockResolvedValue({
    data: { ok: true, status: "succeeded", recordCount: 1 },
    error: null,
  });
});

describe("Salesforce-specific bounded transport", () => {
  it("shares an 8 MiB limit without changing the global ingestion limit", () => {
    expect(limit).toBe(8_388_608);
    expect(MAX_INGESTION_BODY_BYTES).toBe(1_000_000);
  });

  it.each([2_150_979, limit])(
    "accepts %i actual UTF-8 bytes through the existing RPC",
    async (bytes) => {
      const body = bodyOfBytes(bytes);
      expect(Buffer.byteLength(body, "utf8")).toBe(bytes);
      expect(body.length).toBeLessThan(bytes);
      const response = await POST(request(body, { "content-length": String(bytes) }));
      expect(response.status).toBe(201);
      expect(mocks.rpc).toHaveBeenCalledWith("ingest_crm_salesforce_snapshot", {
        p_payload: JSON.parse(body),
      });
    },
  );

  it.each([String(limit + 1), "9".repeat(400)])(
    "rejects oversized declared length before reading (%#)",
    async (length) => {
      const input = request("{}", { "content-length": length });
      const getReader = vi.spyOn(input.body!, "getReader");
      const response = await POST(input);
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: "payload_too_large" });
      expect(getReader).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "0", String(limit)])(
    "bounds actual stream bytes despite missing or understated length (%#)",
    async (length) => {
      let pulls = 0;
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls += 1;
            controller.enqueue(new Uint8Array(pulls === 1 ? limit : 1));
          },
          cancel,
        },
        { highWaterMark: 0 },
      );
      const response = await POST(
        request(body, length === undefined ? {} : { "content-length": length }),
      );
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: "payload_too_large" });
      expect(pulls).toBe(2);
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
      expect(mocks.parse).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects a multibyte body above 8 MiB even when its character count fits", async () => {
    const body = bodyOfBytes(limit + 1);
    expect(body.length).toBeLessThan(limit);
    const response = await POST(request(body));
    expect(response.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["-1", "NaN", "Infinity", "1.5", "1e6", ""])(
    'rejects malformed Content-Length "%s"',
    async (length) => {
      const response = await POST(request("{}", { "content-length": length }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_payload" });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("authenticates before reading any body", async () => {
    const input = request("{}", { authorization: "Bearer invalid" });
    const getReader = vi.spyOn(input.body!, "getReader");
    const response = await POST(input);
    expect(response.status).toBe(401);
    expect(getReader).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sanitizes stream failures and malformed UTF-8 without calling the RPC", async () => {
    for (const body of [
      new ReadableStream<Uint8Array>({
        start: (controller) => controller.error(new Error("private synthetic detail")),
      }),
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0xff]));
          controller.close();
        },
      }),
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_payload" });
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps legacy JSON without analysis and disabled ingestion behavior", async () => {
    expect((await POST(request(JSON.stringify({ requestId })))).status).toBe(201);
    mocks.configuration.mockReturnValue({ available: false, enabled: false });
    expect((await POST(request("{}"))).status).toBe(404);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
