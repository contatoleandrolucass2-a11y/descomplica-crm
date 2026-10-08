import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorize }));
import { GET, POST } from "@/app/api/salesforce/status/route";
import { getSalesforceStatusConfiguration } from "@/lib/crm/salesforce/config";
import { SalesforceConnectionState } from "@/lib/crm/salesforce/connection-state";
import {
  salesforceObservationSchema,
  salesforceReportKeys,
  type SalesforceObservation,
} from "@/lib/crm/salesforce/connection-contract";

const now = Date.parse("2026-10-08T12:00:00.000Z");
const secret = "synthetic-status-secret-not-used-remotely-172";
function observation(overrides: Partial<SalesforceObservation> = {}): SalesforceObservation {
  return {
    schemaVersion: 1,
    organization: "direcional",
    observedAt: new Date(now).toISOString(),
    state: "connected",
    checkedAt: new Date(now).toISOString(),
    nextRunAt: null,
    cycle: "idle",
    lastExportAt: null,
    lastPublishedAt: null,
    reports: null,
    errorCode: null,
    ...overrides,
  };
}
function request(body: unknown, token = secret) {
  return new Request("https://crm.example.test/api/salesforce/status", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("SALESFORCE_STATUS_ENABLED", "true");
  vi.stubEnv("SALESFORCE_STATUS_SECRET", secret);
  mocks.authorize.mockResolvedValue({ ok: true, context: {} });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Salesforce connection observation", () => {
  it("does not infer connection from configuration or restart", () => {
    const state = new SalesforceConnectionState();
    expect(state.snapshot(secret, now).state).toBe("waiting");
    expect(getSalesforceStatusConfiguration({})).toEqual({ enabled: false, available: false });
    expect(getSalesforceStatusConfiguration({ SALESFORCE_STATUS_ENABLED: "true" }).available).toBe(
      false,
    );
  });
  it("expires both an absent heartbeat and an old Salesforce check", () => {
    const state = new SalesforceConnectionState();
    expect(state.accept(observation(), secret, now)).toBe("accepted");
    expect(state.snapshot(secret, now + 119_999).state).toBe("connected");
    expect(state.snapshot(secret, now + 120_000)).toMatchObject({
      state: "stale",
      errorCode: "collector_unreachable",
      nextRunAt: null,
    });
    expect(
      state.accept(
        observation({ observedAt: new Date(now + 150_000).toISOString() }),
        secret,
        now + 150_000,
      ),
    ).toBe("invalid_time");
  });
  it("rejects replay, future events and implausible schedules", () => {
    const state = new SalesforceConnectionState();
    expect(state.accept(observation(), secret, now)).toBe("accepted");
    expect(state.accept(observation(), secret, now)).toBe("out_of_order");
    expect(
      state.accept(observation({ observedAt: new Date(now + 10_000).toISOString() }), secret, now),
    ).toBe("invalid_time");
    expect(
      state.accept(
        observation({ nextRunAt: new Date(now + 40 * 60_000).toISOString() }),
        secret,
        now,
      ),
    ).toBe("invalid_time");
  });
  it("drops receipts when the shared secret changes", () => {
    const state = new SalesforceConnectionState();
    state.accept(observation(), secret, now);
    expect(state.snapshot("rotated-synthetic-secret", now).state).toBe("waiting");
  });
  it("does not expose mutable receipts", () => {
    const state = new SalesforceConnectionState();
    const input = observation({
      reports: salesforceReportKeys.map((key) => ({ key, rows: 4 })),
      lastExportAt: new Date(now).toISOString(),
    });
    state.accept(input, secret, now);
    input.reports![0]!.rows = 999;
    const first = state.snapshot(secret, now);
    first.reports![0]!.rows = 444;
    expect(state.snapshot(secret, now).reports![0]!.rows).toBe(4);
  });
  it("requires exactly seven distinct report counts with export evidence", () => {
    const rows = salesforceReportKeys.map((key) => ({ key, rows: 1 }));
    expect(salesforceObservationSchema.safeParse(observation({ reports: rows })).success).toBe(
      false,
    );
    expect(
      salesforceObservationSchema.safeParse(
        observation({
          reports: [...rows.slice(1), rows[1]!],
          lastExportAt: new Date(now).toISOString(),
        }),
      ).success,
    ).toBe(false);
    expect(
      salesforceObservationSchema.safeParse({ ...observation(), password: "must-not-enter-status" })
        .success,
    ).toBe(false);
    expect(
      salesforceObservationSchema.safeParse(observation({ organization: "other" as "direcional" }))
        .success,
    ).toBe(false);
  });
  it("preserves historical publication but invalidates a lost running cycle", () => {
    const state = new SalesforceConnectionState();
    const last = new Date(now - 60_000).toISOString();
    state.accept(
      observation({ cycle: "running", lastExportAt: last, lastPublishedAt: last }),
      secret,
      now,
    );
    expect(state.snapshot(secret, now + 120_000)).toMatchObject({
      state: "stale",
      cycle: "failed",
      lastPublishedAt: last,
    });
  });
});

describe("Salesforce status API", () => {
  it("authorizes management even when telemetry is disabled", async () => {
    vi.stubEnv("SALESFORCE_STATUS_ENABLED", "false");
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    });
    expect((await GET()).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledWith("crm.settings.manage");
  });
  it("does not accept a CRM login or incorrect bearer as machine authentication", async () => {
    expect((await POST(request(observation(), "user-session"))).status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("does not reveal status to an unauthenticated reader", async () => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });
    expect((await GET()).status).toBe(401);
  });
  it("fails closed for disabled and incomplete receiver configuration", async () => {
    vi.stubEnv("SALESFORCE_STATUS_ENABLED", "false");
    expect((await POST(request(observation()))).status).toBe(404);
    vi.stubEnv("SALESFORCE_STATUS_ENABLED", "true");
    vi.stubEnv("SALESFORCE_STATUS_SECRET", "short");
    expect((await POST(request(observation()))).status).toBe(503);
  });
  it("accepts only authenticated validated observations without exposing secrets", async () => {
    const accepted = await POST(request(observation()));
    expect(accepted.status).toBe(202);
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.text();
    expect(JSON.parse(body).state).toBe("connected");
    expect(body).not.toContain(secret);
    expect(body).not.toContain("Bearer");
    expect((await POST(request(observation()))).status).toBe(409);
  });
  it("rejects sensitive fields and bounded body overflow before state mutation", async () => {
    expect((await POST(request({ ...observation(), sid: "private" }))).status).toBe(400);
    expect((await POST(request({ value: "x".repeat(9_000) }))).status).toBe(413);
  });
  it("rejects malformed JSON and unsupported content type", async () => {
    const bad = new Request("https://crm.example.test/api/salesforce/status", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: "{",
    });
    expect((await POST(bad)).status).toBe(400);
    const noType = new Request("https://crm.example.test/api/salesforce/status", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      body: "{}",
    });
    expect((await POST(noType)).status).toBe(415);
    const wrongType = new Request("https://crm.example.test/api/salesforce/status", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json-bogus" },
      body: "{}",
    });
    expect((await POST(wrongType)).status).toBe(415);
  });
  it("does not accept a complete JSON prefix from a body that never finishes", async () => {
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(observation())));
      },
      cancel() {
        cancelled = true;
      },
    });
    const pending = POST(
      new Request("https://crm.example.test/api/salesforce/status", {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(5_001);
    expect((await pending).status).toBe(400);
    expect(cancelled).toBe(true);
  });
});
