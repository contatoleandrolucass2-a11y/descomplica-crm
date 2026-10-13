import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const baseline = JSON.parse(read("../salesforce/n8n-candidate-workflow.json"));
const settings = JSON.parse(read("./salesforce-candidate.settings.json"));
const source = read("./salesforce-candidate.sdk.js");
const nodes = [];
const chain = {
  add(value) {
    nodes.push(value);
    return this;
  },
  to(value) {
    nodes.push(value);
    return this;
  },
};
// Evaluate the trusted SDK source with capture-only builders; no SDK installation or network.
vm.runInNewContext(
  source.replace(/^import .*;\r?\n/, "").replace("export default ", ""),
  {
    workflow: () => chain,
    node: (value) => value,
    trigger: (value) => value,
    newCredential: (name) => ({ name }),
    expr: (value) => "=" + value,
  },
  { timeout: 1000 },
);

test("candidate sends only through fixed CRM endpoint, without schedule or direct database access", () => {
  assert.deepEqual(
    nodes.map((item) => item.type),
    [
      "n8n-nodes-base.webhook",
      "n8n-nodes-base.code",
      "n8n-nodes-base.httpRequest",
      "n8n-nodes-base.code",
      "n8n-nodes-base.respondToWebhook",
    ],
  );
  assert.equal(nodes[0].config.parameters.authentication, "headerAuth");
  assert.equal(nodes[0].config.credentials.httpHeaderAuth.name, "CRM VPS - Snapshot entrada");
  const outbound = nodes[2].config;
  assert.equal(outbound.parameters.url, "https://crm.descomplicapro.com.br/api/ingest/salesforce");
  assert.equal(outbound.parameters.method, "POST");
  assert.equal(outbound.credentials.httpHeaderAuth.name, "CRM VPS - Ingestao CRM saida");
  assert.equal(outbound.parameters.jsonBody, "={{ $json.payload }}");
  assert.equal(outbound.parameters.options.timeout, 60000);
  assert.equal(outbound.parameters.options.allowUnauthorizedCerts, false);
  assert.equal(outbound.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(outbound.parameters.options.sendCredentialsOnCrossOriginRedirect, false);
  assert.equal(outbound.parameters.options.response.response.fullResponse, true);
  assert.equal(outbound.retryOnFail, false);
  assert.equal(outbound.onError, "stopWorkflow");
});

test("candidate validator matches the tested baseline", () => {
  const validator = baseline.nodes.find((item) => item.type === "n8n-nodes-base.code");
  assert.equal(nodes[1].config.parameters.jsCode, validator.parameters.jsCode);
});

test("candidate prefilter rejects explicitly forbidden keys without exposing values", () => {
  const payload = {
    schemaVersion: 2,
    dashboard: {
      goalsAvailable: false,
      views: [{}, {}, {}],
      metrics: Array.from({ length: 15 }, () => ({ goalMonth: 0, goalWeek: 0, goalToday: 0 })),
    },
    email: "synthetic@example.invalid",
  };
  assert.throws(
    () =>
      vm.runInNewContext(
        "(function () { " + nodes[1].config.parameters.jsCode + " })()",
        {
          $input: { first: () => ({ json: { body: payload } }) },
        },
        { timeout: 1000 },
      ),
    /forbidden source field/,
  );
});

test("response uses only the checked receipt and prevents caching", () => {
  assert.equal(nodes[4].config.parameters.options.responseCode, "={{ $json.statusCode }}");
  assert.equal(nodes[4].config.parameters.responseBody, "={{ $json.receipt }}");
  assert.equal(nodes[4].config.parameters.options.responseHeaders.entries[0].value, "no-store");
});

const requestId = "00000000-0000-4000-8000-000000000001";
function checkReceipt(response, expectedId = requestId) {
  return vm.runInNewContext(
    "(function () { " + nodes[3].config.parameters.jsCode + " })()",
    {
      $input: { first: () => ({ json: response }) },
      $: (name) => {
        assert.equal(name, "Validar Contrato e PII");
        return { first: () => ({ json: { payload: { requestId: expectedId } } }) };
      },
    },
    { timeout: 1000 },
  )[0].json;
}

for (const code of [200, 201]) {
  test("accepts matching receipt HTTP " + code, () => {
    const result = checkReceipt({
      statusCode: code,
      body: { ok: true, requestId, idempotent: code === 200, privateField: "not forwarded" },
    });
    assert.equal(result.statusCode, code);
    assert.equal(result.receipt.ok, true);
    assert.equal(result.receipt.requestId, requestId);
    assert.equal(result.receipt.idempotent, code === 200);
    assert.equal("privateField" in result.receipt, false);
  });
}

for (const response of [
  { statusCode: 202, body: { ok: true, requestId, idempotent: false } },
  { statusCode: 503, body: { ok: true, requestId, idempotent: false } },
  { statusCode: 201, body: { ok: false, requestId, idempotent: false } },
  { statusCode: 201, body: { ok: true, requestId: "different", idempotent: false } },
  { statusCode: 201, body: { ok: true, requestId } },
  { statusCode: 200, body: { ok: true, requestId, idempotent: false } },
  { statusCode: 201, body: { ok: true, requestId, idempotent: true } },
  { statusCode: "201", body: { ok: true, requestId, idempotent: false } },
  { statusCode: 201, body: "<html>login</html>" },
  { statusCode: 201, body: null },
  {},
]) {
  test("rejects unconfirmed receipt " + JSON.stringify(response), () => {
    const result = checkReceipt(response);
    assert.equal(result.statusCode, 502);
    assert.equal(result.receipt.ok, false);
    assert.deepEqual(Object.keys(result.receipt).sort(), ["ok", "status"]);
  });
}

test("missing expected requestId cannot confirm publication", () => {
  assert.equal(
    checkReceipt({ statusCode: 201, body: { ok: true, idempotent: false } }, null).receipt.ok,
    false,
  );
});

test("candidate settings disable payload persistence and bound execution time", () => {
  assert.equal(settings.saveDataErrorExecution, "none");
  assert.equal(settings.saveDataSuccessExecution, "none");
  assert.equal(settings.saveExecutionProgress, false);
  assert.equal(settings.saveManualExecutions, false);
  assert.equal(settings.executionTimeout, 600);
  assert.equal(settings.timezone, "America/Sao_Paulo");
});
