import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  baselineFile,
  localConnection,
  projectionDefinition,
  syntheticPayload,
  temporaryDefinition,
} from "./appointments-projection-benchmark.mjs";

test("benchmark refuses remote, forwarded/nonstandard port and ambiguous database targets", () => {
  for (const url of [
    "postgres://postgres:fixture@example.test:54322/postgres",
    "postgres://postgres:fixture@127.0.0.1:5432/postgres",
    "postgres://postgres:fixture@127.0.0.1:54322/customer",
    "postgres://postgres:fixture@127.0.0.1:54322/postgres?sslmode=disable",
  ]) {
    assert.throws(() => localConnection(url), /isolated local/u);
  }
  assert.equal(localConnection().host, "127.0.0.1");
  assert.equal(localConnection("postgres://postgres:fixture@[::1]:54322/postgres").host, "::1");
});

test("temporary alternatives retain final ordering, masking and fallback while changing only intermediate sorts", async () => {
  const source = await readFile(baselineFile, "utf8");
  const original = projectionDefinition(source);
  const alternative = temporaryDefinition(original, "appointments_no_sort", true);
  assert.ok(alternative.includes("order by g.key,g.store"));
  assert.ok(alternative.includes("order by row->>'createdAt'"));
  assert.ok(alternative.includes("private.project_crm_appointments_analysis_v3_base"));
  assert.ok(!alternative.includes("order by f"));
  assert.throws(() => temporaryDefinition(original, "private_arbitrary_function"));
});

test("both benchmark volumes satisfy the actual v4 schema and retain complete funnel/privacy inputs", () => {
  for (const [rows, labels] of [
    [5000, 30],
    [20000, 300],
  ]) {
    const payload = syntheticPayload(rows, labels);
    assert.equal(payload.facts.length, rows);
    assert.equal(payload.appointments.length, rows / 5);
    assert.equal(new Set(payload.facts.map((f) => f[0])).size, 5);
    assert.equal(payload.dimensions.owners.length, labels);
    assert.ok(
      payload.appointments.every((a) => a.accountName.startsWith("Protected synthetic account")),
    );
  }
});
