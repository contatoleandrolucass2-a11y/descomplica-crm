import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  baselineFile,
  candidateFile,
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

test("candidate removes only intermediate sorts; set-based alternative retains historical ordering", async () => {
  const original = projectionDefinition(await readFile(baselineFile, "utf8"));
  const candidate = projectionDefinition(await readFile(candidateFile, "utf8"));
  assert.equal(
    candidate,
    original
      .replace("jsonb_agg(f order by f)", "jsonb_agg(f)")
      .replace("'-1'::jsonb)) order by f)", "'-1'::jsonb)))"),
  );
  assert.ok(candidate.includes("order by g.key,g.store"));
  assert.ok(candidate.includes("order by row->>'createdAt'"));
  assert.ok(candidate.includes("private.project_crm_appointments_analysis_v3_base"));
  assert.ok(!candidate.includes("order by f"));
  const alternative = temporaryDefinition(original, "appointments_set_based_alternative", true);
  assert.ok(alternative.includes("select distinct (f->>v_position)::int as original"));
  assert.ok(alternative.includes("jsonb_agg(f order by f)"));
  assert.ok(alternative.includes("order by g.key,g.store"));
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
