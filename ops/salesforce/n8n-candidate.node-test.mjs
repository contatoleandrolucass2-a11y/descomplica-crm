import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const workflow = JSON.parse(
  readFileSync(new URL("./n8n-candidate-workflow.json", import.meta.url), "utf8"),
);
const validator = workflow.nodes.find((node) => node.type === "n8n-nodes-base.code");

function runValidator(payload) {
  const context = { $input: { first: () => ({ json: { body: payload } }) } };
  return vm.runInNewContext(`(function(){${validator.parameters.jsCode}\n})()`, context, {
    timeout: 1_000,
  });
}

function validPayload() {
  return {
    schemaVersion: 2,
    dashboard: {
      goalsAvailable: false,
      views: [{}, {}, {}],
      metrics: Array.from({ length: 15 }, () => ({
        goalMonth: 0,
        goalWeek: 0,
        goalToday: 0,
      })),
    },
    ranking: { rouletteAvailable: false, participants: [] },
  };
}

test("candidate stays inactive and has no credential or external HTTP node", () => {
  assert.equal(workflow.active, undefined);
  assert.equal(
    workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest").length,
    0,
  );
  assert.deepEqual(
    workflow.nodes.flatMap((node) => Object.keys(node.credentials ?? {})),
    [],
  );
});

test("candidate accepts the aggregate envelope", () => {
  const result = runValidator(validPayload());
  assert.equal(result[0].json.accepted, true);
});

test("candidate rejects source PII fields", () => {
  const payload = validPayload();
  payload.source = { cpf: "not-a-real-value" };
  assert.throws(() => runValidator(payload), /forbidden source field/);
});

test("candidate rejects unavailable sources carrying commercial values", () => {
  const goals = validPayload();
  goals.dashboard.metrics[0].goalMonth = 1;
  assert.throws(() => runValidator(goals), /unavailable goals must be zero/);

  const roulette = validPayload();
  roulette.ranking.participants.push({
    roulette: 1,
    rouletteSaturday: 0,
    rouletteSunday: 0,
  });
  assert.throws(() => runValidator(roulette), /unavailable roulette must be zero/);
});
