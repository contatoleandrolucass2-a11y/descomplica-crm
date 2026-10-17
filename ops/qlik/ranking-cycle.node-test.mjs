import assert from "node:assert/strict";
import test from "node:test";
import { runRankingCycle } from "./ranking-cycle.mjs";
import { rankingCycleArtifact } from "./ranking-artifact.mjs";

const ids = [1, 2, 3].map((n) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`);
const secret = "a".repeat(43);
const digest = "f".repeat(64);
const source = {
  appId: "7c000871-8b32-4c0f-bfd5-4b9d46946575",
  sheetId: "46d5bcf7-965d-40fc-a808-2fdde2d0f74d",
  mappingSha256: "b".repeat(64),
  reloadTimestamp: "2026-10-14T17:00:00.000Z",
};
const scope = { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" };
const cube = () => ({
  coverage: { state: "complete", sourceRows: 1 },
  nativeTotals: { vgv: "100.25", contracts: 1 },
  rows: [{ key: "1", name: "Synthetic entity", vgv: "100.25", contracts: 1 }],
});
const collected = () => ({
  status: "collected",
  source,
  scope,
  months: [{ periodMonth: "2026-09-01", imobs: cube(), developments: cube() }],
});

function setup(overrides = {}) {
  let serial = 0;
  let tick = 0;
  const calls = [];
  const controller = new AbortController();
  const options = {
    secret,
    signal: controller.signal,
    uuid: () => ids[serial++],
    now: () => new Date(Date.UTC(2026, 9, 14, 18, 0, tick++)),
    collect: async ({ identity }) => {
      calls.push({ collect: identity });
      return collected();
    },
    publish: async (payload, credentials) => {
      calls.push({ payload, credentials });
      return {
        state: payload.requestId === ids[1] ? "staged" : "published",
        requestId: payload.requestId,
        contentSha256: digest,
      };
    },
    ...overrides,
  };
  return { calls, controller, options };
}

test("cycle collects independently before publishing immutable observations", async () => {
  const { options, calls } = setup();
  const result = await runRankingCycle(options);
  assert.equal(result.state, "succeeded");
  assert.deepEqual(calls.slice(0, 2), [{ collect: ids[1] }, { collect: ids[2] }]);
  const [first, second] = calls.slice(2).map((item) => item.payload);
  assert.equal(first.batchId, second.batchId);
  assert.notEqual(first.requestId, second.requestId);
  assert.notEqual(first.source, second.source);
  assert.equal(first.completedAt < second.startedAt, true);
  assert.deepEqual(first.source, second.source);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

for (const status of ["pending", "unavailable", "inspected", undefined]) {
  test(`cycle refuses collection status ${status}`, async () => {
    const { options, calls } = setup({ collect: async () => ({ ...collected(), status }) });
    assert.equal((await runRankingCycle(options)).state, "unavailable");
    assert.equal(calls.length, 0);
  });
}

test("reauthentication is explicit and never sends partial data", async () => {
  const { options, calls } = setup({ collect: async () => ({ status: "reauth_required" }) });
  assert.deepEqual(await runRankingCycle(options), { state: "reauth_required" });
  assert.equal(calls.length, 0);
});

for (const field of ["reloadTimestamp", "mappingSha256", "appId"]) {
  test(`changed ${field} between independent collections prevents publication`, async () => {
    let count = 0;
    const { options, calls } = setup({
      collect: async () => ({
        ...collected(),
        source: { ...source, [field]: String(count++) },
      }),
    });
    assert.deepEqual(await runRankingCycle(options), {
      state: "unavailable",
      reason: "collection_changed",
    });
    assert.equal(calls.length, 0);
  });
}

test("shared mutable source cannot alter a finished observation", async () => {
  const shared = structuredClone(collected());
  let count = 0;
  const { options, calls } = setup({
    collect: async () => {
      shared.source.reloadTimestamp = String(count++);
      return shared;
    },
  });
  assert.equal((await runRankingCycle(options)).reason, "collection_changed");
  assert.equal(calls.length, 0);
});

test("scope cannot widen", async () => {
  const { options, calls } = setup({
    collect: async () => ({ ...collected(), scope: { ...scope, channel: "other" } }),
  });
  assert.equal((await runRankingCycle(options)).reason, "collection_scope");
  assert.equal(calls.length, 0);
});

test("differences in month rows prevent publication", async () => {
  let count = 0;
  const { options, calls } = setup({
    collect: async () => {
      const value = collected();
      value.months[0].imobs.rows[0].name += count++;
      return value;
    },
  });
  assert.equal((await runRankingCycle(options)).reason, "collection_changed");
  assert.equal(calls.length, 0);
});

for (const invalidate of [
  (value) => {
    value.months = [];
  },
  (value) => {
    value.months[0].imobs.nativeTotals.vgv = "100.26";
  },
  (value) => {
    value.months[0].developments.coverage.sourceRows = 2;
  },
]) {
  test("matching invalid observations never reach the publisher", async () => {
    const { options, calls } = setup({
      collect: async () => {
        const value = collected();
        invalidate(value);
        return value;
      },
    });
    assert.equal((await runRankingCycle(options)).reason, "invalid_observation");
    assert.equal(calls.length, 0);
  });
}

test("duplicate session identities are rejected before collection", async () => {
  const { options, calls } = setup({ uuid: () => ids[0] });
  assert.equal((await runRankingCycle(options)).reason, "cycle_identity");
  assert.equal(calls.length, 0);
});

test("backwards clock stops before publishing", async () => {
  let tick = 3;
  const { options, calls } = setup({ now: () => new Date(Date.UTC(2026, 9, 14, 18, 0, tick--)) });
  assert.equal((await runRankingCycle(options)).reason, "cycle_clock");
  assert.equal(calls.filter((call) => call.payload).length, 0);
});

test("cancellation after first collection prevents second collection and publication", async () => {
  const { options, controller, calls } = setup();
  options.collect = async () => {
    controller.abort();
    return collected();
  };
  assert.equal((await runRankingCycle(options)).reason, "cancelled");
  assert.equal(calls.length, 0);
});

test("staged is never success and a failed stage prevents the second send", async () => {
  let sends = 0;
  const { options } = setup({
    publish: async () => {
      sends++;
      return { state: "unavailable" };
    },
  });
  assert.equal((await runRankingCycle(options)).reason, "staging_unavailable");
  assert.equal(sends, 1);
});

for (const final of [
  { state: "staged" },
  { state: "unavailable" },
  { state: "published", contentSha256: "0".repeat(64) },
  { state: "published", contentSha256: [digest] },
]) {
  test(`invalid second acknowledgement ${JSON.stringify(final)} is not success`, async () => {
    let count = 0;
    const { options } = setup({
      publish: async (payload) => ({
        state: "staged",
        contentSha256: digest,
        requestId: payload.requestId,
        ...(count++ ? final : {}),
      }),
    });
    assert.equal((await runRankingCycle(options)).reason, "publication_unavailable");
  });
}

test("exceptions never expose source details or credentials", async () => {
  const { options } = setup({
    collect: async () => {
      throw new Error(secret);
    },
  });
  assert.deepEqual(await runRankingCycle(options), {
    state: "unavailable",
    reason: "cycle_unavailable",
  });
});

for (const reason of [
  "master_catalog_shape",
  "master_catalog_coverage_limit",
  "page_size_invalid",
  "selection_list_coverage_limit",
  "calendar_list_coverage_limit",
  "imobs_native_coverage_limit",
  "imobs_identity_coverage_limit",
  "developments_native_coverage_limit",
  "developments_identity_coverage_limit",
  "mapping_invalid",
  "definition_changed",
  "master_changed",
  "selection_unproven",
  "totals_mismatch",
  "incomplete_page",
  "reload_changed",
  "cleanup_failed",
  "csrf_unavailable",
  "access_denied",
  "transport_timeout",
  "page_disposal_unconfirmed",
]) {
  test(`allowlisted collection failure survives cycle and artifact: ${reason}`, async () => {
    const { options, calls } = setup({
      collect: async () => ({ status: "unavailable", reason, payload: secret, error: secret }),
    });
    const result = await runRankingCycle(options);
    assert.deepEqual(result, { state: "unavailable", reason });
    assert.deepEqual(rankingCycleArtifact(result).result, { state: "unavailable", code: reason });
    assert.equal(calls.length, 0);
  });
}

for (const reason of [secret, "mapping_invalid:private", ["mapping_invalid"], {}, null, 123]) {
  test(`untrusted collection reason is not propagated: ${JSON.stringify(reason)}`, async () => {
    const { options, calls } = setup({ collect: async () => ({ status: "unavailable", reason }) });
    assert.deepEqual(await runRankingCycle(options), {
      state: "unavailable",
      reason: "collection_unavailable",
    });
    assert.equal(calls.length, 0);
  });
}

test("reauth failure diagnostics are allowlisted and cancellation wins", async () => {
  const { options, controller } = setup({
    collect: async () => ({ status: "reauth_required", reason: "csrf_unavailable", secret }),
  });
  assert.deepEqual(await runRankingCycle(options), {
    state: "reauth_required",
    reason: "csrf_unavailable",
  });
  const next = setup({
    collect: async () => {
      controller.abort();
      return { status: "unavailable", reason: "mapping_invalid" };
    },
    signal: controller.signal,
  });
  assert.deepEqual(await runRankingCycle(next.options), {
    state: "unavailable",
    reason: "cancelled",
  });
});
