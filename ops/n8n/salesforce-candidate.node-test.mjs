import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const baseline = JSON.parse(read('../salesforce/n8n-candidate-workflow.json'));
const settings = JSON.parse(read('./salesforce-candidate.settings.json'));
const source = read('./salesforce-candidate.sdk.js');
const nodes = [];
const chain = { add(value) { nodes.push(value); return this; }, to(value) { nodes.push(value); return this; } };
// Evaluate the trusted SDK source with capture-only builders; no SDK installation or network.
vm.runInNewContext(source.replace(/^import .*;\r?\n/, '').replace('export default ', ''), {
  workflow: () => chain, node: (value) => value, trigger: (value) => value,
  newCredential: (name) => ({ name }), expr: (value) => '=' + value,
}, { timeout: 1000 });

test('candidate only receives, validates and responds, without outbound or schedule nodes', () => {
  assert.deepEqual(nodes.map((item) => item.type), [
    'n8n-nodes-base.webhook', 'n8n-nodes-base.code', 'n8n-nodes-base.respondToWebhook',
  ]);
  assert.equal(nodes[0].config.parameters.authentication, 'headerAuth');
  assert.equal(nodes[0].config.credentials.httpHeaderAuth.name, 'CRM VPS - Snapshot entrada');
});

test('candidate validator matches the tested baseline', () => {
  const validator = baseline.nodes.find((item) => item.type === 'n8n-nodes-base.code');
  assert.equal(nodes[1].config.parameters.jsCode, validator.parameters.jsCode);
});

test('candidate response cannot be mistaken for a published snapshot receipt', () => {
  assert.equal(nodes[2].config.parameters.options.responseCode, 202);
  assert.equal(nodes[2].config.parameters.responseBody,
    '={{ { ok: false, status: "candidate_validated_not_published" } }}');
});

test('candidate settings disable payload persistence and bound execution time', () => {
  assert.equal(settings.saveDataErrorExecution, 'none');
  assert.equal(settings.saveDataSuccessExecution, 'none');
  assert.equal(settings.saveExecutionProgress, false);
  assert.equal(settings.saveManualExecutions, false);
  assert.equal(settings.executionTimeout, 600);
  assert.equal(settings.timezone, 'America/Sao_Paulo');
});
