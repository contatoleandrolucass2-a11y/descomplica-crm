import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
import { GET, POST } from "@/app/api/ingest/qlik/status/route";
import { QlikStatusState } from "@/lib/crm/qlik/status-state";
import {
  emptyQlikStatus,
  QLIK_STATUS_PATH,
  type QlikStatusObservation,
} from "@/lib/crm/qlik/status-contract";
import { createQlikRelaySignature, qlikRelayBodySha256 } from "@/lib/crm/qlik/auth";
import {
  QlikServiceCard,
  QlikStatusDetails,
} from "@/app/(protected)/app/configuracoes/conectar-sistemas/QlikIntegration";

const now = Date.parse("2026-10-16T12:00:00.000Z");
let secret: string;
function observation(overrides: Partial<QlikStatusObservation> = {}): QlikStatusObservation {
  return {
    schemaVersion: 1,
    observedAt: new Date(now).toISOString(),
    cycleAt: new Date(now).toISOString(),
    cycle: "running",
    lastCollectedAt: null,
    lastPublishedAt: null,
    sourceUpdatedAt: null,
    nextRunAt: null,
    ...overrides,
  };
}
function request(
  payload: unknown = observation(),
  options: {
    path?: typeof QLIK_STATUS_PATH | "/api/ingest/qlik/v2";
    signedBody?: string;
    secret?: string;
    nonce?: string;
  } = {},
) {
  const body = JSON.stringify(payload);
  const fields = {
    keyId: "qlik-ranking-v2",
    timestamp: new Date(now).toISOString(),
    nonce: options.nonce ?? randomUUID(),
    bodySha256: qlikRelayBodySha256(Buffer.from(options.signedBody ?? body)),
  };
  return new Request(`https://crm.example.test${QLIK_STATUS_PATH}`, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      authorization: `HMAC-SHA256 ${createQlikRelaySignature(options.secret ?? secret, fields, options.path ?? QLIK_STATUS_PATH)}`,
      "x-crm-relay-key-id": fields.keyId,
      "x-crm-relay-timestamp": fields.timestamp,
      "x-crm-relay-nonce": fields.nonce,
      "x-crm-relay-content-sha256": fields.bodySha256,
    },
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  secret = randomUUID().replaceAll("-", "") + "synthetic-status-fixture";
  vi.stubEnv("QLIK_RANKING_V2_ENABLED", "true");
  vi.stubEnv("QLIK_RANKING_V2_HMAC_SECRET", secret);
  vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-database-key");
  mocks.authorize.mockResolvedValue({ ok: true, context: {} });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Qlik live status", () => {
  it("requires fresh evidence after restart and key rotation", () => {
    const state = new QlikStatusState();
    expect(state.snapshot(secret, now).state).toBe("waiting");
    expect(state.accept(observation(), "nonce", secret, now)).toBe("accepted");
    expect(state.snapshot(secret, now + 89_999).state).toBe("running");
    expect(state.snapshot(secret, now + 90_000).state).toBe("stale");
    expect(state.snapshot("rotated", now).state).toBe("waiting");
  });
  it("does not keep a stuck cycle green through fresh heartbeats", () => {
    const state = new QlikStatusState();
    const future = now + 480_001;
    expect(
      state.accept(
        observation({ observedAt: new Date(future).toISOString() }),
        "nonce",
        secret,
        future,
      ),
    ).toBe("accepted");
    expect(state.snapshot(secret, future)).toMatchObject({ state: "stale", nextRunAt: null });
  });
  it("preserves the last publication when a later cycle needs login", () => {
    const state = new QlikStatusState();
    const previous = new Date(now - 60_000).toISOString();
    state.accept(
      observation({
        cycle: "reauth_required",
        lastCollectedAt: previous,
        lastPublishedAt: previous,
      }),
      "nonce",
      secret,
      now,
    );
    expect(state.snapshot(secret, now)).toMatchObject({
      state: "reauth_required",
      lastPublishedAt: previous,
    });
  });
  it("rejects unproved publication, future dates, unknown fields and invalid schedules", () => {
    for (const input of [
      observation({ cycle: "succeeded" }),
      observation({ observedAt: new Date(now + 6000).toISOString() }),
      { ...observation(), password: "private" },
      observation({ nextRunAt: new Date(now + 60_000).toISOString() }),
    ]) {
      expect(new QlikStatusState().accept(input, "nonce", secret, now)).not.toBe("accepted");
    }
  });
});
describe("Qlik status boundary", () => {
  it.each([401, 403])("requires the integrations page authorization (%s)", async (status) => {
    mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status }) });
    expect((await GET()).status).toBe(status);
    expect(mocks.authorize).toHaveBeenCalledWith("/app/configuracoes/conectar-sistemas");
  });
  it("accepts signed evidence without cookies; exposes no credentials", async () => {
    expect((await POST(request())).status).toBe(202);
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.text();
    expect(body).toContain('"state":"running"');
    expect(body).not.toContain(secret);
  });
  it("rejects modified bodies, other-route signatures and wrong keys", async () => {
    expect((await POST(request(observation(), { signedBody: "{}" }))).status).toBe(401);
    expect((await POST(request(observation(), { path: "/api/ingest/qlik/v2" }))).status).toBe(401);
    expect((await POST(request(observation(), { secret: "wrong" }))).status).toBe(401);
  });
  it("rejects replay and out-of-order heartbeats", async () => {
    const nonce = randomUUID();
    expect((await POST(request(observation(), { nonce }))).status).toBe(202);
    expect((await POST(request(observation(), { nonce }))).status).toBe(409);
    expect((await POST(request())).status).toBe(409);
  });
  it("caps streamed payloads and refuses unknown fields", async () => {
    expect((await POST(request({ data: "x".repeat(9000) }))).status).toBe(413);
    expect((await POST(request({ ...observation(), sourceRows: [] }))).status).toBe(422);
  });
  it("remains unavailable when ingestion is disabled", async () => {
    vi.stubEnv("QLIK_RANKING_V2_ENABLED", "false");
    expect((await POST(request())).status).toBe(404);
    expect(await (await GET()).json()).toMatchObject({ state: "unconfigured" });
  });
});
it("renders theme logos and an honest login-needed state without fabricating dates", () => {
  const snapshot = emptyQlikStatus("reauth_required");
  const html = renderToStaticMarkup(
    <>
      <QlikServiceCard snapshot={snapshot} />
      <QlikStatusDetails snapshot={snapshot} />
    </>,
  );
  expect(html).toContain("/integrations/qlik-light.svg");
  expect(html).toContain("/integrations/qlik-dark.svg");
  expect(html).toContain("Login necessário");
  expect(html).toContain("Sem agenda confirmada");
  expect(html).not.toContain("<time");
});
