import assert from "node:assert/strict";
import { test } from "node:test";
import {
  probeSalesforceConnection,
  createCollectorProgress,
  sendConnectionObservation,
  statusDestination,
} from "./connection-monitor.mjs";
import { salesforceReportKeys } from "../../lib/crm/salesforce/connection-contract.ts";

const now = () => Date.parse("2026-10-08T12:00:00.000Z");
function options(response) {
  let closed = false;
  return {
    now,
    connect: async () => ({
      contexts: () => [
        {
          pages: () => [{ url: () => "https://direcional.lightning.force.com/lightning" }],
          cookies: async () => [{ name: "sid", value: "synthetic-session" }],
        },
      ],
      close: async () => {
        closed = true;
      },
    }),
    fetch: async (url, init) => {
      assert.equal(new URL(url).hostname, "direcional.my.salesforce.com");
      assert.equal(init.redirect, "manual");
      assert.equal(init.headers.authorization, "Bearer synthetic-session");
      return response;
    },
    closed: () => closed,
  };
}
test("marks connected only after authenticated API proof and disconnects CDP", async () => {
  const dependencies = options(Response.json({ reportMetadata: { detailColumns: ["Name"] } }));
  assert.deepEqual(await probeSalesforceConnection({}, dependencies), {
    state: "connected",
    errorCode: null,
    checkedAt: new Date(now()).toISOString(),
  });
  assert.equal(dependencies.closed(), true);
});
test("login redirects and expired session never produce connected", async () => {
  for (const status of [302, 401]) {
    const result = await probeSalesforceConnection({}, options(new Response(null, { status })));
    assert.equal(result.state, "reauth_required");
    assert.equal(result.errorCode, "session_expired");
  }
});
test("permission and upstream failures remain unavailable without reflecting error text", async () => {
  for (const status of [403, 429, 500]) {
    const result = await probeSalesforceConnection(
      {},
      options(new Response("private data", { status })),
    );
    assert.equal(result.state, "unavailable");
    assert.ok(!JSON.stringify(result).includes("private"));
  }
  const result = await probeSalesforceConnection(
    {},
    {
      now,
      connect: async () => {
        throw new Error("sid=secret");
      },
    },
  );
  assert.equal(result.errorCode, "browser_unavailable");
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("HTML login with 200 is not an authenticated report description", async () => {
  assert.equal(
    (await probeSalesforceConnection({}, options(new Response("<html>login</html>")))).state,
    "unavailable",
  );
});

test("a stalled CDP operation cannot block future probes", async () => {
  let closed = false;
  const result = await probeSalesforceConnection(
    {},
    {
      now,
      timeoutMs: 10,
      connect: async () => ({
        contexts: () => [
          {
            pages: () => [{ url: () => "https://direcional.lightning.force.com/lightning" }],
            cookies: () => new Promise(() => {}),
          },
        ],
        close: async () => {
          closed = true;
        },
      }),
    },
  );
  assert.equal(result.state, "unavailable");
  assert.equal(closed, true);
});
test("export completion is separate from confirmed publication", () => {
  const progress = createCollectorProgress(now);
  const candidate = {
    payload: { dashboard: { generatedAt: new Date(now()).toISOString() } },
    diagnostics: { sourceRows: Object.fromEntries(salesforceReportKeys.map((key) => [key, 10])) },
  };
  progress.start();
  progress.succeed(candidate, false);
  assert.equal(progress.snapshot().lastPublishedAt, null);
  assert.equal(progress.snapshot().reports.length, 7);
  progress.succeed(candidate, true);
  const publishedAt = progress.snapshot().lastPublishedAt;
  progress.start();
  progress.fail();
  assert.equal(progress.snapshot().lastPublishedAt, publishedAt);
  assert.equal(progress.snapshot().cycle, "failed");
  assert.throws(() => progress.succeed({ diagnostics: { sourceRows: {} } }, false), /incomplete/);
});
test("status destination defaults off and rejects unsafe origins", async () => {
  assert.equal(await statusDestination({}), null);
  for (const origin of [
    "http://crm.example.test",
    "https://user:pass@crm.example.test",
    "https://crm.example.test/path",
    "https://crm.example.test/?token=private",
  ]) {
    await assert.rejects(
      statusDestination({ SALESFORCE_STATUS_ENABLED: "true", SALESFORCE_CRM_ORIGIN: origin }),
      /HTTPS|invalid/,
    );
  }
});
test("status output has no session material and requires a final receiver acknowledgment", async () => {
  const observation = {
    schemaVersion: 1,
    organization: "direcional",
    observedAt: new Date(now()).toISOString(),
    checkedAt: new Date(now()).toISOString(),
    state: "connected",
    ...createCollectorProgress(now).snapshot(),
  };
  let sent;
  await sendConnectionObservation(
    { url: new URL("https://crm.example.test/api/salesforce/status"), secret: "synthetic-only" },
    observation,
    {
      fetch: async (_url, init) => {
        sent = JSON.parse(init.body);
        assert.equal(init.redirect, "error");
        return Response.json({ ok: true }, { status: 202 });
      },
    },
  );
  assert.equal(sent.state, "connected");
  assert.ok(!JSON.stringify(sent).includes("synthetic-only"));
  await assert.rejects(
    sendConnectionObservation(
      { url: "https://crm.example.test", secret: "synthetic-only" },
      observation,
      { fetch: async () => Response.json({ ok: true }, { status: 200 }) },
    ),
    /not accepted/,
  );
});
