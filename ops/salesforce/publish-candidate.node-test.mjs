import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { publishSalesforceCandidate } from "./publish-candidate.mjs";

let directory;
let secretPath;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "salesforce-publish-test-"));
  secretPath = path.join(directory, "source-bearer");
  await writeFile(secretPath, `${"s".repeat(64)}\n`, { mode: 0o600 });
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

function candidate() {
  return {
    payload: {
      schemaVersion: 2,
      requestId: "00000000-0000-4000-8000-000000000001",
      dashboard: {},
    },
    diagnostics: { mustNotBeSent: true },
  };
}

function environment(overrides = {}) {
  return {
    SALESFORCE_N8N_PUBLISH_ENABLED: "true",
    SALESFORCE_N8N_WEBHOOK_URL: "https://automation.example/webhook/salesforce",
    SALESFORCE_N8N_SECRET_FILE: secretPath,
    ...overrides,
  };
}

test("keeps publication fail-closed while disabled", async () => {
  let called = false;
  const result = await publishSalesforceCandidate(
    candidate(),
    { SALESFORCE_N8N_PUBLISH_ENABLED: "false" },
    { fetch: async () => (called = true) },
  );
  assert.deepEqual(result, { published: false, status: "disabled" });
  assert.equal(called, false);
});

test("sends only the aggregate payload with the source bearer", async () => {
  const source = candidate();
  const result = await publishSalesforceCandidate(source, environment(), {
    fetch: async (url, init) => {
      assert.equal(url.href, "https://automation.example/webhook/salesforce");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.authorization, `Bearer ${"s".repeat(64)}`);
      assert.deepEqual(JSON.parse(init.body), source.payload);
      assert.equal(init.body.includes("mustNotBeSent"), false);
      return new Response(
        JSON.stringify({
          ok: true,
          requestId: source.payload.requestId,
          idempotent: false,
          recordCount: 19,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.deepEqual(result, {
    published: true,
    status: 201,
    requestId: source.payload.requestId,
    idempotent: false,
    recordCount: 19,
  });
});

test("rejects premature validation responses and unsafe configuration", async () => {
  await assert.rejects(
    publishSalesforceCandidate(candidate(), environment(), {
      fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 202 }),
    }),
    /HTTP 202/,
  );
  await assert.rejects(
    publishSalesforceCandidate(
      candidate(),
      environment({ SALESFORCE_N8N_WEBHOOK_URL: "http://automation.example/webhook" }),
    ),
    /credential-free HTTPS/,
  );
  await assert.rejects(
    publishSalesforceCandidate(
      candidate(),
      environment({ SALESFORCE_N8N_WEBHOOK_URL: "https://automation.example/webhook?token=x" }),
    ),
    /credential-free HTTPS/,
  );
  await chmod(secretPath, 0o640);
  await assert.rejects(
    publishSalesforceCandidate(candidate(), environment()),
    /private regular file/,
  );
  await chmod(secretPath, 0o600);
});

test("rejects a candidate without the versioned payload identity", async () => {
  await assert.rejects(
    publishSalesforceCandidate({ payload: { requestId: "request" } }, environment()),
    /payload identity is invalid/,
  );
});

test("requires the downstream CRM response for the same request", async () => {
  await assert.rejects(
    publishSalesforceCandidate(candidate(), environment(), {
      fetch: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            requestId: "00000000-0000-4000-8000-000000000099",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    }),
    /did not confirm the request/,
  );
});
